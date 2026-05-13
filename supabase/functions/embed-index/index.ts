import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const BATCH = 64;
const MAX_CHARS = 4000;

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: inputs }),
  });
  if (!resp.ok) throw new Error(`OpenAI embeddings ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  try {
    const { projectId, limit = 200 } = await req.json();
    if (!projectId || typeof projectId !== "string") throw new Error("projectId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: rows, error } = await admin.rpc("search_index_pending", {
      p_project_id: projectId,
      p_limit: Math.min(Math.max(Number(limit) || 200, 1), 1000),
    });
    if (error) throw error;
    const pending = (rows ?? []) as Array<{ id: string; content: string }>;
    if (pending.length === 0) {
      return new Response(JSON.stringify({ embedded: 0, remaining: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    let embedded = 0;
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      const inputs = chunk.map((r) => (r.content || "").slice(0, MAX_CHARS));
      const vectors = await embedBatch(inputs);
      // Update each row individually (small batches; simple & reliable)
      await Promise.all(
        chunk.map((row, idx) =>
          admin
            .from("search_index")
            .update({ embedding: `[${vectors[idx].join(",")}]`, embedded_at: new Date().toISOString() })
            .eq("id", row.id),
        ),
      );
      embedded += chunk.length;
    }

    // Remaining count for the caller
    const { count } = await admin
      .from("search_index")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("embedding", null);

    return new Response(JSON.stringify({ embedded, remaining: count ?? 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (err) {
    console.error("embed-index error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? String(err) }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
