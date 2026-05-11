const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const cutoff = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();
    const { data: sources, error } = await supa
      .from("org_external_sources")
      .select("id,kind,last_synced_at")
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
      .limit(50);
    if (error) throw error;

    const results: Array<{ id: string; ok: boolean; status?: number; error?: string }> = [];
    for (const src of sources ?? []) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/sync-external-source`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ source_id: src.id }),
        });
        results.push({ id: src.id, ok: r.ok, status: r.status });
      } catch (e) {
        results.push({ id: src.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});