import { withRulesMode } from "../_shared/rule-mode.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

async function firecrawlSearch(query: string, limit = 5): Promise<Array<{ url: string; title?: string; description?: string }>> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit, lang: "ar", country: "sa" }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("firecrawl search failed", res.status, data);
      return [];
    }
    // v2 returns { data: { web: [...] } } or { data: [...] }
    const web = data?.data?.web ?? data?.data ?? [];
    return Array.isArray(web) ? web : [];
  } catch (e) {
    console.error("firecrawl search error", e);
    return [];
  }
}

async function findOrgNameFromWebsite(url: string): Promise<string | null> {
  const html = await fetchHtml(url, 8000);
  if (!html) return null;
  const ogSite = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  if (ogSite) return ogSite[1].trim();
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitle) return ogTitle[1].trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title[1].split(/[|\-–—•·]/)[0].trim();
  return null;
}

function normalizeArabicName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\s\-_/|،,:;()\[\]{}]+/g, "")
    .trim();
}

function sameRegistrableDomain(a: string, b: string): boolean {
  try {
    const hostA = new URL(a).hostname.replace(/^www\./, "").toLowerCase();
    const hostB = new URL(b).hostname.replace(/^www\./, "").toLowerCase();
    if (hostA === hostB) return true;
    return hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
  } catch {
    return false;
  }
}

async function storeCandidateMatchesOrg(candidateUrl: string, orgName: string, websiteUrl: string): Promise<boolean> {
  if (sameRegistrableDomain(candidateUrl, websiteUrl)) return true;
  const html = await fetchHtml(candidateUrl, 7000);
  if (!html) return false;

  const ogSite = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
  const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ?? null;
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null;

  const normalizedOrg = normalizeArabicName(orgName);
  const candidates = [ogSite, ogTitle, title]
    .map(normalizeArabicName)
    .filter(Boolean);

  return candidates.some((value) => value.includes(normalizedOrg) || normalizedOrg.includes(value));
}

