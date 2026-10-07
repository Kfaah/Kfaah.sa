import { withRulesMode } from "../_shared/rule-mode.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Platform = {
  kind: string;
  field: string;
  domains: string[];
  query: (name: string) => string;
  urlPattern: RegExp;
};

const PLATFORMS: Platform[] = [
  { kind: "twitter",   field: "twitter_url",   domains: ["twitter.com","x.com"], query: (n) => `site:x.com OR site:twitter.com "${n}"`,           urlPattern: /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/?$/i },
  { kind: "instagram", field: "instagram_url", domains: ["instagram.com"],       query: (n) => `site:instagram.com "${n}"`,                       urlPattern: /^https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/i },
  { kind: "tiktok",    field: "tiktok_url",    domains: ["tiktok.com"],          query: (n) => `site:tiktok.com "${n}"`,                          urlPattern: /^https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/?$/i },
  { kind: "snapchat",  field: "snapchat_url",  domains: ["snapchat.com"],        query: (n) => `site:snapchat.com "${n}"`,                        urlPattern: /^https?:\/\/(?:www\.)?snapchat\.com\/(?:add|t|@)\/?[A-Za-z0-9_.-]+/i },
  { kind: "youtube",   field: "youtube_url",   domains: ["youtube.com"],         query: (n) => `site:youtube.com "${n}"`,                         urlPattern: /^https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|user\/|c\/)[A-Za-z0-9_\-.]+/i },
  { kind: "facebook",  field: "facebook_url",  domains: ["facebook.com","fb.com"], query: (n) => `site:facebook.com "${n}"`,                      urlPattern: /^https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/[A-Za-z0-9_.\-]+\/?$/i },
  { kind: "linkedin",  field: "linkedin_url",  domains: ["linkedin.com"],        query: (n) => `site:linkedin.com/company "${n}"`,                urlPattern: /^https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[A-Za-z0-9_\-]+\/?$/i },
];

function normalizeArabic(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\s\-_/|،,:;()\[\]{}«»"']+/g, "")
    .trim();
}

function tokensOf(s: string): string[] {
  return (s ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .split(/[\s\-_/|،,:;()\[\]{}«»"']+/)
    .filter((t) => t.length >= 3);
}

async function firecrawlSearch(query: string, limit = 8): Promise<Array<{ url: string; title?: string; description?: string }>> {
  const r = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, lang: "ar", country: "sa" }),
  });
  const j = await r.json().catch(() => ({}));
  const web = j?.data?.web ?? j?.data ?? [];
  return Array.isArray(web) ? web : [];
}

async function firecrawlScrape(url: string, wait = 3000): Promise<{ md: string; html: string; meta: any } | null> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "html"], onlyMainContent: false, waitFor: wait }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      md: j?.markdown || j?.data?.markdown || "",
      html: j?.html || j?.data?.html || "",
      meta: j?.metadata || j?.data?.metadata || {},
    };
  } catch { return null; }
}

function cleanProfileUrl(u: string, kind: string): string | null {
  try {
    const url = new URL(u);
    url.search = ""; url.hash = "";
    let path = url.pathname.replace(/\/+$/, "");
    // strip post/status/video sub-paths to keep root profile
    if (kind === "twitter") path = path.split("/").slice(0, 2).join("/");
    if (kind === "instagram") path = path.split("/").slice(0, 2).join("/");
    if (kind === "facebook") path = path.split("/").slice(0, 2).join("/");
    if (kind === "linkedin") {
      const parts = path.split("/"); // ["", "company", "slug", ...]
      if (parts[1] === "company" || parts[1] === "school") path = "/" + parts[1] + "/" + (parts[2] || "");
      else return null;
    }
    if (kind === "youtube") {
      const parts = path.split("/");
      if (parts[1]?.startsWith("@")) path = "/" + parts[1];
      else if (["channel","user","c"].includes(parts[1])) path = "/" + parts[1] + "/" + (parts[2] || "");
      else return null;
    }
    if (kind === "tiktok") {
      const parts = path.split("/");
      if (!parts[1]?.startsWith("@")) return null;
      path = "/" + parts[1];
    }
    return `${url.protocol}//${url.hostname}${path}`;
  } catch { return null; }
}

function isExcludedHandle(u: string): boolean {
  const bad = /\/(home|explore|search|login|signup|about|help|tos|privacy|safety|i|hashtag|share|intent)(\/|$)/i;
  return bad.test(u);
}

