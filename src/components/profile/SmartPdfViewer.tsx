import { forwardRef } from "react";

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
export const SmartPdfViewer = forwardRef<HTMLDivElement, SmartPdfViewerProps>(function SmartPdfViewer(
  { fileUrl, blobUrl, fileName, className },
  ref,
) {
  // عرض الملف مباشرة يحافظ على رمز الوصول في الرابط الموقّع، بعكس العارض الخارجي
  // الذي قد يعجز عن تنزيل الملفات الخاصة من التخزين.
  const viewerUrl = blobUrl || fileUrl;

  return (
    <div ref={ref} className={className || "w-full h-[65vh]"}>
      <div className="h-full overflow-hidden rounded-lg border border-border bg-background">
        <iframe
          title={fileName || "PDF Viewer"}
          src={viewerUrl}
          className="w-full h-full border-0 bg-muted/20"
          loading="eager"
          allowFullScreen
        />
      </div>
    </div>
  );
});

