// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PptxGenJS from "npm:pptxgenjs@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OrgMetrics = {
  org_id: string;
  org_name: string;
  total_donated: number;
  donations_count: number;
  avg_donation: number;
  donors: number;
  recurring_donors: number;
  abandoned_carts: number;
  recovered_carts: number;
  recovery_rate: number;
  bank_transfers: number;
  matched_transfers: number;
  employees_count: number;
  tasks_total: number;
  tasks_completed: number;
  task_completion_rate: number;
  campaigns: number;
  fundraising_score: number;
  donor_engagement_score: number;
  service_score: number;
  team_score: number;
  overall_score: number;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const PPT = {
  bgDark: "0F1E3D",
  bgDarker: "081229",
  primary: "1E3A8A",
  accent: "D4AF37",
  accentSoft: "F5E6A8",
  white: "FFFFFF",
  muted: "94A3B8",
  light: "F8FAFC",
  border: "CBD5E1",
  rowAlt: "F8FAFC",
};

function safeName(value: string, fallback = "file") {
  const cleaned = (value || fallback)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
  return cleaned || fallback;
}

function splitLines(content: string) {
  return String(content || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function uploadPptBuffer(
  admin: any,
  organization_id: string,
  planId: string,
  fileName: string,
  buffer: Uint8Array,
): Promise<{ url: string; name: string } | null> {
  const path = `${organization_id}/${planId}/${fileName}`;
  const { error: upErr } = await admin.storage
    .from("action-plan-files")
    .upload(path, buffer, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  if (upErr) {
    console.error("PowerPoint upload failed:", upErr);
    return null;
  }
  const { data: pub } = admin.storage.from("action-plan-files").getPublicUrl(path);
  return { url: pub.publicUrl, name: fileName };
}

function addPptHeader(slide: any, title: string, subtitle?: string) {
  slide.background = { color: PPT.light };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.16, fill: { color: PPT.accent }, line: { color: PPT.accent } });
  slide.addShape("rect", { x: 0, y: 0.16, w: 13.333, h: 0.95, fill: { color: PPT.bgDark }, line: { color: PPT.bgDark } });
  slide.addText(title, {
    x: 0.55, y: 0.22, w: 12.2, h: 0.45,
    fontFace: "Calibri", fontSize: 23, bold: true, color: PPT.white,
    align: "right", valign: "middle", rtlMode: true,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.55, y: 0.68, w: 12.2, h: 0.22,
      fontFace: "Calibri", fontSize: 10.5, color: PPT.accentSoft,
      align: "right", valign: "middle", rtlMode: true,
    });
  }
}

function addPptFooter(slide: any, footer: string) {
  slide.addShape("rect", { x: 0, y: 7.22, w: 13.333, h: 0.28, fill: { color: PPT.bgDarker }, line: { color: PPT.bgDarker } });
  slide.addText(footer, {
    x: 0.45, y: 7.23, w: 12.4, h: 0.2,
    fontFace: "Calibri", fontSize: 9, color: PPT.muted,
    align: "right", valign: "middle", rtlMode: true,
  });
}

