import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Copy, Sparkles } from "lucide-react";
import { PdfJsViewer } from "./PdfJsViewer";

interface SmartPdfViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
  className?: string;
}

type Mode = "native" | "pdfjs" | "ocr";

export function SmartPdfViewer({
  fileUrl,
  blobUrl,
  fileName,
  className,
}: SmartPdfViewerProps) {
  const src = useMemo(() => blobUrl || fileUrl, [blobUrl, fileUrl]);

  const [mode, setMode] = useState<Mode>("native");
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const ocrCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setIframeLoaded(false);
    setIframeTimedOut(false);

    if (mode !== "native") return;

    const t = window.setTimeout(() => setIframeTimedOut(true), 2500);
    return () => window.clearTimeout(t);
  }, [src, mode]);

  useEffect(() => {
    if (mode !== "ocr") return;

    const cached = ocrCacheRef.current.get(src);
    if (cached) {
      setOcrText(cached);
      setOcrError(null);
      setOcrLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setOcrLoading(true);
      setOcrError(null);
      setOcrText("");

      try {
        const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdfjsVersion = pdfjs.version || "5.4.530";
        const assetsBase = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}`;

        const task = pdfjs.getDocument({
          url: src,
          cMapUrl: `${assetsBase}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assetsBase}/standard_fonts/`,
          useSystemFonts: true,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: false,
        });

        const doc = await task.promise;
        const page = await doc.getPage(1);

        const viewport1 = page.getViewport({ scale: 1 });
        const maxWidth = 1400;
        const scale = Math.max(1, Math.min(2, maxWidth / viewport1.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas_context_failed");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        try {
          await doc?.destroy?.();
        } catch {
          // ignore
        }

        const { data, error } = await supabase.functions.invoke(
          "ocr-document-text",
          {
            body: { imageDataUrl, fileName: fileName || "PDF" },
          }
        );

        if (error) throw error;

        const text = String(data?.text || "").trim();
        if (!text) throw new Error("empty_ocr");

        if (cancelled) return;
        ocrCacheRef.current.set(src, text);
        setOcrText(text);
      } catch (e: any) {
        if (cancelled) return;
        setOcrError(
          "تعذر استخراج النص الذكي لهذه الصفحة. جرّب وضع سريع أو افتح الملف في نافذة جديدة."
        );
      } finally {
        if (!cancelled) setOcrLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [mode, src, fileName]);

  const copyOcr = async () => {
    try {
      await navigator.clipboard.writeText(ocrText);
    } catch {
      // ignore
    }
  };

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
            <Button
              variant={mode === "ocr" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("ocr")}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              نص ذكي
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
                      إذا استمر التأخير، اختر <span className="font-medium">نص ذكي</span>.
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
          ) : mode === "pdfjs" ? (
            <PdfJsViewer
              fileUrl={fileUrl}
              blobUrl={blobUrl}
              fileName={fileName}
              className="w-full h-full"
            />
          ) : (
            <div className="h-full overflow-auto p-4">
              {ocrLoading ? (
                <div className="flex items-center justify-center min-h-[55vh] text-muted-foreground gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">جاري استخراج النص بالذكاء…</span>
                </div>
              ) : ocrError ? (
                <div className="flex flex-col items-center justify-center min-h-[55vh] text-muted-foreground text-center gap-3">
                  <p className="text-sm">{ocrError}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      هذا النص مُستخرج بالذكاء (قد يختلف قليلاً عن التنسيق).
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={copyOcr}
                      disabled={!ocrText}
                    >
                      <Copy className="w-4 h-4" />
                      نسخ
                    </Button>
                  </div>
                  <Textarea
                    value={ocrText}
                    readOnly
                    dir="rtl"
                    className="min-h-[52vh] resize-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

