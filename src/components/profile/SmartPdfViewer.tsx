import { useMemo } from "react";

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
      <div className="h-full overflow-hidden rounded-lg border border-border bg-background">
        <iframe
          title={fileName || "PDF Viewer"}
          src={googleViewerUrl}
          className="w-full h-full border-0 bg-muted/20"
          loading="eager"
          allowFullScreen
        />
      </div>
    </div>
  );
}

