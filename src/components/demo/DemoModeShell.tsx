import { useEffect } from "react";
import { Eye, Lock } from "lucide-react";
import { useIsDemo } from "@/hooks/useIsDemo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Wraps the app when the visitor is in demo mode:
 *  - Shows a fixed top banner identifying the demo session
 *  - Renders a tiled diagonal "DEMO" watermark over the page
 *  - Disables right-click, copy, cut, and the most common dev shortcuts
 *  - Injects global CSS that hides any element marked as a write action
 *    (data-demo-hide, .demo-hide) so create/edit/delete buttons disappear
 *    even in third-party-styled menus.
 */
export function DemoModeShell({ children }: { children: React.ReactNode }) {
  const { isDemo } = useIsDemo();

  useEffect(() => {
    if (!isDemo) return;

    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const blockKeys = (e: KeyboardEvent) => {
      // Block copy/cut/save/print and dev tools shortcuts
      const k = e.key.toLowerCase();
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "x", "s", "p", "u"].includes(k)
      ) {
        e.preventDefault();
        return false;
      }
      // F12 / Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))
      ) {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", blockKeys);

    document.body.classList.add("demo-mode");

    // Patch supabase.storage to block any upload/remove/move/copy operation
    const originalFrom = supabase.storage.from.bind(supabase.storage);
    const denied = async () => {
      toast.error("رفع الملفات معطّل في وضع العرض التجريبي");
      return {
        data: null,
        error: {
          name: "DemoReadOnly",
          message: "uploads_disabled_in_demo_mode",
        } as any,
      };
    };
    (supabase.storage as any).from = (bucket: string) => {
      const api = originalFrom(bucket);
      api.upload = denied as any;
      api.uploadToSignedUrl = denied as any;
      api.update = denied as any;
      api.move = denied as any;
      api.copy = denied as any;
      api.remove = denied as any;
      api.createSignedUploadUrl = denied as any;
      return api;
    };

    // Block native <input type="file"> selection at capture phase
    const blockFileInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.tagName === "INPUT" && t.type === "file") {
        e.preventDefault();
        e.stopPropagation();
        try { t.value = ""; } catch {}
        toast.error("رفع الملفات معطّل في وضع العرض التجريبي");
      }
    };
    document.addEventListener("change", blockFileInput, true);
    document.addEventListener("click", (e) => {
      const t = e.target as HTMLElement | null;
      const input = t?.closest?.("input[type=file]") as HTMLInputElement | null;
      if (input) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("رفع الملفات معطّل في وضع العرض التجريبي");
      }
    }, true);

    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("change", blockFileInput, true);
      document.body.classList.remove("demo-mode");
      (supabase.storage as any).from = originalFrom;
    };
  }, [isDemo]);

  if (!isDemo) return <>{children}</>;

  return (
    <>
      {/* Top banner */}
      <div
        dir="rtl"
        className="fixed top-0 inset-x-0 z-[100] bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg"
        style={{ height: 40 }}
      >
        <div className="h-full max-w-screen-2xl mx-auto flex items-center justify-between px-4 text-xs sm:text-sm font-bold">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>وضع العرض التجريبي — جميع البيانات افتراضية وللاستعراض فقط</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-emerald-100">
            <Lock className="w-3.5 h-3.5" />
            <span>قراءة فقط · لا تعديل · لا تصدير</span>
          </div>
        </div>
      </div>

      {/* Push everything down so the banner doesn't cover content */}
      <div style={{ paddingTop: 40 }}>{children}</div>

      {/* Diagonal repeating watermark, layered above content but click-through */}
      <div
        aria-hidden
        className="fixed inset-0 z-[90] pointer-events-none select-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-30deg, transparent 0 220px, rgba(16,185,129,0.06) 220px 460px)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"600\\" height=\\"360\\"><text x=\\"50%\\" y=\\"50%\\" dominant-baseline=\\"middle\\" text-anchor=\\"middle\\" fill=\\"rgba(13,148,136,0.08)\\" font-family=\\"Cairo, sans-serif\\" font-size=\\"96\\" font-weight=\\"900\\" transform=\\"rotate(-25 300 180)\\">DEMO · للعرض فقط</text></svg>")',
            backgroundRepeat: "repeat",
          }}
        />
      </div>

      {/* Hide write-action UI globally */}
      <style>{`
        body.demo-mode [data-demo-hide],
        body.demo-mode .demo-hide {
          display: none !important;
        }
        body.demo-mode * {
          -webkit-user-select: text;
          user-select: text;
        }
        body.demo-mode img,
        body.demo-mode video,
        body.demo-mode canvas {
          -webkit-user-drag: none;
        }
      `}</style>
    </>
  );
}
