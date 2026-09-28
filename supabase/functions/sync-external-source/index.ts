const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { authorizationErrorResponse, requireOrganizationAccess } from "../_shared/authz.ts";

const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY")!;
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
    await requireOrganizationAccess(req, src.organization_id, supa);

    // Some rows were stored as a bare handle (e.g. "TADABUR_KSA") which is not a
    // fetchable address. Rebuild a real URL from the platform kind, and persist it
    // so later syncs (and the UI) use the corrected value.
    const HANDLE_BASE: Record<string, string> = {
      twitter: "https://x.com/",
      instagram: "https://www.instagram.com/",
      tiktok: "https://www.tiktok.com/@",
      youtube: "https://www.youtube.com/@",
      snapchat: "https://www.snapchat.com/add/",
      facebook: "https://www.facebook.com/",
      linkedin: "https://www.linkedin.com/company/",
    };
    let normalizedUrl = String(src.url || "").trim().replace(/^(https?):\/(?!\/)/i, "$1://");
    const isAbsolute = /^https?:\/\//i.test(normalizedUrl);
    if (!isAbsolute) {
      const handleLike = normalizedUrl && !normalizedUrl.includes("/") && !normalizedUrl.includes(".");
      if (handleLike && HANDLE_BASE[src.kind]) {
        normalizedUrl = `${HANDLE_BASE[src.kind]}${normalizedUrl.replace(/^@+/, "")}`;
      } else if (normalizedUrl) {
        normalizedUrl = `https://${normalizedUrl.replace(/^\/+/, "")}`;
      }
    }
    let validUrl = false;
    try {
      const u = new URL(normalizedUrl);
      validUrl = u.hostname.includes(".");
    } catch { validUrl = false; }
    if (!validUrl) {
      await supa.from("org_external_sources").update({
        last_status: "invalid_url",
        last_synced_at: new Date().toISOString(),
      }).eq("id", source_id);
      return new Response(JSON.stringify({
        ok: false, skipped: true, reason: "invalid_url",
        message: "الرابط المحفوظ غير صحيح. عدّل المصدر واكتب رابطاً كاملاً أو اسم الحساب فقط.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (normalizedUrl !== src.url) {
      await supa.from("org_external_sources").update({ url: normalizedUrl }).eq("id", source_id);
      src.url = normalizedUrl;
    }


    // Scrape any public URL (website / store OR public social profile/page).
    // Social platforms (twitter/instagram/facebook/linkedin/youtube/tiktok) render dynamically,
    // so we wait briefly for hydration before extraction.
    const isSocial = src.kind !== "website" && src.kind !== "store";
    let markdown = "";
    let summary = "";
    let pagesScanned = 1;

    // Fallback reader for sites Firecrawl refuses (Instagram/Facebook/TikTok/Snapchat…)
    // r.jina.ai renders the page server-side and returns plain text/markdown. No key needed.
    const readerFallback = async (u: string): Promise<string> => {
      const targets = [
        `https://r.jina.ai/${u}`,
        u,
      ];
      for (const t of targets) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20000);
          const r = await fetch(t, {
            signal: ctrl.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
              "Accept-Language": "ar,en;q=0.8",
              Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
            },
          });
          clearTimeout(timer);
          if (!r.ok) continue;
          const body = await r.text();
          const text = body
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (text.length > 300) return text.slice(0, 20000);
        } catch (_e) {
          // try next strategy
        }
      }
      return "";
    };

    // Helper: scrape a single URL via Firecrawl, retrying on rate limits (429) / 5xx
    const scrapeOne = async (u: string, mainOnly: boolean, wait: number) => {
      let last = { ok: false, status: 0, md: "", sum: "", raw: {} as any };
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: u, formats: ["markdown", "summary"], onlyMainContent: mainOnly, waitFor: wait }),
        });
        const j = await r.json().catch(() => ({}));
        last = { ok: r.ok, status: r.status, md: j?.markdown || j?.data?.markdown || "", sum: j?.summary || j?.data?.summary || "", raw: j };
        if (r.ok) return last;
        if (r.status !== 429 && r.status < 500) return last;
        const retryAfter = Number(r.headers.get("retry-after") || 0);
        const waitMs = Math.min(15000, (retryAfter > 0 ? retryAfter * 1000 : 2500 * (attempt + 1)));
        await new Promise((res) => setTimeout(res, waitMs));
      }
      return last;
    };

    // Step 1: scrape the homepage (or social page)
    let usedFallback = false;
    const home = FIRECRAWL_API_KEY
      ? await scrapeOne(src.url, !isSocial, isSocial ? 3500 : 0)
      : { ok: false, status: 0, md: "", sum: "", raw: {} as any };
    if (home.ok && home.md) {
      markdown = home.md;
      summary = home.sum;
    } else {
      // Firecrawl refused (unsupported site), rate-limited, or returned nothing:
      // read the public page directly through the reader fallback.
      let text = await readerFallback(src.url);

      // Platforms with hard login walls (Instagram/Facebook/TikTok): gather public
      // information about the account from web search results instead.
      if (!text && FIRECRAWL_API_KEY) {
        try {
          const handle = decodeURIComponent(new URL(src.url).pathname).replace(/^\/+|\/+$/g, "").replace(/^@/, "");
          const q = `${handle} ${src.kind} ${src.url}`;
          const r = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, limit: 8 }),
          });
          const j = await r.json().catch(() => ({}));
          const items: any[] = j?.data?.web || j?.data || j?.results || [];
          const joined = (Array.isArray(items) ? items : [])
            .map((it) => [it?.title, it?.url, it?.description || it?.snippet].filter(Boolean).join(" — "))
            .filter(Boolean)
            .join("\n");
          if (joined.length > 150) text = `نتائج بحث عامة عن الحساب ${src.url}:\n${joined}`;
        } catch (_e) {
          // ignore, handled below
        }
      }

      if (!text) {
        const detailMsg = String(home.raw?.error || "");
        const unsupported = /do not support this site/i.test(detailMsg);
        const rateLimited = home.status === 429;
        const statusLabel = unsupported ? "blocked_by_platform" : `fetch_failed:${home.status}`;
        await supa.from("org_external_sources").update({
          last_status: statusLabel,
          last_synced_at: new Date().toISOString(),
        }).eq("id", source_id);
        return new Response(JSON.stringify({
          ok: false,
          skipped: true,
          reason: unsupported ? "blocked_by_platform" : rateLimited ? "rate_limited" : "fetch_failed",
          message: unsupported
            ? "المنصة تمنع القراءة الآلية لهذه الصفحة (حساب خاص أو حماية). جرّب رابط الحساب العام."
            : rateLimited
              ? "تم تجاوز حد المسح المسموح مؤقتاً. انتظر دقيقة ثم أعد المحاولة."
              : "تعذّر جلب المحتوى من هذا المصدر حالياً.",
          details: home.raw,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      markdown = text;
      summary = text.slice(0, 800);
      usedFallback = true;
    }

    // Step 2: for websites, deep-crawl the news section.
    // Use src.news_path if provided, else auto-detect common Arabic/English news paths.
    if (!isSocial && FIRECRAWL_API_KEY && !usedFallback) {
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
    const aiResp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
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
      last_status: usedFallback ? `synced:${pagesScanned}p:fallback` : `synced:${pagesScanned}p`,
    }).eq("id", source_id);

    return new Response(JSON.stringify({ ok: true, insights_count: parsed.insights?.length || 0, pages_scanned: pagesScanned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});