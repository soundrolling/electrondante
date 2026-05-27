-- Migration: Maps feature (floorplans + geographic pins)
-- Adds three tables (map_floorplans, floorplan_pins, map_locations) and a
-- private storage bucket "floorplans" for venue floorplan images.
--
-- All tables are scoped to a project via project_id and inherit access from
-- project_members. Pins are coordinates we own — geographic pins use
-- lat/lng floats, floorplan pins use 0..1 normalised x/y so they survive
-- floorplan image resize.

-- =====================================================================
-- 1. map_floorplans
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.map_floorplans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  location_id BIGINT REFERENCES public.locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT map_floorplans_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_map_floorplans_project_id
  ON public.map_floorplans(project_id);
CREATE INDEX IF NOT EXISTS idx_map_floorplans_location_id
  ON public.map_floorplans(location_id);

ALTER TABLE public.map_floorplans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members select floorplans" ON public.map_floorplans;
CREATE POLICY "members select floorplans"
  ON public.map_floorplans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_floorplans.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members insert floorplans" ON public.map_floorplans;
CREATE POLICY "members insert floorplans"
  ON public.map_floorplans FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_floorplans.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members update floorplans" ON public.map_floorplans;
CREATE POLICY "members update floorplans"
  ON public.map_floorplans FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_floorplans.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members delete floorplans" ON public.map_floorplans;
CREATE POLICY "members delete floorplans"
  ON public.map_floorplans FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_floorplans.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

-- =====================================================================
-- 2. floorplan_pins
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.floorplan_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  floorplan_id UUID NOT NULL REFERENCES public.map_floorplans(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT,
  color TEXT,
  x_norm DOUBLE PRECISION NOT NULL,
  y_norm DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT floorplan_pins_label_not_blank CHECK (length(trim(label)) > 0),
  CONSTRAINT floorplan_pins_x_range CHECK (x_norm >= 0 AND x_norm <= 1),
  CONSTRAINT floorplan_pins_y_range CHECK (y_norm >= 0 AND y_norm <= 1)
);

CREATE INDEX IF NOT EXISTS idx_floorplan_pins_floorplan_id
  ON public.floorplan_pins(floorplan_id);
CREATE INDEX IF NOT EXISTS idx_floorplan_pins_project_id
  ON public.floorplan_pins(project_id);

ALTER TABLE public.floorplan_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members select floorplan_pins" ON public.floorplan_pins;
CREATE POLICY "members select floorplan_pins"
  ON public.floorplan_pins FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = floorplan_pins.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members insert floorplan_pins" ON public.floorplan_pins;
CREATE POLICY "members insert floorplan_pins"
  ON public.floorplan_pins FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = floorplan_pins.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members update floorplan_pins" ON public.floorplan_pins;
CREATE POLICY "members update floorplan_pins"
  ON public.floorplan_pins FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = floorplan_pins.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members delete floorplan_pins" ON public.floorplan_pins;
CREATE POLICY "members delete floorplan_pins"
  ON public.floorplan_pins FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = floorplan_pins.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

-- =====================================================================
-- 3. map_locations (geographic pins on OSM)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.map_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT,
  color TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT map_locations_label_not_blank CHECK (length(trim(label)) > 0),
  CONSTRAINT map_locations_lat_range CHECK (lat >= -90 AND lat <= 90),
  CONSTRAINT map_locations_lng_range CHECK (lng >= -180 AND lng <= 180)
);

CREATE INDEX IF NOT EXISTS idx_map_locations_project_id
  ON public.map_locations(project_id);

ALTER TABLE public.map_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members select map_locations" ON public.map_locations;
CREATE POLICY "members select map_locations"
  ON public.map_locations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_locations.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members insert map_locations" ON public.map_locations;
CREATE POLICY "members insert map_locations"
  ON public.map_locations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_locations.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members update map_locations" ON public.map_locations;
CREATE POLICY "members update map_locations"
  ON public.map_locations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_locations.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

DROP POLICY IF EXISTS "members delete map_locations" ON public.map_locations;
CREATE POLICY "members delete map_locations"
  ON public.map_locations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = map_locations.project_id
      AND pm.user_email = auth.jwt() ->> 'email'
  ));

-- =====================================================================
-- 4. Storage bucket "floorplans" (private, 15MB, images + PDF)
-- =====================================================================
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'floorplans',
    'floorplans',
    false,
    15728640,  -- 15 MB
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Cannot create bucket "floorplans" — create it via Supabase Dashboard';
  WHEN OTHERS THEN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'floorplans') THEN
      RAISE NOTICE 'Bucket "floorplans" already exists';
    ELSE
      RAISE WARNING 'Could not create bucket: %', SQLERRM;
    END IF;
END $$;

-- Storage object policies for the floorplans bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "auth upload floorplans" ON storage.objects;
  DROP POLICY IF EXISTS "auth read floorplans"   ON storage.objects;
  DROP POLICY IF EXISTS "auth update floorplans" ON storage.objects;
  DROP POLICY IF EXISTS "auth delete floorplans" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "auth upload floorplans"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'floorplans');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "auth read floorplans"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'floorplans');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "auth update floorplans"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'floorplans')
    WITH CHECK (bucket_id = 'floorplans');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "auth delete floorplans"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'floorplans');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
