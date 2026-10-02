// Parse in an inert template and render only text through React. Email markup,
// images, scripts and tracking pixels are never attached to the page.
export function readableEmail(body: string | null | undefined): { text: string; quoted: string } {
  const raw = body || "";
  if (!/<(?:!doctype|html|head|body|div|p|br|table|tr|td|span|blockquote|a|img)\b/i.test(raw)) {
    return { text: raw.trim(), quoted: "" };
  }
  const template = document.createElement("template");
  template.innerHTML = raw;
  const fragment = template.content;
  fragment.querySelectorAll("script,style,head,title,meta,link,iframe,object,embed,img,svg,form,input,button").forEach(el => el.remove());
  fragment.querySelectorAll('[hidden],[aria-hidden="true"],[style]').forEach(el => {
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)/i.test(el.getAttribute("style") || "")) el.remove();
  });
  const textOf = (root: Node): string => {
    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
      const name = node.nodeName.toLowerCase();
      if (name === "br") return "\n";
      const content = Array.from(node.childNodes).map(walk).join("");
      if (/^(div|p|table|tr|blockquote|h[1-6]|ul|ol|li|section|article|hr)$/.test(name)) return "\n" + content + "\n";
      if (/^(td|th)$/.test(name)) return content + "  ";
      return content;
    };
    return walk(root).replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  const quoted: string[] = [];
  fragment.querySelectorAll(".gmail_quote,.yahoo_quoted,blockquote").forEach(el => {
    if (!fragment.contains(el)) return;
    quoted.push(textOf(el)); el.remove();
  });
  return { text: textOf(fragment), quoted: quoted.filter(Boolean).join("\n\n") };
}

export function emailPreview(body: string | null | undefined): string {
  const value = readableEmail(body);
  return value.text || value.quoted;
}
