import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { source_id } = await req.json();
    if (!source_id) return new Response(JSON.stringify({ error: "source_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: src } = await supa.from("org_external_sources").select("*").eq("id", source_id).maybeSingle();
    if (!src) return new Response(JSON.stringify({ error: "source_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (src.kind !== "website") {
      await supa.from("org_external_sources").update({ last_status: "social_not_supported_yet", last_synced_at: new Date().toISOString() }).eq("id", source_id);
      return new Response(JSON.stringify({ ok: true, note: "social_not_supported_yet" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!FIRECRAWL_API_KEY) {
      await supa.from("org_external_sources").update({ last_status: "firecrawl_not_configured", last_synced_at: new Date().toISOString() }).eq("id", source_id);
      return new Response(JSON.stringify({ error: "firecrawl_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Scrape main page in markdown
    const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: src.url, formats: ["markdown", "summary"], onlyMainContent: true }),
    });
    const fcData = await fcResp.json();
    if (!fcResp.ok) {
      await supa.from("org_external_sources").update({ last_status: `firecrawl_failed:${fcResp.status}`, last_synced_at: new Date().toISOString() }).eq("id", source_id);
      return new Response(JSON.stringify({ error: "firecrawl_failed", details: fcData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const markdown: string = fcData?.markdown || fcData?.data?.markdown || "";
    const summary: string = fcData?.summary || fcData?.data?.summary || "";

    // Use AI to extract structured insights
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت محلل محتوى لجمعيات خيرية. تستخرج الأخبار والفعاليات والإحصائيات والبرامج من محتوى الموقع." },
          { role: "user", content: `استخرج كل العناصر المهمة من محتوى موقع الجمعية:\n\n${markdown.slice(0, 12000)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_insights",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["news","event","statistic","program","general"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      occurred_at: { type: ["string","null"], description: "YYYY-MM-DD or null" },
                    },
                    required: ["category","title"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_insights" } },
      }),
    });
    const aiData = await aiResp.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { insights: [] };

    // Replace insights
    await supa.from("org_external_insights").delete().eq("source_id", source_id);
    if (parsed.insights?.length) {
      const rows = parsed.insights.map((i: any) => ({
        organization_id: src.organization_id,
        source_id,
        category: i.category,
        title: String(i.title || "").slice(0, 300),
        description: i.description || null,
        url: src.url,
        occurred_at: i.occurred_at && /^\d{4}-\d{2}-\d{2}$/.test(i.occurred_at) ? i.occurred_at : null,
      }));
      await supa.from("org_external_insights").insert(rows);
    }

    await supa.from("org_external_sources").update({
      summary: summary || markdown.slice(0, 1000),
      last_synced_at: new Date().toISOString(),
      last_status: "synced",
    }).eq("id", source_id);

    return new Response(JSON.stringify({ ok: true, insights_count: parsed.insights?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});