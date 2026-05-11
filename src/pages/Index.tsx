import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { Users, CheckCircle, Clock, Trophy, TrendingUp, Calendar, ListTodo, Timer, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { useIsDemo } from "@/hooks/useIsDemo";

const positiveMessages = [
  (name: string) => `أهلاً بك يا ${name}! يومك سعيد 🌟`,
  (name: string) => `نتمنى لك يوماً مليئاً بالإنجازات يا ${name} ✨`,
  (name: string) => `رائع يا ${name}! استمر في العمل المميز 💪`,
  (name: string) => `بارك الله في جهودك يا ${name} 🙏`,
  (name: string) => `معاً نحو النجاح يا ${name} 🚀`,
];

// رسائل موجَّهة إلى الجمعية ككيان (تظهر في حساب الجمعية العام / viewer)
const orgPositiveMessages = [
  (org: string) => `${org} — جمعية رائدة بأثرٍ يمتد ويتجدّد 🌟`,
  (org: string) => `${org} كيانٌ متألق، رسالتُه تُلهم وتُحدث الفرق ✨`,
  (org: string) => `بارك الله في ${org} وفي مجلس إدارتها وكل العاملين فيها 🙏`,
  (org: string) => `${org} — صرحٌ خيريٌّ تتسع آثاره يوماً بعد يوم 🚀`,
  (org: string) => `${org} رسالةٌ عظيمة وعطاءٌ لا ينقطع بإذن الله 💚`,
  (org: string) => `${org} — ريادةٌ في الخير وقدوةٌ في العمل المؤسسي 🏅`,
  (org: string) => `${org} تصنع الأثر وتبني الإنسان 🌱`,
];

interface EmployeeStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}

