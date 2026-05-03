import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEMO_ORG_ID = "00000000-0000-0000-0000-0000000000de";
const DEMO_EMAIL = "111111111@demo.charity-crm.org";
const DEMO_PASSWORD = "123456";
const DEMO_FULL_NAME = "زائر تجريبي";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Find or create demo user
    let demoUserId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const existing = list?.users?.find(
      (u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase(),
    );
    if (existing) {
      demoUserId = existing.id;
      await admin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: DEMO_FULL_NAME,
          first_name: "زائر",
          last_name: "تجريبي",
          username: "demo",
          is_demo: true,
        },
      });
    } else {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: DEMO_FULL_NAME,
            first_name: "زائر",
            last_name: "تجريبي",
            username: "demo",
            is_demo: true,
          },
        });
      if (createErr || !created.user) {
        return json({ error: createErr?.message || "create_failed" }, 500);
      }
      demoUserId = created.user.id;
    }

    // 2) Link to demo org as approved viewer
    await admin.from("user_organizations").upsert(
      {
        user_id: demoUserId,
        organization_id: DEMO_ORG_ID,
        is_default: true,
        approval_status: "approved",
        requested_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,organization_id" },
    );

    // 3) Ensure viewer role
    await admin.from("user_roles").upsert(
      { user_id: demoUserId, role: "viewer" },
      { onConflict: "user_id,role" },
    );

    // 4) Seed demo data — each section is independently idempotent
    const seeded = await seedDemoData(admin, demoUserId!);

    return json({
      ok: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      org_slug: "demo",
      seeded,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function seedDemoData(
  admin: ReturnType<typeof createClient>,
  demoUserId: string,
) {
  const orgId = DEMO_ORG_ID;
  const seededParts: string[] = [];

  await admin.from("organization_branding").upsert(
    {
      organization_id: orgId,
      brand_primary: "168 76% 36%",
      brand_secondary: "152 52% 28%",
      brand_accent: "44 92% 55%",
    },
    { onConflict: "organization_id" },
  );

  // Departments
  const { count: deptCount } = await admin
    .from("departments")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId);
  const deptByName: Record<string, string> = {};
  if ((deptCount ?? 0) === 0) {
    const departments = [
      "الإدارة التنفيذية",
      "الموارد البشرية",
      "البرامج والمشاريع",
      "التسويق والاتصال",
      "المالية",
    ];
    const { data: deptInserted } = await admin
      .from("departments")
      .insert(departments.map((name) => ({ organization_id: orgId, name })))
      .select("id, name");
    (deptInserted ?? []).forEach((d: any) => (deptByName[d.name] = d.id));
    seededParts.push("departments");
  } else {
    const { data: existing } = await admin
      .from("departments")
      .select("id, name")
      .eq("organization_id", orgId);
    (existing ?? []).forEach((d: any) => (deptByName[d.name] = d.id));
  }

  const employees = [
    { full_name: "أحمد عبدالله الزهراني", role: "المدير التنفيذي", role_level: "admin", dept: "الإدارة التنفيذية" },
    { full_name: "نورة سعيد القحطاني", role: "مديرة الموارد البشرية", role_level: "manager", dept: "الموارد البشرية" },
    { full_name: "خالد محمد العتيبي", role: "مدير البرامج", role_level: "manager", dept: "البرامج والمشاريع" },
    { full_name: "سارة فهد الدوسري", role: "مديرة التسويق", role_level: "manager", dept: "التسويق والاتصال" },
    { full_name: "ماجد علي الشهري", role: "المدير المالي", role_level: "manager", dept: "المالية" },
    { full_name: "ريم ناصر الغامدي", role: "أخصائية موارد بشرية", role_level: "employee", dept: "الموارد البشرية" },
    { full_name: "فيصل بدر الحربي", role: "منسق مشاريع", role_level: "employee", dept: "البرامج والمشاريع" },
    { full_name: "ليلى عمر السبيعي", role: "مصممة جرافيك", role_level: "employee", dept: "التسويق والاتصال" },
    { full_name: "بدر حمد المالكي", role: "محاسب أول", role_level: "employee", dept: "المالية" },
    { full_name: "هدى خالد الأحمدي", role: "أخصائية تواصل", role_level: "employee", dept: "التسويق والاتصال" },
    { full_name: "تركي صالح القرني", role: "منسق مشاريع", role_level: "employee", dept: "البرامج والمشاريع" },
    { full_name: "منى يوسف الجهني", role: "محاسبة", role_level: "employee", dept: "المالية" },
  ];
  // Employees
  const { count: empCount } = await admin
    .from("employees")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId);
  let all: any[] = [];
  if ((empCount ?? 0) === 0) {
    const empRows = employees.map((e, i) => ({
      organization_id: orgId,
      full_name: e.full_name,
      username: `demo_emp_${i + 1}`,
      email: `demo_emp_${i + 1}@demo.local`,
      job_role: e.role,
      role_level: e.role_level,
      department_id: deptByName[e.dept] ?? null,
      role_color: "bg-primary",
      status: "active",
    }));
    const { data: empInserted } = await admin
      .from("employees")
      .insert(empRows)
      .select("id, full_name, role_level");
    all = empInserted ?? [];
    seededParts.push("employees");
  } else {
    const { data: existing } = await admin
      .from("employees")
      .select("id, full_name, role_level")
      .eq("organization_id", orgId);
    all = existing ?? [];
  }
  const adminEmp = all.find((e: any) => e.role_level === "admin");
  const managers = all.filter((e: any) => e.role_level === "manager");
  const staff = all.filter((e: any) => e.role_level === "employee");

  if (adminEmp && (empCount ?? 0) === 0) {
    for (const m of managers) {
      await admin.from("employees").update({ direct_manager_id: adminEmp.id }).eq("id", m.id);
    }
    for (let i = 0; i < staff.length; i++) {
      const mgr = managers[i % managers.length];
      if (mgr) await admin.from("employees").update({ direct_manager_id: mgr.id }).eq("id", staff[i].id);
    }
  }

  // Strategic goals — schema only requires `name`
  const { count: goalsExisting } = await admin
    .from("strategic_goals")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId);
  if ((goalsExisting ?? 0) === 0) {
    const goalNames = [
      "تمكين المستفيدين وتحسين جودة الخدمة",
      "بناء قدرات الكوادر وتطوير بيئة العمل",
      "تنويع مصادر التمويل وتعزيز الاستدامة",
    ];
    await admin.from("strategic_goals").insert(
      goalNames.map((name) => ({
        organization_id: orgId,
        name,
        year: new Date().getFullYear(),
        color: "bg-emerald-500",
      })),
    );
    seededParts.push("strategic_goals");
  }

  // Operational plans — schema requires user_id, activity_name, plan_name, etc.
  const { count: plansExisting } = await admin
    .from("operational_plans")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId);
  if ((plansExisting ?? 0) === 0) {
    const planSeeds = [
      { activity: "تنفيذ برنامج الأسر المنتجة (مرحلة 1)", plan: "خطة الأثر المجتمعي", target: 120, budget: 180000 },
      { activity: "تأهيل وتدريب 50 مستفيدًا في الحرف", plan: "خطة الأثر المجتمعي", target: 50, budget: 90000 },
      { activity: "ورش تطوير القيادات الإدارية", plan: "خطة تطوير الموارد البشرية", target: 8, budget: 60000 },
      { activity: "نظام تقييم الأداء الربعي", plan: "خطة تطوير الموارد البشرية", target: 12, budget: 25000 },
      { activity: "حملة سنوية لاستقطاب الداعمين", plan: "خطة الاستدامة المالية", target: 1, budget: 150000 },
      { activity: "إطلاق متجر إلكتروني للهدايا الخيرية", plan: "خطة الاستدامة المالية", target: 1, budget: 220000 },
    ];
    await admin.from("operational_plans").insert(
      planSeeds.map((p) => ({
        organization_id: orgId,
        user_id: demoUserId,
        activity_name: p.activity,
        plan_name: p.plan,
        annual_target: p.target,
        estimated_budget: p.budget,
        status: "active",
      })),
    );
    seededParts.push("operational_plans");
  }

  const taskTitles = [
    "إعداد التقرير الشهري للأداء",
    "تنظيم ورشة تدريبية للمتطوعين",
    "تحديث قاعدة بيانات المستفيدين",
    "تصميم حملة التواصل للربع القادم",
    "مراجعة الميزانية التشغيلية",
    "زيارة ميدانية للمشاريع الجارية",
    "تحضير اجتماع مجلس الإدارة",
    "تطوير دليل سياسات الموارد البشرية",
    "إطلاق نشرة إخبارية شهرية",
    "تقييم أداء الفريق الربعي",
    "تنسيق فعالية اليوم الوطني",
    "إعداد عرض تقديمي للممولين",
    "متابعة طلبات المنح",
    "تحديث الموقع الإلكتروني",
    "تنظيم لقاء المتبرعين",
  ];
  // Tasks (schema requires user_id NOT NULL; assigned employee field doesn't exist on tasks)
  const { count: tasksExisting } = await admin
    .from("tasks")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId);
  if ((tasksExisting ?? 0) === 0) {
    const statuses = ["upcoming", "in_progress", "completed", "executed", "pending"];
  const today = new Date();
  const taskRows = taskTitles.map((title, idx) => {
    return {
      organization_id: orgId,
      user_id: demoUserId,
      title,
      description: `${title} — مهمة تجريبية لعرض إمكانيات المنصة.`,
      status: statuses[idx % statuses.length],
      priority: ["high", "medium", "low"][idx % 3],
      completion_percentage: idx % 4 === 2 ? 100 : (idx * 7) % 100,
      quality_percentage: idx % 4 === 2 ? 90 : (idx * 11) % 100,
      due_date: new Date(today.getTime() + (idx - 5) * 86400000)
        .toISOString()
        .split("T")[0],
    };
  });
    await admin.from("tasks").insert(taskRows);
    seededParts.push("tasks");
  }

  return seededParts;
}
