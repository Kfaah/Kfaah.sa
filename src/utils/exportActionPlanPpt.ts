import type PptxGenJSType from "pptxgenjs";

type SubTask = {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
  status?: string;
  assigned_employee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  deliverable?: { type: string; title: string; content: string } | null;
  attachment_url?: string | null;
  rating?: number | null;
};

type Plan = {
  title: string;
  description: string | null;
  org_name?: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
};

type Task = {
  title: string;
  description: string | null;
  impact: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  assigned_employee_id: string | null;
  completion_notes: string | null;
  subtasks: SubTask[] | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "منجزة",
  blocked: "متعثرة",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "أثر عالٍ",
  medium: "أثر متوسط",
  low: "أثر منخفض",
};

// Brand palette — dark navy + gold accent (professional, executive feel)
const COLORS = {
  bgDark: "0F1E3D",
  bgDarker: "081229",
  primary: "1E3A8A",
  accent: "D4AF37", // gold
  accentSoft: "F5E6A8",
  white: "FFFFFF",
  muted: "94A3B8",
  light: "F8FAFC",
  card: "1E293B",
  cardBorder: "334155",
  success: "10B981",
  warning: "F59E0B",
  danger: "EF4444",
};

const fmtDate = (v: string | null | undefined) => v || "—";

function addFooter(slide: any, pageNumber: number, totalPages: number, planTitle: string) {
  slide.addShape("rect", {
    x: 0, y: 7.2, w: 13.333, h: 0.3,
    fill: { color: COLORS.bgDarker }, line: { color: COLORS.bgDarker },
  });
  slide.addText(planTitle, {
    x: 0.4, y: 7.2, w: 8, h: 0.3,
    fontSize: 9, color: COLORS.muted, fontFace: "Calibri",
    align: "right", valign: "middle", rtlMode: true,
  });
  slide.addText(`${pageNumber} / ${totalPages}`, {
    x: 12, y: 7.2, w: 1, h: 0.3,
    fontSize: 9, color: COLORS.accent, fontFace: "Calibri",
    align: "left", valign: "middle", bold: true,
  });
}

function addHeaderBar(slide: any, title: string, subtitle?: string) {
  // top accent bar
  slide.addShape("rect", {
    x: 0, y: 0, w: 13.333, h: 0.12,
    fill: { color: COLORS.accent }, line: { color: COLORS.accent },
  });
  // header band
  slide.addShape("rect", {
    x: 0, y: 0.12, w: 13.333, h: 0.95,
    fill: { color: COLORS.bgDark }, line: { color: COLORS.bgDark },
  });
  slide.addText(title, {
    x: 0.4, y: 0.18, w: 12.5, h: 0.55,
    fontSize: 24, bold: true, color: COLORS.white,
    fontFace: "Calibri", align: "right", valign: "middle", rtlMode: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.7, w: 12.5, h: 0.35,
      fontSize: 12, color: COLORS.accent,
      fontFace: "Calibri", align: "right", valign: "middle", rtlMode: true,
    });
  }
}

