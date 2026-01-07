import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { Users, CheckCircle, Clock, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const todayTasks = [
    { id: 1, title: "متابعة سلات متروكة - 15 سلة", employee: "أحمد محمد", status: "in_progress", priority: "high" },
    { id: 2, title: "التواصل مع كبار الداعمين", employee: "سارة أحمد", status: "pending", priority: "medium" },
    { id: 3, title: "تحديث صفحة الحملات", employee: "خالد علي", status: "completed", priority: "low" },
    { id: 4, title: "معالجة تبرعات فاشلة - 8 تبرعات", employee: "فاطمة حسن", status: "in_progress", priority: "high" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">مكتمل</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">قيد التنفيذ</Badge>;
      default:
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">معلق</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">عاجل</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">متوسط</Badge>;
      default:
        return <Badge variant="secondary">عادي</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground mt-1">مرحباً بك في منصة إدارة موظفي جمعية عطف</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                  <p className="text-3xl font-bold mt-1">12</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">المهام المكتملة اليوم</p>
                  <p className="text-3xl font-bold mt-1 text-green-400">24</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">المهام قيد التنفيذ</p>
                  <p className="text-3xl font-bold mt-1 text-blue-400">18</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">المهام المتأخرة</p>
                  <p className="text-3xl font-bold mt-1 text-red-400">3</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                مهام اليوم
              </CardTitle>
              <Badge variant="outline">{todayTasks.length} مهام</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-sm text-muted-foreground">{task.employee}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                ملخص الأداء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">معدل إنجاز المهام</span>
                    <span className="font-medium text-green-400">87%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: "87%" }} />
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">156</p>
                      <p className="text-xs text-muted-foreground">مهمة هذا الأسبوع</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">142</p>
                      <p className="text-xs text-muted-foreground">مهمة مكتملة</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
