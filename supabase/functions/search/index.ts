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

type RankResult = { rankedIds: string[]; answer: string | null };

async function haikuRank(
  query: string,
  rows: Row[],
  opts: { scope: "project" | "global" },
): Promise<RankResult | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  if (rows.length === 0) return { rankedIds: [], answer: null };

  const candidates = rows.map((r) => ({
    id: r.id,
    kind: r.source_table,
    project: opts.scope === "global" ? (r.project_name ?? "") : undefined,
    title: (r.title ?? "").slice(0, 120),
    snippet: (r.content ?? "").slice(0, RERANK_SNIPPET_CHARS),
  }));

  const scopeNote = opts.scope === "global"
    ? "Candidates span MULTIPLE projects the user belongs to. Each candidate names its project. When answering, mention the project a fact comes from so the user knows which one. Only pick one project's data per fact unless the user explicitly asked across projects."
    : "Candidates all come from one project.";

  const body = {
    model: HAIKU_MODEL,
    max_tokens: 700,
    system: [
      "You are the in-app assistant for a film/audio production app.",
      "You receive a user's query plus candidate items (notes, contacts, stages, venues, schedules, calendar events, gear, project docs, stage docs, trips, accommodations, flights, travel documents).",
      scopeNote,
      "Pick the candidates that are genuinely relevant and order them most-relevant first; omit anything that doesn't fit.",
      "When the query is a question (or clearly seeks an answer rather than a navigation target), also write a concise natural-language answer (1–3 sentences) grounded only in the candidate snippets. Reference items by their title, not their id. Never invent details that aren't in the candidates.",
      "If the query is just a keyword or a person/place/thing name, leave the answer empty — the user is browsing, not asking.",
      "If nothing in the candidates is relevant, return an empty ranked list and an empty answer.",
    ].join(" "),
    tools: [{
      name: "answer_and_rank",
      description: "Return ranked candidate IDs plus an optional natural-language answer.",
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
    }],
    tool_choice: { type: "tool", name: "answer_and_rank" },
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
    console.error("Haiku rank failed:", resp.status, await resp.text());
    return null;
  }
  const json = await resp.json();
  const block = (json?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  const ids = block?.input?.ranked_ids;
  const answer = block?.input?.answer;
  if (!Array.isArray(ids)) return null;
  const allowed = new Set(rows.map((r) => r.id));
  return {
    rankedIds: ids.filter((id: string) => allowed.has(id)),
    answer: typeof answer === "string" && answer.trim() ? answer.trim() : null,
  };
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
      // Cross-project: RLS already scopes search_index to the user's projects.
      const { data, error } = await supabase.rpc("search_user_projects", {
        p_query: trimmed,
        p_query_embedding: null,
        p_limit: FTS_CANDIDATES,
      });
      if (error) throw error;
      candidates = (data ?? []) as Row[];
      // No fallback for global mode — an empty FTS result is a genuine miss
      // and we don't want to ship 50 random rows from every project.
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ results: [], answer: null, reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const rank = await haikuRank(trimmed, candidates, {
      scope: projectScope ? "project" : "global",
    });
    const finalLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    let results: Row[];
    let answer: string | null = null;
    if (rank === null) {
      results = usedFallback ? [] : candidates.slice(0, finalLimit);
    } else {
      const byId = new Map(candidates.map((c) => [c.id, c]));
      results = rank.rankedIds.map((id) => byId.get(id)).filter((r): r is Row => !!r).slice(0, finalLimit);
      answer = rank.answer;
    }

    return new Response(
      JSON.stringify({ results, answer, reranked: rank !== null, scope: projectScope ? "project" : "global" }),
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
