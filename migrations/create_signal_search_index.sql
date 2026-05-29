-- Signal-flow search indexing
-- =================================================================
-- Makes the Signal Mapper's data answerable by the in-app assistant
-- (the Cmd/Ctrl-K search, which retrieves + reranks rows from
-- public.search_index). Adds three new source types:
--
--   'venue_source_feeds' — one row per venue-sources node, listing its feeds
--   'signal_flow'        — one row per (project, stage): structural counts
--                          (sources/stageboxes/recorders/channels/unrouted),
--                          maintained by triggers on nodes + connections
--   'cable_estimate'     — one row per stage: cable metres + multicore,
--                          pushed from the client (only the browser has the
--                          floor-plan image size needed to scale the run
--                          lengths) via the membership-checked RPC below.
--
-- All trigger bodies swallow their own errors so a search-index failure can
-- never roll back a user's signal-flow edit. Mirrors the existing trg_si_*
-- pattern + sync_search_index/remove_from_search_index helpers.

-- ── Smallest standard multicore that carries N channels ───────────
-- Mirrors STANDARD_MULTICORE in useCableEstimate.js.
CREATE OR REPLACE FUNCTION public.nearest_multicore(p_channels int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_channels IS NULL OR p_channels <= 0 THEN 0
    WHEN p_channels <= 4  THEN 4
    WHEN p_channels <= 8  THEN 8
    WHEN p_channels <= 12 THEN 12
    WHEN p_channels <= 16 THEN 16
    WHEN p_channels <= 24 THEN 24
    WHEN p_channels <= 32 THEN 32
    WHEN p_channels <= 48 THEN 48
    ELSE (ceil(p_channels::numeric / 48) * 48)::int
  END
$$;

-- ════════════════════════════════════════════════════════════════
-- 1. VENUE SOURCE FEEDS  →  one search_index row per venue node
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rebuild_venue_feeds_index(p_node_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_project_id uuid;
  v_label text;
  v_feeds text;
BEGIN
  IF p_node_id IS NULL THEN RETURN; END IF;

  SELECT n.project_id, n.label INTO v_project_id, v_label
  FROM public.nodes n WHERE n.id = p_node_id;

  SELECT string_agg(
           COALESCE(NULLIF(btrim(f.output_port_label), ''),
                    initcap(replace(f.source_type, '_', ' ')) || ' ' || f.feed_identifier)
           || ' (port ' || f.port_number || ')',
           ' • ' ORDER BY f.port_number, COALESCE(f.channel, 0))
    INTO v_feeds
  FROM public.venue_source_feeds f
  WHERE f.node_id = p_node_id;

  IF v_project_id IS NULL OR v_feeds IS NULL THEN
    PERFORM public.remove_from_search_index('venue_source_feeds', p_node_id::text);
    RETURN;
  END IF;

  PERFORM public.sync_search_index(
    v_project_id, 'venue_source_feeds', p_node_id::text,
    COALESCE(NULLIF(btrim(v_label), ''), 'Venue sources'),
    concat_ws(' — ',
      COALESCE(NULLIF(btrim(v_label), ''), 'Venue sources') || ' venue source feeds',
      v_feeds),
    jsonb_build_object('icon', 'radio', 'kind', 'venue_feed', 'node_id', p_node_id)
  );
END $$;

CREATE OR REPLACE FUNCTION public.trg_si_venue_source_feeds()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.rebuild_venue_feeds_index(COALESCE(NEW.node_id, OLD.node_id));
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);  -- never let indexing break a feed edit
END $$;

DROP TRIGGER IF EXISTS trg_search_index_venue_feeds ON public.venue_source_feeds;
CREATE TRIGGER trg_search_index_venue_feeds
AFTER INSERT OR UPDATE OR DELETE ON public.venue_source_feeds
FOR EACH ROW EXECUTE FUNCTION public.trg_si_venue_source_feeds();

-- ════════════════════════════════════════════════════════════════
-- 2. SIGNAL FLOW STRUCTURE  →  one row per (project, stage)
-- ════════════════════════════════════════════════════════════════
-- Node-kind classification mirrors nodeKind() in useCableEstimate.js:
-- a kind is decided by gear_type (falling back to type). 'venue_sources'
-- counts as a source there, so channels = connections out of any *source*
-- (incl. venue) — but we describe mics/DIs and venue feeds separately.
-- Grouping is by stage (locations.id) because stage_hour_id is null on many
-- rows and the floor plan / cabling all hang off the stage.
CREATE OR REPLACE FUNCTION public.rebuild_signal_flow_summary(p_project_id uuid, p_location_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_source_id text := p_project_id::text || ':' || COALESCE(p_location_id::text, 'none');
  v_stage text;
  v_sources int; v_stageboxes int; v_recorders int; v_venue int;
  v_conns int; v_channels int; v_unrouted int;
  v_title text; v_content text; v_box_text text;
BEGIN
  IF p_project_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(NULLIF(btrim(l.stage_name), ''), NULLIF(btrim(l.venue_name), ''))
    INTO v_stage
  FROM public.locations l WHERE l.id = p_location_id;

  -- Node counts for this stage. Mics/DIs = source AND not venue; venue counted apart.
  SELECT
    count(*) FILTER (WHERE lower(coalesce(n.gear_type, n.type)) LIKE '%source%'
                       AND lower(coalesce(n.gear_type, n.type)) NOT LIKE '%venue%'),
    count(*) FILTER (WHERE lower(coalesce(n.gear_type, n.type)) LIKE '%transformer%'),
    count(*) FILTER (WHERE lower(coalesce(n.gear_type, n.type)) LIKE '%recorder%'),
    count(*) FILTER (WHERE lower(coalesce(n.gear_type, n.type)) LIKE '%venue%')
  INTO v_sources, v_stageboxes, v_recorders, v_venue
  FROM public.nodes n
  WHERE n.project_id = p_project_id AND n.location_id IS NOT DISTINCT FROM p_location_id;

  -- Connections anchored on the FROM node's stage (connections.location_id is
  -- unreliable / often null). Channels = runs out of a source (mirrors xlrTails).
  SELECT count(*),
         count(*) FILTER (WHERE lower(coalesce(fn.gear_type, fn.type)) LIKE '%source%')
    INTO v_conns, v_channels
  FROM public.connections c
  JOIN public.nodes fn ON fn.id = c.from_node_id
  WHERE c.project_id = p_project_id AND fn.location_id IS NOT DISTINCT FROM p_location_id;

  -- Mics/DIs placed in this stage but not wired into anything.
  SELECT count(*) INTO v_unrouted
  FROM public.nodes n
  WHERE n.project_id = p_project_id AND n.location_id IS NOT DISTINCT FROM p_location_id
    AND lower(coalesce(n.gear_type, n.type)) LIKE '%source%'
    AND lower(coalesce(n.gear_type, n.type)) NOT LIKE '%venue%'
    AND NOT EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.project_id = p_project_id AND (c.from_node_id = n.id OR c.to_node_id = n.id)
    );

  -- Per-stagebox incoming channel counts + suggested multicore size.
  SELECT string_agg(bt, ' • ' ORDER BY bt) INTO v_box_text FROM (
    SELECT t.label || ': ' || t.ch || ' ch (suggest ' || public.nearest_multicore(t.ch::int) || '-way multicore)' AS bt
    FROM (
      SELECT tn.id,
             COALESCE(NULLIF(btrim(tn.label), ''), 'Stagebox') AS label,
             count(c.id) FILTER (WHERE lower(coalesce(fn.gear_type, fn.type)) LIKE '%source%') AS ch
      FROM public.nodes tn
      LEFT JOIN public.connections c ON c.to_node_id = tn.id AND c.project_id = p_project_id
      LEFT JOIN public.nodes fn ON fn.id = c.from_node_id
      WHERE tn.project_id = p_project_id AND tn.location_id IS NOT DISTINCT FROM p_location_id
        AND lower(coalesce(tn.gear_type, tn.type)) LIKE '%transformer%'
      GROUP BY tn.id, tn.label
    ) t
  ) s;

  -- Empty stage → drop any stale row.
  IF coalesce(v_sources,0) + coalesce(v_stageboxes,0) + coalesce(v_recorders,0)
     + coalesce(v_venue,0) + coalesce(v_conns,0) = 0 THEN
    PERFORM public.remove_from_search_index('signal_flow', v_source_id);
    RETURN;
  END IF;

  v_title := 'Signal flow' || COALESCE(' — ' || v_stage, '');
  v_content := concat_ws(' • ',
    v_title,
    v_sources    || ' input sources (mics/DIs)',
    v_stageboxes || ' stageboxes / transformers',
    v_recorders  || ' recorders',
    NULLIF(v_venue, 0)    || ' venue source nodes',
    v_channels   || ' channels patched',
    v_conns      || ' signal connections',
    CASE WHEN v_unrouted > 0 THEN v_unrouted || ' mics/sources not wired to anything' END,
    v_box_text
  );

  PERFORM public.sync_search_index(
    p_project_id, 'signal_flow', v_source_id,
    v_title, v_content,
    jsonb_build_object('icon', 'workflow', 'kind', 'signal_flow', 'location_id', p_location_id,
      'sources', v_sources, 'stageboxes', v_stageboxes, 'recorders', v_recorders,
      'venue', v_venue, 'channels', v_channels, 'connections', v_conns, 'unrouted', v_unrouted)
  );
