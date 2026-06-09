import { useEffect, useRef } from "react";
import { Printer, ImageDown } from "lucide-react";
import { toPng } from "html-to-image";

/**
 * LetterPage - صفحة خطاب رسمي على ورق منصة كفاءة
 * صفحة A4 RTL قابلة للطباعة مباشرة من المتصفح
 */
export default function LetterPage() {
  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "خطاب دعوة رسمي | منصة كفاءة";
  }, []);

  const handlePrint = () => {
    if (letterRef.current) {
      const originalContents = document.body.innerHTML;
      const printContents = letterRef.current.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const handleExportImage = async () => {
    if (!letterRef.current) return;
    try {
      const dataUrl = await toPng(letterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = "خطاب-دعوة-جمعية-عطف.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("فشل تصدير الصورة:", err);
    }
  };

  return (
    <div
      className="min-h-screen bg-[hsl(195,30%,96%)] flex flex-col items-center py-8"
      dir="rtl"
    >
      {/* زر الطباعة */}
      <div className="w-full max-w-[210mm] flex justify-start gap-2 mb-4 px-4 print:hidden">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-[hsl(210,60%,28%)] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[hsl(210,60%,22%)] transition-colors shadow-md"
        >
          <Printer className="w-5 h-5" />
          طباعة الخطاب
        </button>
        <button
          onClick={handleExportImage}
          className="inline-flex items-center gap-2 bg-[hsl(174,52%,42%)] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[hsl(174,52%,34%)] transition-colors shadow-md"
        >
          <ImageDown className="w-5 h-5" />
          تصدير كصورة
        </button>
      </div>

      {/* ورقة الخطاب A4 */}
      <div
        ref={letterRef}
        className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto relative overflow-hidden print:shadow-none print:m-0 print:p-0"
        style={{
          // A4 proportions with margins
          padding: "15mm 20mm 20mm 20mm",
        }}
      >
        {/* هيدر الورق الرسمي */}
      <header className="relative pb-6 mb-6 border-b-2 border-[hsl(174,52%,52%)]">
          <div className="flex items-center justify-between">
            {/* الشعار */}
            <div className="flex items-center gap-3">
              <img
                src="/src/assets/kafaa-logo-premium.png"
                alt="شعار منصة كفاءة"
                className="h-20 w-auto object-contain"
              />
            </div>

            {/* معلومات المنصة */}
            <div className="text-right">
              <h1 className="text-xl font-bold text-[hsl(210,60%,28%)] tracking-wide">
                منصة كفاءة
              </h1>
              <p className="text-sm text-[hsl(210,50%,40%)] mt-1">
                لإدارة التسويق الإلكتروني للجمعيات
              </p>
              <p className="text-xs text-[hsl(210,15%,50%)] mt-0.5">
                www.kfaah.sa
              </p>
            </div>
          </div>

          {/* خط تزييني تركوازي */}
          <div
            className="absolute bottom-0 left-0 w-full h-1 rounded-full"
            style={{
              background: "linear-gradient(90deg, hsl(210,60%,28%) 0%, hsl(174,52%,52%) 100%)",
            }}
          />
        </header>

        {/* التاريخ */}
        <div className="flex justify-between items-center text-sm text-[hsl(210,50%,35%)] mb-10">
          <span>
            التاريخ: {(() => {
              const now = new Date();
              const hijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
                day: "numeric", month: "long", year: "numeric",
              }).format(now);
              const gregorian = new Intl.DateTimeFormat("ar", {
                day: "numeric", month: "long", year: "numeric",
              }).format(now);
              return `${hijri} الموافق ${gregorian}`;
            })()}
          </span>
          <span className="text-[hsl(210,50%,35%)]">رقم المرجع: KF-INV-1447-06</span>
        </div>

        {/* العنوان */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-[hsl(210,60%,28%)] mb-2">
            دعوة لحضور اللقاء التعريفي بمنصة كفاءة
          </h2>
          <div
            className="w-24 h-1 mx-auto rounded-full"
            style={{
              background: "linear-gradient(90deg, hsl(210,60%,28%), hsl(174,52%,52%))",
            }}
          />
        </div>

        {/* العنوان المرسل إليه */}
        <div className="mb-8">
          <p className="text-[hsl(210,50%,25%)] font-semibold text-lg mb-1">
            السادة الكرام: منسوبي جمعية عطف لرعاية الأيتام بمحافظة العارضة —
          </p>
          <p className="text-[hsl(210,50%,40%)] text-sm mt-1">
            السلام عليكم ورحمة الله وبركاته،
          </p>
        </div>

        {/* متن الخطاب */}
        <div className="space-y-5 text-[hsl(210,50%,22%)] leading-[1.8] text-base text-justify">
          <p>
            يسرُّ إدارة منصة <strong>كفاءة</strong> — المنصة المتخصصة في إدارة التسويق الإلكتروني
            للجمعيات الخيرية بالذكاء الاصطناعي — أن تتقدّم إليكم بدعوة كريمة لحضور
            <strong> اللقاء التعريفي بالمنصة</strong>، والذي يهدف إلى التعريف بأبرز ميزات وخدمات
            المنصة التي تُقدَّم <strong>مجاناً</strong> لجمعيتكم المباركة.
          </p>

          <p>
            ويسعدنا في هذا اللقاء أن نستعرض معكم كيف تُسهم منصة كفاءة في تطوير أداء التسويق
            الإلكتروني لجمعيتكم، عبر أدوات ذكاء اصطناعي متكاملة تشمل: إدارة الحملات التسويقية،
            وتقييم الأداء، وإدارة المهام والخطط التشغيلية، وتنظيم العمل بين فرق العمل،
            وغيرها من الخدمات المصممة خصيصاً لتلبية احتياجات العمل في جمعيات القطاع غير الربحي.
          </p>

          {/* صندوق تفاصيل اللقاء */}
          <div
            className="my-8 p-6 rounded-2xl border"
            style={{
              background: "hsl(174,52%,52%, 0.06)",
              borderColor: "hsl(174,52%,52%, 0.25)",
            }}
          >
            <h3 className="text-lg font-bold text-[hsl(210,60%,28%)] mb-4 text-center">
              تفاصيل اللقاء
            </h3>
            <div className="grid grid-cols-1 gap-3 text-base">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">اليوم:</span>
                <span>السبت</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">التاريخ الهجري:</span>
                <span>27 ذو الحجة 1447هـ</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">التاريخ الميلادي:</span>
                <span>13 يونيو 2026م</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">الوقت:</span>
                <span>الساعة التاسعة مساءً (21:00)</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">المنصة:</span>
                <span>عبر تطبيق Google Meet</span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "hsl(174,52%,52%)" }}
                />
                <span className="font-semibold text-[hsl(210,60%,28%)]">الفئة المستهدفة:</span>
                <span>كافة منسوبي الجمعية</span>
              </div>
            </div>
          </div>

          <p>
            نتطلع بحذر لحضوركم وتفاعلكم، مع دعواتنا لكم بدوام التوفيق والسداد.
          </p>
        </div>

        {/* التوقيع */}
        <div className="mt-16 text-center">
          <div className="mb-3">
            <div
              className="w-16 h-0.5 mx-auto rounded-full mb-4"
              style={{ background: "hsl(174,52%,52%)" }}
            />
            <p className="text-[hsl(210,60%,28%)] font-bold text-lg">
              جابر علي الحريصي
            </p>
            <p className="text-[hsl(210,50%,40%)] text-sm mt-1">
              مؤسس منصة كفاءة الإلكترونية
            </p>
          </div>
        </div>

        {/* الفوتر */}
        <footer className="absolute bottom-0 left-0 w-full px-[20mm] pb-[10mm]">
          <div
            className="w-full h-0.5 rounded-full mb-3"
            style={{
              background: "linear-gradient(90deg, hsl(210,60%,28%), hsl(174,52%,52%))",
            }}
          />
          <div className="flex justify-between items-center text-[10px] text-[hsl(210,30%,50%)]">
            <span>منصة كفاءة — www.kfaah.sa</span>
            <span>لإدارة التسويق الإلكتروني للجمعيات</span>
            <span>KF-INV-1447-06</span>
          </div>
        </footer>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
