import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  status: "pending" | "in_progress" | "completed" | "overdue";
  category: string | null;
  due_date: string | null;
  ai_generated: boolean;
  created_at: string;
}

interface ExecutivePlanActivity {
  id: string;
  activityName: string;
  month: number;
  day: number;
}

// الأشهر المتاحة
const AVAILABLE_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const Tasks = () => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // حالة نافذة التوليد
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [activities, setActivities] = useState<ExecutivePlanActivity[]>([]);
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
          .order("created_at", { ascending: false });
        
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

  // جلب الأنشطة من الخطط التنفيذية
  useEffect(() => {
    const fetchActivities = async () => {
      if (!authUser) return;
      
      try {
        // جلب الخطط التنفيذية مع أسماء الأنشطة
        const { data: execPlans, error: execError } = await supabase
          .from("executive_plans")
          .select(`
            id,
            day,
            operational_plan_months!inner (
              month,
              operational_plans!inner (
                activity_name,
                user_id
              )
            )
          `);
        
        if (execError) throw execError;
        
        const activitiesList: ExecutivePlanActivity[] = (execPlans || []).map((ep: any) => ({
          id: ep.id,
          activityName: ep.operational_plan_months.operational_plans.activity_name,
          month: ep.operational_plan_months.month,
          day: ep.day,
        }));
        
        // إزالة التكرار حسب اسم النشاط
        const uniqueActivities = activitiesList.filter(
          (activity, index, self) =>
            index === self.findIndex(a => a.activityName === activity.activityName)
        );
        
        setActivities(uniqueActivities);
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
            userId: authUser.id,
            generateAll: true,
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return { label: "مكتمل", class: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle };
      case "in_progress":
        return { label: "قيد التنفيذ", class: "bg-blue-100 text-blue-700 border-blue-300", icon: PlayCircle };
      case "overdue":
        return { label: "متأخر", class: "bg-red-100 text-red-700 border-red-300", icon: AlertTriangle };
      default:
        return { label: "معلق", class: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: Clock };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return { label: "عاجل", class: "bg-red-500 text-white" };
      case "medium":
        return { label: "متوسط", class: "bg-yellow-500 text-white" };
      default:
        return { label: "عادي", class: "bg-gray-400 text-white" };
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.includes(searchQuery) ||
      (task.category && task.category.includes(searchQuery));

    if (activeTab === "all") return matchesSearch;
    return matchesSearch && task.status === activeTab;
  });

  const taskStats = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              المهام
            </h1>
            <p className="text-muted-foreground mt-2">إدارة ومتابعة المهام</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsGenerateDialogOpen(true)}
              className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Sparkles className="w-5 h-5" />
              توليد بالذكاء الاصطناعي
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة مهمة
            </Button>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: "all", label: "الكل", count: taskStats.all, color: "from-gray-400 to-gray-500" },
            { key: "pending", label: "معلق", count: taskStats.pending, color: "from-yellow-400 to-yellow-500" },
            { key: "in_progress", label: "قيد التنفيذ", count: taskStats.in_progress, color: "from-blue-400 to-blue-500" },
            { key: "completed", label: "مكتمل", count: taskStats.completed, color: "from-green-400 to-green-500" },
            { key: "overdue", label: "متأخر", count: taskStats.overdue, color: "from-red-400 to-red-500" },
          ].map(stat => (
            <Card 
              key={stat.key}
              className={cn(
                "cursor-pointer transition-all hover:scale-105",
                activeTab === stat.key && "ring-2 ring-primary"
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

        {/* البحث */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="البحث في المهام..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>

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
                اضغط على "توليد بالذكاء الاصطناعي" لإنشاء مهام من الخطط التنفيذية
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-right font-bold w-96 border-l-2">المهمة</TableHead>
                    <TableHead className="text-center font-bold w-24 border-l-2">الأولوية</TableHead>
                    <TableHead className="text-center font-bold w-24 border-l-2">التصنيف</TableHead>
                    <TableHead className="text-center font-bold w-32 border-l-2">الحالة</TableHead>
                    <TableHead className="text-center font-bold w-28 border-l-2">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-center font-bold w-20">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const statusConfig = getStatusConfig(task.status);
                    const priorityConfig = getPriorityConfig(task.priority);
                    
                    return (
                      <TableRow key={task.id} className="hover:bg-gray-50">
                        {/* المهمة */}
                        <TableCell className="border-l-2">
                          <div className="flex items-start gap-3">
                            {task.ai_generated && (
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <Brain className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-800">{task.title}</p>
                              {task.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        {/* الأولوية */}
                        <TableCell className="text-center border-l-2">
                          <Badge className={priorityConfig.class}>
                            {priorityConfig.label}
                          </Badge>
                        </TableCell>
                        
                        {/* التصنيف */}
                        <TableCell className="text-center border-l-2">
                          <Badge variant="outline">{task.category || "-"}</Badge>
                        </TableCell>
                        
                        {/* الحالة */}
                        <TableCell className="text-center border-l-2">
                          <Select
                            value={task.status}
                            onValueChange={(value) => updateTaskStatus(task.id, value)}
                          >
                            <SelectTrigger className={cn("w-28 h-8", statusConfig.class)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white z-50">
                              <SelectItem value="pending">معلق</SelectItem>
                              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                              <SelectItem value="completed">مكتمل</SelectItem>
                              <SelectItem value="overdue">متأخر</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        
                        {/* تاريخ الإنشاء */}
                        <TableCell className="text-center border-l-2 text-sm text-muted-foreground">
                          {new Date(task.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        
                        {/* إجراء */}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteTask(task.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
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
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                توليد مهام الشهر تلقائياً
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <Brain className="w-6 h-6 text-purple-500" />
                  <h4 className="font-semibold text-purple-800">التوليد التلقائي</h4>
                </div>
                <p className="text-sm text-purple-700">
                  سيقوم الذكاء الاصطناعي بتوليد مهام تفصيلية لجميع الأنشطة في الخطط التنفيذية للشهر المحدد.
                </p>
              </div>
              
              {/* اختيار الشهر */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">اختر الشهر</label>
                <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الشهر" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {MONTHS_AR.map((monthName, index) => (
                      <SelectItem key={index + 1} value={String(index + 1)}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-500" />
                          <span>{monthName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* عرض التقدم */}
              {isGenerating && generationProgress && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span className="text-sm text-blue-700">{generationProgress}</span>
                  </div>
                </div>
              )}
              
              {/* زر التوليد */}
              <Button
                onClick={handleGenerateMonthTasks}
                disabled={isGenerating}
                className="w-full gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 h-12 text-lg"
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
