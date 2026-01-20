import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewMode } from "@/contexts/PreviewModeContext";
import { useNavigate } from "react-router-dom";

export function PreviewModeBanner() {
  const { isPreviewMode, disablePreviewMode } = usePreviewMode();
  const navigate = useNavigate();

  if (!isPreviewMode) return null;

  const handleExitPreview = () => {
    disablePreviewMode();
    navigate("/auth");
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white py-2 px-4 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm">وضع المعاينة</span>
            <span className="text-xs text-white/80">أنت تشاهد التطبيق بدون تسجيل دخول</span>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExitPreview}
          className="text-white hover:bg-white/20 hover:text-white gap-2"
        >
          <X className="w-4 h-4" />
          <span>تسجيل الدخول</span>
        </Button>
      </div>
    </div>
  );
}
