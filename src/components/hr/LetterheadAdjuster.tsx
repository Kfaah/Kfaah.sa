import { useState, useRef, useCallback, useEffect } from "react";
import { GripVertical, RotateCcw, Eye, EyeOff, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LetterheadAdjusterProps {
  letterheadUrl?: string | null;
  initialOffset: number; // القيمة المخزنة كنسبة مئوية (0-100)
  onSave: (offset: number) => void;
  isSaving?: boolean;
}

// ارتفاع مرجعي للورقة A4 بالنسب (297mm)
const REFERENCE_HEIGHT = 297;

export function LetterheadAdjuster({
  letterheadUrl,
  initialOffset,
  onSave,
  isSaving = false,
}: LetterheadAdjusterProps) {
  const [offsetPercent, setOffsetPercent] = useState(initialOffset); // نسبة مئوية
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [saved, setSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);

  useEffect(() => {
    setOffsetPercent(initialOffset);
  }, [initialOffset]);

  const getContainerHeight = () => {
    return containerRef.current?.clientHeight || 400;
  };

  // تحويل النسبة المئوية إلى بكسل للعرض
  const percentToPixel = (percent: number) => {
    const containerHeight = getContainerHeight();
    return (percent / 100) * containerHeight;
  };

  // تحويل البكسل إلى نسبة مئوية للحفظ
  const pixelToPercent = (pixel: number) => {
    const containerHeight = getContainerHeight();
    return (pixel / containerHeight) * 100;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startOffsetRef.current = percentToPixel(offsetPercent);
    setSaved(false);
  }, [offsetPercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startYRef.current;
    const containerHeight = getContainerHeight();
    const newPixelOffset = Math.max(30, Math.min(containerHeight * 0.6, startOffsetRef.current + deltaY));
    setOffsetPercent(pixelToPercent(newPixelOffset));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startOffsetRef.current = percentToPixel(offsetPercent);
    setSaved(false);
  }, [offsetPercent]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    const containerHeight = getContainerHeight();
    const newPixelOffset = Math.max(30, Math.min(containerHeight * 0.6, startOffsetRef.current + deltaY));
    setOffsetPercent(pixelToPercent(newPixelOffset));
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetPosition = () => {
    setOffsetPercent(35); // 35% كقيمة افتراضية
    setSaved(false);
  };

  const handleSave = () => {
    onSave(Math.round(offsetPercent * 10) / 10); // تقريب لرقم عشري واحد
    setSaved(true);
  };

  const currentPixelOffset = percentToPixel(offsetPercent);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">ضبط موضع المحتوى (الكليشيه)</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="h-8 text-xs gap-1"
          >
            {showGuide ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showGuide ? 'إخفاء الخط' : 'إظهار الخط'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetPosition}
            className="h-8 text-xs gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            إعادة تعيين
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || saved}
            className="h-8 text-xs gap-1 bg-gradient-to-l from-accent to-teal-500"
          >
            {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? 'تم الحفظ' : 'حفظ الموضع'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        اسحب الخط الأحمر لتحديد منطقة الكليشيه (الترويسة). هذا الإعداد يُحفظ مرة واحدة ويُطبق على جميع الطلبات من هذا النوع.
      </p>

      <div className="relative group">
        {/* الظل الخارجي */}
        <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-lg opacity-60" />
        
        {/* الورقة */}
        <div 
          ref={containerRef}
          className="relative bg-white rounded-xl overflow-hidden border border-border/50"
          style={{ 
            aspectRatio: "210/297", 
            minHeight: "400px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)"
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* خلفية القالب */}
          <img
            src={letterheadUrl || "/letterhead-template.jpg"}
            alt="قالب الخطاب الرسمي"
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* خط إرشادي لمنطقة الكليشة */}
          {showGuide && (
            <div 
              className="absolute top-0 left-0 right-0 border-b-4 border-dashed border-red-600 bg-red-500/20 pointer-events-none z-10 transition-all duration-200"
              style={{ height: `${offsetPercent}%` }}
            >
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-4 py-1.5 rounded-full font-bold shadow-lg">
                ⚠️ منطقة الكليشة - لا تضع محتوى هنا
              </div>
            </div>
          )}

          {/* مقبض السحب */}
          {showGuide && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 z-20 cursor-ns-resize select-none transition-all duration-200 ${
                isDragging ? 'scale-110' : 'hover:scale-105'
              }`}
              style={{ top: `calc(${offsetPercent}% - 12px)` }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div className={`flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-full shadow-lg ${
                isDragging ? 'ring-4 ring-primary/30' : ''
              }`}>
                <GripVertical className="w-4 h-4" />
                <span className="text-[9px] font-bold">اسحب لتحريك الخط</span>
              </div>
            </div>
          )}

          {/* محتوى تجريبي */}
          <div
            className={`absolute inset-0 px-4 pb-4 flex flex-col transition-all duration-200 ${
              isDragging ? 'opacity-60' : ''
            }`}
            style={{ paddingTop: `calc(${offsetPercent}% + 10px)` }}
            dir="rtl"
          >
            <div className="text-center mb-2">
              <div className="text-[10px] font-bold text-foreground">نموذج طلب</div>
              <div className="w-16 h-0.5 bg-primary/50 mx-auto mt-1 rounded-full" />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted/50 rounded w-3/4 mx-auto" />
              <div className="h-3 bg-muted/50 rounded w-1/2 mx-auto" />
              <div className="h-3 bg-muted/50 rounded w-2/3 mx-auto" />
            </div>
          </div>

          {/* مؤشر الموضع */}
          <div className="absolute bottom-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded font-mono z-20">
            الموضع: {offsetPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}
