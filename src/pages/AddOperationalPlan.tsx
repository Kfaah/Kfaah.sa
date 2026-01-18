import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Target,
  Lightbulb,
  Zap,
  Calendar,
  UserCircle,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAvailableYears } from "@/lib/utils";

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
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const AddOperationalPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategicGoals, setStrategicGoals] = useState<StrategicGoal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const [form, setForm] = useState({
    activity_name: "",
    strategic_goal_id: "",
    initiative_id: "",
    annual_target: "",
    year: new Date().getFullYear(),
    responsible_employee_id: "",
    monthlyTargets: Array(12).fill(0) as number[],
  });

  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);
  const [isAddingNewInitiative, setIsAddingNewInitiative] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  // جلب البيانات
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesRes, deptsRes, goalsRes, initiativesRes] = await Promise.all([
          supabase.from("employees").select("id, user_id, full_name, department_id, job_role").eq("status", "active").order("full_name"),
          supabase.from("departments").select("id, name, color").order("name"),
          supabase.from("strategic_goals").select("id, name, color, year").eq("year", form.year).order("display_order"),
          supabase.from("initiatives").select("id, strategic_goal_id, name").order("display_order"),
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (deptsRes.error) throw deptsRes.error;
        if (goalsRes.error) throw goalsRes.error;
        if (initiativesRes.error) throw initiativesRes.error;

        setEmployees(employeesRes.data || []);
        setDepartments(deptsRes.data || []);
        setStrategicGoals(goalsRes.data || []);
        setInitiatives(initiativesRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء جلب البيانات",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [form.year]);

  // المبادرات المفلترة حسب الهدف المختار
  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === form.strategic_goal_id
  );

  // حساب المتوسط الشهري
  const monthlyAverage = form.annual_target 
    ? Math.round(parseInt(form.annual_target) / 12) 
    : 0;

  // توزيع تلقائي على الأشهر
  const distributeEvenly = () => {
    const target = parseInt(form.annual_target) || 0;
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    
    const newTargets = Array(12).fill(perMonth);
    // توزيع الباقي على الأشهر الأولى
    for (let i = 0; i < remainder; i++) {
      newTargets[i]++;
    }
    
    setForm(prev => ({ ...prev, monthlyTargets: newTargets }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.activity_name.trim()) {
      newErrors.activity_name = "اسم النشاط مطلوب";
    }

    if (!form.strategic_goal_id && !newGoalName.trim()) {
      newErrors.strategic_goal_id = "الهدف الاستراتيجي مطلوب";
    }

    if (!form.annual_target || parseInt(form.annual_target) <= 0) {
      newErrors.annual_target = "المستهدف السنوي مطلوب";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !authUser) return;

    setIsLoading(true);
    try {
      let goalId = form.strategic_goal_id;
      let goalName = strategicGoals.find(g => g.id === goalId)?.name || "";
      let initiativeId = form.initiative_id;
      let initiativeName = initiatives.find(i => i.id === initiativeId)?.name || "";

      // إنشاء هدف استراتيجي جديد إذا لزم الأمر
      if (isAddingNewGoal && newGoalName.trim()) {
        const { data: newGoal, error: goalError } = await supabase
          .from("strategic_goals")
          .insert({
            name: newGoalName.trim(),
            color: "#3d9aa8",
            year: form.year,
          })
          .select()
          .single();

        if (goalError) throw goalError;
        goalId = newGoal.id;
        goalName = newGoal.name;
      }

      // إنشاء مبادرة جديدة إذا لزم الأمر
      if (isAddingNewInitiative && newInitiativeName.trim() && goalId) {
        const { data: newInit, error: initError } = await supabase
          .from("initiatives")
          .insert({
            strategic_goal_id: goalId,
            name: newInitiativeName.trim(),
          })
          .select()
          .single();

        if (initError) throw initError;
        initiativeId = newInit.id;
        initiativeName = newInit.name;
      }

      // إنشاء الخطة التشغيلية
      const { data: plan, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: authUser.id,
          activity_name: form.activity_name.trim(),
          strategic_goal: goalName,
          strategic_goal_id: goalId || null,
          initiative: initiativeName || null,
          initiative_id: initiativeId || null,
          annual_target: parseInt(form.annual_target),
          year: form.year,
          responsible_employee_id: form.responsible_employee_id || null,
          status: "active",
        })
        .select()
        .single();

      if (planError) throw planError;

      // إنشاء المستهدفات الشهرية
      const monthlyData = form.monthlyTargets.map((target, index) => ({
        operational_plan_id: plan.id,
        month: index + 1,
        monthly_target: target,
      }));

      const { error: monthsError } = await supabase
        .from("operational_plan_months")
        .insert(monthlyData);

      if (monthsError) throw monthsError;

      toast({ title: "تم إضافة الخطة التشغيلية بنجاح" });
      navigate("/operational-plans");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة الخطة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-[#3d9aa8]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/operational-plans")}
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              إضافة خطة تشغيلية
            </h1>
          </div>
        </div>

        {/* البطاقة الرئيسية */}
        <Card className="border-[#3d9aa8]/20 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-l from-[#3d9aa8]/10 to-transparent border-b">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-[#3d9aa8]" />
              بيانات الخطة التشغيلية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* السنة */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#3d9aa8]" />
                  السنة
                </Label>
              </div>
              <Select
                value={form.year.toString()}
                onValueChange={(v) => setForm(prev => ({ ...prev, year: parseInt(v), strategic_goal_id: "", initiative_id: "" }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {getAvailableYears().map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* الهدف الاستراتيجي */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#3d9aa8]" />
                    الهدف الاستراتيجي *
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingNewGoal(!isAddingNewGoal);
                    if (!isAddingNewGoal) {
                      setForm(prev => ({ ...prev, strategic_goal_id: "" }));
                    }
                  }}
                  className="text-[#3d9aa8] hover:text-[#3d9aa8]/80"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  {isAddingNewGoal ? "اختيار من القائمة" : "إضافة جديد"}
                </Button>
              </div>
              
              {isAddingNewGoal ? (
                <Input
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  placeholder="أدخل اسم الهدف الاستراتيجي الجديد"
                  className={errors.strategic_goal_id ? "border-destructive" : ""}
                />
              ) : (
                <Select
                  value={form.strategic_goal_id}
                  onValueChange={(v) => {
                    setForm(prev => ({ ...prev, strategic_goal_id: v, initiative_id: "" }));
                    if (errors.strategic_goal_id) setErrors(prev => ({ ...prev, strategic_goal_id: "" }));
                  }}
                >
                  <SelectTrigger className={errors.strategic_goal_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="اختر الهدف الاستراتيجي" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {strategicGoals.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        {goal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.strategic_goal_id && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.strategic_goal_id}
                </p>
              )}
            </div>

            {/* المبادرة */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#3d9aa8]" />
                    المبادرة
                  </Label>
                </div>
                {(form.strategic_goal_id || isAddingNewGoal) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsAddingNewInitiative(!isAddingNewInitiative);
                      if (!isAddingNewInitiative) {
                        setForm(prev => ({ ...prev, initiative_id: "" }));
                      }
                    }}
                    className="text-[#3d9aa8] hover:text-[#3d9aa8]/80"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    {isAddingNewInitiative ? "اختيار من القائمة" : "إضافة جديدة"}
                  </Button>
                )}
              </div>
              
              {isAddingNewInitiative ? (
                <Input
                  value={newInitiativeName}
                  onChange={(e) => setNewInitiativeName(e.target.value)}
                  placeholder="أدخل اسم المبادرة الجديدة"
                />
              ) : (
                <Select
                  value={form.initiative_id}
                  onValueChange={(v) => setForm(prev => ({ ...prev, initiative_id: v }))}
                  disabled={!form.strategic_goal_id && !isAddingNewGoal}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.strategic_goal_id || isAddingNewGoal ? "اختر المبادرة (اختياري)" : "اختر الهدف أولاً"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {filteredInitiatives.map((init) => (
                      <SelectItem key={init.id} value={init.id}>
                        {init.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            {/* اسم النشاط */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#3d9aa8]" />
                  اسم النشاط *
                </Label>
              </div>
              <Input
                value={form.activity_name}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, activity_name: e.target.value }));
                  if (errors.activity_name) setErrors(prev => ({ ...prev, activity_name: "" }));
                }}
                placeholder="أدخل اسم النشاط التشغيلي"
                className={errors.activity_name ? "border-destructive" : ""}
              />
              {errors.activity_name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.activity_name}
                </p>
              )}
            </div>

            {/* المستهدف السنوي ومسؤول التنفيذ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#3d9aa8]" />
                    المستهدف السنوي *
                  </Label>
                </div>
                <Input
                  type="number"
                  value={form.annual_target}
                  onChange={(e) => {
                    setForm(prev => ({ ...prev, annual_target: e.target.value }));
                    if (errors.annual_target) setErrors(prev => ({ ...prev, annual_target: "" }));
                  }}
                  placeholder="أدخل المستهدف السنوي"
                  className={errors.annual_target ? "border-destructive" : ""}
                  min={1}
                />
                {errors.annual_target && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.annual_target}
                  </p>
                )}
                {monthlyAverage > 0 && (
                  <p className="text-sm text-muted-foreground">
                    المتوسط الشهري: <span className="font-semibold text-[#3d9aa8]">{monthlyAverage}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-[#3d9aa8]" />
                    مسؤول التنفيذ
                  </Label>
                </div>
                <Select
                  value={form.responsible_employee_id}
                  onValueChange={(v) => setForm(prev => ({ ...prev, responsible_employee_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مسؤول التنفيذ (اختياري)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">بدون مسؤول محدد</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} {emp.job_role && `- ${emp.job_role}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* المستهدفات الشهرية */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[#3d9aa8] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Hash className="w-4 h-4 text-[#3d9aa8]" />
                    المستهدفات الشهرية
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={distributeEvenly}
                  disabled={!form.annual_target || parseInt(form.annual_target) <= 0}
                  className="gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  توزيع تلقائي
                </Button>
              </div>
              
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {MONTHS_AR.map((month, index) => (
                  <div key={month} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{month}</Label>
                    <Input
                      type="number"
                      value={form.monthlyTargets[index]}
                      onChange={(e) => {
                        const newTargets = [...form.monthlyTargets];
                        newTargets[index] = parseInt(e.target.value) || 0;
                        setForm(prev => ({ ...prev, monthlyTargets: newTargets }));
                      }}
                      min={0}
                      className="text-center"
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <span>مجموع المستهدفات الشهرية:</span>
                <span className={`font-semibold ${
                  form.monthlyTargets.reduce((a, b) => a + b, 0) === parseInt(form.annual_target || "0") 
                    ? "text-emerald-600" 
                    : "text-amber-600"
                }`}>
                  {form.monthlyTargets.reduce((a, b) => a + b, 0)} / {form.annual_target || 0}
                </span>
              </div>
            </div>

            <Separator />

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/operational-plans")}
                disabled={isLoading}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="gap-2 bg-[#3d9aa8] hover:bg-[#3d9aa8]/90 min-w-[140px]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إضافة الخطة
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
