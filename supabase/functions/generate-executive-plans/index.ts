import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const TADABBUR_ORG_ID = "00a528ce-e836-4ebd-9a50-35aeaa766501";
const TADABBUR_MARKETING_MANAGER = "ناصر علي سلمان الحريصي";
const TADABBUR_EXECUTIVE_DIRECTOR = "محمد هادي حسن الحريصي";
const MARKETING_TERMS = [
  "تسويق", "التسويقي", "اعلام", "إعلام", "حملة", "حملات", "محتوى",
  "هوية", "منصة", "منصات", "تواصل اجتماعي", "رقمي", "رقمية", "إعلان", "اعلان",
];
const DEV_ADMIN_TERMS = [
  "تطوير", "التطوير", "اداري", "إداري", "ادارية", "إدارية", "الادارة", "الإدارة",
  "تنظيم", "حوكمة", "سياسات", "لوائح", "اجراءات", "إجراءات", "تشغيل",
  "شراكة", "شراكات", "الشراكة", "الشراكات", "حلقة", "حلقات", "الحلقة", "الحلقات",
];

const isMarketingWork = (...values: unknown[]) => {
  const text = values.map((value) => String(value ?? "")).join(" ");
  return MARKETING_TERMS.some((term) => text.includes(term));
};

const isDevAdminWork = (...values: unknown[]) => {
  const text = values.map((value) => String(value ?? "")).join(" ");
  return DEV_ADMIN_TERMS.some((term) => text.includes(term));
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { month, months, year, userIds, employeeIds, operationalPlanIds, excelPlanIds, organizationId } = await req.json();
    const filterOperationalIds: string[] = Array.isArray(operationalPlanIds) ? operationalPlanIds : [];
    const filterExcelIds: string[] = Array.isArray(excelPlanIds) ? excelPlanIds : [];
    const filterUserIds: string[] = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    const filterEmployeeIds: string[] = Array.isArray(employeeIds) ? employeeIds.filter(Boolean) : [];
    const hasPlanFilter = filterOperationalIds.length > 0 || filterExcelIds.length > 0;
    const activeOrganizationId = typeof organizationId === "string" && organizationId.trim() ? organizationId.trim() : null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // قاعدة جمعية تدبر: كل نشاط تسويقي يُسند حصراً إلى مدير التسويق ناصر.
    const shouldLoadTadabburMarketingManager = !activeOrganizationId || activeOrganizationId === TADABBUR_ORG_ID;
    const { data: tadabburMarketingManager } = shouldLoadTadabburMarketingManager
      ? await supabase
          .from("employees")
          .select("id, user_id, full_name, job_role")
          .eq("organization_id", TADABBUR_ORG_ID)
          .eq("full_name", TADABBUR_MARKETING_MANAGER)
          .eq("status", "active")
          .not("user_id", "is", null)
          .maybeSingle()
      : { data: null };

    // قاعدة جمعية تدبر: كل نشاط تطويري/إداري يُسند حصراً إلى المدير التنفيذي محمد هادي.
    const shouldLoadTadabburExecutiveDirector = shouldLoadTadabburMarketingManager;
    const { data: tadabburExecutiveDirector } = shouldLoadTadabburExecutiveDirector
      ? await supabase
          .from("employees")
          .select("id, user_id, full_name, job_role")
          .eq("organization_id", TADABBUR_ORG_ID)
          .eq("full_name", TADABBUR_EXECUTIVE_DIRECTOR)
          .eq("status", "active")
          .not("user_id", "is", null)
          .maybeSingle()
      : { data: null };

    // دعم الأشهر المتعددة أو شهر واحد
    let targetMonths: number[] = [];
    if (months && Array.isArray(months) && months.length > 0) {
      targetMonths = months;
    } else if (month) {
      targetMonths = [month];
    } else {
      targetMonths = [new Date().getMonth() + 1];
    }
    
    const targetYear = year || new Date().getFullYear();

    // ===== بناء "خطط تشغيلية افتراضية" من excel_plans المحددة =====
    type VirtualPlan = {
      planId: string; // معرّف داخلي (excel:<rowIndex>:<excelPlanId>)
      planMonthIdSeed: string; // معرّف وهمي للشهر (لن يُستخدم في DB إلا للتوليد)
      activityName: string;
      initiative: string | null;
      strategicGoal: string | null;
      annualTarget: number;
      userId: string;
      employeeName: string;
      jobRole: string;
      isVirtual: true;
      excelPlanId: string;
      rowIndex: number;
    };

    const virtualPlans: VirtualPlan[] = [];
    let excelPlans: any[] = [];

    if (filterExcelIds.length > 0) {
      let excelPlansQuery = supabase
        .from("excel_plans")
        .select("id, plan_name, year, columns, rows, organization_id")
        .in("id", filterExcelIds)
        .eq("year", targetYear)
      if (activeOrganizationId) excelPlansQuery = excelPlansQuery.eq("organization_id", activeOrganizationId);
      const { data: excelPlansData } = await excelPlansQuery;
      excelPlans = excelPlansData || [];

      // محاولة ربط "مسؤول التنفيذ" بمستخدم/قسم
      let employeesQuery = supabase
        .from("employees")
        .select("id, full_name, user_id, job_role, department_id, organization_id, departments(id, name)")
        .not("user_id", "is", null);
      if (activeOrganizationId) employeesQuery = employeesQuery.eq("organization_id", activeOrganizationId);
      const { data: allEmployees } = await employeesQuery;

      // تطبيع نص عربي: حذف التشكيل، توحيد الألف/الياء/التاء، حذف "ال"، وتفريق الكلمات الشائعة
      const stripDiacritics = (s: string) =>
        s.replace(/[\u0617-\u061A\u064B-\u0652\u0670\u0640]/g, "");
      const normalizeArabic = (s: any) => {
        let v = String(s ?? "").trim();
        v = stripDiacritics(v);
        v = v.replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه");
        return v.toLowerCase();
      };
      const STOPWORDS = new Set(["اداره", "ادارة", "قسم", "وحده", "وحدة", "مكتب", "ال", "و", "في", "على", "عن"]);
      const tokenize = (s: any) =>
        normalizeArabic(s)
          .split(/[\s،,\-_/\\()]+/)
          .map((t) => t.replace(/^ال/, ""))
          .filter((t) => t && !STOPWORDS.has(t));
      const norm = normalizeArabic;

      // تجميع الموظفين حسب القسم داخل الجهة النشطة فقط (للتدوير)
      const employeesByDept = new Map<string, any[]>();
      const deptNamesById = new Map<string, string>();
      for (const e of allEmployees || []) {
        if (!e.user_id) continue;
        const deptName = e.departments?.name;
        const deptId = e.department_id;
        if (!deptName || !deptId) continue;
        const key = deptId;
        deptNamesById.set(key, deptName);
        if (!employeesByDept.has(key)) employeesByDept.set(key, []);
        employeesByDept.get(key)!.push(e);
      }
      const deptCursor = new Map<string, number>();
      const pickFromDept = (deptKey: string): any | null => {
        const list = employeesByDept.get(deptKey);
        if (!list || list.length === 0) return null;
        // فلترة بناء على userIds المختارة إن وُجدت
        const filtered = filterUserIds.length > 0
          ? list.filter((e) => filterUserIds.includes(e.user_id))
          : list;
        const pool = filtered.length > 0 ? filtered : list;
        const i = (deptCursor.get(deptKey) ?? 0) % pool.length;
        deptCursor.set(deptKey, i + 1);
        return pool[i];
      };

      const departmentAliases = (deptName: string) => {
        const aliases = [deptName];
        const t = tokenize(deptName);
        if (t.includes("تبرعات") || t.includes("تبرع") || t.includes("جمع")) {
          aliases.push("تنمية الموارد المالية", "الموارد المالية", "استقطاع", "مانحين", "تحصيل مالي", "دعم برامج الجمعية");
        }
        if (t.includes("تسويق") || t.includes("اعلام")) {
          aliases.push("إدارة الإعلام والتسويق", "الإعلام", "التسويق", "منصات التواصل", "محتوى", "هوية بصرية", "حملات رقمية");
        }
        if (t.includes("مشاريع") || t.includes("برامج")) {
          aliases.push("إدارة المشاريع", "المشاريع", "البرامج", "الإغاثة", "كفالة", "تمكين اقتصادي");
        }
        if (t.includes("عامه") || t.includes("عام")) {
          aliases.push("الإدارة التنفيذية", "مجلس الإدارة", "المدير التنفيذي", "إدارة عامة");
        }
        return aliases;
      };

      // كلمات عامة لا تصلح وحدها للمطابقة (مثل "مدير التسويق" لا يجب أن يطابق "المدير التنفيذي" لمجرد كلمة "مدير")
      const GENERIC_TOKENS = new Set(["مدير", "مسؤول", "ريس", "رئيس", "موظف", "مشرف", "منسق", "عضو"]);

      // إيجاد قسم بأفضل تطابق رمزي/دلالي (token overlap + مرادفات الأقسام)
      const findDeptByTokens = (text: string): string | null => {
        const tks = tokenize(text);
        if (tks.length === 0) return null;
        // الكلمات المميّزة فقط (بدون الكلمات العامة) هي أساس المطابقة
        const specific = tks.filter((t) => !GENERIC_TOKENS.has(t));
        if (specific.length === 0) return null;
        let best: { key: string; score: number } | null = null;
        for (const key of employeesByDept.keys()) {
          const aliases = departmentAliases(deptNamesById.get(key) || "");
          for (const alias of aliases) {
            const dtks = tokenize(alias).filter((t) => !GENERIC_TOKENS.has(t));
            if (dtks.length === 0) continue;
            const overlap = dtks.filter((t) => specific.includes(t)).length;
            if (overlap === 0) continue;
            const score = overlap / Math.max(dtks.length, 1);
            if (!best || score > best.score) best = { key, score };
          }
        }
        return best && best.score >= 0.5 ? best.key : null;
      };

      // مطابقة بالمسمى الوظيفي: "مدير التسويق" يطابق موظفاً مسماه الوظيفي كذلك
      const roleCursor = new Map<string, number>();
      const findByJobRole = (text: string): any | null => {
        const respNorm = norm(text);
        const specific = tokenize(text).filter((t) => !GENERIC_TOKENS.has(t));
        // 1) تطابق كامل مع المسمى الوظيفي
        let pool = (allEmployees || []).filter((e: any) => e.user_id && norm(e.job_role || "") === respNorm);
        // 2) تطابق رمزي: كل كلمات المسمى المميّزة موجودة في النص أو العكس
        if (pool.length === 0 && specific.length > 0) {
          pool = (allEmployees || []).filter((e: any) => {
            if (!e.user_id || !e.job_role) return false;
            const rt = tokenize(e.job_role).filter((t) => !GENERIC_TOKENS.has(t));
            if (rt.length === 0) return false;
            return rt.every((t) => specific.includes(t)) || specific.every((t) => rt.includes(t));
          });
        }
        if (pool.length === 0) return null;
        // فلترة بالموظفين المحددين إن وُجدوا
        if (filterUserIds.length > 0) {
          const f = pool.filter((e: any) => filterUserIds.includes(e.user_id));
          if (f.length > 0) pool = f;
        }
        const i = (roleCursor.get(respNorm) ?? 0) % pool.length;
        roleCursor.set(respNorm, i + 1);
        return pool[i];
      };

      for (const ep of excelPlans || []) {
        const cols: string[] = Array.isArray(ep.columns) ? ep.columns : [];
        const rows: any[] = Array.isArray(ep.rows) ? ep.rows : [];

        // اكتشاف الأعمدة (نطابق على الكلمات المفتاحية بالعربية)
        const findCol = (...keys: string[]) =>
          cols.find((c) => keys.some((k) => String(c).includes(k))) || null;

        const goalCol = findCol("الهدف الاستراتيجي", "هدف");
        const initCol = findCol("المبادرة");
        const actCol = findCol("النشاط");
        const respCol = findCol("مسؤول التنفيذ", "المسؤول");
        const targetCol = findCol("المستهدف السنوي", "المستهدف");

        rows.forEach((row: any, idx: number) => {
          const activity = actCol ? String(row[actCol] ?? "").trim() : "";
          if (!activity) return;
          const target = parseInt(String((targetCol && row[targetCol]) || "0").replace(/[^\d.-]/g, ""), 10) || 0;
          if (target <= 0) return;

          const respText = respCol ? String(row[respCol] ?? "").trim() : "";

          // محاولة المطابقة على الموظف أو القسم
          let matchedUserId: string | null = null;
          let matchedEmployeeId: string | null = null;
          let matchedName = respText || "موظف";
          let matchedRole = "";

          if (respText) {
            const respNorm = norm(respText);
            // مطابقة بالاسم بالضبط
            const byName = (allEmployees || []).find((e: any) => norm(e.full_name) === respNorm);
            if (byName?.user_id) {
              matchedUserId = byName.user_id;
              matchedEmployeeId = byName.id;
              matchedName = byName.full_name;
              matchedRole = byName.job_role || "";
            } else {
              // مطابقة بالمسمى الوظيفي أولاً (مدير التسويق ← موظف مسماه مدير التسويق)
              const byRole = findByJobRole(respText);
              if (byRole) {
                matchedUserId = byRole.user_id;
                matchedEmployeeId = byRole.id;
                matchedName = byRole.full_name;
                matchedRole = byRole.job_role || respText;
              }
              // مطابقة بالقسم: أولاً بالضبط، ثم بأقرب تطابق رمزي
              let deptKey: string | null = null;
              if (!matchedUserId) {
              for (const [id, name] of deptNamesById.entries()) {
                if (norm(name) === respNorm) {
                  deptKey = id;
                  break;
                }
              }
              if (!deptKey) deptKey = findDeptByTokens(respText);
              if (deptKey) {
                const picked = pickFromDept(deptKey);
                if (picked) {
                  matchedUserId = picked.user_id;
                  matchedEmployeeId = picked.id;
                  matchedName = picked.full_name;
                  matchedRole = picked.job_role || respText;
                }
              }
              }
            }
          }

          // إذا لم يُربط بأي قسم/موظف، تجاهل هذا الصف بدلاً من إسناده لأول موظف
          if (!matchedUserId) {
            console.log(`⚠️ تعذر مطابقة "مسؤول التنفيذ"="${respText}" لأي قسم/موظف — تم تخطي النشاط: ${activity}`);
            return;
          }

          // فلترة بالموظفين المحددين
          if (filterUserIds.length > 0 && !filterUserIds.includes(matchedUserId)) return;

          virtualPlans.push({
            planId: `excel:${ep.id}:${idx}`,
            planMonthIdSeed: `excel:${ep.id}:${idx}`,
            activityName: activity,
            initiative: initCol ? String(row[initCol] ?? "").trim() || null : null,
            strategicGoal: goalCol ? String(row[goalCol] ?? "").trim() || null : null,
            annualTarget: target,
            userId: matchedUserId,
            employeeId: matchedEmployeeId,
            employeeName: matchedName,
            jobRole: matchedRole,
            isVirtual: true,
            excelPlanId: ep.id,
            rowIndex: idx,
          });
        });
      }
    }

    // أولاً: جلب الأشهر التي فيها خطط تشغيلية فعلاً للموظفين المحددين
    let monthsQuery = supabase
      .from("operational_plan_months")
      .select(`
        month,
        monthly_target,
        operational_plans!inner (
          id,
          user_id,
          responsible_employee_id,
          organization_id,
          year
        )
      `)
      .eq("operational_plans.year", targetYear)
      .gt("monthly_target", 0);

    if (activeOrganizationId) {
      monthsQuery = monthsQuery.eq("operational_plans.organization_id", activeOrganizationId);
    }
    // قَيِّد البحث على الخطط المختارة فقط (إن وُجدت)
    if (filterOperationalIds.length > 0) {
      monthsQuery = monthsQuery.in("operational_plans.id", filterOperationalIds);
    }

    const { data: availableMonths, error: monthsError } = await monthsQuery;
    console.log("[months-query]", {
      targetYear,
      targetMonths,
      userIds: filterUserIds.length,
      employeeIds: filterEmployeeIds.length,
      activeOrganizationId,
      filterOperationalIds: filterOperationalIds.length,
      availableMonthsCount: availableMonths?.length || 0,
      error: monthsError?.message,
      sample: (availableMonths || []).slice(0, 3),
    });
    
    if (monthsError) {
      console.error("Error fetching available months:", monthsError);
    }

    // استخراج الأشهر المتاحة فقط (التي لها مستهدفات شهرية > 0)
    const monthsWithOperational = [...new Set(
      (availableMonths || [])
        .filter((m: any) => Number(m.monthly_target || 0) > 0)
        .filter((m: any) => {
          const plan = m.operational_plans || {};
          const hasPeopleFilter = filterUserIds.length > 0 || filterEmployeeIds.length > 0;
          const userMatch = filterUserIds.length > 0 && filterUserIds.includes(plan.user_id);
          const employeeMatch = filterEmployeeIds.length > 0 && plan.responsible_employee_id && filterEmployeeIds.includes(plan.responsible_employee_id);
          return !hasPeopleFilter || userMatch || employeeMatch;
        })
        .map((m: any) => m.month)
    )];
    // الخطط من Excel ليس لها أشهر محددة، لذا نعتبرها متاحة لأي شهر مُختار
    const monthsWithPlans = virtualPlans.length > 0
      ? [...new Set([...monthsWithOperational, ...targetMonths])]
      : monthsWithOperational;
    
    // تصفية الأشهر المطلوبة لتشمل فقط تلك التي فيها خطط تشغيلية
    const filteredTargetMonths = targetMonths.filter(m => monthsWithPlans.includes(m));
    
    if (filteredTargetMonths.length === 0) {
      const requestedMonthsText =
        targetMonths.length === 12
          ? "جميع الأشهر"
          : targetMonths.map((m) => MONTHS_AR[m - 1]).filter(Boolean).join("، ");

      return new Response(
        JSON.stringify({
          success: false,
          error: `لا توجد مستهدفات شهرية للأشهر المحددة (${requestedMonthsText}) لعام ${targetYear}. يُعتبر الشهر "مخططاً" فقط عندما يكون له مستهدف شهري أكبر من صفر في إحدى الأهداف.`,
          monthsRequested: targetMonths,
          monthsWithPlans: monthsWithPlans,
          year: targetYear,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    let totalPlansGenerated = 0;
    let totalTasksGenerated = 0;
    let totalActivitiesProcessed = 0;
    const processedMonths: string[] = [];

    // ===== تجسيد الخطط الافتراضية من Excel إلى operational_plans حقيقية =====
    // مفتاح: excelPlanId|rowIndex -> operationalPlanId
    const materializedPlanIds = new Map<string, string>();

    async function ensureMaterializedForMonth(targetMonth: number): Promise<Array<{ planId: string; planMonthId: string; meta: any }>> {
      const out: Array<{ planId: string; planMonthId: string; meta: any }> = [];
      for (const vp of virtualPlans) {
        const key = `${vp.excelPlanId}|${vp.rowIndex}`;
        let opId = materializedPlanIds.get(key);

        if (!opId) {
          // إنشاء operational_plan جديد
          const { data: opIns, error: opErr } = await supabase
            .from("operational_plans")
            .insert({
              user_id: vp.userId,
              activity_name: vp.activityName,
              annual_target: vp.annualTarget,
              year: targetYear,
              strategic_goal: vp.strategicGoal,
              initiative: vp.initiative,
              plan_name: "مولّدة من Excel",
              organization_id: activeOrganizationId || (excelPlans || []).find((p: any) => p.id === vp.excelPlanId)?.organization_id || null,
            })
            .select("id")
            .single();
          if (opErr || !opIns) {
            console.error("Failed to materialize op plan:", opErr);
            continue;
          }
          opId = opIns.id;
          materializedPlanIds.set(key, opId);
        }

        // إنشاء/جلب صف الشهر
        const monthlyTarget = Math.max(1, Math.round(vp.annualTarget / 12));
        const { data: existingMonth } = await supabase
          .from("operational_plan_months")
          .select("id")
          .eq("operational_plan_id", opId)
          .eq("month", targetMonth)
          .maybeSingle();

        let monthId = existingMonth?.id;
        if (!monthId) {
          const { data: monthIns, error: monthErr } = await supabase
            .from("operational_plan_months")
            .insert({ operational_plan_id: opId, month: targetMonth, monthly_target: monthlyTarget })
            .select("id")
            .single();
          if (monthErr || !monthIns) {
            console.error("Failed to insert month:", monthErr);
            continue;
          }
          monthId = monthIns.id;
        }

        out.push({
          planId: opId,
          planMonthId: monthId,
          meta: { ...vp, monthlyTarget },
        });
      }
      return out;
    }

    // معالجة كل شهر على حدة (فقط الأشهر التي فيها خطط تشغيلية)
    for (const targetMonth of filteredTargetMonths) {
      // جلب الخطط التشغيلية مع أشهرها
      let query = supabase
        .from("operational_plans")
        .select(`
          id,
          activity_name,
          annual_target,
          initiative,
          strategic_goal,
          user_id,
          organization_id,
          responsible_employee_id,
          operational_plan_months!inner (
            id,
            month,
            monthly_target
          )
        `)
        .eq("year", targetYear)
        .eq("operational_plan_months.month", targetMonth);

      // تصفية حسب خطط تشغيلية محددة
      if (filterOperationalIds.length > 0) {
        query = query.in("id", filterOperationalIds);
      } else if (hasPlanFilter && filterExcelIds.length > 0 && filterOperationalIds.length === 0) {
        // المستخدم اختار فقط خطط Excel — لا نريد جلب operational_plans غير محددة
        query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
      }
      if (activeOrganizationId) {
        query = query.eq("organization_id", activeOrganizationId);
      }

      const { data: operationalPlans, error: fetchError } = await query;

      if (fetchError) {
        console.error(`Fetch error for month ${targetMonth}:`, fetchError);
        continue; // تجاوز الشهر والمتابعة
      }

      // تجسيد الخطط من Excel للشهر الحالي
      const materialized = virtualPlans.length > 0 ? await ensureMaterializedForMonth(targetMonth) : [];

      if ((!operationalPlans || operationalPlans.length === 0) && materialized.length === 0) {
        console.log(`No operational plans for month ${targetMonth}`);
        continue;
      }

      const scopedOperationalPlans = (operationalPlans || []).filter((plan: any) => {
        const hasPeopleFilter = filterUserIds.length > 0 || filterEmployeeIds.length > 0;
        const userMatch = filterUserIds.length > 0 && filterUserIds.includes(plan.user_id);
        const employeeMatch = filterEmployeeIds.length > 0 && plan.responsible_employee_id && filterEmployeeIds.includes(plan.responsible_employee_id);
        return !hasPeopleFilter || userMatch || employeeMatch;
      });

      if (scopedOperationalPlans.length === 0 && materialized.length === 0) {
        console.log(`No scoped operational plans for month ${targetMonth}`);
        continue;
      }

      // جلب أسماء الموظفين
      const allUserIds = [...new Set(scopedOperationalPlans.map((p: any) => p.user_id).filter(Boolean))];
      const allResponsibleIds = [...new Set(scopedOperationalPlans.map((p: any) => p.responsible_employee_id).filter(Boolean))];
      const employeeOrFilter = [
        allUserIds.length ? `user_id.in.(${allUserIds.join(",")})` : "",
        allResponsibleIds.length ? `id.in.(${allResponsibleIds.join(",")})` : "",
      ].filter(Boolean).join(",");
      const { data: employees } = employeeOrFilter
        ? await supabase
            .from("employees")
            .select("id, full_name, user_id, job_role, department_id")
            .or(employeeOrFilter)
        : { data: [] } as any;

      const employeeMap = new Map(employees?.map(e => [e.user_id, e]) || []);
      const employeeByIdMap = new Map(employees?.map(e => [e.id, e]) || []);

      // تجهيز البيانات للذكاء الاصطناعي
      const plansData = scopedOperationalPlans.map((plan: any) => {
        const planMonth = plan.operational_plan_months[0];
        const employee = plan.responsible_employee_id
          ? employeeByIdMap.get(plan.responsible_employee_id)
          : employeeMap.get(plan.user_id);
        return {
          planId: plan.id,
          planMonthId: planMonth.id,
          activityName: plan.activity_name,
          initiative: plan.initiative,
          strategicGoal: plan.strategic_goal,
          monthlyTarget: planMonth.monthly_target,
          annualTarget: plan.annual_target,
          userId: employee?.user_id || plan.user_id,
          employeeId: employee?.id || plan.responsible_employee_id || null,
          organizationId: plan.organization_id,
          employeeName: employee?.full_name || "موظف",
          jobRole: employee?.job_role || "",
        };
      });

      // إضافة الخطط المُجسّدة من Excel
      for (const m of materialized) {
        plansData.push({
          planId: m.planId,
          planMonthId: m.planMonthId,
          activityName: m.meta.activityName,
          initiative: m.meta.initiative,
          strategicGoal: m.meta.strategicGoal,
          monthlyTarget: m.meta.monthlyTarget,
          annualTarget: m.meta.annualTarget,
          userId: m.meta.userId,
          employeeId: m.meta.employeeId || null,
          organizationId: (excelPlans || []).find((p: any) => p.id === m.meta.excelPlanId)?.organization_id || null,
          employeeName: m.meta.employeeName,
          jobRole: m.meta.jobRole,
        });
      }

      if (tadabburMarketingManager?.user_id || tadabburExecutiveDirector?.user_id) {
        for (const planData of plansData) {
          if (planData.organizationId !== TADABBUR_ORG_ID) continue;
          const values = [planData.activityName, planData.initiative, planData.strategicGoal];
          // التسويق له الأولوية (مدير التسويق ناصر)
          if (tadabburMarketingManager?.user_id && isMarketingWork(...values)) {
            planData.userId = tadabburMarketingManager.user_id;
            planData.employeeId = tadabburMarketingManager.id;
            planData.employeeName = tadabburMarketingManager.full_name;
            planData.jobRole = tadabburMarketingManager.job_role || "مدير التسويق";
            continue;
          }
          // التطوير والعمل الإداري للمدير التنفيذي محمد هادي
          if (tadabburExecutiveDirector?.user_id && isDevAdminWork(...values)) {
            planData.userId = tadabburExecutiveDirector.user_id;
            planData.employeeId = tadabburExecutiveDirector.id;
            planData.employeeName = tadabburExecutiveDirector.full_name;
            planData.jobRole = tadabburExecutiveDirector.job_role || "المدير التنفيذي";
          }
        }
      }

      if (plansData.length === 0) {
        console.log(`No plans data for month ${targetMonth}`);
        continue;
      }

      const monthName = MONTHS_AR[targetMonth - 1];
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      // توليد الخطط التنفيذية باستخدام الذكاء الاصطناعي
      const systemPrompt = `أنت مستشار تخطيط استراتيجي متخصص في توزيع المستهدفات على أيام العمل وتفصيل المهام.

مهمتك الأولى: توزيع المستهدف الشهري على أيام العمل بشكل ذكي ومتوازن.
مهمتك الثانية: لكل يوم تنفيذي، توليد مهام تفصيلية مقسمة إلى ثلاث مراحل:
- مهام ما قبل (التحضير والإعداد)
- مهام أثناء (التنفيذ الفعلي)
- مهام ما بعد (المتابعة والتوثيق)

ملاحظة مهمة جداً:
- قد يكون في اليوم الواحد عدة أنشطة لأنها تخص أقساماً/موظفين مختلفين.
- تكرار نفس اليوم بين أنشطة مختلفة مقبول ومطلوب.

قواعد التوزيع:
1. تجنب أيام الجمعة والسبت (عطلة نهاية الأسبوع)
2. وزّع المستهدف بشكل متساوي قدر الإمكان
3. إذا كان المستهدف صغير (1-4)، اختر أيام متفرقة
4. إذا كان المستهدف كبير، وزّعه على معظم أيام العمل
5. تأكد أن مجموع المستهدفات اليومية يساوي المستهدف الشهري

قواعد المهام:
1. كل يوم تنفيذي يحتاج 3-5 مهام كحد أدنى
2. المهام يجب أن تكون عملية ومحددة وقابلة للقياس
3. اجعل المهام متناسبة مع طبيعة النشاط

يجب أن ترد باستخدام الأداة distribute_targets_with_tasks فقط.`;

      const userPrompt = `الشهر: ${monthName} ${targetYear}
عدد أيام الشهر: ${daysInMonth}

الخطط التشغيلية المطلوب توزيعها:
${plansData
  .map(
    (p, i) => `
${i + 1}. النشاط: ${p.activityName}
   المبادرة: ${p.initiative || "غير محدد"}
   الهدف الاستراتيجي: ${p.strategicGoal || "غير محدد"}
   المستهدف الشهري: ${p.monthlyTarget}
   الموظف: ${p.employeeName} (${p.jobRole})
`
  )
  .join("\\n")}

قم بـ:
1. توزيع المستهدف الشهري لكل نشاط على أيام العمل المناسبة
2. لكل يوم تنفيذي، أنشئ مهام تفصيلية مقسمة إلى (قبل - أثناء - بعد)

تنبيه: من الطبيعي أن يتكرر نفس اليوم بين عدة أنشطة.`;

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      // قائمة النماذج للتجربة (fallback) - نبدأ بالأسرع لتقليل وقت الاستجابة
      const models = ["google/gemini-2.5-flash"];

      const buildAiBody = (model: string) => {
        const body: any = {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "distribute_targets_with_tasks",
                description: "توزيع المستهدفات الشهرية على الأيام مع المهام التفصيلية",
                parameters: {
                  type: "object",
                  properties: {
                    distributions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          activityIndex: {
                            type: "number",
                            description: "رقم النشاط (يبدأ من 0)",
                          },
                          days: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                day: { type: "number", description: "رقم اليوم في الشهر" },
                                target: { type: "number", description: "المستهدف لهذا اليوم" },
                                tasks: {
                                  type: "object",
                                  properties: {
                                    before: {
                                      type: "array",
                                      items: { type: "string" },
                                      description: "مهام ما قبل التنفيذ (التحضير والإعداد)",
                                    },
                                    during: {
                                      type: "array",
                                      items: { type: "string" },
                                      description: "مهام أثناء التنفيذ",
                                    },
                                    after: {
                                      type: "array",
                                      items: { type: "string" },
                                      description: "مهام ما بعد التنفيذ (المتابعة والتوثيق)",
                                    },
                                  },
                                  required: ["before", "during", "after"],
                                },
                              },
                              required: ["day", "target", "tasks"],
                            },
                          },
                        },
                        required: ["activityIndex", "days"],
                      },
                    },
                  },
                  required: ["distributions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "distribute_targets_with_tasks" } },
        };
        
        // إضافة temperature فقط لنماذج Gemini (OpenAI gpt-5 لا يدعمها)
        if (model.startsWith("google/")) {
          body.temperature = 0.2;
        }
        
        return body;
      };

      let data: any = null;

      // محاولة مع كل نموذج حتى النجاح
      modelLoop: for (const model of models) {
        for (let attempt = 1; attempt <= 1; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 120_000);

          try {
            console.log(`Trying model ${model}, attempt ${attempt} for month ${targetMonth}`);
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(buildAiBody(model)),
              signal: controller.signal,
            });

            if (!response.ok) {
              if (response.status === 429) {
                return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
                  status: 429,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
              if (response.status === 402) {
                return new Response(JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام الذكاء الاصطناعي" }), {
                  status: 402,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }

              const errorText = await response.text().catch(() => "");
              console.error(`AI HTTP ${response.status} with ${model} attempt ${attempt}:`, errorText.substring(0, 300));
              if (attempt < 2) await sleep(1200);
              continue;
            }

            const json = await response.json().catch(() => ({ error: { message: "Invalid JSON" } }));

            if (json?.error) {
              console.error(`AI provider error with ${model} attempt ${attempt}:`, JSON.stringify(json.error).substring(0, 300));
              if (attempt < 2) await sleep(1200);
              continue;
            }

            data = json;
            console.log(`Success with model ${model} for month ${targetMonth}`);
            break modelLoop;
          } catch (e) {
            console.error(`AI fetch error with ${model} attempt ${attempt}:`, e);
            if (attempt < 2) await sleep(1200);
          } finally {
            clearTimeout(timeout);
          }
        }
      }

      if (!data) {
        console.error(`AI failed completely for month ${targetMonth} after trying all models`);
        continue;
      }

      console.log(`AI response for month ${targetMonth}:`, JSON.stringify(data).substring(0, 500));
      
      const message = data.choices?.[0]?.message;
      let distributions: any;
      
      // محاولة استخراج البيانات من tool_calls
      const toolCall = message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        try {
          distributions = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error(`Failed to parse tool_calls for month ${targetMonth}:`, e);
        }
      }
      
      // إذا فشل، محاولة استخراج من function_call (نسخة قديمة)
      if (!distributions && message?.function_call?.arguments) {
        try {
          distributions = JSON.parse(message.function_call.arguments);
        } catch (e) {
          console.error(`Failed to parse function_call for month ${targetMonth}:`, e);
        }
      }
      
      // إذا فشل، محاولة استخراج JSON من النص
      if (!distributions && message?.content) {
        try {
          const jsonMatch = message.content.match(/\{[\s\S]*"distributions"[\s\S]*\}/);
          if (jsonMatch) {
            distributions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error(`Failed to parse content JSON for month ${targetMonth}:`, e);
        }
      }
      
      if (!distributions || !distributions.distributions) {
        console.error(`No valid distributions found for month ${targetMonth}. Full response:`, JSON.stringify(data));
        continue;
      }
      const executivePlansToInsert: any[] = [];
      const planMetadata: { 
        planMonthId: string; 
        day: number; 
        activityName: string; 
        userId: string; 
        employeeId?: string | null; 
        organizationId?: string | null;
        dailyTarget: number;
        tasks?: { before: string[]; during: string[]; after: string[] };
      }[] = [];

      // تحويل التوزيعات إلى خطط تنفيذية
      for (const dist of distributions.distributions) {
        const planData = plansData[dist.activityIndex];
        if (!planData) continue;

        for (const dayData of dist.days) {
          executivePlansToInsert.push({
            operational_plan_month_id: planData.planMonthId,
            day: dayData.day,
            daily_target: dayData.target,
            achieved: 0,
            status: "pending",
            notes: `تم التوليد بالذكاء الاصطناعي - ${planData.activityName}`,
            organization_id: planData.organizationId || null,
          });
          
          planMetadata.push({
            planMonthId: planData.planMonthId,
            day: dayData.day,
            activityName: planData.activityName,
            userId: planData.userId,
            employeeId: (planData as any).employeeId || null,
            organizationId: planData.organizationId || null,
            dailyTarget: dayData.target,
            tasks: dayData.tasks || { before: [], during: [], after: [] },
          });
        }
      }

      if (executivePlansToInsert.length === 0) {
        console.log(`No plans generated for month ${targetMonth}`);
        continue;
      }

      // حذف الخطط التنفيذية القديمة للشهر نفسه
      const planMonthIds = [...new Set(executivePlansToInsert.map(p => p.operational_plan_month_id))];
      
      // أولاً: جلب الخطط التنفيذية القديمة لحذف المهام المرتبطة بها
      const { data: oldExecutivePlans } = await supabase
        .from("executive_plans")
        .select("id")
        .in("operational_plan_month_id", planMonthIds);
      
      if (oldExecutivePlans && oldExecutivePlans.length > 0) {
        const oldPlanIds = oldExecutivePlans.map(p => p.id);
        // حذف المهام المرتبطة بالخطط القديمة
        await supabase
          .from("tasks")
          .delete()
          .in("executive_plan_id", oldPlanIds);
      }
      
      // حذف الخطط التنفيذية القديمة
      await supabase
        .from("executive_plans")
        .delete()
        .in("operational_plan_month_id", planMonthIds);

      // إدراج الخطط الجديدة
      const { data: insertedPlans, error: insertError } = await supabase
        .from("executive_plans")
        .insert(executivePlansToInsert)
        .select();

      if (insertError) {
        console.error(`Insert error for month ${targetMonth}:`, insertError);
        continue;
      }

      // إنشاء المهام المرتبطة بكل خطة تنفيذية (متعددة لكل خطة)
      const tasksToInsert: any[] = [];
      
      for (let i = 0; i < insertedPlans.length; i++) {
        const executivePlan = insertedPlans[i];
        const metadata = planMetadata[i];
        
        if (!metadata) continue;
        
        // إنشاء تاريخ المهمة
        const dueDate = new Date(targetYear, targetMonth - 1, metadata.day);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        const phases = [
          { phase: "before", label: "ما قبل", priority: "high" as const },
          { phase: "during", label: "أثناء", priority: "medium" as const },
          { phase: "after", label: "ما بعد", priority: "low" as const },
        ];
        
        for (const { phase, label, priority } of phases) {
          const phaseTasks = metadata.tasks?.[phase as keyof typeof metadata.tasks] || [];
          
          for (const taskTitle of phaseTasks) {
            if (!taskTitle || taskTitle.trim() === "") continue;

            const assignToMarketingManager =
              metadata.organizationId === TADABBUR_ORG_ID &&
              tadabburMarketingManager?.user_id &&
              isMarketingWork(metadata.activityName, taskTitle);
            
            tasksToInsert.push({
              title: taskTitle,
              description: `${label} - ${metadata.activityName}`,
              user_id: assignToMarketingManager ? tadabburMarketingManager.user_id : metadata.userId,
              assigned_employee_id: assignToMarketingManager ? tadabburMarketingManager.id : metadata.employeeId || null,
              executive_plan_id: executivePlan.id,
              organization_id: metadata.organizationId || null,
              status: "pending",
              priority,
              due_date: dueDateStr,
              ai_generated: true,
              category: label, // استخدام المرحلة كتصنيف
            });
          }
        }
        
        // إذا لم تُولّد مهام، أنشئ مهمة واحدة على الأقل
        if (!metadata.tasks || 
            ((!metadata.tasks.before || metadata.tasks.before.length === 0) && 
             (!metadata.tasks.during || metadata.tasks.during.length === 0) && 
             (!metadata.tasks.after || metadata.tasks.after.length === 0))) {
          const assignToMarketingManager =
            metadata.organizationId === TADABBUR_ORG_ID &&
            tadabburMarketingManager?.user_id &&
            isMarketingWork(metadata.activityName);
          tasksToInsert.push({
            title: metadata.activityName,
            description: `مهمة مولدة بالذكاء الاصطناعي - المستهدف: ${metadata.dailyTarget}`,
            user_id: assignToMarketingManager ? tadabburMarketingManager.user_id : metadata.userId,
            assigned_employee_id: assignToMarketingManager ? tadabburMarketingManager.id : metadata.employeeId || null,
            executive_plan_id: executivePlan.id,
            organization_id: metadata.organizationId || null,
            status: "pending",
            priority: "medium",
            due_date: dueDateStr,
            ai_generated: true,
            category: "أثناء",
          });
        }
      }
      
      if (tasksToInsert.length > 0) {
        const { data: insertedTasks, error: tasksError } = await supabase
          .from("tasks")
          .insert(tasksToInsert)
          .select();
        
        if (tasksError) {
          console.error(`Tasks insert error for month ${targetMonth}:`, tasksError);
        } else {
          totalTasksGenerated += insertedTasks?.length || 0;
        }
      }

      totalPlansGenerated += insertedPlans.length;
      totalActivitiesProcessed += plansData.length;
      processedMonths.push(monthName);

      // توليد المراحل (تحضير/تنفيذ/ختام) في activity_related_tasks تلقائياً لكل خطة جديدة
      // باستدعاء دالة generate-related-tasks بشكل متوازٍ في الخلفية (fire-and-forget)
      try {
        const fnUrl = `${SUPABASE_URL}/functions/v1/generate-related-tasks`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        };
        // ندفع جميع الاستدعاءات بالتوازي دون انتظار اكتمالها لتسريع الاستجابة
        for (const plan of insertedPlans) {
          fetch(fnUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ executive_plan_id: plan.id }),
          }).catch((e) => console.error("generate-related-tasks bg call failed:", e?.message));
        }
        console.log(`Triggered phases generation for ${insertedPlans.length} plans (month ${targetMonth})`);
      } catch (e) {
        console.error("Failed to trigger phases generation:", e);
      }
    }

    if (totalPlansGenerated === 0) {
      const requestedMonthsText =
        targetMonths.length === 12
          ? "جميع الأشهر"
          : targetMonths.map((m) => MONTHS_AR[m - 1]).filter(Boolean).join("، ");

      return new Response(
        JSON.stringify({
          success: false,
          error: `لا توجد خطط تشغيلية للأشهر المحددة (${requestedMonthsText}) لعام ${targetYear}`,
          monthsRequested: targetMonths,
          year: targetYear,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const monthsText = processedMonths.length === 1 
      ? `شهر ${processedMonths[0]}`
      : processedMonths.length === 12
      ? "جميع الأشهر"
      : `${processedMonths.length} أشهر (${processedMonths.join("، ")})`;

    return new Response(
      JSON.stringify({
        success: true,
        plansCount: totalPlansGenerated,
        tasksCount: totalTasksGenerated,
        message: `تم توليد ${totalPlansGenerated} خطة تنفيذية و ${totalTasksGenerated} مهمة لـ${monthsText} بنجاح`,
        activitiesProcessed: totalActivitiesProcessed,
        monthsProcessed: processedMonths.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-executive-plans error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
