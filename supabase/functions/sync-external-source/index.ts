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
    let markdown = "";
    let summary = "";
    let pagesScanned = 1;

    // Helper: scrape a single URL via Firecrawl
    const scrapeOne = async (u: string, mainOnly: boolean, wait: number) => {
      const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, formats: ["markdown", "summary"], onlyMainContent: mainOnly, waitFor: wait }),
      });
      const j = await r.json();
      return { ok: r.ok, status: r.status, md: j?.markdown || j?.data?.markdown || "", sum: j?.summary || j?.data?.summary || "", raw: j };
    };

    // Step 1: scrape the homepage (or social page)
    const home = await scrapeOne(src.url, !isSocial, isSocial ? 3500 : 0);
    if (!home.ok) {
      const detailMsg = String(home.raw?.error || "");
      const unsupported = /do not support this site/i.test(detailMsg);
      const statusLabel = unsupported ? "unsupported_site" : `firecrawl_failed:${home.status}`;
      await supa.from("org_external_sources").update({
        last_status: statusLabel,
        last_synced_at: new Date().toISOString(),
      }).eq("id", source_id);
      // Return 200 with a fallback signal so the frontend doesn't crash.
      return new Response(JSON.stringify({
        ok: false,
        skipped: true,
        reason: unsupported ? "unsupported_site" : "firecrawl_failed",
        message: unsupported
          ? "هذا المصدر غير مدعوم للمسح المباشر (مثل بعض منصات التواصل). تم تخطّيه."
          : "تعذّر جلب المحتوى من هذا المصدر حالياً.",
        details: home.raw,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    markdown = home.md;
    summary = home.sum;

    // Step 2: for websites, deep-crawl the news section.
    // Use src.news_path if provided, else auto-detect common Arabic/English news paths.
    if (!isSocial) {
      try {
        const base = new URL(src.url);
        const candidatePaths = src.news_path
          ? [src.news_path]
          : ["/news", "/articles", "/media", "/blog", "/posts", "/أخبار", "/الأخبار", "/المقالات", "/المركز-الإعلامي"];

        // Map the site to discover all URLs (fast)
        const mapResp = await fetch("https://api.firecrawl.dev/v2/map", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: `${base.protocol}//${base.host}`, limit: 500, includeSubdomains: false }),
        });
        const mapJson = await mapResp.json();
        const allLinks: string[] = (mapJson?.links || mapJson?.data?.links || []).map((x: any) => typeof x === "string" ? x : x?.url).filter(Boolean);

        // Filter to news-section links
        const newsLinks = allLinks.filter((u) => {
          try {
            const p = new URL(u).pathname.toLowerCase();
            return candidatePaths.some((cp) => p.includes(cp.toLowerCase()));
          } catch { return false; }
        });

        // Cap to 8 deepest article pages to keep cost/time bounded
        const articlePages = newsLinks
          .filter((u) => u !== src.url)
          .sort((a, b) => b.split("/").length - a.split("/").length)
          .slice(0, 8);

        for (const u of articlePages) {
          const r = await scrapeOne(u, true, 0);
          if (r.ok && r.md) {
            markdown += `\n\n--- صفحة: ${u} ---\n${r.md}`;
            pagesScanned++;
          }
        }
      } catch (err) {
        console.warn("deep_crawl_failed", err);
      }
    }

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
          { role: "user", content: `المصدر: ${src.kind} — ${src.url}\nاستخرج كل العناصر المهمة من المحتوى التالي (قد يحوي عدة صفحات):\n\n${markdown.slice(0, 30000)}` },
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
      last_status: `synced:${pagesScanned}p`,
    }).eq("id", source_id);

    return new Response(JSON.stringify({ ok: true, insights_count: parsed.insights?.length || 0, pages_scanned: pagesScanned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});