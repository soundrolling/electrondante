import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const FTS_CANDIDATES = 30;
const RERANK_SNIPPET_CHARS = 240;

type Row = {
  id: string;
  source_table: string;
  source_id: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  score: number;
  project_id?: string;
  project_name?: string;
};

type Scope = "project" | "global";
type AnswerResult = { kind: "answer"; rankedIds: string[]; answer: string | null };
type ProposalKind = "add_note" | "add_contact" | "add_calendar_event";
type ProposalResult = {
  kind: "proposal";
  proposalKind: ProposalKind;
  payload: Record<string, unknown>;
};
type HaikuResult = AnswerResult | ProposalResult;

const ANSWER_TOOL = {
  name: "answer_and_rank",
  description: "Return ranked candidate IDs plus an optional natural-language answer. Use when the user is asking a question or browsing.",
  input_schema: {
    type: "object",
    properties: {
      ranked_ids: {
        type: "array",
        items: { type: "string" },
        description: "Candidate IDs from most to least relevant. Omit irrelevant ones. May be empty.",
      },
      answer: {
        type: "string",
        description: "1–3 sentence answer grounded in the candidates. Empty string if the query isn't a question or nothing relevant is found.",
      },
    },
    required: ["ranked_ids", "answer"],
  },
};

const WRITE_TOOLS = [
  {
    name: "propose_add_note",
    description: "Propose adding a new note to this project. Use this when the user asks you to add, save, jot down, or record a note. Nothing is saved until the user confirms.",
    input_schema: {
      type: "object",
      properties: {
        note: { type: "string", description: "The full note body the user wants to save." },
        location_hint: { type: "string", description: "Optional stage or location name the note is about (matched server-side). Leave empty if not specified." },
      },
      required: ["note"],
    },
  },
  {
    name: "propose_add_contact",
    description: "Propose adding a new contact to this project. Use this when the user asks to add/save a person, contact, crew member, vendor, etc. Nothing is saved until the user confirms.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Contact's full name." },
        role: { type: "string", description: "Job title / role on the project, e.g. 'FOH engineer'." },
        email: { type: "string" },
        phone: { type: "string" },
        comments: { type: "string", description: "Any additional context." },
      },
      required: ["name"],
    },
  },
  {
    name: "propose_add_calendar_event",
    description: "Propose adding a calendar event to this project. Use this when the user asks to add/save/schedule something on a date or time. Nothing is saved until the user confirms.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        event_date: { type: "string", description: "ISO date YYYY-MM-DD. Resolve relative dates (e.g. 'next Thursday') against today's date in the system message." },
        category: { type: "string", description: "Free-form category, e.g. build, show, travel, meeting, load-in, soundcheck." },
        start_time: { type: "string", description: "HH:MM 24-hour. Optional." },
        end_time: { type: "string", description: "HH:MM 24-hour. Optional." },
        notes: { type: "string", description: "Optional details." },
      },
      required: ["title", "event_date"],
    },
  },
];

