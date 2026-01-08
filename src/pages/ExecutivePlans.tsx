import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Target,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  LayoutGrid,
  List,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  full_name: string;
  user_id: string | null;
}

interface OperationalPlan {
  id: string;
  activity_name: string;
  annual_target: number;
  user_id: string;
  strategic_goal: string | null;
  initiative: string | null;
}

interface OperationalPlanMonth {
  id: string;
  operational_plan_id: string;
  month: number;
  monthly_target: number;
}

interface ExecutivePlan {
  id: string;
  operational_plan_month_id: string;
  day: number;
  daily_target: number;
  achieved: number;
  status: string;
  notes: string | null;
}

interface DayData {
  day: number;
  plans: {
    activityName: string;
    dailyTarget: number;
    achieved: number;
    status: string;
    executivePlanId?: string;
    operationalPlanMonthId: string;
    notes?: string;
  }[];
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const STATUS_CONFIG = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  in_progress: { label: "قيد التنفيذ", color: "bg-blue-100 text-blue-700 border-blue-300" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-700 border-green-300" },
  overdue: { label: "متأخر", color: "bg-red-100 text-red-700 border-red-300" },
};

export default function ExecutivePlans() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear] = useState<number>(new Date().getFullYear());
  
  const [operationalPlans, setOperationalPlans] = useState<OperationalPlan[]>([]);
  const [planMonths, setPlanMonths] = useState<OperationalPlanMonth[]>([]);
  const [executivePlans, setExecutivePlans] = useState<ExecutivePlan[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // التحقق من صلاحية المدير
  useEffect(() => {
    const checkAdmin = async () => {
      if (!authUser) return;
      const { data } = await supabase.rpc("has_role", { _user_id: authUser.id, _role: "admin" });
      setIsAdmin(data === true);
    };
    checkAdmin();
  }, [authUser]);

  // جلب الموظفين
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!authUser) return;
      
      if (!isAdmin) {
        // الموظف يرى خططه فقط
        setSelectedEmployeeId(authUser.id);
        return;
      }
      
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, user_id")
        .eq("status", "active");
      
      if (error) {
        toast({ title: "خطأ", description: "فشل في جلب الموظفين", variant: "destructive" });
        return;
      }
      
      setEmployees(data || []);
      if (data && data.length > 0) {
        setSelectedEmployeeId(data[0].user_id || "");
      }
    };
    
    fetchEmployees();
  }, [isAdmin, authUser]);

  // جلب الخطط التشغيلية والتنفيذية
  useEffect(() => {
    const fetchPlans = async () => {
      if (!selectedEmployeeId) return;
      
      setLoading(true);
      try {
        // جلب الخطط التشغيلية للموظف
        const { data: plans, error: plansError } = await supabase
          .from("operational_plans")
          .select("*")
          .eq("user_id", selectedEmployeeId)
          .eq("year", selectedYear);
        
        if (plansError) throw plansError;
        setOperationalPlans(plans || []);
        
        if (!plans || plans.length === 0) {
          setPlanMonths([]);
          setExecutivePlans([]);
          setLoading(false);
          return;
        }
        
        // جلب أشهر الخطط
        const planIds = plans.map(p => p.id);
        const { data: months, error: monthsError } = await supabase
          .from("operational_plan_months")
          .select("*")
          .in("operational_plan_id", planIds)
          .eq("month", selectedMonth);
        
        if (monthsError) throw monthsError;
        setPlanMonths(months || []);
        
        // جلب الخطط التنفيذية
        if (months && months.length > 0) {
          const monthIds = months.map(m => m.id);
          const { data: executive, error: execError } = await supabase
            .from("executive_plans")
            .select("*")
            .in("operational_plan_month_id", monthIds);
          
          if (execError) throw execError;
          setExecutivePlans(executive || []);
        } else {
          setExecutivePlans([]);
        }
      } catch (error: any) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlans();
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  // حساب أيام الشهر
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth - 1, 1).getDay();
  }, [selectedYear, selectedMonth]);

  // بناء بيانات التقويم
  const calendarData = useMemo(() => {
    const data: DayData[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayPlans: DayData["plans"] = [];
      
      planMonths.forEach(pm => {
        const plan = operationalPlans.find(p => p.id === pm.operational_plan_id);
        if (!plan) return;
        
        const execPlan = executivePlans.find(
          ep => ep.operational_plan_month_id === pm.id && ep.day === day
        );
        
        if (execPlan) {
          dayPlans.push({
            activityName: plan.activity_name,
            dailyTarget: execPlan.daily_target,
            achieved: execPlan.achieved,
            status: execPlan.status,
            executivePlanId: execPlan.id,
            operationalPlanMonthId: pm.id,
            notes: execPlan.notes || undefined,
          });
        }
      });
      
      data.push({ day, plans: dayPlans });
    }
    
    return data;
  }, [daysInMonth, planMonths, operationalPlans, executivePlans]);

  // إحصائيات
  const stats = useMemo(() => {
    const totalTarget = executivePlans.reduce((sum, ep) => sum + ep.daily_target, 0);
    const totalAchieved = executivePlans.reduce((sum, ep) => sum + ep.achieved, 0);
    const completedDays = executivePlans.filter(ep => ep.status === "completed").length;
    const pendingDays = executivePlans.filter(ep => ep.status === "pending").length;
    
    return { totalTarget, totalAchieved, completedDays, pendingDays };
  }, [executivePlans]);

  // توليد الخطط التنفيذية تلقائياً
  const generateExecutivePlans = async () => {
    if (planMonths.length === 0) {
      toast({ title: "تنبيه", description: "لا توجد خطط تشغيلية لهذا الشهر", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    try {
      const plansToInsert: any[] = [];
      
      planMonths.forEach(pm => {
        const monthlyTarget = pm.monthly_target;
        if (monthlyTarget <= 0) return;
        
        // توزيع متساوي على 4 أيام في الشهر (كل أسبوع يوم)
        const daysToDistribute = [1, 8, 15, 22];
        const dailyTarget = Math.ceil(monthlyTarget / 4);
        
        daysToDistribute.forEach((day, index) => {
          // تجنب التكرار
          const exists = executivePlans.find(
            ep => ep.operational_plan_month_id === pm.id && ep.day === day
          );
          
          if (!exists && day <= daysInMonth) {
            // آخر يوم يأخذ الباقي
            const target = index === 3 
              ? monthlyTarget - (dailyTarget * 3) 
              : dailyTarget;
            
            plansToInsert.push({
              operational_plan_month_id: pm.id,
              day,
              daily_target: Math.max(target, 0),
              achieved: 0,
              status: "pending",
            });
          }
        });
      });
      
      if (plansToInsert.length === 0) {
        toast({ title: "تنبيه", description: "الخطط التنفيذية موجودة بالفعل", variant: "default" });
        setIsGenerating(false);
        return;
      }
      
      const { error } = await supabase
        .from("executive_plans")
        .insert(plansToInsert);
      
      if (error) throw error;
      
      toast({ title: "تم!", description: `تم توليد ${plansToInsert.length} خطة تنفيذية` });
      
      // إعادة جلب البيانات
      const monthIds = planMonths.map(m => m.id);
      const { data: newExecutive } = await supabase
        .from("executive_plans")
        .select("*")
        .in("operational_plan_month_id", monthIds);
      
      setExecutivePlans(newExecutive || []);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // تحديث حالة أو إنجاز خطة
  const updateExecutivePlan = async (planId: string, updates: Partial<ExecutivePlan>) => {
    try {
      const { error } = await supabase
        .from("executive_plans")
        .update(updates)
        .eq("id", planId);
      
      if (error) throw error;
      
      setExecutivePlans(prev => 
        prev.map(ep => ep.id === planId ? { ...ep, ...updates } : ep)
      );
      
      toast({ title: "تم التحديث بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const getSelectedEmployee = () => {
    return employees.find(e => e.user_id === selectedEmployeeId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              الخطط التنفيذية
            </h1>
            <p className="text-muted-foreground mt-2">
              متابعة وتوزيع المستهدفات الشهرية على الأيام
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* اختيار وضع العرض */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="gap-1"
              >
                <LayoutGrid className="w-4 h-4" />
                تقويم
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1"
              >
                <List className="w-4 h-4" />
                قائمة
              </Button>
            </div>
            
            <Button
              onClick={generateExecutivePlans}
              disabled={isGenerating || planMonths.length === 0}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? "جاري التوليد..." : "توليد تلقائي"}
            </Button>
          </div>
        </div>

        {/* الفلاتر */}
        <Card className="bg-gradient-to-r from-[#3d9aa8]/5 to-[#2d7a85]/5 border-[#3d9aa8]/20">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* اختيار الموظف */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-[#3d9aa8]" />
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="w-[200px] bg-white">
                      <SelectValue placeholder="اختر الموظف" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.user_id || emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* اختيار الشهر */}
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#3d9aa8]" />
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[150px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {MONTHS_AR.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* معلومات الموظف المختار */}
              {getSelectedEmployee() && (
                <div className="flex items-center gap-2 mr-auto bg-white rounded-lg px-4 py-2 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white font-bold text-sm">
                    {getSelectedEmployee()?.full_name.charAt(0)}
                  </div>
                  <span className="font-medium">{getSelectedEmployee()?.full_name}</span>
                  <span className="text-muted-foreground">- {MONTHS_AR[selectedMonth - 1]} {selectedYear}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* الإحصائيات */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">المستهدف الشهري</p>
                <p className="text-2xl font-bold text-blue-700">{stats.totalTarget}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">المنجز</p>
                <p className="text-2xl font-bold text-green-700">{stats.totalAchieved}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-600">أيام مكتملة</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.completedDays}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">أيام معلقة</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pendingDays}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* المحتوى الرئيسي */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-[#3d9aa8] border-t-transparent rounded-full" />
          </div>
        ) : operationalPlans.length === 0 ? (
          <Card className="py-20">
            <CardContent className="text-center">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد خطط تشغيلية</h3>
              <p className="text-muted-foreground">
                لا توجد خطط تشغيلية لهذا الموظف في هذه السنة
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "calendar" ? (
          /* عرض التقويم */
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#3d9aa8] to-[#4A9BA8] text-white rounded-t-lg">
              <CardTitle className="flex items-center justify-between">
                <span>{MONTHS_AR[selectedMonth - 1]} {selectedYear}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setSelectedMonth(m => m > 1 ? m - 1 : 12)}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setSelectedMonth(m => m < 12 ? m + 1 : 1)}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* أيام الأسبوع */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS_AR.map(day => (
                  <div key={day} className="text-center py-2 font-bold text-sm text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* أيام الشهر */}
              <div className="grid grid-cols-7 gap-2">
                {/* فراغات بداية الشهر */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {/* أيام الشهر */}
                {calendarData.map(dayData => {
                  const hasPlans = dayData.plans.length > 0;
                  const isToday = new Date().getDate() === dayData.day && 
                                  new Date().getMonth() + 1 === selectedMonth;
                  const allCompleted = hasPlans && dayData.plans.every(p => p.status === "completed");
                  const hasPending = dayData.plans.some(p => p.status === "pending");
                  
                  return (
                    <div
                      key={dayData.day}
                      onClick={() => {
                        if (hasPlans) {
                          setSelectedDay(dayData);
                          setIsDialogOpen(true);
                        }
                      }}
                      className={cn(
                        "aspect-square rounded-xl border-2 p-2 transition-all cursor-pointer hover:scale-105 hover:shadow-lg relative overflow-hidden",
                        isToday && "ring-2 ring-[#3d9aa8] ring-offset-2",
                        hasPlans 
                          ? allCompleted 
                            ? "bg-gradient-to-br from-green-50 to-green-100 border-green-300" 
                            : hasPending 
                              ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300"
                              : "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300"
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {/* رقم اليوم */}
                      <span className={cn(
                        "absolute top-1 right-2 font-bold text-lg",
                        isToday ? "text-[#3d9aa8]" : hasPlans ? "text-gray-700" : "text-gray-400"
                      )}>
                        {dayData.day}
                      </span>
                      
                      {/* مؤشر المهام */}
                      {hasPlans && (
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-gray-600">
                              {dayData.plans.length} مهمة
                            </span>
                            {allCompleted && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                allCompleted ? "bg-green-500" : "bg-[#3d9aa8]"
                              )}
                              style={{ 
                                width: `${(dayData.plans.filter(p => p.status === "completed").length / dayData.plans.length) * 100}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* عرض القائمة */
          <Card>
            <CardHeader>
              <CardTitle>قائمة الخطط التنفيذية - {MONTHS_AR[selectedMonth - 1]}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {calendarData.filter(d => d.plans.length > 0).map(dayData => (
                  <div
                    key={dayData.day}
                    className="border rounded-xl p-4 bg-gradient-to-r from-white to-gray-50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white font-bold text-lg">
                          {dayData.day}
                        </div>
                        <div>
                          <p className="font-bold">{WEEKDAYS_AR[new Date(selectedYear, selectedMonth - 1, dayData.day).getDay()]}</p>
                          <p className="text-sm text-muted-foreground">{dayData.day} {MONTHS_AR[selectedMonth - 1]}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[#3d9aa8] border-[#3d9aa8]">
                        {dayData.plans.length} مهمة
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {dayData.plans.map((plan, idx) => {
                        const statusConfig = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                        return (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <Target className="w-5 h-5 text-[#3d9aa8]" />
                              <span className="font-medium">{plan.activityName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm">
                                <span className="font-bold text-[#3d9aa8]">{plan.achieved}</span>
                                <span className="text-muted-foreground"> / {plan.dailyTarget}</span>
                              </span>
                              <Badge className={statusConfig.color}>
                                {statusConfig.label}
                              </Badge>
                              {plan.executivePlanId && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedDay(dayData);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {calendarData.filter(d => d.plans.length > 0).length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد خطط تنفيذية بعد</p>
                    <p className="text-sm">اضغط على "توليد تلقائي" لإنشاء الخطط</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dialog تفاصيل اليوم */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white font-bold">
                  {selectedDay?.day}
                </div>
                <div>
                  <span>يوم {selectedDay?.day} {MONTHS_AR[selectedMonth - 1]}</span>
                  <p className="text-sm font-normal text-muted-foreground">
                    {selectedDay && WEEKDAYS_AR[new Date(selectedYear, selectedMonth - 1, selectedDay.day).getDay()]}
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {selectedDay?.plans.map((plan, idx) => {
                const statusConfig = STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                return (
                  <div key={idx} className="border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lg">{plan.activityName}</h4>
                      <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-sm text-muted-foreground">المستهدف</p>
                        <p className="text-2xl font-bold text-[#3d9aa8]">{plan.dailyTarget}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-sm text-muted-foreground">المنجز</p>
                        <Input
                          type="number"
                          value={plan.achieved}
                          onChange={(e) => {
                            if (plan.executivePlanId) {
                              const newValue = parseInt(e.target.value) || 0;
                              updateExecutivePlan(plan.executivePlanId, { 
                                achieved: newValue,
                                status: newValue >= plan.dailyTarget ? "completed" : "in_progress"
                              });
                            }
                          }}
                          className="text-2xl font-bold text-center h-12"
                        />
                      </div>
                    </div>
                    
                    {/* شريط التقدم */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>نسبة الإنجاز</span>
                        <span className="font-bold">
                          {plan.dailyTarget > 0 ? Math.round((plan.achieved / plan.dailyTarget) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#3d9aa8] to-[#2d7a85] rounded-full transition-all"
                          style={{ 
                            width: `${Math.min((plan.achieved / plan.dailyTarget) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* أزرار الحالة */}
                    {plan.executivePlanId && (
                      <div className="flex gap-2">
                        {["pending", "in_progress", "completed"].map(status => (
                          <Button
                            key={status}
                            variant={plan.status === status ? "default" : "outline"}
                            size="sm"
                            className={plan.status === status ? "bg-[#3d9aa8]" : ""}
                            onClick={() => updateExecutivePlan(plan.executivePlanId!, { status })}
                          >
                            {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