async function buildPowerPointSupportFile(
  admin: any,
  organization_id: string,
  planId: string,
  taskIdx: number,
  subIdx: number,
  title: string,
  subtitle: string,
  sections: Array<{ heading: string; body?: string; bullets?: string[] }>,
  table?: { headers: string[]; rows: string[][]; note?: string },
  fileLabel?: string,
): Promise<{ url: string; name: string } | null> {
  const ppt = new (PptxGenJS as any)();
  ppt.layout = "LAYOUT_WIDE";
  ppt.rtlMode = true;
  ppt.author = "Lovable";
  ppt.company = "Lovable Cloud";
  ppt.subject = subtitle;
  ppt.title = title;

  const cover = ppt.addSlide();
  cover.background = { color: PPT.bgDark };
  cover.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: PPT.accent }, line: { color: PPT.accent } });
  cover.addShape("rect", { x: 0, y: 7.32, w: 13.333, h: 0.18, fill: { color: PPT.accent }, line: { color: PPT.accent } });
  cover.addText(title, {
    x: 0.8, y: 2.0, w: 11.7, h: 1.2,
    fontFace: "Calibri", fontSize: 28, bold: true, color: PPT.white,
    align: "center", valign: "middle", rtlMode: true,
  });
  cover.addText(subtitle, {
    x: 1.2, y: 3.35, w: 10.9, h: 0.65,
    fontFace: "Calibri", fontSize: 15, color: PPT.accentSoft,
    align: "center", valign: "middle", rtlMode: true,
  });
  cover.addText("مادة داعمة تنفيذية جاهزة للاستخدام والتعديل", {
    x: 1.6, y: 4.3, w: 10.1, h: 0.45,
    fontFace: "Calibri", fontSize: 12, color: PPT.muted,
    align: "center", valign: "middle", rtlMode: true,
  });

  sections.forEach((section, idx) => {
    const slide = ppt.addSlide();
    addPptHeader(slide, title, section.heading);
    slide.addShape("roundRect", {
      x: 0.55, y: 1.35, w: 12.2, h: 5.55,
      fill: { color: PPT.white }, line: { color: PPT.border, width: 0.6 }, rectRadius: 0.06,
    });
    slide.addText(section.heading, {
      x: 0.8, y: 1.58, w: 11.7, h: 0.4,
      fontFace: "Calibri", fontSize: 18, bold: true, color: PPT.primary,
      align: "right", rtlMode: true,
    });
    if (section.body) {
      slide.addText(section.body, {
        x: 0.8, y: 2.05, w: 11.7, h: 1.05,
        fontFace: "Calibri", fontSize: 13, color: PPT.bgDark,
        align: "right", valign: "top", rtlMode: true,
        breakLine: false,
      });
    }
    const bullets = section.bullets || [];
    if (bullets.length) {
      slide.addText(
        bullets.map((bullet) => ({
          text: bullet,
          options: { bullet: { indent: 18 }, hanging: 3 },
        })),
        {
          x: 1.0, y: section.body ? 3.2 : 2.15, w: 11.2, h: 3.25,
          fontFace: "Calibri", fontSize: 15, color: PPT.bgDark,
          align: "right", valign: "top", rtlMode: true,
          paraSpaceAfterPt: 10,
        },
      );
    }
    addPptFooter(slide, `مادة داعمة ${idx + 1}/${sections.length}${table ? " + جدول مرفق" : ""}`);
  });

  if (table) {
    const slide = ppt.addSlide();
    addPptHeader(slide, title, "الجدول التنفيذي");
    slide.addTable(
      [table.headers.slice().reverse(), ...table.rows.map((row) => row.slice().reverse())],
      {
        x: 0.45,
        y: 1.35,
        w: 12.45,
        border: { type: "solid", pt: 0.5, color: PPT.border },
        fill: PPT.white,
        color: PPT.bgDark,
        fontFace: "Calibri",
        fontSize: 10.5,
        rowH: 0.36,
        autoPage: true,
      },
    );
    if (table.note) {
      slide.addText(table.note, {
        x: 0.6, y: 6.7, w: 12.0, h: 0.25,
        fontFace: "Calibri", fontSize: 9.5, color: PPT.muted,
        align: "right", rtlMode: true,
      });
    }
    addPptFooter(slide, "مرفق تنفيذي جاهز للمراجعة والاستخدام");
  }

  const buffer = await ppt.write({ outputType: "uint8array" }) as Uint8Array;
  const fileName = `${safeName(fileLabel || title)}-${planId}-${taskIdx}-${subIdx}.pptx`;
  return await uploadPptBuffer(admin, organization_id, planId, fileName, buffer);
}

async function buildDonorListFile(
  admin: any,
  organization_id: string,
  segmentDescription: string,
  planId: string,
  taskIdx: number,
  subIdx: number,
): Promise<{ url: string; name: string; count: number } | null> {
  const desc = (segmentDescription || "").toLowerCase();
  if (/جهة|جهات|محتمل|prospect|شركة|شركات|راعٍ|رعاة|sponsor|corporate|قطاع\s*خاص/.test(desc)) {
    return await buildProspectListFile(admin, organization_id, planId, taskIdx, subIdx);
  }

  let query = admin
    .from("donors")
    .select("full_name, phone, email, city, total_donated, donations_count, last_donation_at, segment, notes")
    .eq("organization_id", organization_id);

  if (/غير\s*نشط|متوقف|انقطع|lapsed|inactive/.test(desc)) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    query = query.lt("last_donation_at", sixMonthsAgo.toISOString()).order("total_donated", { ascending: false });
  } else if (/كبار|أعلى|top|major|كبير/.test(desc)) {
    query = query.order("total_donated", { ascending: false });
  } else if (/متكرر|recurring|منتظم/.test(desc)) {
    query = query.gte("donations_count", 3).order("donations_count", { ascending: false });
  } else if (/جديد|new|أول/.test(desc)) {
    query = query.eq("donations_count", 1).order("created_at", { ascending: false });
  } else {
    query = query.order("total_donated", { ascending: false });
  }

  const { data: donors, error } = await query.limit(50);
  if (error || !donors || donors.length === 0) return null;

  const rows = donors.map((d: any, i: number) => [
    String(i + 1),
    d.full_name || "—",
    d.phone || "—",
    d.email || "—",
    d.city || "—",
    `${Number(d.total_donated || 0).toFixed(0)} ر.س`,
    String(d.donations_count || 0),
    d.last_donation_at ? String(d.last_donation_at).slice(0, 10) : "—",
    d.segment || "—",
    d.notes || "—",
  ]);

  const file = await buildPowerPointSupportFile(
    admin,
    organization_id,
    planId,
    taskIdx,
    subIdx,
    "قائمة المتبرعين المستهدفة",
    "مادة داعمة جاهزة للتنفيذ المباشر",
    [
      {
        heading: "وصف القائمة",
        body: segmentDescription,
        bullets: [
          `تم تجهيز ${donors.length} سجلًا جاهزًا للمراجعة والتواصل.`,
          "استخدم هذه القائمة لتوزيع التواصل بين أعضاء الفريق بحسب الأولوية.",
          "يمكن للموظف تعديل البيانات وإضافة ملاحظات المتابعة داخل العرض قبل الإرسال أو الاجتماع.",
        ],
      },
      {
        heading: "آلية التنفيذ المقترحة",
        bullets: [
          "ابدأ بأعلى المتبرعين قيمة أو الأكثر انتظامًا حسب ترتيب الجدول.",
          "حدّث حالة كل اسم بعد التواصل الأول والنتيجة المتوقعة.",
          "استخرج من القائمة دفعات أسبوعية للتواصل والمتابعة والإغلاق.",
        ],
      },
    ],
    {
      headers: ["#", "الاسم", "الجوال", "البريد", "المدينة", "إجمالي التبرعات", "عدد المرات", "آخر تبرع", "الشريحة", "ملاحظات"],
      rows,
      note: "الجدول معروض من اليمين إلى اليسار وجاهز للاستخدام في الاجتماعات والمشاركة الداخلية.",
    },
    `donor-list-${safeName(segmentDescription, 'donors')}`,
  );

  return file ? { url: file.url, name: `قائمة جاهزة (${donors.length} متبرع).pptx`, count: donors.length } : null;
}