async function haikuTurn(
  query: string,
  rows: Row[],
  opts: { scope: Scope; today: string; allowWrites: boolean },
): Promise<HaikuResult | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;

  const candidates = rows.map((r) => ({
    id: r.id,
    kind: r.source_table,
    project: opts.scope === "global" ? (r.project_name ?? "") : undefined,
    title: (r.title ?? "").slice(0, 120),
    snippet: (r.content ?? "").slice(0, RERANK_SNIPPET_CHARS),
  }));

  const scopeNote = opts.scope === "global"
    ? "Candidates span MULTIPLE projects the user belongs to. Each candidate names its project. When answering, mention the project a fact comes from."
    : "Candidates all come from one project.";

  const writeNote = opts.allowWrites
    ? "If the user is asking you to ADD, CREATE, SAVE, JOT DOWN, RECORD, or SCHEDULE something (rather than asking a question), call the appropriate propose_* tool instead of answer_and_rank. Pick exactly one tool per turn."
    : "Write tools are disabled in this scope. Always use answer_and_rank.";

  const tools = opts.allowWrites ? [ANSWER_TOOL, ...WRITE_TOOLS] : [ANSWER_TOOL];

  const body = {
    model: HAIKU_MODEL,
    max_tokens: 700,
    system: [
      `Today is ${opts.today}.`,
      "You are the in-app assistant for a film/audio production app.",
      "You receive a user's query plus candidate items (notes, contacts, stages, venues, schedules, calendar events, gear, project docs, stage docs, trips, accommodations, flights, travel documents).",
      scopeNote,
      writeNote,
      "When using answer_and_rank: pick the candidates that are genuinely relevant and order them most-relevant first. Write a 1–3 sentence answer grounded only in the candidate snippets when the query is a question. Reference items by title, not id. Never invent details.",
      "If the user query is just a keyword or a person/place/thing name, leave the answer empty — the user is browsing.",
    ].join(" "),
    tools,
    tool_choice: { type: "any" },
    messages: [{
      role: "user",
      content: `Query: ${query}\n\nCandidates (JSON):\n${JSON.stringify(candidates)}`,
    }],
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    console.error("Haiku turn failed:", resp.status, await resp.text());
    return null;
  }
  const json = await resp.json();
  const block = (json?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!block) return null;

  const name = block.name as string;
  if (name === "answer_and_rank") {
    const ids = block.input?.ranked_ids;
    const answer = block.input?.answer;
    if (!Array.isArray(ids)) return null;
    const allowed = new Set(rows.map((r) => r.id));
    return {
      kind: "answer",
      rankedIds: ids.filter((id: string) => allowed.has(id)),
      answer: typeof answer === "string" && answer.trim() ? answer.trim() : null,
    };
  }
  if (name === "propose_add_note" || name === "propose_add_contact" || name === "propose_add_calendar_event") {
    return {
      kind: "proposal",
      proposalKind: name.replace("propose_", "") as ProposalKind,
      payload: (block.input ?? {}) as Record<string, unknown>,
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  try {
    const { projectId, query, limit = 20 } = await req.json();
    if (typeof query !== "string") throw new Error("query required");
    const projectScope: boolean = typeof projectId === "string" && projectId.length > 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return new Response(JSON.stringify({ results: [], answer: null, reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let candidates: Row[] = [];
    let usedFallback = false;

    if (projectScope) {
      const { data, error } = await supabase.rpc("search_project", {
        p_project_id: projectId,
        p_query: trimmed,
        p_query_embedding: null,
        p_limit: FTS_CANDIDATES,
      });
      if (error) throw error;
      candidates = (data ?? []) as Row[];

      if (candidates.length === 0) {
        const { data: recent, error: rErr } = await supabase
          .from("search_index")
          .select("id, source_table, source_id, title, content, metadata")
          .eq("project_id", projectId)
          .order("indexed_at", { ascending: false })
          .limit(50);
        if (rErr) throw rErr;
        candidates = ((recent ?? []) as Omit<Row, "score">[]).map((r) => ({ ...r, score: 0 }));
        usedFallback = true;
      }
    } else {
      const { data, error } = await supabase.rpc("search_user_projects", {
        p_query: trimmed,
        p_query_embedding: null,
        p_limit: FTS_CANDIDATES,
      });
      if (error) throw error;
      candidates = (data ?? []) as Row[];
    }

    // Global mode with no candidates: bail. Project mode: still let Haiku see
    // the query so it can propose writes from scratch.
    if (candidates.length === 0 && !projectScope) {
      return new Response(JSON.stringify({ results: [], answer: null, reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const haiku = await haikuTurn(trimmed, candidates, {
      scope: projectScope ? "project" : "global",
      today,
      allowWrites: projectScope,
    });

    const finalLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    if (haiku === null) {
      const results = usedFallback ? [] : candidates.slice(0, finalLimit);
      return new Response(
        JSON.stringify({ results, answer: null, reranked: false, scope: projectScope ? "project" : "global" }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    if (haiku.kind === "proposal") {
      return new Response(
        JSON.stringify({
          results: [],
          answer: null,
          reranked: true,
          scope: projectScope ? "project" : "global",
          proposal: {
            kind: haiku.proposalKind,
            projectId,
            payload: haiku.payload,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
      );
    }

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const results = haiku.rankedIds
      .map((id) => byId.get(id))
      .filter((r): r is Row => !!r)
      .slice(0, finalLimit);

    return new Response(
      JSON.stringify({
        results,
        answer: haiku.answer,
        reranked: true,
        scope: projectScope ? "project" : "global",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
    );
  } catch (err) {
    console.error("search error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }
});