interface AdminStats {
  totalEmployees: number;
  activeTasks: number;
  completedTasks: number;
  activePlans: number;
}

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemo, loading: demoLoading } = useIsDemo();
  // شاشة الترحيب مخصّصة لجمعية النموذج التجريبي فقط — لا تظهر لبقية الجمعيات.
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const { user, previewAsEmployee, previewingEmployee } = useUser();
  const { user: authUser } = useAuth();
  const branding = useOrgBranding();
  const [isViewer, setIsViewer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats>({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
  });
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    activePlans: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  // تتبع تغيير الصفحة لإخفاء/إظهار شاشة الترحيب
  useEffect(() => {
    // غير مسموح بشاشة الترحيب إلا لمستخدمي الديمو
    if (!isDemo) { setShowWelcome(false); return; }
    // إذا جاء من القائمة الجانبية، أخفي شاشة الترحيب
    if (location.state?.fromNavigation) {
      setShowWelcome(false);
    } else if (location.key === "default" || !location.state) {
      // إذا ضغط على الشعار أو دخل الموقع لأول مرة، أظهر شاشة الترحيب
      setShowWelcome(true);
    }
  }, [location.state, location.key, isDemo]);

  useEffect(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (isViewer) {
      const orgName = branding.orgName?.trim() || "جمعيتكم";
      const idx = dayOfYear % orgPositiveMessages.length;
      setCurrentMessage(orgPositiveMessages[idx](orgName));
      return;
    }
    const name = user.firstName?.trim();
    if (!name) {
      setCurrentMessage("");
      return;
    }
    const idx = dayOfYear % positiveMessages.length;
    setCurrentMessage(positiveMessages[idx](name));
  }, [user.firstName, isViewer, branding.orgName]);

  // كشف حساب الجمعية (viewer) لاستخدام الرسالة الموجَّهة للكيان
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUser?.id) { setIsViewer(false); return; }
      const { data } = await supabase.rpc("is_viewer", { _user_id: authUser.id });
      if (!cancelled) setIsViewer(!!data);
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  useEffect(() => {
    const checkRoleAndFetchData = async () => {
      if (!authUser?.id) return;

      setLoading(true);

      try {
        // IMPORTANT: When admin is in preview mode, always show employee dashboard.
        if (previewAsEmployee) {
          setIsAdmin(false);
          const targetUserId = previewingEmployee?.user_id ?? authUser.id;
          await fetchEmployeeStats(targetUserId);
          return;
        }

        // Otherwise, decide by the actual authenticated user's role.
        const { data: hasAdminRole } = await supabase.rpc("has_role", {
          _user_id: authUser.id,
          _role: "admin",
        });

        const admin = !!hasAdminRole;
        setIsAdmin(admin);

        // إعادة توجيه الموظف العادي للاستبيان الذكي إذا لم يكمله بعد
        if (!admin) {
          // حسابات الجمعية (viewer) لا تملأ الملف الذكي
          const { data: isViewer } = await supabase.rpc("is_viewer", {
            _user_id: authUser.id,
          });
          if (isViewer) {
            await fetchEmployeeStats(authUser.id);
            return;
          }
          const { data: profile } = await supabase
            .from("employee_intelligence_profiles")
            .select("onboarding_completed")
            .eq("user_id", authUser.id)
            .maybeSingle();
          if (!profile?.onboarding_completed) {
            navigate("/employee-onboarding", { replace: true });
            return;
          }
        }

        if (admin) {
          await fetchAdminStats();
        } else {
          await fetchEmployeeStats(authUser.id);
        }
      } catch (error) {
        console.error("Error checking role:", error);
      } finally {
        setLoading(false);
      }
    };

    checkRoleAndFetchData();
  }, [authUser?.id, previewAsEmployee, previewingEmployee?.user_id]);

  const fetchAdminStats = async () => {
    try {
      // Get total employees
      const { count: employeesCount } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true });

      // Get active tasks (pending + in_progress)
      const { count: activeTasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "in_progress"]);

      // Get completed tasks
      const { count: completedTasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get active operational plans
      const { count: activePlansCount } = await supabase
        .from("operational_plans")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      setAdminStats({
        totalEmployees: employeesCount || 0,
        activeTasks: activeTasksCount || 0,
        completedTasks: completedTasksCount || 0,
        activePlans: activePlansCount || 0,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    }
  };

  const fetchEmployeeStats = async (userId: string) => {
    try {
      // Get user's tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId);

      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === "completed").length || 0;
      const pendingTasks = tasks?.filter(t => t.status === "pending").length || 0;
      const inProgressTasks = tasks?.filter(t => t.status === "in_progress").length || 0;

      // Get recent tasks
      const { data: recentTasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentTasks(recentTasksData || []);

      setEmployeeStats({
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
      });
    } catch (error) {
      console.error("Error fetching employee stats:", error);
    }
  };

  const topEmployees = [
    { id: 1, name: "أحمد محمد", role: "مسؤول السلات المتروكة", points: 450, rank: 1 },
    { id: 2, name: "سارة علي", role: "مسؤول الحملات", points: 420, rank: 2 },
    { id: 3, name: "محمد خالد", role: "مسؤول الاستقطاع", points: 395, rank: 3 },
    { id: 4, name: "فاطمة أحمد", role: "مسؤول التطوير", points: 380, rank: 4 },
  ];

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-amber-400 text-amber-900";
      case 2: return "bg-slate-300 text-slate-700";
      case 3: return "bg-orange-400 text-orange-900";
      default: return "bg-accent/20 text-accent";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-700";
      case "in_progress": return "bg-blue-100 text-blue-700";
      case "pending": return "bg-amber-100 text-amber-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "مكتملة";
      case "in_progress": return "قيد التنفيذ";
      case "pending": return "معلقة";
      default: return status;
    }
  };

  const completionRate = employeeStats.totalTasks > 0 
    ? Math.round((employeeStats.completedTasks / employeeStats.totalTasks) * 100) 
    : 0;

  // عرض شاشة الترحيب إذا كانت مفعلة
  if (showWelcome) {
    return (
      <DashboardLayout>
        <WelcomeScreen />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Title */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">نظرة عامة</h1>
        </div>

        {/* Welcome Banner */}
        <div className="hero-gradient rounded-3xl p-8 animate-slide-up border border-accent/20">
          <div className="flex items-center gap-4">
            {/* Right side - Avatar and Name */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden border-[3px] border-cyan-400 shadow-lg flex-shrink-0">
                {user.profileImage ? (
                  <img 
                    src={user.profileImage} 
                    alt="صورة المستخدم"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white">
                    {user.firstName.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">مرحباً {user.firstName} 👋</h2>
                <p className="text-muted-foreground mt-1">{user.role}</p>
              </div>
            </div>
            
            {/* Center - Positive Message */}
            {currentMessage && (
              <div className="flex-1 flex justify-center">
                <div className="bg-background/90 backdrop-blur-sm rounded-2xl py-3 px-6 border border-primary/30 shadow-sm animate-fade-in">
                  <span className="text-base font-medium text-primary">{currentMessage}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {isAdmin ? (
          <>
            {/* Admin Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{adminStats.totalEmployees}</p>
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
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{adminStats.activeTasks}</p>
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
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{adminStats.completedTasks}</p>
                    <p className="text-sm text-muted-foreground">المهام المكتملة</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Admin Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: "150ms" }}>
              <Card className="bg-card border-border rounded-3xl shadow-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{adminStats.activePlans}</p>
                    <p className="text-sm text-muted-foreground">الخطط النشطة</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-3xl shadow-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                      {adminStats.totalEmployees > 0 ? Math.round((adminStats.completedTasks / (adminStats.activeTasks + adminStats.completedTasks || 1)) * 100) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">نسبة الإنجاز</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content Grid for Admin */}
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankColor(employee.rank)}`} style={{ fontFamily: 'Arial, sans-serif' }}>
                            {employee.rank}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{employee.name}</p>
                            <p className="text-sm text-muted-foreground">{employee.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-500" />
                          <span className="font-bold text-amber-600" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(employee.points)}</span>
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
                    {[
                      { id: 1, type: "task_complete", title: "رصد سلوك", employee: "أ. محمد - السلات المتروكة" },
                      { id: 2, type: "points_add", title: "إضافة نقاط", employee: "أ. سارة - الحملات" },
                      { id: 3, type: "evaluation", title: "تقييم مشاركة", employee: "أ. خالد - التطوير" },
                    ].map((activity) => (
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
          </>
        ) : (
          <>
            {/* Employee Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <ListTodo className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.totalTasks}</p>
                    <p className="text-sm text-muted-foreground">إجمالي مهامي</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.completedTasks}</p>
                    <p className="text-sm text-muted-foreground">المهام المكتملة</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-3xl shadow-card hover:shadow-card-hover transition-shadow">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{completionRate}%</p>
                    <p className="text-sm text-muted-foreground">نسبة الإنجاز</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: "150ms" }}>
              <Card className="bg-card border-border rounded-3xl shadow-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.inProgressTasks}</p>
                    <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-3xl shadow-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                    <Timer className="w-6 h-6 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.inProgressTasks}</p>
                    <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border rounded-3xl shadow-card">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.pendingTasks}</p>
                    <p className="text-sm text-muted-foreground">مهام معلقة</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employee Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Tasks */}
              <Card className="bg-card border-border rounded-3xl shadow-card animate-slide-up" style={{ animationDelay: "200ms" }}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <ListTodo className="w-5 h-5 text-accent" />
                  </div>
                  <CardTitle className="text-lg">آخر المهام</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentTasks.length > 0 ? (
                      recentTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{task.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{task.description || "لا يوجد وصف"}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>لا توجد مهام حتى الآن</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tasks Summary */}
              <Card className="bg-card border-border rounded-3xl shadow-card animate-slide-up" style={{ animationDelay: "250ms" }}>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                  <CardTitle className="text-lg">ملخص الأداء</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">نسبة إنجاز المهام</span>
                        <span className="font-bold text-foreground">{completionRate}%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-l from-accent to-primary rounded-full transition-all duration-500"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                        <p className="text-2xl font-bold text-amber-600" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.pendingTasks}</p>
                        <p className="text-sm text-amber-700">مهام معلقة</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                        <p className="text-2xl font-bold text-blue-600" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.inProgressTasks}</p>
                        <p className="text-sm text-blue-700">قيد التنفيذ</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <p className="text-2xl font-bold text-emerald-600" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.completedTasks}</p>
                        <p className="text-sm text-emerald-700">مكتملة</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100">
                        <p className="text-2xl font-bold text-violet-600" style={{ fontFamily: 'Arial, sans-serif' }}>{employeeStats.totalTasks}</p>
                        <p className="text-sm text-violet-700">إجمالي المهام</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Index;