async function buildProspectListFile(
  admin: any,
  organization_id: string,
  planId: string,
  taskIdx: number,
  subIdx: number,
): Promise<{ url: string; name: string; count: number } | null> {
  const sectors = ["بنك", "شركة اتصالات", "شركة تأمين", "شركة أغذية", "مجموعة تجارية", "شركة عقارية", "مستشفى خاص", "سلسلة مطاعم", "شركة لوجستية", "شركة طاقة"];
  const cities = ["الرياض", "جدة", "الدمام", "مكة المكرمة", "المدينة المنورة", "الخبر", "تبوك", "أبها", "الطائف", "حائل"];
  const interests = ["كفالة الأيتام", "إفطار صائم", "كسوة العيد", "السلال الغذائية", "المساعدات الطبية", "تعليم الأطفال", "ترميم المساجد", "حفر الآبار", "مشاريع التمكين", "دعم الأسر المنتجة"];

  const rows = Array.from({ length: 50 }, (_, i) => {
    const sector = sectors[i % sectors.length];
    return [
      String(i + 1),
      `${sector} المحتملة #${i + 1}`,
      sector,
      cities[i % cities.length],
      "اسم مسؤول الشراكات / المسؤولية الاجتماعية",
      "0500000000",
      "csr@company.example",
      interests[i % interests.length],
      "متوسط (50,000 - 200,000 ر.س)",
      "بانتظار التواصل",
      "أضف ملاحظة بعد أول تواصل",
    ];
  });

  const file = await buildPowerPointSupportFile(
    admin,
    organization_id,
    planId,
    taskIdx,
    subIdx,
    "قائمة 50 جهة محتملة للاستقطاب",
    "عرض تنفيذي جاهز لتوزيع جهات الاستهداف والشراكات",
    [
      {
        heading: "محتوى المرفق",
        body: "هذه القائمة تتضمن 50 جهة محتملة موزعة على قطاعات متنوعة يمكن البدء معها مباشرة في حملة الشراكات والاستقطاب.",
        bullets: [
          "تم تنويع القطاعات والمدن لتوسيع فرص الوصول.",
          "أضف اسم نقطة الاتصال الفعلية بعد التحقق من الجهة.",
          "استخدم السقف التقديري لتحديد أولوية المتابعة والعرض المناسب.",
        ],
      },
      {
        heading: "طريقة العمل المقترحة",
        bullets: [
          "قسّم القائمة إلى دفعتين أو أكثر حسب الجاهزية والقطاع.",
          "ابدأ بالجهات الأعلى مواءمة مع مجالات الجمعية الحالية.",
          "اربط كل جهة برسالة وعرض تبرع مناسبين ضمن نفس الخطة.",
        ],
      },
    ],
    {
      headers: ["#", "اسم الجهة", "القطاع", "المدينة", "جهة الاتصال", "الجوال", "البريد", "الاهتمام المتوقع", "السقف التقديري", "الحالة", "ملاحظات"],
      rows,
      note: "البيانات الأولية قابلة للتخصيص قبل البدء بالتواصل الرسمي.",
    },
    "prospect-list",
  );

  return file ? { url: file.url, name: "قائمة 50 جهة محتملة جاهزة.pptx", count: 50 } : null;
}

