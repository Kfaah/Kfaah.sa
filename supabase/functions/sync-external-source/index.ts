const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
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

    if (!FIRECRAWL_API_KEY) {
      await supa.from("org_external_sources").update({ last_status: "firecrawl_not_configured", last_synced_at: new Date().toISOString() }).eq("id", source_id);
      return new Response(JSON.stringify({ error: "firecrawl_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Scrape any public URL (website OR public social profile/page) via Firecrawl.
    // Social platforms (twitter/instagram/facebook/linkedin/youtube/tiktok) render dynamically,
    // so we wait briefly for hydration before extraction.
    const isSocial = src.kind !== "website";
    const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: src.url,
        formats: ["markdown", "summary"],
        onlyMainContent: !isSocial,
        waitFor: isSocial ? 3500 : 0,
      }),
    });
    const fcData = await fcResp.json();
    if (!fcResp.ok) {
      await supa.from("org_external_sources").update({ last_status: `firecrawl_failed:${fcResp.status}`, last_synced_at: new Date().toISOString() }).eq("id", source_id);
      return new Response(JSON.stringify({ error: "firecrawl_failed", details: fcData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const markdown: string = fcData?.markdown || fcData?.data?.markdown || "";
    const summary: string = fcData?.summary || fcData?.data?.summary || "";

    // AI extraction — adapt prompt to source kind so social posts get parsed as posts/engagement
    const sysByKind: Record<string, string> = {
      website: "أنت محلل محتوى لجمعيات خيرية. تستخرج الأخبار والفعاليات والإحصائيات والبرامج من محتوى الموقع.",
      twitter: "أنت محلل محتوى سوشيال ميديا. تستخرج التغريدات الأخيرة والإعلانات والحملات والإحصائيات (متابعون/تفاعل) من صفحة حساب على X/Twitter.",
      instagram: "أنت محلل محتوى سوشيال ميديا. تستخرج المنشورات الأخيرة والحملات والإحصائيات (متابعون/تفاعل) من صفحة حساب على إنستجرام.",
      facebook: "أنت محلل محتوى سوشيال ميديا. تستخرج المنشورات والفعاليات والإعلانات من صفحة فيسبوك للجمعية.",
      linkedin: "أنت محلل محتوى سوشيال ميديا. تستخرج المنشورات المهنية والشراكات والإنجازات من صفحة لينكدإن.",
      youtube: "أنت محلل محتوى سوشيال ميديا. تستخرج آخر الفيديوهات وعناوينها وعدد المشاهدات من قناة يوتيوب.",
      tiktok: "أنت محلل محتوى سوشيال ميديا. تستخرج آخر الفيديوهات والحملات من حساب تيك توك.",
    };
    const allowedCats = isSocial
      ? ["post","campaign","statistic","event","general"]
      : ["news","event","statistic","program","general"];
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sysByKind[src.kind] || sysByKind.website },
          { role: "user", content: `المصدر: ${src.kind} — ${src.url}\nاستخرج كل العناصر المهمة من المحتوى التالي:\n\n${markdown.slice(0, 12000)}` },
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
                      category: { type: "string", enum: allowedCats },
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