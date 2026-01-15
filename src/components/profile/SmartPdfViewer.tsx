import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download } from "lucide-react";

interface SmartPdfViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
  className?: string;
}

/**
 * عارض PDF احترافي باستخدام Google Docs Viewer
 * - يعرض أي PDF بشكل صحيح (عربي/إنجليزي)
 * - سريع جداً
 * - لا يحتاج مكتبات إضافية
 */
export function SmartPdfViewer({
  fileUrl,
  blobUrl,
  fileName,
  className,
}: SmartPdfViewerProps) {
  // نستخدم الرابط الأصلي (ليس blob) لأن Google Docs يحتاج رابط عام
  const publicUrl = fileUrl;

  // Google Docs Viewer - أفضل طريقة لعرض PDF بشكل صحيح
  const googleViewerUrl = useMemo(
    () =>
      `https://docs.google.com/viewer?url=${encodeURIComponent(publicUrl)}&embedded=true`,
    [publicUrl]
  );

  const [mode, setMode] = useState<"google" | "native">("google");

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
              variant={mode === "google" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("google")}
            >
              عرض احترافي
            </Button>
            <Button
              variant={mode === "native" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("native")}
            >
              عرض المتصفح
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={publicUrl}
                download={fileName || "document.pdf"}
                className="inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                تحميل
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={publicUrl}
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

        <div className="relative flex-1 bg-muted/20">
          {mode === "google" ? (
            <iframe
              title={fileName || "PDF Viewer"}
              src={googleViewerUrl}
              className="w-full h-full border-0"
              loading="eager"
              allowFullScreen
            />
          ) : (
            <iframe
              title={fileName || "PDF Viewer"}
              src={publicUrl}
              className="w-full h-full border-0"
              loading="eager"
            />
          )}
        </div>
      </div>
    </div>
  );
}

