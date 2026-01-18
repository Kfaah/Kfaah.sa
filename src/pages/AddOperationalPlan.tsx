import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Save,
  Columns,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAvailableYears } from "@/lib/utils";
import { ManageCustomColumnsDialog } from "@/components/operational-plans/ManageCustomColumnsDialog";

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
  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
  const [isMonthlyExpanded, setIsMonthlyExpanded] = useState(false);

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
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/operational-plans")}
                className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">إضافة خطة تشغيلية جديدة</h1>
                  <p className="text-sm text-muted-foreground">أدخل بيانات الخطة والمستهدفات الشهرية</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Year Selector - Moved to header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Calendar className="w-4 h-4 text-slate-500" />
                <Select
                  value={form.year.toString()}
                  onValueChange={(v) => setForm(prev => ({ ...prev, year: parseInt(v), strategic_goal_id: "", initiative_id: "" }))}
                >
                  <SelectTrigger className="w-24 h-8 text-sm border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {getAvailableYears().map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsManageColumnsOpen(true)}
                className="h-10 gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <Columns className="w-4 h-4" />
                إدارة الأعمدة
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/operational-plans")}
                disabled={isLoading}
                className="h-10"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="h-10 gap-2 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/20"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ الخطة
              </Button>
            </div>
          </div>

          {/* Main Form Card */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              {/* Table Header Row */}
              <div className="bg-gradient-to-l from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-850 border-b border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-12 lg:grid-cols-[200px_1fr_180px_180px_140px] gap-0">
                  <div className="col-span-12 lg:col-span-1 p-3 border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <Target className="w-4 h-4 text-emerald-600" />
                      الهدف الاستراتيجي
                    </div>
                  </div>
                  <div className="hidden lg:block p-3 border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      المبادرة
                    </div>
                  </div>
                  <div className="hidden lg:block p-3 border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <Zap className="w-4 h-4 text-blue-500" />
                      النشاط
                    </div>
                  </div>
                  <div className="hidden lg:block p-3 border-l border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <UserCircle className="w-4 h-4 text-cyan-500" />
                      مسؤول التنفيذ
                    </div>
                  </div>
                  <div className="hidden lg:block p-3 bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      المستهدف السنوي
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Row */}
              <div className="bg-white dark:bg-slate-900">
                {/* Mobile View */}
                <div className="lg:hidden p-4 space-y-4">
                  {/* Strategic Goal */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-600" />
                        الهدف الاستراتيجي *
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingNewGoal(!isAddingNewGoal);
                          if (!isAddingNewGoal) setForm(prev => ({ ...prev, strategic_goal_id: "" }));
                        }}
                        className="text-emerald-600 text-xs h-7"
                      >
                        <Plus className="w-3 h-3 ml-1" />
                        {isAddingNewGoal ? "اختيار" : "جديد"}
                      </Button>
                    </div>
                    {isAddingNewGoal ? (
                      <Input
                        value={newGoalName}
                        onChange={(e) => setNewGoalName(e.target.value)}
                        placeholder="اسم الهدف الجديد"
                        className={errors.strategic_goal_id ? "border-red-300" : ""}
                      />
                    ) : (
                      <Select
                        value={form.strategic_goal_id}
                        onValueChange={(v) => {
                          setForm(prev => ({ ...prev, strategic_goal_id: v, initiative_id: "" }));
                          if (errors.strategic_goal_id) setErrors(prev => ({ ...prev, strategic_goal_id: "" }));
                        }}
                      >
                        <SelectTrigger className={errors.strategic_goal_id ? "border-red-300" : ""}>
                          <SelectValue placeholder="اختر الهدف" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          {strategicGoals.map((goal) => (
                            <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Initiative */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        المبادرة
                      </label>
                      {(form.strategic_goal_id || isAddingNewGoal) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingNewInitiative(!isAddingNewInitiative);
                            if (!isAddingNewInitiative) setForm(prev => ({ ...prev, initiative_id: "" }));
                          }}
                          className="text-amber-600 text-xs h-7"
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          {isAddingNewInitiative ? "اختيار" : "جديدة"}
                        </Button>
                      )}
                    </div>
                    {isAddingNewInitiative ? (
                      <Input
                        value={newInitiativeName}
                        onChange={(e) => setNewInitiativeName(e.target.value)}
                        placeholder="اسم المبادرة الجديدة"
                      />
                    ) : (
                      <Select
                        value={form.initiative_id}
                        onValueChange={(v) => setForm(prev => ({ ...prev, initiative_id: v }))}
                        disabled={!form.strategic_goal_id && !isAddingNewGoal}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المبادرة" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          {filteredInitiatives.map((init) => (
                            <SelectItem key={init.id} value={init.id}>{init.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Activity Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      اسم النشاط *
                    </label>
                    <Input
                      value={form.activity_name}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, activity_name: e.target.value }));
                        if (errors.activity_name) setErrors(prev => ({ ...prev, activity_name: "" }));
                      }}
                      placeholder="أدخل اسم النشاط"
                      className={errors.activity_name ? "border-red-300" : ""}
                    />
                  </div>

                  {/* Annual Target & Year */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        المستهدف السنوي *
                      </label>
                      <Input
                        type="number"
                        value={form.annual_target}
                        onChange={(e) => {
                          setForm(prev => ({ ...prev, annual_target: e.target.value }));
                          if (errors.annual_target) setErrors(prev => ({ ...prev, annual_target: "" }));
                        }}
                        placeholder="0"
                        className={`text-center font-semibold ${errors.annual_target ? "border-red-300" : ""}`}
                        min={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        السنة
                      </label>
                      <Select
                        value={form.year.toString()}
                        onValueChange={(v) => setForm(prev => ({ ...prev, year: parseInt(v), strategic_goal_id: "", initiative_id: "" }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          {getAvailableYears().map((y) => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Responsible Employee */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-slate-500" />
                      مسؤول التنفيذ
                    </label>
                    <Select
                      value={form.responsible_employee_id}
                      onValueChange={(v) => setForm(prev => ({ ...prev, responsible_employee_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر مسؤول التنفيذ" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">بدون</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Monthly Targets */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">المستهدفات الشهرية</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={distributeEvenly}
                        disabled={!form.annual_target || parseInt(form.annual_target) <= 0}
                        className="gap-1 text-xs h-8"
                      >
                        <Sparkles className="w-3 h-3" />
                        توزيع تلقائي
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {MONTHS_AR.map((month, index) => (
                        <div key={month} className="space-y-1">
                          <span className="text-[10px] text-slate-500 block text-center">{month}</span>
                          <Input
                            type="number"
                            value={form.monthlyTargets[index]}
                            onChange={(e) => {
                              const newTargets = [...form.monthlyTargets];
                              newTargets[index] = parseInt(e.target.value) || 0;
                              setForm(prev => ({ ...prev, monthlyTargets: newTargets }));
                            }}
                            min={0}
                            className="text-center h-9 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className={`p-3 rounded-lg text-center ${isBalanced ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"}`}>
                      <span className="text-sm text-slate-600 dark:text-slate-400">المجموع: </span>
                      <span className={`font-bold ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>{monthlySum}</span>
                      <span className="text-slate-400"> / </span>
                      <span className="font-medium text-slate-600">{annualTargetNum}</span>
                    </div>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:grid grid-cols-[200px_1fr_180px_180px_140px] gap-0 items-stretch min-h-[80px]">
                  {/* Strategic Goal Cell */}
                  <div className="p-2 border-l border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingNewGoal(!isAddingNewGoal);
                            if (!isAddingNewGoal) setForm(prev => ({ ...prev, strategic_goal_id: "" }));
                          }}
                          className="text-emerald-600 text-[10px] h-6 px-2"
                        >
                          <Plus className="w-3 h-3" />
                          {isAddingNewGoal ? "قائمة" : "جديد"}
                        </Button>
                      </div>
                      {isAddingNewGoal ? (
                        <Input
                          value={newGoalName}
                          onChange={(e) => setNewGoalName(e.target.value)}
                          placeholder="هدف جديد..."
                          className={`text-xs h-9 ${errors.strategic_goal_id ? "border-red-300" : ""}`}
                        />
                      ) : (
                        <Select
                          value={form.strategic_goal_id}
                          onValueChange={(v) => {
                            setForm(prev => ({ ...prev, strategic_goal_id: v, initiative_id: "" }));
                            if (errors.strategic_goal_id) setErrors(prev => ({ ...prev, strategic_goal_id: "" }));
                          }}
                        >
                          <SelectTrigger className={`text-xs h-9 ${errors.strategic_goal_id ? "border-red-300" : ""}`}>
                            <SelectValue placeholder="اختر الهدف" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {strategicGoals.map((goal) => (
                              <SelectItem key={goal.id} value={goal.id} className="text-xs">
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
                        <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          مطلوب
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Initiative Cell */}
                  <div className="p-2 border-l border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="h-full flex flex-col">
                      {(form.strategic_goal_id || isAddingNewGoal) && (
                        <div className="flex items-center justify-between mb-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsAddingNewInitiative(!isAddingNewInitiative);
                              if (!isAddingNewInitiative) setForm(prev => ({ ...prev, initiative_id: "" }));
                            }}
                            className="text-amber-600 text-[10px] h-6 px-2"
                          >
                            <Plus className="w-3 h-3" />
                            {isAddingNewInitiative ? "قائمة" : "جديدة"}
                          </Button>
                        </div>
                      )}
                      {isAddingNewInitiative ? (
                        <Input
                          value={newInitiativeName}
                          onChange={(e) => setNewInitiativeName(e.target.value)}
                          placeholder="مبادرة جديدة..."
                          className="text-xs h-9"
                        />
                      ) : (
                        <Select
                          value={form.initiative_id}
                          onValueChange={(v) => setForm(prev => ({ ...prev, initiative_id: v }))}
                          disabled={!form.strategic_goal_id && !isAddingNewGoal}
                        >
                          <SelectTrigger className="text-xs h-9">
                            <SelectValue placeholder={form.strategic_goal_id || isAddingNewGoal ? "اختر المبادرة" : "اختر الهدف أولاً"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {filteredInitiatives.map((init) => (
                              <SelectItem key={init.id} value={init.id} className="text-xs">{init.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Activity Name Cell */}
                  <div className="p-2 border-l border-b border-slate-200 dark:border-slate-700">
                    <Input
                      value={form.activity_name}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, activity_name: e.target.value }));
                        if (errors.activity_name) setErrors(prev => ({ ...prev, activity_name: "" }));
                      }}
                      placeholder="اسم النشاط *"
                      className={`text-xs h-9 ${errors.activity_name ? "border-red-300" : ""}`}
                    />
                    {errors.activity_name && (
                      <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        مطلوب
                      </span>
                    )}
                  </div>

                  {/* Responsible Employee Cell */}
                  <div className="p-2 border-l border-b border-slate-200 dark:border-slate-700 bg-cyan-50/50 dark:bg-cyan-950/20">
                    <Select
                      value={form.responsible_employee_id}
                      onValueChange={(v) => setForm(prev => ({ ...prev, responsible_employee_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="اختر مسؤول التنفيذ" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">بدون</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id} className="text-xs">{emp.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Annual Target Cell */}
                  <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-950/20">
                    <Input
                      type="number"
                      value={form.annual_target}
                      onChange={(e) => {
                        setForm(prev => ({ ...prev, annual_target: e.target.value }));
                        if (errors.annual_target) setErrors(prev => ({ ...prev, annual_target: "" }));
                      }}
                      placeholder="0"
                      className={`text-center font-bold text-sm h-9 ${errors.annual_target ? "border-red-300" : ""}`}
                      min={1}
                    />
                    {errors.annual_target && (
                      <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        مطلوب
                      </span>
                    )}
                  </div>
                </div>

                {/* Monthly Targets Collapsible Section - Desktop */}
                <div className="hidden lg:block border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setIsMonthlyExpanded(!isMonthlyExpanded)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">المستهدفات الشهرية</span>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">المجموع:</span>
                          <span className={`font-bold ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>{monthlySum}</span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">{annualTargetNum}</span>
                          {isBalanced && annualTargetNum > 0 && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                          {!isBalanced && annualTargetNum > 0 && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                              {monthlySum > annualTargetNum ? `+${monthlySum - annualTargetNum}` : `-${annualTargetNum - monthlySum}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          distributeEvenly();
                        }}
                        disabled={!form.annual_target || parseInt(form.annual_target) <= 0}
                        className="gap-1 text-xs h-8"
                      >
                        <Sparkles className="w-3 h-3" />
                        توزيع تلقائي
                      </Button>
                      {isMonthlyExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Monthly Targets */}
                  {isMonthlyExpanded && (
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-12 gap-3">
                        {MONTHS_AR.map((month, index) => (
                          <div 
                            key={month} 
                            className={`p-3 rounded-lg border ${
                              index % 2 === 0 
                                ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" 
                                : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <div className="text-xs text-slate-500 text-center mb-2 font-medium">{month}</div>
                            <Input
                              type="number"
                              value={form.monthlyTargets[index]}
                              onChange={(e) => {
                                const newTargets = [...form.monthlyTargets];
                                newTargets[index] = parseInt(e.target.value) || 0;
                                setForm(prev => ({ ...prev, monthlyTargets: newTargets }));
                              }}
                              min={0}
                              className="text-center h-10 text-sm font-semibold"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Balance Status */}
                      <div className={`mt-4 p-3 rounded-lg text-center ${
                        isBalanced 
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" 
                          : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      }`}>
                        {isBalanced ? (
                          <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">التوزيع متوازن</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                            <span className="font-medium">
                              التوزيع غير متوازن - الفرق: {Math.abs(monthlySum - annualTargetNum)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Manage Columns Dialog */}
      <ManageCustomColumnsDialog
        open={isManageColumnsOpen}
        onOpenChange={setIsManageColumnsOpen}
        onColumnsChange={() => {}}
      />
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
