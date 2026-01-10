import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
}

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
}

interface ActivityInfo {
  executive_plan_id: string;
  activity_name: string;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const Tasks = () => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // الفلاتر
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  
  // حالة نافذة التوليد
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");

  // التحقق من صلاحية المدير
  useEffect(() => {
    const checkAdmin = async () => {
      if (!authUser) return;
      const { data } = await supabase.rpc("has_role", { _user_id: authUser.id, _role: "admin" });
      setIsAdmin(data === true);
    };
    checkAdmin();
  }, [authUser]);

  // جلب المهام
  useEffect(() => {
    const fetchTasks = async () => {
      if (!authUser) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("due_date", { ascending: true });
        
        if (error) throw error;
        setTasks((data as Task[]) || []);
      } catch (error: any) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, [authUser]);

  // جلب الموظفين
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!authUser) return;
      
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("id, full_name, user_id")
          .order("full_name");
        
        if (error) throw error;
        setEmployees((data as Employee[]) || []);
      } catch (error: any) {
        console.error("Error fetching employees:", error);
      }
    };
    
    fetchEmployees();
  }, [authUser]);

  // جلب الأنشطة من الخطط التنفيذية
  useEffect(() => {
    const fetchActivities = async () => {
      if (!authUser) return;
      
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
          `);
        
        if (error) throw error;
        
        const activitiesMap: ActivityInfo[] = (data || []).map((ep: any) => ({
          executive_plan_id: ep.id,
          activity_name: ep.operational_plan_month?.operational_plan?.activity_name || "غير محدد"
        }));
        
        setActivities(activitiesMap);
      } catch (error: any) {
        console.error("Error fetching activities:", error);
      }
    };
    
    fetchActivities();
  }, [authUser]);

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

  // تحديث حالة المهمة
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);
      
      if (error) throw error;
      
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t))
      );
      toast({ title: "تم تحديث الحالة" });
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

  // تحديث التقييم (نسبة الإنجاز أو الجودة)
  const updateTaskRating = async (taskId: string, field: 'completion_percentage' | 'quality_percentage', value: number) => {
    // التحقق من أن القيمة بين 0 و 100
    const clampedValue = Math.max(0, Math.min(100, value));
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ [field]: clampedValue })
        .eq("id", taskId);
      
      if (error) throw error;
      
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, [field]: clampedValue } : t))
      );
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // إعادة تعيين الفلاتر
  const resetFilters = () => {
    setFilterMonth("all");
    setFilterDay("all");
    setFilterEmployee("all");
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
        return { label: "عاجل", class: "bg-rose-500 text-white" };
      case "medium":
        return { label: "متوسط", class: "bg-amber-500 text-white" };
      default:
        return { label: "عادي", class: "bg-slate-400 text-white" };
    }
  };

  // الحصول على اسم المنفذ
  const getExecutorName = (userId: string) => {
    const employee = employees.find(e => e.user_id === userId);
    return employee?.full_name || "غير محدد";
  };

  // الحصول على اسم النشاط من executive_plan_id
  const getActivityName = (executivePlanId: string | null) => {
    if (!executivePlanId) return "غير محدد";
    const activity = activities.find(a => a.executive_plan_id === executivePlanId);
    return activity?.activity_name || "غير محدد";
  };

  // تجميع المهام حسب النشاط
  const groupTasksByActivity = (tasksToGroup: Task[]) => {
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
  };

  // استخراج الشهر واليوم من تاريخ التنفيذ
  const getMonthFromDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return new Date(dateStr).getMonth() + 1;
  };

  const getDayFromDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return new Date(dateStr).getDate();
  };

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

    // فلتر الشهر
    const taskMonth = getMonthFromDate(task.due_date);
    const matchesMonth = filterMonth === "all" || taskMonth === Number(filterMonth);

    // فلتر اليوم
    const taskDay = getDayFromDate(task.due_date);
    const matchesDay = filterDay === "all" || taskDay === Number(filterDay);

    // فلتر المنفذ - التحقق من user_id المهمة مقابل user_id أو id الموظف
    let matchesEmployee = true;
    if (filterEmployee !== "all") {
      // نبحث عن الموظف المختار ونقارن user_id
      const selectedEmp = employees.find(e => e.user_id === filterEmployee || e.id === filterEmployee);
      if (selectedEmp) {
        matchesEmployee = task.user_id === selectedEmp.user_id || task.user_id === filterEmployee;
      } else {
        matchesEmployee = task.user_id === filterEmployee;
      }
    }

    return matchesSearch && matchesStatus && matchesMonth && matchesDay && matchesEmployee;
  });

  const taskStats = {
    all: tasks.length,
    upcoming: tasks.filter((t) => t.status === "upcoming").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    delayed: tasks.filter((t) => t.status === "delayed").length,
  };

  const hasActiveFilters = filterMonth !== "all" || filterDay !== "all" || filterEmployee !== "all" || searchQuery;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              المهام
            </h1>
            <p className="text-muted-foreground mt-2">إدارة ومتابعة المهام</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsGenerateDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-white"
            >
              <Sparkles className="w-5 h-5" />
              توليد بالذكاء الاصطناعي
            </Button>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" />
              إضافة مهمة
            </Button>
          </div>
        </div>

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
        <Card className="border border-[#3d9aa8]/20 shadow-sm bg-gradient-to-l from-[#3d9aa8]/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#3d9aa8] flex items-center justify-center">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[#3d9aa8] text-lg">الفلاتر</span>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mr-auto border-[#3d9aa8]/30 text-[#3d9aa8] hover:bg-[#3d9aa8]/10"
                >
                  <X className="w-4 h-4 ml-1" />
                  إعادة تعيين
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* فلتر الشهر */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#3d9aa8]">الشهر</label>
                <Select value={filterMonth} onValueChange={(v) => {
                  setFilterMonth(v);
                  setFilterDay("all"); // إعادة تعيين اليوم عند تغيير الشهر
                }}>
                  <SelectTrigger className="bg-white border-[#3d9aa8]/30 focus:ring-[#3d9aa8]/20">
                    <SelectValue placeholder="كل الشهور" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[#3d9aa8]/20">
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
                <label className="text-sm font-semibold text-[#3d9aa8]">اليوم</label>
                <Select 
                  value={filterDay} 
                  onValueChange={setFilterDay}
                  disabled={filterMonth === "all"}
                >
                  <SelectTrigger className="bg-white border-[#3d9aa8]/30 focus:ring-[#3d9aa8]/20">
                    <SelectValue placeholder="كل الأيام" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[#3d9aa8]/20">
                    <SelectItem value="all">كل الأيام</SelectItem>
                    {availableDays.map(day => (
                      <SelectItem key={day} value={String(day)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* فلتر المنفذ */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#3d9aa8]">المنفذ</label>
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger className="bg-white border-[#3d9aa8]/30 focus:ring-[#3d9aa8]/20">
                    <SelectValue placeholder="كل الموظفين" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50 border-[#3d9aa8]/20">
                    <SelectItem value="all">كل الموظفين</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* البحث */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#3d9aa8]">البحث</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d9aa8]/60" />
                  <Input
                    placeholder="البحث في المهام..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 bg-white border-[#3d9aa8]/30 focus:ring-[#3d9aa8]/20"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* جدول المهام */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
          </div>
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
          <Card className="overflow-hidden border border-[#3d9aa8]/20 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#3d9aa8]">
                    <TableHead className="text-right font-bold text-white border-l border-white/20 w-48">النشاط</TableHead>
                    <TableHead className="text-right font-bold text-white border-l border-white/20">المهمة</TableHead>
                    <TableHead className="text-center font-bold text-white w-28 border-l border-white/20">تاريخ التنفيذ</TableHead>
                    <TableHead className="text-center font-bold text-white w-24 border-l border-white/20">الأولوية</TableHead>
                    <TableHead className="text-center font-bold text-white w-32 border-l border-white/20">المنفذ</TableHead>
                    <TableHead className="text-center font-bold text-white w-32 border-l border-white/20">الحالة</TableHead>
                    <TableHead className="text-center font-bold text-white w-40 border-l border-white/20">التقييم</TableHead>
                    <TableHead className="text-center font-bold text-white w-20">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupTasksByActivity(filteredTasks).map((group, groupIndex) => {
                    const isEven = groupIndex % 2 === 0;
                    const rowBgClass = isEven ? "bg-white" : "bg-[#3d9aa8]/10";
                    const activityColorClass = "text-[#3d9aa8]";
                    
                    return group.tasks.map((task, taskIndex) => {
                      const statusConfig = getStatusConfig(task.status);
                      const priorityConfig = getPriorityConfig(task.priority);
                      const isFirstInGroup = taskIndex === 0;
                      
                      return (
                        <TableRow key={task.id} className={cn(rowBgClass, "hover:bg-[#3d9aa8]/20")}>
                          {/* النشاط - يظهر فقط في أول مهمة من كل مجموعة */}
                          {isFirstInGroup ? (
                            <TableCell 
                              className={cn("border-l border-[#3d9aa8]/20 font-semibold", activityColorClass)}
                              rowSpan={group.tasks.length}
                            >
                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                <span className="line-clamp-3">{group.activityName}</span>
                              </div>
                            </TableCell>
                          ) : null}
                          
                          {/* المهمة */}
                          <TableCell className="border-l border-[#3d9aa8]/20">
                            <div className="flex items-start gap-3">
                              {task.ai_generated && (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center flex-shrink-0">
                                  <Brain className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{task.title}</p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* تاريخ التنفيذ */}
                          <TableCell className="text-center border-l border-[#3d9aa8]/20">
                            <div className="flex items-center justify-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-[#3d9aa8]/60" />
                              <span className="text-foreground">
                                {task.due_date 
                                  ? new Date(task.due_date).toLocaleDateString("ar-SA")
                                  : "-"
                                }
                              </span>
                            </div>
                          </TableCell>

                          {/* الأولوية */}
                          <TableCell className="text-center border-l border-[#3d9aa8]/20">
                            <Badge className={priorityConfig.class}>
                              {priorityConfig.label}
                            </Badge>
                          </TableCell>

                          {/* المنفذ */}
                          <TableCell className="text-center border-l border-[#3d9aa8]/20">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#3d9aa8]/10 flex items-center justify-center">
                                <User className="w-3 h-3 text-[#3d9aa8]" />
                              </div>
                              <span className="text-sm">{getExecutorName(task.user_id)}</span>
                            </div>
                          </TableCell>
                          
                          {/* الحالة */}
                          <TableCell className="text-center border-l border-[#3d9aa8]/20">
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
                          </TableCell>
                          
                          {/* التقييم - نسبة الإنجاز ونسبة الجودة */}
                          <TableCell className="text-center border-l border-[#3d9aa8]/20">
                            <div className="flex items-center justify-center gap-3">
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">الإنجاز</div>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={task.completion_percentage || 0}
                                  onChange={(e) => updateTaskRating(task.id, 'completion_percentage', Number(e.target.value))}
                                  className="w-14 h-7 text-center text-xs p-1"
                                />
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">الجودة</div>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={task.quality_percentage || 0}
                                  onChange={(e) => updateTaskRating(task.id, 'quality_percentage', Number(e.target.value))}
                                  className="w-14 h-7 text-center text-xs p-1"
                                />
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* إجراء */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteTask(task.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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
      </div>
    </DashboardLayout>
  );
};

export default Tasks;