async function buildGenericDeliverableFile(
  admin: any,
  organization_id: string,
  planId: string,
  taskIdx: number,
  subIdx: number,
  deliverable: {
    type: string;
    title: string;
    content: string;
    fields?: { label: string; key: string }[];
  },
): Promise<{ url: string; name: string } | null> {
  const lines = splitLines(deliverable.content);
  const intro = lines[0] || deliverable.content || deliverable.title;
  const bullets = lines.slice(1, 9);

  const usageByType: Record<string, string[]> = {
    message_template: ["عدّل المتغيرات بين الأقواس قبل الإرسال.", "راجع النبرة حسب الشريحة المستهدفة.", "استخدمه في الواتساب أو البريد أو الرسائل النصية."],
    social_post: ["استخدم هذا النص كما هو أو عدّله بحسب المنصة.", "أرفق معه صورة أو فيديو مناسب لرفع التفاعل.", "أضف رابط التبرع المباشر قبل النشر."],
    report_form: ["اعرض المؤشرات المطلوبة في الاجتماع الدوري.", "حدّث القيم أسبوعيًا أو شهريًا بحسب المهمة.", "استخدم الشريحة الأخيرة كمرجع للتوصيات القادمة."],
    instructions: ["نفّذ الخطوات حسب الترتيب الوارد في العرض.", "خصّص الأسماء والروابط والمبالغ قبل الاستخدام الخارجي.", "استخدم الشرائح في العرض أو كملف عمل داخلي."],
  };

  const table = deliverable.type === "report_form"
    ? {
        headers: (deliverable.fields?.length ? deliverable.fields.map((f) => f.label) : ["الحقل", "القيمة"]),
        rows: [
          (deliverable.fields?.length ? deliverable.fields.map(() => "") : ["", ""]),
          (deliverable.fields?.length ? deliverable.fields.map(() => "") : ["", ""]),
          (deliverable.fields?.length ? deliverable.fields.map(() => "") : ["", ""]),
        ],
        note: "الجدول مخصص للتعبئة اليدوية أو للاستخدام كقالب متابعة في الاجتماع.",
      }
    : undefined;

  const file = await buildPowerPointSupportFile(
    admin,
    organization_id,
    planId,
    taskIdx,
    subIdx,
    deliverable.title,
    "مادة داعمة جاهزة بصيغة PowerPoint",
    [
      {
        heading: "المحتوى الجاهز",
        body: intro,
        bullets: bullets.length ? bullets : undefined,
      },
      {
        heading: "طريقة الاستخدام",
        bullets: usageByType[deliverable.type] || usageByType.instructions,
      },
    ],
    table,
    `${deliverable.type}-${safeName(deliverable.title, 'support')}`,
  );

  return file ? { url: file.url, name: `${deliverable.title}.pptx` } : null;
}

async function buildOrgMetrics(admin: any): Promise<OrgMetrics[]> {
  const { data: orgs, error: orgsErr } = await admin
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (orgsErr) throw orgsErr;

  const metrics = await Promise.all((orgs || []).map(async (org: any) => {
    const orgId = org.id;
    const head = { count: "exact" as const, head: true };

    const [
      donorsTotalRes,
      donationsCountRes,
      donationsRes,
      recurringRes,
      abandonedRes,
      recoveredRes,
      transfersRes,
      matchedRes,
      campaignsRes,
      tasksTotalRes,
      tasksDoneRes,
      employeesRes,
    ] = await Promise.all([
      admin.from("donors").select("*", head).eq("organization_id", orgId),
      admin.from("donations").select("*", head).eq("organization_id", orgId),
      admin.from("donations").select("amount, donor_id, donor_phone").eq("organization_id", orgId).limit(20000),
      admin.from("donors").select("*", head).eq("organization_id", orgId).gte("donations_count", 2),
      admin.from("abandoned_carts").select("*", head).eq("organization_id", orgId),
      admin.from("abandoned_carts").select("*", head).eq("organization_id", orgId).eq("recovered", true),
      admin.from("bank_transfers").select("*", head).eq("organization_id", orgId),
      admin.from("bank_transfers").select("*", head).eq("organization_id", orgId).eq("reconciliation_status", "matched"),
      admin.from("campaigns").select("*", head).eq("organization_id", orgId),
      admin.from("tasks").select("*", head).eq("organization_id", orgId),
      admin.from("tasks").select("*", head).eq("organization_id", orgId).eq("status", "completed"),
      admin.from("employees").select("*", head).eq("organization_id", orgId),
    ]);

    const donationRows = donationsRes.data || [];
    const total_donated = donationRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const donations_count = donationsCountRes.count || 0;
    const donors_total = donorsTotalRes.count || 0;
    const activeSet = new Set<string>();
    donationRows.forEach((row: any) => {
      const key = row.donor_id || row.donor_phone;
      if (key) activeSet.add(String(key));
    });

    const donors = activeSet.size > 0 ? activeSet.size : donors_total;
    const recurring = recurringRes.count || 0;
    const abandoned = abandonedRes.count || 0;
    const recovered = recoveredRes.count || 0;
    const transfers = transfersRes.count || 0;
    const matched = matchedRes.count || 0;
    const tasksTotal = tasksTotalRes.count || 0;
    const tasksDone = tasksDoneRes.count || 0;
    const employees = employeesRes.count || 0;

    const avg_donation = donations_count ? total_donated / donations_count : 0;
    const recovery_rate = abandoned ? (recovered / abandoned) * 100 : 0;
    const match_rate = transfers ? (matched / transfers) * 100 : 0;
    const completion = tasksTotal ? (tasksDone / tasksTotal) * 100 : 0;
    const recurring_pct = donors_total ? (recurring / donors_total) * 100 : 0;

    const donor_engagement_score = clamp(recurring_pct * 1.5 + (donors > 0 ? Math.min(40, Math.log10(donors + 1) * 12) : 0));
    // Bank transfer matching depends on donor-uploaded receipts (out of team's control) — exclude from service score
    const service_score = clamp(recovery_rate);
    const team_score = clamp(completion * 0.7 + Math.log10(employees + 1) * 10);

    return {
      org_id: orgId,
      org_name: org.name,
      total_donated,
      donations_count,
      avg_donation,
      donors,
      recurring_donors: recurring,
      abandoned_carts: abandoned,
      recovered_carts: recovered,
      recovery_rate,
      bank_transfers: transfers,
      matched_transfers: matched,
      employees_count: employees,
      tasks_total: tasksTotal,
      tasks_completed: tasksDone,
      task_completion_rate: completion,
      campaigns: campaignsRes.count || 0,
      fundraising_score: 0,
      donor_engagement_score,
      service_score,
      team_score,
      overall_score: 0,
    } satisfies OrgMetrics;
  }));

  const maxTotal = metrics.reduce((max: number, metric: OrgMetrics) => Math.max(max, metric.total_donated || 0), 0);

  return metrics.map((metric) => {
    const fundraising_score = maxTotal > 0 ? clamp((metric.total_donated / maxTotal) * 100) : 0;
    const overall_score = clamp(
      (fundraising_score + metric.donor_engagement_score + metric.service_score + metric.team_score) / 4,
    );

    return { ...metric, fundraising_score, overall_score };
  });
}

