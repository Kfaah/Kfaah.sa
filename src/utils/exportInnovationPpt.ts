import pptxgen from "pptxgenjs";

interface InnovationItem {
  title: string;
  summary: string;
  category: string;
  area?: string | null;
  priority?: string;
  impact?: string | null;
  effort?: string | null;
  status?: string;
  data_basis?: any;
}

const CATEGORY_LABEL: Record<string, string> = {
  content: "محتوى ومقالات",
  analytics: "تحليل ذكي",
  feature: "ميزة جديدة",
  ux: "تجربة استخدام",
  automation: "أتمتة وعمليات",
  growth: "نمو وشراكات",
  data: "بيانات وحوكمة",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "عالية", medium: "متوسطة", low: "منخفضة",
};

// Midnight Executive palette
const NAVY = "1E2761";
const GOLD = "D4AF37";
const ICE = "CADCFC";
const WHITE = "FFFFFF";
const SOFT = "F4F6FB";
const TEXT = "1A1F36";
const MUTED = "5A6376";

export function exportInnovationPpt(items: InnovationItem[], orgName: string) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.rtlMode = true;
  pptx.title = `خطة الابتكار - ${orgName}`;
  pptx.author = "منصة الجمعيات";

  // ---------- Cover ----------
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  // Decorative gold band
  cover.addShape("rect", { x: 0, y: 6.6, w: 13.33, h: 0.15, fill: { color: GOLD } });
  cover.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.15, fill: { color: GOLD } });

  cover.addText("خطة الابتكار والتجديد", {
    x: 0.6, y: 2.0, w: 12.1, h: 1.0,
    fontSize: 54, bold: true, color: WHITE, align: "right", fontFace: "Cairo",
  });
  cover.addText(orgName, {
    x: 0.6, y: 3.1, w: 12.1, h: 0.7,
    fontSize: 30, color: ICE, align: "right", fontFace: "Cairo",
  });

  cover.addShape("roundRect", {
    x: 9.5, y: 4.5, w: 3.2, h: 1.0,
    fill: { color: GOLD }, line: { color: GOLD },
    rectRadius: 0.1,
  });
  cover.addText(`${items.length} فكرة معتمدة`, {
    x: 9.5, y: 4.5, w: 3.2, h: 1.0,
    fontSize: 22, bold: true, color: NAVY, align: "center", valign: "middle", fontFace: "Cairo",
  });

  cover.addText(
    `أُعدّت في ${new Date().toLocaleDateString("ar-SA")}`,
    { x: 0.6, y: 6.85, w: 12.1, h: 0.4, fontSize: 12, color: ICE, align: "right", fontFace: "Cairo" },
  );

  // ---------- Summary ----------
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
  items.forEach((i) => {
    const c = i.category || "feature";
    byCategory[c] = (byCategory[c] || 0) + 1;
    if (i.priority) byPriority[i.priority] = (byPriority[i.priority] || 0) + 1;
  });

  const sum = pptx.addSlide();
  sum.background = { color: SOFT };
  sum.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: NAVY } });
  sum.addText("نظرة عامة على الأفكار", {
    x: 0.6, y: 0.05, w: 12.1, h: 0.5,
    fontSize: 22, bold: true, color: WHITE, align: "right", fontFace: "Cairo",
  });

  // Stat tiles
  const tiles = [
    { label: "إجمالي الأفكار", value: String(items.length), color: NAVY },
    { label: "أولوية عالية", value: String(byPriority.high || 0), color: "C0392B" },
    { label: "متوسطة", value: String(byPriority.medium || 0), color: "B7791F" },
    { label: "منخفضة", value: String(byPriority.low || 0), color: "2E7D5B" },
  ];
  tiles.forEach((t, i) => {
    const x = 0.6 + i * 3.05;
    sum.addShape("roundRect", {
      x, y: 1.0, w: 2.85, h: 1.6,
      fill: { color: WHITE }, line: { color: ICE, width: 1 }, rectRadius: 0.12,
    });
    sum.addText(t.value, {
      x, y: 1.05, w: 2.85, h: 0.95,
      fontSize: 44, bold: true, color: t.color, align: "center", valign: "middle", fontFace: "Cairo",
    });
    sum.addText(t.label, {
      x, y: 1.95, w: 2.85, h: 0.55,
      fontSize: 14, color: MUTED, align: "center", fontFace: "Cairo",
    });
  });

  // Category breakdown
  sum.addText("التوزيع حسب التصنيف", {
    x: 0.6, y: 2.95, w: 12.1, h: 0.45,
    fontSize: 18, bold: true, color: NAVY, align: "right", fontFace: "Cairo",
  });
  const catRows = Object.entries(byCategory);
  catRows.forEach(([c, n], i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 0.6 + col * 4.1;
    const y = 3.5 + row * 0.7;
    sum.addShape("roundRect", {
      x, y, w: 3.95, h: 0.6,
      fill: { color: WHITE }, line: { color: ICE, width: 1 }, rectRadius: 0.08,
    });
    sum.addText(`${CATEGORY_LABEL[c] || c}`, {
      x: x + 0.2, y, w: 3.0, h: 0.6,
      fontSize: 13, color: TEXT, align: "right", valign: "middle", fontFace: "Cairo",
    });
    sum.addText(`${n}`, {
      x: x + 0.2, y, w: 3.55, h: 0.6,
      fontSize: 16, bold: true, color: GOLD, align: "left", valign: "middle", fontFace: "Cairo",
    });
  });

  // ---------- One slide per idea ----------
  items.forEach((it, idx) => {
    const s = pptx.addSlide();
    s.background = { color: SOFT };

    // Top navy band with index
    s.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.85, fill: { color: NAVY } });
    s.addText(`فكرة ${idx + 1} من ${items.length}`, {
      x: 0.4, y: 0.2, w: 4, h: 0.5, fontSize: 14, color: ICE, align: "left", fontFace: "Cairo",
    });
    s.addText(CATEGORY_LABEL[it.category] || it.category, {
      x: 7.5, y: 0.2, w: 5.4, h: 0.5,
      fontSize: 14, bold: true, color: GOLD, align: "right", fontFace: "Cairo",
    });

    // Title
    s.addText(it.title, {
      x: 0.5, y: 1.05, w: 12.3, h: 0.85,
      fontSize: 28, bold: true, color: NAVY, align: "right", fontFace: "Cairo",
    });

    // Meta chips
    const chips: { label: string; color: string }[] = [];
    if (it.priority) chips.push({ label: `أولوية: ${PRIORITY_LABEL[it.priority] || it.priority}`, color: it.priority === "high" ? "C0392B" : it.priority === "medium" ? "B7791F" : "2E7D5B" });
    if (it.effort) chips.push({ label: `جهد: ${PRIORITY_LABEL[it.effort] || it.effort}`, color: NAVY });
    if (it.area) chips.push({ label: it.area, color: MUTED });

    chips.forEach((ch, i) => {
      const w = 2.4;
      const x = 12.8 - (i + 1) * (w + 0.15);
      s.addShape("roundRect", {
        x, y: 1.95, w, h: 0.45,
        fill: { color: WHITE }, line: { color: ch.color, width: 1 }, rectRadius: 0.22,
      });
      s.addText(ch.label, {
        x, y: 1.95, w, h: 0.45,
        fontSize: 11, bold: true, color: ch.color, align: "center", valign: "middle", fontFace: "Cairo",
      });
    });

    // Summary box
    s.addShape("roundRect", {
      x: 0.5, y: 2.6, w: 12.3, h: 2.2,
      fill: { color: WHITE }, line: { color: ICE, width: 1 }, rectRadius: 0.1,
    });
    s.addText("الفكرة", {
      x: 0.7, y: 2.7, w: 11.9, h: 0.4,
      fontSize: 14, bold: true, color: GOLD, align: "right", fontFace: "Cairo",
    });
    s.addText(it.summary, {
      x: 0.7, y: 3.1, w: 11.9, h: 1.6,
      fontSize: 14, color: TEXT, align: "right", valign: "top", fontFace: "Cairo",
    });

    // Impact box
    if (it.impact) {
      s.addShape("roundRect", {
        x: 0.5, y: 5.0, w: 12.3, h: 1.2,
        fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.1,
      });
      s.addText("الأثر المتوقع", {
        x: 0.7, y: 5.05, w: 11.9, h: 0.4,
        fontSize: 13, bold: true, color: GOLD, align: "right", fontFace: "Cairo",
      });
      s.addText(it.impact, {
        x: 0.7, y: 5.45, w: 11.9, h: 0.7,
        fontSize: 13, color: ICE, align: "right", valign: "top", fontFace: "Cairo",
      });
    }

    // Footer
    s.addShape("rect", { x: 0, y: 7.3, w: 13.33, h: 0.2, fill: { color: GOLD } });
    s.addText(orgName, {
      x: 0.4, y: 6.9, w: 12.5, h: 0.3,
      fontSize: 10, color: MUTED, align: "right", fontFace: "Cairo",
    });
  });

  const safeName = orgName.replace(/[^\p{L}\p{N}_-]+/gu, "_");
  pptx.writeFile({ fileName: `خطة_الابتكار_${safeName}.pptx` });
}