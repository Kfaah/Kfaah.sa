import { ExternalLink } from "lucide-react";

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  // Fix common malformations: "https:/foo" -> "https://foo", "http:/foo" -> "http://foo"
  const fixedScheme = trimmed.replace(/^(https?):\/(?!\/)/i, "$1://");
  // If still no scheme, prepend https://
  if (!/^https?:\/\//i.test(fixedScheme)) {
    return `https://${fixedScheme.replace(/^\/+/, "")}`;
  }
  return fixedScheme;
}

export function SourceLink({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url)
    return (
      <div
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/50 px-3 py-2 text-muted-foreground"
        dir="rtl"
      >
        <span className="font-medium text-right leading-6">{label}</span>
        <span className="min-w-8 text-left text-xs leading-6">— غير مضاف</span>
      </div>
    );
  const safeUrl = normalizeUrl(url);
  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noreferrer"
      className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/50 px-3 py-2 transition-colors hover:border-primary/40 hover:text-primary"
      dir="rtl"
    >
      <span className="font-medium text-right leading-6">{label}</span>
      <span className="flex h-6 w-6 items-center justify-center justify-self-start">
        <ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
      </span>
    </a>
  );
}

export default SourceLink;