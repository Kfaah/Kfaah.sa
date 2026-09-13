import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

const fmtSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " ر.س";

export interface DonorReportData {
  donor_name: string;
  donor_phone?: string;
  org_name: string;
  total_donated: number;
  total_allocated: number;
  fully_spent: boolean;
  primary_project?: string | null;
  projects_funded: string[];
}

export async function exportDonorThankYouDocx(d: DonorReportData) {
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");
  const project = d.primary_project || "مشاريع الجمعية المختلفة";
  const status = d.fully_spent
    ? `يسرّنا إعلامكم بأن تبرعكم البالغ ${fmtSAR(d.total_donated)} قد تم صرفه بالكامل لصالح ${project}.`
    : `تبرعكم البالغ ${fmtSAR(d.total_donated)} في طور التوجيه إلى المستحقين، وقد صُرف منه حتى الآن ${fmtSAR(d.total_allocated)}.`;
  const doc = new Document({
    styles: { default: { document: { run: { font: "Cairo", size: 24 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: true,
          children: [new TextRun({ text: d.org_name, bold: true, size: 32 })] }),
        new Paragraph({ alignment: AlignmentType.LEFT, bidirectional: true,
          children: [new TextRun({ text: `التاريخ: ${today}`, size: 20 })] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER, bidirectional: true,
          children: [new TextRun({ text: "خطاب شكر وتقدير", bold: true })] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun({ text: `الفاضل/ة ${d.donor_name},`, bold: true })] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun("السلام عليكم ورحمة الله وبركاته،")] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun("نتقدم إليكم بأسمى آيات الشكر والتقدير على دعمكم الكريم لأعمالنا الخيرية. إن مساهمتكم تعكس روح العطاء النبيلة وتجسّد التزامكم بخدمة المجتمع.")] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun({ text: status, bold: d.fully_spent })] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        d.projects_funded.length > 0
          ? new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
              children: [new TextRun(`المشاريع التي ساهمت في تمويلها: ${d.projects_funded.join(" • ")}.`)] })
          : new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun("نسأل الله أن يجعل هذا العمل في ميزان حسناتكم، وأن يوفقكم لكل خير.")] }),
        new Paragraph({ children: [new TextRun(" ")] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun({ text: "وتقبلوا فائق الشكر والاحترام،", bold: true })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: true,
          children: [new TextRun({ text: d.org_name, bold: true })] }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `خطاب-شكر-${d.donor_name}.docx`);
}

// jsPDF built-in fonts don't support Arabic — render an HTML element off-screen and rasterize it.
export async function exportDonorTransparencyPdf(d: DonorReportData) {
  const html2canvas = (await import("html2canvas")).default;
  const today = new Date().toLocaleDateString("ar-SA-u-nu-latn");
  const status = d.fully_spent
    ? `تم صرف تبرعكم البالغ ${fmtSAR(d.total_donated)} بالكامل لصالح ${d.primary_project || "مشاريع الجمعية الخيرية"}.`
    : `تبرعكم في طور التوجيه إلى المستحقين، وقد صُرف منه حتى الآن ${fmtSAR(d.total_allocated)} من أصل ${fmtSAR(d.total_donated)}.`;

  const wrap = document.createElement("div");
  wrap.dir = "rtl";
  wrap.style.cssText = `
    position: fixed; top: -10000px; left: 0; width: 794px; padding: 48px;
    background: #ffffff; color: #0f172a; font-family: 'Cairo','Tajawal','Segoe UI',sans-serif;
    line-height: 1.8; font-size: 14px;
  `;
  wrap.innerHTML = `
    <div style="background:#228b82;color:#fff;margin:-48px -48px 28px;padding:22px 48px">
      <div style="font-size:20px;font-weight:800">${escape(d.org_name)}</div>
      <div style="font-size:12px;opacity:.85;margin-top:4px">تقرير الشفافية للمتبرع</div>
    </div>

    <div style="margin-bottom:20px;font-size:13px;color:#334155">
      <div><b>المتبرع:</b> ${escape(d.donor_name)}</div>
      ${d.donor_phone ? `<div><b>الجوال:</b> ${escape(d.donor_phone)}</div>` : ""}
      <div><b>التاريخ:</b> ${today}</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">
      <div style="background:#228b82;color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;opacity:.85">إجمالي التبرع</div>
        <div style="font-size:16px;font-weight:800;margin-top:4px">${fmtSAR(d.total_donated)}</div>
      </div>
      <div style="background:#10b981;color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;opacity:.85">المصروف حتى الآن</div>
        <div style="font-size:16px;font-weight:800;margin-top:4px">${fmtSAR(d.total_allocated)}</div>
      </div>
      <div style="background:${d.fully_spent ? "#22c55e" : "#f59e0b"};color:#fff;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;opacity:.85">الحالة</div>
        <div style="font-size:16px;font-weight:800;margin-top:4px">${d.fully_spent ? "اكتمل الصرف" : "قيد التوجيه"}</div>
      </div>
    </div>

    <h2 style="font-size:15px;color:#228b82;border-right:4px solid #228b82;padding-right:10px;margin:0 0 8px">بيان الشفافية</h2>
    <p style="margin:0 0 20px">${escape(status)}</p>

    ${d.projects_funded.length ? `
      <h2 style="font-size:15px;color:#228b82;border-right:4px solid #228b82;padding-right:10px;margin:0 0 8px">المشاريع الممولة</h2>
      <ul style="margin:0 20px 20px 0;padding:0">
        ${d.projects_funded.map(p => `<li style="margin-bottom:4px">${escape(p)}</li>`).join("")}
      </ul>
    ` : ""}

    <div style="margin-top:28px;text-align:center;font-size:10px;color:#94a3b8">
      تم توليد هذا التقرير تلقائياً — منصة كفاءة
    </div>
  `;

  document.body.appendChild(wrap);
  try {
    const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    let pos = 0;
    pdf.addImage(img, "JPEG", 0, pos, pageW, imgH);
    let remaining = imgH - pageH;
    while (remaining > 0) {
      pos -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, pos, pageW, imgH);
      remaining -= pageH;
    }
    pdf.save(`تقرير-شفافية-${d.donor_name}.pdf`);
  } finally {
    document.body.removeChild(wrap);
  }
}

