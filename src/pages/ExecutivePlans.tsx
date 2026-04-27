import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  Calendar,
  User,
  Target,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  ListTodo,
  CalendarDays,
  Sparkles,
  Loader2,
  Building2,
  Filter,
  X,
  Users,
  TrendingUp,
  BarChart3,
  Activity,
  Zap,
  FileSpreadsheet,
  Upload,
  ChevronUp,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatNumberPlain, rtlIsolate, getAvailableYears, cn } from "@/lib/utils";
import { useScopedView } from "@/hooks/useScopedView";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
  job_role?: string;
  department_id?: string | null;
  department_name?: string | null;
}

interface OperationalPlan {
  id: string;
  activity_name: string;
  annual_target: number;
  user_id: string;
  strategic_goal: string | null;
  initiative: string | null;
  responsible_employee_id?: string | null;
}

interface OperationalPlanMonth {
  id: string;
  operational_plan_id: string;
  month: number;
  monthly_target: number;
}

interface ExecutivePlan {
  id: string;
  operational_plan_month_id: string;
  day: number;
  daily_target: number;
  achieved: number;
  status: string;
  notes: string | null;
}

interface ExecutivePlanWithDetails extends ExecutivePlan {
  activityName: string;
  month: number;
  monthlyTarget: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  executive_plan_id: string | null;
  category: string | null;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const QUERY_CHUNK_SIZE = 80;

function chunkArray<T>(items: T[], size = QUERY_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

// تحويل التاريخ الميلادي إلى هجري (تقريبي)
function toHijri(date: Date): { day: number; month: number; year: number; monthName: string } {
  const gregorianYear = date.getFullYear();
  const gregorianMonth = date.getMonth() + 1;
  const gregorianDay = date.getDate();
  
  // صيغة تقريبية للتحويل
  const jd = Math.floor((1461 * (gregorianYear + 4800 + Math.floor((gregorianMonth - 14) / 12))) / 4) +
             Math.floor((367 * (gregorianMonth - 2 - 12 * Math.floor((gregorianMonth - 14) / 12))) / 12) -
             Math.floor((3 * Math.floor((gregorianYear + 4900 + Math.floor((gregorianMonth - 14) / 12)) / 100)) / 4) +
             gregorianDay - 32075;
  
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
            Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
             Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hijriMonth = Math.floor((24 * l3) / 709);
  const hijriDay = l3 - Math.floor((709 * hijriMonth) / 24);
  const hijriYear = 30 * n + j - 30;
  
  return {
    day: hijriDay,
    month: hijriMonth,
    year: hijriYear,
    monthName: HIJRI_MONTHS[hijriMonth - 1] || ""
  };
}

function formatHijriDate(date: Date): string {
  const hijri = toHijri(date);
  // نستخدم RTL isolate لضمان العرض الصحيح: 14 رجب 1447هـ
  return rtlIsolate(`${formatNumberPlain(hijri.day)} ${hijri.monthName} ${formatNumberPlain(hijri.year)}هـ`);
}

function formatGregorianDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  // DD / MM / YYYY
  return rtlIsolate(`${day} / ${month} / ${year}`);
}

// تنسيق التاريخ الهجري المختصر (يوم وشهر فقط)
function formatHijriShort(date: Date): string {
  const hijri = toHijri(date);
  return rtlIsolate(`${formatNumberPlain(hijri.day)} ${hijri.monthName}`);
}

// تنسيق التاريخ الميلادي المختصر (يوم وشهر فقط)
function formatGregorianShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return rtlIsolate(`${day} / ${month}`);
}

function wrapTextByChars(text: string, maxChars = 30): string {
  const raw = (text ?? "").toString().trim();
  if (!raw) return "";

  const words = raw.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  const pushWordOrSplit = (word: string) => {
    if (word.length <= maxChars) {
      line = word;
      return;
    }

    // كلمة أطول من الحد: نقسمها إلى مقاطع
    const chunks = word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word];
    for (let i = 0; i < chunks.length; i++) {
      if (i === chunks.length - 1) {
        line = chunks[i];
      } else {
        lines.push(chunks[i]);
      }
    }
  };

  for (const word of words) {
    if (!line) {
      pushWordOrSplit(word);
      continue;
    }

    const candidate = `${line} ${word}`;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      lines.push(line);
      line = "";
      pushWordOrSplit(word);
    }
  }

  if (line) lines.push(line);
  return lines.join("\n");
}