END $$;

CREATE OR REPLACE FUNCTION public.trg_si_nodes_flow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.project_id IS NOT NULL THEN
    PERFORM public.rebuild_signal_flow_summary(OLD.project_id, OLD.location_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.project_id IS NOT NULL THEN
    PERFORM public.rebuild_signal_flow_summary(NEW.project_id, NEW.location_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_search_index_nodes_flow ON public.nodes;
CREATE TRIGGER trg_search_index_nodes_flow
AFTER INSERT OR UPDATE OR DELETE ON public.nodes
FOR EACH ROW EXECUTE FUNCTION public.trg_si_nodes_flow();

CREATE OR REPLACE FUNCTION public.trg_si_connections_flow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rec record;
BEGIN
  IF TG_OP <> 'DELETE' AND NEW.project_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT n.location_id AS lid
      FROM public.nodes n WHERE n.id IN (NEW.from_node_id, NEW.to_node_id)
    LOOP PERFORM public.rebuild_signal_flow_summary(NEW.project_id, rec.lid); END LOOP;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.project_id IS NOT NULL THEN
    FOR rec IN
      SELECT DISTINCT n.location_id AS lid
      FROM public.nodes n WHERE n.id IN (OLD.from_node_id, OLD.to_node_id)
    LOOP PERFORM public.rebuild_signal_flow_summary(OLD.project_id, rec.lid); END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_search_index_connections_flow ON public.connections;
CREATE TRIGGER trg_search_index_connections_flow
AFTER INSERT OR UPDATE OR DELETE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.trg_si_connections_flow();

-- ════════════════════════════════════════════════════════════════
-- 3. CABLE ESTIMATE  →  one row per stage, pushed from the client
-- ════════════════════════════════════════════════════════════════
-- The browser computes run lengths (it has the floor-plan image's natural
-- pixel size + calibration). It calls this RPC, which verifies the caller
-- belongs to the stage's project before writing, so a logged-in user can't
-- poison another project's index.
CREATE OR REPLACE FUNCTION public.upsert_cable_summary(
  p_location_id bigint, p_content text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_stage text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_location_id IS NULL THEN RAISE EXCEPTION 'location required'; END IF;

  SELECT l.project_id, COALESCE(NULLIF(btrim(l.stage_name), ''), NULLIF(btrim(l.venue_name), ''))
    INTO v_project_id, v_stage
  FROM public.locations l WHERE l.id = p_location_id;

  IF v_project_id IS NULL THEN RAISE EXCEPTION 'unknown location'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = v_project_id AND p.user_id = v_uid)
     AND NOT EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = v_project_id AND m.user_id = v_uid)
  THEN
    RAISE EXCEPTION 'not a member of this project';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' THEN
    PERFORM public.remove_from_search_index('cable_estimate', p_location_id::text);
    RETURN;
  END IF;

  PERFORM public.sync_search_index(
    v_project_id, 'cable_estimate', p_location_id::text,
    'Cable estimate' || COALESCE(' — ' || v_stage, ''),
    concat_ws(' — ', 'Cable estimate' || COALESCE(' — ' || v_stage, ''), p_content),
    COALESCE(p_metadata, '{}'::jsonb)
      || jsonb_build_object('icon', 'cable', 'kind', 'cable_estimate', 'location_id', p_location_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.upsert_cable_summary(bigint, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_cable_summary(bigint, text, jsonb) TO authenticated;

-- ════════════════════════════════════════════════════════════════
-- 4. BACKFILL existing data (cable_estimate fills in as users open the
--    Cabling tab — the browser is the only place run lengths exist).
-- ════════════════════════════════════════════════════════════════
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT node_id FROM public.venue_source_feeds LOOP
    PERFORM public.rebuild_venue_feeds_index(r.node_id);
  END LOOP;
END $$;

DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT DISTINCT project_id, location_id FROM public.nodes WHERE project_id IS NOT NULL
    UNION
    SELECT DISTINCT c.project_id, fn.location_id
    FROM public.connections c JOIN public.nodes fn ON fn.id = c.from_node_id
    WHERE c.project_id IS NOT NULL
  LOOP
    PERFORM public.rebuild_signal_flow_summary(r.project_id, r.location_id);
  END LOOP;
END $$;
