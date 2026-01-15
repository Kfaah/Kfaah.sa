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
  hrManager?: string;
  hrManagerSignatureUrl?: string | null;
  hrManagerApproved?: boolean;
  executiveManager?: string;
  executiveManagerSignatureUrl?: string | null;
  executiveManagerApproved?: boolean;
  approverName?: string;
  approverSignatureUrl?: string | null;
  isApproved?: boolean;
  headerOffset?: number;
  letterheadUrl?: string | null;
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
  hrManager = "",
  hrManagerSignatureUrl,
  hrManagerApproved = false,
  executiveManager = "",
  executiveManagerSignatureUrl,
  executiveManagerApproved = false,
  approverName,
  approverSignatureUrl,
  isApproved = false,
  headerOffset = 35,
  letterheadUrl = "/letterhead-template.jpg",
}: LiveRequestPreviewProps) {
  const offsetPercent = headerOffset;
  const backgroundUrl = letterheadUrl || "/letterhead-template.jpg";

  const formatArabicDate = (date: Date | undefined) => {
    if (!date) return "---";
    return format(date, "yyyy/MM/dd", { locale: ar });
  };

  const currentDate = format(new Date(), "yyyy/MM/dd", { locale: ar });

  // الصف الأول: مقدم الطلب والموظف البديل
  const firstRowSlots = [
    { label: "مقدم الطلب", name: employeeName, signature: signatureUrl, approved: true, bgColor: "", textColor: "text-foreground" },
    { label: "الموظف البديل", name: substituteEmployee || "", signature: substituteSignatureUrl, approved: substituteApproved, bgColor: "bg-amber-50/50", textColor: "text-amber-700" },
  ];

  // الصف الثاني: المدراء
  const secondRowSlots = [
    { label: "المدير المباشر", name: directManager || "", signature: directManagerSignatureUrl, approved: managerApproved, bgColor: "bg-blue-50/50", textColor: "text-blue-700" },
    { label: "مدير الموارد البشرية", name: hrManager || "", signature: hrManagerSignatureUrl, approved: hrManagerApproved, bgColor: "bg-purple-50/50", textColor: "text-purple-700" },
    { label: "المدير التنفيذي", name: executiveManager || "", signature: executiveManagerSignatureUrl, approved: executiveManagerApproved, bgColor: "bg-green-50/50", textColor: "text-green-800" },
  ];

  // دالة لعرض خانة التوقيع
  const renderSignatureSlot = (slot: typeof firstRowSlots[0], colSpan: number = 1) => (
    <td 
      key={slot.label}
      colSpan={colSpan}
      className={`py-2 px-1 border border-border/40 text-center align-top ${slot.bgColor} ${slot.approved ? 'bg-opacity-100' : ''}`}
    >
      <div className={`font-bold text-[9px] mb-0.5 ${slot.textColor}`}>{slot.label}</div>
      <div className={`text-[8px] mb-1 ${slot.name ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
        {slot.name || "..........."}
      </div>
      {slot.approved && slot.signature ? (
        <img 
          src={slot.signature} 
          alt={`توقيع ${slot.label}`}
          className="h-6 mx-auto object-contain"
        />
      ) : slot.name ? (
        <div className="h-6 flex items-center justify-center">
          <span className={`text-[7px] ${slot.textColor} ${slot.bgColor || 'bg-gray-100'} px-1 py-0.5 rounded`}>
            انتظار
          </span>
        </div>
      ) : (
        <div className="h-6 border-b-2 border-dashed border-gray-300 mx-2 mt-1" />
      )}
    </td>
  );

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
                  <td colSpan={4} className="bg-primary/10 font-bold text-[11px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    بيانات مقدم الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 w-[20%] text-[10px]">اسم الموظف</td>
                  <td className={`py-1.5 px-2 border border-border/40 w-[30%] text-[10px] ${employeeName ? 'font-medium' : 'text-muted-foreground'}`}>
                    {employeeName || "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 w-[20%] text-[10px]">المسمى الوظيفي</td>
                  <td className={`py-1.5 px-2 border border-border/40 w-[30%] text-[10px] ${jobRole ? 'font-medium' : 'text-muted-foreground'}`}>
                    {jobRole || "---"}
                  </td>
                </tr>

                {/* تفاصيل الطلب */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[11px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    تفاصيل الطلب
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[10px]">نوع الطلب</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[10px] ${requestTypeName ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    {requestTypeName || "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[10px]">عدد الأيام</td>
                  <td className="py-1.5 px-2 border border-border/40 text-[10px]">
                    <span className={daysCount > 0 ? 'bg-primary/15 text-primary font-bold px-2 py-0.5 rounded text-[10px]' : 'text-muted-foreground'}>
                      {daysCount > 0 ? `${daysCount} يوم` : "---"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[10px]">من تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[10px] ${startDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {startDate ? formatArabicDate(startDate) : "---"}
                  </td>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 text-[10px]">إلى تاريخ</td>
                  <td className={`py-1.5 px-2 border border-border/40 text-[10px] ${endDate ? 'font-medium' : 'text-muted-foreground'}`}>
                    {endDate ? formatArabicDate(endDate) : "---"}
                  </td>
                </tr>
                <tr>
                  <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 align-top text-[10px]">السبب</td>
                  <td colSpan={3} className={`py-1.5 px-2 border border-border/40 text-[10px] ${reason ? 'font-medium' : 'text-muted-foreground italic'}`}>
                    {reason || "لم يتم تحديد السبب"}
                  </td>
                </tr>
                {notes && (
                  <tr>
                    <td className="bg-muted/30 font-semibold py-1.5 px-2 border border-border/40 align-top text-[10px]">ملاحظات</td>
                    <td colSpan={3} className="py-1.5 px-2 border border-border/40 text-[10px] font-medium">
                      {notes}
                    </td>
                  </tr>
                )}

                {/* التوقيعات والاعتماد */}
                <tr>
                  <td colSpan={4} className="bg-primary/10 font-bold text-[11px] py-1.5 px-3 border border-primary/20 text-center text-primary">
                    التوقيعات والاعتماد
                  </td>
                </tr>
                
                {/* الصف الأول: مقدم الطلب والموظف البديل */}
                <tr>
                  {firstRowSlots.map((slot) => renderSignatureSlot(slot, 2))}
                </tr>
                
                {/* الصف الثاني: المدراء (3 خانات) */}
                <tr>
                  <td 
                    className={`py-2 px-1 border border-border/40 text-center align-top ${secondRowSlots[0].bgColor}`}
                    style={{ width: '33.33%' }}
                  >
                    <div className={`font-bold text-[9px] mb-0.5 ${secondRowSlots[0].textColor}`}>{secondRowSlots[0].label}</div>
                    <div className={`text-[8px] mb-1 ${secondRowSlots[0].name ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {secondRowSlots[0].name || "..........."}
                    </div>
                    {secondRowSlots[0].approved && secondRowSlots[0].signature ? (
                      <img src={secondRowSlots[0].signature} alt="توقيع" className="h-6 mx-auto object-contain" />
                    ) : secondRowSlots[0].name ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className={`text-[7px] ${secondRowSlots[0].textColor} ${secondRowSlots[0].bgColor || 'bg-gray-100'} px-1 py-0.5 rounded`}>انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-gray-300 mx-2 mt-1" />
                    )}
                  </td>
                  <td 
                    className={`py-2 px-1 border border-border/40 text-center align-top ${secondRowSlots[1].bgColor}`}
                    style={{ width: '33.33%' }}
                  >
                    <div className={`font-bold text-[9px] mb-0.5 ${secondRowSlots[1].textColor}`}>{secondRowSlots[1].label}</div>
                    <div className={`text-[8px] mb-1 ${secondRowSlots[1].name ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {secondRowSlots[1].name || "..........."}
                    </div>
                    {secondRowSlots[1].approved && secondRowSlots[1].signature ? (
                      <img src={secondRowSlots[1].signature} alt="توقيع" className="h-6 mx-auto object-contain" />
                    ) : secondRowSlots[1].name ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className={`text-[7px] ${secondRowSlots[1].textColor} ${secondRowSlots[1].bgColor || 'bg-gray-100'} px-1 py-0.5 rounded`}>انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-gray-300 mx-2 mt-1" />
                    )}
                  </td>
                  <td 
                    colSpan={2}
                    className={`py-2 px-1 border border-border/40 text-center align-top ${secondRowSlots[2].bgColor}`}
                    style={{ width: '33.33%' }}
                  >
                    <div className={`font-bold text-[9px] mb-0.5 ${secondRowSlots[2].textColor}`}>{secondRowSlots[2].label}</div>
                    <div className={`text-[8px] mb-1 ${secondRowSlots[2].name ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {secondRowSlots[2].name || "..........."}
                    </div>
                    {secondRowSlots[2].approved && secondRowSlots[2].signature ? (
                      <img src={secondRowSlots[2].signature} alt="توقيع" className="h-6 mx-auto object-contain" />
                    ) : secondRowSlots[2].name ? (
                      <div className="h-6 flex items-center justify-center">
                        <span className={`text-[7px] ${secondRowSlots[2].textColor} ${secondRowSlots[2].bgColor || 'bg-gray-100'} px-1 py-0.5 rounded`}>انتظار</span>
                      </div>
                    ) : (
                      <div className="h-6 border-b-2 border-dashed border-gray-300 mx-2 mt-1" />
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
