import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  Clock,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  FileText,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
  job_role: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

// إزالة كل تكرارات "الإدارة العامة" والفواصل الزائدة من الاسم
const cleanName = (raw: string): string => {
  if (!raw) return raw;
  let s = raw;
  // أزل كل تكرارات "الإدارة العامة" مع الفواصل المحتملة قبلها/بعدها
  s = s.replace(/(?:\s*[-–—|/،,]\s*)?الإدارة\s+العامة(?:\s*[-–—|/،,]\s*)?/g, " ");
  // وحّد المسافات
  s = s.replace(/\s+/g, " ").trim();
  // نظّف فواصل متبقية في الأطراف
  s = s.replace(/^[-–—|/،,\s]+|[-–—|/،,\s]+$/g, "").trim();
  return s || raw;
};

const AddTask = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    user_id: "",
    due_date: "",
    priority: "medium" as "low" | "medium" | "high",
    estimated_time_minutes: 30,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: empData, error: empErr }, { data: depData, error: depErr }] = await Promise.all([
          supabase
          .from("employees")
            .select("id, full_name, user_id, job_role, department_id")
          .not("user_id", "is", null)
            .order("full_name"),
          supabase.from("departments").select("id, name").order("name"),
        ]);
        if (empErr) throw empErr;
        if (depErr) throw depErr;
        setEmployees(empData || []);
        setDepartments(depData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchData();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.title.trim()) {
      newErrors.title = "عنوان المهمة مطلوب";
    }

    if (!form.user_id) {
      newErrors.user_id = "يرجى اختيار المنفذ";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        user_id: form.user_id,
        due_date: form.due_date || null,
        priority: form.priority,
        estimated_time_minutes: form.estimated_time_minutes,
        status: "upcoming",
        completion_percentage: 0,
        quality_percentage: 0,
      });

      if (error) throw error;

      toast({ title: "تم إضافة المهمة بنجاح" });
      navigate("/tasks");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة المهمة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
        {/* رأس الصفحة */}
        <PageHeader
          icon={<Plus className="h-7 w-7" />}
          title="إضافة مهمة جديدة"
          subtitle="إنشاء مهمة جديدة وتعيينها للموظفين"
          actions={
            <Button
              onClick={() => navigate("/tasks")}
              className="gap-2 bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm"
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
          }
        />

        {/* البطاقة الرئيسية */}
        <Card className="border-[hsl(var(--primary)/0.2)] shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-l from-[hsl(var(--primary)/0.1)] to-transparent border-b">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-[hsl(var(--primary))]" />
              بيانات المهمة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* عنوان المهمة */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground">عنوان المهمة *</Label>
              </div>
              <Input
                value={form.title}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                  if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="أدخل عنوان المهمة"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* التفاصيل */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground">التفاصيل</Label>
              </div>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="أدخل تفاصيل المهمة والملاحظات الإضافية (اختياري)"
                rows={5}
                className="resize-y min-h-[120px]"
              />
            </div>

            <Separator />

            {/* القسم */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-[hsl(var(--primary))]" />
                  القسم
                </Label>
              </div>
              <Select
                value={selectedDepartmentId}
                dir="rtl"
                onValueChange={(v) => {
                  setSelectedDepartmentId(v);
                  // امسح اختيار المنفذ إذا لم يعد ضمن القسم الجديد
                  setForm((prev) => ({ ...prev, user_id: "" }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم أولاً" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="__all__">كل الأقسام</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {cleanName(d.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* المنفذ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-[hsl(var(--primary))]" />
                  المنفذ *
                </Label>
              </div>
              {loadingEmployees ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري تحميل الموظفين...
                </div>
              ) : (
                <Select
                  value={form.user_id}
                  dir="rtl"
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, user_id: v }));
                    if (errors.user_id) setErrors((prev) => ({ ...prev, user_id: "" }));
                  }}
                  disabled={!selectedDepartmentId}
                >
                  <SelectTrigger className={errors.user_id ? "border-destructive" : ""}>
                    <SelectValue
                      placeholder={
                        selectedDepartmentId ? "اختر الموظف المنفذ" : "اختر القسم أولاً"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {employees
                      .filter((emp) =>
                        !selectedDepartmentId || selectedDepartmentId === "__all__"
                          ? true
                          : emp.department_id === selectedDepartmentId
                      )
                      .map((emp) => (
                      <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                        <div className="flex items-center gap-2">
                          <span>{cleanName(emp.full_name)}</span>
                          <span className="text-muted-foreground text-xs">({cleanName(emp.job_role || "")})</span>
                        </div>
                      </SelectItem>
                    ))}
                    {employees.filter((emp) =>
                      !selectedDepartmentId || selectedDepartmentId === "__all__"
                        ? true
                        : emp.department_id === selectedDepartmentId
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                        لا يوجد موظفون في هذا القسم
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
              {errors.user_id && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.user_id}
                </p>
              )}
            </div>

            <Separator />

            {/* تاريخ التنفيذ والأولوية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[hsl(var(--primary))]" />
                    تاريخ التنفيذ
                  </Label>
                </div>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-[hsl(var(--primary))]" />
                    الأولوية
                  </Label>
                </div>
                <Select
                  value={form.priority}
                  dir="rtl"
                  onValueChange={(v: "low" | "medium" | "high") =>
                    setForm((prev) => ({ ...prev, priority: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        عادية
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        متوسطة
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        عاجلة
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* الوقت المقدر */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[hsl(var(--primary))]" />
                  الوقت المقدر (بالدقائق)
                </Label>
              </div>
              <Input
                type="number"
                value={form.estimated_time_minutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    estimated_time_minutes: parseInt(e.target.value) || 30,
                  }))
                }
                min={1}
              />
            </div>

            <Separator />

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/tasks")}
                disabled={isLoading}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] min-w-[120px]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة المهمة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddTask;
