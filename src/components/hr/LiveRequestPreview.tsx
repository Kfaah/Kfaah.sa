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
        
        {/* محتوى النموذج */}
        <div className="absolute inset-0 p-3 flex flex-col" dir="rtl">
          
          {/* رقم الطلب والتاريخ */}
          <div className="flex justify-between items-start mt-[18px] mx-4 text-[7px]">
            <div className="text-right">
              <span className="text-muted-foreground">رقم الطلب: </span>
              <span className="font-semibold">{requestNumber || "HR-XXXX-XXXX"}</span>
            </div>
            <div className="text-left">
              <span className="text-muted-foreground">التاريخ: </span>
              <span className="font-semibold">{currentDate}</span>
            </div>
          </div>

          {/* عنوان النموذج */}
          <div className="mt-3 text-center">
            <div className="inline-block bg-primary/10 border border-primary/30 rounded-lg px-4 py-1.5">
              <h2 className="text-[11px] font-bold text-primary">
                نموذج {requestTypeName || "طلب"}
              </h2>
            </div>
          </div>

          {/* جدول البيانات */}
          <div className="mt-3 mx-3 flex-1">
            <table className="w-full text-[8px] border-collapse" style={{ borderSpacing: 0 }}>
              <tbody>
                {/* بيانات مقدم الطلب */}
                <tr>
                  <td colSpan={4} className="bg-muted/40 font-bold text-[8px] py-1 px-2 border border-border/50 text-center">
                    بيانات مقدم الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50 w-[25%]">اسم الموظف</td>
                  <td className={`py-1 px-2 border border-border/50 w-[25%] ${employeeName ? '' : 'text-muted-foreground'}`}>
                    {employeeName || "---"}
                  </td>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50 w-[25%]">المسمى الوظيفي</td>
                  <td className={`py-1 px-2 border border-border/50 w-[25%] ${jobRole ? '' : 'text-muted-foreground'}`}>
                    {jobRole || "---"}
                  </td>
                </tr>

                {/* تفاصيل الطلب */}
                <tr>
                  <td colSpan={4} className="bg-muted/40 font-bold text-[8px] py-1 px-2 border border-border/50 text-center">
                    تفاصيل الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50">نوع الطلب</td>
                  <td colSpan={3} className={`py-1 px-2 border border-border/50 ${requestTypeName ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                    {requestTypeName || "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50">من تاريخ</td>
                  <td className={`py-1 px-2 border border-border/50 ${startDate ? '' : 'text-muted-foreground'}`}>
                    {startDate ? formatArabicDate(startDate) : "---"}
                  </td>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50">إلى تاريخ</td>
                  <td className={`py-1 px-2 border border-border/50 ${endDate ? '' : 'text-muted-foreground'}`}>
                    {endDate ? formatArabicDate(endDate) : "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50">عدد الأيام</td>
                  <td colSpan={3} className="py-1 px-2 border border-border/50">
                    <span className={daysCount > 0 ? 'bg-primary/10 text-primary font-bold px-2 py-0.5 rounded' : 'text-muted-foreground'}>
                      {daysCount > 0 ? `${daysCount} يوم` : "---"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50 align-top">السبب</td>
                  <td colSpan={3} className={`py-1 px-2 border border-border/50 min-h-[30px] ${reason ? '' : 'text-muted-foreground italic'}`}>
                    {reason || "لم يتم تحديد السبب"}
                  </td>
                </tr>
                {notes && (
                  <tr>
                    <td className="bg-muted/20 font-semibold py-1 px-2 border border-border/50 align-top">ملاحظات</td>
                    <td colSpan={3} className="py-1 px-2 border border-border/50">
                      {notes}
                    </td>
                  </tr>
                )}

                {/* التوقيعات */}
                <tr>
                  <td colSpan={4} className="bg-muted/40 font-bold text-[8px] py-1 px-2 border border-border/50 text-center">
                    التوقيعات والاعتماد
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="py-2 px-2 border border-border/50 text-center align-top">
                    <div className="font-semibold text-[7px] mb-1">مقدم الطلب</div>
                    <div className="text-[7px] mb-1">{employeeName || "---"}</div>
                    {signatureUrl ? (
                      <img 
                        src={signatureUrl} 
                        alt="توقيع الموظف" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : (
                      <div className="h-6 border-b border-dashed border-muted-foreground/40 mx-4 mt-2" />
                    )}
                  </td>
                  <td colSpan={2} className="py-2 px-2 border border-border/50 text-center align-top bg-accent/5">
                    <div className="font-semibold text-[7px] mb-1 text-accent">اعتماد الإدارة</div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[6px] text-muted-foreground">في انتظار الموافقة</span>
                    </div>
                    <div className="h-6 border-b border-dashed border-accent/40 mx-4 mt-1" />
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
