import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Printer, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface RequestData {
  id: string;
  request_number: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  days_count: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  hr_request_types: {
    name_ar: string;
  };
}

interface EmployeeData {
  full_name: string;
  job_role: string;
  signature_url: string | null;
}

interface ApproverData {
  full_name: string;
  job_role: string;
  signature_url: string | null;
}

interface OfficialRequestPDFProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: RequestData;
  employee: EmployeeData;
  approver?: ApproverData | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { label: "موافق عليه", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export function OfficialRequestPDF({
  open,
  onOpenChange,
  request,
  employee,
  approver,
}: OfficialRequestPDFProps) {
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const formatArabicDate = (dateStr: string | null) => {
    if (!dateStr) return "---";
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ar });
  };

  const getRequestTypeText = () => {
    const typeName = request.hr_request_types?.name_ar || "طلب";
    
    if (typeName.includes("إجازة")) {
      return `أتقدم لسعادتكم بطلب الحصول على ${typeName}`;
    } else if (typeName.includes("استئذان")) {
      return `أتقدم لسعادتكم بطلب ${typeName}`;
    } else if (typeName.includes("شهادة")) {
      return `أتقدم لسعادتكم بطلب إصدار ${typeName}`;
    }
    return `أتقدم لسعادتكم بطلب ${typeName}`;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // تحميل الخلفية
      const letterhead = new Image();
      letterhead.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        letterhead.onload = () => resolve();
        letterhead.onerror = () => reject(new Error("فشل تحميل القالب"));
        letterhead.src = "/letterhead-template.jpg";
      });

      // إضافة الخلفية
      pdf.addImage(letterhead, "JPEG", 0, 0, 210, 297);

      // إعداد الخط العربي
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);

      // ملء البيانات الأساسية (الرقم، التاريخ)
      pdf.text(request.request_number, 65, 28, { align: "right" });
      const requestDate = formatArabicDate(request.created_at);
      pdf.text(requestDate, 65, 38, { align: "right" });

      // عنوان الطلب
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      const title = `طلب ${request.hr_request_types?.name_ar || "إجازة"}`;
      pdf.text(title, 105, 80, { align: "center" });

      // نص الطلب
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      
      let yPos = 100;
      const lineHeight = 8;
      const rightMargin = 190;

      // التحية
      pdf.text("صاحب السعادة المدير العام    حفظه الله", rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text("السلام عليكم ورحمة الله وبركاته، وبعد:", rightMargin, yPos, { align: "right" });
      yPos += lineHeight * 2;

      // بيانات الموظف
      pdf.text(`أنا الموقع أدناه: ${employee.full_name}`, rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text(`المسمى الوظيفي: ${employee.job_role}`, rightMargin, yPos, { align: "right" });
      yPos += lineHeight * 2;

      // نص الطلب الرسمي
      pdf.text(getRequestTypeText(), rightMargin, yPos, { align: "right" });
      yPos += lineHeight;

      // التواريخ
      if (request.start_date) {
        pdf.text(`وذلك اعتباراً من تاريخ: ${formatArabicDate(request.start_date)}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }
      if (request.end_date && request.end_date !== request.start_date) {
        pdf.text(`وحتى تاريخ: ${formatArabicDate(request.end_date)}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }
      if (request.days_count) {
        pdf.text(`بإجمالي عدد أيام: (${request.days_count}) يوم`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }

      // السبب
      if (request.reason) {
        yPos += lineHeight / 2;
        pdf.text(`وذلك للسبب التالي: ${request.reason}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }

      // ملاحظات
      if (request.notes) {
        yPos += lineHeight / 2;
        pdf.text(`ملاحظات: ${request.notes}`, rightMargin, yPos, { align: "right" });
      }

      // الشكر والتقدير
      yPos += lineHeight * 2;
      pdf.text("آمل من سعادتكم التكرم بالموافقة على طلبي.", rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text("وتقبلوا فائق الاحترام والتقدير،،،", rightMargin, yPos, { align: "right" });

      // توقيع مقدم الطلب
      yPos += lineHeight * 3;
      pdf.text("مقدم الطلب:", rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text(`الاسم: ${employee.full_name}`, rightMargin, yPos, { align: "right" });

      // إضافة توقيع الموظف إذا وجد
      if (employee.signature_url) {
        try {
          const empSig = new Image();
          empSig.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            empSig.onload = () => resolve();
            empSig.onerror = () => resolve();
            empSig.src = employee.signature_url!;
          });
          if (empSig.complete && empSig.naturalWidth > 0) {
            pdf.addImage(empSig, "PNG", 150, yPos + 2, 40, 20);
          }
        } catch (e) {
          console.log("Could not load employee signature");
        }
      }

      // توقيع الموافق (إذا تمت الموافقة)
      if (request.status === "approved" && approver) {
        yPos += lineHeight * 5;
        pdf.setFont("helvetica", "bold");
        pdf.text("قرار الإدارة:", 80, yPos, { align: "right" });
        pdf.setFont("helvetica", "normal");
        yPos += lineHeight;
        pdf.text("تمت الموافقة على الطلب", 80, yPos, { align: "right" });
        yPos += lineHeight;
        pdf.text(`المعتمد: ${approver.full_name}`, 80, yPos, { align: "right" });
        yPos += lineHeight;
        pdf.text(`المسمى: ${approver.job_role}`, 80, yPos, { align: "right" });
        yPos += lineHeight;
        if (request.approved_at) {
          pdf.text(`تاريخ الموافقة: ${formatArabicDate(request.approved_at)}`, 80, yPos, { align: "right" });
        }

        // إضافة توقيع الموافق إذا وجد
        if (approver.signature_url) {
          try {
            const appSig = new Image();
            appSig.crossOrigin = "anonymous";
            await new Promise<void>((resolve) => {
              appSig.onload = () => resolve();
              appSig.onerror = () => resolve();
              appSig.src = approver.signature_url!;
            });
            if (appSig.complete && appSig.naturalWidth > 0) {
              pdf.addImage(appSig, "PNG", 40, yPos - 25, 40, 20);
            }
          } catch (e) {
            console.log("Could not load approver signature");
          }
        }
      }

      // حفظ PDF
      pdf.save(`طلب-${request.request_number}.pdf`);
      toast.success("تم تصدير الطلب بنجاح");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("حدث خطأ أثناء إنشاء الملف");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const statusInfo = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              معاينة النموذج الرسمي
            </span>
            <Badge className={`${statusInfo.color} gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* تنبيه للطلبات غير الموافق عليها */}
        {request.status !== "approved" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>هذه معاينة فقط. سيتم إضافة التوقيعات الرسمية بعد الموافقة على الطلب.</span>
          </div>
        )}

        {/* معاينة الطلب */}
        <div 
          ref={previewRef}
          className="relative bg-white rounded-lg overflow-hidden shadow-lg print:shadow-none"
          style={{ aspectRatio: "210/297" }}
        >
          {/* خلفية القالب */}
          <img
            src="/letterhead-template.jpg"
            alt="قالب الخطاب"
            className="absolute inset-0 w-full h-full object-cover"
          />
          
          {/* محتوى الطلب */}
          <div className="absolute inset-0 flex flex-col" dir="rtl">
            {/* الرقم والتاريخ */}
            <div className="absolute top-[25px] right-[75px] text-[10px]" style={{ fontFamily: 'Arial, sans-serif' }}>
              <p>{request.request_number}</p>
            </div>
            <div className="absolute top-[35px] right-[75px] text-[10px]" style={{ fontFamily: 'Arial, sans-serif' }}>
              <p>{formatArabicDate(request.created_at)}</p>
            </div>

            {/* محتوى الطلب الرسمي */}
            <div className="mt-[75px] mx-auto w-[70%] space-y-2 text-[11px] leading-relaxed text-center">
              <h2 className="text-base font-bold text-center mb-4">
                طلب {request.hr_request_types?.name_ar || "إجازة"}
              </h2>

              <p className="font-semibold">صاحب السعادة المدير العام    حفظه الله</p>
              <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
              
              <div className="mt-3 space-y-1">
                <p><span className="font-semibold">أنا الموقع أدناه:</span> {employee.full_name}</p>
                <p><span className="font-semibold">المسمى الوظيفي:</span> {employee.job_role}</p>
              </div>

              <p className="mt-3">{getRequestTypeText()}</p>

              <div className="space-y-1">
                {request.start_date && (
                  <p><span className="font-semibold">اعتباراً من تاريخ:</span> {formatArabicDate(request.start_date)}</p>
                )}
                {request.end_date && request.end_date !== request.start_date && (
                  <p><span className="font-semibold">وحتى تاريخ:</span> {formatArabicDate(request.end_date)}</p>
                )}
                {request.days_count && (
                  <p><span className="font-semibold">إجمالي الأيام:</span> ({request.days_count}) يوم</p>
                )}
              </div>

              {request.reason && (
                <p className="mt-2"><span className="font-semibold">السبب:</span> {request.reason}</p>
              )}

              {request.notes && (
                <p><span className="font-semibold">ملاحظات:</span> {request.notes}</p>
              )}

              <p className="mt-4">آمل من سعادتكم التكرم بالموافقة على طلبي.</p>
              <p>وتقبلوا فائق الاحترام والتقدير،،،</p>

              {/* التوقيعات */}
              <div className="flex justify-between mt-6 pt-4">
                <div className="text-center">
                  <p className="font-semibold mb-1 text-[10px]">مقدم الطلب</p>
                  <p className="text-[10px]">{employee.full_name}</p>
                  {employee.signature_url && (
                    <img 
                      src={employee.signature_url} 
                      alt="توقيع الموظف" 
                      className="h-10 mx-auto mt-1 object-contain"
                    />
                  )}
                </div>

                {request.status === "approved" && approver ? (
                  <div className="text-center border-2 border-green-500 rounded-lg p-2 bg-green-50">
                    <p className="font-semibold mb-1 text-[10px] text-green-700">تمت الموافقة</p>
                    <p className="text-[10px]">{approver.full_name}</p>
                    <p className="text-[9px] text-muted-foreground">{approver.job_role}</p>
                    {approver.signature_url && (
                      <img 
                        src={approver.signature_url} 
                        alt="توقيع الموافق" 
                        className="h-10 mx-auto mt-1 object-contain"
                      />
                    )}
                    {request.approved_at && (
                      <p className="text-[9px] mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {formatArabicDate(request.approved_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center border-2 border-dashed border-muted-foreground/30 rounded-lg p-2 min-w-[120px]">
                    <p className="font-semibold mb-1 text-[10px] text-muted-foreground">اعتماد الإدارة</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-4">في انتظار الموافقة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* أزرار التصدير */}
        <div className="flex gap-3 justify-end pt-4 border-t print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 ml-2" />
            طباعة
          </Button>
          <Button 
            onClick={generatePDF}
            disabled={generating}
            className="bg-gradient-to-r from-accent to-teal-500"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 ml-2" />
            )}
            تصدير PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
