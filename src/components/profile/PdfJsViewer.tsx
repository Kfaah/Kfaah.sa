import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  destroy?: () => void;
};

interface PdfJsViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
  className?: string;
}

export function PdfJsViewer({ fileUrl, blobUrl, className }: PdfJsViewerProps) {
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  const docRef = useRef<PdfDocumentProxy | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const src = useMemo(() => blobUrl || fileUrl, [blobUrl, fileUrl]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPageCount(0);

        let loadingTask: any | null = null;

        try {
          const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");

          // Use bundled worker (no external URLs, no CORS).
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();

          const pdfjsVersion = pdfjs.version || "5.4.530";
          const assetsBase = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}`;

          // استخدم التحميل عبر URL (Streaming/Range) لتسريع العرض وتجنب تحميل الملف كاملاً مرة واحدة.
          loadingTask = pdfjs.getDocument({
            url: src,
            cMapUrl: `${assetsBase}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${assetsBase}/standard_fonts/`,
            disableRange: false,
            disableStream: false,
            disableAutoFetch: false,
          });

          const doc = (await loadingTask.promise) as PdfDocumentProxy;

          if (cancelled) {
            try {
              loadingTask?.destroy?.();
            } catch {
              // ignore
            }
            doc?.destroy?.();
            return;
          }

          docRef.current = doc;
          setPageCount(doc.numPages);
        } catch (e) {
          if (!cancelled) {
            setError("تعذر عرض ملف PDF داخلياً. جرّب وضع سريع أو افتحه في نافذة جديدة.");
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
    };

    load();

    return () => {
      cancelled = true;
      try {
        docRef.current?.destroy?.();
      } catch {
        // ignore
      }
      docRef.current = null;
      canvasRefs.current = [];
    };
  }, [src]);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc || !pageCount) return;

    let cancelled = false;

    const render = async () => {
      setRendering(true);
      try {
        // Render pages sequentially to avoid memory spikes.
        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);

          // Auto-scale to container width (measured) مع حد أعلى أقل لتسريع الرسم.
          const viewport1 = page.getViewport({ scale: 1 });
          const containerWidth = Math.max(
            320,
            (containerRef.current?.clientWidth ?? 900) - 24
          );
          const scale = Math.max(0.6, Math.min(1.35, containerWidth / viewport1.width));
          const viewport = page.getViewport({ scale });

          const canvas = canvasRefs.current[i - 1];
          if (!canvas) continue;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvasContext: ctx, viewport }).promise;
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      } catch {
        if (!cancelled) setError("فشل عرض صفحات PDF.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [pageCount]);

  if (loading) {
    return (
      <div className={className || "w-full h-[65vh]"}>
        <div className="flex items-center justify-center h-full text-muted-foreground border border-border rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className || "w-full h-[65vh]"}>
        <div className="flex items-center justify-center h-full text-muted-foreground text-center border border-border rounded-lg p-6">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className || "w-full h-[65vh]"}>
      <div
        ref={containerRef}
        className="h-full overflow-auto rounded-lg border border-border bg-background p-3"
      >
        <div className="space-y-4">
          {Array.from({ length: pageCount }).map((_, idx) => (
            <div key={idx} className="w-full flex justify-center">
              <canvas
                ref={(el) => {
                  canvasRefs.current[idx] = el;
                }}
                className="max-w-full h-auto rounded-md"
              />
            </div>
          ))}
        </div>
        {rendering ? (
          <div className="mt-3 flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            جاري تجهيز الصفحات...
          </div>
        ) : null}
      </div>
    </div>
  );
}