function escape(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

function _legacyUnused() {
  const d = {} as DonorReportData;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "normal");

  // Header band
  pdf.setFillColor(34, 139, 130);
  pdf.rect(0, 0, 210, 30, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(d.org_name, 105, 12, { align: "center" });
  pdf.setFontSize(11);
  pdf.text("Donor Transparency Report", 105, 22, { align: "center" });

  pdf.setTextColor(0, 0, 0);
  let y = 45;
  pdf.setFontSize(13);
  pdf.text(`Donor: ${d.donor_name}`, 20, y); y += 8;
  if (d.donor_phone) { pdf.text(`Phone: ${d.donor_phone}`, 20, y); y += 8; }
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, y); y += 12;

  // KPI boxes
  const drawKpi = (x: number, label: string, value: string, color: [number, number, number]) => {
    pdf.setFillColor(...color);
    pdf.roundedRect(x, y, 55, 22, 3, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.text(label, x + 27.5, y + 8, { align: "center" });
    pdf.setFontSize(13);
    pdf.text(value, x + 27.5, y + 17, { align: "center" });
    pdf.setTextColor(0, 0, 0);
  };
  drawKpi(20, "Total Donated", fmtSAR(d.total_donated), [34, 139, 130]);
  drawKpi(78, "Allocated", fmtSAR(d.total_allocated), [16, 185, 129]);
  drawKpi(135, "Status", d.fully_spent ? "Fully Spent" : "In Progress", d.fully_spent ? [34, 197, 94] : [245, 158, 11]);
  y += 32;

  pdf.setFontSize(12);
  pdf.setTextColor(34, 139, 130);
  pdf.text("Transparency Statement", 20, y); y += 7;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(10);
  const statement = d.fully_spent
    ? `Your donation of ${fmtSAR(d.total_donated)} has been fully spent on ${d.primary_project || "our charitable projects"}.`
    : `Your donation is being directed to beneficiaries. ${fmtSAR(d.total_allocated)} has been spent so far.`;
  pdf.text(pdf.splitTextToSize(statement, 170), 20, y); y += 18;

  if (d.projects_funded.length) {
    pdf.setFontSize(12);
    pdf.setTextColor(34, 139, 130);
    pdf.text("Projects Funded", 20, y); y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    d.projects_funded.forEach((p) => {
      pdf.text(`• ${p}`, 25, y);
      y += 6;
    });
  }

  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.text("Generated automatically — Charity CRM", 105, 285, { align: "center" });
  pdf.save(`transparency-report-${d.donor_name}.pdf`);
}