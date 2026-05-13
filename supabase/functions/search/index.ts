import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!resp.ok) {
    console.error("embedQuery failed:", resp.status, await resp.text());
    return null;
  }
  const json = await resp.json();
  return json?.data?.[0]?.embedding ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  try {
    const { projectId, query, limit = 20 } = await req.json();
    if (!projectId || typeof projectId !== "string") throw new Error("projectId required");
    if (typeof query !== "string") throw new Error("query required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use the caller's JWT so RLS scopes results to projects they belong to.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const trimmed = query.trim();
    const embedding = trimmed.length >= 2 ? await embedQuery(trimmed) : null;
    const embeddingLiteral = embedding ? `[${embedding.join(",")}]` : null;

    const { data, error } = await supabase.rpc("search_project", {
      p_project_id: projectId,
      p_query: trimmed,
      p_query_embedding: embeddingLiteral,
      p_limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ results: data ?? [], embedded: !!embedding }),
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