async function generateInsight(admin: any, apiKey: string, metrics: OrgMetrics, allMetrics: OrgMetrics[]) {
  const peers = allMetrics.filter((m) => m.org_id !== metrics.org_id);
  const avgRev = peers.length ? peers.reduce((sum, m) => sum + m.total_donated, 0) / peers.length : 0;
  const avgScore = peers.length ? peers.reduce((sum, m) => sum + m.overall_score, 0) / peers.length : 0;

  const systemPrompt = `أنت محلل بيانات تنفيذي خبير في إدارة الجمعيات الخيرية والتبرعات وخدمة المتبرعين. مهمتك إنتاج تحليل عربي احترافي شامل وثابت لنفس المدخلات.
قواعد إلزامية:
- اعتمد فقط على الأرقام المرسلة ولا تخترع أي رقم أو معلومة.
- إذا كانت البيانات غير كافية في نقطة ما، اذكر ذلك كاستنتاج محدود لا كحقيقة.
- لنفس البيانات والفترة يجب أن تكون النتيجة بنفس المنطق والترتيب قدر الإمكان؛ لا تضف تنويعات إبداعية عشوائية.
- لا تحذف أي ملاحظة مهمة: غطِّ الإيرادات، عدد التبرعات، متوسط التبرع، المتبرعين، المتبرعين المنتظمين، السلال المتروكة، التحويلات البنكية، الموظفين، المهام، الحملات، والدرجات المركبة.
- استخرج كل نقطة قوة/ضعف/فرصة من مقارنة مباشرة بين أداء الجمعية ومتوسط الجمعيات الأخرى أو من المؤشرات الداخلية.
- التوصيات يجب أن تكون عملية، قابلة للتنفيذ، مرتبة بالأولوية، ومربوطة بسبب واضح من البيانات.
- اكتب بلغة تنفيذية ذكية ومباشرة، بدون حشو.`;

  const userPrompt = `حلّل أداء هذه الجمعية للفترة: منذ البداية
الاسم: ${metrics.org_name}
- الإيرادات: ${metrics.total_donated.toFixed(0)} ر.س (متوسط الأخريات: ${avgRev.toFixed(0)})
- عدد التبرعات: ${metrics.donations_count}
- متوسط التبرع: ${metrics.avg_donation.toFixed(0)} ر.س
- المتبرعون: ${metrics.donors} (منتظمون: ${metrics.recurring_donors})
- السلال المتروكة: ${metrics.abandoned_carts} (مسترجعة: ${metrics.recovered_carts}, نسبة: ${metrics.recovery_rate.toFixed(1)}%)
- الموظفون: ${metrics.employees_count}
- المهام: ${metrics.tasks_total} (مكتمل: ${metrics.tasks_completed}, نسبة: ${metrics.task_completion_rate.toFixed(1)}%)
- الحملات: ${metrics.campaigns}
- نقاط (0-100): جمع التبرعات ${metrics.fundraising_score.toFixed(0)} / تفاعل ${metrics.donor_engagement_score.toFixed(0)} / خدمة ${metrics.service_score.toFixed(0)} / فريق ${metrics.team_score.toFixed(0)} / إجمالي ${metrics.overall_score.toFixed(0)} (متوسط الأخريات ${avgScore.toFixed(0)})

ملاحظة مهمة: تجاهل تمامًا موضوع "التحويلات البنكية غير المطابقة/غير المعتمدة" — هذه ناتجة عن إيصالات خاطئة يرفعها المتبرعون أنفسهم في المتجر، وليست مسؤولية الفريق. لا تذكرها في نقاط الضعف، ولا في الفرص، ولا في التوصيات.

قدّم تحليلاً شاملاً يتضمن:
1) ملخّص تنفيذي يغطي أهم الاستنتاجات ولا يتجاوز 4 جمل.
2) 4-6 نقاط قوة، مع عدم تجاهل أي مؤشر إيجابي واضح.
3) 4-6 نقاط ضعف أو مخاطر تشغيلية/تسويقية، مع عدم تجاهل أي مؤشر سلبي واضح.
4) 3-5 فرص نمو وتحسين مستندة إلى البيانات.
5) 6-8 توصيات قابلة للتنفيذ مع مستوى التأثير، مرتبة من الأعلى أثرًا إلى الأقل.
راجع إجابتك داخليًا قبل الإرسال للتأكد من الشمول والدقة والثبات وعدم وجود نقص أو أخطاء.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0,
      top_p: 0.1,
      seed: 42,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "submit_analysis",
          description: "Submit the structured analysis",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "ملخّص تنفيذي 2-4 جمل" },
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              opportunities: { type: "array", items: { type: "string" } },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    impact: { type: "string", enum: ["high", "medium", "low"] },
                    action: { type: "string" },
                  },
                  required: ["title", "impact", "action"],
                },
              },
            },
            required: ["summary", "strengths", "weaknesses", "opportunities", "recommendations"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "submit_analysis" } },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("generate-action-plan insight generation failed:", response.status, text);
    throw new Error("تعذّر توليد التحليل الذكي التلقائي لهذه الجمعية");
  }

  const data = await response.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  const insight = args ? JSON.parse(args) : null;
  if (!insight) throw new Error("تعذّر استخراج التحليل الذكي التلقائي");

  const { data: saved, error: saveErr } = await admin
    .from("admin_ai_insights_cache")
    .insert({
      organization_id: metrics.org_id,
      period_label: "منذ البداية",
      period_from: null,
      period_to: null,
      insight,
      metrics_snapshot: metrics,
    })
    .select("id, insight, period_label, generated_at")
    .single();

  if (saveErr) throw saveErr;
  return saved;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, supaKey);

    const { organization_id, duration_days = 30, plan_title } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Latest cached AI insight
    let { data: cached } = await admin
      .from("admin_ai_insights_cache")
      .select("id, insight, period_label, generated_at")
      .eq("organization_id", organization_id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cached?.insight) {
      const allMetrics = await buildOrgMetrics(admin);
      const selectedMetrics = allMetrics.find((m) => m.org_id === organization_id);

      if (!selectedMetrics) {
        return new Response(JSON.stringify({ error: "الجمعية المحددة غير موجودة" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      cached = await generateInsight(admin, LOVABLE_API_KEY, selectedMetrics, allMetrics);
    }

    const recs = (cached!.insight.recommendations || []) as { title: string; impact: string; action: string }[];
    if (!recs.length) {
      return new Response(JSON.stringify({ error: "لا توجد توصيات في التحليل" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Org employees for AI assignment
    const { data: employees } = await admin
      .from("employees")
      .select("id, full_name, job_role, title, role_level, department_id, departments(name)")
      .eq("organization_id", organization_id)
      .neq("status", "inactive");

    const empList = (employees || []).map((e: any) => ({
      id: e.id,
      name: e.full_name,
      role: e.job_role,
      title: e.title || null,
      department: e.departments?.name || null,
    }));

    // 3) Ask AI to assign + schedule + break down into executive subtasks
    //    Each subtask gets its own assigned employee + a ready-to-use deliverable.
    let assignments: {
      recommendation_index: number;
      employee_id: string | null;
      reason: string;
      subtasks: {
        title: string;
        details: string;
        duration_days: number;
        assigned_employee_id?: string | null;
        deliverable?: {
          type: "donor_list" | "message_template" | "social_post" | "report_form" | "instructions";
          title: string;
          content: string;
          fields?: { label: string; key: string }[];
        };
      }[];
    }[] = [];
    if (empList.length > 0) {
      const sysPrompt = `أنت مدير تنفيذي خبير. الجمعية تملك بالفعل قاعدة بيانات متبرعين، فريق عمل، وأدوات تواصل. مهمتك أن تجهّز كل شيء بحيث يكون الموظف منفّذًا فقط (لا يفكر، لا يبني من الصفر).

لكل توصية:
1) اختر "المسؤول الأول" من قائمة الموظفين (للإشراف العام) واذكر سببًا موجزًا.
2) فكّك التوصية إلى 4-7 مهام تنفيذية دقيقة، بترتيب زمني منطقي.

