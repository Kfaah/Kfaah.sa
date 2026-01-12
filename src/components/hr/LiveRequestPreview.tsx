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
  substituteEmployee?: string;
  substituteSignatureUrl?: string | null;
  substituteApproved?: boolean;
  directManager?: string;
  directManagerSignatureUrl?: string | null;
  managerApproved?: boolean;
  executiveManager?: string;
  executiveManagerSignatureUrl?: string | null;
  executiveManagerApproved?: boolean;
  approverName?: string;
  approverSignatureUrl?: string | null;
  isApproved?: boolean;
  headerOffset?: number; // موضع المحتوى كنسبة مئوية (0-100)
  letterheadUrl?: string | null; // صورة الخلفية/الورق الرسمي
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
  substituteSignatureUrl,
  substituteApproved = false,
  directManager = "",
  directManagerSignatureUrl,
  managerApproved = false,
  executiveManager = "",
  executiveManagerSignatureUrl,
  executiveManagerApproved = false,
  approverName,
  approverSignatureUrl,
  isApproved = false,
  headerOffset = 35, // 35% كقيمة افتراضية
  letterheadUrl = "/letterhead-template.jpg",
}: LiveRequestPreviewProps) {
  const offsetPercent = headerOffset; // النسبة المئوية المحفوظة من القالب
  const backgroundUrl = letterheadUrl || "/letterhead-template.jpg";

  const formatArabicDate = (date: Date | undefined) => {
    if (!date) return "---";
    return format(date, "yyyy/MM/dd", { locale: ar });
  };

  const currentDate = format(new Date(), "yyyy/MM/dd", { locale: ar });

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
          src={backgroundUrl}
          alt="قالب الخطاب الرسمي"
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* محتوى النموذج */}
        <div
          className="absolute inset-0 px-3 pb-3 flex flex-col"
          style={{ 
            paddingTop: `${offsetPercent}%`,
            fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" 
          }}
          dir="rtl"
        >
          {/* رقم الطلب والتاريخ */}
          <div className="flex justify-between items-center mx-6 text-[10px]">
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
          <div className="mt-3 text-center">
            <h2 className="text-[15px] font-bold text-foreground tracking-wide">
              نموذج {requestTypeName || "طلب"}
            </h2>
            <div className="w-24 h-0.5 bg-primary/50 mx-auto mt-1.5 rounded-full" />
          </div>

          {/* جدول البيانات */}
          <div className="mt-4 mx-4 flex-1" style={{ fontSize: '11px' }}>
            <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
              <tbody>
                {/* بيانات مقدم الطلب */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[12px] py-2 px-3 border border-primary/20 text-center text-primary">
                    بيانات مقدم الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 w-[22%] text-[11px]">اسم الموظف</td>
                  <td className={`py-2 px-3 border border-border/40 w-[28%] text-[11px] ${employeeName ? 'font-medium' : 'text-muted-foreground'}`}>
                    {employeeName || "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 w-[22%] text-[11px]">المسمى الوظيفي</td>
                  <td className={`py-2 px-3 border border-border/40 w-[28%] text-[11px] ${jobRole ? 'font-medium' : 'text-muted-foreground'}`}>
                    {jobRole || "---"}
                  </td>
                </tr>

                {/* تفاصيل الطلب */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[12px] py-2 px-3 border border-primary/20 text-center text-primary">
                    تفاصيل الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 text-[11px]">نوع الطلب</td>
                  <td colSpan={3} className={`py-2 px-3 border border-border/40 text-[11px] ${requestTypeName ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    {requestTypeName || "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 text-[11px]">من تاريخ</td>
                  <td className={`py-2 px-3 border border-border/40 text-[11px] ${startDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {startDate ? formatArabicDate(startDate) : "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 text-[11px]">إلى تاريخ</td>
                  <td className={`py-2 px-3 border border-border/40 text-[11px] ${endDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {endDate ? formatArabicDate(endDate) : "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 text-[11px]">عدد الأيام</td>
                  <td colSpan={3} className="py-2 px-3 border border-border/40 text-[11px]">
                    <span className={daysCount > 0 ? 'bg-primary/15 text-primary font-bold px-3 py-1 rounded text-[12px]' : 'text-muted-foreground'}>
                      {daysCount > 0 ? `${daysCount} يوم` : "---"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 align-top text-[11px]">السبب</td>
                  <td colSpan={3} className={`py-2 px-3 border border-border/40 text-[11px] ${reason ? 'font-medium' : 'text-muted-foreground italic'}`}>
                    {reason || "لم يتم تحديد السبب"}
                  </td>
                </tr>
                {notes && (
                  <tr>
                    <td className="bg-muted/30 font-semibold py-2 px-3 border border-border/40 align-top text-[11px]">ملاحظات</td>
                    <td colSpan={3} className="py-2 px-3 border border-border/40 text-[11px] font-medium">
                      {notes}
                    </td>
                  </tr>
                )}

                {/* التوقيعات */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[12px] py-2 px-3 border border-primary/20 text-center text-primary">
                    التوقيعات والاعتماد
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-1 border border-border/40 text-center align-top">
                    <div className="font-bold text-[9px] mb-1 text-foreground">مقدم الطلب</div>
                    <div className="text-[9px] mb-1 font-medium">{employeeName || "---"}</div>
                    {signatureUrl ? (
                      <img 
                        src={signatureUrl} 
                        alt="توقيع الموظف" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-muted-foreground/30 mx-1 mt-1" />
                    )}
                  </td>
                  <td className="py-2 px-1 border border-border/40 text-center align-top bg-amber-50/50">
                    <div className="font-bold text-[9px] mb-1 text-amber-700">الموظف البديل</div>
                    <div className={`text-[9px] mb-1 ${substituteEmployee ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {substituteEmployee || "..........."}
                    </div>
                    {substituteApproved && substituteSignatureUrl ? (
                      <img 
                        src={substituteSignatureUrl} 
                        alt="توقيع الموظف البديل" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : substituteEmployee ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className="text-[8px] text-amber-600 bg-amber-100 px-1 py-0.5 rounded">انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-amber-300 mx-1 mt-1" />
                    )}
                  </td>
                  <td className="py-2 px-1 border border-border/40 text-center align-top bg-blue-50/50">
                    <div className="font-bold text-[9px] mb-1 text-blue-700">المدير المباشر</div>
                    <div className={`text-[9px] mb-1 ${directManager ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {directManager || "..........."}
                    </div>
                    {managerApproved && directManagerSignatureUrl ? (
                      <img 
                        src={directManagerSignatureUrl} 
                        alt="توقيع المدير المباشر" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : directManager ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className="text-[8px] text-blue-600 bg-blue-100 px-1 py-0.5 rounded">انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-blue-300 mx-1 mt-1" />
                    )}
                  </td>
                  <td className="py-2 px-1 border border-border/40 text-center align-top bg-purple-50/50">
                    <div className="font-bold text-[9px] mb-1 text-purple-700">المدير التنفيذي</div>
                    <div className={`text-[9px] mb-1 ${executiveManager ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {executiveManager || "..........."}
                    </div>
                    {executiveManagerApproved && executiveManagerSignatureUrl ? (
                      <img 
                        src={executiveManagerSignatureUrl} 
                        alt="توقيع المدير التنفيذي" 
                        className="h-6 mx-auto object-contain"
                      />
                    ) : executiveManager ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className="text-[8px] text-purple-600 bg-purple-100 px-1 py-0.5 rounded">انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-purple-300 mx-1 mt-1" />
                    )}
                  </td>
                  <td className={`py-2 px-1 border border-border/40 text-center align-top ${isApproved ? 'bg-green-50/50' : 'bg-accent/5'}`}>
                    <div className={`font-bold text-[9px] mb-1 ${isApproved ? 'text-green-700' : 'text-accent'}`}>
                      {isApproved ? 'تمت الموافقة' : 'اعتماد الإدارة'}
                    </div>
                    {isApproved && approverName ? (
                      <>
                        <div className="text-[9px] mb-1 font-medium">{approverName}</div>
                        {approverSignatureUrl ? (
                          <img 
                            src={approverSignatureUrl} 
                            alt="توقيع المعتمد" 
                            className="h-6 mx-auto object-contain"
                          />
                        ) : (
                          <div className="h-6 border-b-2 border-dashed border-green-300 mx-1 mt-1" />
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-1 mt-1 mb-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-[8px] text-muted-foreground">انتظار</span>
                        </div>
                        <div className="h-6 border-b-2 border-dashed border-accent/30 mx-1 mt-1" />
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* مؤشر المعاينة */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent text-white text-[9px] px-3 py-1.5 rounded-full font-medium shadow-lg z-20">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          معاينة حية
        </div>
      </div>
    </div>
  );
}