async function scoreCandidate(url: string, orgName: string, websiteHost: string | null): Promise<number> {
  const scraped = await firecrawlScrape(url, 3000);
  if (!scraped) return 0;
  const blob = `${scraped.meta?.title || ""}\n${scraped.meta?.description || ""}\n${scraped.md.slice(0, 4000)}\n${scraped.html.slice(0, 8000)}`;
  const blobNorm = normalizeArabic(blob);
  const orgNorm = normalizeArabic(orgName);
  let score = 0;
  if (orgNorm && blobNorm.includes(orgNorm)) score += 4;
  const toks = tokensOf(orgName);
  const matched = toks.filter((t) => blobNorm.includes(normalizeArabic(t))).length;
  score += Math.min(matched, 3);
  if (websiteHost) {
    const re = new RegExp(websiteHost.replace(/\./g, "\\."), "i");
    if (re.test(blob)) score += 5; // strong signal: profile links back to org website
  }
  // verified-ish badges in html
  if (/verified|موثّق|موثق/i.test(blob)) score += 1;
  return score;
}

Deno.serve(withRulesMode("discover-org-accounts", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!FIRECRAWL_API_KEY) {
      return new Response(JSON.stringify({ error: "firecrawl_not_configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { organization_id, overwrite = false } = await req.json();
    if (!organization_id) return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: org } = await supa.from("organizations").select("id,name").eq("id", organization_id).single();
    if (!org) return new Response(JSON.stringify({ error: "org_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: prof } = await supa.from("organization_profiles").select("*").eq("organization_id", organization_id).maybeSingle();

    const orgName: string = org.name;
    const websiteUrl: string = (prof?.website_url || "").trim();
    let websiteHost: string | null = null;
    try { if (websiteUrl) websiteHost = new URL(websiteUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

    const discovered: Record<string, { url: string; score: number }> = {};
    const debug: any[] = [];

    // Step 1: if website exists, scrape it to harvest social links from footer/JSON-LD
    if (websiteUrl) {
      const home = await firecrawlScrape(websiteUrl, 1500);
      if (home) {
        const text = `${home.html}\n${home.md}`;
        for (const p of PLATFORMS) {
          const re = new RegExp(`https?://(?:www\\.)?(?:${p.domains.map((d) => d.replace(/\./g, "\\.")).join("|")})/[A-Za-z0-9_@./-]+`, "gi");
          const found = text.match(re) || [];
          for (const raw of found) {
            if (isExcludedHandle(raw)) continue;
            const cleaned = cleanProfileUrl(raw, p.kind);
            if (!cleaned || !p.urlPattern.test(cleaned)) continue;
            // Trust website-listed accounts strongly
            if (!discovered[p.kind] || discovered[p.kind].score < 10) {
              discovered[p.kind] = { url: cleaned, score: 10 };
            }
            break;
          }
        }
        debug.push({ step: "website_harvest", found: Object.keys(discovered) });
      }
    }

    // Step 2 disabled by policy: accounts come ONLY from the org's own website.
    // Anything not found on the website must be added manually.

    // Step 3: write to organization_profiles (only fill empty unless overwrite)
    const updates: Record<string, string> = {};
    for (const p of PLATFORMS) {
      const found = discovered[p.kind];
      if (!found) continue;
      const current = (prof?.[p.field] as string | null | undefined) || "";
      if (!current || overwrite) updates[p.field] = found.url;
    }
    if (Object.keys(updates).length > 0) {
      await supa.from("organization_profiles").upsert(
        { organization_id, ...updates },
        { onConflict: "organization_id" },
      );
    }

    // Step 4: register sources for sync (idempotent)
    const allTargets: { kind: string; url: string; label: string }[] = [];
    if (websiteUrl) allTargets.push({ kind: "website", url: websiteUrl, label: "الموقع الإلكتروني" });
    if (prof?.store_url) allTargets.push({ kind: "store", url: prof.store_url, label: "المتجر / صفحة التبرع" });
    for (const p of PLATFORMS) {
      const url = updates[p.field] || (prof?.[p.field] as string | null | undefined) || discovered[p.kind]?.url;
      if (url) allTargets.push({ kind: p.kind, url, label: p.kind });
    }
    const { data: existing } = await supa.from("org_external_sources").select("id,kind,url").eq("organization_id", organization_id);
    const have = new Set((existing || []).map((s: any) => `${s.kind}|${s.url}`));
    const toInsert = allTargets.filter((t) => !have.has(`${t.kind}|${t.url}`));
    if (toInsert.length) {
      await supa.from("org_external_sources").insert(toInsert.map((t) => ({ organization_id, kind: t.kind, url: t.url, label: t.label })));
    }

    return new Response(JSON.stringify({
      ok: true,
      org_name: orgName,
      discovered,
      written_fields: Object.keys(updates),
      registered_sources: toInsert.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("discover-org-accounts failed", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