export async function exportActionPlanPpt({
  plan,
  tasks,
  employees,
  orgLogoUrl,
}: {
  plan: Plan;
  tasks: Task[];
  employees: { id: string; full_name: string; job_role: string }[];
  orgLogoUrl?: string | null;
}) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx: PptxGenJSType = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.rtlMode = true;
  pptx.title = plan.title;
  pptx.company = plan.org_name || "";
  pptx.author = plan.org_name || "Action Plan";

  const employeeNameById = new Map(employees.map((e) => [e.id, e.full_name]));

  const totalSubtasks = tasks.reduce((s, t) => s + (t.subtasks?.length || 0), 0);
  const doneTasks = tasks.filter((t) => t.status === "completed").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;

  // Estimate total slides: cover + agenda + summary + (1 per main task) + closing
  const totalSlides = 3 + tasks.length + 1;
  let pageNum = 0;

  // ========== SLIDE 1: COVER ==========
  {
    const s = pptx.addSlide();
    pageNum++;
    s.background = { color: COLORS.bgDark };
    // Decorative accent shapes
    s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: COLORS.accent }, line: { color: COLORS.accent } });
    s.addShape("rect", { x: 0, y: 7.32, w: 13.333, h: 0.18, fill: { color: COLORS.accent }, line: { color: COLORS.accent } });
    // Diagonal/triangle accent (using shape)
    s.addShape("rect", { x: 11.5, y: 0.5, w: 1.5, h: 1.5, fill: { color: COLORS.accent, transparency: 80 }, line: { type: "none" }, rotate: 45 });
    s.addShape("rect", { x: 0.3, y: 5.5, w: 1.5, h: 1.5, fill: { color: COLORS.primary, transparency: 60 }, line: { type: "none" }, rotate: 45 });

    // Logo (top right)
    if (orgLogoUrl) {
      try {
        s.addImage({ path: orgLogoUrl, x: 11.5, y: 0.5, w: 1.4, h: 1.4 });
      } catch {
        // ignore logo errors
      }
    }

    // Org name
    s.addText(plan.org_name || "", {
      x: 0.5, y: 1.8, w: 12.333, h: 0.5,
      fontSize: 18, color: COLORS.accent, fontFace: "Calibri",
      align: "center", bold: true, rtlMode: true,
    });
    // Eyebrow
    s.addText("خطة عمل تنفيذية", {
      x: 0.5, y: 2.4, w: 12.333, h: 0.5,
      fontSize: 14, color: COLORS.muted, fontFace: "Calibri",
      align: "center", rtlMode: true,
    });
    // Title
    s.addText(plan.title, {
      x: 0.5, y: 3.0, w: 12.333, h: 1.5,
      fontSize: 44, bold: true, color: COLORS.white, fontFace: "Calibri",
      align: "center", valign: "middle", rtlMode: true,
    });
    // Underline accent
    s.addShape("rect", {
      x: 5.667, y: 4.6, w: 2, h: 0.06,
      fill: { color: COLORS.accent }, line: { color: COLORS.accent },
    });
    // Description
    if (plan.description) {
      s.addText(plan.description, {
        x: 1.5, y: 4.85, w: 10.333, h: 1.2,
        fontSize: 14, color: COLORS.light, fontFace: "Calibri",
        align: "center", valign: "top", rtlMode: true, italic: true,
      });
    }
    // Period
    s.addText(`الفترة: ${fmtDate(plan.start_date)}  →  ${fmtDate(plan.end_date)}`, {
      x: 0.5, y: 6.4, w: 12.333, h: 0.4,
      fontSize: 13, color: COLORS.accentSoft, fontFace: "Calibri",
      align: "center", rtlMode: true,
    });
  }

  // ========== SLIDE 2: AGENDA / EXECUTIVE SUMMARY ==========
  {
    const s = pptx.addSlide();
    pageNum++;
    s.background = { color: COLORS.light };
    addHeaderBar(s, "الملخص التنفيذي", "نظرة عامة على الخطة وأبرز مؤشراتها");

    // KPI cards row — reversed so first KPI sits on the right (RTL reading order)
    const kpisLTR = [
      { label: "المهام الرئيسية", value: String(tasks.length), color: COLORS.primary },
      { label: "المهام التنفيذية", value: String(totalSubtasks), color: COLORS.accent },
      { label: "نسبة الإنجاز", value: `${Math.round(plan.progress || 0)}%`, color: COLORS.success },
      { label: "قيد التنفيذ", value: String(inProgressTasks), color: COLORS.warning },
    ];
    const kpis = [...kpisLTR].reverse();
    const cardW = 2.95, cardH = 1.6, gap = 0.2;
    const startX = (13.333 - (cardW * 4 + gap * 3)) / 2;
    kpis.forEach((k, i) => {
      const x = startX + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.4, w: cardW, h: cardH,
        fill: { color: COLORS.white }, line: { color: COLORS.cardBorder, width: 0.5 },
        rectRadius: 0.1,
      });
      // Top accent stripe
      s.addShape("rect", {
        x, y: 1.4, w: cardW, h: 0.12,
        fill: { color: k.color }, line: { color: k.color },
      });
      s.addText(k.value, {
        x, y: 1.65, w: cardW, h: 0.85,
        fontSize: 36, bold: true, color: k.color, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
      s.addText(k.label, {
        x, y: 2.5, w: cardW, h: 0.45,
        fontSize: 13, color: COLORS.bgDark, fontFace: "Calibri",
        align: "center", valign: "middle", rtlMode: true,
      });
    });

    // Description block
    if (plan.description) {
      s.addShape("roundRect", {
        x: 0.5, y: 3.3, w: 12.333, h: 2.0,
        fill: { color: COLORS.white }, line: { color: COLORS.cardBorder, width: 0.5 },
        rectRadius: 0.08,
      });
      s.addText("وصف الخطة", {
        x: 0.7, y: 3.4, w: 11.933, h: 0.4,
        fontSize: 14, bold: true, color: COLORS.accent, fontFace: "Calibri",
        align: "right", rtlMode: true,
      });
      s.addText(plan.description, {
        x: 0.7, y: 3.85, w: 11.933, h: 1.4,
        fontSize: 12, color: COLORS.bgDark, fontFace: "Calibri",
        align: "right", valign: "top", rtlMode: true,
      });
    }

    // Status bar
    s.addShape("roundRect", {
      x: 0.5, y: 5.5, w: 12.333, h: 1.5,
      fill: { color: COLORS.white }, line: { color: COLORS.cardBorder, width: 0.5 },
      rectRadius: 0.08,
    });
    s.addText("توزيع حالات المهام الرئيسية", {
      x: 0.7, y: 5.6, w: 11.933, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.accent, fontFace: "Calibri",
      align: "right", rtlMode: true,
    });
    const statuses = [
      { label: "منجزة", value: doneTasks, color: COLORS.success },
      { label: "قيد التنفيذ", value: inProgressTasks, color: COLORS.warning },
      { label: "قيد الانتظار", value: pendingTasks, color: COLORS.muted },
    ];
    const total = Math.max(1, tasks.length);
    let cursor = 0.7;
    const totalWidth = 11.933;
    statuses.forEach((st) => {
      const w = (st.value / total) * totalWidth;
      if (w <= 0) return;
      s.addShape("rect", {
        x: cursor, y: 6.1, w, h: 0.5,
        fill: { color: st.color }, line: { type: "none" },
      });
      if (w > 1.2) {
        s.addText(`${st.label} (${st.value})`, {
          x: cursor, y: 6.1, w, h: 0.5,
          fontSize: 11, bold: true, color: COLORS.white, fontFace: "Calibri",
          align: "center", valign: "middle", rtlMode: true,
        });
      }
      cursor += w;
    });
    addFooter(s, pageNum, totalSlides, plan.title);
  }

  // ========== SLIDE 3: AGENDA OF TASKS ==========
  {
    const s = pptx.addSlide();
    pageNum++;
    s.background = { color: COLORS.light };
    addHeaderBar(s, "أجندة المهام الرئيسية", `${tasks.length} هدف رئيسي`);

    // Two-column list
    const perCol = Math.ceil(tasks.length / 2);
    const colW = 6.2;
    tasks.forEach((t, i) => {
      const col = i < perCol ? 0 : 1;
      const row = i % perCol;
      const x = col === 0 ? 0.5 : 6.7;
      const y = 1.3 + row * 0.55;
      if (y > 7.0) return; // safety
      // number badge
      s.addShape("ellipse", {
        x: x + colW - 0.45, y, w: 0.4, h: 0.4,
        fill: { color: COLORS.accent }, line: { color: COLORS.accent },
      });
      s.addText(String(i + 1), {
        x: x + colW - 0.45, y, w: 0.4, h: 0.4,
        fontSize: 13, bold: true, color: COLORS.bgDark, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
      s.addText(t.title, {
        x, y, w: colW - 0.55, h: 0.4,
        fontSize: 13, color: COLORS.bgDark, fontFace: "Calibri",
        align: "right", valign: "middle", rtlMode: true,
      });
    });
    addFooter(s, pageNum, totalSlides, plan.title);
  }

  // ========== ONE SLIDE PER MAIN TASK ==========
  tasks.forEach((task, ti) => {
    const s = pptx.addSlide();
    pageNum++;
    s.background = { color: COLORS.light };
    addHeaderBar(s, `${ti + 1}. ${task.title}`, IMPACT_LABEL[task.impact] || task.impact);

    const assignee = task.assigned_employee_id
      ? employeeNameById.get(task.assigned_employee_id) || "—"
      : "غير مكلّف";

    // Info pills row — reversed so first pill (المكلف) sits on the right (RTL)
    const pillsLTR = [
      { label: "المكلف", value: assignee, color: COLORS.primary },
      { label: "الفترة", value: `${fmtDate(task.start_date)} → ${fmtDate(task.due_date)}`, color: COLORS.accent },
      { label: "الحالة", value: STATUS_LABEL[task.status] || task.status, color: COLORS.success },
    ];
    const pills = [...pillsLTR].reverse();
    const pillW = 4.05, pillH = 0.7;
    pills.forEach((p, i) => {
      const x = 0.5 + i * (pillW + 0.15);
      s.addShape("roundRect", {
        x, y: 1.25, w: pillW, h: pillH,
        fill: { color: COLORS.white }, line: { color: p.color, width: 1 },
        rectRadius: 0.08,
      });
      s.addText(p.label, {
        x: x + 0.15, y: 1.28, w: pillW - 0.3, h: 0.3,
        fontSize: 10, color: p.color, bold: true, fontFace: "Calibri",
        align: "right", valign: "top", rtlMode: true,
      });
      s.addText(p.value, {
        x: x + 0.15, y: 1.55, w: pillW - 0.3, h: 0.35,
        fontSize: 12, color: COLORS.bgDark, fontFace: "Calibri",
        align: "right", valign: "top", rtlMode: true,
      });
    });

    // Description card
    if (task.description) {
      s.addShape("roundRect", {
        x: 0.5, y: 2.1, w: 12.333, h: 1.0,
        fill: { color: COLORS.white }, line: { color: COLORS.cardBorder, width: 0.5 },
        rectRadius: 0.08,
      });
      s.addText(task.description, {
        x: 0.7, y: 2.2, w: 11.933, h: 0.8,
        fontSize: 11, color: COLORS.bgDark, fontFace: "Calibri",
        align: "right", valign: "middle", rtlMode: true, italic: true,
      });
    }

    // Subtasks table
    const subtasks = task.subtasks || [];
    // RTL: build columns in left→right visual order, then reverse so the first
    // logical column (#) appears on the RIGHT side (Arabic reading direction).
    const headerRowLTR = [
      { text: "#", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "center", valign: "middle", fontSize: 11, fontFace: "Calibri" } },
      { text: "المهمة التنفيذية", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "right", valign: "middle", fontSize: 11, fontFace: "Calibri", rtlMode: true } },
      { text: "المكلف", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "right", valign: "middle", fontSize: 11, fontFace: "Calibri", rtlMode: true } },
      { text: "المدة", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "center", valign: "middle", fontSize: 11, fontFace: "Calibri" } },
      { text: "الحالة", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "center", valign: "middle", fontSize: 11, fontFace: "Calibri" } },
      { text: "المخرج / المادة الداعمة", options: { bold: true, color: COLORS.white, fill: { color: COLORS.bgDark }, align: "right", valign: "middle", fontSize: 11, fontFace: "Calibri", rtlMode: true } },
    ];
    const headerRow = [...headerRowLTR].reverse();

    const bodyRowsLTR = subtasks.length
      ? subtasks.map((sub, si) => {
          const subAssignee = sub.assigned_employee_id
            ? employeeNameById.get(sub.assigned_employee_id) || assignee
            : assignee;
          const status = STATUS_LABEL[sub.status || (sub.done ? "completed" : task.status)] || task.status;
          const deliverable = sub.deliverable
            ? sub.deliverable.title + (sub.attachment_url ? " (مرفق)" : "")
            : sub.attachment_url ? "مرفق متاح" : "—";
          const fillColor = si % 2 === 0 ? COLORS.white : "F1F5F9";
          const cellOpts = { fill: { color: fillColor }, color: COLORS.bgDark, fontSize: 10, fontFace: "Calibri", valign: "middle" as const };
          return [
            { text: `${ti + 1}.${si + 1}`, options: { ...cellOpts, align: "center" as const, bold: true, color: COLORS.accent } },
            { text: sub.title, options: { ...cellOpts, align: "right" as const, rtlMode: true, bold: true } },
            { text: subAssignee, options: { ...cellOpts, align: "right" as const, rtlMode: true } },
            { text: `${sub.duration_days} يوم`, options: { ...cellOpts, align: "center" as const } },
            { text: status, options: { ...cellOpts, align: "center" as const } },
            { text: deliverable, options: { ...cellOpts, align: "right" as const, rtlMode: true } },
          ];
        })
      : [[
          { text: "—", options: { color: COLORS.muted, align: "center" as const, fontSize: 11, fontFace: "Calibri" } },
          { text: "لا توجد مهام تنفيذية مفصّلة", options: { color: COLORS.muted, align: "right" as const, fontSize: 11, fontFace: "Calibri", rtlMode: true, colspan: 5 } },
        ]];
    const bodyRows = bodyRowsLTR.map((row) => [...row].reverse());

    s.addTable([headerRow as any, ...bodyRows as any], {
      x: 0.5,
      y: task.description ? 3.25 : 2.15,
      w: 12.333,
      // Column widths must mirror the reversed visual order
      colW: [3.433, 1.4, 0.9, 1.9, 4.0, 0.7],
      rowH: 0.42,
      border: { type: "solid", pt: 0.5, color: COLORS.cardBorder },
      fontSize: 10,
      fontFace: "Calibri",
      autoPage: false,
    });

    addFooter(s, pageNum, totalSlides, plan.title);
  });

  // ========== CLOSING SLIDE ==========
  {
    const s = pptx.addSlide();
    pageNum++;
    s.background = { color: COLORS.bgDark };
    s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: COLORS.accent }, line: { color: COLORS.accent } });
    s.addShape("rect", { x: 0, y: 7.32, w: 13.333, h: 0.18, fill: { color: COLORS.accent }, line: { color: COLORS.accent } });

    s.addText("شكراً لكم", {
      x: 0.5, y: 2.5, w: 12.333, h: 1.2,
      fontSize: 60, bold: true, color: COLORS.white, fontFace: "Calibri",
      align: "center", valign: "middle", rtlMode: true,
    });
    s.addShape("rect", {
      x: 5.667, y: 3.85, w: 2, h: 0.08,
      fill: { color: COLORS.accent }, line: { color: COLORS.accent },
    });
    s.addText("نحو تنفيذ ناجح ومستدام", {
      x: 0.5, y: 4.1, w: 12.333, h: 0.6,
      fontSize: 20, color: COLORS.accentSoft, fontFace: "Calibri",
      align: "center", italic: true, rtlMode: true,
    });
    s.addText(plan.org_name || "", {
      x: 0.5, y: 5.3, w: 12.333, h: 0.5,
      fontSize: 16, color: COLORS.muted, fontFace: "Calibri",
      align: "center", rtlMode: true,
    });
  }

  const fileName = `${(plan.title || "action-plan").replace(/[\\/:*?"<>|]/g, "-")}.pptx`;
  await pptx.writeFile({ fileName });
}