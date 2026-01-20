import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowRight,
  Plus,
  Calendar,
  Loader2,
  Save,
  Trash2,
  Target,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Activity,
  Users,
  Building2,
  BarChart3,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAvailableYears } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  strategic_goal_id: string;
  initiative_id: string;
  activity_name: string;
  department_id: string;
  responsible_employee_id: string;
  annual_target: string;
  monthlyTargets: number[];
  isMonthlyOpen: boolean;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const createEmptyActivity = (): ActivityRow => ({
  id: crypto.randomUUID(),
  strategic_goal_id: "",
  initiative_id: "",
  activity_name: "",
  department_id: "",
  responsible_employee_id: "",
  annual_target: "",
  monthlyTargets: Array(12).fill(0),
  isMonthlyOpen: false,
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
  const [activities, setActivities] = useState<ActivityRow[]>([createEmptyActivity()]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dialog states for adding new goal/initiative
  const [showNewGoalDialog, setShowNewGoalDialog] = useState(false);
  const [showNewInitiativeDialog, setShowNewInitiativeDialog] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [isAddingInitiative, setIsAddingInitiative] = useState(false);

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

  const getFilteredInitiatives = (goalId: string) => {
    if (!goalId) return [];
    return initiatives.filter(init => init.strategic_goal_id === goalId);
  };

  const getFilteredEmployees = (departmentId: string) => {
    if (!departmentId) return employees;
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

  const toggleMonthlySection = (id: string) => {
    updateActivity(id, { isMonthlyOpen: !activities.find(a => a.id === id)?.isMonthlyOpen });
  };

  const handleAddNewGoal = async () => {
    if (!newGoalName.trim()) return;
    
    setIsAddingGoal(true);
    try {
      const { data: newGoal, error } = await supabase
        .from("strategic_goals")
        .insert({
          name: newGoalName.trim(),
          color: "#3d9aa8",
          year: year,
        })
        .select()
        .single();

      if (error) throw error;

      setStrategicGoals(prev => [...prev, newGoal]);
      
      if (pendingActivityId) {
        updateActivity(pendingActivityId, { strategic_goal_id: newGoal.id, initiative_id: "" });
      }

      toast({ title: "تم إضافة الهدف الاستراتيجي بنجاح" });
      setShowNewGoalDialog(false);
      setNewGoalName("");
      setPendingActivityId(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة الهدف",
        variant: "destructive",
      });
    } finally {
      setIsAddingGoal(false);
    }
  };

  const handleAddNewInitiative = async () => {
    if (!newInitiativeName.trim() || !pendingGoalId) return;
    
    setIsAddingInitiative(true);
    try {
      const { data: newInit, error } = await supabase
        .from("initiatives")
        .insert({
          strategic_goal_id: pendingGoalId,
          name: newInitiativeName.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setInitiatives(prev => [...prev, newInit]);
      
      if (pendingActivityId) {
        updateActivity(pendingActivityId, { initiative_id: newInit.id });
      }

      toast({ title: "تم إضافة المبادرة بنجاح" });
      setShowNewInitiativeDialog(false);
      setNewInitiativeName("");
      setPendingActivityId(null);
      setPendingGoalId(null);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة المبادرة",
        variant: "destructive",
      });
    } finally {
      setIsAddingInitiative(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    activities.forEach((activity, index) => {
      if (!activity.strategic_goal_id) {
        newErrors[`goal_${index}`] = "مطلوب";
      }
      if (!activity.activity_name.trim()) {
        newErrors[`activity_${index}`] = "مطلوب";
      }
      if (!activity.annual_target || parseInt(activity.annual_target) <= 0) {
        newErrors[`annual_target_${index}`] = "مطلوب";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !authUser) return;

    setIsLoading(true);
    try {
      for (const activity of activities) {
        const goal = strategicGoals.find(g => g.id === activity.strategic_goal_id);
        const init = initiatives.find(i => i.id === activity.initiative_id);

        const { data: plan, error: planError } = await supabase
          .from("operational_plans")
          .insert({
            user_id: authUser.id,
            activity_name: activity.activity_name.trim(),
            strategic_goal: goal?.name || "",
            strategic_goal_id: activity.strategic_goal_id || null,
            initiative: init?.name || null,
            initiative_id: activity.initiative_id || null,
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

  const getMonthlySum = (targets: number[]) => targets.reduce((a, b) => a + b, 0);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" dir="rtl">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/operational-plans")}
                  className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">إضافة خطة تشغيلية</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">أضف أنشطة جديدة للخطة التشغيلية</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Year Selector */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <Select
                    value={year.toString()}
                    onValueChange={(v) => {
                      setYear(parseInt(v));
                      setActivities([createEmptyActivity()]);
                    }}
                  >
                    <SelectTrigger className="h-8 w-24 border-0 bg-transparent text-sm font-medium">
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
                  onClick={() => navigate("/operational-plans")}
                  disabled={isLoading}
                  className="rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الخطة
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{activities.length}</p>
                  <p className="text-sm text-slate-500">نشاط</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {activities.reduce((sum, a) => sum + (parseInt(a.annual_target) || 0), 0)}
                  </p>
                  <p className="text-sm text-slate-500">إجمالي المستهدف</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {new Set(activities.filter(a => a.initiative_id).map(a => a.initiative_id)).size}
                  </p>
                  <p className="text-sm text-slate-500">مبادرة</p>
                </div>
              </div>
            </div>
          </div>

          {/* Activities List */}
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {activities.map((activity, index) => {
                const filteredInits = getFilteredInitiatives(activity.strategic_goal_id);
                const filteredEmps = getFilteredEmployees(activity.department_id);
                const selectedGoal = strategicGoals.find(g => g.id === activity.strategic_goal_id);
                const hasError = errors[`goal_${index}`] || errors[`activity_${index}`] || errors[`annual_target_${index}`];
                const monthlySum = getMonthlySum(activity.monthlyTargets);
                const annualTarget = parseInt(activity.annual_target) || 0;

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden",
                      hasError 
                        ? "border-red-300 dark:border-red-800" 
                        : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    {/* Activity Header */}
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <GripVertical className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {activity.activity_name || "نشاط جديد"}
                        </span>
                        {selectedGoal && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            style={{ backgroundColor: `${selectedGoal.color}20`, color: selectedGoal.color }}
                          >
                            {selectedGoal.name}
                          </Badge>
                        )}
                      </div>
                      {activities.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeActivity(activity.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Activity Content */}
                    <div className="p-5 space-y-5">
                      {/* Row 1: Goal & Initiative */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Target className="w-4 h-4 text-emerald-500" />
                            الهدف الاستراتيجي
                            <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={activity.strategic_goal_id}
                            onValueChange={(value) => {
                              if (value === "__new__") {
                                setPendingActivityId(activity.id);
                                setShowNewGoalDialog(true);
                              } else {
                                updateActivity(activity.id, { strategic_goal_id: value, initiative_id: "" });
                              }
                            }}
                          >
                            <SelectTrigger className={cn(
                              "h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
                              errors[`goal_${index}`] && "border-red-500"
                            )}>
                              <SelectValue placeholder="اختر الهدف الاستراتيجي" />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {strategicGoals.map((goal) => (
                                <SelectItem key={goal.id} value={goal.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: goal.color }} />
                                    {goal.name}
                                  </div>
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__" className="text-emerald-600">
                                <div className="flex items-center gap-2">
                                  <Plus className="w-4 h-4" />
                                  إضافة هدف جديد
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            المبادرة
                          </Label>
                          <Select
                            value={activity.initiative_id}
                            onValueChange={(value) => {
                              if (value === "__new__") {
                                setPendingActivityId(activity.id);
                                setPendingGoalId(activity.strategic_goal_id);
                                setShowNewInitiativeDialog(true);
                              } else {
                                updateActivity(activity.id, { initiative_id: value });
                              }
                            }}
                            disabled={!activity.strategic_goal_id}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                              <SelectValue placeholder={activity.strategic_goal_id ? "اختر المبادرة" : "اختر الهدف أولاً"} />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {filteredInits.map((init) => (
                                <SelectItem key={init.id} value={init.id}>{init.name}</SelectItem>
                              ))}
                              {activity.strategic_goal_id && (
                                <SelectItem value="__new__" className="text-amber-600">
                                  <div className="flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    إضافة مبادرة جديدة
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Row 2: Activity Name & Annual Target */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Activity className="w-4 h-4 text-blue-500" />
                            اسم النشاط
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={activity.activity_name}
                            onChange={(e) => updateActivity(activity.id, { activity_name: e.target.value })}
                            placeholder="أدخل اسم النشاط"
                            className={cn(
                              "h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
                              errors[`activity_${index}`] && "border-red-500"
                            )}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <BarChart3 className="w-4 h-4 text-purple-500" />
                            المستهدف السنوي
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            value={activity.annual_target}
                            onChange={(e) => updateActivity(activity.id, { annual_target: e.target.value })}
                            placeholder="0"
                            className={cn(
                              "h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-center font-bold text-lg",
                              errors[`annual_target_${index}`] && "border-red-500"
                            )}
                          />
                        </div>
                      </div>

                      {/* Row 3: Department & Employee */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            القسم
                          </Label>
                          <Select
                            value={activity.department_id}
                            onValueChange={(value) => updateActivity(activity.id, { department_id: value, responsible_employee_id: "" })}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                              <SelectValue placeholder="اختر القسم" />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-medium">
                            <Users className="w-4 h-4 text-slate-500" />
                            مسؤول التنفيذ
                          </Label>
                          <Select
                            value={activity.responsible_employee_id}
                            onValueChange={(value) => updateActivity(activity.id, { responsible_employee_id: value })}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                              <SelectValue placeholder="اختر الموظف المسؤول" />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {filteredEmps.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{emp.full_name}</span>
                                    {emp.job_role && (
                                      <span className="text-xs text-slate-400">({emp.job_role})</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Monthly Targets (Collapsible) */}
                      <Collapsible open={activity.isMonthlyOpen} onOpenChange={() => toggleMonthlySection(activity.id)}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-between h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">المستهدفات الشهرية</span>
                              {monthlySum > 0 && (
                                <Badge variant={monthlySum === annualTarget ? "default" : "destructive"} className="text-xs">
                                  {monthlySum === annualTarget ? `✓ متطابق (${monthlySum})` : `غير متطابق: ${monthlySum} / ${annualTarget}`}
                                </Badge>
                              )}
                            </div>
                            {activity.isMonthlyOpen ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-500">توزيع المستهدف على الأشهر</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => distributeEvenly(activity.id)}
                                disabled={!activity.annual_target}
                                className="gap-2 rounded-lg text-xs"
                              >
                                <Sparkles className="w-3 h-3" />
                                توزيع تلقائي
                              </Button>
                            </div>
                            <div className="grid grid-cols-6 gap-3">
                              {MONTHS_AR.map((month, idx) => (
                                <div key={month} className="space-y-1">
                                  <Label className="text-xs text-slate-500 text-center block">{month}</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={activity.monthlyTargets[idx] || ""}
                                    onChange={(e) => {
                                      const newTargets = [...activity.monthlyTargets];
                                      newTargets[idx] = parseInt(e.target.value) || 0;
                                      updateActivity(activity.id, { monthlyTargets: newTargets });
                                    }}
                                    className="h-9 rounded-lg text-center text-sm bg-slate-50 dark:bg-slate-800/50"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add Activity Button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={addActivity}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all duration-200 flex items-center justify-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
              </div>
              <span className="font-medium text-slate-500 group-hover:text-emerald-600">إضافة نشاط جديد</span>
            </motion.button>
          </div>
        </div>

        {/* Add Goal Dialog */}
        <Dialog open={showNewGoalDialog} onOpenChange={setShowNewGoalDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" />
                إضافة هدف استراتيجي جديد
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>اسم الهدف</Label>
              <Input
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                placeholder="أدخل اسم الهدف الاستراتيجي"
                className="mt-2"
                onKeyDown={(e) => e.key === "Enter" && handleAddNewGoal()}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowNewGoalDialog(false)}>إلغاء</Button>
              <Button 
                onClick={handleAddNewGoal} 
                disabled={isAddingGoal || !newGoalName.trim()}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                {isAddingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Initiative Dialog */}
        <Dialog open={showNewInitiativeDialog} onOpenChange={setShowNewInitiativeDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                إضافة مبادرة جديدة
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label>اسم المبادرة</Label>
              <Input
                value={newInitiativeName}
                onChange={(e) => setNewInitiativeName(e.target.value)}
                placeholder="أدخل اسم المبادرة"
                className="mt-2"
                onKeyDown={(e) => e.key === "Enter" && handleAddNewInitiative()}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowNewInitiativeDialog(false)}>إلغاء</Button>
              <Button 
                onClick={handleAddNewInitiative} 
                disabled={isAddingInitiative || !newInitiativeName.trim()}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isAddingInitiative ? <Loader2 className="w-4 h-4 animate-spin" /> : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
