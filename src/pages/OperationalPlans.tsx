import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Calendar, TrendingUp, ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
}

interface OperationalPlan {
  id: string;
  user_id: string;
  activity_name: string;
  strategic_goal: string | null;
  initiative: string | null;
  annual_target: number;
  year: number;
  status: string;
  created_at: string;
  months?: OperationalPlanMonth[];
  employee_name?: string;
}

interface OperationalPlanMonth {
  id: string;
  operational_plan_id: string;
  month: number;
  monthly_target: number;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// ألوان مميزة لكل هدف استراتيجي
const GOAL_COLORS = [
  { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
  { bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  { bg: "bg-rose-50", border: "border-l-rose-500", text: "text-rose-700" },
  { bg: "bg-cyan-50", border: "border-l-cyan-500", text: "text-cyan-700" },
  { bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
  { bg: "bg-indigo-50", border: "border-l-indigo-500", text: "text-indigo-700" },
];

interface GroupedPlans {
  strategicGoal: string;
  colorIndex: number;
  initiatives: {
    initiative: string;
    plans: OperationalPlan[];
  }[];
}

export default function OperationalPlans() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { user, previewAsEmployee } = useUser();
  const { toast } = useToast();
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  
  // Form state
  const [strategicGoal, setStrategicGoal] = useState("");
  const [initiative, setInitiative] = useState("");
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(0));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  // إذا كان في وضع المعاينة، يظهر كموظف
  const isAdmin = !user.isEmployee && !previewAsEmployee;

  useEffect(() => {
    fetchPlans();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [authUser, isAdmin]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name")
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchPlans = async () => {
    if (!authUser) return;
    
    setLoading(true);
    try {
      const { data: plansData, error } = await supabase
        .from("operational_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch months for each plan
      const plansWithMonths = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { data: monthsData } = await supabase
            .from("operational_plan_months")
            .select("*")
            .eq("operational_plan_id", plan.id)
            .order("month", { ascending: true });

          // Get employee name if admin
          let employee_name = "";
          if (isAdmin && plan.user_id !== authUser.id) {
            const { data: empData } = await supabase
              .from("employees")
              .select("full_name")
              .eq("user_id", plan.user_id)
              .single();
            employee_name = empData?.full_name || "";
          }

          return {
            ...plan,
            months: monthsData || [],
            employee_name
          };
        })
      );

      setPlans(plansWithMonths);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الخطط التشغيلية",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnnualTargetChange = (value: string) => {
    setAnnualTarget(value);
    const target = parseInt(value) || 0;
    // توزيع تلقائي بالتساوي
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    const newTargets = Array(12).fill(perMonth);
    // إضافة الباقي للأشهر الأخيرة
    for (let i = 11; i >= 12 - remainder; i--) {
      newTargets[i]++;
    }
    setMonthlyTargets(newTargets);
  };

  const handleMonthlyTargetChange = (monthIndex: number, value: string) => {
    const newTargets = [...monthlyTargets];
    newTargets[monthIndex] = parseInt(value) || 0;
    setMonthlyTargets(newTargets);
  };

  const getTotalMonthlyTargets = () => {
    return monthlyTargets.reduce((sum, t) => sum + t, 0);
  };

  const handleSubmit = async () => {
    if (!activityName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم النشاط",
        variant: "destructive",
      });
      return;
    }

    // التحقق من اختيار الموظف للمدير
    if (isAdmin && !selectedEmployeeId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الموظف",
        variant: "destructive",
      });
      return;
    }