لكل مهمة تنفيذية:
- title: يبدأ بفعل أمر محدد (مثال: "أرسل رسالة الواتساب الجاهزة لقائمة المتبرعين المرفقة").
- details: شرح موجز جدًا (سطر أو سطرين) لما سيقوم به الموظف فعليًا.
- duration_days: 1-15.
- assigned_employee_id: اختر الموظف الأنسب لهذه المهمة بالذات (حسب job_role/department؛ الاتصال للعلاقات العامة، التصميم/النشر للتسويق، التقارير المالية للمحاسبة...). لا تترك المهمة بدون موظف.
- deliverable: **إلزامي لكل مهمة بدون استثناء** — مادة داعمة كاملة جاهزة للتحميل والاستخدام مباشرة. اختر النوع الأنسب:
  * "donor_list": عند الحاجة إلى قائمة مانحين/متبرعين من قاعدة البيانات (lapsed/major/recurring/new). content = وصف تشغيلي دقيق للشريحة.
  * "donor_list" أيضًا للجهات/الشركات/الرعاة المحتملين — استخدم كلمات مثل "جهات محتملة" أو "شركات" أو "رعاة" في content حتى يتم بناء قائمة 50 جهة جاهزة تلقائيًا.
  * "message_template": رسالة واتساب/SMS/بريد كاملة جاهزة للنسخ. content = نص الرسالة كاملة (حد أدنى 60 كلمة)، بمتغيرات بين {} مثل {الاسم} {آخر_تبرع} {المبلغ_السابق}. لا تكتب "صمم رسالة" — اكتب الرسالة نفسها.
  * "social_post": منشور سوشيال جاهز. content = نص المنشور كاملًا + 5-10 هاشتاقات عربية ذات صلة + سطر "اقتراح بصري:". لا تكتب "صمم منشور" — اكتب المنشور النهائي.
  * "report_form": نموذج تقرير قابل للتعبئة. content = تعليمات مختصرة لما يعبّئه الموظف، fields = قائمة 5-10 حقول مطلوبة.
  * "instructions": سيناريو/سكربت/خطة عرض جاهز (مثل "سكربت اتصال هاتفي" أو "عرض تبرع مخصص للشريحة"). content = نص كامل قابل للقراءة والاستخدام مباشرة (سكربت المكالمة، أو عرض التبرع المقترح بكل تفاصيله: العنوان، الوعد، الفئة المستهدفة، المبلغ المقترح، المنفعة، نص الإقناع). الحد الأدنى 80 كلمة.
