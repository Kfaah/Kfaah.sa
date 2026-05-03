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
const DEMO_EMAIL = "demo-viewer@charity-crm.org";
const DEMO_PASSWORD = "Demo!Viewer#2026$Showcase";
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

    // 4) Seed demo data if not seeded yet
    const { count: empCount } = await admin
      .from("employees")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", DEMO_ORG_ID);

    let seeded = false;
    if ((empCount ?? 0) < 3) {
      await seedDemoData(admin);
      seeded = true;
    }

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

async function seedDemoData(admin: ReturnType<typeof createClient>) {
  const orgId = DEMO_ORG_ID;

  await admin.from("organization_branding").upsert(
    {
      organization_id: orgId,
      brand_primary: "168 76% 36%",
      brand_secondary: "152 52% 28%",
      brand_accent: "44 92% 55%",
    },
    { onConflict: "organization_id" },
  );

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
  const deptByName: Record<string, string> = {};
  (deptInserted ?? []).forEach((d: any) => (deptByName[d.name] = d.id));

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
  const all = empInserted ?? [];
  const adminEmp = all.find((e: any) => e.role_level === "admin");
  const managers = all.filter((e: any) => e.role_level === "manager");
  const staff = all.filter((e: any) => e.role_level === "employee");

  if (adminEmp) {
    for (const m of managers) {
      await admin.from("employees").update({ direct_manager_id: adminEmp.id }).eq("id", m.id);
    }
    for (let i = 0; i < staff.length; i++) {
      const mgr = managers[i % managers.length];
      if (mgr) await admin.from("employees").update({ direct_manager_id: mgr.id }).eq("id", staff[i].id);
    }
  }

  const goalRows = [
    { title: "تمكين المستفيدين وتحسين جودة الخدمة" },
    { title: "بناء قدرات الكوادر وتطوير بيئة العمل" },
    { title: "تنويع مصادر التمويل وتعزيز الاستدامة" },
  ].map((g) => ({ organization_id: orgId, title: g.title }));
  const { data: goalsIns } = await admin
    .from("strategic_goals")
    .insert(goalRows)
    .select("id, title");
  const goals = goalsIns ?? [];

  for (const g of goals) {
    await admin.from("operational_plans").insert({
      organization_id: orgId,
      title: `خطة تشغيلية — ${g.title}`,
      year: new Date().getFullYear(),
      strategic_goal_id: g.id,
    });
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
  const statuses = ["upcoming", "in_progress", "completed", "executed"];
  const today = new Date();
  const taskRows = taskTitles.map((title, idx) => {
    const assignee = all[idx % all.length];
    return {
      organization_id: orgId,
      title,
      description: `${title} — مهمة تجريبية لعرض إمكانيات المنصة.`,
      assigned_to: assignee?.id,
      status: statuses[idx % statuses.length],
      priority: ["high", "medium", "low"][idx % 3],
      due_date: new Date(today.getTime() + (idx - 5) * 86400000)
        .toISOString()
        .split("T")[0],
    };
  });
  await admin.from("tasks").insert(taskRows);
}
