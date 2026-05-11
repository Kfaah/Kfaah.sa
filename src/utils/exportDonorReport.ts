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

export function exportDonorTransparencyPdf(d: DonorReportData) {
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