export default function ExecutivePlans({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const makeOrgUrl = (path: string) => (slug ? `/${slug}${path}` : path);
  const { currentOrg } = useOrganization();
  const scopedView = useScopedView("scope:executive-plans");
  const [isAdmin, setIsAdmin] = useState(false);
  const [routeOrgId, setRouteOrgId] = useState<string | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [operationalPlans, setOperationalPlans] = useState<OperationalPlan[]>([]);
  const [planMonths, setPlanMonths] = useState<OperationalPlanMonth[]>([]);
  const [executivePlans, setExecutivePlans] = useState<ExecutivePlan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());
  const [globalViewMode, setGlobalViewMode] = useState<"dates" | "tasks">("dates"); // الافتراضي بحسب التواريخ
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState<
    { current: number; total: number; month: number | null } | null
  >(null);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isAIChoiceDialogOpen, setIsAIChoiceDialogOpen] = useState(false);
  const [aiSelectedMonths, setAiSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [isEditMode, setIsEditMode] = useState(false);
  // فلاتر إضافية
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("all");
  const [filterMonths, setFilterMonths] = useState<number[]>([]); // أشهر محددة للفلترة
  
  // حالة نافذة الإضافة
  const [selectedPlanMonthId, setSelectedPlanMonthId] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [addingMonth, setAddingMonth] = useState<number>(1);
  const activeOrgId = slug ? routeOrgId : currentOrg?.id ?? null;

  // التحقق من صلاحية المدير
  useEffect(() => {
    const checkAdmin = async () => {
      if (!authUser) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: authUser.id });
      setIsAdmin(data === "admin" || data === "super_admin");
    };
    checkAdmin();
  }, [authUser]);

  useEffect(() => {
    const resolveRouteOrg = async () => {
      if (!slug) {
        setRouteOrgId(null);
        return;
      }
      if (currentOrg?.slug === slug) {
        setRouteOrgId(currentOrg.id);
        return;
      }

      const { data } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setRouteOrgId(data?.id ?? null);
    };

    resolveRouteOrg();
  }, [slug, currentOrg?.id, currentOrg?.slug]);

  // جلب الأقسام
  useEffect(() => {
    const fetchDepartments = async () => {
      if (slug && !activeOrgId) return;
      let query = supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (activeOrgId) query = query.eq("organization_id", activeOrgId);
      const { data, error } = await query;
      
      if (!error && data) {
        setDepartments(data);
      }
    };
    fetchDepartments();
  }, [activeOrgId]);

  // جلب الموظفين
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!authUser) return;
      if (slug && !activeOrgId) return;
      
      // جلب قائمة الموظفين للجميع (للبحث عن employee.id)
      let query = supabase
        .from("employees")
        .select(`
          id, 
          full_name, 
          user_id, 
          job_role,
          department_id,
          departments:department_id (name)
        `)
        .eq("status", "active");
      if (activeOrgId) query = query.eq("organization_id", activeOrgId);
      const { data, error } = await query;
      
      if (error) {
        toast({ title: "خطأ", description: "فشل في جلب الموظفين", variant: "destructive" });
        return;
      }
      
      const formattedEmployees = (data || []).map((emp: any) => ({
        id: emp.id,
        full_name: emp.full_name,
        user_id: emp.user_id,
        job_role: emp.job_role,
        department_id: emp.department_id,
        department_name: emp.departments?.name || null,
      }));
      
      setEmployees(formattedEmployees);
      
      // تعيين الموظف المختار حسب الدور
      if (!isAdmin) {
        setSelectedEmployeeId(authUser.id);
      } else {
        // تعيين "الكل" كافتراضي للمدير
        setSelectedEmployeeId("all");
      }
    };
    
    fetchEmployees();
  }, [isAdmin, authUser, activeOrgId]);

  // تحديد المستخدمين المختارين بناءً على الفلتر
  // ملاحظة: الخطط التشغيلية مرتبطة بـ user_id (معرّف حساب المستخدم)، وليس employee.id
  const getFilteredUserIds = (): { userIds: string[]; employeeIds: string[] } => {
    let filteredEmployees = [...employees];

    // فلتر القسم
    if (filterDepartmentId !== "all") {
      filteredEmployees = filteredEmployees.filter((e) => e.department_id === filterDepartmentId);
    }

    // "الكل" = كل الموظفين الذين لديهم user_id فقط
    if (selectedEmployeeId === "all") {
      const userIds = filteredEmployees.filter((e) => e.user_id).map((e) => e.user_id!);
      const employeeIds = filteredEmployees.map((e) => e.id);
      // دائماً أضف المستخدم الحالي إذا لم يكن موجوداً
      if (authUser && !userIds.includes(authUser.id)) {
        userIds.push(authUser.id);
      }
      return { userIds, employeeIds };
    }

    // قد تكون القيمة المختارة user_id أو employee.id (لبعض الموظفين الذين لا يملكون حساباً مرتبطاً)
    const selectedEmployee =
      employees.find((e) => e.user_id === selectedEmployeeId) ||
      employees.find((e) => e.id === selectedEmployeeId);

    const selectedUserId = selectedEmployee?.user_id ?? selectedEmployeeId;
    const selectedEmpId = selectedEmployee?.id ?? selectedEmployeeId;

    // إذا كان الموظف لا يملك user_id فعرض خططه كمسؤول تنفيذ
    if (selectedEmployee && !selectedEmployee.user_id) {
      return { userIds: [], employeeIds: [selectedEmployee.id] };
    }

    // إذا كان مدير النظام أو المدير التنفيذي - عرض الكل (مع فلتر القسم)
    const isExecutiveOrAdmin =
      selectedEmployee?.job_role === "مدير النظام" ||
      selectedEmployee?.job_role === "المدير التنفيذي";
    if (isExecutiveOrAdmin) {
      const userIds = filteredEmployees.filter((e) => e.user_id).map((e) => e.user_id!);
      const employeeIds = filteredEmployees.map((e) => e.id);
      // دائماً أضف المستخدم الحالي إذا لم يكن موجوداً
      if (authUser && !userIds.includes(authUser.id)) {
        userIds.push(authUser.id);
      }
      return { userIds, employeeIds };
    }

    // إذا كان رئيس قسم - عرض موظفي القسم فقط
    const isDepartmentHead = selectedEmployee?.job_role?.includes("رئيس قسم");
    if (isDepartmentHead && selectedEmployee?.department_id) {
      const deptEmployees = filteredEmployees.filter(
        (e) => e.department_id === selectedEmployee.department_id
      );
      return { 
        userIds: deptEmployees.filter(e => e.user_id).map((e) => e.user_id!), 
        employeeIds: deptEmployees.map((e) => e.id) 
      };
    }

    // مستخدم/موظف عادي - عرض خططه كمنشئ أو كمسؤول تنفيذ
    return { userIds: [selectedUserId], employeeIds: [selectedEmpId] };
  };

  // جلب جميع الخطط
  useEffect(() => {
    const fetchAllPlans = async () => {
      if (!selectedEmployeeId) return;
      
      setLoading(true);
      try {
        const { userIds, employeeIds } = getFilteredUserIds();
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validUserIds = Array.from(new Set(userIds.filter((v): v is string => !!v && UUID_RE.test(v))));
        const validEmployeeIds = Array.from(new Set(employeeIds.filter((v): v is string => !!v && UUID_RE.test(v))));
        if (validUserIds.length === 0 && validEmployeeIds.length === 0) {
          setOperationalPlans([]);
          setPlanMonths([]);
          setExecutivePlans([]);
          setLoading(false);
          return;
        }

        // جلب الخطط التشغيلية للموظفين المختارين (كمنشئ أو كمسؤول تنفيذ)
        let allPlans: OperationalPlan[] = [];
        
        // جلب الخطط حسب user_id (المنشئ)
        if (validUserIds.length > 0) {
          for (const ids of chunkArray(validUserIds)) {
            let query = supabase
              .from("operational_plans")
              .select("*")
              .in("user_id", ids)
              .eq("year", selectedYear);
            if (activeOrgId) query = query.eq("organization_id", activeOrgId);
            const { data: plansByUser, error: userError } = await query;
            
            if (userError) throw userError;
            if (plansByUser) allPlans = [...allPlans, ...plansByUser];
          }
        }
        
        // جلب الخطط حسب responsible_employee_id (المسؤول عن التنفيذ)
        if (validEmployeeIds.length > 0) {
          for (const ids of chunkArray(validEmployeeIds)) {
            let query = supabase
              .from("operational_plans")
              .select("*")
              .in("responsible_employee_id", ids)
              .eq("year", selectedYear);
            if (activeOrgId) query = query.eq("organization_id", activeOrgId);
            const { data: plansByEmployee, error: empError } = await query;
            
            if (empError) throw empError;
            if (plansByEmployee) allPlans = [...allPlans, ...plansByEmployee];
          }
        }

        allPlans = Array.from(new Map(allPlans.map((p) => [p.id, p])).values());
        
        setOperationalPlans(allPlans);
        
        if (allPlans.length === 0) {
          setPlanMonths([]);
          setExecutivePlans([]);
          setLoading(false);
          return;
        }
        
        // جلب جميع أشهر الخطط
        const planIds = allPlans.map(p => p.id);
        const months: OperationalPlanMonth[] = [];
        for (const ids of chunkArray(planIds)) {
          let query = supabase
            .from("operational_plan_months")
            .select("*")
            .in("operational_plan_id", ids)
            .order("month", { ascending: true });
          if (activeOrgId) query = query.eq("organization_id", activeOrgId);
          const { data: monthChunk, error: monthsError } = await query;
          if (monthsError) throw monthsError;
          if (monthChunk) months.push(...monthChunk);
        }
        months.sort((a, b) => a.month - b.month);
        setPlanMonths(months);
        
        // جلب الخطط التنفيذية
        if (months.length > 0) {
          const monthIds = months.map(m => m.id);
          const executive: ExecutivePlan[] = [];
          for (const ids of chunkArray(monthIds)) {
            let query = supabase
              .from("executive_plans")
              .select("*")
              .in("operational_plan_month_id", ids)
              .order("day", { ascending: true });
            if (activeOrgId) query = query.eq("organization_id", activeOrgId);
            const { data: executiveChunk, error: execError } = await query;
            if (execError) throw execError;
            if (executiveChunk) executive.push(...executiveChunk);
          }
          executive.sort((a, b) => a.day - b.day);
          setExecutivePlans(executive);
          
          // جلب المهام المرتبطة بالخطط التنفيذية
          if (executive.length > 0) {
            const execIds = executive.map(e => e.id);
            const nextTasks: Task[] = [];
            for (const ids of chunkArray(execIds)) {
              let query = supabase
                .from("tasks")
                .select("id, title, status, priority, executive_plan_id, category")
                .in("executive_plan_id", ids);
              if (activeOrgId) query = query.eq("organization_id", activeOrgId);
              const { data: tasksData, error: tasksError } = await query;
              if (!tasksError && tasksData) nextTasks.push(...tasksData);
            }
            setTasks(nextTasks);
          } else {
            setTasks([]);
          }
        } else {
          setExecutivePlans([]);
          setTasks([]);
        }
      } catch (error: any) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllPlans();
  }, [selectedEmployeeId, selectedYear, employees, activeOrgId]);

  // تجميع الخطط التنفيذية حسب الشهر والمهمة
  const groupedPlans = useMemo(() => {
    const groups: {
      month: number;
      monthName: string;
      activities: {
        activityName: string;
        planMonthId: string;
        monthlyTarget: number;
        days: {
          id: string;
          day: number;
          dailyTarget: number;
          achieved: number;
          status: string;
          gregorianDate: string;
          hijriDate: string;
          weekDay: string;
        }[];
      }[];
      // تجميع حسب التاريخ
      dateGroups: {
        day: number;
        gregorianDate: string;
        hijriDate: string;
        weekDay: string;
        activities: {
          id: string;
          activityName: string;
          dailyTarget: number;
          achieved: number;
          status: string;
          employeeId: string | null;
          employeeName: string;
          departmentId: string | null;
          departmentName: string;
        }[];
      }[];
    }[] = [];
    
    // تجميع حسب الشهر (مع تطبيق فلتر الأشهر)
    const monthsToShow = filterMonths.length > 0 ? filterMonths : Array.from({ length: 12 }, (_, i) => i + 1);
    
    for (const month of monthsToShow) {
      const monthActivities: typeof groups[0]["activities"] = [];
      const dateMap = new Map<number, typeof groups[0]["dateGroups"][0]>();
      
      planMonths.filter(pm => pm.month === month).forEach(pm => {
        const plan = operationalPlans.find(p => p.id === pm.operational_plan_id);
        if (!plan) return;

        // تحديد الموظف المسؤول عن هذا النشاط (responsible_employee_id أولاً، وإلا مالك الخطة)
        const respEmp = plan.responsible_employee_id
          ? employees.find((e) => e.id === plan.responsible_employee_id)
          : employees.find((e) => e.user_id === plan.user_id);
        const employeeId = respEmp?.id ?? null;
        const employeeName = respEmp?.full_name ?? "غير محدد";
        const departmentId = respEmp?.department_id ?? null;
        const departmentName = respEmp?.department_name ?? "بدون قسم";
        
        const dayPlans = executivePlans
          .filter(ep => ep.operational_plan_month_id === pm.id)
          .map(ep => {
            const date = new Date(selectedYear, month - 1, ep.day);
            return {
              id: ep.id,
              day: ep.day,
              dailyTarget: ep.daily_target,
              achieved: ep.achieved,
              status: ep.status,
              gregorianDate: formatGregorianDate(date),
              hijriDate: formatHijriDate(date),
              weekDay: WEEKDAYS_AR[date.getDay()],
            };
          });
        
        // إضافة للمهام
        if (dayPlans.length > 0 || pm.monthly_target > 0) {
          monthActivities.push({
            activityName: plan.activity_name,
            planMonthId: pm.id,
            monthlyTarget: pm.monthly_target,
            days: dayPlans,
          });
        }
        
        // إضافة للتواريخ
        dayPlans.forEach(dayPlan => {
          if (!dateMap.has(dayPlan.day)) {
            dateMap.set(dayPlan.day, {
              day: dayPlan.day,
              gregorianDate: dayPlan.gregorianDate,
              hijriDate: dayPlan.hijriDate,
              weekDay: dayPlan.weekDay,
              activities: [],
            });
          }
          dateMap.get(dayPlan.day)!.activities.push({
            id: dayPlan.id,
            activityName: plan.activity_name,
            dailyTarget: dayPlan.dailyTarget,
            achieved: dayPlan.achieved,
            status: dayPlan.status,
            employeeId,
            employeeName,
            departmentId,
            departmentName,
          });
        });
      });
      
      if (monthActivities.length > 0 || dateMap.size > 0) {
        groups.push({
          month,
          monthName: MONTHS_AR[month - 1],
          activities: monthActivities,
          dateGroups: Array.from(dateMap.values()).sort((a, b) => a.day - b.day),
        });
      }
    }
    
    return groups;
  }, [planMonths, operationalPlans, executivePlans, selectedYear, filterMonths]);

  // الحصول على وضع العرض (الآن موحد للصفحة كلها)
  const getViewMode = (): "tasks" | "dates" => {
    return globalViewMode;
  };

  // الحصول على المهام المرتبطة بخطة تنفيذية معينة
  const getTasksForExecutivePlan = (executivePlanId: string): Task[] => {
    return tasks.filter(t => t.executive_plan_id === executivePlanId);
  };

  // أيام الشهر المختار للإضافة
  const daysInAddingMonth = useMemo(() => {
    return new Date(selectedYear, addingMonth, 0).getDate();
  }, [selectedYear, addingMonth]);

  // المهام المتاحة للشهر المختار
  const availableActivities = useMemo(() => {
    return planMonths
      .filter(pm => pm.month === addingMonth)
      .map(pm => {
        const plan = operationalPlans.find(p => p.id === pm.operational_plan_id);
        return {
          planMonthId: pm.id,
          activityName: plan?.activity_name || "",
          monthlyTarget: pm.monthly_target,
        };
      })
      .filter(a => a.activityName);
  }, [planMonths, operationalPlans, addingMonth]);

  // إضافة خطة تنفيذية
  const handleAddExecutivePlan = async () => {
    if (!selectedPlanMonthId || selectedDays.length === 0) {
      toast({ title: "تنبيه", description: "اختر المهمة والأيام", variant: "destructive" });
      return;
    }
    
    const selectedPlanMonth = planMonths.find(pm => pm.id === selectedPlanMonthId);
    if (!selectedPlanMonth) return;
    
    // توزيع المستهدف على الأيام المختارة
    const dailyTarget = Math.ceil(selectedPlanMonth.monthly_target / selectedDays.length);
    
    const plansToInsert = selectedDays.map((day, index) => {
      // آخر يوم يأخذ الباقي
      const target = index === selectedDays.length - 1
        ? selectedPlanMonth.monthly_target - (dailyTarget * (selectedDays.length - 1))
        : dailyTarget;
      
      return {
        operational_plan_month_id: selectedPlanMonthId,
        day,
        daily_target: Math.max(target, 0),
        achieved: 0,
        status: "pending",
      };
    });
    
    try {
      // حذف الخطط القديمة لهذا الشهر
      await supabase
        .from("executive_plans")
        .delete()
        .eq("operational_plan_month_id", selectedPlanMonthId);
      
      // إضافة الجديدة
      const { error } = await supabase
        .from("executive_plans")
        .insert(plansToInsert);
      
      if (error) throw error;
      
      toast({ title: "تم!", description: `تم إضافة ${plansToInsert.length} يوم للخطة التنفيذية` });
      setIsDialogOpen(false);
      setSelectedPlanMonthId("");
      setSelectedDays([]);
      
      // إعادة جلب البيانات
      const monthIds = planMonths.map(m => m.id);
      const { data: newExecutive } = await supabase
        .from("executive_plans")
        .select("*")
        .in("operational_plan_month_id", monthIds)
        .order("day", { ascending: true });
      
      setExecutivePlans(newExecutive || []);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // حذف خطة تنفيذية
  const handleDeleteDay = async (executivePlanId: string) => {
    try {
      const { error } = await supabase
        .from("executive_plans")
        .delete()
        .eq("id", executivePlanId);
      
      if (error) throw error;
      
      setExecutivePlans(prev => prev.filter(ep => ep.id !== executivePlanId));
      toast({ title: "تم الحذف" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const toggleActivity = (activityKey: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityKey)) {
        newSet.delete(activityKey);
      } else {
        newSet.add(activityKey);
      }
      return newSet;
    });
  };

  const getSelectedEmployee = () => {
    return (
      employees.find((e) => e.user_id === selectedEmployeeId) ||
      employees.find((e) => e.id === selectedEmployeeId)
    );
  };

  // توليد الخطط التنفيذية بالذكاء الاصطناعي
  const handleAIGenerate = async () => {
    setIsAIGenerating(true);
    setAiProgress(null);

    try {
      const { userIds } = getFilteredUserIds();

      if (userIds.length === 0) {
        toast({
          title: "تنبيه",
          description:
            "لا يمكن التوليد لأن الموظف/الموظفين المختارين غير مرتبطين بحسابات مستخدمين أو لا توجد نتائج ضمن الفلاتر.",
          variant: "destructive",
        });
        return;
      }

      const monthsToRun = [...aiSelectedMonths].sort((a, b) => a - b);
      const total = monthsToRun.length;

      const failed: number[] = [];
      let successCount = 0;

      // ننفّذ شهر-بشهر لتجنب Timeout المتصفح عند اختيار 12 شهر
      for (let i = 0; i < monthsToRun.length; i++) {
        const month = monthsToRun[i];
        setAiProgress({ current: i + 1, total, month });

        const { data, error } = await supabase.functions.invoke("generate-executive-plans", {
          body: {
            months: [month],
            year: selectedYear,
            userIds,
          },
        });

        if (error) {
          const msg = error.message || "فشل في توليد الخطط";

          // إذا انقطع الاتصال (Failed to fetch) نوقف حتى لا نظهر فشل كاذب لبقية الأشهر
          if (msg.toLowerCase().includes("failed to fetch")) {
            toast({
              title: "انقطع الاتصال",
              description:
                "الطلب استغرق وقتاً طويلاً. جرّب توليد عدد أقل من الأشهر أو أعد المحاولة.",
              variant: "destructive",
            });
            return;
          }

          failed.push(month);
          continue;
        }

        if (!data?.success) {
          failed.push(month);
          continue;
        }

        successCount++;
      }

      const failedText = failed.map((m) => MONTHS_AR[m - 1]).filter(Boolean).join("، ");

      if (successCount === 0) {
        toast({
          title: "تنبيه",
          description: "لم يتم توليد أي خطط (تأكد من وجود خطط تشغيلية للسنة/الأشهر المحددة)",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: failed.length === 0 ? "تم التوليد بنجاح" : "تم التوليد مع ملاحظات",
        description:
          failed.length === 0
            ? `تم توليد الخطط للأشهر المحددة (${successCount} شهر).`
            : `تم التوليد لـ ${successCount} شهر. لم يكتمل للأشهر: ${failedText}`,
      });

      setIsAIDialogOpen(false);
      window.location.reload();
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "خطأ",
        description: error?.message || "فشل في توليد الخطط",
        variant: "destructive",
      });
    } finally {
      setIsAIGenerating(false);
      setAiProgress(null);
    }
  };
  
  // تبديل اختيار شهر
  const toggleAiMonth = (month: number) => {
    setAiSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      } else {
        return [...prev, month].sort((a, b) => a - b);
      }
    });
  };
  
  // اختيار جميع الأشهر
  const selectAllMonths = () => {
    setAiSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  };
  
  // إلغاء تحديد الكل
  const clearAllMonths = () => {
    setAiSelectedMonths([]);
  };

  return (
    <DashboardLayout embedded={embedded}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={<Calendar className="w-6 h-6" />}
          title="الخطط التنفيذية"
          subtitle="توزيع المستهدفات الشهرية على أيام محددة"
          actions={
            <>
              <Button
                onClick={() => {
                  setIsDialogOpen(true);
                  setSelectedPlanMonthId("");
                  setSelectedDays([]);
                  setAddingMonth(new Date().getMonth() + 1);
                }}
                className="gap-2 bg-white text-primary hover:bg-white/90"
              >
                <Plus className="w-4 h-4" />
                إضافة خطة يدوياً
              </Button>
              <Button
                className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-400"
                onClick={() => navigate(makeOrgUrl("/executive-plans/upload"))}
              >
                <FileSpreadsheet className="w-4 h-4" />
                رفع ملف Excel
              </Button>
              {isAdmin && (
                <Button
                  className="gap-2 bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm"
                  onClick={() => setIsAIChoiceDialogOpen(true)}
                  disabled={isAIGenerating}
                >
                  {isAIGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  توليد بالذكاء الاصطناعي
                </Button>
              )}
              <Button
                className={`gap-2 border ${
                  isEditMode
                    ? "bg-white text-primary border-white"
                    : "bg-white/15 text-white border-white/30 hover:bg-white/25 backdrop-blur-sm"
                }`}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? (
                  <>
                    <Check className="w-4 h-4" />
                    إنهاء التعديل
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    التعديل على الخطة
                  </>
                )}
              </Button>
            </>
          }
        />
        {/* الفلاتر */}
        <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/25">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-semibold">فلترة</span>
            </div>
            
            {/* فلتر السنة */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-purple-100 shadow-sm hover:border-purple-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <Select dir="rtl" value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger className="w-[100px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                  <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {getAvailableYears().map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* فلتر الأشهر */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-amber-100 shadow-sm hover:border-amber-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-3 border-0 bg-transparent hover:bg-transparent">
                    {filterMonths.length === 0 
                      ? "جميع الأشهر" 
                      : filterMonths.length === 1 
                        ? MONTHS_AR[filterMonths[0] - 1]
                        : `${filterMonths.length} أشهر`
                    }
                    <ChevronDown className="w-4 h-4 mr-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-white z-50">
                  <DropdownMenuItem 
                    onClick={() => setFilterMonths([])}
                    className={filterMonths.length === 0 ? "bg-[hsl(var(--primary)/0.1)] font-bold" : ""}
                  >
                    جميع الأشهر
                  </DropdownMenuItem>
                  {MONTHS_AR.map((month, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => {
                        const monthNum = index + 1;
                        if (filterMonths.includes(monthNum)) {
                          setFilterMonths(filterMonths.filter(m => m !== monthNum));
                        } else {
                          setFilterMonths([...filterMonths, monthNum]);
                        }
                      }}
                      className={filterMonths.includes(index + 1) ? "bg-[hsl(var(--primary)/0.1)]" : ""}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Checkbox 
                          checked={filterMonths.includes(index + 1)} 
                          className="pointer-events-none"
                        />
                        <span>{month}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* فلتر القسم */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <Select dir="rtl" value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
                  <SelectTrigger className="w-[160px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                    <SelectValue placeholder="القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* فلتر الموظف */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-teal-100 shadow-sm hover:border-teal-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <Select dir="rtl" value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-[200px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                    <SelectValue placeholder="الموظف" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 max-h-[400px]">
                    <SelectItem value="all" className="font-bold text-[hsl(var(--primary))]">
                      <div className="flex items-center gap-2">
                        <span>👥</span>
                        <span>جميع الموظفين</span>
                      </div>
                    </SelectItem>
                    
                    {employees.filter(e => 
                      e.job_role === 'المدير التنفيذي' || e.job_role === 'مدير النظام'
                    ).map(emp => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        <div className="flex items-center gap-2">
                          <span>👔</span>
                          <span>{emp.full_name}</span>
                          <span className="text-xs text-muted-foreground">({emp.job_role})</span>
                        </div>
                      </SelectItem>
                    ))}
                    
                    {employees.filter(e => e.job_role?.includes('رئيس قسم')).map(emp => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        <div className="flex items-center gap-2">
                          <span>🏢</span>
                          <span>{emp.full_name}</span>
                          <span className="text-xs text-muted-foreground">({emp.job_role})</span>
                        </div>
                      </SelectItem>
                    ))}
                    
                    {employees.filter(e => 
                      e.job_role !== 'المدير التنفيذي' && 
                      e.job_role !== 'مدير النظام' && 
                      !e.job_role?.includes('رئيس قسم')
                    ).map(emp => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        <div className="flex items-center gap-2">
                          <span>👤</span>
                          <span>{emp.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({emp.job_role}{emp.department_name ? ` - ${emp.department_name}` : ''})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* زر إعادة تعيين الفلاتر */}
            {(filterDepartmentId !== "all" || filterMonths.length > 0 || selectedEmployeeId !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                onClick={() => {
                  setFilterDepartmentId("all");
                  setFilterMonths([]);
                  setSelectedEmployeeId("all");
                }}
              >
                <X className="w-4 h-4 ml-1" />
                إعادة تعيين
              </Button>
            )}
            
          </div>
        </div>

        {/* إحصائيات سريعة */}
        {!loading && groupedPlans.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* إجمالي الأيام */}
            <div className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] rounded-xl p-3 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-medium">أيام التنفيذ</p>
                  <p className="text-2xl font-bold">
                    {groupedPlans.reduce((sum, g) => sum + g.dateGroups.length, 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            {/* إجمالي الأنشطة */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl p-3 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-medium">الأنشطة</p>
                  <p className="text-2xl font-bold">
                    {groupedPlans.reduce((sum, g) => sum + g.activities.length, 0)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            {/* المهام المرتبطة */}
            <div className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] rounded-xl p-3 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-medium">المهام</p>
                  <p className="text-2xl font-bold">{tasks.length}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <ListTodo className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            {/* الأشهر المغطاة */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs font-medium">الأشهر</p>
                  <p className="text-2xl font-bold">{groupedPlans.length}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* المحتوى الرئيسي */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full" />
          </div>
        ) : groupedPlans.length === 0 ? (
          <Card className="py-20 bg-gradient-to-br from-slate-50 to-white border-dashed border-2">
            <CardContent className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[hsl(var(--primary)/0.2)] to-[hsl(var(--primary)/0.05)] flex items-center justify-center">
                <Calendar className="w-10 h-10 text-[hsl(var(--primary))]" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-800">لا توجد خطط تنفيذية</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                استخدم الذكاء الاصطناعي لتوليد خطط تنفيذية ذكية بناءً على الخطط التشغيلية، 
                أو أضف خطة يدوياً
              </p>
              <div className="flex items-center justify-center gap-3">
                {isAdmin && (
                  <Button
                    onClick={() => setIsAIDialogOpen(true)}
                    className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    <Sparkles className="w-5 h-5" />
                    توليد بالذكاء الاصطناعي
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setIsDialogOpen(true);
                    setSelectedPlanMonthId("");
                    setSelectedDays([]);
                    setAddingMonth(new Date().getMonth() + 1);
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="w-5 h-5" />
                  إضافة يدوية
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* جدول الخطط التنفيذية */
          <div className="space-y-4">
            {/* تبويبات التبديل الرئيسية في أعلى الصفحة */}
            <Card className="border-[hsl(var(--primary)/0.2)]">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setGlobalViewMode("dates")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium",
                      globalViewMode === "dates"
                        ? "bg-[hsl(var(--primary))] text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <CalendarDays className="w-4 h-4" />
                    بحسب التواريخ
                  </button>
                  <button
                    onClick={() => setGlobalViewMode("tasks")}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium",
                      globalViewMode === "tasks"
                        ? "bg-[hsl(var(--primary))] text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <ListTodo className="w-4 h-4" />
                    بحسب المهام
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* عرض بحسب التواريخ */}
            {globalViewMode === "dates" && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto" dir="rtl">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))]">
                        <TableHead className="text-right font-bold text-white min-w-[120px] border-l border-white/20">
                          الشهر
                        </TableHead>
                        <TableHead className="text-right font-bold text-white min-w-[180px] border-l border-white/20">
                          التاريخ
                        </TableHead>
                        <TableHead className="text-center font-bold text-white">
                          الأنشطة المخطط تنفيذها
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPlans.map((monthGroup) => {
                        const isExpanded = expandedMonths.has(`month-${monthGroup.month}`);
                        const totalDays = monthGroup.dateGroups.length;
                        
                        // إذا لم تكن مفتوحة، نعرض صف واحد مع معلومات الشهر
                        if (!isExpanded) {
                          return (
                            <TableRow 
                              key={`collapsed-${monthGroup.month}`}
                              className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-[hsl(var(--primary)/0.3)]"
                              onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                            >
                              <TableCell colSpan={3} className="py-3">
                                <div className="flex items-center gap-3">
                                  <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] transition-transform" />
                                  <Calendar className="w-5 h-5 text-[hsl(var(--primary))]" />
                                  <span className="font-bold text-lg text-gray-800">
                                    {monthGroup.monthName} {selectedYear}
                                  </span>
                                  <Badge className="bg-[hsl(var(--primary))] text-white">
                                    {totalDays} يوم
                                  </Badge>
                                  <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))]">
                                    {monthGroup.activities.length} نشاط
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        // إذا كانت مفتوحة ولكن لا توجد تواريخ، نعرض صف فارغ
                        if (totalDays === 0) {
                          return (
                            <TableRow 
                              key={`empty-${monthGroup.month}`}
                              className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-[hsl(var(--primary)/0.3)]"
                              onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                            >
                              <TableCell colSpan={3} className="py-3">
                                <div className="flex items-center gap-3">
                                  <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] rotate-180 transition-transform" />
                                  <Calendar className="w-5 h-5 text-[hsl(var(--primary))]" />
                                  <span className="font-bold text-lg text-gray-800">
                                    {monthGroup.monthName} {selectedYear}
                                  </span>
                                  <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))]">
                                    {monthGroup.activities.length} نشاط
                                  </Badge>
                                  <span className="text-muted-foreground text-sm">- لا توجد تواريخ تنفيذ</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        // إذا كانت مفتوحة، نعرض الصفوف مع دمج عمود الشهر
                        return (
                          <React.Fragment key={`expanded-${monthGroup.month}`}>
                            {monthGroup.dateGroups.map((dateGroup, dateIdx) => {
                              const date = new Date(selectedYear, monthGroup.month - 1, dateGroup.day);
                              const isFirstRow = dateIdx === 0;
                              
                              return (
                                <TableRow 
                                  key={`${monthGroup.month}-${dateGroup.day}`}
                                  className={cn(
                                    dateIdx % 2 === 0 ? "bg-white" : "bg-[hsl(var(--primary)/0.1)]",
                                    "transition-colors",
                                    isFirstRow ? "border-t-2 border-[hsl(var(--primary)/0.3)]" : "",
                                    dateIdx < monthGroup.dateGroups.length - 1 ? "border-b border-gray-200" : ""
                                  )}
                                >
                                  {/* عمود الشهر - مدمج لجميع الصفوف */}
                                  {isFirstRow && (
                                    <TableCell 
                                      rowSpan={totalDays} 
                                      className="bg-gray-100 border-l border-gray-200 align-top cursor-pointer hover:bg-gray-200 transition-colors"
                                      onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                                    >
                                      <div className="flex flex-col items-center gap-2 py-2">
                                        <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] rotate-180 transition-transform" />
                                        <Calendar className="w-6 h-6 text-[hsl(var(--primary))]" />
                                        <span className="font-bold text-lg text-gray-800 text-center">
                                          {monthGroup.monthName}
                                        </span>
                                        <span className="text-sm text-muted-foreground">{selectedYear}</span>
                                        <Badge className="bg-[hsl(var(--primary))] text-white text-xs">
                                          {totalDays} يوم
                                        </Badge>
                                        <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))] text-xs">
                                          {monthGroup.activities.length} نشاط
                                        </Badge>
                                      </div>
                                    </TableCell>
                                  )}
                                  
                                  {/* عمود التاريخ */}
                                  <TableCell className="border-l border-gray-200 py-3">
                                    <div className="flex flex-col items-start gap-1">
                                      <div className="flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0" />
                                        <span className="font-bold text-gray-800">{dateGroup.weekDay}</span>
                                      </div>
                                      <div className="text-sm text-gray-600" style={{ fontFamily: 'Arial, sans-serif' }}>
                                        {formatGregorianDate(date)}
                                      </div>
                                      <div className="text-xs text-[hsl(var(--primary))]" style={{ fontFamily: 'Arial, sans-serif' }}>
                                        {formatHijriDate(date)}
                                      </div>
                                    </div>
                                  </TableCell>
                                  
                                  {/* عمود الأنشطة */}
                                  <TableCell className="py-2">
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {dateGroup.activities.map((activity, activityIdx) => {
                                        const activityTasks = getTasksForExecutivePlan(activity.id);
                                        const completedTasks = activityTasks.filter(t => t.status === "completed").length;
                                        const activityKey = `${monthGroup.month}-${dateGroup.day}-${activity.id}`;
                                        const isActivityExpanded = expandedActivities.has(activityKey);
                                        
                                        // تحقق من وجود مهام لكل مرحلة
                                        const hasPreTasks = activityTasks.some(t => t.category === "ما قبل");
                                        const hasDuringTasks = activityTasks.some(t => t.category === "أثناء");
                                        const hasPostTasks = activityTasks.some(t => t.category === "ما بعد");
                                        const hasUncategorizedTasks = activityTasks.some(t => !t.category || !["ما قبل", "أثناء", "ما بعد"].includes(t.category));
                                        const hasPhases = hasPreTasks || hasDuringTasks || hasPostTasks;
                                        
                                        return (
                                          <div key={activity.id} className="relative">
                                            {isEditMode && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (window.confirm(`حذف "${activity.activityName}" من هذا اليوم؟`)) {
                                                    handleDeleteDay(activity.id);
                                                  }
                                                }}
                                                className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md ring-2 ring-white transition-transform hover:scale-110"
                                                aria-label="حذف"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                            <Popover>
                                            <PopoverTrigger asChild>
                                              <div
                                                className={cn(
                                                  "flex items-start gap-2 cursor-pointer px-2.5 py-2 rounded-lg transition-all hover:scale-[1.02] hover:shadow-lg",
                                                  activity.status === "completed" 
                                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                                                    : activity.status === "in_progress"
                                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                                                    : "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white",
                                                  isEditMode && "ring-2 ring-red-300/60"
                                                )}
                                              >
                                                {/* الرقم التسلسلي */}
                                                <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                  <span className="text-xs font-bold">{activityIdx + 1}</span>
                                                </div>
                                                
                                                {/* اسم النشاط */}
                                                <span className="text-sm font-medium leading-snug flex-1">
                                                  {activity.activityName}
                                                </span>
                                                
                                                {/* عدد المهام */}
                                                {activityTasks.length > 0 && (
                                                  <Badge 
                                                    variant="secondary" 
                                                    className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-white/20 text-white border-0 mt-0.5"
                                                  >
                                                    {completedTasks}/{activityTasks.length}
                                                  </Badge>
                                                )}
                                                
                                                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70 mt-0.5" />
                                              </div>
                                            </PopoverTrigger>
                                            <PopoverContent 
                                              className="w-96 p-4 bg-white border-2 border-gray-200 shadow-2xl rounded-xl z-[100]" 
                                              align="start"
                                              side="bottom"
                                              sideOffset={8}
                                            >
                                              <div className="space-y-4 max-h-[450px] overflow-y-auto">
                                                {/* عنوان النشاط */}
                                                <div className="font-bold text-base text-gray-900 border-b-2 border-[hsl(var(--primary))] pb-3">
                                                  {activity.activityName}
                                                </div>
                                                
                                                {activityTasks.length === 0 ? (
                                                  <div className="py-6 text-center text-gray-500">
                                                    <ListTodo className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                                                    <p className="text-base">لا توجد مهام مرتبطة</p>
                                                  </div>
                                                ) : (
                                                  <>
                                                    {/* عرض المراحل فقط إذا كانت موجودة */}
                                                    {hasPhases && (
                                                      <div className="space-y-3">
                                                        {/* مرحلة ما قبل */}
                                                        {hasPreTasks && (
                                                          <div className="rounded-xl border-2 border-amber-300 p-3 bg-amber-50">
                                                            <div className="flex items-center gap-2 mb-3">
                                                              <div className="px-3 py-1.5 rounded-lg text-white text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 shadow-md">
                                                                🔧 ما قبل
                                                              </div>
                                                              <span className="text-sm text-amber-700 font-medium">
                                                                ({activityTasks.filter(t => t.category === "ما قبل").length} مهام)
                                                              </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                              {activityTasks.filter(t => t.category === "ما قبل").map((task, taskIdx) => (
                                                                <div 
                                                                  key={task.id}
                                                                  className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-amber-200 shadow-sm"
                                                                >
                                                                  <div className={cn(
                                                                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                                                                    task.status === "completed" ? "bg-green-100 text-green-600" :
                                                                    task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
                                                                    "bg-gray-100 text-gray-500"
                                                                  )}>
                                                                    {task.status === "completed" ? (
                                                                      <CheckCircle2 className="w-4 h-4" />
                                                                    ) : task.status === "in_progress" ? (
                                                                      <Clock className="w-4 h-4" />
                                                                    ) : (
                                                                      taskIdx + 1
                                                                    )}
                                                                  </div>
                                                                  <p className="text-sm text-gray-800 flex-1 leading-relaxed">
                                                                    {task.title}
                                                                  </p>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}
                                                        
                                                        {/* مرحلة أثناء */}
                                                        {hasDuringTasks && (
                                                          <div className="rounded-xl border-2 border-blue-300 p-3 bg-blue-50">
                                                            <div className="flex items-center gap-2 mb-3">
                                                              <div className="px-3 py-1.5 rounded-lg text-white text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-500 shadow-md">
                                                                ⚡ أثناء
                                                              </div>
                                                              <span className="text-sm text-blue-700 font-medium">
                                                                ({activityTasks.filter(t => t.category === "أثناء").length} مهام)
                                                              </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                              {activityTasks.filter(t => t.category === "أثناء").map((task, taskIdx) => (
                                                                <div 
                                                                  key={task.id}
                                                                  className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-blue-200 shadow-sm"
                                                                >
                                                                  <div className={cn(
                                                                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                                                                    task.status === "completed" ? "bg-green-100 text-green-600" :
                                                                    task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
                                                                    "bg-gray-100 text-gray-500"
                                                                  )}>
                                                                    {task.status === "completed" ? (
                                                                      <CheckCircle2 className="w-4 h-4" />
                                                                    ) : task.status === "in_progress" ? (
                                                                      <Clock className="w-4 h-4" />
                                                                    ) : (
                                                                      taskIdx + 1
                                                                    )}
                                                                  </div>
                                                                  <p className="text-sm text-gray-800 flex-1 leading-relaxed">
                                                                    {task.title}
                                                                  </p>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}
                                                        
                                                        {/* مرحلة ما بعد */}
                                                        {hasPostTasks && (
                                                          <div className="rounded-xl border-2 border-emerald-300 p-3 bg-emerald-50">
                                                            <div className="flex items-center gap-2 mb-3">
                                                              <div className="px-3 py-1.5 rounded-lg text-white text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md">
                                                                ✅ ما بعد
                                                              </div>
                                                              <span className="text-sm text-emerald-700 font-medium">
                                                                ({activityTasks.filter(t => t.category === "ما بعد").length} مهام)
                                                              </span>
                                                            </div>
                                                            <div className="space-y-2">
                                                              {activityTasks.filter(t => t.category === "ما بعد").map((task, taskIdx) => (
                                                                <div 
                                                                  key={task.id}
                                                                  className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-emerald-200 shadow-sm"
                                                                >
                                                                  <div className={cn(
                                                                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                                                                    task.status === "completed" ? "bg-green-100 text-green-600" :
                                                                    task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
                                                                    "bg-gray-100 text-gray-500"
                                                                  )}>
                                                                    {task.status === "completed" ? (
                                                                      <CheckCircle2 className="w-4 h-4" />
                                                                    ) : task.status === "in_progress" ? (
                                                                      <Clock className="w-4 h-4" />
                                                                    ) : (
                                                                      taskIdx + 1
                                                                    )}
                                                                  </div>
                                                                  <p className="text-sm text-gray-800 flex-1 leading-relaxed">
                                                                    {task.title}
                                                                  </p>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                    
                                                    {/* المهام بدون تصنيف - تظهر كقائمة بسيطة إذا لا توجد مراحل */}
                                                    {hasUncategorizedTasks && (
                                                      <div className={cn(
                                                        "rounded-xl border-2 border-gray-300 p-3 bg-gray-50",
                                                        hasPhases ? "mt-3" : ""
                                                      )}>
                                                        {hasPhases && (
                                                          <div className="flex items-center gap-2 mb-3">
                                                            <div className="px-3 py-1.5 rounded-lg text-white text-sm font-bold bg-gradient-to-r from-gray-500 to-gray-600 shadow-md">
                                                              📋 مهام أخرى
                                                            </div>
                                                          </div>
                                                        )}
                                                        <div className="space-y-2">
                                                          {activityTasks.filter(t => !t.category || !["ما قبل", "أثناء", "ما بعد"].includes(t.category)).map((task, taskIdx) => (
                                                            <div 
                                                              key={task.id}
                                                              className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-gray-200 shadow-sm"
                                                            >
                                                              <div className={cn(
                                                                "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                                                                task.status === "completed" ? "bg-green-100 text-green-600" :
                                                                task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
                                                                "bg-gray-100 text-gray-500"
                                                              )}>
                                                                {task.status === "completed" ? (
                                                                  <CheckCircle2 className="w-4 h-4" />
                                                                ) : task.status === "in_progress" ? (
                                                                  <Clock className="w-4 h-4" />
                                                                ) : (
                                                                  taskIdx + 1
                                                                )}
                                                              </div>
                                                              <p className="text-sm text-gray-800 flex-1 leading-relaxed">
                                                                {task.title}
                                                              </p>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {/* عرض بحسب المهام */}
            {globalViewMode === "tasks" && (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto" dir="rtl">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))]">
                        <TableHead className="text-right font-bold text-white min-w-[120px] border-l border-white/20">
                          الشهر
                        </TableHead>
                        <TableHead className="text-right font-bold text-white min-w-[200px] border-l border-white/20">
                          النشاط
                        </TableHead>
                        <TableHead className="text-right font-bold text-white">
                          تواريخ التنفيذ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPlans.map((monthGroup) => {
                        const isExpanded = expandedMonths.has(`month-${monthGroup.month}`);
                        const totalActivities = monthGroup.activities.length;
                        
                        // إذا لم تكن مفتوحة، نعرض صف واحد مع معلومات الشهر
                        if (!isExpanded) {
                          return (
                            <TableRow 
                              key={`collapsed-tasks-${monthGroup.month}`}
                              className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-[hsl(var(--primary)/0.3)]"
                              onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                            >
                              <TableCell colSpan={3} className="py-3">
                                <div className="flex items-center gap-3">
                                  <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] transition-transform" />
                                  <Calendar className="w-5 h-5 text-[hsl(var(--primary))]" />
                                  <span className="font-bold text-lg text-gray-800">
                                    {monthGroup.monthName} {selectedYear}
                                  </span>
                                  <Badge className="bg-[hsl(var(--primary))] text-white">
                                    {totalActivities} نشاط
                                  </Badge>
                                  <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))]">
                                    {monthGroup.activities.reduce((sum, a) => sum + a.days.length, 0)} يوم
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        // إذا كانت مفتوحة ولكن لا توجد أنشطة
                        if (totalActivities === 0) {
                          return (
                            <TableRow 
                              key={`empty-tasks-${monthGroup.month}`}
                              className="bg-gray-100 hover:bg-gray-200 cursor-pointer border-t-2 border-[hsl(var(--primary)/0.3)]"
                              onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                            >
                              <TableCell colSpan={3} className="py-3">
                                <div className="flex items-center gap-3">
                                  <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] rotate-180 transition-transform" />
                                  <Calendar className="w-5 h-5 text-[hsl(var(--primary))]" />
                                  <span className="font-bold text-lg text-gray-800">
                                    {monthGroup.monthName} {selectedYear}
                                  </span>
                                  <span className="text-muted-foreground text-sm">- لا توجد أنشطة</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        
                        // إذا كانت مفتوحة، نعرض الصفوف مع دمج عمود الشهر
                        return (
                          <React.Fragment key={`expanded-tasks-${monthGroup.month}`}>
                            {monthGroup.activities.map((activity, actIdx) => {
                              const isFirstRow = actIdx === 0;
                              
                              return (
                                <TableRow 
                                  key={activity.planMonthId}
                                  className={cn(
                                    "hover:bg-gray-50",
                                    isFirstRow ? "border-t-2 border-[hsl(var(--primary)/0.3)]" : "",
                                    actIdx < totalActivities - 1 ? "border-b border-gray-200" : ""
                                  )}
                                >
                                  {/* عمود الشهر - مدمج لجميع الصفوف */}
                                  {isFirstRow && (
                                    <TableCell 
                                      rowSpan={totalActivities} 
                                      className="bg-gray-100 border-l border-gray-200 align-top cursor-pointer hover:bg-gray-200 transition-colors"
                                      onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                                    >
                                      <div className="flex flex-col items-center gap-2 py-2">
                                        <ChevronDown className="w-5 h-5 text-[hsl(var(--primary))] rotate-180 transition-transform" />
                                        <Calendar className="w-6 h-6 text-[hsl(var(--primary))]" />
                                        <span className="font-bold text-lg text-gray-800 text-center">
                                          {monthGroup.monthName}
                                        </span>
                                        <span className="text-sm text-muted-foreground">{selectedYear}</span>
                                        <Badge className="bg-[hsl(var(--primary))] text-white text-xs">
                                          {totalActivities} نشاط
                                        </Badge>
                                        <Badge variant="outline" className="text-[hsl(var(--primary))] border-[hsl(var(--primary))] text-xs">
                                          {monthGroup.activities.reduce((sum, a) => sum + a.days.length, 0)} يوم
                                        </Badge>
                                      </div>
                                    </TableCell>
                                  )}
                                  
                                  {/* عمود اسم النشاط */}
                                  <TableCell className="border-l border-gray-200 py-3 align-top">
                                    <div className="flex items-start gap-2">
                                      <Target className="w-4 h-4 text-[hsl(var(--primary))] flex-shrink-0 mt-0.5" />
                                      <pre className="font-bold text-gray-800 text-sm leading-relaxed font-sans whitespace-pre m-0">
                                        {wrapTextByChars(activity.activityName, 30)}
                                      </pre>
                                    </div>
                                  </TableCell>
                                  
                                  {/* عمود أيام التنفيذ */}
                                  <TableCell className="py-2">
                                    {activity.days.length === 0 ? (
                                      <span className="text-muted-foreground text-sm">لا توجد أيام تنفيذ</span>
                                    ) : (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {activity.days.map((day, dayIdx) => {
                                          const date = new Date(selectedYear, monthGroup.month - 1, day.day);
                                          
                                          return (
                                            <div key={day.id} className="flex items-center">
                                              <div
                                                className={cn(
                                                  "text-center px-3 py-2 rounded-lg min-w-[70px]",
                                                  day.status === "completed" 
                                                    ? "bg-green-600 text-white"
                                                    : day.status === "in_progress"
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[hsl(var(--primary))] text-white"
                                                )}
                                              >
                                                {/* التاريخ الميلادي */}
                                                <div className="text-xs font-medium">
                                                  {formatGregorianShort(date)}
                                                </div>
                                                {/* التاريخ الهجري */}
                                                <div className="text-[10px] opacity-80">
                                                  {formatHijriShort(date)}
                                                </div>
                                              </div>
                                              {/* فاصل أبيض بين الأعمدة */}
                                              {dayIdx < activity.days.length - 1 && (
                                                <div className="w-2 h-full bg-white" />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* نافذة إضافة خطة تنفيذية */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                إضافة خطة تنفيذية
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* اختيار الشهر */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">اختر الشهر</label>
                <Select value={addingMonth.toString()} onValueChange={(v) => {
                  setAddingMonth(parseInt(v));
                  setSelectedPlanMonthId("");
                  setSelectedDays([]);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {MONTHS_AR.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month} {selectedYear}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* اختيار المهمة */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">اختر المهمة / النشاط</label>
                {availableActivities.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center bg-gray-50 rounded-lg">
                    لا توجد مهام في الخطة التشغيلية لهذا الشهر
                  </p>
                ) : (
                  <Select value={selectedPlanMonthId} onValueChange={(v) => {
                    setSelectedPlanMonthId(v);
                    setSelectedDays([]);
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر المهمة" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {availableActivities.map(activity => (
                        <SelectItem key={activity.planMonthId} value={activity.planMonthId}>
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-[hsl(var(--primary))]" />
                            <span>{activity.activityName}</span>
                            <Badge variant="outline" className="mr-2">
                              المستهدف: {activity.monthlyTarget}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {/* اختيار الأيام */}
              {selectedPlanMonthId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-gray-700">اختر الأيام</label>
                    <Badge variant="outline" className="text-[hsl(var(--primary))]">
                      {selectedDays.length} يوم مختار
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2 p-4 bg-gray-50 rounded-xl border">
                    {/* أيام الأسبوع */}
                    {WEEKDAYS_AR.map(day => (
                      <div key={day} className="text-center text-xs font-bold text-gray-500 pb-2">
                        {day}
                      </div>
                    ))}
                    
                    {/* فراغات بداية الشهر */}
                    {Array.from({ length: new Date(selectedYear, addingMonth - 1, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    
                    {/* أيام الشهر */}
                    {Array.from({ length: daysInAddingMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(selectedYear, addingMonth - 1, day);
                      const isSelected = selectedDays.includes(day);
                      
                      return (
                        <div
                          key={day}
                          onClick={() => {
                            setSelectedDays(prev => 
                              prev.includes(day) 
                                ? prev.filter(d => d !== day)
                                : [...prev, day].sort((a, b) => a - b)
                            );
                          }}
                          className={cn(
                            "p-2 rounded-lg cursor-pointer transition-all text-center border-2",
                            isSelected 
                              ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))] shadow-md" 
                              : "bg-white hover:bg-gray-100 border-transparent hover:border-[hsl(var(--primary)/0.3)]"
                          )}
                        >
                          <div className="text-lg font-bold">{day}</div>
                          <div className={cn(
                            "text-[10px]",
                            isSelected ? "text-white/80" : "text-muted-foreground"
                          )}>
                            {formatHijriShort(date)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* معاينة الأيام المختارة */}
                  {selectedDays.length > 0 && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <h4 className="font-semibold text-emerald-800 mb-3">الأيام المختارة:</h4>
                      <div className="space-y-2">
                        {selectedDays.map(day => {
                          const date = new Date(selectedYear, addingMonth - 1, day);
                          return (
                            <div key={day} className="flex items-center gap-4 bg-white rounded-lg p-2 text-sm">
                              <span className="font-bold text-[hsl(var(--primary))] w-8">{day}</span>
                              <span className="text-gray-600">{WEEKDAYS_AR[date.getDay()]}</span>
                              <span className="text-gray-800">{formatGregorianDate(date)}</span>
                              <span className="text-emerald-700">{formatHijriDate(date)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* زر الإضافة */}
              <Button
                onClick={handleAddExecutivePlan}
                disabled={!selectedPlanMonthId || selectedDays.length === 0}
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-12 text-lg"
              >
                <Plus className="w-5 h-5" />
                إضافة الخطة التنفيذية
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة التوليد بالذكاء الاصطناعي */}
        {/* Dialog اختيار طريقة التوليد بالذكاء الاصطناعي - خياران */}
        {isAdmin && isAIChoiceDialogOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setIsAIChoiceDialogOpen(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-purple-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                    توليد الخطط التنفيذية بالذكاء الاصطناعي
                  </h3>
                  <p className="text-sm text-gray-500">اختر الطريقة المناسبة لتوليد الخطط التنفيذية</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAIChoiceDialogOpen(false);
                    setIsAIDialogOpen(true);
                  }}
                  className="group text-right p-5 rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white hover:border-violet-500 hover:shadow-lg hover:shadow-violet-500/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1.5">توليد فوري</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    يقوم الذكاء الاصطناعي بتحليل الخطط التشغيلية الحالية وتوزيع المستهدفات على أيام العمل تلقائياً.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 group-hover:gap-2 transition-all">
                    اختر الأشهر وابدأ
                    <ChevronUp className="w-3 h-3 -rotate-90" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAIChoiceDialogOpen(false);
                    navigate(makeOrgUrl("/executive-plans/ai-generate?withFiles=1"));
                  }}
                  className="group text-right p-5 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1.5">توليد بناءً على ملفات</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    ارفع نماذج خطط سابقة، تقارير، أو مستندات مرجعية، ليدرسها الذكاء الاصطناعي ويبني خطة تنفيذية مبنية عليها.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:gap-2 transition-all">
                    ارفع الملفات
                    <ChevronUp className="w-3 h-3 -rotate-90" />
                  </div>
                </button>
              </div>

              <div className="flex justify-end mt-5">
                <Button
                  variant="outline"
                  className="border-gray-300"
                  onClick={() => setIsAIChoiceDialogOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}

        <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                توليد الخطط التنفيذية بالذكاء الاصطناعي
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* شرح العملية */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  ماذا سيفعل الذكاء الاصطناعي؟
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-700">1</span>
                    </div>
                    <p className="text-sm text-purple-700">تحليل الخطط التشغيلية والمستهدفات الشهرية</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-700">2</span>
                    </div>
                    <p className="text-sm text-purple-700">توزيع المستهدفات على أيام العمل بذكاء</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-700">3</span>
                    </div>
                    <p className="text-sm text-purple-700">تجنب عطلات نهاية الأسبوع تلقائياً</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-purple-700">4</span>
                    </div>
                    <p className="text-sm text-purple-700">إنشاء مهام مرتبطة بكل يوم تنفيذي</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium">اختر الأشهر</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllMonths}
                      className="text-xs h-7 px-2"
                    >
                      تحديد الكل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={clearAllMonths}
                      className="text-xs h-7 px-2"
                    >
                      إلغاء الكل
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {MONTHS_AR.map((month, idx) => {
                    const monthNum = idx + 1;
                    const isSelected = aiSelectedMonths.includes(monthNum);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleAiMonth(monthNum)}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all border-2",
                          isSelected 
                            ? "bg-purple-100 border-purple-400 text-purple-800" 
                            : "bg-white hover:bg-gray-50 border-gray-200 hover:border-purple-200"
                        )}
                      >
                        <Checkbox 
                          checked={isSelected}
                          className="pointer-events-none"
                        />
                        <span className="text-sm font-medium">{month}</span>
                      </div>
                    );
                  })}
                </div>
                
                {aiSelectedMonths.length > 0 && (
                  <div className="text-sm text-purple-600 text-center">
                    تم اختيار {aiSelectedMonths.length} شهر
                  </div>
                )}
              </div>

              {/* الموظفين المستهدفين */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border border-slate-200">
                <h4 className="font-semibold mb-3 flex items-center gap-2 text-slate-700">
                  <Users className="w-4 h-4" />
                  سيتم التوليد لـ:
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedEmployeeId === "all" ? (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 py-1.5 px-3">
                      <Users className="w-3 h-3 ml-1" />
                      جميع الموظفين
                    </Badge>
                  ) : getSelectedEmployee() ? (
                    <>
                      <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 py-1.5 px-3">
                        <User className="w-3 h-3 ml-1" />
                        {getSelectedEmployee()?.full_name}
                      </Badge>
                      {getSelectedEmployee()?.job_role?.includes('رئيس قسم') && (
                        <Badge variant="outline" className="text-gray-600">+ موظفي القسم</Badge>
                      )}
                    </>
                  ) : (
                    <Badge className="bg-gray-200 text-gray-700">الموظف المحدد</Badge>
                  )}
                </div>
              </div>

              {/* تحذير */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⚠️</span>
                </div>
                <div>
                  <p className="font-medium text-amber-800">تنبيه هام</p>
                  <p className="text-sm text-amber-700 mt-1">
                    سيتم استبدال الخطط التنفيذية والمهام الموجودة للأشهر المحددة بالخطط الجديدة
                  </p>
                </div>
              </div>

              {/* زر التوليد */}
              <Button
                onClick={handleAIGenerate}
                disabled={isAIGenerating || aiSelectedMonths.length === 0}
                className="w-full gap-3 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 hover:from-purple-700 hover:via-pink-600 hover:to-purple-700 h-14 text-lg font-bold shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40"
              >
                {isAIGenerating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>
                      {aiProgress?.month
                        ? `جاري توليد ${MONTHS_AR[aiProgress.month - 1]} (${aiProgress.current}/${aiProgress.total})...`
                        : "جاري التوليد بالذكاء الاصطناعي..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    <span>توليد الخطط التنفيذية والمهام</span>
                    <Zap className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