function absolutize(href: string, base: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

async function fetchHtml(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function extract(html: string, baseUrl: string) {
  const result: Record<string, string | null> = {
    logo_url: null, primary_color: null, secondary_color: null, accent_color: null,
    twitter_url: null, instagram_url: null, tiktok_url: null, snapchat_url: null,
    youtube_url: null, facebook_url: null, linkedin_url: null, store_url: null,
    description: null,
  };

  // meta description
  const desc = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
  if (desc) result.description = desc[1];

  // theme-color
  const theme = html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i);
  if (theme) result.primary_color = theme[1];

  // logo: prefer og:image, then apple-touch-icon, then icon
  const og = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (og) result.logo_url = absolutize(og[1], baseUrl);
  if (!result.logo_url) {
    const apple = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
    if (apple) result.logo_url = absolutize(apple[1], baseUrl);
  }
  if (!result.logo_url) {
    const icon = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (icon) result.logo_url = absolutize(icon[1], baseUrl);
  }

  // Collect ALL hrefs and absolute URLs from the HTML for robust matching
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((m) => absolutize(m[1], baseUrl));
  const allUrls = Array.from(html.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map((m) => m[0]);
  const candidates = Array.from(new Set([...hrefs, ...allUrls]));

  // social link patterns — match against the candidate list (covers footer, JSON-LD, scripts)
  const linkPatterns: [keyof typeof result, RegExp][] = [
    ["twitter_url", /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/?$/i],
    ["instagram_url", /^https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?/i],
    ["tiktok_url", /^https?:\/\/(?:www\.)?tiktok\.com\/@?[A-Za-z0-9_.]+\/?/i],
    ["snapchat_url", /^https?:\/\/(?:www\.)?snapchat\.com\/(?:add|t|@)?\/?[A-Za-z0-9_.-]+/i],
    ["youtube_url", /^https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|user\/|c\/)?[A-Za-z0-9_-]+/i],
    ["facebook_url", /^https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\/[A-Za-z0-9_.-]+/i],
    ["linkedin_url", /^https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_-]+/i],
  ];
  for (const [key, pat] of linkPatterns) {
    const found = candidates.find((u) => pat.test(u));
    if (found) result[key] = found.split("?")[0];
  }

  // store: ehsan, tabby, donate, shop, store, متجر, تبرع
  const storePatterns = [
    /ehsan\.sa/i,
    /donate\./i,
    /\/donate/i,
    /\/shop/i,
    /\/store/i,
    /shop\./i,
    /store\./i,
    /متجر/i,
    /تبرع/i,
  ];
  const store = candidates.find((u) => storePatterns.some((p) => p.test(u)));
  if (store) result.store_url = store;

  // colors from inline styles / CSS vars
  const colorMatches = Array.from(html.matchAll(/#([0-9a-fA-F]{6})\b/g)).map((m) => `#${m[1]}`);
  const freq = new Map<string, number>();
  for (const c of colorMatches) {
    const lc = c.toLowerCase();
    if (["#ffffff", "#000000", "#fff", "#000"].includes(lc)) continue;
    freq.set(lc, (freq.get(lc) || 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  if (!result.primary_color && sorted[0]) result.primary_color = sorted[0];
  if (sorted[1]) result.secondary_color = sorted[1];
  if (sorted[2]) result.accent_color = sorted[2];

  return result;
}

function mergeResults(target: Record<string, string | null>, source: Record<string, string | null>) {
  for (const k of Object.keys(source)) {
    if (!target[k] && source[k]) target[k] = source[k];
  }
}

// ===== Documents / regulations discovery =====
export interface OrgDocument {
  url: string;
  title: string;
  type: string;
  source_page: string;
}

const DOC_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i;

const DOC_KEYWORDS = [
  "لائحة", "لوائح", "نظام", "الأنظمة", "سياسة", "سياسات", "دليل", "الميزانية",
  "التقرير", "تقرير", "تقارير", "محضر", "الجمعية العمومية", "حاكمية", "الحوكمة",
  "استراتيج", "خطة", "قائمة مالية", "القوائم المالية", "شهادة", "الترخيص",
  "policy", "policies", "regulation", "bylaw", "annual report", "report",
  "financial", "statement", "governance", "strategy", "guide", "manual", "charter",
];

function docTypeFromUrl(url: string): string {
  const m = url.match(DOC_EXT_RE);
  const ext = (m?.[1] || "").toLowerCase();
  if (ext.startsWith("pdf")) return "PDF";
  if (ext.startsWith("doc")) return "Word";
  if (ext.startsWith("xls")) return "Excel";
  if (ext.startsWith("ppt")) return "PowerPoint";
  return "ملف";
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
    return name.replace(DOC_EXT_RE, "").replace(/[-_+]+/g, " ").trim() || "مستند";
  } catch {
    return "مستند";
  }
}

/** Extract document links (PDF/Word/Excel/PowerPoint) plus their anchor text. */
function extractDocuments(html: string, baseUrl: string): OrgDocument[] {
  const out: OrgDocument[] = [];
  const seen = new Set<string>();

  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = absolutize(m[1], baseUrl);
    if (!DOC_EXT_RE.test(href)) continue;
    const key = href.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    const label = cleanText(m[2]).slice(0, 160);
    out.push({
      url: key,
      title: label || titleFromUrl(key),
      type: docTypeFromUrl(key),
      source_page: baseUrl,
    });
  }

  // Bare document URLs anywhere in the markup (scripts, JSON payloads, etc.)
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const url = m[0];
    if (!DOC_EXT_RE.test(url)) continue;
    const key = url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, title: titleFromUrl(key), type: docTypeFromUrl(key), source_page: baseUrl });
  }

  return out;
}

/** Pages likely to host regulations / reports, discovered from the home page links. */
function findDocumentPages(html: string, baseUrl: string): string[] {
  const pages = new Set<string>();
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let origin = "";
  try { origin = new URL(baseUrl).origin; } catch { /* ignore */ }
  for (const m of html.matchAll(anchorRe)) {
    const href = absolutize(m[1], baseUrl);
    if (origin && !href.startsWith(origin)) continue;
    const haystack = `${decodeURIComponent(href)} ${cleanText(m[2])}`.toLowerCase();
    if (DOC_KEYWORDS.some((k) => haystack.includes(k.toLowerCase()))) {
      pages.add(href.split("#")[0]);
    }
  }
  return [...pages].slice(0, 10);
}

