import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Calendar, TrendingUp, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, Settings2, Lightbulb, Zap, UserCircle, ArrowUp, ArrowDown, Columns, Sparkles, Loader2, Filter, Building2, Users, FileSpreadsheet, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { AddOperationalPlanDialog } from "@/components/operational-plans/AddOperationalPlanDialog";
import { EditPlanDialog } from "@/components/operational-plans/EditPlanDialog";
import { AddItemDialog } from "@/components/operational-plans/AddItemDialog";
import { ManageCustomColumnsDialog } from "@/components/operational-plans/ManageCustomColumnsDialog";
import { formatNumber, getAvailableYears } from "@/lib/utils";
import { useScopedView } from "@/hooks/useScopedView";
import { ScopeToggle } from "@/components/scope/ScopeToggle";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department_id: string | null;
  job_role?: string;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface StrategicGoal {
  id: string;
  name: string;
  color: string;
  year: number;
  department_id: string | null;
  department_name?: string;
  display_order?: number;
  // الأقسام المالكة (متعدد) عبر جدول الربط
  departments?: Department[];
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
  department_id: string | null;
  department_name?: string;
  display_order?: number;
  // الأقسام المالكة (متعدد) عبر جدول الربط
  departments?: Department[];
}

interface OperationalPlan {
  id: string;
  user_id: string;
  activity_name: string;
  strategic_goal: string | null;
  initiative: string | null;
  sub_initiative: string | null;
  strategic_goal_id: string | null;
  initiative_id: string | null;
  sub_initiative_id: string | null;
  annual_target: number;
  estimated_budget?: number;
  plan_name?: string;
  year: number;
  status: string;
  created_at: string;
  display_order?: number;
  months?: OperationalPlanMonth[];
  employee_name?: string;
  responsible_employee_id: string | null;
  responsible_employee_name?: string;
}

interface OperationalPlanMonth {
  id: string;
  operational_plan_id: string;
  month: number;
  monthly_target: number;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// ألوان رسمية وبسيطة
const GOAL_COLORS = [
  { 
    bg: "bg-white", 
    border: "border-r-gray-400", 
    text: "text-gray-700",
    hover: "hover:bg-gray-50",
    badge: "bg-gray-100 text-gray-600 border-gray-200",
  },
  { 
    bg: "bg-blue-50/50", 
    border: "border-r-blue-600", 
    text: "text-blue-700",
    hover: "hover:bg-blue-50",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  { 
    bg: "bg-green-50/50", 
    border: "border-r-green-600", 
    text: "text-green-700",
    hover: "hover:bg-green-50",
    badge: "bg-green-100 text-green-700 border-green-200",
  },
  { 
    bg: "bg-amber-50/50", 
    border: "border-r-amber-600", 
    text: "text-amber-700",
    hover: "hover:bg-amber-50",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
];

interface GroupedPlans {
  strategicGoal: string;
  colorIndex: number;
  initiatives: {
    initiative: string;
    plans: OperationalPlan[];
  }[];
}

export default function OperationalPlans({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { user, previewAsEmployee } = useUser();
  const { toast } = useToast();
  const scopedView = useScopedView("scope:operational-plans");
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // وضع التعديل الشامل
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    activity_name: string;
    annual_target: number;
    strategic_goal: string;
    initiative: string;
    responsible_employee_id: string | null;
  } | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [editingMonthlyTargets, setEditingMonthlyTargets] = useState<{ [planId: string]: number[] }>({});
  const [isEditingMonths, setIsEditingMonths] = useState<string | null>(null);
  
  // نافذة التعديل المنظمة
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogType, setEditDialogType] = useState<"strategic_goal" | "initiative" | "activity">("activity");
  const [editDialogPlan, setEditDialogPlan] = useState<OperationalPlan | null>(null);
  const [editDialogGoalName, setEditDialogGoalName] = useState<string>("");
  const [editDialogInitiativeName, setEditDialogInitiativeName] = useState<string>("");
  
  // إضافة نشاط جديد مباشرة
  const [addingActivityUnder, setAddingActivityUnder] = useState<{
    strategicGoal: string;
    initiative: string;
    userId: string;
  } | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityTarget, setNewActivityTarget] = useState("");
  
  // إضافة مبادرة جديدة مباشرة
  const [addingInitiativeUnder, setAddingInitiativeUnder] = useState<string | null>(null);
  const [newInlineInitiativeName, setNewInlineInitiativeName] = useState("");
  const [newInlineActivityName, setNewInlineActivityName] = useState("");
  const [newInlineActivityTarget, setNewInlineActivityTarget] = useState("");
  
  // إضافة هدف استراتيجي جديد مباشرة
  const [isAddingNewStrategicGoal, setIsAddingNewStrategicGoal] = useState(false);
  const [newInlineGoalName, setNewInlineGoalName] = useState("");
  const [newInlineGoalInitiative, setNewInlineGoalInitiative] = useState("");
  const [newInlineGoalActivity, setNewInlineGoalActivity] = useState("");
  const [newInlineGoalTarget, setNewInlineGoalTarget] = useState("");
  
  // نافذة الإضافة المنظمة
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [addItemDialogType, setAddItemDialogType] = useState<"strategic_goal" | "initiative" | "activity">("strategic_goal");
  const [addItemDialogParentGoal, setAddItemDialogParentGoal] = useState<string>("");
  const [addItemDialogParentInit, setAddItemDialogParentInit] = useState<string>("");
  
  // نافذة ترتيب الأهداف الاستراتيجية
  const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false);
  const [reorderGoals, setReorderGoals] = useState<StrategicGoal[]>([]);
  
  // نافذة ترتيب المبادرات
  const [isSelectGoalForInitiativesOpen, setIsSelectGoalForInitiativesOpen] = useState(false);
  const [isReorderInitiativesDialogOpen, setIsReorderInitiativesDialogOpen] = useState(false);
  const [reorderInitiatives, setReorderInitiatives] = useState<{name: string; id?: string; display_order?: number}[]>([]);
  const [reorderInitiativesGoal, setReorderInitiativesGoal] = useState<string>("");
  
  // نافذة ترتيب الأنشطة
  const [isSelectInitiativeForActivitiesOpen, setIsSelectInitiativeForActivitiesOpen] = useState(false);
  const [isReorderActivitiesDialogOpen, setIsReorderActivitiesDialogOpen] = useState(false);
  const [reorderActivities, setReorderActivities] = useState<OperationalPlan[]>([]);
  const [reorderActivitiesInitiative, setReorderActivitiesInitiative] = useState<string>("");
  const [reorderActivitiesGoal, setReorderActivitiesGoal] = useState<string>("");
  
  // نافذة إدارة الأعمدة المخصصة
  const [isManageColumnsDialogOpen, setIsManageColumnsDialogOpen] = useState(false);
  const [customColumns, setCustomColumns] = useState<{
    id: string;
    name: string;
    column_type: "text" | "number" | "date" | "department" | "employee";
    display_order: number;
    is_required: boolean;
    is_active: boolean;
  }[]>([]);
  
  // ترتيب جميع الأعمدة
  const [columnOrder, setColumnOrder] = useState<{
    id: string;
    column_key: string;
    column_name: string;
    display_order: number;
    is_visible: boolean;
    is_standard: boolean;
  }[]>([]);

