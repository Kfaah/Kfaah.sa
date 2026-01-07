import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Users, CheckCircle, Clock, Trophy, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const positiveMessages = [
  "أهلاً بك! يومك سعيد 🌟",
  "نتمنى لك يوماً مليئاً بالإنجازات ✨",
  "رائع! استمر في العمل المميز 💪",
  "بارك الله في جهودك 🙏",
  "معاً نحو النجاح 🚀",
];

const Index = () => {
  const [currentMessage, setCurrentMessage] = useState("");

  useEffect(() => {
    const randomMessage = positiveMessages[Math.floor(Math.random() * positiveMessages.length)];
    setCurrentMessage(randomMessage);
  }, []);

  const topEmployees = [
    { id: 1, name: "أحمد محمد", role: "مسؤول السلات المتروكة", points: 450, rank: 1 },
    { id: 2, name: "سارة علي", role: "مسؤول الحملات", points: 420, rank: 2 },
    { id: 3, name: "محمد خالد", role: "مسؤول الاستقطاع", points: 395, rank: 3 },
    { id: 4, name: "فاطمة أحمد", role: "مسؤول التطوير", points: 380, rank: 4 },
  ];

  const recentActivities = [
    { id: 1, type: "task_complete", title: "رصد سلوك", employee: "أ. محمد - السلات المتروكة" },
    { id: 2, type: "points_add", title: "إضافة نقاط", employee: "أ. سارة - الحملات" },
    { id: 3, type: "evaluation", title: "تقييم مشاركة", employee: "أ. خالد - التطوير" },
  ];

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-amber-400 text-amber-900";
      case 2: return "bg-slate-300 text-slate-700";
      case 3: return "bg-orange-400 text-orange-900";
      default: return "bg-accent/20 text-accent";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Title */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">نظرة عامة</h1>
        </div>

        {/* Welcome Banner */}
        <div className="hero-gradient rounded-3xl p-8 animate-slide-up border border-accent/20">
          <div className="flex flex-col items-center text-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">مرحباً جابر 👋</h2>
              <p className="text-muted-foreground mt-1">مدير النظام</p>
            </div>
            {currentMessage && (
              <div className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-2xl py-3 px-6 border border-cyan-200 animate-fade-in">
                <span className="text-base font-medium text-cyan-700">{currentMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">12</p>
                <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">18</p>
                <p className="text-sm text-muted-foreground">المهام النشطة</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">1,250</p>
                <p className="text-sm text-muted-foreground">نقاط اليوم</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: "150ms" }}>
          <Card className="bg-card border-border rounded-3xl shadow-card">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">24</p>
                <p className="text-sm text-muted-foreground">المهام المكتملة</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border rounded-3xl shadow-card">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">3</p>
                <p className="text-sm text-muted-foreground">الخطط النشطة</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Employees */}
          <Card className="lg:col-span-2 bg-card border-border rounded-3xl shadow-card animate-slide-up" style={{ animationDelay: "200ms" }}>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <CardTitle className="text-lg">أبطال الأسبوع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topEmployees.map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankColor(employee.rank)}`}>
                        {employee.rank}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="font-bold text-amber-600">{employee.points}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activities */}
          <Card className="bg-card border-border rounded-3xl shadow-card animate-slide-up" style={{ animationDelay: "250ms" }}>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-500" />
              </div>
              <CardTitle className="text-lg">آخر النشاطات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/30 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-sm">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.employee}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
