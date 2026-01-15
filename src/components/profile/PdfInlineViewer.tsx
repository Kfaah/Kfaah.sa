import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Minus, Plus } from "lucide-react";

interface PdfInlineViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
}

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
  destroy?: () => void;
};

export function PdfInlineViewer({ fileUrl, blobUrl, fileName }: PdfInlineViewerProps) {
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);

  const pdfRef = useRef<PdfDocument | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  const src = useMemo(() => blobUrl || fileUrl, [blobUrl, fileUrl]);

  const downloadBlob = async () => {
    try {
      const res = await fetch(fileUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`http_${res.status}`);
      const b = await res.blob();
      const url = URL.createObjectURL(b);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName?.trim() ? fileName.trim() : "file.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // ignore; caller shows fallback
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Vite + TS: import the actual .mjs file.
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

        // Bundle-local worker (no CORS, no popup).
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const task = pdfjs.getDocument(src);
        const doc = (await task.promise) as PdfDocument;

        if (cancelled) {
          doc?.destroy?.();
          return;
        }

        pdfRef.current = doc;
        setPageCount(doc.numPages);
      } catch {
        if (!cancelled) {
          setError("تعذر عرض ملف PDF داخل الصفحة على هذا المتصفح.");
          setPageCount(0);
          pdfRef.current = null;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      try {
        pdfRef.current?.destroy?.();
      } catch {
        // ignore
      }
      pdfRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const doc = pdfRef.current;
    if (!doc || !pageCount) return;

    let cancelled = false;

    const render = async () => {
      setRendering(true);
      try {
        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale });

          const canvas = canvasRefs.current[i - 1];
          if (!canvas) continue;

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch {
        if (!cancelled) setError("تعذر رسم صفحات PDF.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [pageCount, scale]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)))}
            disabled={loading || rendering}
            aria-label="تصغير"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setScale((s) => Math.min(2.4, +(s + 0.2).toFixed(1)))}
            disabled={loading || rendering}
            aria-label="تكبير"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
        </div>

        <Button variant="outline" type="button" onClick={downloadBlob} className="gap-2">
          <Download className="w-4 h-4" />
          تحميل
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[65vh] text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-[65vh] gap-3 text-muted-foreground text-center border border-border rounded-lg bg-background">
          <p>{error}</p>
          <Button type="button" onClick={downloadBlob} className="gap-2">
            <Download className="w-4 h-4" />
            تحميل الملف
          </Button>
        </div>
      ) : (
        <div className="h-[65vh] overflow-auto rounded-lg border border-border bg-background p-3">
          <div className="space-y-4">
            {Array.from({ length: pageCount }).map((_, idx) => (
              <div key={idx} className="w-full flex justify-center">
                <canvas
                  ref={(el) => {
                    canvasRefs.current[idx] = el;
                  }}
                  className="max-w-full rounded-md shadow-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
