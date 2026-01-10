import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Target, Calendar, User, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatNumber, formatPercent } from "@/lib/utils";

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

export default function OperationalPlanDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plan, setPlan] = useState<OperationalPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPlanDetails();
    }
  }, [id]);

  const fetchPlanDetails = async () => {
    setLoading(true);
    try {
      // جلب الخطة
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .select("*")
        .eq("id", id)
        .single();

      if (planError) throw planError;

      // جلب توزيع الأشهر
      const { data: monthsData, error: monthsError } = await supabase
        .from("operational_plan_months")
        .select("*")
        .eq("operational_plan_id", id)
        .order("month", { ascending: true });

      if (monthsError) throw monthsError;

      // جلب اسم الموظف
      const { data: empData } = await supabase
        .from("employees")
        .select("full_name")
        .eq("user_id", planData.user_id)
        .single();

      setPlan({
        ...planData,
        months: monthsData || [],
        employee_name: empData?.full_name || ""
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل تفاصيل الخطة",
        variant: "destructive",
      });
      navigate("/operational-plans");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white px-4 py-1">نشطة</Badge>;
      case "completed":
        return <Badge className="bg-blue-500 text-white px-4 py-1">مكتملة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white px-4 py-1">معلقة</Badge>;
      default:
        return <Badge className="px-4 py-1">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!plan) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">لم يتم العثور على الخطة</p>
          <Button onClick={() => navigate("/operational-plans")} className="mt-4">
            العودة للخطط التشغيلية
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/operational-plans")}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">تفاصيل الخطة التشغيلية</h1>
              <p className="text-muted-foreground">عرض كامل للخطة وتوزيع المستهدفات</p>
            </div>
          </div>
          {getStatusBadge(plan.status)}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">اسم النشاط</p>
                <p className="font-bold">{plan.activity_name}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المستهدف السنوي</p>
                <p className="font-bold text-xl">{plan.annual_target}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">السنة</p>
                <p className="font-bold text-xl">{plan.year}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <User className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الموظف</p>
                <p className="font-bold">{plan.employee_name || "-"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Table */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              توزيع المستهدف على الأشهر
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-bold text-lg min-w-[150px] border-l">
                      النشاط
                    </TableHead>
                    {MONTHS_AR.map((month, index) => (
                      <TableHead 
                        key={index} 
                        className="text-center font-semibold min-w-[80px] border-l"
                      >
                        {month}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold text-lg bg-primary/20 min-w-[100px]">
                      المجموع
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="font-semibold bg-muted/20 border-l text-base">
                      {plan.activity_name}
                    </TableCell>
                    {MONTHS_AR.map((_, index) => {
                      const monthData = plan.months?.find(m => m.month === index + 1);
                      const target = monthData?.monthly_target || 0;
                      return (
                        <TableCell 
                          key={index} 
                          className="text-center border-l"
                        >
                          <span className={`text-lg font-bold ${target > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {target}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center bg-primary/10 border-l">
                      <span className="text-xl font-bold text-primary">{plan.annual_target}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Visual Progress */}
        <Card>
          <CardHeader>
            <CardTitle>التوزيع البصري</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
              {MONTHS_AR.map((month, index) => {
                const monthData = plan.months?.find(m => m.month === index + 1);
                const target = monthData?.monthly_target || 0;
                const percentage = plan.annual_target > 0 ? (target / plan.annual_target) * 100 : 0;
                
                return (
                  <div 
                    key={index} 
                    className="text-center p-3 rounded-lg bg-gradient-to-b from-muted/50 to-muted/30 border"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{month}</p>
                    <p className="text-lg font-bold" dir="ltr" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(target)}</p>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all"
                        style={{ width: `${Math.min(percentage * 10, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1" dir="ltr" style={{ fontFamily: 'Arial, sans-serif' }}>{formatPercent(percentage, 1)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
