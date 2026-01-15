import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface SmartPdfViewerProps {
  fileUrl: string;
  blobUrl?: string | null;
  fileName?: string;
  className?: string;
}

/**
 * عارض PDF احترافي باستخدام Google Docs Viewer
 * - يعرض أي PDF بشكل صحيح (عربي/إنجليزي)
 * - سريع وبسيط
 */
export function SmartPdfViewer({
  fileUrl,
  fileName,
  className,
}: SmartPdfViewerProps) {
  // Google Docs Viewer - أفضل طريقة لعرض PDF بشكل صحيح
  const googleViewerUrl = useMemo(
    () =>
      `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    [fileUrl]
  );

  return (
    <div className={className || "w-full h-[65vh]"}>
      <div className="h-full overflow-hidden rounded-lg border border-border bg-background flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {fileName || "PDF"}
          </p>

          <Button variant="outline" size="sm" asChild>
            <a
              href={fileUrl}
              download={fileName || "document.pdf"}
              className="inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تحميل
            </a>
          </Button>
        </div>

        <iframe
          title={fileName || "PDF Viewer"}
          src={googleViewerUrl}
          className="flex-1 w-full border-0 bg-muted/20"
          loading="eager"
          allowFullScreen
        />
      </div>
    </div>
  );
}

