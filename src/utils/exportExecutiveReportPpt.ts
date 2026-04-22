import pptxgen from "pptxgenjs";

export interface ExecReportRow {
  metric: string;
  result: string;
  analysis: string;
}
export interface ExecReportSection {
  title: string;
  rows: ExecReportRow[];
}
export interface ExecReport {
  executive_summary: string;
  overall_verdict?: string;
  sections: ExecReportSection[];
  strategic_recommendations?: string[];
}

// Midnight Executive palette
const NAVY = "1E2761";
const NAVY_DARK = "0F1738";
const GOLD = "C9A227";
const ICE = "EAF0FB";
const TEXT = "1A1A2E";
const MUTED = "5B6478";
const WHITE = "FFFFFF";

export async function exportExecutiveReportPpt(opts: {
  orgName: string;
  periodLabel: string;
  report: ExecReport;
}) {
  const { orgName, periodLabel, report } = opts;
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.rtlMode = true;
  pres.title = `تقرير تنفيذي - ${orgName}`;

  const SLIDE_W = 13.333;
  const SLIDE_H = 7.5;

  // ===== Cover =====
  const cover = pres.addSlide();
  cover.background = { color: NAVY_DARK };
  cover.addShape("rect", { x: 0, y: 0, w: SLIDE_W, h: 0.25, fill: { color: GOLD } });
  cover.addShape("rect", { x: 0, y: SLIDE_H - 0.25, w: SLIDE_W, h: 0.25, fill: { color: GOLD } });

  cover.addText("تقرير الأداء التنفيذي", {
    x: 0.6, y: 2.1, w: SLIDE_W - 1.2, h: 1.0,
    fontFace: "Cairo", fontSize: 48, bold: true, color: WHITE, align: "right", rtlMode: true,
  });
  cover.addText(orgName, {
    x: 0.6, y: 3.2, w: SLIDE_W - 1.2, h: 0.7,
    fontFace: "Cairo", fontSize: 30, color: GOLD, align: "right", rtlMode: true,
  });
  cover.addText(`الفترة: ${periodLabel}`, {
    x: 0.6, y: 4.0, w: SLIDE_W - 1.2, h: 0.5,
    fontFace: "Cairo", fontSize: 18, color: ICE, align: "right", rtlMode: true,
  });
  if (report.overall_verdict) {
    cover.addShape("roundRect", {
      x: SLIDE_W - 3.6, y: 5.2, w: 3.0, h: 0.9,
      fill: { color: GOLD }, line: { color: GOLD, width: 0 }, rectRadius: 0.12,
    });
    cover.addText(`التقييم العام: ${report.overall_verdict}`, {
      x: SLIDE_W - 3.6, y: 5.2, w: 3.0, h: 0.9,
      fontFace: "Cairo", fontSize: 18, bold: true, color: NAVY_DARK, align: "center", valign: "middle", rtlMode: true,
    });
  }
  cover.addText(new Date().toLocaleDateString("ar-SA"), {
    x: 0.6, y: SLIDE_H - 0.9, w: SLIDE_W - 1.2, h: 0.4,
    fontFace: "Cairo", fontSize: 12, color: ICE, align: "right", rtlMode: true,
  });

  // ===== Executive summary =====
  const sum = pres.addSlide();
  sum.background = { color: WHITE };
  drawHeader(sum, "الملخص التنفيذي", SLIDE_W);
  sum.addShape("roundRect", {
    x: 0.6, y: 1.5, w: SLIDE_W - 1.2, h: 4.8,
    fill: { color: ICE }, line: { color: NAVY, width: 0.5 }, rectRadius: 0.15,
  });
  sum.addText(report.executive_summary || "—", {
    x: 0.9, y: 1.8, w: SLIDE_W - 1.8, h: 4.2,
    fontFace: "Cairo", fontSize: 18, color: TEXT, align: "right", valign: "top",
    rtlMode: true, paraSpaceAfter: 8,
  });
  drawFooter(sum, orgName, periodLabel, SLIDE_W, SLIDE_H);

  // ===== Section slides (two-column table: result | analysis) =====
  for (const section of report.sections || []) {
    // chunk rows so they fit (max 5 per slide)
    const chunkSize = 5;
    for (let i = 0; i < section.rows.length; i += chunkSize) {
      const chunk = section.rows.slice(i, i + chunkSize);
      const slide = pres.addSlide();
      slide.background = { color: WHITE };
      const titleSuffix = section.rows.length > chunkSize ? ` (${Math.floor(i / chunkSize) + 1}/${Math.ceil(section.rows.length / chunkSize)})` : "";
      drawHeader(slide, section.title + titleSuffix, SLIDE_W);

      // Table header row (RTL: rightmost = المؤشر, then النتيجة, then التحليل)
      // We want: right column = "النتيجة / الواقع", left column = "التحليل والتوجيه"
      // Plus a small "المؤشر" label column on the far right.
      const tableTop = 1.55;
      const tableLeft = 0.5;
      const tableW = SLIDE_W - 1.0;

      const colMetricW = 2.3;
      const colResultW = 3.6;
      const colAnalysisW = tableW - colMetricW - colResultW;

      // RTL order: metric (rightmost), result (middle), analysis (leftmost)
      const rows: any[] = [
        [
          { text: "المؤشر", options: headerCell(colMetricW) },
          { text: "النتيجة / الواقع", options: headerCell(colResultW) },
          { text: "التحليل والتوجيه", options: headerCell(colAnalysisW) },
        ],
        ...chunk.map((r, idx) => [
          {
            text: r.metric,
            options: bodyCell(colMetricW, idx % 2 === 0, true),
          },
          {
            text: r.result,
            options: { ...bodyCell(colResultW, idx % 2 === 0, false), bold: true, color: NAVY },
          },
          {
            text: r.analysis,
            options: bodyCell(colAnalysisW, idx % 2 === 0, false),
          },
        ]),
      ];

      slide.addTable(rows, {
        x: tableLeft,
        y: tableTop,
        w: tableW,
        colW: [colMetricW, colResultW, colAnalysisW],
        border: { type: "solid", pt: 0.5, color: "D6DBE5" },
        rowH: 0.9,
      });

      drawFooter(slide, orgName, periodLabel, SLIDE_W, SLIDE_H);
    }
  }

  // ===== Strategic recommendations =====
  if (report.strategic_recommendations && report.strategic_recommendations.length) {
    const rec = pres.addSlide();
    rec.background = { color: NAVY_DARK };
    rec.addText("التوصيات الاستراتيجية", {
      x: 0.6, y: 0.5, w: SLIDE_W - 1.2, h: 0.8,
      fontFace: "Cairo", fontSize: 32, bold: true, color: GOLD, align: "right", rtlMode: true,
    });
    rec.addShape("rect", { x: SLIDE_W - 0.6, y: 1.3, w: 0.08, h: 5.4, fill: { color: GOLD } });

    const items = report.strategic_recommendations;
    const startY = 1.6;
    const cellH = Math.min(1.0, 5.4 / items.length);
    items.forEach((r, i) => {
      const y = startY + i * (cellH + 0.15);
      // number circle
      rec.addShape("ellipse", {
        x: SLIDE_W - 1.4, y: y + 0.1, w: 0.6, h: 0.6,
        fill: { color: GOLD }, line: { color: GOLD, width: 0 },
      });
      rec.addText(String(i + 1), {
        x: SLIDE_W - 1.4, y: y + 0.1, w: 0.6, h: 0.6,
        fontFace: "Cairo", fontSize: 18, bold: true, color: NAVY_DARK, align: "center", valign: "middle",
      });
      rec.addText(r, {
        x: 0.7, y, w: SLIDE_W - 2.3, h: cellH,
        fontFace: "Cairo", fontSize: 16, color: WHITE, align: "right", valign: "middle", rtlMode: true,
      });
    });
  }

  const safeName = orgName.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, "_");
  await pres.writeFile({ fileName: `تقرير_تنفيذي_${safeName}.pptx` });
}

