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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown,
  Calendar,
  User,
  Target,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  ListTodo,
  CalendarDays,
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

interface ExecutivePlanWithDetails extends ExecutivePlan {
  activityName: string;
  month: number;
  monthlyTarget: number;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const WEEKDAYS_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
];

// تحويل التاريخ الميلادي إلى هجري (تقريبي)
function toHijri(date: Date): { day: number; month: number; year: number; monthName: string } {
  const gregorianYear = date.getFullYear();
  const gregorianMonth = date.getMonth() + 1;
  const gregorianDay = date.getDate();
  
  // صيغة تقريبية للتحويل
  const jd = Math.floor((1461 * (gregorianYear + 4800 + Math.floor((gregorianMonth - 14) / 12))) / 4) +
             Math.floor((367 * (gregorianMonth - 2 - 12 * Math.floor((gregorianMonth - 14) / 12))) / 12) -
             Math.floor((3 * Math.floor((gregorianYear + 4900 + Math.floor((gregorianMonth - 14) / 12)) / 100)) / 4) +
             gregorianDay - 32075;
  
  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
            Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
             Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hijriMonth = Math.floor((24 * l3) / 709);
  const hijriDay = l3 - Math.floor((709 * hijriMonth) / 24);
  const hijriYear = 30 * n + j - 30;
  
  return {
    day: hijriDay,
    month: hijriMonth,
    year: hijriYear,
    monthName: HIJRI_MONTHS[hijriMonth - 1] || ""
  };
}

function formatHijriDate(date: Date): string {
  const hijri = toHijri(date);
  return `${hijri.day} ${hijri.monthName} ${hijri.year}هـ`;
}

function formatGregorianDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}م`;
}

// تنسيق التاريخ الهجري المختصر (يوم وشهر فقط)
function formatHijriShort(date: Date): string {
  const hijri = toHijri(date);
  return `${hijri.day} ${hijri.monthName}`;
}

// تنسيق التاريخ الميلادي المختصر (يوم وشهر فقط)
function formatGregorianShort(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

export default function ExecutivePlans() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedYear] = useState<number>(new Date().getFullYear());
  
  const [operationalPlans, setOperationalPlans] = useState<OperationalPlan[]>([]);
  const [planMonths, setPlanMonths] = useState<OperationalPlanMonth[]>([]);
  const [executivePlans, setExecutivePlans] = useState<ExecutivePlan[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<Record<number, "tasks" | "dates">>({});
  
  // حالة نافذة الإضافة
  const [selectedPlanMonthId, setSelectedPlanMonthId] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [addingMonth, setAddingMonth] = useState<number>(1);

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

  // جلب جميع الخطط
  useEffect(() => {
    const fetchAllPlans = async () => {
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
        
        // جلب جميع أشهر الخطط
        const planIds = plans.map(p => p.id);
        const { data: months, error: monthsError } = await supabase
          .from("operational_plan_months")
          .select("*")
          .in("operational_plan_id", planIds)
          .order("month", { ascending: true });
        
        if (monthsError) throw monthsError;
        setPlanMonths(months || []);
        
        // جلب الخطط التنفيذية
        if (months && months.length > 0) {
          const monthIds = months.map(m => m.id);
          const { data: executive, error: execError } = await supabase
            .from("executive_plans")
            .select("*")
            .in("operational_plan_month_id", monthIds)
            .order("day", { ascending: true });
          
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
    
    fetchAllPlans();
  }, [selectedEmployeeId, selectedYear]);

  // تجميع الخطط التنفيذية حسب الشهر والمهمة
  const groupedPlans = useMemo(() => {
    const groups: {
      month: number;
      monthName: string;
      activities: {
        activityName: string;
        planMonthId: string;
        monthlyTarget: number;
        days: {
          id: string;
          day: number;
          dailyTarget: number;
          achieved: number;
          status: string;
          gregorianDate: string;
          hijriDate: string;
          weekDay: string;
        }[];
      }[];
      // تجميع حسب التاريخ
      dateGroups: {
        day: number;
        gregorianDate: string;
        hijriDate: string;
        weekDay: string;
        activities: {
          id: string;
          activityName: string;
          dailyTarget: number;
          achieved: number;
          status: string;
        }[];
      }[];
    }[] = [];
    
    // تجميع حسب الشهر
    for (let month = 1; month <= 12; month++) {
      const monthActivities: typeof groups[0]["activities"] = [];
      const dateMap = new Map<number, typeof groups[0]["dateGroups"][0]>();
      
      planMonths.filter(pm => pm.month === month).forEach(pm => {
        const plan = operationalPlans.find(p => p.id === pm.operational_plan_id);
        if (!plan) return;
        
        const dayPlans = executivePlans
          .filter(ep => ep.operational_plan_month_id === pm.id)
          .map(ep => {
            const date = new Date(selectedYear, month - 1, ep.day);
            return {
              id: ep.id,
              day: ep.day,
              dailyTarget: ep.daily_target,
              achieved: ep.achieved,
              status: ep.status,
              gregorianDate: formatGregorianDate(date),
              hijriDate: formatHijriDate(date),
              weekDay: WEEKDAYS_AR[date.getDay()],
            };
          });
        
        // إضافة للمهام
        if (dayPlans.length > 0 || pm.monthly_target > 0) {
          monthActivities.push({
            activityName: plan.activity_name,
            planMonthId: pm.id,
            monthlyTarget: pm.monthly_target,
            days: dayPlans,
          });
        }
        
        // إضافة للتواريخ
        dayPlans.forEach(dayPlan => {
          if (!dateMap.has(dayPlan.day)) {
            dateMap.set(dayPlan.day, {
              day: dayPlan.day,
              gregorianDate: dayPlan.gregorianDate,
              hijriDate: dayPlan.hijriDate,
              weekDay: dayPlan.weekDay,
              activities: [],
            });
          }
          dateMap.get(dayPlan.day)!.activities.push({
            id: dayPlan.id,
            activityName: plan.activity_name,
            dailyTarget: dayPlan.dailyTarget,
            achieved: dayPlan.achieved,
            status: dayPlan.status,
          });
        });
      });
      
      if (monthActivities.length > 0 || dateMap.size > 0) {
        groups.push({
          month,
          monthName: MONTHS_AR[month - 1],
          activities: monthActivities,
          dateGroups: Array.from(dateMap.values()).sort((a, b) => a.day - b.day),
        });
      }
    }
    
    return groups;
  }, [planMonths, operationalPlans, executivePlans, selectedYear]);

  // الحصول على وضع العرض للشهر
  const getViewMode = (month: number): "tasks" | "dates" => {
    return viewMode[month] || "tasks";
  };

  // تغيير وضع العرض للشهر
  const setMonthViewMode = (month: number, mode: "tasks" | "dates") => {
    setViewMode(prev => ({ ...prev, [month]: mode }));
  };

  // أيام الشهر المختار للإضافة
  const daysInAddingMonth = useMemo(() => {
    return new Date(selectedYear, addingMonth, 0).getDate();
  }, [selectedYear, addingMonth]);

  // المهام المتاحة للشهر المختار
  const availableActivities = useMemo(() => {
    return planMonths
      .filter(pm => pm.month === addingMonth)
      .map(pm => {
        const plan = operationalPlans.find(p => p.id === pm.operational_plan_id);
        return {
          planMonthId: pm.id,
          activityName: plan?.activity_name || "",
          monthlyTarget: pm.monthly_target,
        };
      })
      .filter(a => a.activityName);
  }, [planMonths, operationalPlans, addingMonth]);

  // إضافة خطة تنفيذية
  const handleAddExecutivePlan = async () => {
    if (!selectedPlanMonthId || selectedDays.length === 0) {
      toast({ title: "تنبيه", description: "اختر المهمة والأيام", variant: "destructive" });
      return;
    }
    
    const selectedPlanMonth = planMonths.find(pm => pm.id === selectedPlanMonthId);
    if (!selectedPlanMonth) return;
    
    // توزيع المستهدف على الأيام المختارة
    const dailyTarget = Math.ceil(selectedPlanMonth.monthly_target / selectedDays.length);
    
    const plansToInsert = selectedDays.map((day, index) => {
      // آخر يوم يأخذ الباقي
      const target = index === selectedDays.length - 1
        ? selectedPlanMonth.monthly_target - (dailyTarget * (selectedDays.length - 1))
        : dailyTarget;
      
      return {
        operational_plan_month_id: selectedPlanMonthId,
        day,
        daily_target: Math.max(target, 0),
        achieved: 0,
        status: "pending",
      };
    });
    
    try {
      // حذف الخطط القديمة لهذا الشهر
      await supabase
        .from("executive_plans")
        .delete()
        .eq("operational_plan_month_id", selectedPlanMonthId);
      
      // إضافة الجديدة
      const { error } = await supabase
        .from("executive_plans")
        .insert(plansToInsert);
      
      if (error) throw error;
      
      toast({ title: "تم!", description: `تم إضافة ${plansToInsert.length} يوم للخطة التنفيذية` });
      setIsDialogOpen(false);
      setSelectedPlanMonthId("");
      setSelectedDays([]);
      
      // إعادة جلب البيانات
      const monthIds = planMonths.map(m => m.id);
      const { data: newExecutive } = await supabase
        .from("executive_plans")
        .select("*")
        .in("operational_plan_month_id", monthIds)
        .order("day", { ascending: true });
      
      setExecutivePlans(newExecutive || []);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  // حذف خطة تنفيذية
  const handleDeleteDay = async (executivePlanId: string) => {
    try {
      const { error } = await supabase
        .from("executive_plans")
        .delete()
        .eq("id", executivePlanId);
      
      if (error) throw error;
      
      setExecutivePlans(prev => prev.filter(ep => ep.id !== executivePlanId));
      toast({ title: "تم الحذف" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
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
              توزيع المستهدفات الشهرية على أيام محددة
            </p>
          </div>
          
          <Button
            onClick={() => {
              setIsDialogOpen(true);
              setSelectedPlanMonthId("");
              setSelectedDays([]);
              setAddingMonth(new Date().getMonth() + 1);
            }}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          >
            <Plus className="w-5 h-5" />
            إضافة خطة تنفيذية
          </Button>
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
              
              {/* معلومات الموظف المختار */}
              {getSelectedEmployee() && (
                <div className="flex items-center gap-2 mr-auto bg-white rounded-lg px-4 py-2 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center text-white font-bold text-sm">
                    {getSelectedEmployee()?.full_name.charAt(0)}
                  </div>
                  <span className="font-medium">{getSelectedEmployee()?.full_name}</span>
                  <span className="text-muted-foreground">- {selectedYear}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* المحتوى الرئيسي */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-[#3d9aa8] border-t-transparent rounded-full" />
          </div>
        ) : groupedPlans.length === 0 ? (
          <Card className="py-20">
            <CardContent className="text-center">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد خطط تنفيذية</h3>
              <p className="text-muted-foreground mb-4">
                اضغط على "إضافة خطة تنفيذية" لتوزيع المستهدفات على الأيام
              </p>
            </CardContent>
          </Card>
        ) : (
          /* جدول الخطط التنفيذية */
          <div className="space-y-4">
            {groupedPlans.map(monthGroup => (
              <Card key={monthGroup.month} className="overflow-hidden">
                {/* رأس الشهر */}
                <CardHeader 
                  className="bg-gradient-to-r from-[#3d9aa8] to-[#4A9BA8] text-white cursor-pointer py-3"
                  onClick={() => toggleMonth(`month-${monthGroup.month}`)}
                >
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5" />
                      <span>{monthGroup.monthName} {selectedYear}</span>
                      <Badge className="bg-white/20 text-white">
                        {monthGroup.activities.length} مهمة - {monthGroup.activities.reduce((sum, a) => sum + a.days.length, 0)} يوم
                      </Badge>
                    </div>
                    <ChevronDown className={cn(
                      "w-5 h-5 transition-transform",
                      expandedMonths.has(`month-${monthGroup.month}`) ? "rotate-180" : ""
                    )} />
                  </CardTitle>
                </CardHeader>
                
                {/* محتوى الشهر */}
                {expandedMonths.has(`month-${monthGroup.month}`) && (
                  <CardContent className="p-4">
                    {/* تبويبات التبديل بين العرض بحسب المهام والتواريخ */}
                    <Tabs 
                      value={getViewMode(monthGroup.month)} 
                      onValueChange={(v) => setMonthViewMode(monthGroup.month, v as "tasks" | "dates")}
                      className="w-full"
                    >
                      <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 mr-auto">
                        <TabsTrigger value="dates" className="gap-2">
                          <CalendarDays className="w-4 h-4" />
                          بحسب التواريخ
                        </TabsTrigger>
                        <TabsTrigger value="tasks" className="gap-2">
                          <ListTodo className="w-4 h-4" />
                          بحسب المهام
                        </TabsTrigger>
                      </TabsList>
                      
                      {/* عرض بحسب المهام */}
                      <TabsContent value="tasks" className="mt-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-100">
                                <TableHead className="text-right font-bold min-w-[200px] border-l-2">
                                  النشاط
                                </TableHead>
                                <TableHead className="text-center font-bold text-[#3d9aa8]">
                                  تواريخ التنفيذ
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthGroup.activities.map((activity, actIdx) => (
                                <TableRow 
                                  key={activity.planMonthId}
                                  className={cn(
                                    "hover:bg-gray-50",
                                    actIdx < monthGroup.activities.length - 1 ? "border-b-2 border-b-gray-200" : ""
                                  )}
                                >
                                  {/* عمود اسم النشاط */}
                                  <TableCell className="font-semibold bg-gray-50 border-l-2 py-3 min-w-[200px]">
                                    <div className="flex items-center gap-2">
                                      <Target className="w-4 h-4 text-[#3d9aa8] flex-shrink-0" />
                                      <span className="font-bold text-gray-800 text-sm">{activity.activityName}</span>
                                    </div>
                                  </TableCell>
                                  
                                  {/* عمود أيام التنفيذ */}
                                  <TableCell className="py-2">
                                    {activity.days.length === 0 ? (
                                      <span className="text-muted-foreground text-sm">لا توجد أيام تنفيذ</span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        {activity.days.map((day, dayIdx) => {
                                          const date = new Date(selectedYear, monthGroup.month - 1, day.day);
                                          const hijri = toHijri(date);
                                          
                                          return (
                                            <div key={day.id} className="flex items-center">
                                              <div
                                                className={cn(
                                                  "text-center px-3 py-2 rounded-lg min-w-[70px]",
                                                  day.status === "completed" 
                                                    ? "bg-green-600 text-white"
                                                    : day.status === "in_progress"
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-[#3d9aa8] text-white"
                                                )}
                                              >
                                                {/* التاريخ الميلادي */}
                                                <div className="text-xs font-medium">
                                                  {date.getMonth() + 1}/{date.getDate()}
                                                </div>
                                                {/* التاريخ الهجري */}
                                                <div className="text-[10px] opacity-80">
                                                  {hijri.day} {hijri.monthName}
                                                </div>
                                              </div>
                                              {/* فاصل أبيض بين الأعمدة */}
                                              {dayIdx < activity.days.length - 1 && (
                                                <div className="w-2 h-full bg-white" />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                      
                      {/* عرض بحسب التواريخ */}
                      <TabsContent value="dates" className="mt-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-100">
                                <TableHead className="text-right font-bold min-w-[150px] border-l-2">
                                  التاريخ
                                </TableHead>
                                <TableHead className="text-center font-bold text-[#3d9aa8]">
                                  الأنشطة المخطط تنفيذها
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {monthGroup.dateGroups.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                    لا توجد تواريخ تنفيذ
                                  </TableCell>
                                </TableRow>
                              ) : (
                                monthGroup.dateGroups.map((dateGroup, dateIdx) => {
                                  const date = new Date(selectedYear, monthGroup.month - 1, dateGroup.day);
                                  const hijri = toHijri(date);
                                  
                                  return (
                                    <TableRow 
                                      key={dateGroup.day}
                                      className={cn(
                                        "hover:bg-gray-50",
                                        dateIdx < monthGroup.dateGroups.length - 1 ? "border-b-2 border-b-gray-200" : ""
                                      )}
                                    >
                                      {/* عمود التاريخ */}
                                      <TableCell className="bg-gray-50 border-l-2 py-3 min-w-[150px]">
                                        <div className="flex flex-col items-start gap-1">
                                          <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-[#3d9aa8] flex-shrink-0" />
                                            <span className="font-bold text-gray-800">{dateGroup.weekDay}</span>
                                          </div>
                                          <div className="text-sm text-gray-600">
                                            {date.getDate()}/{date.getMonth() + 1}/{selectedYear}
                                          </div>
                                          <div className="text-xs text-[#3d9aa8]">
                                            {hijri.day} {hijri.monthName} {hijri.year}هـ
                                          </div>
                                        </div>
                                      </TableCell>
                                      
                                      {/* عمود الأنشطة */}
                                      <TableCell className="py-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {dateGroup.activities.map((activity) => (
                                            <div
                                              key={activity.id}
                                              className={cn(
                                                "text-center px-4 py-2 rounded-lg",
                                                activity.status === "completed" 
                                                  ? "bg-green-600 text-white"
                                                  : activity.status === "in_progress"
                                                  ? "bg-blue-600 text-white"
                                                  : "bg-[#3d9aa8] text-white"
                                              )}
                                            >
                                              <div className="text-sm font-medium">{activity.activityName}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* نافذة إضافة خطة تنفيذية */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                إضافة خطة تنفيذية
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* اختيار الشهر */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">اختر الشهر</label>
                <Select value={addingMonth.toString()} onValueChange={(v) => {
                  setAddingMonth(parseInt(v));
                  setSelectedPlanMonthId("");
                  setSelectedDays([]);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {MONTHS_AR.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month} {selectedYear}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* اختيار المهمة */}
              <div className="space-y-2">
                <label className="font-semibold text-gray-700">اختر المهمة / النشاط</label>
                {availableActivities.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center bg-gray-50 rounded-lg">
                    لا توجد مهام في الخطة التشغيلية لهذا الشهر
                  </p>
                ) : (
                  <Select value={selectedPlanMonthId} onValueChange={(v) => {
                    setSelectedPlanMonthId(v);
                    setSelectedDays([]);
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر المهمة" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {availableActivities.map(activity => (
                        <SelectItem key={activity.planMonthId} value={activity.planMonthId}>
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-[#3d9aa8]" />
                            <span>{activity.activityName}</span>
                            <Badge variant="outline" className="mr-2">
                              المستهدف: {activity.monthlyTarget}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {/* اختيار الأيام */}
              {selectedPlanMonthId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-gray-700">اختر الأيام</label>
                    <Badge variant="outline" className="text-[#3d9aa8]">
                      {selectedDays.length} يوم مختار
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2 p-4 bg-gray-50 rounded-xl border">
                    {/* أيام الأسبوع */}
                    {WEEKDAYS_AR.map(day => (
                      <div key={day} className="text-center text-xs font-bold text-gray-500 pb-2">
                        {day}
                      </div>
                    ))}
                    
                    {/* فراغات بداية الشهر */}
                    {Array.from({ length: new Date(selectedYear, addingMonth - 1, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    
                    {/* أيام الشهر */}
                    {Array.from({ length: daysInAddingMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(selectedYear, addingMonth - 1, day);
                      const isSelected = selectedDays.includes(day);
                      
                      return (
                        <div
                          key={day}
                          onClick={() => {
                            setSelectedDays(prev => 
                              prev.includes(day) 
                                ? prev.filter(d => d !== day)
                                : [...prev, day].sort((a, b) => a - b)
                            );
                          }}
                          className={cn(
                            "p-2 rounded-lg cursor-pointer transition-all text-center border-2",
                            isSelected 
                              ? "bg-[#3d9aa8] text-white border-[#2d7a85] shadow-md" 
                              : "bg-white hover:bg-gray-100 border-transparent hover:border-[#3d9aa8]/30"
                          )}
                        >
                          <div className="text-lg font-bold">{day}</div>
                          <div className={cn(
                            "text-[10px]",
                            isSelected ? "text-white/80" : "text-muted-foreground"
                          )}>
                            {formatHijriDate(date).split(" ")[0]} {formatHijriDate(date).split(" ")[1]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* معاينة الأيام المختارة */}
                  {selectedDays.length > 0 && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                      <h4 className="font-semibold text-emerald-800 mb-3">الأيام المختارة:</h4>
                      <div className="space-y-2">
                        {selectedDays.map(day => {
                          const date = new Date(selectedYear, addingMonth - 1, day);
                          return (
                            <div key={day} className="flex items-center gap-4 bg-white rounded-lg p-2 text-sm">
                              <span className="font-bold text-[#3d9aa8] w-8">{day}</span>
                              <span className="text-gray-600">{WEEKDAYS_AR[date.getDay()]}</span>
                              <span className="text-gray-800">{formatGregorianDate(date)}</span>
                              <span className="text-emerald-700">{formatHijriDate(date)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* زر الإضافة */}
              <Button
                onClick={handleAddExecutivePlan}
                disabled={!selectedPlanMonthId || selectedDays.length === 0}
                className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-12 text-lg"
              >
                <Plus className="w-5 h-5" />
                إضافة الخطة التنفيذية
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
