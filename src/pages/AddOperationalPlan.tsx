import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Calendar,
  Loader2,
  Save,
  Columns,
  Trash2,
  FileSpreadsheet,
  Grid3X3,
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
  strategic_goal_id: string;
  initiative_id: string;
  activity_name: string;
  department_id: string;
  responsible_employee_id: string;
  annual_target: string;
  monthlyTargets: number[];
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

  const getFilteredInitiatives = (goalId: string) => {
    if (!goalId) return [];
    return initiatives.filter(init => init.strategic_goal_id === goalId);
  };

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
      <div className="h-[calc(100vh-80px)] flex flex-col bg-slate-100 dark:bg-slate-950" dir="rtl">
        
        {/* Excel-style Toolbar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-3 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/operational-plans")}
              className="h-8 w-8"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-sm">إضافة خطة تشغيلية</span>
            </div>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
            
            {/* Year Selector */}
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <Select
                value={year.toString()}
                onValueChange={(v) => {
                  setYear(parseInt(v));
                  setActivities([createEmptyActivity()]);
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs border-slate-300">
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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManageColumnsOpen(true)}
              className="h-7 text-xs gap-1"
            >
              <Columns className="w-3.5 h-3.5" />
              الأعمدة
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/operational-plans")}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isLoading}
              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              حفظ
            </Button>
          </div>
        </div>

        {/* Excel Spreadsheet Area */}
        <div className="flex-1 overflow-auto p-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded shadow-sm min-w-[1800px]">
            
            {/* Column Headers */}
            <div className="grid grid-cols-[40px_50px_200px_180px_minmax(150px,1fr)_150px_180px_100px_repeat(12,70px)] bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600 sticky top-0 z-10">
              {/* Row Controls */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-1 flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
              </div>
              {/* Row Number */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-1 text-center text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700">
                #
              </div>
              {/* Strategic Goal */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                الهدف الاستراتيجي *
              </div>
              {/* Initiative */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                المبادرة
              </div>
              {/* Activity Name */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                النشاط *
              </div>
              {/* Department */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                القسم
              </div>
              {/* Responsible */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                مسؤول التنفيذ
              </div>
              {/* Annual Target */}
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 text-center">
                السنوي *
              </div>
              {/* Months */}
              {MONTHS_AR.map((month, idx) => (
                <div 
                  key={month}
                  className={`border-l border-slate-300 dark:border-slate-600 p-1 text-[10px] font-medium text-center ${
                    idx % 2 === 0 ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {month}
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {activities.map((activity, rowIndex) => {
              const filteredInits = getFilteredInitiatives(activity.strategic_goal_id);
              const filteredEmps = getFilteredEmployees(activity.department_id);
              const monthlySum = activity.monthlyTargets.reduce((a, b) => a + b, 0);
              const annualTargetNum = parseInt(activity.annual_target || "0");
              const hasError = errors[`goal_${rowIndex}`] || errors[`activity_${rowIndex}`] || errors[`annual_target_${rowIndex}`];

              return (
                <div 
                  key={activity.id}
                  className={`grid grid-cols-[40px_50px_200px_180px_minmax(150px,1fr)_150px_180px_100px_repeat(12,70px)] border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 ${
                    hasError ? "bg-red-50/30 dark:bg-red-950/10" : ""
                  }`}
                >
                  {/* Row Controls */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50">
                    {activities.length > 1 && (
                      <button
                        onClick={() => removeActivity(activity.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Row Number */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
                    {rowIndex + 1}
                  </div>

                  {/* Strategic Goal */}
                  <div className={`border-l border-slate-200 dark:border-slate-700 p-1 bg-emerald-50/50 dark:bg-emerald-950/20 ${errors[`goal_${rowIndex}`] ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
                    <Select
                      value={activity.strategic_goal_id}
                      onValueChange={(v) => {
                        updateActivity(activity.id, { 
                          strategic_goal_id: v === "none" ? "" : v,
                          initiative_id: "" // Reset initiative when goal changes
                        });
                        if (errors[`goal_${rowIndex}`]) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[`goal_${rowIndex}`];
                            return newErrors;
                          });
                        }
                      }}
                    >
                      <SelectTrigger className={`h-8 text-xs border-transparent hover:border-emerald-300 focus:border-emerald-400 bg-transparent ${errors[`goal_${rowIndex}`] ? "border-red-300" : ""}`}>
                        <SelectValue placeholder="اختر الهدف" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">-</SelectItem>
                        {strategicGoals.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: goal.color }} />
                              <span className="text-xs">{goal.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Initiative */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1 bg-amber-50/50 dark:bg-amber-950/20">
                    <Select
                      value={activity.initiative_id}
                      onValueChange={(v) => updateActivity(activity.id, { initiative_id: v === "none" ? "" : v })}
                      disabled={!activity.strategic_goal_id}
                    >
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-amber-300 focus:border-amber-400 bg-transparent">
                        <SelectValue placeholder={activity.strategic_goal_id ? "اختر" : "-"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">-</SelectItem>
                        {filteredInits.map((init) => (
                          <SelectItem key={init.id} value={init.id}>
                            <span className="text-xs">{init.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Activity Name */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1">
                    <Input
                      value={activity.activity_name}
                      onChange={(e) => {
                        updateActivity(activity.id, { activity_name: e.target.value });
                        if (errors[`activity_${rowIndex}`]) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[`activity_${rowIndex}`];
                            return newErrors;
                          });
                        }
                      }}
                      placeholder="اسم النشاط"
                      className={`h-8 text-xs border-transparent hover:border-slate-300 focus:border-blue-400 bg-transparent ${
                        errors[`activity_${rowIndex}`] ? "border-red-300 bg-red-50 dark:bg-red-950/30" : ""
                      }`}
                    />
                  </div>

                  {/* Department */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1">
                    <Select
                      value={activity.department_id}
                      onValueChange={(v) => {
                        updateActivity(activity.id, { 
                          department_id: v === "none" ? "" : v,
                          responsible_employee_id: ""
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-slate-300 focus:border-blue-400 bg-transparent">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">-</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            <span className="text-xs">{dept.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Responsible Employee */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1">
                    <Select
                      value={activity.responsible_employee_id}
                      onValueChange={(v) => updateActivity(activity.id, { responsible_employee_id: v === "none" ? "" : v })}
                      disabled={!activity.department_id}
                    >
                      <SelectTrigger className="h-8 text-xs border-transparent hover:border-slate-300 focus:border-blue-400 bg-transparent">
                        <SelectValue placeholder={activity.department_id ? "-" : "اختر القسم"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="none">-</SelectItem>
                        {filteredEmps.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            <span className="text-xs">{emp.full_name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Annual Target */}
                  <div className="border-l border-slate-200 dark:border-slate-700 p-1 relative group bg-purple-50/50 dark:bg-purple-950/20">
                    <Input
                      type="number"
                      value={activity.annual_target}
                      onChange={(e) => {
                        updateActivity(activity.id, { annual_target: e.target.value });
                        if (errors[`annual_target_${rowIndex}`]) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors[`annual_target_${rowIndex}`];
                            return newErrors;
                          });
                        }
                      }}
                      placeholder="0"
                      min={1}
                      className={`h-8 text-xs text-center font-semibold border-transparent hover:border-purple-300 focus:border-purple-400 bg-transparent ${
                        errors[`annual_target_${rowIndex}`] ? "border-red-300 bg-red-50 dark:bg-red-950/30" : ""
                      }`}
                    />
                    {activity.annual_target && parseInt(activity.annual_target) > 0 && (
                      <button
                        onClick={() => distributeEvenly(activity.id)}
                        className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-500 text-white px-1 py-0.5 rounded text-[8px]"
                        title="توزيع تلقائي"
                      >
                        توزيع
                      </button>
                    )}
                  </div>

                  {/* Monthly Targets */}
                  {activity.monthlyTargets.map((monthTarget, monthIdx) => (
                    <div 
                      key={monthIdx}
                      className={`border-l border-slate-200 dark:border-slate-700 p-0.5 ${
                        monthIdx % 2 === 0 ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
                      }`}
                    >
                      <Input
                        type="number"
                        value={monthTarget || ""}
                        onChange={(e) => {
                          const newTargets = [...activity.monthlyTargets];
                          newTargets[monthIdx] = parseInt(e.target.value) || 0;
                          updateActivity(activity.id, { monthlyTargets: newTargets });
                        }}
                        min={0}
                        placeholder="0"
                        className="h-8 text-[10px] text-center border-transparent hover:border-slate-300 focus:border-blue-400 bg-transparent font-medium"
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Add Row Button */}
            <div className="grid grid-cols-[40px_50px_200px_180px_minmax(150px,1fr)_150px_180px_100px_repeat(12,70px)] border-b border-slate-200 dark:border-slate-700">
              <div className="col-span-2 bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700" />
              <div className="col-span-18 p-1">
                <button
                  onClick={addActivity}
                  className="w-full h-8 flex items-center justify-center gap-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded border border-dashed border-blue-300 dark:border-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة صف جديد
                </button>
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-[40px_50px_200px_180px_minmax(150px,1fr)_150px_180px_100px_repeat(12,70px)] bg-slate-100 dark:bg-slate-800/80">
              <div className="col-span-7 border-l border-slate-300 dark:border-slate-600 p-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400 text-left">
                المجموع
              </div>
              <div className="border-l border-slate-300 dark:border-slate-600 p-2 text-center text-xs font-bold text-purple-700 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-950/40">
                {activities.reduce((sum, act) => sum + (parseInt(act.annual_target) || 0), 0)}
              </div>
              {MONTHS_AR.map((_, monthIdx) => {
                const monthTotal = activities.reduce((sum, act) => sum + act.monthlyTargets[monthIdx], 0);
                return (
                  <div 
                    key={monthIdx}
                    className={`border-l border-slate-300 dark:border-slate-600 p-2 text-center text-[10px] font-bold ${
                      monthIdx % 2 === 0 ? "bg-blue-100/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {monthTotal}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>الأنشطة: {activities.length}</span>
            <span>إجمالي المستهدف: {activities.reduce((sum, act) => sum + (parseInt(act.annual_target) || 0), 0)}</span>
          </div>
          <div className="flex items-center gap-4">
            {(() => {
              const totalAnnual = activities.reduce((sum, act) => sum + (parseInt(act.annual_target) || 0), 0);
              const totalMonthly = activities.reduce((sum, act) => sum + act.monthlyTargets.reduce((a, b) => a + b, 0), 0);
              const isBalanced = totalAnnual === totalMonthly && totalAnnual > 0;
              return (
                <span className={isBalanced ? "text-emerald-600" : "text-amber-600"}>
                  {isBalanced ? "✓ التوزيع متوازن" : `⚠ الفرق: ${Math.abs(totalAnnual - totalMonthly)}`}
                </span>
              );
            })()}
          </div>
        </div>
      </div>

      <ManageCustomColumnsDialog
        open={isManageColumnsOpen}
        onOpenChange={setIsManageColumnsOpen}
        onColumnsChange={() => {}}
      />
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
