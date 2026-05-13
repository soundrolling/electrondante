import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

type ProposalKind = "add_note" | "add_contact" | "add_calendar_event";

function asString(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  try {
    const { proposal } = await req.json();
    if (!proposal || typeof proposal !== "object") throw new Error("proposal required");
    const kind = proposal.kind as ProposalKind;
    const projectId = proposal.projectId as string;
    const payload = (proposal.payload ?? {}) as Record<string, unknown>;
    if (!projectId || typeof projectId !== "string") throw new Error("projectId required");
    if (!["add_note", "add_contact", "add_calendar_event"].includes(kind)) {
      throw new Error(`unsupported proposal kind: ${kind}`);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Resolve caller's email (used as note creator and for RLS-friendly defaults)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const email = userData?.user?.email?.toLowerCase() ?? null;
    if (!email) throw new Error("authenticated user required");

    if (kind === "add_note") {
      const note = asString(payload.note);
      if (!note) throw new Error("note text is required");
      const locationHint = asString(payload.location_hint);

      // Best-effort: resolve location_hint against this project's locations
      let location_id: number | null = null;
      if (locationHint) {
        const { data: locs } = await supabase
          .from("locations")
          .select("id, stage_name, venue_name")
          .eq("project_id", projectId);
        const lh = locationHint.toLowerCase();
        const match = (locs ?? []).find((l) => {
          const stage = (l.stage_name ?? "").toLowerCase();
          const venue = (l.venue_name ?? "").toLowerCase();
          return stage === lh || venue === lh || stage.includes(lh) || venue.includes(lh) || lh.includes(stage) || lh.includes(venue);
        });
        if (match) location_id = match.id as number;
      }

      const insert = {
        project_id: projectId,
        note,
        creator_email: email,
        location_id,
        recording_date: new Date().toISOString().slice(0, 10),
      };
      const { data, error } = await supabase.from("notes").insert(insert).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, kind, id: data.id, summary: "Note saved." }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (kind === "add_contact") {
      const name = asString(payload.name);
      if (!name) throw new Error("contact name is required");
      const insert = {
        project_id: projectId,
        name,
        role: asString(payload.role),
        email: asString(payload.email),
        phone: asString(payload.phone),
        comments: asString(payload.comments),
      };
      const { data, error } = await supabase.from("project_contacts").insert(insert).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, kind, id: data.id, summary: `Added ${name}.` }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (kind === "add_calendar_event") {
      const title = asString(payload.title);
      const event_date = asString(payload.event_date);
      if (!title) throw new Error("event title is required");
      if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        throw new Error("event_date must be ISO date YYYY-MM-DD");
      }
      const insert: Record<string, unknown> = {
        project_id: projectId,
        title,
        event_date,
        category: asString(payload.category),
        notes: asString(payload.notes),
      };
      const start = asString(payload.start_time);
      const end = asString(payload.end_time);
      if (start && /^\d{2}:\d{2}/.test(start)) insert.start_time = start;
      if (end && /^\d{2}:\d{2}/.test(end)) insert.end_time = end;

      const { data, error } = await supabase
        .from("calendar_events")
        .insert(insert)
        .select("id")
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, kind, id: data.id, summary: `Added "${title}" on ${event_date}.` }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    throw new Error("unreachable");
  } catch (err) {
    console.error("assistant-action error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? String(err) }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