- title (داخل deliverable): اسم المخرج (مثال: "رسالة استرجاع المانحين غير النشطين").

أمثلة على ما يجب أن تنتجه (وليس ما تطلبه من الموظف):
- بدلًا من "صمم عرض تبرع مخصص للشريحة" → أنشئ deliverable type="instructions" content="عرض تبرع: [العنوان] ... [الوصف الكامل] ... [المبلغ المقترح] ... [الرسالة الترويجية] ..."
- بدلًا من "أعد قائمة 50 جهة محتملة" → أنشئ deliverable type="donor_list" content="جهات محتملة من القطاع الخاص للرعاية" (سيُبنى ملف 50 جهة تلقائيًا).
- بدلًا من "أطلق حملة تواصل" → أنشئ deliverable type="message_template" content="[نص الرسالة الفعلي للدفعة الأولى]" + قسّم لمهمتين كل واحدة برسالة مختلفة.

قواعد صارمة:
- لا تطلب من الموظف "بناء/إعداد/تصميم/كتابة" — أنت تنتج المادة الداعمة، هو ينفذ فقط.
- كل مهمة يجب أن يكون لها deliverable بمحتوى حقيقي (لا تترك content فارغًا أو نصًا عامًا).
- لا تخترع أرقامًا أو معلومات غير مذكورة في البيانات.
- استخدم العربية الاحترافية المباشرة.`;
      const userPrompt = `الموظفون المتاحون:\n${JSON.stringify(empList, null, 2)}\n\nالتوصيات:\n${recs.map((r, i) => `${i}) [${r.impact}] ${r.title}\n   الإجراء: ${r.action}`).join("\n\n")}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0,
          seed: 7,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_assignments",
              description: "Assign each recommendation to the most suitable employee and break it into executive subtasks",
              parameters: {
                type: "object",
                properties: {
                  assignments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        recommendation_index: { type: "number" },
                        employee_id: { type: "string" },
                        reason: { type: "string" },
                        subtasks: {
                          type: "array",
                          minItems: 4,
                          maxItems: 7,
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string", description: "فعل أمر محدد للموظف" },
                              details: { type: "string", description: "شرح موجز سطر أو سطرين" },
                              duration_days: { type: "number", description: "1-15" },
                              assigned_employee_id: { type: "string", description: "id الموظف المنفّذ لهذه المهمة" },
                              deliverable: {
                                type: "object",
                                properties: {
                                  type: { type: "string", enum: ["donor_list", "message_template", "social_post", "report_form", "instructions"] },
                                  title: { type: "string" },
                                  content: { type: "string" },
                                  fields: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        label: { type: "string" },
                                        key: { type: "string" },
                                      },
                                      required: ["label", "key"],
                                    },
                                  },
                                },
                                required: ["type", "title", "content"],
                              },
                            },
                            required: ["title", "details", "duration_days", "assigned_employee_id", "deliverable"],
                          },
                        },
                      },
                      required: ["recommendation_index", "employee_id", "reason", "subtasks"],
                    },
                  },
                },
                required: ["assignments"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_assignments" } },
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          try { assignments = JSON.parse(args).assignments || []; } catch { /* ignore */ }
        }
      }
    }

    // 4) Create the plan + tasks
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + Number(duration_days));
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);

    const { data: plan, error: planErr } = await admin
      .from("action_plans")
      .insert({
        organization_id,
        title: plan_title || `خطة من التحليل الذكي (${cached!.period_label})`,
        description: cached!.insight.summary || null,
        source: "ai_insight",
        source_insight_id: cached!.id,
        status: "active",
        start_date: isoDate(today),
        end_date: isoDate(endDate),
        progress: 0,
      })
      .select("id")
      .single();
    if (planErr) throw planErr;

    // Schedule tasks evenly across the period, high impact first
    const sorted = recs
      .map((r, i) => ({ ...r, idx: i }))
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return (order[a.impact] ?? 1) - (order[b.impact] ?? 1);
      });

    const stepDays = Math.max(1, Math.floor(Number(duration_days) / Math.max(sorted.length, 1)));
    const tasksPayload = await Promise.all(sorted.map(async (r, i) => {
      const start = new Date(today);
      start.setDate(start.getDate() + i * stepDays);
      const due = new Date(start);
      due.setDate(due.getDate() + Math.max(stepDays, 3));
      const a = assignments.find(x => x.recommendation_index === r.idx);
      const validEmpId = a && empList.some(e => e.id === a.employee_id) ? a.employee_id : null;
      const empIds = new Set(empList.map((e) => e.id));
      const cleanedSubtasks = await Promise.all((a?.subtasks || []).map(async (s, sIdx) => {
        let deliverable = s.deliverable;
        let attachment: { url: string; name: string } | null = null;
        if (deliverable) {
          if (deliverable.type === "donor_list") {
            // Build a real CSV from real DB data (or a 50-prospect template if it's a prospect list)
            const file = await buildDonorListFile(admin, organization_id, deliverable.content, plan.id, i, sIdx);
            if (file) {
              attachment = { url: file.url, name: file.name };
              deliverable = {
                ...deliverable,
                content:
                  deliverable.content +
                  `\n\n📎 ملف جاهز: ${file.count} سجلًا (الاسم، الجوال، البريد، الاهتمام، السقف التقديري). الموظف ينفذ فقط.`,
              };
            }
          } else {
            // For every other deliverable type — produce a downloadable supporting file
            const file = await buildGenericDeliverableFile(admin, organization_id, plan.id, i, sIdx, deliverable);
            if (file) attachment = { url: file.url, name: file.name };
          }
        }
        // Round-robin fallback: never leave a subtask without an assignee
        const fallbackId = empList.length ? empList[(i + sIdx) % empList.length].id : null;
        return {
          ...s,
          deliverable,
          attachment_url: attachment?.url || null,
          attachment_name: attachment?.name || null,
          assigned_employee_id:
            s.assigned_employee_id && empIds.has(s.assigned_employee_id)
              ? s.assigned_employee_id
              : (validEmpId || fallbackId),
          status: "pending",
        };
      }));
      return {
        action_plan_id: plan.id,
        organization_id,
        title: r.title,
        description: r.action,
        impact: r.impact,
        priority: i,
        status: "pending" as const,
        start_date: isoDate(start),
        due_date: isoDate(due),
        assigned_employee_id: validEmpId,
        ai_suggested_employee_id: validEmpId,
        ai_suggestion_reason: a?.reason || null,
        subtasks: cleanedSubtasks,
      };
    }));

    const { error: tasksErr } = await admin.from("action_plan_tasks").insert(tasksPayload);
    if (tasksErr) throw tasksErr;

    return new Response(JSON.stringify({ plan_id: plan.id, tasks_count: tasksPayload.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-action-plan error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});