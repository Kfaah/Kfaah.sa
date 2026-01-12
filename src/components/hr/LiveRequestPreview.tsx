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

  const getRequestTypeText = () => {
    if (requestTypeName.includes("إجازة")) {
      return `أتقدم لسعادتكم بطلب الحصول على ${requestTypeName}`;
    } else if (requestTypeName.includes("استئذان")) {
      return `أتقدم لسعادتكم بطلب ${requestTypeName}`;
    } else if (requestTypeName.includes("شهادة")) {
      return `أتقدم لسعادتكم بطلب إصدار ${requestTypeName}`;
    }
    return `أتقدم لسعادتكم بطلب ${requestTypeName}`;
  };

  const currentDate = format(new Date(), "dd/MM/yyyy", { locale: ar });

  return (
    <div 
      className="relative bg-white rounded-lg overflow-hidden shadow-lg border"
      style={{ aspectRatio: "210/297", minHeight: "500px" }}
    >
      {/* خلفية القالب الرسمي */}
      <img
        src="/letterhead-template.jpg"
        alt="قالب الخطاب الرسمي"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* محتوى الطلب */}
      <div className="absolute inset-0 p-4" dir="rtl">
        {/* الرقم والتاريخ */}
        <div className="absolute top-[20px] right-[60px] text-[8px]" style={{ fontFamily: 'Arial, sans-serif' }}>
          <p className="text-muted-foreground">{requestNumber || "HR-XXXX-XXXX"}</p>
        </div>
        <div className="absolute top-[28px] right-[60px] text-[8px]" style={{ fontFamily: 'Arial, sans-serif' }}>
          <p className="text-muted-foreground">{currentDate}</p>
        </div>

        {/* محتوى الطلب الرسمي */}
        <div className="mt-[48px] mr-4 ml-8 space-y-1.5 text-[9px] leading-relaxed">
          <h2 className="text-sm font-bold text-center mb-3">
            طلب {requestTypeName || "___________"}
          </h2>

          <p className="font-semibold text-[8px]">صاحب السعادة المدير العام    حفظه الله</p>
          <p className="text-[8px]">السلام عليكم ورحمة الله وبركاته، وبعد:</p>
          
          <div className="mt-2 space-y-0.5">
            <p className="text-[8px]">
              <span className="font-semibold">أنا الموقع أدناه:</span>{" "}
              <span className={employeeName ? "text-foreground" : "text-muted-foreground"}>
                {employeeName || "_______________"}
              </span>
            </p>
            <p className="text-[8px]">
              <span className="font-semibold">المسمى الوظيفي:</span>{" "}
              <span className={jobRole ? "text-foreground" : "text-muted-foreground"}>
                {jobRole || "_______________"}
              </span>
            </p>
          </div>

          <p className="mt-2 text-[8px]">
            {requestTypeName ? getRequestTypeText() : "أتقدم لسعادتكم بطلب ___________"}
          </p>

          <div className="space-y-0.5">
            <p className="text-[8px]">
              <span className="font-semibold">اعتباراً من تاريخ:</span>{" "}
              <span className={startDate ? "text-foreground" : "text-muted-foreground"}>
                {startDate ? formatArabicDate(startDate) : "__/__/____"}
              </span>
            </p>
            <p className="text-[8px]">
              <span className="font-semibold">وحتى تاريخ:</span>{" "}
              <span className={endDate ? "text-foreground" : "text-muted-foreground"}>
                {endDate ? formatArabicDate(endDate) : "__/__/____"}
              </span>
            </p>
            <p className="text-[8px]">
              <span className="font-semibold">إجمالي الأيام:</span>{" "}
              <span className={daysCount > 0 ? "text-accent font-bold" : "text-muted-foreground"}>
                ({daysCount > 0 ? daysCount : "_"}) يوم
              </span>
            </p>
          </div>

          {(reason || !reason) && (
            <p className="mt-1 text-[8px]">
              <span className="font-semibold">السبب:</span>{" "}
              <span className={reason ? "text-foreground" : "text-muted-foreground italic"}>
                {reason || "سيتم إضافة السبب هنا..."}
              </span>
            </p>
          )}

          {notes && (
            <p className="text-[8px]">
              <span className="font-semibold">ملاحظات:</span> {notes}
            </p>
          )}

          <p className="mt-2 text-[8px]">آمل من سعادتكم التكرم بالموافقة على طلبي.</p>
          <p className="text-[8px]">وتقبلوا فائق الاحترام والتقدير،،،</p>

          {/* التوقيعات */}
          <div className="flex justify-between mt-4 pt-2">
            <div className="text-center min-w-[80px]">
              <p className="font-semibold mb-0.5 text-[8px]">مقدم الطلب</p>
              <p className="text-[8px]">{employeeName || "___________"}</p>
              {signatureUrl ? (
                <img 
                  src={signatureUrl} 
                  alt="توقيع الموظف" 
                  className="h-8 mx-auto mt-1 object-contain"
                />
              ) : (
                <div className="h-8 border-b border-dashed border-muted-foreground/50 mt-1 mx-2" />
              )}
            </div>

            <div className="text-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-1.5 min-w-[80px]">
              <p className="font-semibold mb-0.5 text-[8px] text-muted-foreground">اعتماد الإدارة</p>
              <p className="text-[7px] text-muted-foreground/60 mt-2">في انتظار الموافقة</p>
            </div>
          </div>
        </div>
      </div>

      {/* مؤشر المعاينة */}
      <div className="absolute top-2 left-2 bg-accent/90 text-white text-[8px] px-2 py-0.5 rounded-full font-medium">
        معاينة حية
      </div>
    </div>
  );
}
