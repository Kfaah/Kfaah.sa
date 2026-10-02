import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar,
  CalendarDays,
  Building2,
  Users,
  User,
  Target,
  ArrowRight,
  Plus,
  Check,
  ChevronLeft,
  ListTodo,
  Sparkles,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { cn, getAvailableYears, toHijri, rtlIsolate, formatNumberPlain } from "@/lib/utils";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const HIJRI_MONTHS_AR = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

function formatHijriShort(date: Date): string {
  const h = toHijri(date);
  return rtlIsolate(`${formatNumberPlain(h.day)} ${HIJRI_MONTHS_AR[h.month - 1] || ""}`);
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
  department_id: string | null;
  department_name: string | null;
}

interface Activity {
  planMonthId: string;       // operational_plan_months.id
  operationalPlanId: string;
  activityName: string;
  monthlyTarget: number;
  responsibleEmployeeId: string | null;
  ownerUserId: string | null;
}

export default function AddExecutivePlan() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const makeOrgUrl = (path: string) => (slug ? `/${slug}${path}` : path);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { currentOrg } = useOrganization();

  const [routeOrgId, setRouteOrgId] = useState<string | null>(null);
  const activeOrgId = slug ? routeOrgId : currentOrg?.id ?? null;

  // Step state
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  // Map planMonthId -> daily target per day (single value applied to each selected day)
  const [selectedActivities, setSelectedActivities] = useState<Record<string, number | "">>({});

  // Data
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const activityRequests = useRef<Record<string, { key: string; id: string }>>({});
  useEffect(() => { setSelectedDays([]); setSelectedActivities({}); }, [year, month]);
  // Inline-add new activity per employee: empId -> { name, monthlyTarget, saving }
  const [newActivityByEmp, setNewActivityByEmp] = useState<Record<string, { name: string; monthlyTarget: number | ""; saving: boolean }>>({});
  // إظهار الأنشطة المقترحة لكل موظف عند الطلب فقط
  const [showSuggestionsByEmp, setShowSuggestionsByEmp] = useState<Record<string, boolean>>({});
  const toggleSuggestions = (empId: string) =>
    setShowSuggestionsByEmp((prev) => ({ ...prev, [empId]: !prev[empId] }));
  // معرّفات الأنشطة التي أضافها المستخدم يدويًا في هذه الجلسة (تظهر دائمًا)
  const [manuallyAddedIds, setManuallyAddedIds] = useState<Set<string>>(new Set());
  const setNewActField = (empId: string, patch: Partial<{ name: string; monthlyTarget: number | ""; saving: boolean }>) =>
    setNewActivityByEmp((prev) => ({
      ...prev,
      [empId]: { name: "", monthlyTarget: "", saving: false, ...(prev[empId] || {}), ...patch },
    }));

  const addActivityForEmployee = async (employee: Employee) => {
    const draft = newActivityByEmp[employee.id];
    const name = (draft?.name || "").trim();
    const monthlyTarget = Number(draft?.monthlyTarget || 0);
    if (!name) {
      toast({ title: "اسم مطلوب", description: "اكتب اسم النشاط", variant: "destructive" });
      return;
    }
    if (!monthlyTarget || monthlyTarget < 1) {
      toast({ title: "مستهدف غير صالح", description: "حدّد مستهدفًا شهريًا أكبر من صفر", variant: "destructive" });
      return;
    }
    setNewActField(employee.id, { saving: true });
    try {
      if (!activeOrgId) throw new Error("لم يتم تحديد الجمعية");
      const payload = { name: "أنشطة يدوية", year, month, goals: [{ name: null, initiatives: [{ name: null, activities: [{ name, annualTarget: monthlyTarget, responsibleEmployeeId: employee.id }] }] }] };
      const key = JSON.stringify(payload);
      if (activityRequests.current[employee.id]?.key !== key) activityRequests.current[employee.id] = { key, id: crypto.randomUUID() };
      const { data, error } = await supabase.rpc("save_manual_operational_plan", { p_org: activeOrgId, p_request_id: activityRequests.current[employee.id].id, p_payload: payload });
      if (error) throw error;
      const result = data as { plan_ids: string[]; month_ids: string[] };
      if (!result?.plan_ids?.[0] || !result?.month_ids?.[0]) throw new Error("تعذر حفظ النشاط");
      const planRow = { id: result.plan_ids[0] }, monthRow = { id: result.month_ids[0] };

      // 3) Update local state: add to activities and auto-select with sane daily target
      const newAct: Activity = {
        planMonthId: monthRow.id,
        operationalPlanId: planRow.id,
        activityName: name,
        monthlyTarget,
        responsibleEmployeeId: employee.id,
        ownerUserId: employee.user_id,
      };
      setActivities((prev) => [...prev, newAct]);
      const days = Math.max(selectedDays.length, 1);
      setSelectedActivities((prev) => ({
        ...prev,
        [monthRow.id]: Math.max(1, Math.ceil(monthlyTarget / days)),
      }));
      setManuallyAddedIds((prev) => {
        const next = new Set(prev);
        next.add(monthRow.id);
        return next;
      });
      setNewActField(employee.id, { name: "", monthlyTarget: "", saving: false });
      toast({ title: "تمت إضافة النشاط", description: name });
    } catch (e: any) {
      setNewActField(employee.id, { saving: false });
      toast({ title: "خطأ", description: e.message || "فشل إضافة النشاط", variant: "destructive" });
    }
  };

  // Resolve org id from slug
  useEffect(() => {
    const resolve = async () => {
      if (!slug) { setRouteOrgId(null); return; }
      if (currentOrg?.slug === slug) { setRouteOrgId(currentOrg.id); return; }
      const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
      setRouteOrgId(data?.id ?? null);
    };
    resolve();
  }, [slug, currentOrg?.id, currentOrg?.slug]);

  // Fetch departments
  useEffect(() => {
    const fetchDeps = async () => {
      if (slug && !activeOrgId) return;
      let q = supabase.from("departments").select("id, name").order("name");
      if (activeOrgId) q = q.eq("organization_id", activeOrgId);
      const { data } = await q;
      setDepartments(data || []);
    };
    fetchDeps();
  }, [activeOrgId, slug]);

  // Fetch employees
  useEffect(() => {
    const fetchEmps = async () => {
      if (slug && !activeOrgId) return;
      let q = supabase
        .from("employees")
        .select("id, full_name, user_id, department_id, departments:department_id(name)")
        .eq("status", "active")
        .order("full_name");
      if (activeOrgId) q = q.eq("organization_id", activeOrgId);
      const { data } = await q;
      const mapped: Employee[] = (data || []).map((e: any) => ({
        id: e.id,
        full_name: e.full_name,
        user_id: e.user_id,
        department_id: e.department_id,
        department_name: e.departments?.name ?? null,
      }));
      setEmployees(mapped);
    };
    fetchEmps();
  }, [activeOrgId, slug]);

  // Filtered employees for current department
  const filteredEmployees = useMemo(() => {
    if (departmentId === "all") return employees;
    return employees.filter((e) => e.department_id === departmentId);
  }, [employees, departmentId]);

  // When department changes: reset employee selection (keep ones still valid)
  useEffect(() => {
    setSelectedEmployeeIds((prev) =>
      prev.filter((id) => filteredEmployees.some((e) => e.id === id))
    );
  }, [departmentId]); // eslint-disable-line

  // Days in month
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

  // Fetch activities (operational_plan_months) for selected employees & month
  useEffect(() => {
    const fetchActivities = async () => {
      if (selectedEmployeeIds.length === 0) {
        setActivities([]);
        return;
      }
      setLoadingActivities(true);
      try {
        // Build employees map: id->user_id
        const empMap = new Map(employees.map((e) => [e.id, e]));
        const empUserIds = selectedEmployeeIds
          .map((id) => empMap.get(id)?.user_id)
          .filter((v): v is string => !!v);

        // operational_plans where (responsible_employee_id IN selectedEmps) OR (user_id IN empUserIds)
        let plansQuery = supabase
          .from("operational_plans")
          .select("id, activity_name, responsible_employee_id, user_id, year")
          .eq("year", year);
        if (activeOrgId) plansQuery = plansQuery.eq("organization_id", activeOrgId);

        // Build OR condition
        const orParts: string[] = [];
        if (selectedEmployeeIds.length > 0) {
          orParts.push(`responsible_employee_id.in.(${selectedEmployeeIds.join(",")})`);
        }
        if (empUserIds.length > 0) {
          orParts.push(`user_id.in.(${empUserIds.join(",")})`);
        }
        if (orParts.length > 0) plansQuery = plansQuery.or(orParts.join(","));

        const { data: plans, error: pErr } = await plansQuery;
        if (pErr) throw pErr;
        if (!plans || plans.length === 0) {
          setActivities([]);
          return;
        }

        const planIds = plans.map((p) => p.id);
        const { data: months, error: mErr } = await supabase
          .from("operational_plan_months")
          .select("id, operational_plan_id, month, monthly_target")
          .in("operational_plan_id", planIds)
          .eq("month", month);
        if (mErr) throw mErr;

        const planMap = new Map(plans.map((p: any) => [p.id, p]));
        const acts: Activity[] = (months || []).map((m: any) => {
          const p = planMap.get(m.operational_plan_id);
          return {
            planMonthId: m.id,
            operationalPlanId: m.operational_plan_id,
            activityName: p?.activity_name || "—",
            monthlyTarget: m.monthly_target || 0,
            responsibleEmployeeId: p?.responsible_employee_id ?? null,
            ownerUserId: p?.user_id ?? null,
          };
        });
        setActivities(acts);

        // Cleanup chosen activities not in new list
        setSelectedActivities((prev) => {
          const next: Record<string, number | ""> = {};
          for (const a of acts) {
            if (prev[a.planMonthId] !== undefined) next[a.planMonthId] = prev[a.planMonthId];
          }
          return next;
        });
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message || "فشل جلب الأنشطة", variant: "destructive" });
      } finally {
        setLoadingActivities(false);
      }
    };
    fetchActivities();
  }, [selectedEmployeeIds, month, year, activeOrgId, employees]); // eslint-disable-line

  // Helpers
  const toggleDay = (d: number) =>
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  const toggleEmployee = (id: string) =>
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleActivity = (planMonthId: string, suggestedTarget: number) =>
    setSelectedActivities((prev) => {
      const next = { ...prev };
      if (next[planMonthId] !== undefined) {
        delete next[planMonthId];
      } else {
        // Default daily target = ceil(monthlyTarget / selectedDays.length) if days chosen
        const days = Math.max(selectedDays.length, 1);
        next[planMonthId] = Math.max(1, Math.ceil(suggestedTarget / days));
      }
      return next;
    });

  // Group activities by employee for display
  const activitiesByEmployee = useMemo(() => {
    const empMap = new Map(employees.map((e) => [e.id, e]));
    const empByUser = new Map(employees.filter((e) => e.user_id).map((e) => [e.user_id!, e]));
    const groups: { employee: Employee; activities: Activity[] }[] = [];
    const buckets = new Map<string, Activity[]>();
    for (const a of activities) {
      const owner =
        (a.responsibleEmployeeId && empMap.get(a.responsibleEmployeeId)) ||
        (a.ownerUserId && empByUser.get(a.ownerUserId)) ||
        null;
      const key = owner?.id ?? "unassigned";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(a);
    }
    for (const id of selectedEmployeeIds) {
      const emp = empMap.get(id);
      if (!emp) continue;
      const list = buckets.get(id) || [];
      groups.push({ employee: emp, activities: list });
    }
    return groups;
  }, [activities, employees, selectedEmployeeIds]);

  const totalSelectedActs = Object.keys(selectedActivities).length;
  const canSubmit =
    !!activeOrgId && selectedDays.length > 0 && selectedEmployeeIds.length > 0 && totalSelectedActs > 0 && !loadingActivities && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: "بيانات ناقصة",
        description: "اختر أيام، موظف واحد على الأقل، ونشاطًا واحدًا على الأقل.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const inserts: any[] = [];
      for (const planMonthId of Object.keys(selectedActivities)) {
        const target = Number(selectedActivities[planMonthId]);
        if (!Number.isInteger(target) || target < 0 || selectedActivities[planMonthId] === "") throw new Error("أدخل مستهدفًا يوميًا صحيحًا");
        for (const day of selectedDays) {
          inserts.push({
            operational_plan_month_id: planMonthId,
            day,
            daily_target: target,
            achieved: 0,
            status: "pending",
          });
        }
      }

      const { data, error } = await supabase.rpc("save_manual_executive_plans", { p_org: activeOrgId!, p_rows: inserts });
      if (error) throw error;
      const result = data as { created_ids: string[]; saved_ids: string[]; kept_count: number };
      let failedPhases = 0;
      for (const id of [...new Set(result.saved_ids)]) {
        const { data: phases, error: phaseError } = await supabase.functions.invoke("generate-related-tasks", { body: { executive_plan_id: id } });
        if (phaseError || !phases?.ok || phases?.skipped_no_user?.length) failedPhases++;
      }
      toast({
        title: failedPhases ? "حُفظت الخطط وتحتاج بعض المهام إلى متابعة" : "تم حفظ الخطط والمهام",
        description: 'أضيفت ' + result.created_ids.length + ' خطة، وحُفظت ' + result.kept_count + ' خطة سابقة دون تغيير.' + (failedPhases ? ' افتح مراحل النشاط لإكمال توليد المهام أو ربط حساب الموظف.' : ''),
        variant: failedPhases ? "destructive" : undefined,
      });
      navigate(makeOrgUrl("/executive-plans"));
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل الحفظ", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Step completion flags for the visual stepper
  const stepStates = {
    month: true,
    days: selectedDays.length > 0,
    department: true,
    employees: selectedEmployeeIds.length > 0,
    activities: totalSelectedActs > 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-24">
        <PageHeader
          icon={<Plus className="w-6 h-6" />}
          title="إضافة خطة تنفيذية"
          subtitle="نمط متدرّج: شهر ← أيام ← قسم ← موظفون ← أنشطة"
          actions={
            <Button
              variant="outline"
              className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25"
              onClick={() => navigate(makeOrgUrl("/executive-plans"))}
            >
              <ArrowRight className="w-4 h-4" />
              رجوع
            </Button>
          }
        />

        {/* Stepper indicator */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          {[
            { key: "month", label: "الشهر", icon: CalendarDays, done: stepStates.month },
            { key: "days", label: "الأيام", icon: Calendar, done: stepStates.days },
            { key: "department", label: "القسم", icon: Building2, done: stepStates.department },
            { key: "employees", label: "الموظفون", icon: Users, done: stepStates.employees },
            { key: "activities", label: "الأنشطة", icon: Target, done: stepStates.activities },
          ].map((s, i, arr) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-2 shrink-0">
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-colors",
                    s.done
                      ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
                      : "bg-slate-50 border-slate-200 text-slate-400",
                  )}
                >
                  {s.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={cn("text-sm font-semibold", s.done ? "text-slate-800" : "text-slate-400")}>
                  {s.label}
                </span>
                {i < arr.length - 1 && <ChevronLeft className="w-4 h-4 text-slate-300" />}
              </div>
            );
          })}
        </div>

        {/* 1. Month + Year */}
        <SectionCard
          step={1}
          title="اختر الشهر والسنة"
          icon={<CalendarDays className="w-5 h-5 text-white" />}
          tone="purple"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">السنة</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {getAvailableYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الشهر</label>
              <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setSelectedDays([]); }} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {MONTHS_AR.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {/* 2. Days */}
        <SectionCard
          step={2}
          title="اختر الأيام"
          icon={<Calendar className="w-5 h-5 text-white" />}
          tone="blue"
          right={
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[hsl(var(--primary))]">
                {selectedDays.length} يوم مختار
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => {
                  // pick weekdays only (Sun-Thu)
                  const days: number[] = [];
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dow = new Date(year, month - 1, d).getDay();
                    if (dow >= 0 && dow <= 4) days.push(d); // Sun=0, Thu=4
                  }
                  setSelectedDays(days);
                }}
              >
                أيام العمل
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectedDays([])}>
                مسح
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-2 p-3 bg-slate-50 rounded-xl border">
            {WEEKDAYS_AR.map((d) => (
              <div key={d} className="text-center text-xs font-bold text-slate-500 pb-1">{d}</div>
            ))}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
              <div key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month - 1, day);
              const sel = selectedDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "p-2 rounded-lg text-center border-2 transition-all",
                    sel
                      ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))] shadow-md"
                      : "bg-white hover:bg-slate-100 border-transparent hover:border-[hsl(var(--primary)/0.3)]",
                  )}
                >
                  <div className="text-base font-bold">{day}</div>
                  <div className={cn("text-[10px]", sel ? "text-white/85" : "text-slate-500")}>
                    {formatHijriShort(date)}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* 3. Department */}
        <SectionCard
          step={3}
          title="اختر القسم"
          icon={<Building2 className="w-5 h-5 text-white" />}
          tone="emerald"
        >
          <Select value={departmentId} onValueChange={setDepartmentId} dir="rtl">
            <SelectTrigger className="w-full md:w-80"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
            <SelectContent className="bg-white z-50">
              <SelectItem value="all">كل الأقسام</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SectionCard>

        {/* 4. Employees (multi) */}
        <SectionCard
          step={4}
          title="اختر الموظفين"
          icon={<Users className="w-5 h-5 text-white" />}
          tone="indigo"
          right={
            <div className="flex gap-2">
              <Badge variant="outline" className="text-indigo-700 border-indigo-300">
                {selectedEmployeeIds.length} موظف مختار
              </Badge>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => setSelectedEmployeeIds(filteredEmployees.map((e) => e.id))}
              >
                الكل
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => setSelectedEmployeeIds([])}
              >
                مسح
              </Button>
            </div>
          }
        >
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg">
              لا يوجد موظفون في هذا القسم
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto p-1">
              {filteredEmployees.map((emp) => {
                const sel = selectedEmployeeIds.includes(emp.id);
                return (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={() => toggleEmployee(emp.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right",
                      sel
                        ? "bg-indigo-50 border-indigo-400 shadow-sm"
                        : "bg-white border-slate-200 hover:border-indigo-200",
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        sel ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{emp.full_name}</div>
                      {emp.department_name && (
                        <div className="text-[11px] text-slate-500 truncate">{emp.department_name}</div>
                      )}
                    </div>
                    <Checkbox checked={sel} className="pointer-events-none" />
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* 5. Activities/Tasks */}
        <SectionCard
          step={5}
          title="اختر الأنشطة لكل موظف"
          icon={<Target className="w-5 h-5 text-white" />}
          tone="amber"
          right={
            <Badge variant="outline" className="text-amber-700 border-amber-300">
              {totalSelectedActs} {totalSelectedActs >= 3 && totalSelectedActs <= 10 ? "أنشطة" : "نشاط"} مختار
            </Badge>
          }
        >
          {selectedEmployeeIds.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg">
              اختر موظفاً واحداً على الأقل لعرض أنشطته
            </p>
          ) : loadingActivities ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل الأنشطة...
            </div>
          ) : (
            <div className="space-y-4">
              {activitiesByEmployee.every((g) => g.activities.length === 0) && (
                <div className="text-center py-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700">
                    لا توجد أنشطة جاهزة لهذا الشهر — يمكنك إضافة أنشطة جديدة لكل موظف بالأسفل
                  </p>
                </div>
              )}
              {activitiesByEmployee.map(({ employee, activities: acts }) => {
                const manualActs = acts.filter((a) => manuallyAddedIds.has(a.planMonthId));
                const suggestedActs = acts.filter((a) => !manuallyAddedIds.has(a.planMonthId));
                const renderActivityRow = (a: Activity, tone: "manual" | "suggested") => {
                  const sel = selectedActivities[a.planMonthId] !== undefined;
                  const dailyVal = sel ? selectedActivities[a.planMonthId] : "";
                  return (
                    <div
                      key={a.planMonthId}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-colors",
                        tone === "manual"
                          ? "bg-emerald-50/60 hover:bg-emerald-50"
                          : sel ? "bg-amber-50/50" : "hover:bg-slate-50",
                      )}
                    >
                      <Checkbox
                        checked={sel}
                        onCheckedChange={() => toggleActivity(a.planMonthId, a.monthlyTarget)}
                      />
                      <Target className={cn("w-4 h-4 shrink-0", tone === "manual" ? "text-emerald-600" : "text-[hsl(var(--primary))]")} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-slate-800 truncate flex items-center gap-2">
                          {a.activityName}
                          {tone === "manual" && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-700 border-emerald-300 bg-emerald-50">
                              مُضاف الآن
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          المستهدف الشهري: {a.monthlyTarget}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-600 whitespace-nowrap">المستهدف اليومي</label>
                        <Input
                          type="number"
                          min={1}
                          disabled={!sel}
                          value={dailyVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedActivities((prev) => ({
                              ...prev,
                              [a.planMonthId]: v === "" ? "" : Math.max(1, Number(v)),
                            }));
                          }}
                          className="w-20 h-8 text-center"
                        />
                      </div>
                    </div>
                  );
                };
                return (
                <React.Fragment key={employee.id}>
                <div key={employee.id} className="border-2 border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-800">{employee.full_name}</span>
                    <div className="mr-auto flex items-center gap-2">
                      {suggestedActs.length > 0 && (
                        <Button
                          type="button"
                          variant={showSuggestionsByEmp[employee.id] ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleSuggestions(employee.id)}
                          className={cn(
                            "h-7 px-2.5 text-[11px] gap-1.5",
                            showSuggestionsByEmp[employee.id]
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "text-amber-700 border-amber-300 hover:bg-amber-50",
                          )}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {showSuggestionsByEmp[employee.id] ? "إخفاء المقترحة" : `أنشطة مقترحة (${suggestedActs.length})`}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* الأنشطة المضافة يدويًا — تظهر دائمًا */}
                  {manualActs.length > 0 && (
                    <div className="divide-y divide-emerald-100">
                      {manualActs.map((a) => renderActivityRow(a, "manual"))}
                    </div>
                  )}

                  {/* الأنشطة المقترحة من النظام — تظهر فقط عند الطلب */}
                  {suggestedActs.length > 0 && showSuggestionsByEmp[employee.id] && (
                    <div className="divide-y divide-slate-100">
                      {suggestedActs.map((a) => renderActivityRow(a, "suggested"))}
                    </div>
                  )}

                  {/* Inline: add a new activity for this employee */}
                  {(() => {
                    const draft = newActivityByEmp[employee.id] || { name: "", monthlyTarget: "", saving: false };
                    return (
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/40 border-t border-emerald-100">
                        <div className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <Input
                          placeholder={`أضف نشاطًا جديدًا لـ ${employee.full_name}`}
                          value={draft.name}
                          onChange={(e) => setNewActField(employee.id, { name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") addActivityForEmployee(employee); }}
                          className="h-9 flex-1 text-sm bg-white"
                          disabled={draft.saving}
                        />
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-slate-600 whitespace-nowrap">المستهدف الشهري</label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="0"
                            value={draft.monthlyTarget}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewActField(employee.id, { monthlyTarget: v === "" ? "" : Math.max(1, Number(v)) });
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") addActivityForEmployee(employee); }}
                            className="w-20 h-9 text-center bg-white"
                            disabled={draft.saving}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addActivityForEmployee(employee)}
                          disabled={draft.saving || !draft.name.trim() || !draft.monthlyTarget}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {draft.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          إضافة
                        </Button>
                      </div>
                    );
                  })()}
                </div>
                </React.Fragment>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Sticky submit */}
        <div className="sticky bottom-4 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.85)] border border-[hsl(var(--primary))] rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
          <div className="text-sm text-white/95 font-medium flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {selectedDays.length} يوم</span>
            <span className="text-white/40">·</span>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {selectedEmployeeIds.length} موظف</span>
            <span className="text-white/40">·</span>
            <span className="flex items-center gap-1"><ListTodo className="w-4 h-4" /> {totalSelectedActs} {totalSelectedActs >= 3 && totalSelectedActs <= 10 ? "أنشطة" : "نشاط"}</span>
            <span className="text-white/40">·</span>
            <span className="font-bold">
              المجموع: {selectedDays.length * totalSelectedActs} خطة تنفيذية
            </span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2 bg-white text-[hsl(var(--primary))] hover:bg-white/90 font-bold shadow-lg px-6"
            size="lg"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
            ) : (
              <><Plus className="w-5 h-5" /> إضافة الخطط التنفيذية</>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ─────── Section card wrapper ─────── */
function SectionCard({
  step,
  title,
  icon,
  tone,
  right,
  children,
}: {
  step: number;
  title: string;
  icon: React.ReactNode;
  tone: "purple" | "blue" | "emerald" | "indigo" | "amber";
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    purple: "from-violet-500 to-purple-600",
    blue: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    indigo: "from-indigo-500 to-blue-600",
    amber: "from-amber-500 to-orange-600",
  };
  const borderToneMap: Record<string, string> = {
    purple: "border-violet-100",
    blue: "border-sky-100",
    emerald: "border-emerald-100",
    indigo: "border-indigo-100",
    amber: "border-amber-100",
  };
  const iconCls = toneMap[tone];
  const borderCls = borderToneMap[tone];
  return (
    <section className={cn("bg-white rounded-2xl border-2 p-5 shadow-sm", borderCls)}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md", iconCls)}>
            {icon}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400">الخطوة {step}</div>
            <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}