    if (!annualTarget || parseInt(annualTarget) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال المستهدف السنوي",
        variant: "destructive",
      });
      return;
    }

    const totalMonthly = getTotalMonthlyTargets();
    const annualNum = parseInt(annualTarget);
    
    if (totalMonthly !== annualNum) {
      toast({
        title: "تحذير",
        description: `مجموع الأشهر (${totalMonthly}) لا يساوي المستهدف السنوي (${annualNum})`,
        variant: "destructive",
      });
      return;
    }

    try {
      // تحديد user_id بناءً على نوع المستخدم
      const targetUserId = isAdmin ? selectedEmployeeId : authUser!.id;

      // إنشاء الخطة التشغيلية
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: targetUserId,
          strategic_goal: strategicGoal || null,
          initiative: initiative || null,
          activity_name: activityName,
          annual_target: parseInt(annualTarget),
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      // إنشاء توزيع الأشهر
      const monthsToInsert = monthlyTargets.map((target, index) => ({
        operational_plan_id: planData.id,
        month: index + 1,
        monthly_target: target,
      }));

      const { error: monthsError } = await supabase
        .from("operational_plan_months")
        .insert(monthsToInsert);

      if (monthsError) throw monthsError;

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الخطة التشغيلية",
      });

      // Reset form
      setStrategicGoal("");
      setInitiative("");
      setActivityName("");
      setAnnualTarget("");
      setYear(new Date().getFullYear());
      setMonthlyTargets(Array(12).fill(0));
      setSelectedEmployeeId("");
      setIsAddDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الخطة",
        variant: "destructive",
      });
    }
  };

  const handleViewPlan = (plan: OperationalPlan) => {
    setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخطة؟")) return;

    try {
      const { error } = await supabase
        .from("operational_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف الخطة التشغيلية",
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حذف الخطة",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">نشطة</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">مكتملة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">معلقة</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isAdmin ? "الخطط التشغيلية" : "الخطة التشغيلية"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? "إدارة الخطط التشغيلية للموظفين" : "إدارة خططك التشغيلية"}
            </p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة خطة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة خطة تشغيلية جديدة</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* اختيار الموظف للمدير */}
                {isAdmin && (
                  <div>
                    <Label>الموظف</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="اختر الموظف" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.user_id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>الهدف الاستراتيجي</Label>
                    <Input
                      value={strategicGoal}
                      onChange={(e) => setStrategicGoal(e.target.value)}
                      placeholder="مثال: تحسين جودة الخدمات"
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>المبادرة</Label>
                    <Input
                      value={initiative}
                      onChange={(e) => setInitiative(e.target.value)}
                      placeholder="مثال: مبادرة التحول الرقمي"
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>النشاط</Label>
                    <Input
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      placeholder="مثال: حملة التسويق الرقمي"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label>المستهدف السنوي</Label>
                    <Input
                      type="number"
                      value={annualTarget}
                      onChange={(e) => handleAnnualTargetChange(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label>السنة</Label>
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Monthly Distribution */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-semibold">توزيع المستهدف على الأشهر</Label>
                    <span className={`text-sm ${getTotalMonthlyTargets() === parseInt(annualTarget || "0") ? "text-green-600" : "text-red-600"}`} style={{ fontFamily: 'Arial, sans-serif' }}>
                      المجموع: {formatNumber(getTotalMonthlyTargets())} / {formatNumber(annualTarget || 0)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {MONTHS_AR.map((month, index) => (
                      <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                        <span className="text-sm font-medium w-16">{month}</span>
                        <Input
                          type="number"
                          value={monthlyTargets[index]}
                          onChange={(e) => handleMonthlyTargetChange(index, e.target.value)}
                          className="h-8 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  إنشاء الخطة التشغيلية
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الخطط</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(plans.length)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الخطط النشطة</p>
                <p className="text-2xl font-bold">{plans.filter(p => p.status === "active").length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">السنة الحالية</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>{new Date().getFullYear()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الخطط التشغيلية</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد خطط تشغيلية حتى الآن
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full">
                  {/* رأس الجدول الرسمي */}
                  <thead>
                    <tr className="bg-gradient-to-r from-[#2d7a85] to-[#3d9aa8] text-white">
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">الهدف الاستراتيجي</span>
                      </th>
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">المبادرة</span>
                      </th>
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">النشاط</span>
                      </th>
                      {isAdmin && (
                        <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                          <span className="text-sm font-semibold">الموظف المكلف</span>
                        </th>
                      )}
                      <th className="w-28 py-3 px-2 border-l-2 border-white/30 text-center">
                        <span className="text-sm font-semibold">المستهدف السنوي</span>
                      </th>
                      <th className="w-28 py-3 px-2 border-l-2 border-white/30 text-center">
                        <span className="text-sm font-semibold">المتوسط الشهري</span>
                      </th>
                      <th className="w-24 py-3 px-2 text-center">
                        <span className="text-sm font-semibold">الإجراء</span>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody>
                  {(() => {
                    // تجميع الخطط حسب الهدف الاستراتيجي ثم المبادرة
                    const groupedPlans: GroupedPlans[] = [];
                    const goalMap = new Map<string, { initiatives: Map<string, OperationalPlan[]> }>();
                    
                    plans.forEach(plan => {
                      const goal = plan.strategic_goal || "بدون هدف";
                      const init = plan.initiative || "بدون مبادرة";
                      
                      if (!goalMap.has(goal)) {
                        goalMap.set(goal, { initiatives: new Map() });
                      }
                      const goalData = goalMap.get(goal)!;
                      
                      if (!goalData.initiatives.has(init)) {
                        goalData.initiatives.set(init, []);
                      }
                      goalData.initiatives.get(init)!.push(plan);
                    });
                    
                    let colorIndex = 0;
                    goalMap.forEach((goalData, goalName) => {
                      const initiatives: { initiative: string; plans: OperationalPlan[] }[] = [];
                      goalData.initiatives.forEach((plans, initName) => {
                        initiatives.push({ initiative: initName, plans });
                      });
                      groupedPlans.push({
                        strategicGoal: goalName,
                        colorIndex: colorIndex % GOAL_COLORS.length,
                        initiatives
                      });
                      colorIndex++;
                    });
                    
                    const rows: JSX.Element[] = [];
                    
                    groupedPlans.forEach((group, groupIndex) => {
                      const color = GOAL_COLORS[group.colorIndex];
                      // حساب إجمالي الصفوف لهذا الهدف (مع احتساب الصفوف الموسعة)
                      const totalRowsInGoal = group.initiatives.reduce((sum, init) => {
                        return sum + init.plans.reduce((planSum, plan) => {
                          return planSum + 1 + (expandedPlanId === plan.id ? 1 : 0);
                        }, 0);
                      }, 0);
                      
                      let goalRowRendered = false;
                      
                      group.initiatives.forEach((initGroup, initIndex) => {
                        // حساب الصفوف للمبادرة (مع احتساب الصفوف الموسعة)
                        const totalRowsInInitiative = initGroup.plans.reduce((sum, plan) => {
                          return sum + 1 + (expandedPlanId === plan.id ? 1 : 0);
                        }, 0);
                        let initRowRendered = false;
                        
                        initGroup.plans.forEach((plan, planIndex) => {
                          const isExpanded = expandedPlanId === plan.id;
                          const isFirstRowOfGoal = !goalRowRendered;
                          const isFirstRowOfInit = !initRowRendered;
                          const isLastInInitiative = planIndex === initGroup.plans.length - 1;
                          const isLastInitiative = initIndex === group.initiatives.length - 1;
                          const isLastGoal = groupIndex === groupedPlans.length - 1;
                          
                          // تحديد نوع الفاصل السفلي
                          let bottomBorder = '';
                          if (isLastInInitiative && isLastInitiative && !isLastGoal) {
                            // فاصل كبير بين الأهداف الاستراتيجية
                            bottomBorder = 'border-b-4 border-b-gray-500';
                          } else if (isLastInInitiative && !isLastInitiative) {
                            // فاصل كبير بين المبادرات
                            bottomBorder = 'border-b-4 border-b-gray-400';
                          } else if (!isLastInInitiative) {
                            // فاصل صغير بين الأنشطة
                            bottomBorder = 'border-b border-b-gray-200';
                          }
                          
                          rows.push(
                            <tr 
                              key={plan.id} 
                              className={`${color.bg} border-r-4 ${color.border} hover:bg-white/50 transition-all duration-200 ${isExpanded ? 'bg-white/70' : ''} ${bottomBorder}`}
                            >
                              {/* الهدف الاستراتيجي - مدمج */}
                              {isFirstRowOfGoal && (
                                <td 
                                  rowSpan={totalRowsInGoal} 
                                  className={`py-4 px-4 border-l-2 border-gray-300 align-middle ${color.bg}`}
                                >
                                  <p className={`font-semibold text-sm ${color.text}`}>{group.strategicGoal}</p>
                                </td>
                              )}
                              
                              {/* المبادرة - مدمج */}
                              {isFirstRowOfInit && (
                                <td 
                                  rowSpan={totalRowsInInitiative} 
                                  className={`py-4 px-4 border-l-2 border-gray-300 align-middle ${initIndex > 0 ? 'border-t-2 border-t-gray-400' : ''}`}
                                >
                                  <p className="text-gray-700 text-sm font-medium">{initGroup.initiative}</p>
                                </td>
                              )}
                              
                              {/* النشاط مع السهم */}
                              <td className="py-4 px-4 border-l-2 border-gray-300">
                                <div 
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={() => handleViewPlan(plan)}
                                >
                                  <ChevronDown 
                                    className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180 text-[#2d7a85]' : 'text-[#3d9aa8]'}`} 
                                  />
                                  <p className="font-semibold text-gray-800 text-sm">{plan.activity_name}</p>
                                </div>
                              </td>
                              
                              {/* الموظف المكلف - يظهر فقط للمدير */}
                              {isAdmin && (
                                <td className="py-4 px-4 border-l-2 border-gray-300">
                                  <p className="text-gray-700 text-sm">{plan.employee_name || "-"}</p>
                                </td>
                              )}
                              
                              {/* المستهدف السنوي */}
                              <td className="w-28 py-4 px-2 border-l-2 border-gray-300 text-center">
                                <p className="text-lg font-bold text-[#3d9aa8]">{plan.annual_target}</p>
                              </td>
                              
                              {/* المتوسط الشهري */}
                              <td className="w-28 py-4 px-2 border-l-2 border-gray-300 text-center bg-white/50">
                                <p className="text-lg font-bold text-[#2d7a85]">
                                  {Math.round(plan.annual_target / 12)}
                                </p>
                              </td>
                              
                              {/* الإجراء */}
                              <td className="w-24 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {(isAdmin || plan.user_id === authUser?.id) && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // TODO: فتح نافذة التعديل
                                        }}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePlan(plan.id);
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                          
                          // المحتوى المنسدل
                          if (isExpanded) {
                            rows.push(
                              <tr key={`${plan.id}-expanded`}>
                                <td colSpan={isAdmin ? 7 : 6} className="p-0">
                                  <div className="bg-gradient-to-b from-white to-gray-50 p-6 border-t border-[#3d9aa8]/20 animate-in slide-in-from-top-2 duration-200">
                                    <div className="overflow-x-auto rounded-xl border border-[#3d9aa8]/20 shadow-sm">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-gradient-to-r from-[#3d9aa8] to-[#4A9BA8]">
                                            {MONTHS_AR.map((month, index) => (
                                              <TableHead 
                                                key={index} 
                                                className="text-center font-medium text-white min-w-[70px] border-l border-white/20"
                                              >
                                                {month}
                                              </TableHead>
                                            ))}
                                            <TableHead className="text-center font-bold text-white bg-[#2d7a85] min-w-[80px]">
                                              المجموع
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow className="hover:bg-[#3d9aa8]/5">
                                            {MONTHS_AR.map((_, index) => {
                                              const monthData = plan.months?.find(m => m.month === index + 1);
                                              const target = monthData?.monthly_target || 0;
                                              return (
                                                <TableCell 
                                                  key={index} 
                                                  className="text-center border-l border-[#3d9aa8]/10"
                                                >
                                                  <span className={`text-lg font-bold ${target > 0 ? 'text-[#3d9aa8]' : 'text-muted-foreground'}`}>
                                                    {target}
                                                  </span>
                                                </TableCell>
                                              );
                                            })}
                                            <TableCell className="text-center bg-[#3d9aa8]/20">
                                              <span className="text-xl font-bold text-[#2d7a85]">{plan.annual_target}</span>
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          
                          goalRowRendered = true;
                          initRowRendered = true;
                        });
                      });
                    });
                    
                    return rows;
                  })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
