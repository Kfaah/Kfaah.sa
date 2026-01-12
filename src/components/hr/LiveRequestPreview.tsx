import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useRef, useCallback } from "react";
import { GripVertical, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveRequestPreviewProps {
  employeeName: string;
  jobRole: string;
  signatureUrl?: string | null;
  requestTypeName: string;
  startDate?: Date;
  endDate?: Date;
  daysCount: number;
  reason: string;
  notes: string;
  requestNumber: string;
  substituteEmployee?: string;
  directManager?: string;
}

export function LiveRequestPreview({
  employeeName,
  jobRole,
  signatureUrl,
  requestTypeName,
  startDate,
  endDate,
  daysCount,
  reason,
  notes,
  requestNumber,
  substituteEmployee = "",
  directManager = "",
}: LiveRequestPreviewProps) {
  const [contentOffset, setContentOffset] = useState(200); // الموضع الافتراضي
  const [isDragging, setIsDragging] = useState(false);
  const [showGuide, setShowGuide] = useState(true); // إظهار/إخفاء الخط الإرشادي
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);

  const formatArabicDate = (date: Date | undefined) => {
    if (!date) return "---";
    return format(date, "yyyy/MM/dd", { locale: ar });
  };

  const currentDate = format(new Date(), "yyyy/MM/dd", { locale: ar });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startOffsetRef.current = contentOffset;
  }, [contentOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startYRef.current;
    const newOffset = Math.max(50, Math.min(350, startOffsetRef.current + deltaY));
    setContentOffset(newOffset);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startOffsetRef.current = contentOffset;
  }, [contentOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    const newOffset = Math.max(50, Math.min(350, startOffsetRef.current + deltaY));
    setContentOffset(newOffset);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetPosition = () => {
    setContentOffset(200);
  };

  return (
    <div className="relative group">
      {/* الظل الخارجي */}
      <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
      
      {/* الورقة الرئيسية */}
      <div 
        ref={containerRef}
        className="relative bg-white rounded-xl overflow-hidden border border-border/50 transform transition-all duration-300 group-hover:scale-[1.01]"
        style={{ 
          aspectRatio: "210/297", 
          minHeight: "500px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.08)"
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* خلفية القالب الرسمي */}
        <img
          src="/letterhead-template.jpg"
          alt="قالب الخطاب الرسمي"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* خط إرشادي واضح لمنطقة الكليشة */}
        {showGuide && (
          <div 
            className="absolute top-0 left-0 right-0 border-b-4 border-dashed border-red-600 bg-red-500/20 pointer-events-none z-10 transition-all duration-200"
            style={{ height: `${contentOffset}px` }}
            title="منطقة الكليشة - لا تضع محتوى هنا"
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
            style={{ top: `${contentOffset - 12}px` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div className={`flex items-center gap-1 bg-primary text-white px-3 py-1.5 rounded-full shadow-lg ${
              isDragging ? 'ring-4 ring-primary/30' : ''
            }`}>
              <GripVertical className="w-4 h-4" />
              <span className="text-[9px] font-bold">اسحب لتحريك المحتوى</span>
            </div>
          </div>
        )}

        {/* أزرار التحكم */}
        <div className="absolute top-3 right-3 z-20 flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="h-7 text-[8px] gap-1 bg-white/90 hover:bg-white shadow-md"
          >
            {showGuide ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showGuide ? 'إخفاء' : 'إظهار'}
          </Button>
          {showGuide && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetPosition}
              className="h-7 text-[8px] gap-1 bg-white/90 hover:bg-white shadow-md"
            >
              <RotateCcw className="w-3 h-3" />
              إعادة تعيين
            </Button>
          )}
        </div>
        
        {/* محتوى النموذج */}
        <div
          className={`absolute inset-0 px-3 pb-3 flex flex-col transition-all duration-200 ${
            isDragging ? 'opacity-80' : ''
          }`}
          style={{ 
            paddingTop: `${contentOffset}px`,
            fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" 
          }}
          dir="rtl"
        >
          {/* رقم الطلب والتاريخ */}
          <div className="flex justify-between items-center mx-6 text-[7px]">
            <div className="text-right">
              <span className="text-muted-foreground/70">رقم الطلب: </span>
              <span className="font-bold text-foreground">{requestNumber || "HR-XXXX-XXXX"}</span>
            </div>
            <div className="text-left">
              <span className="text-muted-foreground/70">التاريخ: </span>
              <span className="font-bold text-foreground">{currentDate}</span>
            </div>
          </div>

          {/* عنوان النموذج */}
          <div className="mt-2 text-center">
            <h2 className="text-[12px] font-bold text-foreground tracking-wide">
              نموذج {requestTypeName || "طلب"}
            </h2>
            <div className="w-20 h-0.5 bg-primary/50 mx-auto mt-1 rounded-full" />
          </div>

          {/* جدول البيانات */}
          <div className="mt-3 mx-4 flex-1" style={{ fontSize: '8px' }}>
            <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
              <tbody>
                {/* بيانات مقدم الطلب */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[9px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    بيانات مقدم الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 w-[22%] text-[8px]">اسم الموظف</td>
                  <td className={`py-1.5 px-2 border border-border/40 w-[28%] text-[8px] ${employeeName ? 'font-medium' : 'text-muted-foreground'}`}>
                    {employeeName || "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 w-[22%] text-[8px]">المسمى الوظيفي</td>
                  <td className={`py-1.5 px-2 border border-border/40 w-[28%] text-[8px] ${jobRole ? 'font-medium' : 'text-muted-foreground'}`}>
                    {jobRole || "---"}
                  </td>
                </tr>

                {/* تفاصيل الطلب */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[9px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    تفاصيل الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">نوع الطلب</td>
                  <td colSpan={3} className={`py-1.5 px-2 border border-border/40 text-[8px] ${requestTypeName ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    {requestTypeName || "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">إلى تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[8px] ${endDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {endDate ? formatArabicDate(endDate) : "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">من تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[8px] ${startDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {startDate ? formatArabicDate(startDate) : "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">عدد الأيام</td>
                  <td colSpan={3} className="py-1.5 px-2 border border-border/40 text-[8px]">
                    <span className={daysCount > 0 ? 'bg-primary/15 text-primary font-bold px-2 py-0.5 rounded text-[9px]' : 'text-muted-foreground'}>
                      {daysCount > 0 ? `${daysCount} يوم` : "---"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 align-top text-[8px]">السبب</td>
                  <td colSpan={3} className={`py-1.5 px-2 border border-border/40 text-[8px] ${reason ? 'font-medium' : 'text-muted-foreground italic'}`}>
                    {reason || "لم يتم تحديد السبب"}
                  </td>
                </tr>
                {notes && (
                  <tr>
                    <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 align-top text-[8px]">ملاحظات</td>
                    <td colSpan={3} className="py-1.5 px-2 border border-border/40 text-[8px] font-medium">
                      {notes}
                    </td>
                  </tr>
                )}

                {/* التوقيعات */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[9px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    التوقيعات والاعتماد
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2 border border-border/40 text-center align-top">
                    <div className="font-bold text-[7px] mb-1 text-foreground">مقدم الطلب</div>
                    <div className="text-[7px] mb-1 font-medium">{employeeName || "---"}</div>
                    {signatureUrl ? (
                      <img 
                        src={signatureUrl} 
                        alt="توقيع الموظف" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-muted-foreground/30 mx-2 mt-1" />
                    )}
                  </td>
                  <td className="py-2 px-2 border border-border/40 text-center align-top bg-amber-50/50">
                    <div className="font-bold text-[7px] mb-1 text-amber-700">الموظف البديل</div>
                    <div className={`text-[7px] mb-1 ${substituteEmployee ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {substituteEmployee || ".................."}
                    </div>
                    <div className="h-6 border-b-2 border-dashed border-amber-300 mx-2 mt-1" />
                  </td>
                  <td className="py-2 px-2 border border-border/40 text-center align-top bg-blue-50/50">
                    <div className="font-bold text-[7px] mb-1 text-blue-700">المدير المباشر</div>
                    <div className={`text-[7px] mb-1 ${directManager ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {directManager || ".................."}
                    </div>
                    <div className="h-6 border-b-2 border-dashed border-blue-300 mx-2 mt-1" />
                  </td>
                  <td className="py-2 px-2 border border-border/40 text-center align-top bg-accent/5">
                    <div className="font-bold text-[7px] mb-1 text-accent">اعتماد الإدارة</div>
                    <div className="flex items-center justify-center gap-1 mt-1 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[6px] text-muted-foreground">في الانتظار</span>
                    </div>
                    <div className="h-6 border-b-2 border-dashed border-accent/30 mx-2 mt-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* مؤشر المعاينة */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent text-white text-[7px] px-2.5 py-1 rounded-full font-medium shadow-lg z-20">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          معاينة حية
        </div>

        {/* مؤشر الموضع الحالي */}
        {showGuide && (
          <div className="absolute bottom-3 left-3 bg-black/70 text-white text-[8px] px-2 py-1 rounded font-mono z-20">
            الموضع: {contentOffset}px
          </div>
        )}
      </div>
    </div>
  );
}
