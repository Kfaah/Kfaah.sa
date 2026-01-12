import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Loader2, Printer } from "lucide-react";
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
      return `يرجى التكرم بالموافقة على منحي ${typeName} وذلك`;
    } else if (typeName.includes("استئذان")) {
      return `يرجى التكرم بالموافقة على ${typeName} وذلك`;
    } else if (typeName.includes("شهادة")) {
      return `يرجى التكرم بإصدار ${typeName}`;
    }
    return `يرجى التكرم بالموافقة على ${typeName}`;
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
      // الرقم
      pdf.text(request.request_number, 65, 28, { align: "right" });
      
      // التاريخ
      const hijriDate = formatArabicDate(request.created_at);
      pdf.text(hijriDate, 65, 38, { align: "right" });

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

      // السلام عليكم
      pdf.text("السلام عليكم ورحمة الله وبركاته،", rightMargin, yPos, { align: "right" });
      yPos += lineHeight * 2;

      // بيانات الموظف
      pdf.text(`الاسم: ${employee.full_name}`, rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text(`المسمى الوظيفي: ${employee.job_role}`, rightMargin, yPos, { align: "right" });
      yPos += lineHeight * 2;

      // نص الطلب
      pdf.text(getRequestTypeText(), rightMargin, yPos, { align: "right" });
      yPos += lineHeight;

      // التواريخ
      if (request.start_date) {
        pdf.text(`من تاريخ: ${formatArabicDate(request.start_date)}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }
      if (request.end_date) {
        pdf.text(`إلى تاريخ: ${formatArabicDate(request.end_date)}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }
      if (request.days_count) {
        pdf.text(`عدد الأيام: ${request.days_count} يوم`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }

      // السبب
      if (request.reason) {
        yPos += lineHeight;
        pdf.text(`السبب: ${request.reason}`, rightMargin, yPos, { align: "right" });
        yPos += lineHeight;
      }

      // ملاحظات
      if (request.notes) {
        yPos += lineHeight;
        pdf.text(`ملاحظات: ${request.notes}`, rightMargin, yPos, { align: "right" });
      }

      // الشكر والتقدير
      yPos += lineHeight * 3;
      pdf.text("وتقبلوا خالص الشكر والتقدير،", rightMargin, yPos, { align: "right" });

      // توقيع مقدم الطلب
      yPos += lineHeight * 3;
      pdf.text("مقدم الطلب:", rightMargin, yPos, { align: "right" });
      yPos += lineHeight;
      pdf.text(employee.full_name, rightMargin, yPos, { align: "right" });

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
        pdf.text("الموافقة:", 80, yPos, { align: "right" });
        yPos += lineHeight;
        pdf.text(approver.full_name, 80, yPos, { align: "right" });
        yPos += lineHeight;
        pdf.text(approver.job_role, 80, yPos, { align: "right" });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            معاينة الطلب الرسمي
          </DialogTitle>
        </DialogHeader>

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
          <div className="absolute inset-0 p-8 pt-20" dir="rtl">
            {/* الرقم والتاريخ */}
            <div className="absolute top-6 right-20 text-sm">
              <p>الرقم: {request.request_number}</p>
              <p className="mt-1">التاريخ: {formatArabicDate(request.created_at)}</p>
            </div>

            {/* محتوى الطلب */}
            <div className="mt-16 pr-4 pl-16 space-y-4 text-sm">
              <h2 className="text-lg font-bold text-center mb-6">
                طلب {request.hr_request_types?.name_ar || "إجازة"}
              </h2>

              <p>السلام عليكم ورحمة الله وبركاته،</p>
              
              <div className="space-y-1">
                <p>الاسم: {employee.full_name}</p>
                <p>المسمى الوظيفي: {employee.job_role}</p>
              </div>

              <p>{getRequestTypeText()}</p>

              {request.start_date && (
                <p>من تاريخ: {formatArabicDate(request.start_date)}</p>
              )}
              {request.end_date && (
                <p>إلى تاريخ: {formatArabicDate(request.end_date)}</p>
              )}
              {request.days_count && (
                <p>عدد الأيام: {request.days_count} يوم</p>
              )}

              {request.reason && (
                <p>السبب: {request.reason}</p>
              )}

              {request.notes && (
                <p>ملاحظات: {request.notes}</p>
              )}

              <p className="mt-6">وتقبلوا خالص الشكر والتقدير،</p>

              {/* التوقيعات */}
              <div className="flex justify-between mt-8 pt-4">
                <div className="text-center">
                  <p className="font-semibold mb-2">مقدم الطلب</p>
                  <p>{employee.full_name}</p>
                  {employee.signature_url && (
                    <img 
                      src={employee.signature_url} 
                      alt="توقيع الموظف" 
                      className="h-12 mx-auto mt-2 object-contain"
                    />
                  )}
                </div>

                {request.status === "approved" && approver && (
                  <div className="text-center">
                    <p className="font-semibold mb-2">الموافقة</p>
                    <p>{approver.full_name}</p>
                    <p className="text-xs text-muted-foreground">{approver.job_role}</p>
                    {approver.signature_url && (
                      <img 
                        src={approver.signature_url} 
                        alt="توقيع الموافق" 
                        className="h-12 mx-auto mt-2 object-contain"
                      />
                    )}
                    {request.approved_at && (
                      <p className="text-xs mt-1">{formatArabicDate(request.approved_at)}</p>
                    )}
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
