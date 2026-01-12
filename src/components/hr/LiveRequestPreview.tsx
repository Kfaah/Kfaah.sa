import { format } from "date-fns";
import { ar } from "date-fns/locale";

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
}: LiveRequestPreviewProps) {
  const formatArabicDate = (date: Date | undefined) => {
    if (!date) return "---";
    return format(date, "dd/MM/yyyy", { locale: ar });
  };

  const currentDate = format(new Date(), "dd/MM/yyyy", { locale: ar });

  return (
    <div className="relative group">
      {/* الظل الخارجي */}
      <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
      
      {/* الورقة الرئيسية */}
      <div 
        className="relative bg-white rounded-xl overflow-hidden border border-border/50 transform transition-all duration-300 group-hover:scale-[1.01]"
        style={{ 
          aspectRatio: "210/297", 
          minHeight: "500px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.08)"
        }}
      >
        {/* خلفية القالب الرسمي */}
        <img
          src="/letterhead-template.jpg"
          alt="قالب الخطاب الرسمي"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* خط إرشادي شفاف لمنطقة الكليشة */}
        <div 
          className="absolute top-0 left-0 right-0 h-[200px] border-b-2 border-dashed border-red-400/50 bg-red-50/10 pointer-events-none z-10"
          title="منطقة الكليشة - لا تضع محتوى هنا"
        >
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-red-400/80 text-white text-[6px] px-2 py-0.5 rounded-full font-medium">
            منطقة الكليشة
          </div>
        </div>
        
        {/* محتوى النموذج */}
        <div
          className="absolute inset-0 px-3 pb-3 pt-[200px] flex flex-col"
          dir="rtl"
          style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}
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
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">من تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[8px] ${startDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {startDate ? formatArabicDate(startDate) : "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[8px]">إلى تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[8px] ${endDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {endDate ? formatArabicDate(endDate) : "---"}
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
                  <td colSpan={2} className="py-3 px-3 border border-border/40 text-center align-top">
                    <div className="font-bold text-[8px] mb-1 text-foreground">مقدم الطلب</div>
                    <div className="text-[8px] mb-2 font-medium">{employeeName || "---"}</div>
                    {signatureUrl ? (
                      <img 
                        src={signatureUrl} 
                        alt="توقيع الموظف" 
                        className="h-8 mx-auto object-contain"
                      />
                    ) : (
                      <div className="h-8 border-b-2 border-dashed border-muted-foreground/30 mx-6 mt-2" />
                    )}
                  </td>
                  <td colSpan={2} className="py-3 px-3 border border-border/40 text-center align-top bg-accent/5">
                    <div className="font-bold text-[8px] mb-1 text-accent">اعتماد الإدارة</div>
                    <div className="flex items-center justify-center gap-1.5 mt-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[7px] text-muted-foreground font-medium">في انتظار الموافقة</span>
                    </div>
                    <div className="h-8 border-b-2 border-dashed border-accent/30 mx-6 mt-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* مؤشر المعاينة */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent text-white text-[7px] px-2.5 py-1 rounded-full font-medium shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          معاينة حية
        </div>
      </div>
    </div>
  );
}