Deno.serve(withRulesMode("extract-website-info", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mainHtml = await fetchHtml(url);
    if (!mainHtml) {
      return new Response(JSON.stringify({ error: "fetch_failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = extract(mainHtml, url);

    // Crawl additional likely pages to find footer/social/store links missing on home
    const subpaths = ["/contact", "/contact-us", "/about", "/about-us", "/footer", "/تواصل", "/عن", "/donate", "/تبرع"];
    const subUrls: string[] = [];
    try {
      const u = new URL(url);
      for (const p of subpaths) subUrls.push(new URL(p, u.origin).toString());
    } catch { /* ignore */ }

    const subResults = await Promise.all(
      subUrls.slice(0, 6).map(async (su) => {
        const h = await fetchHtml(su, 6000);
        return h ? { html: h, url: su, data: extract(h, su) } : null;
      })
    );
    for (const r of subResults) if (r) mergeResults(data, r.data);

    // ===== Documents / regulations / reports =====
    const documents: OrgDocument[] = [];
    const seenDocs = new Set<string>();
    const pushDocs = (list: OrgDocument[]) => {
      for (const d of list) {
        if (seenDocs.has(d.url)) continue;
        seenDocs.add(d.url);
        documents.push(d);
      }
    };
    try {
      pushDocs(extractDocuments(mainHtml, url));
      for (const r of subResults) if (r) pushDocs(extractDocuments(r.html, r.url));

      // Follow likely "regulations / reports / governance" pages, then common paths
      const candidatePages = new Set<string>(findDocumentPages(mainHtml, url));
      for (const r of subResults) if (r) for (const p of findDocumentPages(r.html, r.url)) candidatePages.add(p);
      try {
        const origin = new URL(url).origin;
        for (const p of ["/regulations", "/policies", "/reports", "/governance", "/documents", "/downloads", "/media-center", "/transparency"]) {
          candidatePages.add(new URL(p, origin).toString());
        }
      } catch { /* ignore */ }

      const pageList = [...candidatePages].filter((p) => !subUrls.includes(p)).slice(0, 12);
      const docPageResults = await Promise.all(
        pageList.map(async (p) => {
          const h = await fetchHtml(p, 6000);
          return h ? extractDocuments(h, p) : [];
        })
      );
      for (const list of docPageResults) pushDocs(list);
    } catch (e) {
      console.error("document discovery failed", e);
    }

    // ===== Use Firecrawl Search to find the correct STORE URL =====
    // Strategy: search Google for the org name, take the FIRST result as authoritative store/website.
    try {
      const orgName = await findOrgNameFromWebsite(url);
      if (orgName && FIRECRAWL_API_KEY) {
        // Search for the org's donation/store page directly
        const queries = [
          `${orgName} تبرع`,
          `${orgName} متجر`,
          orgName,
        ];
        let bestStore: string | null = null;
        const mainHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();

        for (const q of queries) {
          const results = await firecrawlSearch(q, 5);
          if (!results.length) continue;
          // Prefer first result that looks like a donate/store page on a known platform or same brand
          const storeHints = /(ehsan\.sa|tabby|donate|\/donate|\/shop|\/store|shop\.|store\.|متجر|تبرع|give\.|payment)/i;
          const picked = results.find((r) => r.url && storeHints.test(r.url))
            ?? results.find((r) => {
              try {
                const h = new URL(r.url).hostname.replace(/^www\./, "");
                return mainHost && (h === mainHost || h.endsWith("." + mainHost) || mainHost.endsWith("." + h));
              } catch { return false; }
            })
            ?? results[0];
          if (picked?.url) { bestStore = picked.url; break; }
        }

        if (bestStore) {
          const matchesOrg = await storeCandidateMatchesOrg(bestStore, orgName, url);
          if (matchesOrg) {
            // Only accept searched stores when they clearly belong to the same org/brand
            data.store_url = bestStore;
          } else {
            console.warn("Rejected store candidate due to org mismatch", { orgName, website: url, candidate: bestStore });
          }
        }
      }
    } catch (e) {
      console.error("firecrawl store-search step failed", e);
    }

    return new Response(JSON.stringify({ success: true, data, documents: documents.slice(0, 60) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
