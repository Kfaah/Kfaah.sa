import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Sparkles,
  CheckCircle2,
  BarChart3,
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
  { name: "يناير", short: "ين" },
  { name: "فبراير", short: "فب" },
  { name: "مارس", short: "مر" },
  { name: "أبريل", short: "أب" },
  { name: "مايو", short: "ما" },
  { name: "يونيو", short: "يو" },
  { name: "يوليو", short: "يل" },
  { name: "أغسطس", short: "أغ" },
  { name: "سبتمبر", short: "سب" },
  { name: "أكتوبر", short: "أك" },
  { name: "نوفمبر", short: "نو" },
  { name: "ديسمبر", short: "دي" },
];

const AddOperationalPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesRes, goalsRes, initiativesRes] = await Promise.all([
          supabase.from("employees").select("id, user_id, full_name, department_id, job_role").eq("status", "active").order("full_name"),
          supabase.from("strategic_goals").select("id, name, color, year").eq("year", form.year).order("display_order"),
          supabase.from("initiatives").select("id, strategic_goal_id, name").order("display_order"),
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (goalsRes.error) throw goalsRes.error;
        if (initiativesRes.error) throw initiativesRes.error;

        setEmployees(employeesRes.data || []);
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

  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === form.strategic_goal_id
  );

  const monthlySum = form.monthlyTargets.reduce((a, b) => a + b, 0);
  const annualTargetNum = parseInt(form.annual_target || "0");
  const isBalanced = monthlySum === annualTargetNum;

  const distributeEvenly = () => {
    const target = parseInt(form.annual_target) || 0;
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    
    const newTargets = Array(12).fill(perMonth);
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
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" dir="rtl">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-l from-primary/5 via-transparent to-accent/5 rounded-3xl blur-3xl" />
            <div className="relative bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/operational-plans")}
                    className="rounded-xl hover:bg-muted"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/25">
                      <BarChart3 className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">إضافة خطة تشغيلية</h1>
                      <p className="text-muted-foreground text-sm">أنشئ خطة تشغيلية جديدة مع توزيع الأهداف الشهرية</p>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="gap-2 px-4 py-2 text-sm border-primary/30 text-primary">
                  <Calendar className="w-4 h-4" />
                  {form.year}
                </Badge>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Right Column - Main Form */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Activity Info Card */}
              <Card className="border-border/50 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">معلومات النشاط</h2>
                      <p className="text-xs text-muted-foreground">حدد تفاصيل النشاط التشغيلي</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      اسم النشاط <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={form.activity_name}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, activity_name: e.target.value }));
                        if (errors.activity_name) setErrors(prev => ({ ...prev, activity_name: "" }));
                      }}
                      placeholder="مثال: تنفيذ حملات توعوية..."
                      className={`h-12 text-base ${errors.activity_name ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    {errors.activity_name && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {errors.activity_name}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        المستهدف السنوي <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={form.annual_target}
                          onChange={(e) => {
                            setForm(prev => ({ ...prev, annual_target: e.target.value }));
                            if (errors.annual_target) setErrors(prev => ({ ...prev, annual_target: "" }));
                          }}
                          placeholder="0"
                          className={`h-12 text-lg font-semibold text-center ${errors.annual_target ? "border-destructive" : ""}`}
                          min={1}
                        />
                        <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      </div>
                      {errors.annual_target && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {errors.annual_target}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        السنة
                      </Label>
                      <Select
                        value={form.year.toString()}
                        onValueChange={(v) => setForm(prev => ({ ...prev, year: parseInt(v), strategic_goal_id: "", initiative_id: "" }))}
                      >
                        <SelectTrigger className="h-12">
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
                  </div>
                </CardContent>
              </Card>

              {/* Strategic Goal & Initiative Card */}
              <Card className="border-border/50 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-l from-accent/10 via-accent/5 to-transparent p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">الارتباط الاستراتيجي</h2>
                      <p className="text-xs text-muted-foreground">اربط النشاط بالأهداف والمبادرات</p>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-5">
                  {/* Strategic Goal */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-medium flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        الهدف الاستراتيجي <span className="text-destructive">*</span>
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingNewGoal(!isAddingNewGoal);
                          if (!isAddingNewGoal) {
                            setForm(prev => ({ ...prev, strategic_goal_id: "" }));
                          }
                        }}
                        className="text-primary hover:text-primary/80 h-8 text-xs"
                      >
                        <Plus className="w-3 h-3 ml-1" />
                        {isAddingNewGoal ? "اختيار موجود" : "هدف جديد"}
                      </Button>
                    </div>
                    
                    {isAddingNewGoal ? (
                      <Input
                        value={newGoalName}
                        onChange={(e) => setNewGoalName(e.target.value)}
                        placeholder="أدخل اسم الهدف الاستراتيجي الجديد"
                        className={`h-12 ${errors.strategic_goal_id ? "border-destructive" : ""}`}
                      />
                    ) : (
                      <Select
                        value={form.strategic_goal_id}
                        onValueChange={(v) => {
                          setForm(prev => ({ ...prev, strategic_goal_id: v, initiative_id: "" }));
                          if (errors.strategic_goal_id) setErrors(prev => ({ ...prev, strategic_goal_id: "" }));
                        }}
                      >
                        <SelectTrigger className={`h-12 ${errors.strategic_goal_id ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="اختر الهدف الاستراتيجي" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {strategicGoals.map((goal) => (
                            <SelectItem key={goal.id} value={goal.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: goal.color }} />
                                {goal.name}
                              </div>
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

                  {/* Initiative */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground font-medium flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        المبادرة
                      </Label>
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
                          className="text-amber-600 hover:text-amber-700 h-8 text-xs"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          {isAddingNewInitiative ? "اختيار موجودة" : "مبادرة جديدة"}
                        </Button>
                      )}
                    </div>
                    
                    {isAddingNewInitiative ? (
                      <Input
                        value={newInitiativeName}
                        onChange={(e) => setNewInitiativeName(e.target.value)}
                        placeholder="أدخل اسم المبادرة الجديدة"
                        className="h-12"
                      />
                    ) : (
                      <Select
                        value={form.initiative_id}
                        onValueChange={(v) => setForm(prev => ({ ...prev, initiative_id: v }))}
                        disabled={!form.strategic_goal_id && !isAddingNewGoal}
                      >
                        <SelectTrigger className="h-12">
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

                  {/* Responsible Employee */}
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-primary" />
                      مسؤول التنفيذ
                    </Label>
                    <Select
                      value={form.responsible_employee_id}
                      onValueChange={(v) => setForm(prev => ({ ...prev, responsible_employee_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="h-12">
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
                </CardContent>
              </Card>
            </div>

            {/* Left Column - Monthly Targets */}
            <div className="space-y-6">
              <Card className="border-border/50 shadow-lg overflow-hidden sticky top-6">
                <div className="bg-gradient-to-l from-emerald-500/10 via-emerald-500/5 to-transparent p-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground">التوزيع الشهري</h2>
                        <p className="text-xs text-muted-foreground">وزّع المستهدف على الأشهر</p>
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4 space-y-4">
                  {/* Auto Distribute Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={distributeEvenly}
                    disabled={!form.annual_target || parseInt(form.annual_target) <= 0}
                    className="w-full gap-2 h-10 border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <Sparkles className="w-4 h-4" />
                    توزيع تلقائي متساوي
                  </Button>

                  {/* Monthly Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {MONTHS_AR.map((month, index) => (
                      <div key={month.name} className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground text-center block">{month.name}</Label>
                        <Input
                          type="number"
                          value={form.monthlyTargets[index]}
                          onChange={(e) => {
                            const newTargets = [...form.monthlyTargets];
                            newTargets[index] = parseInt(e.target.value) || 0;
                            setForm(prev => ({ ...prev, monthlyTargets: newTargets }));
                          }}
                          min={0}
                          className="text-center h-10 text-sm font-medium"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className={`p-3 rounded-xl border ${
                    isBalanced 
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" 
                      : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isBalanced ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="text-sm text-muted-foreground">المجموع</span>
                      </div>
                      <div className="text-left">
                        <span className={`font-bold ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>
                          {monthlySum}
                        </span>
                        <span className="text-muted-foreground text-sm"> / {annualTargetNum}</span>
                      </div>
                    </div>
                    {!isBalanced && annualTargetNum > 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        {monthlySum > annualTargetNum 
                          ? `زيادة بـ ${monthlySum - annualTargetNum}` 
                          : `ينقص ${annualTargetNum - monthlySum}`
                        }
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/operational-plans")}
              disabled={isLoading}
              className="h-12 px-6"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="h-12 px-8 gap-2 bg-gradient-to-l from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              إضافة الخطة
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
