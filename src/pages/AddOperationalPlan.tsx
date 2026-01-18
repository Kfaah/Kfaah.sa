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
  Building2,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAvailableYears } from "@/lib/utils";
import { ManageCustomColumnsDialog } from "@/components/operational-plans/ManageCustomColumnsDialog";

interface Department {
  id: string;
  name: string;
}

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

interface ActivityRow {
  id: string;
  activity_name: string;
  department_id: string;
  responsible_employee_id: string;
  annual_target: string;
  monthlyTargets: number[];
  isMonthlyExpanded: boolean;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const createEmptyActivity = (): ActivityRow => ({
  id: crypto.randomUUID(),
  activity_name: "",
  department_id: "",
  responsible_employee_id: "",
  annual_target: "",
  monthlyTargets: Array(12).fill(0),
  isMonthlyExpanded: false,
});

const AddOperationalPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [strategicGoals, setStrategicGoals] = useState<StrategicGoal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [strategicGoalId, setStrategicGoalId] = useState("");
  const [initiativeId, setInitiativeId] = useState("");
  const [activities, setActivities] = useState<ActivityRow[]>([createEmptyActivity()]);

  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);
  const [isAddingNewInitiative, setIsAddingNewInitiative] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [departmentsRes, employeesRes, goalsRes, initiativesRes] = await Promise.all([
          supabase.from("departments").select("id, name").order("name"),
          supabase.from("employees").select("id, user_id, full_name, department_id, job_role").eq("status", "active").order("full_name"),
          supabase.from("strategic_goals").select("id, name, color, year").eq("year", year).order("display_order"),
          supabase.from("initiatives").select("id, strategic_goal_id, name").order("display_order"),
        ]);

        if (departmentsRes.error) throw departmentsRes.error;
        if (employeesRes.error) throw employeesRes.error;
        if (goalsRes.error) throw goalsRes.error;
        if (initiativesRes.error) throw initiativesRes.error;

        setDepartments(departmentsRes.data || []);
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
  }, [year]);

  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === strategicGoalId
  );

  const getFilteredEmployees = (departmentId: string) => {
    if (!departmentId) return [];
    return employees.filter(emp => emp.department_id === departmentId);
  };

  const updateActivity = (id: string, updates: Partial<ActivityRow>) => {
    setActivities(prev => prev.map(act => 
      act.id === id ? { ...act, ...updates } : act
    ));
  };

  const addActivity = () => {
    setActivities(prev => [...prev, createEmptyActivity()]);
  };

  const removeActivity = (id: string) => {
    if (activities.length > 1) {
      setActivities(prev => prev.filter(act => act.id !== id));
    }
  };

  const distributeEvenly = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;
    
    const target = parseInt(activity.annual_target) || 0;
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    
    const newTargets = Array(12).fill(perMonth);
    for (let i = 0; i < remainder; i++) {
      newTargets[i]++;
    }
    
    updateActivity(activityId, { monthlyTargets: newTargets });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!strategicGoalId && !newGoalName.trim()) {
      newErrors.strategic_goal_id = "الهدف الاستراتيجي مطلوب";
    }

    activities.forEach((activity, index) => {
      if (!activity.activity_name.trim()) {
        newErrors[`activity_${index}`] = "اسم النشاط مطلوب";
      }
      if (!activity.annual_target || parseInt(activity.annual_target) <= 0) {
        newErrors[`annual_target_${index}`] = "المستهدف السنوي مطلوب";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !authUser) return;

    setIsLoading(true);
    try {
      let goalId = strategicGoalId;
      let goalName = strategicGoals.find(g => g.id === goalId)?.name || "";
      let initId = initiativeId;
      let initName = initiatives.find(i => i.id === initId)?.name || "";

      if (isAddingNewGoal && newGoalName.trim()) {
        const { data: newGoal, error: goalError } = await supabase
          .from("strategic_goals")
          .insert({
            name: newGoalName.trim(),
            color: "#3d9aa8",
            year: year,
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
        initId = newInit.id;
        initName = newInit.name;
      }

      // Insert all activities
      for (const activity of activities) {
        const { data: plan, error: planError } = await supabase
          .from("operational_plans")
          .insert({
            user_id: authUser.id,
            activity_name: activity.activity_name.trim(),
            strategic_goal: goalName,
            strategic_goal_id: goalId || null,
            initiative: initName || null,
            initiative_id: initId || null,
            annual_target: parseInt(activity.annual_target),
            year: year,
            responsible_employee_id: activity.responsible_employee_id || null,
            status: "active",
          })
          .select()
          .single();

        if (planError) throw planError;

        const monthlyData = activity.monthlyTargets.map((target, index) => ({
          operational_plan_id: plan.id,
          month: index + 1,
          monthly_target: target,
        }));

        const { error: monthsError } = await supabase
          .from("operational_plan_months")
          .insert(monthlyData);

        if (monthsError) throw monthsError;
      }

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
              {/* Year Selector */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Calendar className="w-4 h-4 text-slate-500" />
                <Select
                  value={year.toString()}
                  onValueChange={(v) => {
                    setYear(parseInt(v));
                    setStrategicGoalId("");
                    setInitiativeId("");
                  }}
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

          {/* Strategic Goal & Initiative Selection */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-lg">
            <CardContent className="p-5">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Strategic Goal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <Target className="w-4 h-4 text-emerald-600" />
                      </div>
                      الهدف الاستراتيجي *
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingNewGoal(!isAddingNewGoal);
                        if (!isAddingNewGoal) setStrategicGoalId("");
                      }}
                      className="text-emerald-600 text-xs h-7"
                    >
                      <Plus className="w-3 h-3 ml-1" />
                      {isAddingNewGoal ? "اختيار من القائمة" : "إضافة جديد"}
                    </Button>
                  </div>
                  {isAddingNewGoal ? (
                    <Input
                      value={newGoalName}
                      onChange={(e) => setNewGoalName(e.target.value)}
                      placeholder="اسم الهدف الاستراتيجي الجديد"
                      className={`h-11 ${errors.strategic_goal_id ? "border-red-300" : ""}`}
                    />
                  ) : (
                    <Select
                      value={strategicGoalId}
                      onValueChange={(v) => {
                        setStrategicGoalId(v);
                        setInitiativeId("");
                        if (errors.strategic_goal_id) setErrors(prev => ({ ...prev, strategic_goal_id: "" }));
                      }}
                    >
                      <SelectTrigger className={`h-11 ${errors.strategic_goal_id ? "border-red-300" : ""}`}>
                        <SelectValue placeholder="اختر الهدف الاستراتيجي" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {strategicGoals.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: goal.color }} />
                              {goal.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.strategic_goal_id && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {errors.strategic_goal_id}
                    </span>
                  )}
                </div>

                {/* Initiative */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                      </div>
                      المبادرة
                    </label>
                    {(strategicGoalId || isAddingNewGoal) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingNewInitiative(!isAddingNewInitiative);
                          if (!isAddingNewInitiative) setInitiativeId("");
                        }}
                        className="text-amber-600 text-xs h-7"
                      >
                        <Plus className="w-3 h-3 ml-1" />
                        {isAddingNewInitiative ? "اختيار من القائمة" : "إضافة جديدة"}
                      </Button>
                    )}
                  </div>
                  {isAddingNewInitiative ? (
                    <Input
                      value={newInitiativeName}
                      onChange={(e) => setNewInitiativeName(e.target.value)}
                      placeholder="اسم المبادرة الجديدة"
                      className="h-11"
                    />
                  ) : (
                    <Select
                      value={initiativeId}
                      onValueChange={(v) => setInitiativeId(v)}
                      disabled={!strategicGoalId && !isAddingNewGoal}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={strategicGoalId || isAddingNewGoal ? "اختر المبادرة" : "اختر الهدف أولاً"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {filteredInitiatives.map((init) => (
                          <SelectItem key={init.id} value={init.id}>{init.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activities Table */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="bg-gradient-to-l from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-850 border-b border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-12 gap-0 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <div className="col-span-3 p-3 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    النشاط
                  </div>
                  <div className="col-span-2 p-3 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-orange-500" />
                    القسم
                  </div>
                  <div className="col-span-3 p-3 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-cyan-500" />
                    مسؤول التنفيذ
                  </div>
                  <div className="col-span-2 p-3 border-l border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    المستهدف السنوي
                  </div>
                  <div className="col-span-2 p-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    الشهور
                  </div>
                </div>
              </div>

              {/* Activity Rows */}
              {activities.map((activity, index) => {
                const filteredEmps = getFilteredEmployees(activity.department_id);
                const monthlySum = activity.monthlyTargets.reduce((a, b) => a + b, 0);
                const annualTargetNum = parseInt(activity.annual_target || "0");
                const isBalanced = monthlySum === annualTargetNum;

                return (
                  <div key={activity.id} className="border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                    {/* Main Row */}
                    <div className="grid grid-cols-12 gap-0 bg-white dark:bg-slate-900">
                      {/* Activity Name */}
                      <div className="col-span-3 p-2 border-l border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          {activities.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeActivity(activity.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Input
                            value={activity.activity_name}
                            onChange={(e) => {
                              updateActivity(activity.id, { activity_name: e.target.value });
                              if (errors[`activity_${index}`]) {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors[`activity_${index}`];
                                  return newErrors;
                                });
                              }
                            }}
                            placeholder="اسم النشاط *"
                            className={`text-sm h-10 ${errors[`activity_${index}`] ? "border-red-300" : ""}`}
                          />
                        </div>
                        {errors[`activity_${index}`] && (
                          <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1 mr-10">
                            <AlertTriangle className="w-3 h-3" />
                            مطلوب
                          </span>
                        )}
                      </div>

                      {/* Department */}
                      <div className="col-span-2 p-2 border-l border-slate-200 dark:border-slate-700 bg-orange-50/30 dark:bg-orange-950/10">
                        <Select
                          value={activity.department_id}
                          onValueChange={(v) => {
                            updateActivity(activity.id, { 
                              department_id: v === "none" ? "" : v,
                              responsible_employee_id: "" // Reset employee when department changes
                            });
                          }}
                        >
                          <SelectTrigger className="text-sm h-10">
                            <SelectValue placeholder="اختر القسم" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="none">بدون</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Responsible Employee */}
                      <div className="col-span-3 p-2 border-l border-slate-200 dark:border-slate-700 bg-cyan-50/30 dark:bg-cyan-950/10">
                        <Select
                          value={activity.responsible_employee_id}
                          onValueChange={(v) => updateActivity(activity.id, { responsible_employee_id: v === "none" ? "" : v })}
                          disabled={!activity.department_id}
                        >
                          <SelectTrigger className="text-sm h-10">
                            <SelectValue placeholder={activity.department_id ? "اختر مسؤول التنفيذ" : "اختر القسم أولاً"} />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="none">بدون</SelectItem>
                            {filteredEmps.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                <div className="flex flex-col">
                                  <span>{emp.full_name}</span>
                                  {emp.job_role && (
                                    <span className="text-[10px] text-slate-400">{emp.job_role}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {activity.department_id && filteredEmps.length === 0 && (
                          <span className="text-[10px] text-amber-600 mt-1 block">لا يوجد موظفون في هذا القسم</span>
                        )}
                      </div>

                      {/* Annual Target */}
                      <div className="col-span-2 p-2 border-l border-slate-200 dark:border-slate-700 bg-purple-50/30 dark:bg-purple-950/10">
                        <Input
                          type="number"
                          value={activity.annual_target}
                          onChange={(e) => {
                            updateActivity(activity.id, { annual_target: e.target.value });
                            if (errors[`annual_target_${index}`]) {
                              setErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors[`annual_target_${index}`];
                                return newErrors;
                              });
                            }
                          }}
                          placeholder="0"
                          className={`text-center font-bold text-sm h-10 ${errors[`annual_target_${index}`] ? "border-red-300" : ""}`}
                          min={1}
                        />
                        {errors[`annual_target_${index}`] && (
                          <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            مطلوب
                          </span>
                        )}
                      </div>

                      {/* Monthly Toggle */}
                      <div className="col-span-2 p-2">
                        <button
                          onClick={() => updateActivity(activity.id, { isMonthlyExpanded: !activity.isMonthlyExpanded })}
                          className="w-full h-10 flex items-center justify-between px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`font-bold ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>
                              {monthlySum}
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-slate-600">{annualTargetNum}</span>
                            {isBalanced && annualTargetNum > 0 && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                          </div>
                          {activity.isMonthlyExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Monthly Targets */}
                    {activity.isMonthlyExpanded && (
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">المستهدفات الشهرية</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => distributeEvenly(activity.id)}
                            disabled={!activity.annual_target || parseInt(activity.annual_target) <= 0}
                            className="gap-1 text-xs h-8"
                          >
                            <Sparkles className="w-3 h-3" />
                            توزيع تلقائي
                          </Button>
                        </div>
                        <div className="grid grid-cols-12 gap-3">
                          {MONTHS_AR.map((month, idx) => (
                            <div 
                              key={month} 
                              className={`p-3 rounded-lg border ${
                                idx % 2 === 0 
                                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" 
                                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <div className="text-xs text-slate-500 text-center mb-2 font-medium">{month}</div>
                              <Input
                                type="number"
                                value={activity.monthlyTargets[idx]}
                                onChange={(e) => {
                                  const newTargets = [...activity.monthlyTargets];
                                  newTargets[idx] = parseInt(e.target.value) || 0;
                                  updateActivity(activity.id, { monthlyTargets: newTargets });
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
                );
              })}

              {/* Add Activity Button */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={addActivity}
                  className="w-full h-12 border-dashed border-2 border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-2"
                >
                  <Plus className="w-5 h-5" />
                  إضافة نشاط جديد للمبادرة
                </Button>
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
