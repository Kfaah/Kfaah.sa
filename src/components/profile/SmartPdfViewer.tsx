import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { PdfJsViewer } from "./PdfJsViewer";

interface SmartPdfViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
  className?: string;
}

export function SmartPdfViewer({
  fileUrl,
  blobUrl,
  fileName,
  className,
}: SmartPdfViewerProps) {
  const src = useMemo(() => blobUrl || fileUrl, [blobUrl, fileUrl]);

  const [mode, setMode] = useState<"native" | "pdfjs">("native");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);

  useEffect(() => {
    setIframeLoaded(false);
    setIframeTimedOut(false);

    if (mode !== "native") return;

    const t = window.setTimeout(() => setIframeTimedOut(true), 2500);
    return () => window.clearTimeout(t);
  }, [src, mode]);

  return (
    <div className={className || "w-full h-[65vh]"}>
      <div className="h-full overflow-hidden rounded-lg border border-border bg-background flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {fileName || "PDF"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={mode === "native" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("native")}
            >
              سريع
            </Button>
            <Button
              variant={mode === "pdfjs" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("pdfjs")}
            >
              داخلي
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                فتح
              </a>
            </Button>
          </div>
        </div>

        <div className="relative flex-1">
          {mode === "native" ? (
            <>
              {!iframeLoaded ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/60">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <p className="text-sm">جاري عرض ملف الـ PDF…</p>
                  {iframeTimedOut ? (
                    <div className="text-xs text-muted-foreground text-center px-6">
                      إذا استمر التأخير، اختر <span className="font-medium">داخلي</span>.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <iframe
                title={fileName || "PDF Viewer"}
                src={src}
                className="w-full h-full"
                onLoad={() => setIframeLoaded(true)}
              />
            </>
          ) : (
            <PdfJsViewer
              fileUrl={fileUrl}
              blobUrl={blobUrl}
              fileName={fileName}
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

