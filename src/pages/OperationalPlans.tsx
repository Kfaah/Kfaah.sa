import { useState, useEffect } from "react";
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
import { Plus, Target, Calendar, TrendingUp, Eye, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
}

interface OperationalPlan {
  id: string;
  user_id: string;
  activity_name: string;
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

export default function OperationalPlans() {
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<OperationalPlan | null>(null);
  
  // Form state
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(0));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  const isAdmin = !user.isEmployee;

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
    setSelectedPlan(plan);
    setIsViewDialogOpen(true);
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
                    <Label>اسم النشاط</Label>
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
                    <span className={`text-sm ${getTotalMonthlyTargets() === parseInt(annualTarget || "0") ? "text-green-600" : "text-red-600"}`}>
                      المجموع: {getTotalMonthlyTargets()} / {annualTarget || 0}
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
                <p className="text-2xl font-bold">{plans.length}</p>
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
                <p className="text-2xl font-bold">{new Date().getFullYear()}</p>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم النشاط</TableHead>
                    {isAdmin && <TableHead className="text-right">الموظف</TableHead>}
                    <TableHead className="text-right">المستهدف السنوي</TableHead>
                    <TableHead className="text-right">السنة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.activity_name}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {plan.user_id === authUser?.id ? "أنت" : plan.employee_name || "-"}
                        </TableCell>
                      )}
                      <TableCell>{plan.annual_target}</TableCell>
                      <TableCell>{plan.year}</TableCell>
                      <TableCell>{getStatusBadge(plan.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewPlan(plan)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(isAdmin || plan.user_id === authUser?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeletePlan(plan.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* View Plan Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>تفاصيل الخطة التشغيلية</DialogTitle>
            </DialogHeader>
            
            {selectedPlan && (
              <div className="space-y-4">
                {/* معلومات أساسية */}
                <div className="grid grid-cols-4 gap-4 bg-muted/30 rounded-lg p-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">اسم النشاط</Label>
                    <p className="font-semibold">{selectedPlan.activity_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">المستهدف السنوي</Label>
                    <p className="font-semibold">{selectedPlan.annual_target}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">السنة</Label>
                    <p className="font-semibold">{selectedPlan.year}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">الحالة</Label>
                    <p>{getStatusBadge(selectedPlan.status)}</p>
                  </div>
                </div>

                {/* جدول توزيع الأشهر */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-primary/10">
                        <TableHead className="text-right font-bold text-primary min-w-[120px]">النشاط</TableHead>
                        {MONTHS_AR.map((month, index) => (
                          <TableHead key={index} className="text-center font-medium min-w-[70px]">
                            {month}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold bg-primary/20 min-w-[80px]">المجموع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium bg-muted/30">{selectedPlan.activity_name}</TableCell>
                        {MONTHS_AR.map((_, index) => {
                          const monthData = selectedPlan.months?.find(m => m.month === index + 1);
                          return (
                            <TableCell key={index} className="text-center">
                              <span className="font-semibold">{monthData?.monthly_target || 0}</span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold bg-primary/10">
                          {selectedPlan.annual_target}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
