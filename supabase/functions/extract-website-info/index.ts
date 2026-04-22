const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
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
        return h ? extract(h, su) : null;
      })
    );
    for (const r of subResults) if (r) mergeResults(data, r);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});