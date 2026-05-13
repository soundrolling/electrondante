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
};

async function haikuRerank(query: string, rows: Row[]): Promise<string[] | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  if (rows.length < 2) return rows.map((r) => r.id);

  const candidates = rows.map((r) => ({
    id: r.id,
    kind: r.source_table,
    title: (r.title ?? "").slice(0, 120),
    snippet: (r.content ?? "").slice(0, RERANK_SNIPPET_CHARS),
  }));

  const body = {
    model: HAIKU_MODEL,
    max_tokens: 512,
    system:
      "You are a search reranker for a film/audio production app. Given a user query and candidate items from one project (notes, contacts, stages, venues, schedules, calendar events, gear, docs, travel), return the candidates that are actually relevant to the query, ordered most-relevant first. Omit clearly irrelevant ones.",
    tools: [{
      name: "rank_results",
      description: "Return candidate IDs ranked by relevance to the query.",
      input_schema: {
        type: "object",
        properties: {
          ranked_ids: {
            type: "array",
            items: { type: "string" },
            description: "Result IDs from most to least relevant; omit irrelevant ones.",
          },
        },
        required: ["ranked_ids"],
      },
    }],
    tool_choice: { type: "tool", name: "rank_results" },
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
    console.error("Haiku rerank failed:", resp.status, await resp.text());
    return null;
  }
  const json = await resp.json();
  const block = (json?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  const ids = block?.input?.ranked_ids;
  if (!Array.isArray(ids)) return null;
  // Constrain to the IDs we actually sent
  const allowed = new Set(rows.map((r) => r.id));
  return ids.filter((id: string) => allowed.has(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  try {
    const { projectId, query, limit = 20 } = await req.json();
    if (!projectId || typeof projectId !== "string") throw new Error("projectId required");
    if (typeof query !== "string") throw new Error("query required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return new Response(JSON.stringify({ results: [], reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // Pull a wider candidate set via FTS, then rerank with Haiku
    const { data, error } = await supabase.rpc("search_project", {
      p_project_id: projectId,
      p_query: trimmed,
      p_query_embedding: null,
      p_limit: FTS_CANDIDATES,
    });
    if (error) throw error;
    let candidates = (data ?? []) as Row[];
    let usedFallback = false;

    // FTS finds nothing (e.g. all-stopword queries like "what is the X").
    // Fall back to the most recent N rows so Haiku can still answer.
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

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ results: [], reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    if (candidates.length === 1 && !usedFallback) {
      return new Response(JSON.stringify({ results: candidates, reranked: false }), {
        status: 200, headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const rankedIds = await haikuRerank(trimmed, candidates);
    const finalLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    let results: Row[];
    if (rankedIds === null) {
      // Haiku unavailable (no key, network error). FTS hits keep their order;
      // the wide fallback gives nothing — those rows weren't real matches.
      results = usedFallback ? [] : candidates.slice(0, finalLimit);
    } else {
      // Haiku returned an ordered list (possibly empty when nothing is relevant)
      const byId = new Map(candidates.map((c) => [c.id, c]));
      results = rankedIds.map((id) => byId.get(id)).filter((r): r is Row => !!r).slice(0, finalLimit);
    }

    return new Response(
      JSON.stringify({ results, reranked: !!rankedIds }),
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