  // Form state
  const [strategicGoal, setStrategicGoal] = useState("");
  const [initiative, setInitiative] = useState("");
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(0));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // الأهداف الاستراتيجية والمبادرات والأقسام
  const [strategicGoals, setStrategicGoals] = useState<StrategicGoal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string>("");
  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);
  const [isAddingNewInitiative, setIsAddingNewInitiative] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");
  
  // فلاتر الخطط التشغيلية
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>("all");
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterPlanName, setFilterPlanName] = useState<string>("all");
  
  // توليد AI
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);

  // فتح حوار التوليد تلقائياً عند القدوم من رفع Excel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("aiGenerate") === "1") {
      setIsAIDialogOpen(true);
      params.delete("aiGenerate");
      const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);
  
  // اختيار مسؤول التنفيذ
  const [selectedResponsibleEmployee, setSelectedResponsibleEmployee] = useState<string>("");

  // الخطط المرفوعة من Excel
  interface ExcelPlanRow {
    id: string;
    plan_name: string;
    year: number;
    sheet_name: string | null;
    columns: string[];
    rows: Record<string, any>[];
    use_for_ai: boolean;
    source_filename: string | null;
    created_at: string;
  }
  const [excelPlans, setExcelPlans] = useState<ExcelPlanRow[]>([]);
  const [expandedExcelPlanId, setExpandedExcelPlanId] = useState<string | null>(null);
  const [expandedExcelRows, setExpandedExcelRows] = useState<Record<string, boolean>>({});

  // التحقق من دور المدير - نتحقق من role في user أو من user_roles
  const [userRole, setUserRole] = useState<string | null>(null);
  
  useEffect(() => {
    const checkUserRole = async () => {
      if (!authUser) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: authUser.id });
      setUserRole(data);
    };
    checkUserRole();
  }, [authUser]);
  
  // المدير هو من له دور admin في قاعدة البيانات وليس في وضع المعاينة
  const isAdmin = (userRole === "admin" || user.role === "مدير النظام") && !previewAsEmployee;

  // المبادرات المفلترة حسب الهدف المختار
  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === selectedGoalId
  );

  useEffect(() => {
    fetchPlans();
    fetchStrategicGoals();
    fetchInitiatives();
    fetchDepartments();
    // قائمة الموظفين مطلوبة لاختيار مسؤول التنفيذ داخل تعديل النشاط
    fetchEmployees();
    fetchCustomColumns();
    fetchColumnOrder();
    fetchExcelPlans();
  }, [authUser, isAdmin]);

  const fetchExcelPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("excel_plans" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setExcelPlans(((data as any[]) || []) as ExcelPlanRow[]);
    } catch (err) {
      console.error("Failed to load excel plans:", err);
    }
  };

  const deleteExcelPlan = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخطة المرفوعة؟")) return;
    try {
      const { error } = await supabase.from("excel_plans" as any).delete().eq("id", id);
      if (error) throw error;
      setExcelPlans((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "تم الحذف", description: "تم حذف الخطة المرفوعة" });
    } catch (err: any) {
      toast({ title: "فشل الحذف", description: err?.message, variant: "destructive" });
    }
  };

  const toggleExcelPlanAi = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("excel_plans" as any)
        .update({ use_for_ai: !current })
        .eq("id", id);
      if (error) throw error;
      setExcelPlans((prev) => prev.map((p) => (p.id === id ? { ...p, use_for_ai: !current } : p)));
    } catch (err: any) {
      toast({ title: "فشل التحديث", description: err?.message, variant: "destructive" });
    }
  };

  const fetchCustomColumns = async () => {
    try {
      const { data, error } = await supabase
        .from("operational_plan_custom_columns")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setCustomColumns(data || []);
    } catch (error) {
      console.error("Error fetching custom columns:", error);
    }
  };

  const fetchColumnOrder = async () => {
    try {
      const { data, error } = await supabase
        .from("operational_plan_column_order")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setColumnOrder(data || []);
    } catch (error) {
      console.error("Error fetching column order:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, color")
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchStrategicGoals = async () => {
    try {
      // 1) تحميل الأهداف
      const { data: goals, error } = await supabase
        .from("strategic_goals")
        .select("id, name, color, year, department_id, display_order")
        .eq("year", year)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const goalIds = (goals || []).map((g) => g.id);

      // 2) تحميل الأقسام المالكة (متعدد) عبر جدول الربط
      const deptMap = new Map<string, Department[]>();
      if (goalIds.length > 0) {
        const { data: links, error: linksError } = await supabase
          .from("strategic_goal_departments")
          .select("strategic_goal_id, department:departments(id, name, color)")
          .in("strategic_goal_id", goalIds);

        if (linksError) throw linksError;

        (links || []).forEach((l: any) => {
          const dept = l.department as Department | null;
          if (!dept) return;
          const prev = deptMap.get(l.strategic_goal_id) || [];
          deptMap.set(l.strategic_goal_id, [...prev, dept]);
        });
      }

      // 3) دمج البيانات لسهولة العرض
      const goalsWithDepts: StrategicGoal[] = (goals || []).map((g: any) => {
        const linkedDepts = deptMap.get(g.id) || [];
        return {
          ...g,
          departments: linkedDepts,
          // fallback للبيانات القديمة لو كانت موجودة
          department_name: linkedDepts[0]?.name || null,
        };
      });

      setStrategicGoals(goalsWithDepts);
    } catch (error) {
      console.error("Error fetching strategic goals:", error);
    }
  };

  const fetchInitiatives = async () => {
    try {
      // 1) تحميل المبادرات
      const { data: inits, error } = await supabase
        .from("initiatives")
        .select("id, strategic_goal_id, name, department_id, display_order")
        .order("display_order", { ascending: true });

      if (error) throw error;

      const initIds = (inits || []).map((i) => i.id);

      // 2) تحميل الأقسام المالكة (متعدد) عبر جدول الربط
      const deptMap = new Map<string, Department[]>();
      if (initIds.length > 0) {
        const { data: links, error: linksError } = await supabase
          .from("initiative_departments")
          .select("initiative_id, department:departments(id, name, color)")
          .in("initiative_id", initIds);

        if (linksError) throw linksError;

        (links || []).forEach((l: any) => {
          const dept = l.department as Department | null;
          if (!dept) return;
          const prev = deptMap.get(l.initiative_id) || [];
          deptMap.set(l.initiative_id, [...prev, dept]);
        });
      }

      const initsWithDepts: Initiative[] = (inits || []).map((i: any) => {
        const linkedDepts = deptMap.get(i.id) || [];
        return {
          ...i,
          departments: linkedDepts,
          department_name: linkedDepts[0]?.name || null,
        };
      });

      setInitiatives(initsWithDepts);
    } catch (error) {
      console.error("Error fetching initiatives:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, department_id, job_role")
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast({
        title: "تنبيه",
        description: error?.message || "تعذر تحميل قائمة الموظفين",
        variant: "destructive",
      });
      setEmployees([]);
    }
  };

  // الخطط المفلترة
  const filteredPlans = plans.filter(plan => {
    // فلتر السنة
    if (plan.year !== filterYear) {
      return false;
    }
    
    // فلتر اسم الخطة
    if (filterPlanName !== "all") {
      if ((plan.plan_name || "الخطة الأولى") !== filterPlanName) {
        return false;
      }
    }

    // فلتر القسم
    if (filterDepartmentId !== "all") {
      const responsibleEmployee = employees.find(e => e.id === plan.responsible_employee_id);
      if (!responsibleEmployee || responsibleEmployee.department_id !== filterDepartmentId) {
        return false;
      }
    }
    
    // فلتر مسؤول التنفيذ
    if (filterEmployeeId !== "all") {
      if (plan.responsible_employee_id !== filterEmployeeId) {
        return false;
      }
    }
    
    return true;
  });

  // قائمة أسماء الخطط المتاحة في السنة الحالية (يدوية + Excel)
  const availablePlanNames = Array.from(
    new Set([
      ...plans
        .filter((p) => p.year === filterYear)
        .map((p) => p.plan_name || "الخطة الأولى"),
      ...excelPlans
        .filter((p) => p.year === filterYear)
        .map((p) => p.plan_name || "الخطة الأولى"),
    ])
  );

  // الخطط المرفوعة من Excel بعد تطبيق نفس الفلاتر (السنة + اسم الخطة)
  const filteredExcelPlans = excelPlans.filter((ep) => {
    if (ep.year !== filterYear) return false;
    if (filterPlanName !== "all" && (ep.plan_name || "الخطة الأولى") !== filterPlanName) return false;
    return true;
  });

  // إحصاءات الخطة المختارة (تعتمد على filteredPlans)
  const selectedPlanStats = (() => {
    const goalsSet = new Set<string>();
    const initsSet = new Set<string>();
    const subInitsSet = new Set<string>();
    let totalTarget = 0;
    let totalBudget = 0;
    filteredPlans.forEach((p) => {
      if (p.strategic_goal) goalsSet.add(p.strategic_goal_id || p.strategic_goal);
      if (p.initiative) initsSet.add(p.initiative_id || p.initiative);
      if (p.sub_initiative) subInitsSet.add(p.sub_initiative_id || p.sub_initiative);
      totalTarget += Number(p.annual_target || 0);
      totalBudget += Number(p.estimated_budget || 0);
    });
    // إضافة عدد صفوف الأنشطة من خطط Excel المفلترة
    let excelActivities = 0;
    filteredExcelPlans.forEach((ep) => {
      excelActivities += Array.isArray(ep.rows) ? ep.rows.length : 0;
    });
    return {
      goals: goalsSet.size,
      initiatives: initsSet.size,
      subInitiatives: subInitsSet.size,
      activities: filteredPlans.length + excelActivities,
      totalTarget,
      totalBudget,
    };
  })();

  // توليد AI للخطط التشغيلية: انتقل لصفحة الرفع لاختيار ملف ثم التوليد
  const handleAIGeneratePlans = async () => {
    setIsAIDialogOpen(false);
    navigate("/operational-plans/upload");
  };

  const fetchPlans = async () => {
    if (!authUser) return;
    
    if (!plansLoaded) setLoading(true);
    try {
      const { data: plansData, error } = await supabase
        .from("operational_plans")
        .select("*, responsible_employee:responsible_employee_id(full_name)")
        .order("display_order", { ascending: true });

      if (error) throw error;

      const planRows = plansData || [];
      const planIds = planRows.map((plan) => plan.id);
      const userIds = Array.from(new Set(planRows.map((plan) => plan.user_id).filter(Boolean)));

      const [monthsRes, employeeNamesRes] = await Promise.all([
        planIds.length
          ? supabase
              .from("operational_plan_months")
              .select("*")
              .in("operational_plan_id", planIds)
              .order("month", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        isAdmin && userIds.length
          ? supabase
              .from("employees")
              .select("user_id, full_name")
              .in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (monthsRes.error) throw monthsRes.error;
      if (employeeNamesRes.error) throw employeeNamesRes.error;

      const monthsByPlan = new Map<string, OperationalPlanMonth[]>();
      (monthsRes.data || []).forEach((month) => {
        const prev = monthsByPlan.get(month.operational_plan_id) || [];
        monthsByPlan.set(month.operational_plan_id, [...prev, month as OperationalPlanMonth]);
      });

      const employeeNameByUser = new Map(
        (employeeNamesRes.data || []).map((employee: any) => [employee.user_id, employee.full_name])
      );

      const plansWithMonths = planRows.map((plan) => ({
        ...plan,
        months: monthsByPlan.get(plan.id) || [],
        employee_name: isAdmin && plan.user_id !== authUser.id ? employeeNameByUser.get(plan.user_id) || "" : "",
        responsible_employee_name: (plan.responsible_employee as any)?.full_name || null,
      }));

      setPlans(plansWithMonths);
    } catch (error: any) {
      // Log the real error so we can diagnose later. When mounted as a
      // background-preloaded embed inside the organization's internal
      // dashboard, suppress the destructive toast — it would pop over
      // whatever the user is currently viewing for a load they didn't
      // initiate. The user can retry by switching to the tab.
      console.error("[OperationalPlans] fetchPlans failed:", error);
      if (!embedded) {
        toast({
          title: "خطأ",
          description: "فشل في تحميل الخطط التشغيلية",
          variant: "destructive",
        });
      }
    } finally {
      setPlansLoaded(true);
      setLoading(false);
    }
  };

  const handleAnnualTargetChange = (value: string) => {
    setAnnualTarget(value);
    const target = parseInt(value) || 0;
    // توزيع تلقائي بالتساوي
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    const newTargets = Array(12).fill(perMonth);
    // إضافة الباقي للأشهر الأخيرة
    for (let i = 11; i >= 12 - remainder; i--) {
      newTargets[i]++;
    }
    setMonthlyTargets(newTargets);
  };

  const handleMonthlyTargetChange = (monthIndex: number, value: string) => {
    const newTargets = [...monthlyTargets];
    newTargets[monthIndex] = parseInt(value) || 0;
    setMonthlyTargets(newTargets);
  };

  const getTotalMonthlyTargets = () => {
    return monthlyTargets.reduce((sum, t) => sum + t, 0);
  };

  // هيكل النشاط المحلي
  interface LocalActivity {
    id: string;
    name: string;
    annualTarget: number;
  }

  // هيكل المبادرة المحلية
  interface LocalInitiative {
    id: string;
    name: string;
    isNew: boolean;
    existingId?: string;
    activities: LocalActivity[];
  }

  // هيكل الهدف المحلي
  interface LocalGoal {
    id: string;
    name: string;
    isNew: boolean;
    existingId?: string;
    initiatives: LocalInitiative[];
  }

  const handleDialogSubmit = async (data: {
    selectedEmployeeId: string;
    goals: LocalGoal[];
    year: number;
  }) => {
    try {
      const targetUserId = isAdmin ? data.selectedEmployeeId : authUser!.id;

      for (const goal of data.goals) {
        if (!goal.name.trim()) continue;

        // إنشاء أو استخدام الهدف الاستراتيجي
        let goalId = goal.existingId;
        if (goal.isNew && goal.name.trim()) {
          const { data: newGoal, error: goalError } = await supabase
            .from("strategic_goals")
            .insert({ name: goal.name.trim(), year: data.year })
            .select()
            .single();
          
          if (goalError) throw goalError;
          goalId = newGoal.id;
        }

        for (const initiative of goal.initiatives) {
          if (!initiative.name.trim()) continue;

          // إنشاء أو استخدام المبادرة
          let initId = initiative.existingId;
          if (initiative.isNew && initiative.name.trim() && goalId) {
            const { data: newInit, error: initError } = await supabase
              .from("initiatives")
              .insert({ name: initiative.name.trim(), strategic_goal_id: goalId })
              .select()
              .single();
            
            if (initError) throw initError;
            initId = newInit.id;
          }

          for (const activity of initiative.activities) {
            if (!activity.name.trim() || activity.annualTarget <= 0) continue;

            // إنشاء الخطة التشغيلية
            const { data: planData, error: planError } = await supabase
              .from("operational_plans")
              .insert({
                user_id: targetUserId,
                strategic_goal: goal.name,
                initiative: initiative.name,
                strategic_goal_id: goalId || null,
                initiative_id: initId || null,
                activity_name: activity.name,
                annual_target: activity.annualTarget,
                year: data.year,
              })
              .select()
              .single();

            if (planError) throw planError;

            // توزيع المستهدف بالتساوي على الأشهر
            const perMonth = Math.floor(activity.annualTarget / 12);
            const remainder = activity.annualTarget % 12;
            const monthlyTargets = Array(12).fill(perMonth);
            for (let i = 11; i >= 12 - remainder; i--) {
              monthlyTargets[i]++;
            }

            const monthsToInsert = monthlyTargets.map((target, index) => ({
              operational_plan_id: planData.id,
              month: index + 1,
              monthly_target: target,
            }));

            const { error: monthsError } = await supabase
              .from("operational_plan_months")
              .insert(monthsToInsert);

            if (monthsError) throw monthsError;
          }
        }
      }

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الخطط التشغيلية",
      });

      setIsAddDialogOpen(false);
      fetchPlans();
      fetchStrategicGoals();
      fetchInitiatives();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الخطط",
        variant: "destructive",
      });
    }
  };

  // فتح نافذة ترتيب الأهداف
  const openReorderDialog = () => {
    // استخراج الأهداف الفريدة من الخطط الموجودة
    const uniqueGoalNames = [...new Set(plans.map(p => p.strategic_goal).filter(Boolean))] as string[];
    
    // مطابقة مع strategicGoals للحصول على البيانات الكاملة مع الترتيب
    const goalsFromPlans: StrategicGoal[] = uniqueGoalNames.map(goalName => {
      const matchedGoal = strategicGoals.find(g => g.name === goalName);
      if (matchedGoal) {
        return matchedGoal;
      }
      // إذا لم يوجد في قاعدة البيانات، أنشئ كائن مؤقت
      return {
        id: goalName, // استخدم الاسم كمعرف مؤقت
        name: goalName,
        color: 'bg-gray-500',
        year: year,
        department_id: null,
        display_order: 999
      };
    });
    
    // ترتيب حسب display_order
    goalsFromPlans.sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
    
    setReorderGoals(goalsFromPlans);
    setIsReorderDialogOpen(true);
  };

  // تحريك هدف في القائمة المحلية
  const moveGoalInList = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reorderGoals.length) return;

    const newGoals = [...reorderGoals];
    [newGoals[index], newGoals[targetIndex]] = [newGoals[targetIndex], newGoals[index]];
    setReorderGoals(newGoals);
  };

  // حفظ الترتيب الجديد
  const saveGoalsOrder = async () => {
    try {
      // تحديث كل هدف بترتيبه الجديد
      for (let i = 0; i < reorderGoals.length; i++) {
        await supabase
          .from("strategic_goals")
          .update({ display_order: i + 1 })
          .eq("id", reorderGoals[i].id);
      }

      await fetchStrategicGoals();
      setIsReorderDialogOpen(false);
      
      toast({
        title: "تم الحفظ",
        description: "تم حفظ ترتيب الأهداف الاستراتيجية بنجاح",
      });
    } catch (error: any) {
      console.error("Error saving goals order:", error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الترتيب",
        variant: "destructive",
      });
    }
  };

  // فتح نافذة ترتيب المبادرات لهدف معين
  const openReorderInitiativesDialog = (goalName: string) => {
    const goalId = strategicGoals.find((g) => g.name === goalName)?.id;

    // نجمع المبادرات حسب الاسم (لأن بعض السجلات القديمة قد لا تحتوي initiative_id)
    const byName = new Map<string, { name: string; id?: string }>();

    plans
      .filter((p) => p.strategic_goal === goalName)
      .forEach((p) => {
        const name = (p.initiative || "").trim();
        if (!name) return;

        const existing = byName.get(name) || { name };

        // خذ أول initiative_id غير فارغ إن وجد لكن لا تقبله إذا كان مربوطًا بهدف آخر
        const candidateId = p.initiative_id || existing.id;
        const candidateInit = candidateId ? initiatives.find((i) => i.id === candidateId) : undefined;
        const safeId = candidateInit && goalId && candidateInit.strategic_goal_id !== goalId ? undefined : candidateId;

        byName.set(name, { name, id: safeId });
      });

    const initsFromPlans = [...byName.values()]
      .map(({ id, name }) => {
        const matchedInit =
          (id ? initiatives.find((i) => i.id === id) : undefined) ||
          (goalId ? initiatives.find((i) => i.name === name && i.strategic_goal_id === goalId) : undefined) ||
          initiatives.find((i) => i.name === name);

        return {
          name: matchedInit?.name ?? name,
          id: matchedInit?.id ?? id,
          display_order: matchedInit?.display_order ?? 999,
        };
      })
      .filter((i) => !!i.name);

    // ترتيب حسب display_order
    initsFromPlans.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

    setReorderInitiatives(initsFromPlans);
    setReorderInitiativesGoal(goalName);
    setIsReorderInitiativesDialogOpen(true);
  };

  // تحريك مبادرة في القائمة المحلية
  const moveInitiativeInList = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reorderInitiatives.length) return;

    const newInits = [...reorderInitiatives];
    [newInits[index], newInits[targetIndex]] = [newInits[targetIndex], newInits[index]];
    setReorderInitiatives(newInits);
  };

  // حفظ ترتيب المبادرات
  const saveInitiativesOrder = async () => {
    try {
      const goalId = strategicGoals.find((g) => g.name === reorderInitiativesGoal)?.id;
      if (!goalId) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على الهدف الاستراتيجي في قاعدة البيانات",
          variant: "destructive",
        });
        return;
      }

      // ثبّت strategic_goal_id لكل الخطط تحت هذا الهدف (تصحيح بيانات قديمة)
      await supabase
        .from("operational_plans")
        .update({ strategic_goal_id: goalId })
        .eq("strategic_goal", reorderInitiativesGoal)
        .neq("strategic_goal_id", goalId);

      await supabase
        .from("operational_plans")
        .update({ strategic_goal_id: goalId })
        .eq("strategic_goal", reorderInitiativesGoal)
        .is("strategic_goal_id", null);

      const skipped: string[] = [];

      for (let i = 0; i < reorderInitiatives.length; i++) {
        const init = reorderInitiatives[i];
        const order = i + 1;

        // نحتاج مبادرة ضمن هذا الهدف تحديدًا
        let initId: string | undefined = undefined;

        // 1) لو جاي ID من الخطط، تأكد أنه لنفس الهدف
        if (init.id) {
          const known = initiatives.find((x) => x.id === init.id);
          if (!known || known.strategic_goal_id === goalId) initId = init.id;
        }

        // 2) لو ما فيه، ابحث بالاسم داخل نفس الهدف
        if (!initId) {
          initId = initiatives.find((x) => x.name === init.name && x.strategic_goal_id === goalId)?.id;
        }

        // 3) لو ما فيه، أنشئ مبادرة جديدة ضمن هذا الهدف
        if (!initId) {
          const { data: created, error: createError } = await supabase
            .from("initiatives")
            .insert({ name: init.name, strategic_goal_id: goalId, display_order: order })
            .select("id")
            .single();

          if (createError) throw createError;
          initId = created?.id;
        } else {
          const { error } = await supabase
            .from("initiatives")
            .update({ display_order: order })
            .eq("id", initId);
          if (error) throw error;
        }

        if (!initId) {
          skipped.push(init.name);
          continue;
        }

        // اربط كل خطط (الهدف + اسم المبادرة) بهذا الـ initiative_id (حتى لو كان مرتبطًا خطأً سابقًا)
        const { error: linkError } = await supabase
          .from("operational_plans")
          .update({ initiative_id: initId, strategic_goal_id: goalId })
          .eq("strategic_goal", reorderInitiativesGoal)
          .eq("initiative", init.name);

        if (linkError) throw linkError;
      }

      await fetchInitiatives();
      await fetchPlans();
      await fetchStrategicGoals();
      setIsReorderInitiativesDialogOpen(false);

      if (skipped.length) {
        toast({
          title: "تم الحفظ مع تنبيه",
          description: `تم حفظ الترتيب، لكن تعذر تحديث: ${skipped.join("، ")}`,
        });
      } else {
        toast({
          title: "تم الحفظ",
          description: "تم حفظ ترتيب المبادرات بنجاح",
        });
      }
    } catch (error: any) {
      console.error("Error saving initiatives order:", error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الترتيب",
        variant: "destructive",
      });
    }
  };

  // فتح نافذة ترتيب الأنشطة لمبادرة معينة
  const openReorderActivitiesDialog = (goalName: string, initName: string) => {
    const activitiesInInit = plans
      .filter(p => p.strategic_goal === goalName && p.initiative === initName)
      .sort((a, b) => (a.display_order || 999) - (b.display_order || 999));
    
    setReorderActivities([...activitiesInInit]);
    setReorderActivitiesGoal(goalName);
    setReorderActivitiesInitiative(initName);
    setIsReorderActivitiesDialogOpen(true);
  };

  // تحريك نشاط في القائمة المحلية
  const moveActivityInList = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reorderActivities.length) return;

    const newActivities = [...reorderActivities];
    [newActivities[index], newActivities[targetIndex]] = [newActivities[targetIndex], newActivities[index]];
    setReorderActivities(newActivities);
  };

  // حفظ ترتيب الأنشطة
  const saveActivitiesOrder = async () => {
    try {
      for (let i = 0; i < reorderActivities.length; i++) {
        await supabase
          .from("operational_plans")
          .update({ display_order: i + 1 })
          .eq("id", reorderActivities[i].id);
      }

      await fetchPlans();
      setIsReorderActivitiesDialogOpen(false);
      
      toast({
        title: "تم الحفظ",
        description: "تم حفظ ترتيب الأنشطة بنجاح",
      });
    } catch (error: any) {
      console.error("Error saving activities order:", error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الترتيب",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!activityName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم النشاط",
        variant: "destructive",
      });
      return;
    }

    // التحقق من اختيار الموظف للمدير
    if (isAdmin && !selectedEmployeeId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الموظف",
        variant: "destructive",
      });
      return;
    }

    if (!annualTarget || parseInt(annualTarget) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال المستهدف السنوي",
        variant: "destructive",
      });
      return;
    }

    const totalMonthly = getTotalMonthlyTargets();
    const annualNum = parseInt(annualTarget);
    
    if (totalMonthly !== annualNum) {
      toast({
        title: "تحذير",
        description: `مجموع الأشهر (${totalMonthly}) لا يساوي المستهدف السنوي (${annualNum})`,
        variant: "destructive",
      });
      return;
    }

    try {
      // تحديد user_id بناءً على نوع المستخدم
      const targetUserId = isAdmin ? selectedEmployeeId : authUser!.id;

      // إنشاء هدف استراتيجي جديد إذا لزم الأمر
      let goalId = selectedGoalId;
      if (isAddingNewGoal && newGoalName.trim()) {
        const { data: newGoal, error: goalError } = await supabase
          .from("strategic_goals")
          .insert({ name: newGoalName.trim(), year })
          .select()
          .single();
        
        if (goalError) throw goalError;
        goalId = newGoal.id;
      }

      // إنشاء مبادرة جديدة إذا لزم الأمر
      let initId = selectedInitiativeId;
      if (isAddingNewInitiative && newInitiativeName.trim() && goalId) {
        const { data: newInit, error: initError } = await supabase
          .from("initiatives")
          .insert({ name: newInitiativeName.trim(), strategic_goal_id: goalId })
          .select()
          .single();
        
        if (initError) throw initError;
        initId = newInit.id;
      }

      // الحصول على أسماء الهدف والمبادرة
      const goalName = isAddingNewGoal ? newGoalName : strategicGoals.find(g => g.id === goalId)?.name || strategicGoal;
      const initName = isAddingNewInitiative ? newInitiativeName : filteredInitiatives.find(i => i.id === initId)?.name || initiative;

      // إنشاء الخطة التشغيلية
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: targetUserId,
          strategic_goal: goalName || null,
          initiative: initName || null,
          strategic_goal_id: goalId || null,
          initiative_id: initId || null,
          activity_name: activityName,
          annual_target: parseInt(annualTarget),
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      // إنشاء توزيع الأشهر
      const monthsToInsert = monthlyTargets.map((target, index) => ({
        operational_plan_id: planData.id,
        month: index + 1,
        monthly_target: target,
      }));

      const { error: monthsError } = await supabase
        .from("operational_plan_months")
        .insert(monthsToInsert);

      if (monthsError) throw monthsError;

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الخطة التشغيلية",
      });

      // Reset form
      setStrategicGoal("");
      setInitiative("");
      setActivityName("");
      setAnnualTarget("");
      setYear(new Date().getFullYear());
      setMonthlyTargets(Array(12).fill(0));
      setSelectedEmployeeId("");
      setSelectedGoalId("");
      setSelectedInitiativeId("");
      setIsAddingNewGoal(false);
      setIsAddingNewInitiative(false);
      setNewGoalName("");
      setNewInitiativeName("");
      setIsAddDialogOpen(false);
      fetchPlans();
      fetchStrategicGoals();
      fetchInitiatives();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الخطة",
        variant: "destructive",
      });
    }
  };

  const handleViewPlan = (plan: OperationalPlan) => {
    setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخطة؟")) return;

    try {
      const { error } = await supabase
        .from("operational_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف الخطة التشغيلية",
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حذف الخطة",
        variant: "destructive",
      });
    }
  };

  // حفظ تعديلات الخطة
  const handleSaveEdit = async (planId: string) => {
    if (!editFormData) return;
    
    try {
      const { error } = await supabase
        .from("operational_plans")
        .update({
          activity_name: editFormData.activity_name,
          annual_target: editFormData.annual_target,
          strategic_goal: editFormData.strategic_goal || null,
          initiative: editFormData.initiative || null,
          responsible_employee_id: editFormData.responsible_employee_id || null,
        })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "تم الحفظ",
        description: "تم حفظ التعديلات بنجاح",
      });

      setEditingPlanId(null);
      setEditFormData(null);
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ التعديلات",
        variant: "destructive",
      });
    }
  };

  // فتح نافذة التعديل
  const openEditDialog = (type: "strategic_goal" | "initiative" | "activity", goalName?: string, initName?: string, plan?: OperationalPlan) => {
    setEditDialogType(type);
    setEditDialogGoalName(goalName || "");
    setEditDialogInitiativeName(initName || "");
    setEditDialogPlan(plan || null);
    setEditDialogOpen(true);
  };

  const handleDialogSave = () => {
    fetchPlans();
    fetchStrategicGoals();
    fetchInitiatives();
  };

  // الحصول على الموظفين حسب القسم
  const getEmployeesByDepartment = (departmentId: string | null) => {
    if (!departmentId) return employees;
    return employees.filter(emp => emp.department_id === departmentId);
  };

  // بدء تعديل الأهداف الشهرية
  const handleStartEditMonths = (plan: OperationalPlan) => {
    const monthlyValues = Array(12).fill(0);
    plan.months?.forEach(m => {
      if (m.month >= 1 && m.month <= 12) {
        monthlyValues[m.month - 1] = m.monthly_target;
      }
    });
    setEditingMonthlyTargets(prev => ({ ...prev, [plan.id]: monthlyValues }));
    setIsEditingMonths(plan.id);
  };

  // حفظ تعديلات الأهداف الشهرية
  const handleSaveMonthlyTargets = async (plan: OperationalPlan) => {
    const monthlyValues = editingMonthlyTargets[plan.id];
    if (!monthlyValues) return;

    try {
      // تحديث أو إنشاء سجلات الأشهر
      for (let i = 0; i < 12; i++) {
        const monthNum = i + 1;
        const existingMonth = plan.months?.find(m => m.month === monthNum);
        
        if (existingMonth) {
          // تحديث السجل الموجود
          const { error } = await supabase
            .from("operational_plan_months")
            .update({ monthly_target: monthlyValues[i] })
            .eq("id", existingMonth.id);
          if (error) throw error;
        } else {
          // إنشاء سجل جديد
          const { error } = await supabase
            .from("operational_plan_months")
            .insert({
              operational_plan_id: plan.id,
              month: monthNum,
              monthly_target: monthlyValues[i]
            });
          if (error) throw error;
        }
      }

      // تحديث المستهدف السنوي
      const newAnnualTarget = monthlyValues.reduce((sum, val) => sum + val, 0);
      await supabase
        .from("operational_plans")
        .update({ annual_target: newAnnualTarget })
        .eq("id", plan.id);

      toast({
        title: "تم الحفظ",
        description: "تم حفظ الأهداف الشهرية بنجاح",
      });

      setIsEditingMonths(null);
      setEditingMonthlyTargets(prev => {
        const updated = { ...prev };
        delete updated[plan.id];
        return updated;
      });
      fetchPlans();
    } catch (error: any) {
      console.error("Error saving monthly targets:", error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الأهداف الشهرية",
        variant: "destructive",
      });
    }
  };

  // تحديث قيمة شهر معين
  const handleMonthTargetChange = (planId: string, monthIndex: number, value: number) => {
    setEditingMonthlyTargets(prev => {
      const current = prev[planId] || Array(12).fill(0);
      const updated = [...current];
      updated[monthIndex] = value;
      return { ...prev, [planId]: updated };
    });
  };

  // إضافة نشاط جديد مباشرة تحت مبادرة
  const handleAddActivityUnder = async () => {
    if (!addingActivityUnder || !newActivityName.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: addingActivityUnder.userId,
          strategic_goal: addingActivityUnder.strategicGoal,
          initiative: addingActivityUnder.initiative,
          activity_name: newActivityName.trim(),
          annual_target: parseInt(newActivityTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة النشاط الجديد",
      });

      setAddingActivityUnder(null);
      setNewActivityName("");
      setNewActivityTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding activity:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة النشاط",
        variant: "destructive",
      });
    }
  };

  // إضافة مبادرة جديدة مباشرة تحت هدف استراتيجي
  const handleAddInitiativeUnder = async () => {
    if (!addingInitiativeUnder || !newInlineInitiativeName.trim() || !newInlineActivityName.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: authUser!.id,
          strategic_goal: addingInitiativeUnder,
          initiative: newInlineInitiativeName.trim(),
          activity_name: newInlineActivityName.trim(),
          annual_target: parseInt(newInlineActivityTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة المبادرة والنشاط الجديد",
      });

      setAddingInitiativeUnder(null);
      setNewInlineInitiativeName("");
      setNewInlineActivityName("");
      setNewInlineActivityTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding initiative:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة المبادرة",
        variant: "destructive",
      });
    }
  };

  // إضافة هدف استراتيجي جديد مباشرة
  const handleAddNewStrategicGoal = async () => {
    if (!newInlineGoalName.trim() || !newInlineGoalInitiative.trim() || !newInlineGoalActivity.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: authUser!.id,
          strategic_goal: newInlineGoalName.trim(),
          initiative: newInlineGoalInitiative.trim(),
          activity_name: newInlineGoalActivity.trim(),
          annual_target: parseInt(newInlineGoalTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة الهدف الاستراتيجي الجديد",
      });

      setIsAddingNewStrategicGoal(false);
      setNewInlineGoalName("");
      setNewInlineGoalInitiative("");
      setNewInlineGoalActivity("");
      setNewInlineGoalTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding strategic goal:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة الهدف الاستراتيجي",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">نشطة</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">مكتملة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">معلقة</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout embedded={embedded}>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          icon={<Target className="w-6 h-6" />}
          title={isAdmin ? "الخطط التشغيلية" : "الخطة التشغيلية"}
          subtitle={isAdmin ? "إدارة الخطط التشغيلية للموظفين" : "إدارة خططك التشغيلية"}
          actions={
            <>
              <Button
                className="gap-2 bg-white text-primary hover:bg-white/90"
                onClick={() => navigate("/operational-plans/add")}
              >
                <Plus className="w-4 h-4" />
                إضافة خطة يدوياً
              </Button>
              <Button
                className="gap-2 bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-400"
                onClick={() => navigate("/operational-plans/upload")}
              >
                <FileSpreadsheet className="w-4 h-4" />
                رفع ملف Excel
              </Button>
              {isAdmin && (
                <Button
                  className="gap-2 bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm"
                  onClick={() => setIsAIDialogOpen(true)}
                  disabled={isAIGenerating}
                >
                  {isAIGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  توليد الخطط بالذكاء الاصطناعي
                </Button>
              )}
              <Button
                className={`gap-2 border ${
                  isEditMode
                    ? "bg-white text-primary border-white"
                    : "bg-white/15 text-white border-white/30 hover:bg-white/25 backdrop-blur-sm"
                }`}
                onClick={() => {
                  if (isEditMode) {
                    setIsEditMode(false);
                    setEditingPlanId(null);
                    setEditFormData(null);
                    setIsEditingMonths(null);
                    setEditingMonthlyTargets({});
                    setAddingActivityUnder(null);
                    setNewActivityName("");
                    setNewActivityTarget("");
                  } else {
                    setIsEditMode(true);
                  }
                }}
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

        <div>
          <AddOperationalPlanDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            isAdmin={isAdmin}
            employees={employees}
            departments={departments}
            strategicGoals={strategicGoals}
            initiatives={initiatives}
            onSubmit={handleDialogSubmit}
          />
          
          {/* Dialog توليد AI */}
          {isAdmin && (
            <div>
              {isAIDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl border border-purple-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                        <Sparkles className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">توليد بالذكاء الاصطناعي</h3>
                        <p className="text-sm text-gray-500">إنشاء خطط تشغيلية تلقائياً</p>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 rounded-xl p-4 mb-4 border border-purple-200">
                      <p className="text-sm font-medium text-purple-900 leading-relaxed">
                        لتوليد خطة بالذكاء الاصطناعي، ارفع ملف Excel (حتى لو كان مختصراً)، وسيستنتج الذكاء الاصطناعي الهدف ويبني خطة تشغيلية كاملة.
                      </p>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        className="border-gray-300"
                        onClick={() => setIsAIDialogOpen(false)}
                      >
                        إغلاق
                      </Button>
                      <Button 
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 gap-2 shadow-lg shadow-purple-500/25"
                        onClick={handleAIGeneratePlans}
                        disabled={isAIGenerating}
                      >
                        {isAIGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            جاري التوليد...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            توليد الخطط
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* شريط الفلاتر */}
        <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-500/25">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-semibold">فلترة</span>
            </div>
            
            {/* فلتر السنة */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-blue-100 shadow-sm hover:border-blue-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <Select
                dir="rtl"
                value={filterYear.toString()}
                onValueChange={(val) => {
                  setFilterYear(parseInt(val));
                  setFilterPlanName("all");
                }}
              >
                <SelectTrigger className="w-[120px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {getAvailableYears().map((yr) => (
                    <SelectItem key={yr} value={yr.toString()}>
                      {yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* فلتر القسم */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-indigo-100 shadow-sm hover:border-indigo-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <Select dir="rtl" value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
                <SelectTrigger className="w-[170px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                  <SelectValue placeholder="اختر القسم" />
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
            
            {/* فلتر مسؤول التنفيذ */}
            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border-2 border-teal-100 shadow-sm hover:border-teal-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <Select dir="rtl" value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
                <SelectTrigger className="w-[190px] h-9 border-0 bg-transparent focus:ring-0 shadow-none">
                  <SelectValue placeholder="اختر مسؤول التنفيذ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المسؤولين</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      <div className="flex items-center gap-2">
                        <span>{emp.full_name}</span>
                        {emp.job_role && (
                          <span className="text-xs text-gray-400">({emp.job_role})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* زر إعادة تعيين الفلاتر */}
            {(filterDepartmentId !== "all" || filterEmployeeId !== "all" || filterYear !== new Date().getFullYear() || filterPlanName !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                onClick={() => {
                  setFilterDepartmentId("all");
                  setFilterEmployeeId("all");
                  setFilterYear(new Date().getFullYear());
                  setFilterPlanName("all");
                }}
              >
                <X className="w-4 h-4 ml-1" />
                إعادة تعيين
              </Button>
            )}
            
          </div>

          {/* اختيار الخطة (عند وجود أكثر من خطة لنفس السنة) */}
          {availablePlanNames.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap pt-3 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-600 text-xs px-2">
                <Target className="w-4 h-4" />
                <span className="font-semibold">الخطة:</span>
              </div>
              {availablePlanNames.length > 1 && (
                <button
                  onClick={() => setFilterPlanName("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filterPlanName === "all"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-primary/60 hover:bg-primary/5"
                  }`}
                >
                  جميع الخطط
                </button>
              )}
              {availablePlanNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setFilterPlanName(name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    filterPlanName === name || (availablePlanNames.length === 1 && filterPlanName === "all")
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:border-primary/60 hover:bg-primary/5"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* شريط وضع التعديل */}
        {isEditMode && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-orange-800">وضع التعديل مفعّل</p>
                <p className="text-sm text-orange-600">انقر على أي خلية للتعديل، أو استخدم أزرار الإضافة والحذف</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={openReorderDialog}
              >
                <ArrowUp className="w-4 h-4 ml-1" />
                <ArrowDown className="w-4 h-4" />
                ترتيب الأهداف
              </Button>
              <Button 
                variant="outline" 
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setIsSelectGoalForInitiativesOpen(true)}
              >
                <ArrowUp className="w-4 h-4 ml-1" />
                <ArrowDown className="w-4 h-4" />
                ترتيب المبادرات
              </Button>
              <Button 
                variant="outline" 
                className="border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => setIsSelectInitiativeForActivitiesOpen(true)}
              >
                <ArrowUp className="w-4 h-4 ml-1" />
                <ArrowDown className="w-4 h-4" />
                ترتيب الأنشطة
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                onClick={() => setIsManageColumnsDialogOpen(true)}
              >
                <Columns className="w-4 h-4 ml-1" />
                إدارة الأعمدة
              </Button>
              <Button 
                variant="outline" 
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => {
                  setIsEditMode(false);
                  setEditingPlanId(null);
                  setEditFormData(null);
                  setIsEditingMonths(null);
                  setEditingMonthlyTargets({});
                  setAddingActivityUnder(null);
                }}
              >
                <X className="w-4 h-4 ml-1" />
                إلغاء التعديل
              </Button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-slate-700">
              إحصاءات {filterPlanName === "all" ? `جميع خطط ${filterYear}` : filterPlanName}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">الأهداف الاستراتيجية</p>
                  <p className="text-2xl font-bold text-primary" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(selectedPlanStats.goals)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">المبادرات الفرعية</p>
                  <p className="text-2xl font-bold text-amber-600" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {formatNumber(selectedPlanStats.subInitiatives || selectedPlanStats.initiatives)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">الأنشطة</p>
                  <p className="text-2xl font-bold text-emerald-600" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(selectedPlanStats.activities)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">إجمالي المستهدفات</p>
                  <p className="text-2xl font-bold text-blue-600" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(selectedPlanStats.totalTarget)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">الميزانية التقديرية</p>
                  <p className="text-2xl font-bold text-violet-600" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {formatNumber(selectedPlanStats.totalBudget)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Excel-uploaded plans section */}
        {filteredExcelPlans.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-700">
                الخطط المرفوعة من Excel ({filteredExcelPlans.length})
              </h3>
            </div>
            <div className="grid gap-3">
              {filteredExcelPlans.map((ep) => {
                const expanded = expandedExcelPlanId === ep.id;
                const previewRows = expanded ? ep.rows : ep.rows.slice(0, 5);
                return (
                  <Card key={ep.id} className="overflow-hidden border-emerald-200/60">
                    <div className="px-5 py-3 bg-gradient-to-l from-emerald-50 to-white border-b border-emerald-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">
                            {ep.plan_name}
                            <span className="text-xs text-slate-500 font-normal mr-2">· {ep.year}</span>
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {ep.source_filename || ep.sheet_name} · {ep.rows.length} صف · {ep.columns.length} عمود
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ep.use_for_ai && (
                          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 gap-1">
                            <Sparkles className="w-3 h-3" />
                            مرجع AI
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExcelPlanAi(ep.id, ep.use_for_ai)}
                          className="gap-1"
                          title="تبديل الاعتماد للذكاء الاصطناعي"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {ep.use_for_ai ? "إلغاء الاعتماد" : "اعتماد لـ AI"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedExcelPlanId(expanded ? null : ep.id)}
                        >
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {expanded ? "طي" : "عرض كامل"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteExcelPlan(ep.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className={`overflow-x-auto ${expanded ? "max-h-[calc(100vh-220px)] overflow-y-auto" : ""}`}>
                      {(() => {
                        // كشف أعمدة الهرم
                        const goalCol = ep.columns.find((c: string) => /الهدف الاستراتيجي|^هدف|برنامج/.test(c));
                        const initCol = ep.columns.find((c: string) => /^المبادرة الرئيسية$|^المبادرة$/.test(c));
                        const subInitCol = ep.columns.find((c: string) => /المبادرة الفرعية|فرعية/.test(c));
                        const activityCol = ep.columns.find((c: string) => /^النشاط$|^نشاط/.test(c));
                        const respCol = ep.columns.find((c: string) => /مسؤول|منفذ/.test(c));
                        const targetCol = ep.columns.find((c: string) => /المستهدف السنوي|^المستهدف$/.test(c));
                        const costCol = ep.columns.find((c: string) => /تكلفة|ميزانية/.test(c));

                        const distributeMonthly = (annualStr: string): number[] => {
                          const num = parseInt(String(annualStr).replace(/[^\d]/g, ""), 10);
                          if (!num || isNaN(num)) return Array(12).fill(0);
                          const base = Math.floor(num / 12);
                          const remainder = num - base * 12;
                          return Array.from({ length: 12 }, (_, i) => base + (i < remainder ? 1 : 0));
                        };

                        // تجميع الصفوف هرميًا: الهدف ← المبادرة ← الأنشطة
                        type SubGroup = { sub: string; plans: any[] };
                        type InitGroup = { init: string; subs: SubGroup[]; plansCount: number };
                        type Group = { goal: string; colorIndex: number; inits: InitGroup[] };
                        const groups: Group[] = [];
                        const goalMap = new Map<string, Map<string, any[]>>();
                        previewRows.forEach((r: any) => {
                          const g = goalCol ? String(r[goalCol] ?? "بدون هدف").trim() || "بدون هدف" : "بدون هدف";
                          const i = initCol ? String(r[initCol] ?? "بدون مبادرة").trim() || "بدون مبادرة" : "بدون مبادرة";
                          if (!goalMap.has(g)) goalMap.set(g, new Map());
                          const m = goalMap.get(g)!;
                          if (!m.has(i)) m.set(i, []);
                          m.get(i)!.push(r);
                        });
                        let cIdx = 0;
                        for (const [g, m] of goalMap.entries()) {
                          const inits: InitGroup[] = [];
                          for (const [i, plans] of m.entries()) {
                            // تجميع الأنشطة بحسب المبادرة الفرعية لدمج الصفوف المتطابقة
                            const subMap = new Map<string, any[]>();
                            plans.forEach((p) => {
                              const sub = subInitCol ? String(p[subInitCol] ?? "").trim() : "";
                              if (!subMap.has(sub)) subMap.set(sub, []);
                              subMap.get(sub)!.push(p);
                            });
                            const subs: SubGroup[] = [];
                            for (const [sub, sp] of subMap.entries()) subs.push({ sub, plans: sp });
                            inits.push({ init: i, subs, plansCount: plans.length });
                          }
                          groups.push({ goal: g, colorIndex: cIdx % GOAL_COLORS.length, inits });
                          cIdx++;
                        }

                        const tableRows: JSX.Element[] = [];
                        groups.forEach((group, gi) => {
                          const color = GOAL_COLORS[group.colorIndex];
                          const totalRowsInGoal = group.inits.reduce((s, x) => s + x.plansCount, 0);
                          let goalRendered = false;

                          group.inits.forEach((ig, ii) => {
                            const initiativeHasNoSub = !subInitCol || ig.subs.every((s) => !s.sub);
                            let initRendered = false;

                            ig.subs.forEach((sg, si) => {
                              let subRendered = false;
                              sg.plans.forEach((row, pi) => {
                                const rowKey = `${ep.id}_${gi}_${ii}_${si}_${pi}`;
                                const isExpanded = !!expandedExcelRows[rowKey];
                                const annualValue = targetCol ? String(row[targetCol] ?? "") : "";
                                const monthly = distributeMonthly(annualValue);
                                const annualNum = parseInt(annualValue.replace(/[^\d]/g, ""), 10) || 0;
                                const canExpand = !!targetCol && monthly.some(v => v > 0);

                                const isLastInSub = pi === sg.plans.length - 1;
                                const isLastSub = si === ig.subs.length - 1;
                                const isLastInit = ii === group.inits.length - 1;
                                const isLastGoal = gi === groups.length - 1;
                                let bottomBorder = 'border-b border-gray-200';
                                if (isLastInSub && isLastSub && isLastInit && !isLastGoal) bottomBorder = 'border-b-[3px] border-gray-400';
                                else if (isLastInSub && isLastSub && !isLastInit) bottomBorder = 'border-b-2 border-gray-300';

                                tableRows.push(
                                  <tr key={rowKey} className={`group/row ${color.bg} ${color.hover} border-r-4 ${color.border} transition-colors ${isExpanded ? 'bg-muted/30' : ''} ${bottomBorder}`}>
                                    {/* الهدف الاستراتيجي */}
                                    {!goalRendered && (
                                      <td rowSpan={totalRowsInGoal} className={`py-4 px-5 align-middle text-center ${color.bg} border-l-2 border-gray-200`}>
                                        <div className="flex flex-col items-center justify-center text-center">
                                          <p className={`font-semibold text-sm ${color.text} leading-relaxed text-center`}>{group.goal}</p>
                                        </div>
                                      </td>
                                    )}
                                    {/* المبادرة الرئيسية */}
                                    {!initRendered && (
                                      <td rowSpan={ig.plansCount} className="py-4 px-5 align-middle text-center bg-gray-50/50 border-l-2 border-gray-200">
                                        <div className="flex flex-col items-center justify-center text-center">
                                          <p className="text-gray-700 text-sm font-medium leading-relaxed text-center">{ig.init}</p>
                                        </div>
                                      </td>
                                    )}
                                    {/* المبادرة الفرعية - مدمجة عبر rowSpan */}
                                    {!initiativeHasNoSub && !subRendered && (
                                      <td rowSpan={sg.plans.length} className="py-4 px-5 align-middle text-center border-l-2 border-gray-200">
                                        {sg.sub ? (
                                          <div className="flex items-center justify-center gap-1.5">
                                            <span className="text-violet-500 text-xs">↳</span>
                                            <span className="text-sm text-violet-700 font-medium">{sg.sub}</span>
                                          </div>
                                        ) : (
                                          <span className="text-gray-300 text-xs">—</span>
                                        )}
                                      </td>
                                    )}
                                    {/* النشاط */}
                                    <td colSpan={initiativeHasNoSub ? 2 : 1} className="py-4 px-5 border-l-2 border-gray-200 align-middle text-center">
                                      <p className="text-sm leading-relaxed text-center text-gray-700 break-words">
                                        {activityCol ? String(row[activityCol] ?? "") : ""}
                                      </p>
                                    </td>
                                    {/* مسؤول التنفيذ */}
                                    <td className="py-4 px-5 border-l-2 border-gray-200 align-middle text-center">
                                      {respCol && String(row[respCol] ?? "").trim() ? (
                                        <div className="flex items-center justify-center gap-2">
                                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-xs font-semibold text-primary">{String(row[respCol]).charAt(0)}</span>
                                          </div>
                                          <span className="text-gray-700 text-sm">{String(row[respCol])}</span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400 text-sm">غير محدد</span>
                                      )}
                                    </td>
                                    {/* المستهدف السنوي + توزيع المستهدفات في نفس الخانة */}
                                    <td className="w-40 py-4 px-3 text-center border-l-2 border-gray-200 align-middle">
                                      <div
                                        className={`flex items-center justify-center gap-2 ${canExpand ? "cursor-pointer group/target" : ""}`}
                                        onClick={() => canExpand && setExpandedExcelRows(prev => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                      >
                                        <span className="text-sm font-normal text-gray-700" style={{ fontFamily: 'Arial, sans-serif' }}>
                                          {annualNum > 0 ? annualNum.toLocaleString("en-US") : (annualValue || "—")}
                                        </span>
                                        {canExpand && (
                                          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-primary' : 'text-gray-400 group-hover/target:text-primary'}`} />
                                        )}
                                      </div>
                                      {isExpanded && canExpand && (
                                        <div className="mt-3 rounded-md border border-gray-200 bg-white p-2 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
                                          <div className="flex items-center justify-center gap-1.5 rounded-sm bg-green-600 px-2 py-1.5 mb-2">
                                            <Calendar className="w-3.5 h-3.5 text-white" />
                                            <span className="text-[11px] font-medium text-white">التوزيع الشهري</span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-1.5">
                                            {MONTHS_AR.map((month, mi) => (
                                              <div key={mi} className="rounded-sm bg-blue-500 border border-blue-600 px-1.5 py-1 text-center min-h-[44px]">
                                                <div className="text-[10px] text-white/90 leading-none mb-1">{month}</div>
                                                <div className="text-xs font-semibold text-white">{formatNumber(monthly[mi])}</div>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="mt-2 rounded-sm bg-green-600 border border-green-700 px-2 py-1.5 flex items-center justify-between">
                                            <span className="text-[10px] font-medium text-white">المجموع</span>
                                            <span className="text-xs font-semibold text-white">{formatNumber(annualNum)}</span>
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    {/* التكلفة التقديرية */}
                                    {costCol && (() => {
                                      const rawCost = row[costCol];
                                      const normalized = String(rawCost ?? "")
                                        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
                                        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
                                      const numCost = Number(normalized.replace(/[^\d.-]/g, ""));
                                      const display = rawCost === undefined || rawCost === null || String(rawCost).trim() === ""
                                        ? "—"
                                        : Number.isFinite(numCost) && numCost !== 0
                                          ? numCost.toLocaleString("en-US")
                                          : normalized || String(rawCost);
                                      return (
                                        <td className="w-32 py-4 px-3 text-center border-l-2 border-gray-200 align-middle">
                                          <span className="text-sm font-normal text-gray-700" style={{ fontFamily: 'Arial, sans-serif' }}>{display}</span>
                                        </td>
                                      );
                                    })()}
                                  </tr>
                                );
                                goalRendered = true;
                                initRendered = true;
                                subRendered = true;
                              });
                            });
                          });
                        });

                        // رؤوس أعمدة ثابتة كنموذج الجدول السفلي
                        const headers: { label: string; cls: string }[] = [
                          { label: "الهدف الاستراتيجي", cls: "py-4 px-5 text-center" },
                          { label: "المبادرة الرئيسية", cls: "py-4 px-5 text-center border-r border-white/20" },
                          { label: "المبادرة الفرعية", cls: "py-4 px-5 text-center border-r border-white/20" },
                          { label: "النشاط", cls: "py-4 px-5 text-center border-r border-white/20" },
                          { label: "مسؤول التنفيذ", cls: "py-4 px-5 text-center border-r border-white/20" },
                          { label: "المستهدف السنوي", cls: "py-4 px-3 text-center border-r border-white/20 w-40" },
                        ];
                        if (costCol) headers.push({ label: "التكلفة التقديرية", cls: "py-4 px-3 text-center border-r border-white/20 w-32" });

                        return (
                          <div className="op-plans-table-wrap rounded-lg border border-gray-200 bg-white">
                            <table className="w-full" dir="rtl">
                              <thead>
                                <tr className="bg-[hsl(var(--primary))] shadow-sm">
                                  {headers.map((h, i) => (
                                    <th key={i} className={`${h.cls} sticky top-0 z-30 bg-[hsl(var(--primary))]`}>
                                      <span className="text-sm font-semibold text-white">{h.label}</span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>{tableRows}</tbody>
                            </table>
                          </div>
                        );
                      })()}
                      {!expanded && ep.rows.length > 5 && (
                        <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100 text-center">
                          + {ep.rows.length - 5} صفوف أخرى — اضغط "عرض كامل" لرؤيتها
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الخطط التشغيلية</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !plansLoaded ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد خطط تشغيلية حتى الآن
              </div>
            ) : (
              <div className="op-plans-table-wrap rounded-lg border border-gray-200 overflow-x-auto bg-white">
                <table className="w-full">
                  {/* رأس الجدول */}
                  <thead>
                    <tr className="bg-[hsl(var(--primary))] shadow-sm">
                      {/* عرض الأعمدة حسب الترتيب من columnOrder */}
                      {columnOrder.filter(c => c.is_visible).map((col, idx) => {
                        // تحديد خصائص العمود
                        const isFirst = idx === 0;
                        const isNumeric = ['annual_target', 'monthly_average'].includes(col.column_key);
                        
                        return (
                          <>
                            <th 
                              key={col.id} 
                              className={`py-4 px-5 sticky top-0 z-30 bg-[hsl(var(--primary))] ${isNumeric ? 'w-28 px-3 text-center' : 'text-right'} ${!isFirst ? 'border-r border-white/20' : ''}`}
                            >
                              <span className="text-sm font-semibold text-white">{col.column_name}</span>
                            </th>
                            {col.column_key === 'initiative' && (
                              <th
                                key={`${col.id}-sub`}
                                className="py-4 px-5 sticky top-0 z-30 bg-[hsl(var(--primary))] text-right border-r border-white/20"
                              >
                                <span className="text-sm font-semibold text-white">المبادرة الفرعية</span>
                              </th>
                            )}
                          </>
                        );
                      })}
                      {isEditMode && (
                        <th className="w-24 py-4 px-3 sticky top-0 z-30 text-center border-r border-white/20 bg-amber-600">
                          <span className="text-sm font-semibold text-white">إجراء</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  
                  <tbody>
                  {(() => {
                    // تجميع الخطط حسب الهدف الاستراتيجي ثم المبادرة
                    const groupedPlans: GroupedPlans[] = [];
                    const goalMap = new Map<string, { initiatives: Map<string, OperationalPlan[]> }>();
                    
                    filteredPlans.forEach(plan => {
                      const goal = plan.strategic_goal || "بدون هدف";
                      const init = plan.initiative || "بدون مبادرة";
                      
                      if (!goalMap.has(goal)) {
                        goalMap.set(goal, { initiatives: new Map() });
                      }
                      const goalData = goalMap.get(goal)!;
                      
                      if (!goalData.initiatives.has(init)) {
                        goalData.initiatives.set(init, []);
                      }
                      goalData.initiatives.get(init)!.push(plan);
                    });
                    
                    // ترتيب الأهداف حسب display_order من strategicGoals
                    const sortedGoalNames = [...goalMap.keys()].sort((a, b) => {
                      const goalA = strategicGoals.find(g => g.name === a);
                      const goalB = strategicGoals.find(g => g.name === b);
                      const orderA = goalA?.display_order ?? 999;
                      const orderB = goalB?.display_order ?? 999;
                      return orderA - orderB;
                    });
                    
                    let colorIndex = 0;
                    sortedGoalNames.forEach((goalName) => {
                      const goalData = goalMap.get(goalName)!;
                      const inits: { initiative: string; plans: OperationalPlan[] }[] = [];
                      
                      const goalIdForSort = strategicGoals.find(g => g.name === goalName)?.id;
                      
                      // ترتيب المبادرات حسب display_order (استخدم أول initiative_id غير فارغ داخل المجموعة إن وجد)
                      const sortedInitNames = [...goalData.initiatives.keys()].sort((a, b) => {
                        const aPlans = goalData.initiatives.get(a) || [];
                        const bPlans = goalData.initiatives.get(b) || [];

                        const aInitId = aPlans.find(p => !!p.initiative_id)?.initiative_id;
                        const bInitId = bPlans.find(p => !!p.initiative_id)?.initiative_id;

                        const initA =
                          (aInitId ? initiatives.find(i => i.id === aInitId) : undefined) ||
                          initiatives.find(i => i.name === a && (!goalIdForSort || i.strategic_goal_id === goalIdForSort));

                        const initB =
                          (bInitId ? initiatives.find(i => i.id === bInitId) : undefined) ||
                          initiatives.find(i => i.name === b && (!goalIdForSort || i.strategic_goal_id === goalIdForSort));

                        const orderA = initA?.display_order ?? 999;
                        const orderB = initB?.display_order ?? 999;
                        return orderA - orderB;
                      });
                      
                      sortedInitNames.forEach(initName => {
                        const plans = goalData.initiatives.get(initName)!;
                        // ترتيب الأنشطة حسب display_order
                        const sortedPlans = [...plans].sort((a, b) => 
                          (a.display_order || 999) - (b.display_order || 999)
                        );
                        inits.push({ initiative: initName, plans: sortedPlans });
                      });
                      
                      groupedPlans.push({
                        strategicGoal: goalName,
                        colorIndex: colorIndex % GOAL_COLORS.length,
                        initiatives: inits
                      });
                      colorIndex++;
                    });
                    
                    const rows: JSX.Element[] = [];
                    
                    groupedPlans.forEach((group, groupIndex) => {
                      const color = GOAL_COLORS[group.colorIndex];
                      // حساب إجمالي الصفوف لهذا الهدف (التوزيع الشهري أصبح داخل نفس صف النشاط فلا يُضاف كصف مستقل)
                      const totalRowsInGoal =
                        group.initiatives.reduce((sum, init) => {
                          const planRows = init.plans.length;

                          // نضيف صف "إضافة نشاط" فقط عندما يكون المستخدم فعلاً يضيف نشاطاً تحت هذه المبادرة
                          const addActivityRow =
                            isEditMode &&
                            addingActivityUnder?.strategicGoal === group.strategicGoal &&
                            addingActivityUnder?.initiative === init.initiative
                              ? 1
                              : 0;

                          return sum + planRows + addActivityRow;
                        }, 0) +
                        // في وضع التعديل نضيف صف "إضافة مبادرة جديدة" (إما زر أو نموذج) أسفل الهدف
                        (isEditMode ? 1 : 0);
                      
                      let goalRowRendered = false;
                      
                      group.initiatives.forEach((initGroup, initIndex) => {
                        // حساب الصفوف للمبادرة (التوزيع الشهري داخل نفس صف النشاط حتى لا يختل الجدول)
                        const addActivityRowForThisInitiative =
                          isEditMode &&
                          addingActivityUnder?.strategicGoal === group.strategicGoal &&
                          addingActivityUnder?.initiative === initGroup.initiative
                            ? 1
                            : 0;

                        const totalRowsInInitiative = initGroup.plans.length + addActivityRowForThisInitiative;
                        let initRowRendered = false;
                        // إذا لم يكن لأي نشاط في هذه المبادرة "مبادرة فرعية"، نُلغي العمود ونوسّع خلية النشاط
                        const initiativeHasNoSubInitiatives = initGroup.plans.every(
                          (p) => !p.sub_initiative || !p.sub_initiative.trim()
                        );
                        
                        initGroup.plans.forEach((plan, planIndex) => {
                          const isExpanded = expandedPlanId === plan.id;
                          const isFirstRowOfGoal = !goalRowRendered;
                          const isFirstRowOfInit = !initRowRendered;
                          const isLastInInitiative = planIndex === initGroup.plans.length - 1;
                          const isLastInitiative = initIndex === group.initiatives.length - 1;
                          const isLastGoal = groupIndex === groupedPlans.length - 1;
                          const isEditingThisMonth = isEditingMonths === plan.id;
                          const currentMonthlyValues = editingMonthlyTargets[plan.id] || [];
                          
                          // تحديد نوع الفاصل السفلي
                          let bottomBorder = 'border-b border-gray-200';
                          if (isLastInInitiative && isLastInitiative && !isLastGoal) {
                            // فاصل بين الأهداف الاستراتيجية
                            bottomBorder = 'border-b-[3px] border-gray-400';
                          } else if (isLastInInitiative && !isLastInitiative) {
                            // فاصل بين المبادرات
                            bottomBorder = 'border-b-2 border-gray-300';
                          }
                          
                          // البحث بالـ ID أولاً ثم بالاسم
                          const goalData = strategicGoals.find(g => g.id === plan.strategic_goal_id) 
                            || strategicGoals.find(g => g.name === group.strategicGoal);
                          const initData = initiatives.find(i => i.id === plan.initiative_id)
                            || initiatives.find(i => i.name === initGroup.initiative);
                          
                          rows.push(
                            <tr 
                              key={plan.id} 
                              className={`group/row ${color.bg} ${color.hover} border-r-4 ${color.border} transition-colors ${isExpanded ? 'bg-primary/5' : ''} ${bottomBorder}`}
                            >
                              {/* الهدف الاستراتيجي */}
                              {isFirstRowOfGoal && (
                                <td 
                                  rowSpan={totalRowsInGoal} 
                                  className={`py-4 px-5 align-middle ${color.bg} border-l-2 border-gray-200`}
                                >
                                  <div className="flex flex-col items-center justify-center text-center gap-2">
                                    <div className="w-full">
                                      <p className={`font-semibold text-sm ${color.text} leading-relaxed mb-2 text-center`}>{group.strategicGoal}</p>
                                      {/* الأقسام */}
                                      {goalData?.departments && goalData.departments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                          {goalData.departments.map((d) => (
                                            <Badge 
                                              key={d.id} 
                                              variant="outline" 
                                              className={`text-[10px] px-2 py-0.5 ${color.badge}`}
                                            >
                                              {d.name}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 flex-shrink-0 opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-primary hover:bg-gray-100 mx-auto"
                                        onClick={() => {
                                          const actualGoalName = goalData?.name || group.strategicGoal;
                                          openEditDialog("strategic_goal", actualGoalName, undefined, plan);
                                        }}
                                        title="تعديل الهدف"
                                      >
                                        <Settings2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              )}
                              
                              {/* المبادرة */}
                              {isFirstRowOfInit && (
                                <td 
                                  rowSpan={totalRowsInInitiative} 
                                  className="py-4 px-5 align-middle bg-gray-50/50 border-l-2 border-gray-200"
                                >
                                  <div className="flex flex-col items-center justify-center text-center gap-2">
                                    <div className="w-full">
                                      <p className="text-gray-700 text-sm font-medium leading-relaxed mb-2 text-center">{initGroup.initiative}</p>
                                      {/* الأقسام */}
                                      {initData?.departments && initData.departments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                          {initData.departments.map((d) => (
                                            <Badge 
                                              key={d.id} 
                                              variant="outline" 
                                              className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 border-gray-200"
                                            >
                                              {d.name}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 flex-shrink-0 opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-primary hover:bg-gray-100 mx-auto"
                                        onClick={() => {
                                          const actualInitName = initData?.name || initGroup.initiative;
                                          openEditDialog("initiative", group.strategicGoal, actualInitName, plan);
                                        }}
                                        title="تعديل المبادرة"
                                      >
                                        <Settings2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              )}
                              
                              {/* المبادرة الفرعية */}
                              {!initiativeHasNoSubInitiatives && (
                                <td className="py-4 px-5 align-middle border-l-2 border-gray-200">
                                  {plan.sub_initiative ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-violet-500 text-xs">↳</span>
                                      <span className="text-sm text-violet-700 font-medium">{plan.sub_initiative}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>
                              )}

                              {/* النشاط (يمتد على عمودين عند انعدام المبادرات الفرعية) */}
                              <td
                                colSpan={initiativeHasNoSubInitiatives ? 2 : 1}
                                className="py-4 px-5 border-l-2 border-gray-200 align-top"
                              >
                                <div className="flex flex-col gap-3 min-w-[320px] max-w-[560px]">
                                  <div 
                                    className="flex items-center justify-between gap-2 cursor-pointer group/activity"
                                    onClick={() => handleViewPlan(plan)}
                                  >
                                    <div className="flex flex-col gap-1 min-w-0">
                                      <p className={`text-sm leading-relaxed ${isExpanded ? 'text-primary font-semibold' : 'text-gray-700 group-hover/activity:text-primary'}`}>{plan.activity_name}</p>
                                    </div>
                                    <ChevronDown 
                                      className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180 text-primary' : 'text-gray-400'}`} 
                                    />
                                  </div>

                                  {isExpanded && (
                                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
                                      <div className="flex items-center justify-between gap-3 rounded-md bg-green-600 px-3 py-2 mb-3">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-3.5 h-3.5 text-white" />
                                          </div>
                                          <span className="text-xs font-semibold text-white truncate">التوزيع الشهري</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          {isEditMode && (isEditingThisMonth ? (
                                            <>
                                              <Button size="sm" variant="ghost" className="h-7 px-2 text-white hover:bg-white/15" onClick={() => handleSaveMonthlyTargets(plan)}>
                                                <Check className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-white hover:bg-white/15"
                                                onClick={() => {
                                                  setIsEditingMonths(null);
                                                  setEditingMonthlyTargets(prev => {
                                                    const updated = { ...prev };
                                                    delete updated[plan.id];
                                                    return updated;
                                                  });
                                                }}
                                              >
                                                <X className="w-3.5 h-3.5" />
                                              </Button>
                                            </>
                                          ) : (
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-white hover:bg-white/15" onClick={() => handleStartEditMonths(plan)}>
                                              <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                          ))}
                                          <Button size="sm" variant="ghost" className="h-7 px-2 text-white hover:bg-white/15" onClick={() => setExpandedPlanId(null)}>
                                            <X className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-1.5">
                                        {MONTHS_AR.map((month, index) => {
                                          const monthData = plan.months?.find(m => m.month === index + 1);
                                          const target = isEditingThisMonth
                                            ? (currentMonthlyValues[index] || 0)
                                            : (monthData?.monthly_target || 0);

                                          return (
                                            <div key={index} className="rounded-md bg-blue-500 border border-blue-600 px-2 py-1.5 text-center min-h-[54px]">
                                              <div className="text-[11px] text-white/90 leading-none mb-1.5">{month}</div>
                                              {isEditingThisMonth ? (
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={target}
                                                  onChange={(e) => handleMonthTargetChange(plan.id, index, parseInt(e.target.value) || 0)}
                                                  className="h-7 text-center text-xs font-bold px-1"
                                                />
                                              ) : (
                                                <div className={`text-sm font-bold ${target > 0 ? 'text-white' : 'text-white/50'}`}>{formatNumber(target)}</div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>

                                      <div className="mt-2 rounded-md bg-green-600 border border-green-700 px-3 py-2 flex items-center justify-between">
                                        <span className="text-xs font-medium text-white">المجموع</span>
                                        <span className="text-base font-bold text-white">
                                          {formatNumber(isEditingThisMonth
                                            ? currentMonthlyValues.reduce((sum, val) => sum + (val || 0), 0)
                                            : plan.annual_target
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              
                              {/* الأعمدة المتحركة (بعد النشاط) */}
                              {columnOrder
                                .filter(c => c.is_visible && !['strategic_goal', 'initiative', 'activity'].includes(c.column_key))
                                .map((col) => {
                                  // مسؤول التنفيذ
                                  if (col.column_key === 'responsible_employee') {
                                    return (
                                      <td key={col.id} className="py-4 px-5 border-l-2 border-gray-200">
                                        {plan.responsible_employee_name ? (
                                          <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                              <span className="text-xs font-semibold text-primary">{plan.responsible_employee_name.charAt(0)}</span>
                                            </div>
                                            <span className="text-gray-700 text-sm">{plan.responsible_employee_name}</span>
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 text-sm">غير محدد</span>
                                        )}
                                      </td>
                                    );
                                  }
                                  
                                  // المستهدف السنوي
                                  if (col.column_key === 'annual_target') {
                                    return (
                                      <td key={col.id} className="w-28 py-4 px-3 text-center border-l-2 border-gray-200">
                                        <span className="text-lg font-bold text-gray-800">{formatNumber(plan.annual_target)}</span>
                                      </td>
                                    );
                                  }
                                  
                                  // الحمل الشهري المتوسط
                                  if (col.column_key === 'monthly_average') {
                                    return (
                                      <td key={col.id} className="w-28 py-4 px-3 text-center border-l-2 border-gray-200">
                                        <span className="text-lg font-bold text-[hsl(var(--primary))]">
                                          {formatNumber(Math.round(plan.annual_target / 12))}
                                        </span>
                                      </td>
                                    );
                                  }
                                  
                                  // الأعمدة المخصصة
                                  return (
                                    <td key={col.id} className="py-4 px-3 text-center border-l-2 border-gray-200">
                                      <span className="text-sm text-gray-500">—</span>
                                    </td>
                                  );
                                })
                              }
                              
                              {/* عمود الإجراء - يظهر فقط في وضع التعديل */}
                              {isEditMode && (
                                <td className="w-24 py-4 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-amber-600 hover:bg-amber-50"
                                      onClick={() => openEditDialog("activity", group.strategicGoal, initGroup.initiative, plan)}
                                      title="تعديل النشاط"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-red-500 hover:bg-red-50"
                                      onClick={() => handleDeletePlan(plan.id)}
                                      title="حذف النشاط"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                          
                          goalRowRendered = true;
                          initRowRendered = true;
                        });
                        
                        // صف إضافة نشاط جديد تحت هذه المبادرة (يظهر فقط في وضع التعديل)
                        if (isEditMode) {
                          const isAddingHere = addingActivityUnder?.strategicGoal === group.strategicGoal && 
                                               addingActivityUnder?.initiative === initGroup.initiative;
                          
                          if (isAddingHere) {
                            rows.push(
                              <tr 
                                key={`add-activity-${group.strategicGoal}-${initGroup.initiative}`} 
                                className={`${color.bg} border-r-4 ${color.border} bg-green-50/50`}
                              >
                                {/* ملاحظة: الهدف الاستراتيجي والمبادرة يغطيان هذا الصف عبر rowSpan */}
                                {/* المبادرة الفرعية - فارغة */}
                                <td className="py-2 px-4 border-l-2 border-gray-300"></td>
                                {/* النشاط */}
                                <td className="py-2 px-4 border-l-2 border-gray-300">
                                  <Input
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="اسم النشاط الجديد"
                                    autoFocus
                                  />
                                </td>
                                {/* خلايا فارغة للأعمدة المتحركة */}
                                {columnOrder
                                  .filter(c => c.is_visible && !['strategic_goal', 'initiative', 'activity'].includes(c.column_key))
                                  .map((col) => {
                                    if (col.column_key === 'annual_target') {
                                      return (
                                        <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300">
                                          <Input
                                            type="number"
                                            value={newActivityTarget}
                                            onChange={(e) => setNewActivityTarget(e.target.value)}
                                            className="h-8 text-sm text-center"
                                            placeholder="المستهدف"
                                          />
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300"></td>
                                    );
                                  })
                                }
                                {/* إجراء */}
                                <td className="py-2 px-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                      onClick={handleAddActivityUnder}
                                      disabled={!newActivityName.trim()}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                      onClick={() => {
                                        setAddingActivityUnder(null);
                                        setNewActivityName("");
                                        setNewActivityTarget("");
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                        }
                      });
                      
                      // صف إضافة مبادرة جديدة تحت هذا الهدف (يظهر فقط في وضع التعديل)
                      if (isEditMode) {
                        const isAddingInitHere = addingInitiativeUnder === group.strategicGoal;
                        
                        if (isAddingInitHere) {
                          rows.push(
                            <tr 
                              key={`add-initiative-${group.strategicGoal}`} 
                              className={`${color.bg} border-r-4 ${color.border} bg-blue-50/50`}
                            >
                              {/* ملاحظة: الهدف الاستراتيجي يغطي هذا الصف عبر rowSpan */}
                              {/* المبادرة */}
                              <td className="py-2 px-4 border-l-2 border-gray-300">
                                <Input
                                  value={newInlineInitiativeName}
                                  onChange={(e) => setNewInlineInitiativeName(e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="اسم المبادرة الجديدة"
                                  autoFocus
                                />
                              </td>
                              {/* المبادرة الفرعية - فارغة */}
                              <td className="py-2 px-4 border-l-2 border-gray-300"></td>
                              {/* النشاط */}
                              <td className="py-2 px-4 border-l-2 border-gray-300">
                                <Input
                                  value={newInlineActivityName}
                                  onChange={(e) => setNewInlineActivityName(e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="اسم النشاط"
                                />
                              </td>
                              {/* خلايا فارغة للأعمدة المتحركة */}
                              {columnOrder
                                .filter(c => c.is_visible && !['strategic_goal', 'initiative', 'activity'].includes(c.column_key))
                                .map((col) => {
                                  if (col.column_key === 'annual_target') {
                                    return (
                                      <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300">
                                        <Input
                                          type="number"
                                          value={newInlineActivityTarget}
                                          onChange={(e) => setNewInlineActivityTarget(e.target.value)}
                                          className="h-8 text-sm text-center"
                                          placeholder="المستهدف"
                                        />
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300"></td>
                                  );
                                })
                              }
                              {/* إجراء */}
                              <td className="py-2 px-2 text-center">
                                <div className="flex justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                    onClick={handleAddInitiativeUnder}
                                    disabled={!newInlineInitiativeName.trim() || !newInlineActivityName.trim()}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                    onClick={() => {
                                      setAddingInitiativeUnder(null);
                                      setNewInlineInitiativeName("");
                                      setNewInlineActivityName("");
                                      setNewInlineActivityTarget("");
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          rows.push(
                            <tr 
                              key={`add-init-btn-${group.strategicGoal}`} 
                              className={`${color.bg} border-r-4 ${color.border} hover:bg-gray-50/50 transition-colors border-b-4 border-b-gray-400`}
                            >
                              <td colSpan={columnOrder.filter(c => c.is_visible && !['strategic_goal'].includes(c.column_key)).length + 2} className="py-3 px-4">
                                <div className="flex justify-center items-center gap-3">
                                  {/* زر إضافة مبادرة جديدة */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-4 text-xs font-medium text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-400"
                                    onClick={() => {
                                      setAddItemDialogType("initiative");
                                      setAddItemDialogParentGoal(group.strategicGoal);
                                      setAddItemDialogParentInit("");
                                      setAddItemDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 ml-1" />
                                    إضافة مبادرة
                                  </Button>
                                  {/* زر إضافة نشاط جديد - يفتح حوار لاختيار المبادرة */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-4 text-xs font-medium text-teal-700 border-teal-300 bg-teal-50 hover:bg-teal-100 hover:text-teal-800 hover:border-teal-400"
                                    onClick={() => {
                                      setAddItemDialogType("activity");
                                      setAddItemDialogParentGoal(group.strategicGoal);
                                      setAddItemDialogParentInit(""); // لا تحديد مبادرة مسبقاً - المستخدم يختار
                                      setAddItemDialogOpen(true);
                                    }}
                                  >
                                    <Plus className="w-3.5 h-3.5 ml-1" />
                                    إضافة نشاط
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      }
                    });
                    
                    // صف إضافة هدف استراتيجي جديد
                    if (isEditMode) {
                      if (isAddingNewStrategicGoal) {
                        rows.push(
                          <tr 
                            key="add-new-strategic-goal" 
                            className="bg-purple-50/50 border-r-4 border-purple-400"
                          >
                            {/* الهدف الاستراتيجي */}
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalName}
                                onChange={(e) => setNewInlineGoalName(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="الهدف الاستراتيجي"
                                autoFocus
                              />
                            </td>
                            {/* المبادرة */}
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalInitiative}
                                onChange={(e) => setNewInlineGoalInitiative(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="المبادرة"
                              />
                            </td>
                            {/* المبادرة الفرعية - فارغة */}
                            <td className="py-2 px-4 border-l-2 border-gray-300"></td>
                            {/* النشاط */}
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalActivity}
                                onChange={(e) => setNewInlineGoalActivity(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="النشاط"
                              />
                            </td>
                            {/* خلايا فارغة للأعمدة المتحركة */}
                            {columnOrder
                              .filter(c => c.is_visible && !['strategic_goal', 'initiative', 'activity'].includes(c.column_key))
                              .map((col) => {
                                if (col.column_key === 'annual_target') {
                                  return (
                                    <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300">
                                      <Input
                                        type="number"
                                        value={newInlineGoalTarget}
                                        onChange={(e) => setNewInlineGoalTarget(e.target.value)}
                                        className="h-8 text-sm text-center"
                                        placeholder="المستهدف"
                                      />
                                    </td>
                                  );
                                }
                                return (
                                  <td key={col.id} className="py-2 px-2 border-l-2 border-gray-300"></td>
                                );
                              })
                            }
                            {/* إجراء */}
                            <td className="py-2 px-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                  onClick={handleAddNewStrategicGoal}
                                  disabled={!newInlineGoalName.trim() || !newInlineGoalInitiative.trim() || !newInlineGoalActivity.trim()}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                  onClick={() => {
                                    setIsAddingNewStrategicGoal(false);
                                    setNewInlineGoalName("");
                                    setNewInlineGoalInitiative("");
                                    setNewInlineGoalActivity("");
                                    setNewInlineGoalTarget("");
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      } else {
                        rows.push(
                          <tr 
                            key="add-goal-btn" 
                            className="bg-purple-50/30 hover:bg-purple-100/50 transition-colors"
                          >
                            <td colSpan={columnOrder.filter(c => c.is_visible).length + 2} className="py-3 px-4">
                              <div className="flex justify-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-4 text-xs font-medium text-purple-700 border-purple-300 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 hover:border-purple-400"
                                  onClick={() => {
                                    setAddItemDialogType("strategic_goal");
                                    setAddItemDialogParentGoal("");
                                    setAddItemDialogParentInit("");
                                    setAddItemDialogOpen(true);
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5 ml-1" />
                                  إضافة هدف استراتيجي
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    }
                    
                    return rows;
                  })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* نافذة التعديل المنظمة */}
        <EditPlanDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          editType={editDialogType}
          plan={editDialogPlan}
          strategicGoalName={editDialogGoalName}
          initiativeName={editDialogInitiativeName}
          strategicGoals={strategicGoals}
          initiatives={initiatives}
          departments={departments}
          employees={employees}
          onSave={handleDialogSave}
          onDelete={() => editDialogPlan && handleDeletePlan(editDialogPlan.id)}
        />
        
        {/* نافذة الإضافة المنظمة */}
        <AddItemDialog
          open={addItemDialogOpen}
          onOpenChange={setAddItemDialogOpen}
          addType={addItemDialogType}
          parentGoalName={addItemDialogParentGoal}
          parentInitiativeName={addItemDialogParentInit}
          departments={departments}
          employees={employees}
          year={year}
          userId={authUser?.id || ""}
          onSave={() => {
            fetchPlans();
            fetchStrategicGoals();
            fetchInitiatives();
          }}
        />

        {/* نافذة ترتيب الأهداف الاستراتيجية */}
        {isReorderDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="bg-primary/10 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-primary">ترتيب الأهداف الاستراتيجية</h3>
                <p className="text-sm text-muted-foreground">استخدم الأسهم لتحريك الأهداف ثم اضغط حفظ</p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {reorderGoals.map((goal, index) => (
                  <div 
                    key={goal.id} 
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:bg-gray-100 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium text-gray-700">{goal.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-primary/10"
                        onClick={() => moveGoalInList(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-primary/10"
                        onClick={() => moveGoalInList(index, 'down')}
                        disabled={index === reorderGoals.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsReorderDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button onClick={saveGoalsOrder}>
                  <Check className="w-4 h-4 ml-1" />
                  حفظ الترتيب
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة ترتيب المبادرات */}
        {isReorderInitiativesDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-blue-700">ترتيب المبادرات</h3>
                <p className="text-sm text-blue-600">الهدف: {reorderInitiativesGoal}</p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {reorderInitiatives.map((init, index) => (
                  <div 
                    key={init.id || init.name} 
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:bg-gray-100 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium text-gray-700 text-center">{init.name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => moveInitiativeInList(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => moveInitiativeInList(index, 'down')}
                        disabled={index === reorderInitiatives.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsReorderInitiativesDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button onClick={saveInitiativesOrder} className="bg-blue-600 hover:bg-blue-700">
                  <Check className="w-4 h-4 ml-1" />
                  حفظ الترتيب
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة ترتيب الأنشطة */}
        {isReorderActivitiesDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="bg-green-50 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-green-700">ترتيب الأنشطة</h3>
                <p className="text-sm text-green-600">المبادرة: {reorderActivitiesInitiative}</p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {reorderActivities.map((activity, index) => (
                  <div 
                    key={activity.id} 
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:bg-gray-100 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold flex items-center justify-center text-sm">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium text-gray-700">{activity.activity_name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-green-600 hover:bg-green-50"
                        onClick={() => moveActivityInList(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-green-600 hover:bg-green-50"
                        onClick={() => moveActivityInList(index, 'down')}
                        disabled={index === reorderActivities.length - 1}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsReorderActivitiesDialogOpen(false)}
                >
                  إلغاء
                </Button>
                <Button onClick={saveActivitiesOrder} className="bg-green-600 hover:bg-green-700">
                  <Check className="w-4 h-4 ml-1" />
                  حفظ الترتيب
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة اختيار الهدف لترتيب المبادرات */}
        {isSelectGoalForInitiativesOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-blue-700">اختر الهدف الاستراتيجي</h3>
                <p className="text-sm text-blue-600">لترتيب المبادرات داخله</p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {(() => {
                  const uniqueGoals = [...new Set(plans.map(p => p.strategic_goal).filter(Boolean))] as string[];

                  // نفس ترتيب الجدول (حسب display_order)
                  uniqueGoals.sort((a, b) => {
                    const goalA = strategicGoals.find(g => g.name === a);
                    const goalB = strategicGoals.find(g => g.name === b);
                    const orderA = goalA?.display_order ?? 999;
                    const orderB = goalB?.display_order ?? 999;
                    return orderA - orderB;
                  });

                  return uniqueGoals.map((goalName) => (
                    <button
                      key={goalName}
                      className="w-full text-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      onClick={() => {
                        setIsSelectGoalForInitiativesOpen(false);
                        openReorderInitiativesDialog(goalName);
                      }}
                    >
                      <span className="font-medium text-gray-700">{goalName}</span>
                    </button>
                  ));
                })()}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSelectGoalForInitiativesOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة اختيار المبادرة لترتيب الأنشطة */}
        {isSelectInitiativeForActivitiesOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-green-50 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-green-700">اختر المبادرة</h3>
                <p className="text-sm text-green-600">لترتيب الأنشطة داخلها</p>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                {(() => {
                  const groupedByGoal = new Map<string, string[]>();
                  plans.forEach(p => {
                    if (p.strategic_goal && p.initiative) {
                      if (!groupedByGoal.has(p.strategic_goal)) {
                        groupedByGoal.set(p.strategic_goal, []);
                      }
                      const inits = groupedByGoal.get(p.strategic_goal)!;
                      if (!inits.includes(p.initiative)) {
                        inits.push(p.initiative);
                      }
                    }
                  });

                  // ترتيب الأهداف مثل الجدول
                  const sortedGoals = [...groupedByGoal.keys()].sort((a, b) => {
                    const goalA = strategicGoals.find(g => g.name === a);
                    const goalB = strategicGoals.find(g => g.name === b);
                    const orderA = goalA?.display_order ?? 999;
                    const orderB = goalB?.display_order ?? 999;
                    return orderA - orderB;
                  });

                  return sortedGoals.map((goalName) => {
                    const goalId = strategicGoals.find(g => g.name === goalName)?.id;
                    const inits = [...(groupedByGoal.get(goalName) || [])];

                    // ترتيب المبادرات داخل الهدف حسب display_order
                    inits.sort((a, b) => {
                      const initA = initiatives.find(i => i.name === a && (!goalId || i.strategic_goal_id === goalId));
                      const initB = initiatives.find(i => i.name === b && (!goalId || i.strategic_goal_id === goalId));
                      const orderA = initA?.display_order ?? 999;
                      const orderB = initB?.display_order ?? 999;
                      return orderA - orderB;
                    });

                    return (
                      <div key={goalName} className="space-y-2">
                        <p className="text-sm font-semibold text-gray-500 px-2">{goalName}</p>
                        {inits.map((initName) => (
                          <button
                            key={initName}
                            className="w-full text-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 transition-colors mr-4"
                            onClick={() => {
                              setIsSelectInitiativeForActivitiesOpen(false);
                              openReorderActivitiesDialog(goalName, initName);
                            }}
                          >
                            <span className="font-medium text-gray-700">{initName}</span>
                          </button>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
              
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSelectInitiativeForActivitiesOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* نافذة إدارة الأعمدة المخصصة */}
        <ManageCustomColumnsDialog
          open={isManageColumnsDialogOpen}
          onOpenChange={setIsManageColumnsDialogOpen}
          onColumnsChange={() => {
            fetchCustomColumns();
            fetchColumnOrder();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