function drawHeader(slide: pptxgen.Slide, title: string, slideW: number) {
  slide.addShape("rect", { x: 0, y: 0, w: slideW, h: 1.05, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
  slide.addShape("rect", { x: 0, y: 1.05, w: slideW, h: 0.08, fill: { color: GOLD }, line: { color: GOLD, width: 0 } });
  slide.addText(title, {
    x: 0.6, y: 0.15, w: slideW - 1.2, h: 0.8,
    fontFace: "Cairo", fontSize: 26, bold: true, color: WHITE, align: "right", valign: "middle", rtlMode: true,
  });
}

function drawFooter(slide: pptxgen.Slide, org: string, period: string, w: number, h: number) {
  slide.addText(`${org}  ·  ${period}`, {
    x: 0.5, y: h - 0.4, w: w - 1.0, h: 0.3,
    fontFace: "Cairo", fontSize: 10, color: MUTED, align: "right", rtlMode: true,
  });
}

function headerCell(w: number): any {
  return {
    fontFace: "Cairo", fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle",
    fill: { color: NAVY }, rtlMode: true, w,
  };
}

function bodyCell(w: number, alt: boolean, isMetric: boolean): any {
  return {
    fontFace: "Cairo", fontSize: 12, color: TEXT, align: "right", valign: "middle",
    fill: { color: alt ? "F7F9FC" : WHITE }, rtlMode: true, w,
    bold: isMetric,
  };
}