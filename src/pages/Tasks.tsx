import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Trash2,
  PlayCircle,
  Sparkles,
  Target,
  Brain,
  Loader2,
  User,
  Filter,
  X,
  Edit,
  MessageSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateWithHijri, formatNumberPlain, formatPercent, normalizeNumericInput, getAvailableYears, getCurrentYear } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { TaskCommunicationDialog } from "@/components/tasks/TaskCommunicationDialog";
import { LiveTimer } from "@/components/tasks/LiveTimer";
import { useOrganization } from "@/contexts/OrganizationContext";

import { ActiveTaskBanner } from "@/components/tasks/ActiveTaskBanner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  executive_plan_id: string | null;
  priority: "low" | "medium" | "high";
  status: "upcoming" | "in_progress" | "executed" | "returned" | "delayed" | "completed" | "stalled";
  category: string | null;
  due_date: string | null;
  ai_generated: boolean;
  created_at: string;
  completion_percentage: number;
  quality_percentage: number;
  estimated_time_minutes: number | null;
  actual_time_minutes: number | null;
  started_at: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface ActivityInfo {
  executive_plan_id: string;
  activity_name: string;
}

interface TasksProps {
  embedded?: boolean;
}

type TaskUpdateData = {
  status?: Task["status"];
  started_at?: string;
  actual_time_minutes?: number;
  completion_percentage?: number;
  quality_percentage?: number;
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const TASKS_CACHE_PREFIX = "tasks_page_cache_v1:";

const Tasks = ({ embedded = false }: TasksProps) => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const { currentOrg } = useOrganization();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEditTime, setCanEditTime] = useState(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetchedTasks, setHasFetchedTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // الفلاتر
  const [filterYear, setFilterYear] = useState<string>(String(getCurrentYear()));
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterActivity, setFilterActivity] = useState<string>("all");
  
  // حالة نافذة التوليد
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  // حالة نافذة التعديل
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high",
    user_id: "",
    status: "upcoming" as Task["status"],
    completion_percentage: 0,
    quality_percentage: 0,
    estimated_time_minutes: null as number | null,
    actual_time_minutes: null as number | null,
  });

  // حالة نافذة التواصل
  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = useState(false);
  const [selectedTaskForCommunication, setSelectedTaskForCommunication] = useState<Task | null>(null);

  // حالة نافذة إضافة مهمة جديدة
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high",
    user_id: "",
    estimated_time_minutes: 30,
  });
  const [isAdding, setIsAdding] = useState(false);
  const orgId = currentOrg?.id ?? null;
  const cacheKey = orgId && authUser?.id ? `${TASKS_CACHE_PREFIX}${orgId}:${authUser.id}` : null;

  // فتح نافذة التواصل عند الانتقال من إشعار رسالة
  useEffect(() => {
    const taskIdFromUrl = searchParams.get("task");
    const openChat = searchParams.get("openChat");

    if (taskIdFromUrl && tasks.length > 0 && !loading) {
      const taskToOpen = tasks.find(t => t.id === taskIdFromUrl);
      if (taskToOpen) {
        // ضبط الفلاتر لتتناسب مع تاريخ المهمة حتى تظهر
        if (taskToOpen.due_date) {
          const taskDate = new Date(taskToOpen.due_date);
          const taskYear = taskDate.getFullYear();
          const taskMonth = taskDate.getMonth() + 1;

          // تحديث الفلاتر لإظهار المهمة
          setFilterYear(String(taskYear));
          setFilterMonth(String(taskMonth));
          setFilterDay("all");
          setFilterDepartment("all");
          setFilterEmployee("all");
          setFilterActivity("all");
          setActiveTab("all");
        }

        // فتح نافذة التواصل فقط إذا كان openChat=true (إشعار رسالة)
        if (openChat === "true") {
          setSelectedTaskForCommunication(taskToOpen);
          setIsCommunicationDialogOpen(true);
        }

        // إزالة المعامل من URL بعد المعالجة
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, tasks, loading]);


  // التحقق إذا كان المستخدم هو صاحب المهمة
  const isTaskOwner = (task: Task) => {
    return authUser?.id === task.user_id;
  };

  // التحقق إذا حان وقت المهمة
  const isTaskDue = (task: Task) => {
    if (!task.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate <= today;
  };

  // التحقق من صلاحية المدير وتعديل الوقت
  useEffect(() => {
    const checkPermissions = async () => {
      if (!authUser) return;
      
      // التحقق من صلاحية المدير أو مدير النظام
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: authUser.id });
      const hasAdminAccess = roleData === "admin" || roleData === "super_admin";
      setIsAdmin(hasAdminAccess);
      
      // الأدمن فقط يستطيع تعديل الوقت (نظام التقييم لاحقًا)
      setCanEditTime(hasAdminAccess);
    };
    checkPermissions();
  }, [authUser]);

  // تم إزالة التحقق من المهمة النشطة - يتم الآن من خلال أيقونة تسجيل الحضور في الشريط الجانبي

  // جلب جميع البيانات بدون حجب الصفحة: كاش فوري ثم تحديث في الخلفية
  useEffect(() => {
    if (!authUser || !orgId) return;

    let cancelled = false;
    if (cacheKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.tasks) {
          setTasks(cached.tasks);
          setEmployees(cached.employees || []);
          setDepartments(cached.departments || []);
          setActivities(cached.activities || []);
          setHasFetchedTasks(true);
        }
      } catch {
        // تجاهل الكاش التالف
      }
    }

    const taskColumns = "id,title,description,user_id,executive_plan_id,priority,status,category,due_date,ai_generated,created_at,completion_percentage,quality_percentage,estimated_time_minutes,actual_time_minutes,started_at";

    const loadFast = async () => {
      try {
        const [tasksRes, employeesRes, departmentsRes] = await Promise.all([
          supabase
            .from("tasks")
            .select(taskColumns)
            .eq("organization_id", orgId)
            .order("due_date", { ascending: true })
            .limit(300),
          supabase
            .from("employees")
            .select("id, full_name, user_id, department_id")
            .eq("organization_id", orgId)
            .order("full_name")
            .limit(500),
          supabase
            .from("departments")
            .select("id, name")
            .eq("organization_id", orgId)
            .order("name"),
        ]);

        if (cancelled) return;
        if (tasksRes.error) throw tasksRes.error;

        const nextTasks = (tasksRes.data as Task[]) || [];
        const nextEmployees = (employeesRes.data as Employee[]) || [];
        const nextDepartments = (departmentsRes.data as Department[]) || [];
        setTasks(nextTasks);
        setEmployees(nextEmployees);
        setDepartments(nextDepartments);
        setHasFetchedTasks(true);

        if (cacheKey) {
          localStorage.setItem(cacheKey, JSON.stringify({
            tasks: nextTasks,
            employees: nextEmployees,
            departments: nextDepartments,
            activities,
            cachedAt: Date.now(),
          }));
        }
      } catch (error: any) {
        if (!cancelled) toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFast();

    const activitiesTimer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("executive_plans")
          .select(`
            id,
            operational_plan_month:operational_plan_months!inner (
              operational_plan:operational_plans!inner (
                activity_name
              )
            )
          `)
          .eq("organization_id", orgId)
          .limit(300);
        if (error) throw error;
        if (cancelled) return;
        const activitiesMap: ActivityInfo[] = (data || []).map((ep: any) => ({
          executive_plan_id: ep.id,
          activity_name: ep.operational_plan_month?.operational_plan?.activity_name || "غير محدد",
        }));
        setActivities(activitiesMap);
        if (cacheKey) {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
          localStorage.setItem(cacheKey, JSON.stringify({ ...cached, activities: activitiesMap, cachedAt: Date.now() }));
        }
      } catch (error: any) {
        console.error("Error fetching activities:", error);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(activitiesTimer);
    };
  }, [authUser?.id, orgId, cacheKey]);

  // توليد المهام بالذكاء الاصطناعي لشهر كامل
  const handleGenerateMonthTasks = async () => {
    if (!authUser || !selectedMonth) return;
    
    setIsGenerating(true);
    setGenerationProgress("جاري جلب الخطط التنفيذية...");
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            month: selectedMonth,
            year: new Date().getFullYear(),
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً");
        }
        if (response.status === 402) {
          throw new Error("يرجى إضافة رصيد للذكاء الاصطناعي");
        }
        throw new Error(errorData.error || "فشل في توليد المهام");
      }
      
      const result = await response.json();
      
      toast({
        title: "تم التوليد بنجاح! ✨",
        description: result.message,
      });
      
      // تحديث قائمة المهام
      setTasks(result.tasks || []);
      setIsGenerateDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  // تحديث حالة المهمة (للموظف: قادمة أو تم التنفيذ فقط) - مع حفظ تلقائي ومؤقت الوقت
  const updateTaskStatusLocal = async (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const now = new Date().toISOString();
    const updateData: TaskUpdateData = { status: newStatus as Task["status"] };
    let localUpdate: Partial<Task> = { status: newStatus as Task["status"] };

    // عند بدء التنفيذ، نسجل وقت البدء
    if (newStatus === "in_progress" && !task.started_at) {
      updateData.started_at = now;
      localUpdate.started_at = now;
    }

    // عند إتمام المهمة، نحسب الوقت الفعلي
    if ((newStatus === "executed" || newStatus === "completed") && task.started_at) {
      const startTime = new Date(task.started_at).getTime();
      const endTime = new Date().getTime();
      const actualMinutes = Math.round((endTime - startTime) / (1000 * 60));
      updateData.actual_time_minutes = actualMinutes;
      localUpdate.actual_time_minutes = actualMinutes;
    }

    // تحديث محلي للعرض فوراً
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, ...localUpdate } : t))
    );

    try {
      // حفظ تلقائي في قاعدة البيانات
      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);
      
      if (error) throw error;

      // إرسال إشعار للمدراء
      const statusLabel = getStatusConfig(newStatus).label;
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      if (admins) {
        for (const admin of admins) {
          if (admin.user_id !== authUser?.id) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: "تحديث من موظف",
              message: `قام الموظف بتحديث حالة مهمة "${task.title}" إلى: ${statusLabel}`,
              type: "employee_update",
              related_task_id: taskId,
            });
          }
        }
      }

      // إظهار رسالة عند حساب الوقت الفعلي
      if (localUpdate.actual_time_minutes !== undefined) {
        toast({ 
          title: "تم حساب الوقت الفعلي", 
          description: `استغرقت المهمة ${localUpdate.actual_time_minutes} دقيقة` 
        });
      }
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // تحديث حالة المهمة (للمدير فقط) مع إرسال إشعار ومؤقت الوقت
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const now = new Date().toISOString();
    const updateData: TaskUpdateData = { status: newStatus as Task["status"] };
    let localUpdate: Partial<Task> = { status: newStatus as Task["status"] };

    // عند بدء التنفيذ، نسجل وقت البدء
    if (newStatus === "in_progress" && !task.started_at) {
      updateData.started_at = now;
      localUpdate.started_at = now;
    }

    // عند إتمام المهمة، نحسب الوقت الفعلي
    if ((newStatus === "executed" || newStatus === "completed") && task.started_at) {
      const startTime = new Date(task.started_at).getTime();
      const endTime = new Date().getTime();
      const actualMinutes = Math.round((endTime - startTime) / (1000 * 60));
      updateData.actual_time_minutes = actualMinutes;
      localUpdate.actual_time_minutes = actualMinutes;
    }

    try {
      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", taskId);
      
      if (error) throw error;
      
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, ...localUpdate } : t))
      );

      // إرسال إشعار للموظف صاحب المهمة
      const statusLabel = getStatusConfig(newStatus).label;
      await supabase.from("notifications").insert({
        user_id: task.user_id,
        title: "تحديث حالة المهمة",
        message: `تم تغيير حالة مهمة "${task.title}" إلى: ${statusLabel}`,
        type: "status_update",
        related_task_id: taskId,
      });

      // إظهار رسالة عند حساب الوقت الفعلي
      if (localUpdate.actual_time_minutes !== undefined) {
        toast({ 
          title: "تم تحديث الحالة وحساب الوقت الفعلي", 
          description: `استغرقت المهمة ${localUpdate.actual_time_minutes} دقيقة` 
        });
      } else {
        toast({ title: "تم تحديث الحالة وإرسال الإشعار" });
      }
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // حذف مهمة
  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast({ title: "تم الحذف" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // تحديث التقييم (نسبة الإنجاز أو الجودة) مع إرسال إشعار
  const updateTaskRating = async (taskId: string, field: 'completion_percentage' | 'quality_percentage', value: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // التحقق من أن القيمة بين 0 و 100
    const clampedValue = Math.max(0, Math.min(100, value));
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update(field === "completion_percentage" ? { completion_percentage: clampedValue } : { quality_percentage: clampedValue })
        .eq("id", taskId);
      
      if (error) throw error;
      
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, [field]: clampedValue } : t))
      );

      // إرسال إشعار للموظف صاحب المهمة
      const fieldLabel = field === 'completion_percentage' ? 'نسبة الإنجاز' : 'نسبة الجودة';
      await supabase.from("notifications").insert({
        user_id: task.user_id,
        title: "تحديث التقييم",
        message: `تم تحديث ${fieldLabel} لمهمة "${task.title}" إلى: ${clampedValue}%`,
        type: "rating_update",
        related_task_id: taskId,
      });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // إضافة مهمة جديدة
  const addNewTask = async () => {
    if (!addForm.title.trim() || !addForm.user_id) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    
    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: addForm.title,
          description: addForm.description || null,
          due_date: addForm.due_date || null,
          priority: addForm.priority,
          user_id: addForm.user_id,
          status: "upcoming",
          estimated_time_minutes: addForm.estimated_time_minutes,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setTasks(prev => [...prev, data as Task]);
      
      // إرسال إشعار للموظف
      await supabase.from("notifications").insert({
        user_id: addForm.user_id,
        title: "مهمة جديدة",
        message: `تم تكليفك بمهمة جديدة: "${addForm.title}"`,
        type: "new_task",
        related_task_id: data.id,
      });
      
      toast({ title: "تم إضافة المهمة بنجاح" });
      setIsAddDialogOpen(false);
      setAddForm({
        title: "",
        description: "",
        due_date: "",
        priority: "medium",
        user_id: "",
        estimated_time_minutes: 30,
      });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  // فتح نافذة التعديل
  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date || "",
      priority: task.priority,
      user_id: task.user_id,
      status: task.status,
      completion_percentage: task.completion_percentage || 0,
      quality_percentage: task.quality_percentage || 0,
      estimated_time_minutes: task.estimated_time_minutes,
      actual_time_minutes: task.actual_time_minutes,
    });
    setIsEditDialogOpen(true);
  };

  // حفظ تعديلات المهمة
  const saveTaskEdit = async () => {
    if (!editingTask) return;
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editForm.title,
          description: editForm.description || null,
          due_date: editForm.due_date || null,
          priority: editForm.priority,
          user_id: editForm.user_id,
          status: editForm.status,
          completion_percentage: editForm.completion_percentage,
          quality_percentage: editForm.quality_percentage,
          estimated_time_minutes: editForm.estimated_time_minutes,
          actual_time_minutes: editForm.actual_time_minutes,
        })
        .eq("id", editingTask.id);
      
      if (error) throw error;
      
      setTasks(prev =>
        prev.map(t => (t.id === editingTask.id ? { 
          ...t, 
          ...editForm,
          description: editForm.description || null,
          due_date: editForm.due_date || null,
        } : t))
      );
      
      toast({ title: "تم حفظ التعديلات بنجاح" });
      setIsEditDialogOpen(false);
      setEditingTask(null);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // إعادة تعيين الفلاتر
  const resetFilters = () => {
    setFilterYear(String(getCurrentYear()));
    setFilterMonth("all");
    setFilterDay("all");
    setFilterDepartment("all");
    setFilterEmployee("all");
    setFilterActivity("all");
    setSearchQuery("");
    setActiveTab("all");
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "upcoming":
        return { label: "قادمة", class: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock };
      case "in_progress":
        return { label: "قيد التنفيذ", class: "bg-sky-100 text-sky-700 border-sky-300", icon: PlayCircle };
      case "executed":
        return { label: "تم التنفيذ", class: "bg-teal-100 text-teal-700 border-teal-300", icon: CheckCircle };
      case "returned":
        return { label: "معادة", class: "bg-orange-100 text-orange-700 border-orange-300", icon: AlertTriangle };
      case "delayed":
        return { label: "متأخرة", class: "bg-rose-100 text-rose-700 border-rose-300", icon: AlertTriangle };
      case "completed":
        return { label: "مكتملة", class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: CheckCircle };
      case "stalled":
        return { label: "متعثرة", class: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle };
      default:
        return { label: "قادمة", class: "bg-blue-100 text-blue-700 border-blue-300", icon: Clock };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return { label: "عاجلة", class: "bg-rose-500 text-white" };
      case "medium":
        return { label: "متوسطة", class: "bg-amber-500 text-white" };
      default:
        return { label: "عادية", class: "bg-slate-400 text-white" };
    }
  };

  const employeeByUser = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((employee) => {
      if (employee.user_id) map.set(employee.user_id, employee);
      map.set(employee.id, employee);
    });
    return map;
  }, [employees]);

  const activityByPlan = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach((activity) => map.set(activity.executive_plan_id, activity.activity_name));
    return map;
  }, [activities]);

  // الحصول على اسم المنفذ
  const getExecutorName = (userId: string) => {
    const employee = employeeByUser.get(userId);
    return employee?.full_name || "غير محدد";
  };

  // الحصول على اسم النشاط من executive_plan_id
  const getActivityName = (executivePlanId: string | null) => {
    if (!executivePlanId) return "غير محدد";
    return activityByPlan.get(executivePlanId) || "غير محدد";
  };

  // تجميع المهام حسب النشاط - مع التخزين المؤقت
  const groupTasksByActivity = useCallback((tasksToGroup: Task[]) => {
    const grouped: { [key: string]: { activityName: string; tasks: Task[] } } = {};
    
    tasksToGroup.forEach(task => {
      const activityName = getActivityName(task.executive_plan_id);
      const key = task.executive_plan_id || "no-activity";
      
      if (!grouped[key]) {
        grouped[key] = { activityName, tasks: [] };
      }
      grouped[key].tasks.push(task);
    });
    
    return Object.values(grouped);
  }, [activities]);

  // استخراج السنة والشهر واليوم من تاريخ التنفيذ
  const getYearFromDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return new Date(dateStr).getFullYear();
  };

  const getMonthFromDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return new Date(dateStr).getMonth() + 1;
  };

  const getDayFromDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return new Date(dateStr).getDate();
  };

  // السنوات المتاحة (تشمل السنة الحالية وسنتين للأمام والخلف تلقائياً)
  const taskYears = tasks
    .map(t => getYearFromDate(t.due_date))
    .filter(Boolean) as number[];
  const availableYears = getAvailableYears(taskYears);

  // الأيام المتاحة حسب الشهر المختار
  const availableDays = filterMonth !== "all" 
    ? Array.from(new Set(
        tasks
          .filter(t => t.due_date && getMonthFromDate(t.due_date) === Number(filterMonth))
          .map(t => getDayFromDate(t.due_date))
          .filter(Boolean)
      )).sort((a, b) => (a || 0) - (b || 0))
    : [];

  // تطبيق الفلاتر
  const filteredTasks = tasks.filter((task) => {
    // فلتر البحث
    const matchesSearch =
      searchQuery === "" ||
      task.title.includes(searchQuery) ||
      (task.category && task.category.includes(searchQuery));

    // فلتر الحالة
    const matchesStatus = activeTab === "all" || task.status === activeTab;

    // فلتر السنة
    const taskYear = getYearFromDate(task.due_date);
    const matchesYear = filterYear === "all" || taskYear === Number(filterYear);

    // فلتر الشهر
    const taskMonth = getMonthFromDate(task.due_date);
    const matchesMonth = filterMonth === "all" || taskMonth === Number(filterMonth);

    // فلتر اليوم
    const taskDay = getDayFromDate(task.due_date);
    const matchesDay = filterDay === "all" || taskDay === Number(filterDay);

    // فلتر القسم
    let matchesDepartment = true;
    if (isAdmin && filterDepartment !== "all") {
      const taskEmployee = employees.find(e => e.user_id === task.user_id);
      matchesDepartment = taskEmployee?.department_id === filterDepartment;
    }

    // فلتر المنفذ - للمدير فقط
    let matchesEmployee = true;
    if (isAdmin && filterEmployee !== "all") {
      // نبحث عن الموظف المختار ونقارن user_id
      const selectedEmp = employees.find(e => e.user_id === filterEmployee || e.id === filterEmployee);
      if (selectedEmp) {
        matchesEmployee = task.user_id === selectedEmp.user_id || task.user_id === filterEmployee;
      } else {
        matchesEmployee = task.user_id === filterEmployee;
      }
    }
    
    // للموظف العادي: يرى مهامه فقط
    if (!isAdmin) {
      matchesEmployee = task.user_id === authUser?.id;
    }

    // فلتر النشاط
    let matchesActivity = true;
    if (filterActivity !== "all") {
      matchesActivity = task.executive_plan_id === filterActivity;
    }

    return matchesSearch && matchesStatus && matchesYear && matchesMonth && matchesDay && matchesDepartment && matchesEmployee && matchesActivity;
  });

  // حساب الإحصائيات - مع التخزين المؤقت
  const taskStats = useMemo(() => ({
    all: tasks.filter(t => !isAdmin ? t.user_id === authUser?.id : true).length,
    upcoming: tasks.filter((t) => t.status === "upcoming" && (!isAdmin ? t.user_id === authUser?.id : true)).length,
    in_progress: tasks.filter((t) => t.status === "in_progress" && (!isAdmin ? t.user_id === authUser?.id : true)).length,
    completed: tasks.filter((t) => t.status === "completed" && (!isAdmin ? t.user_id === authUser?.id : true)).length,
    delayed: tasks.filter((t) => t.status === "delayed" && (!isAdmin ? t.user_id === authUser?.id : true)).length,
  }), [tasks, isAdmin, authUser?.id]);

  const hasActiveFilters = filterYear !== String(new Date().getFullYear()) || filterMonth !== "all" || filterDay !== "all" || filterDepartment !== "all" || filterEmployee !== "all" || filterActivity !== "all" || searchQuery;

  // قائمة الأنشطة الفريدة للفلتر - مع التخزين المؤقت
  const uniqueActivities = useMemo(() => Array.from(new Set(
    activities.map(a => JSON.stringify({ id: a.executive_plan_id, name: a.activity_name }))
  )).map(s => JSON.parse(s) as { id: string; name: string }), [activities]);

  // تجميع المهام المفلترة - مع التخزين المؤقت
  const groupedTasks = useMemo(() => groupTasksByActivity(filteredTasks), [filteredTasks, groupTasksByActivity]);


  // تحديث المهام عند إكمال المهمة
  const handleTaskCompleted = () => {
    // إعادة جلب المهام
    const fetchTasks = async () => {
      if (!authUser) return;
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (data) setTasks(data as Task[]);
    };
    fetchTasks();
  };

  return (
    <DashboardLayout embedded={embedded}>
      <div className="space-y-6">

        {/* شريط المهمة النشطة */}
        {!isAdmin && authUser && (
          <ActiveTaskBanner
            userId={authUser.id}
            onTaskCompleted={handleTaskCompleted}
            onSelectNextTask={() => {}}
          />
        )}

        {/* Header */}
        <PageHeader
          icon={<Target className="w-6 h-6" />}
          title="المهام"
          subtitle="إدارة ومتابعة المهام"
          actions={
            <>
              <Button
                onClick={() => setIsGenerateDialogOpen(true)}
                className="gap-2 bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm"
              >
                <Sparkles className="w-5 h-5" />
                توليد بالذكاء الاصطناعي
              </Button>
              <Button
                onClick={() => navigate("/tasks/add")}
                className="gap-2 bg-white text-primary hover:bg-white/90"
              >
                <Plus className="w-4 h-4" />
                إضافة مهمة
              </Button>
            </>
          }
        />

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: "all", label: "الكل", count: taskStats.all, color: "from-slate-500 to-slate-600" },
            { key: "upcoming", label: "قادمة", count: taskStats.upcoming, color: "from-blue-500 to-blue-600" },
            { key: "in_progress", label: "قيد التنفيذ", count: taskStats.in_progress, color: "from-sky-500 to-sky-600" },
            { key: "completed", label: "مكتملة", count: taskStats.completed, color: "from-emerald-500 to-emerald-600" },
            { key: "delayed", label: "متأخرة", count: taskStats.delayed, color: "from-rose-500 to-rose-600" },
          ].map(stat => (
            <Card 
              key={stat.key}
              className={cn(
                "cursor-pointer transition-all hover:scale-105 border-2",
                activeTab === stat.key ? "ring-2 ring-primary border-primary" : "border-transparent"
              )}
              onClick={() => setActiveTab(stat.key)}
            >
              <CardContent className="p-4 text-center">
                <div className={cn(
                  "w-10 h-10 mx-auto mb-2 rounded-lg bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg",
                  stat.color
                )}>
                  {stat.count}
                </div>
                <p className="text-sm font-medium">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* الفلاتر */}
        <Card className="border border-[hsl(var(--primary)/0.2)] shadow-sm bg-gradient-to-l from-[hsl(var(--primary)/0.05)] to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[hsl(var(--primary))] text-lg">الفلاتر</span>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mr-auto border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)]"
                >
                  <X className="w-4 h-4 ml-1" />
                  إعادة تعيين
                </Button>
              )}
            </div>
            <div className={cn("grid gap-4", isAdmin ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-8" : "grid-cols-2 md:grid-cols-5")}>
              {/* فلتر السنة */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--primary))]">السنة</label>
                <Select value={filterYear} onValueChange={(v) => {
                  setFilterYear(v);
                  setFilterMonth("all");
                  setFilterDay("all");
                }}>
                  <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                    <SelectValue placeholder="السنة" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                    <SelectItem value="all">كل السنوات</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* فلتر الشهر */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--primary))]">الشهر</label>
                <Select value={filterMonth} onValueChange={(v) => {
                  setFilterMonth(v);
                  setFilterDay("all");
                }}>
                  <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                    <SelectValue placeholder="كل الشهور" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                    <SelectItem value="all">كل الشهور</SelectItem>
                    {MONTHS_AR.map((month, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* فلتر اليوم */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--primary))]">اليوم</label>
                <Select 
                  value={filterDay} 
                  onValueChange={setFilterDay}
                  disabled={filterMonth === "all"}
                >
                  <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                    <SelectValue placeholder="كل الأيام" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                    <SelectItem value="all">كل الأيام</SelectItem>
                    {availableDays.map(day => (
                      <SelectItem key={day} value={String(day)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* فلتر القسم - للمدير فقط */}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[hsl(var(--primary))]">القسم</label>
                  <Select value={filterDepartment} onValueChange={(v) => {
                    setFilterDepartment(v);
                    setFilterEmployee("all"); // إعادة تعيين الموظف عند تغيير القسم
                  }}>
                    <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                      <SelectValue placeholder="كل الأقسام" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                      <SelectItem value="all">كل الأقسام</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* فلتر المنفذ - للمدير فقط */}
              {isAdmin && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[hsl(var(--primary))]">الموظف</label>
                  <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                    <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                      <SelectValue placeholder="كل الموظفين" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                      <SelectItem value="all">كل الموظفين</SelectItem>
                      {employees
                        .filter(emp => filterDepartment === "all" || emp.department_id === filterDepartment)
                        .map(emp => (
                          <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* فلتر النشاط */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--primary))]">النشاط</label>
                <Select value={filterActivity} onValueChange={setFilterActivity}>
                  <SelectTrigger className="bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]">
                    <SelectValue placeholder="كل الأنشطة" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[hsl(var(--primary)/0.2)]">
                    <SelectItem value="all">كل الأنشطة</SelectItem>
                    {uniqueActivities.map(activity => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* البحث */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[hsl(var(--primary))]">البحث</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--primary)/0.6)]" />
                  <Input
                    placeholder="البحث في المهام..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 bg-white border-[hsl(var(--primary)/0.3)] focus:ring-[hsl(var(--primary)/0.2)]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* جدول المهام */}
        {!hasFetchedTasks && tasks.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center">
              <Target className="w-14 h-14 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">جاري تجهيز المهام</h3>
              <p className="text-muted-foreground">ستظهر البيانات فور وصولها بدون شاشة انتظار.</p>
            </CardContent>
          </Card>
        ) : filteredTasks.length === 0 ? (
          <Card className="py-20">
            <CardContent className="text-center">
              <Target className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد مهام</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? "لا توجد مهام تطابق الفلاتر المحددة"
                  : "اضغط على \"توليد بالذكاء الاصطناعي\" لإنشاء مهام من الخطط التنفيذية"
                }
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={resetFilters}>
                  إعادة تعيين الفلاتر
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-[hsl(var(--primary)/0.2)] shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]">
                    <TableHead className="text-right font-bold text-white border-l border-white/20 w-48">النشاط</TableHead>
                    <TableHead className="text-right font-bold text-white border-l border-white/20">المهمة</TableHead>
                    <TableHead className="text-center font-bold text-white w-28 border-l border-white/20">تاريخ التنفيذ</TableHead>
                    <TableHead className="text-center font-bold text-white w-24 border-l border-white/20">الأولوية</TableHead>
                    {/* المنفذ يظهر للمدير فقط */}
                    {isAdmin && (
                      <TableHead className="text-center font-bold text-white w-32 border-l border-white/20">المنفذ</TableHead>
                    )}
                    {/* الوقت المقدر والفعلي */}
                    <TableHead className="text-center font-bold text-white w-24 border-l border-white/20">الوقت المقدر</TableHead>
                    <TableHead className="text-center font-bold text-white w-24 border-l border-white/20">الوقت الفعلي</TableHead>
                    {/* المرفقات والتواصل */}
                    <TableHead className="text-center font-bold text-white w-28 border-l border-white/20">المرفقات والتواصل</TableHead>
                    <TableHead className="text-center font-bold text-white w-32 border-l border-white/20">الحالة</TableHead>
                    {/* التقييم يظهر للجميع */}
                    <TableHead className="text-center font-bold text-white w-28 border-l border-white/20">التقييم</TableHead>
                    <TableHead className="text-center font-bold text-white w-24">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedTasks.map((group, groupIndex) => {
                    const isEven = groupIndex % 2 === 0;
                    const rowBgClass = isEven ? "bg-white" : "bg-[hsl(var(--primary)/0.1)]";
                    const activityColorClass = "text-[hsl(var(--primary))]";
                    
                    return group.tasks.map((task, taskIndex) => {
                      const statusConfig = getStatusConfig(task.status);
                      const priorityConfig = getPriorityConfig(task.priority);
                      const isFirstInGroup = taskIndex === 0;
                      
                      return (
                        <TableRow key={task.id} className={cn(rowBgClass, "hover:bg-[hsl(var(--primary)/0.2)]")}>
                          {/* النشاط - يظهر فقط في أول مهمة من كل مجموعة */}
                          {isFirstInGroup ? (
                            <TableCell 
                              className={cn("border-l border-[hsl(var(--primary)/0.2)] font-semibold", activityColorClass)}
                              rowSpan={group.tasks.length}
                            >
                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                <span className="line-clamp-3">{group.activityName}</span>
                              </div>
                            </TableCell>
                          ) : null}
                          
                          {/* المهمة */}
                          <TableCell className="border-l border-[hsl(var(--primary)/0.2)]">
                            <div 
                              className="flex items-start gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => navigate(`/tasks/${task.id}`)}
                            >
                              {task.ai_generated && (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center flex-shrink-0">
                                  <Brain className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground hover:text-[hsl(var(--primary))] transition-colors">{task.title}</p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* تاريخ التنفيذ */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)] py-1">
                            {(() => {
                              const dates = formatDateWithHijri(task.due_date);
                              return (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="text-sm font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                                    {dates.gregorian}
                                  </span>
                                  <span className="text-xs text-muted-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                                    {dates.hijri}
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* الأولوية */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                            <Badge className={priorityConfig.class}>
                              {priorityConfig.label}
                            </Badge>
                          </TableCell>

                          {/* المنفذ - يظهر للمدير فقط */}
                          {isAdmin && (
                            <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                                  <User className="w-3 h-3 text-[hsl(var(--primary))]" />
                                </div>
                                <span className="text-base font-bold">{getExecutorName(task.user_id)}</span>
                              </div>
                            </TableCell>
                          )}

                          {/* الوقت المقدر */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                            <div className="flex items-center justify-center">
                              <Clock className="w-4 h-4 text-[hsl(var(--primary))] ml-1" />
                              <span className="text-base font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>
                                {task.estimated_time_minutes ? `${formatNumberPlain(task.estimated_time_minutes)} د` : '-'}
                              </span>
                            </div>
                          </TableCell>

                          {/* الوقت الفعلي / المؤقت النشط */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                            {task.status === "in_progress" && task.started_at ? (
                              <LiveTimer 
                                startedAt={task.started_at} 
                                estimatedMinutes={task.estimated_time_minutes}
                              />
                            ) : (
                              <div className="flex items-center justify-center">
                                <Clock className="w-4 h-4 text-emerald-500 ml-1" />
                                <span className="text-base font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>
                                  {task.actual_time_minutes ? `${formatNumberPlain(task.actual_time_minutes)} د` : '-'}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {/* المرفقات والتواصل */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)] font-bold text-base"
                              onClick={() => {
                                setSelectedTaskForCommunication(task);
                                setIsCommunicationDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="w-5 h-5" />
                              فتح
                            </Button>
                          </TableCell>
                          
                          {/* الحالة */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)]">
                            {isAdmin ? (
                              // المدير: يستطيع اختيار جميع الحالات
                              <Select
                                value={task.status}
                                onValueChange={(value) => updateTaskStatus(task.id, value)}
                              >
                                <SelectTrigger className={cn("w-28 h-8", statusConfig.class)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white z-50">
                                  <SelectItem value="upcoming">قادمة</SelectItem>
                                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                                  <SelectItem value="executed">تم التنفيذ</SelectItem>
                                  <SelectItem value="returned">معادة</SelectItem>
                                  <SelectItem value="delayed">متأخرة</SelectItem>
                                  <SelectItem value="completed">مكتملة</SelectItem>
                                  <SelectItem value="stalled">متعثرة</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              // الموظف: يرى قادمة أو يختار تم التنفيذ فقط إذا حان الوقت
                              <Select
                                value={task.status}
                                onValueChange={(value) => updateTaskStatusLocal(task.id, value)}
                                disabled={!isTaskDue(task) && task.status === "upcoming"}
                              >
                                <SelectTrigger className={cn("w-28 h-8", statusConfig.class)}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white z-50">
                                  <SelectItem value="upcoming">قادمة</SelectItem>
                                  {isTaskDue(task) && (
                                    <SelectItem value="executed">تم التنفيذ</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          
                          {/* التقييم - يظهر للجميع لكن التعديل للمدير فقط */}
                          <TableCell className="text-center border-l border-[hsl(var(--primary)/0.2)] py-1">
                            <div className="flex items-center justify-center gap-2">
                              {/* عمود الإنجاز */}
                              <div className="flex flex-col items-center">
                                <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">الإنجاز</div>
                                {isAdmin ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    defaultValue={new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(
                                      Number(task.completion_percentage || 0)
                                    )}
                                    onBlur={(e) => {
                                      const raw = normalizeNumericInput(e.currentTarget.value);
                                      const value = parseInt(raw, 10) || 0;
                                      if (value !== (task.completion_percentage || 0)) {
                                        updateTaskRating(task.id, 'completion_percentage', value);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                    className="w-10 h-6 text-center text-xs font-semibold border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                    style={{ fontFamily: 'Arial, sans-serif' }}
                                    lang="en"
                                  />
                                ) : (
                                  <div
                                    className="w-10 h-6 flex items-center justify-center bg-muted/50 rounded text-xs font-semibold"
                                    lang="en"
                                    style={{ fontFamily: 'Arial, sans-serif' }}
                                  >
                                    {new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(
                                      Number(task.completion_percentage || 0)
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* عمود كفاءة الوقت */}
                              <div className="flex flex-col items-center">
                                <div className="text-[10px] font-semibold text-muted-foreground mb-0.5">الكفاءة</div>
                                {(() => {
                                  const estimated = task.estimated_time_minutes;
                                  const actual = task.actual_time_minutes;
                                  if (!estimated || !actual || actual === 0) {
                                    return (
                                      <div
                                        className="w-10 h-6 flex items-center justify-center bg-muted/50 rounded text-xs font-semibold text-muted-foreground"
                                        lang="en"
                                        style={{ fontFamily: 'Arial, sans-serif' }}
                                      >
                                        -
                                      </div>
                                    );
                                  }
                                  const efficiency = Math.round((estimated / actual) * 100);
                                  const colorClass = efficiency >= 100 
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-300" 
                                    : efficiency >= 80 
                                      ? "bg-amber-100 text-amber-700 border-amber-300"
                                      : "bg-rose-100 text-rose-700 border-rose-300";
                                  return (
                                    <div
                                      className={cn("w-10 h-6 flex items-center justify-center rounded text-xs font-semibold border", colorClass)}
                                      lang="en"
                                      style={{ fontFamily: 'Arial, sans-serif' }}
                                    >
                                      {formatPercent(efficiency)}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </TableCell>

                          {/* إجراء */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* زر التعديل للمدير فقط */}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.1)]"
                                  onClick={() => navigate(`/tasks/${task.id}?edit=true`)}
                                  title="تعديل"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {/* زر الحذف للمدير فقط */}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteTask(task.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>

                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* نافذة توليد المهام بالذكاء الاصطناعي */}
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                توليد مهام الشهر تلقائياً
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              <div className="p-4 bg-accent/10 rounded-xl border border-accent/30">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="w-6 h-6 text-accent" />
                  <h4 className="font-semibold text-foreground">التوليد التلقائي</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  سيقوم الذكاء الاصطناعي بتوليد مهام تفصيلية لجميع الأنشطة في الخطط التنفيذية للشهر المحدد.
                </p>
              </div>
              
              {/* اختيار الشهر */}
              <div className="space-y-2">
                <label className="font-semibold text-foreground">اختر الشهر</label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الشهر" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {MONTHS_AR.map((monthName, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-accent" />
                          <span>{monthName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* عرض التقدم */}
              {isGenerating && generationProgress && (
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                    <span className="text-sm text-sky-700">{generationProgress}</span>
                  </div>
                </div>
              )}
              
              {/* زر التوليد */}
              <Button
                onClick={handleGenerateMonthTasks}
                disabled={isGenerating}
                className="w-full gap-2 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 h-12 text-lg text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري توليد المهام...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    توليد مهام {MONTHS_AR[selectedMonth - 1]} كاملاً
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة تعديل المهمة */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                تعديل المهمة
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 mt-4">
              {/* العنوان */}
              <div className="space-y-2">
                <Label className="font-semibold">عنوان المهمة</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="أدخل عنوان المهمة"
                />
              </div>

              {/* التفاصيل */}
              <div className="space-y-2">
                <Label className="font-semibold">التفاصيل</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="أدخل تفاصيل المهمة والملاحظات الإضافية"
                  rows={6}
                  className="resize-y min-h-[120px]"
                />
              </div>

              {/* تاريخ التنفيذ والأولوية */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">تاريخ التنفيذ</Label>
                  <Input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">الأولوية</Label>
                  <Select 
                    value={editForm.priority} 
                    onValueChange={(v: "low" | "medium" | "high") => setEditForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="low">عادية</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عاجلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* المنفذ والحالة */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">المنفذ</Label>
                  <Select 
                    value={editForm.user_id} 
                    onValueChange={(v) => setEditForm(prev => ({ ...prev, user_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المنفذ" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">الحالة</Label>
                  <Select 
                    value={editForm.status} 
                    onValueChange={(v: Task["status"]) => setEditForm(prev => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="upcoming">قادمة</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="executed">تم التنفيذ</SelectItem>
                      <SelectItem value="returned">معادة</SelectItem>
                      <SelectItem value="delayed">متأخرة</SelectItem>
                      <SelectItem value="completed">مكتملة</SelectItem>
                      <SelectItem value="stalled">متعثرة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* الوقت المقدر والفعلي */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">الوقت المقدر (بالدقائق)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editForm.estimated_time_minutes !== null 
                      ? new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(editForm.estimated_time_minutes)
                      : ''
                    }
                    placeholder="مثال: 60"
                    lang="en"
                    style={{ fontFamily: 'Arial, sans-serif' }}
                    onChange={(e) => {
                      const raw = normalizeNumericInput(e.target.value);
                      const num = parseInt(raw, 10);
                      setEditForm((prev) => ({
                        ...prev,
                        estimated_time_minutes: raw === '' ? null : (Number.isFinite(num) ? Math.max(0, num) : null),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2">
                    الوقت الفعلي (بالدقائق)
                    {!canEditTime && (
                      <Badge variant="outline" className="text-xs">للعرض فقط</Badge>
                    )}
                  </Label>
                  {canEditTime ? (
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editForm.actual_time_minutes !== null 
                        ? new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(editForm.actual_time_minutes)
                        : ''
                      }
                      placeholder="مثال: 45"
                      lang="en"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                      onChange={(e) => {
                        const raw = normalizeNumericInput(e.target.value);
                        const num = parseInt(raw, 10);
                        setEditForm((prev) => ({
                          ...prev,
                          actual_time_minutes: raw === '' ? null : (Number.isFinite(num) ? Math.max(0, num) : null),
                        }));
                      }}
                    />
                  ) : (
                    <div 
                      className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center text-muted-foreground"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                    >
                      {editForm.actual_time_minutes !== null 
                        ? `${new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(editForm.actual_time_minutes)} دقيقة`
                        : 'يُحسب تلقائياً'
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* التقييم */}
              <div className="p-4 bg-muted/30 rounded-xl border space-y-4">
                <Label className="font-semibold text-base">التقييم</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">نسبة الإنجاز (%)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(
                        Number(editForm.completion_percentage || 0)
                      )}
                      lang="en"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                      onChange={(e) => {
                        const raw = normalizeNumericInput(e.target.value);
                        const num = parseInt(raw, 10);
                        setEditForm((prev) => ({
                          ...prev,
                          completion_percentage: Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">نسبة الجودة (%)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={new Intl.NumberFormat('en-u-nu-latn', { useGrouping: false }).format(
                        Number(editForm.quality_percentage || 0)
                      )}
                      lang="en"
                      style={{ fontFamily: 'Arial, sans-serif' }}
                      onChange={(e) => {
                        const raw = normalizeNumericInput(e.target.value);
                        const num = parseInt(raw, 10);
                        setEditForm((prev) => ({
                          ...prev,
                          quality_percentage: Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0,
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* كفاءة استثمار الوقت */}
                <div className="pt-3 border-t border-border/50">
                  <Label className="text-sm text-muted-foreground">كفاءة استثمار الوقت</Label>
                  {editForm.estimated_time_minutes && editForm.actual_time_minutes && editForm.actual_time_minutes > 0 ? (
                    <div className="flex items-center gap-2 mt-2">
                      <Clock className="w-4 h-4 text-accent" />
                      <span 
                        className={cn(
                          "text-xl font-bold",
                          Math.round((editForm.estimated_time_minutes / editForm.actual_time_minutes) * 100) >= 100 
                            ? "text-emerald-600" 
                            : "text-amber-600"
                        )}
                        style={{ fontFamily: 'Arial, sans-serif' }}
                      >
                        {formatPercent(Math.round((editForm.estimated_time_minutes / editForm.actual_time_minutes) * 100))}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {Math.round((editForm.estimated_time_minutes / editForm.actual_time_minutes) * 100) >= 100 
                          ? '✓ ممتاز' 
                          : '⚠ يحتاج تحسين'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                      يتم حسابها تلقائياً عند إدخال الوقت المقدر والفعلي
                    </p>
                  )}
                </div>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button 
                  onClick={saveTaskEdit}
                  className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]"
                >
                  حفظ التعديلات
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة إضافة مهمة جديدة */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Plus className="w-5 h-5 text-accent" />
                إضافة مهمة جديدة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* عنوان المهمة */}
              <div className="space-y-2">
                <Label>عنوان المهمة *</Label>
                <Input
                  value={addForm.title}
                  onChange={(e) => setAddForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="أدخل عنوان المهمة"
                />
              </div>

              {/* التفاصيل */}
              <div className="space-y-2">
                <Label>التفاصيل</Label>
                <Textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="أدخل تفاصيل المهمة والملاحظات الإضافية (اختياري)"
                  rows={5}
                  className="resize-y min-h-[100px]"
                />
              </div>

              {/* المنفذ */}
              <div className="space-y-2">
                <Label>المنفذ *</Label>
                <Select 
                  value={addForm.user_id} 
                  onValueChange={(v) => setAddForm(prev => ({ ...prev, user_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* تاريخ التنفيذ والأولوية */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>تاريخ التنفيذ</Label>
                  <Input
                    type="date"
                    value={addForm.due_date}
                    onChange={(e) => setAddForm(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select 
                    value={addForm.priority} 
                    onValueChange={(v: "low" | "medium" | "high") => setAddForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="low">عادية</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">عاجلة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* الوقت المقدر */}
              <div className="space-y-2">
                <Label>الوقت المقدر (بالدقائق)</Label>
                <Input
                  type="number"
                  value={addForm.estimated_time_minutes}
                  onChange={(e) => setAddForm(prev => ({ ...prev, estimated_time_minutes: parseInt(e.target.value) || 30 }))}
                  min={1}
                />
              </div>

              {/* أزرار */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button 
                  onClick={addNewTask}
                  disabled={isAdding}
                  className="bg-accent hover:bg-accent/90"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                      جاري الإضافة...
                    </>
                  ) : (
                    "إضافة المهمة"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة التواصل والمرفقات */}
        {selectedTaskForCommunication && authUser && (
          <TaskCommunicationDialog
            open={isCommunicationDialogOpen}
            onOpenChange={setIsCommunicationDialogOpen}
            taskId={selectedTaskForCommunication.id}
            taskTitle={selectedTaskForCommunication.title}
            currentUserId={authUser.id}
            isAdmin={isAdmin}
            taskOwnerId={selectedTaskForCommunication.user_id}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Tasks;