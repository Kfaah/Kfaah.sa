import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Clock,
  Calendar,
  User,
  Target,
  MessageSquare,
  Edit,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Play,
  Pause,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithHijri, formatNumberPlain, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { TaskCommunicationDialog } from "@/components/tasks/TaskCommunicationDialog";
import { LiveTimer } from "@/components/tasks/LiveTimer";

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
  job_role: string;
  avatar_url: string | null;
}

interface ActivityInfo {
  executive_plan_id: string;
  activity_name: string;
}

const TaskDetails = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activity, setActivity] = useState<ActivityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEditTime, setCanEditTime] = useState(false);

  // وضع التعديل داخل صفحة التفاصيل (بدون نافذة منبثقة)
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium" as Task["priority"],
    estimated_time_minutes: "",
  });
  
  // حالة نافذة التواصل
  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = useState(false);

  // فتح نافذة التواصل تلقائياً إذا كان openChat=true
  useEffect(() => {
    const openChat = searchParams.get("openChat");
    if (openChat === "true" && task) {
      setIsCommunicationDialogOpen(true);
    }
  }, [searchParams, task]);

  // التحقق من صلاحيات المستخدم
  useEffect(() => {
    const checkPermissions = async () => {
      if (!authUser) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .single();

      if (roleData?.role === "admin") {
        setIsAdmin(true);
        setCanEditTime(true);
      }

      // التحقق من صلاحية time_editor
      const { data: timeEditorData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .eq("role", "time_editor")
        .maybeSingle();

      if (timeEditorData) {
        setCanEditTime(true);
      }
    };

    checkPermissions();
  }, [authUser]);

  // جلب بيانات المهمة
  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) return;

      setLoading(true);
      try {
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .single();

        if (taskError) throw taskError;

        setTask(taskData as Task);

        // جلب بيانات الموظف
        const { data: employeeData } = await supabase
          .from("employees")
          .select("id, full_name, user_id, job_role, avatar_url")
          .eq("user_id", taskData.user_id)
          .single();

        setEmployee(employeeData);

        // جلب النشاط المرتبط
        if (taskData.executive_plan_id) {
          const { data: executiveData } = await supabase
            .from("executive_plans")
            .select("operational_plan_month_id")
            .eq("id", taskData.executive_plan_id)
            .single();

          if (executiveData?.operational_plan_month_id) {
            const { data: monthData } = await supabase
              .from("operational_plan_months")
              .select("operational_plan_id")
              .eq("id", executiveData.operational_plan_month_id)
              .single();

            if (monthData?.operational_plan_id) {
              const { data: opData } = await supabase
                .from("operational_plans")
                .select("id, activity_name")
                .eq("id", monthData.operational_plan_id)
                .single();

              if (opData) {
                setActivity({
                  executive_plan_id: taskData.executive_plan_id,
                  activity_name: opData.activity_name,
                });
              }
            }
          }
        }
      } catch (error: any) {
        toast({
          title: "خطأ",
          description: "تعذر تحميل بيانات المهمة",
          variant: "destructive",
        });
        navigate("/tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [taskId]);

  // تحديث حالة المهمة
  const updateTaskStatus = async (newStatus: string) => {
    if (!task) return;

    try {
      const updates: any = { status: newStatus };

      // إذا بدأ التنفيذ
      if (newStatus === "in_progress" && !task.started_at) {
        updates.started_at = new Date().toISOString();
      }

      // إذا انتهى التنفيذ
      if (["executed", "completed"].includes(newStatus) && task.started_at) {
        const startTime = new Date(task.started_at);
        const endTime = new Date();
        const actualMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        updates.actual_time_minutes = actualMinutes;
      }

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw error;

      setTask({ ...task, ...updates });
      toast({ title: "تم تحديث الحالة بنجاح" });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEdit = () => {
    if (!task || !isAdmin) return;
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date || "",
      priority: task.priority || "medium",
      estimated_time_minutes:
        task.estimated_time_minutes === null || task.estimated_time_minutes === undefined
          ? ""
          : String(task.estimated_time_minutes),
    });
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
  };

  const saveEdits = async () => {
    if (!task || !isAdmin) return;

    if (!editForm.title.trim()) {
      toast({
        title: "تنبيه",
        description: "عنوان المهمة مطلوب",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const estimated = editForm.estimated_time_minutes.trim();
      const estimatedNumber = estimated === "" ? null : Number(estimated);

      const updates: Partial<Task> & {
        description: string | null;
        due_date: string | null;
        estimated_time_minutes: number | null;
      } = {
        title: editForm.title.trim(),
        description: editForm.description.trim() ? editForm.description : null,
        due_date: editForm.due_date || null,
        priority: editForm.priority,
        estimated_time_minutes:
          estimatedNumber !== null && Number.isFinite(estimatedNumber) ? estimatedNumber : null,
      };

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", task.id);

      if (error) throw error;

      setTask({ ...task, ...updates });
      setIsEditMode(false);
      toast({ title: "تم حفظ التعديلات" });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // فتح وضع التعديل تلقائياً عند دخول الرابط ?edit=true
  useEffect(() => {
    const edit = searchParams.get("edit");
    if (edit === "true" && task && isAdmin && !isEditMode) {
      startEdit();
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, task, isAdmin, isEditMode]);

  // إعدادات الحالات
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
      upcoming: { label: "قادمة", class: "bg-slate-100 text-slate-700 border-slate-300", icon: <Clock className="w-4 h-4" /> },
      in_progress: { label: "قيد التنفيذ", class: "bg-blue-100 text-blue-700 border-blue-300", icon: <Play className="w-4 h-4" /> },
      executed: { label: "تم التنفيذ", class: "bg-amber-100 text-amber-700 border-amber-300", icon: <CheckCircle className="w-4 h-4" /> },
      returned: { label: "معادة", class: "bg-orange-100 text-orange-700 border-orange-300", icon: <AlertTriangle className="w-4 h-4" /> },
      delayed: { label: "متأخرة", class: "bg-rose-100 text-rose-700 border-rose-300", icon: <AlertTriangle className="w-4 h-4" /> },
      completed: { label: "مكتملة", class: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle className="w-4 h-4" /> },
      stalled: { label: "متعثرة", class: "bg-red-100 text-red-700 border-red-300", icon: <Pause className="w-4 h-4" /> },
    };
    return configs[status] || configs.upcoming;
  };

  // إعدادات الأولوية
  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { label: string; class: string }> = {
      high: { label: "عالية", class: "bg-rose-100 text-rose-700 border-rose-300" },
      medium: { label: "متوسطة", class: "bg-amber-100 text-amber-700 border-amber-300" },
      low: { label: "منخفضة", class: "bg-slate-100 text-slate-700 border-slate-300" },
    };
    return configs[priority] || configs.medium;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary)/<alpha-value>)]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <p className="text-lg font-medium text-muted-foreground">المهمة غير موجودة</p>
          <Button onClick={() => navigate("/tasks")}>
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للمهام
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const isTaskOwner = authUser?.id === task.user_id;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/tasks")}
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-2xl font-bold text-foreground">تفاصيل المهمة</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-[hsl(var(--primary)/<alpha-value>)] text-[hsl(var(--primary)/<alpha-value>)] hover:bg-[hsl(var(--primary)/<alpha-value>)]/10"
              onClick={() => setIsCommunicationDialogOpen(true)}
            >
              <MessageSquare className="w-4 h-4" />
              التواصل والمرفقات
            </Button>

            {isAdmin && !isEditMode && (
              <Button
                variant="default"
                className="gap-2 bg-[hsl(var(--primary)/<alpha-value>)] hover:bg-[hsl(var(--primary)/<alpha-value>)]/90"
                onClick={startEdit}
              >
                <Edit className="w-4 h-4" />
                تعديل
              </Button>
            )}

            {isAdmin && isEditMode && (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  إلغاء
                </Button>
                <Button onClick={saveEdits} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  حفظ
                </Button>
              </>
            )}
          </div>
        </div>

        {/* البطاقة الرئيسية */}
        <Card className="border-[hsl(var(--primary)/<alpha-value>)]/20 shadow-lg">
          <CardHeader className="bg-gradient-to-l from-[hsl(var(--primary)/<alpha-value>)]/10 to-transparent border-b">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {task.ai_generated && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-xl font-bold text-foreground mb-2">
                    {task.title}
                  </CardTitle>
                  {activity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="w-4 h-4 text-[hsl(var(--primary)/<alpha-value>)]" />
                      <span>{activity.activity_name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={cn("px-3 py-1", priorityConfig.class)}>
                  {priorityConfig.label}
                </Badge>
                {isAdmin ? (
                  <Select value={task.status} onValueChange={updateTaskStatus}>
                    <SelectTrigger className={cn("w-32", statusConfig.class)}>
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
                  <Badge className={cn("px-3 py-1 flex items-center gap-1", statusConfig.class)}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* التفاصيل */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary)/<alpha-value>)] rounded-full" />
                <h3 className="font-semibold text-foreground">التفاصيل</h3>
              </div>

              {isEditMode ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">عنوان المهمة</Label>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="أدخل عنوان المهمة"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">التفاصيل</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="اكتب تفاصيل المهمة هنا"
                      rows={8}
                      className="resize-y min-h-[180px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">تاريخ الاستحقاق</Label>
                      <Input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold">الأولوية</Label>
                      <Select
                        value={editForm.priority}
                        onValueChange={(v: Task["priority"]) => setEditForm((p) => ({ ...p, priority: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          <SelectItem value="high">عالية</SelectItem>
                          <SelectItem value="medium">متوسطة</SelectItem>
                          <SelectItem value="low">منخفضة</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold">الوقت المقدر (دقيقة)</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={editForm.estimated_time_minutes}
                        onChange={(e) => setEditForm((p) => ({ ...p, estimated_time_minutes: e.target.value }))}
                        placeholder="مثال: 30"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                      إلغاء
                    </Button>
                    <Button onClick={saveEdits} disabled={isSaving} className="gap-2">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      حفظ
                    </Button>
                  </div>
                </div>
              ) : task.description ? (
                <div className="p-5 bg-muted/30 rounded-xl border border-border/50 text-foreground whitespace-pre-wrap leading-relaxed text-[15px]">
                  {task.description}
                </div>
              ) : (
                <div className="p-5 bg-muted/20 rounded-xl border border-dashed border-border/50 text-muted-foreground text-center">
                  <p className="text-sm">لا توجد تفاصيل مضافة لهذه المهمة</p>
                </div>
              )}
            </div>

            {!isEditMode && (
              <>
                {/* معلومات المهمة */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* المنفذ */}
              <div className="p-4 bg-[hsl(var(--primary)/<alpha-value>)]/5 rounded-lg border border-[hsl(var(--primary)/<alpha-value>)]/10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="w-4 h-4 text-[hsl(var(--primary)/<alpha-value>)]" />
                  <span>المنفذ</span>
                </div>
                <div className="flex items-center gap-3">
                  {employee?.avatar_url ? (
                    <img
                      src={employee.avatar_url}
                      alt={employee.full_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/<alpha-value>)]/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-[hsl(var(--primary)/<alpha-value>)]" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-foreground">{employee?.full_name || "غير محدد"}</p>
                    <p className="text-xs text-muted-foreground">{employee?.job_role}</p>
                  </div>
                </div>
              </div>

              {/* التاريخ */}
              <div className="p-4 bg-[hsl(var(--primary)/<alpha-value>)]/5 rounded-lg border border-[hsl(var(--primary)/<alpha-value>)]/10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="w-4 h-4 text-[hsl(var(--primary)/<alpha-value>)]" />
                  <span>تاريخ الاستحقاق</span>
                </div>
                <div>
                  {task.due_date ? (
                    (() => {
                      const dates = formatDateWithHijri(task.due_date);
                      return (
                        <>
                          <p className="font-semibold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {dates.gregorian}
                          </p>
                          <p className="text-xs text-muted-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {dates.hijri}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-muted-foreground">غير محدد</p>
                  )}
                </div>
              </div>

              {/* الوقت المقدر */}
              <div className="p-4 bg-[hsl(var(--primary)/<alpha-value>)]/5 rounded-lg border border-[hsl(var(--primary)/<alpha-value>)]/10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4 text-[hsl(var(--primary)/<alpha-value>)]" />
                  <span>الوقت المقدر</span>
                </div>
                <p className="font-semibold text-foreground text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
                  {task.estimated_time_minutes ? `${formatNumberPlain(task.estimated_time_minutes)} دقيقة` : "غير محدد"}
                </p>
              </div>

              {/* الوقت الفعلي */}
              <div className="p-4 bg-[hsl(var(--primary)/<alpha-value>)]/5 rounded-lg border border-[hsl(var(--primary)/<alpha-value>)]/10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>الوقت الفعلي</span>
                </div>
                {task.status === "in_progress" && task.started_at ? (
                  <LiveTimer
                    startedAt={task.started_at}
                    estimatedMinutes={task.estimated_time_minutes}
                  />
                ) : (
                  <p className="font-semibold text-foreground text-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {task.actual_time_minutes ? `${formatNumberPlain(task.actual_time_minutes)} دقيقة` : "لم يبدأ بعد"}
                  </p>
                )}
              </div>
            </div>

            {/* التقييم */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-emerald-700">نسبة الإنجاز</span>
                  <span className="text-2xl font-bold text-emerald-700" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {formatNumberPlain(task.completion_percentage || 0)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(task.completion_percentage || 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">نسبة الجودة</span>
                  <span className="text-2xl font-bold text-blue-700" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {formatNumberPlain(task.quality_percentage || 0)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(task.quality_percentage || 0, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
          </CardContent>
        </Card>

        {/* نافذة التواصل */}
        {authUser && (
          <TaskCommunicationDialog
            open={isCommunicationDialogOpen}
            onOpenChange={setIsCommunicationDialogOpen}
            taskId={task.id}
            taskTitle={task.title}
            currentUserId={authUser.id}
            isAdmin={isAdmin}
            taskOwnerId={task.user_id}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default TaskDetails;
