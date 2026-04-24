import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, ShieldCheck, ShieldAlert, ListChecks, CheckCircle2, AlertTriangle, Award, Target } from "lucide-react";
import { Link } from "react-router-dom";

export default function MyPerformance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState({
    qTotal: 0, qOpen: 0, qAnswered: 0, qValidated: 0, qRejected: 0,
    avgScore: 0,
    tasksTotal: 0, tasksDone: 0, tasksPending: 0,
    accTasksTotal: 0, accTasksDone: 0,
  });
  const [recentChecks, setRecentChecks] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setEmployee(emp);
      if (!emp) { setLoading(false); return; }

      const qRes: any = await supabase.from("accountability_questions")
        .select("status,evidence_score,evidence_verdict")
        .eq("target_employee_id", emp.id);
      const tRes: any = await supabase.from("tasks")
        .select("status,id")
        .eq("assigned_to", user.id);
      const accTRes: any = await supabase.from("accountability_tasks")
        .select("status")
        .eq("assigned_employee_id", emp.id);
      const evRes: any = await supabase.from("evidence_checks")
        .select("id,verdict,score,created_at,accountability_question_id")
        .order("created_at", { ascending: false }).limit(10);

      const qs = (qRes.data ?? []) as any[];
      const scores = qs.filter((q) => q.evidence_score != null).map((q) => Number(q.evidence_score));
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      const tasks = (tRes.data ?? []) as any[];
      const accTasks = (accTRes.data ?? []) as any[];

      setStats({
        qTotal: qs.length,
        qOpen: qs.filter((q) => q.status === "open").length,
        qAnswered: qs.filter((q) => q.status === "answered").length,
        qValidated: qs.filter((q) => q.status === "validated").length,
        qRejected: qs.filter((q) => q.status === "rejected").length,
        avgScore: avg,
        tasksTotal: tasks.length,
        tasksDone: tasks.filter((t) => t.status === "completed" || t.status === "executed").length,
        tasksPending: tasks.filter((t) => t.status !== "completed" && t.status !== "executed").length,
        accTasksTotal: accTasks.length,
        accTasksDone: accTasks.filter((t) => t.status === "completed").length,
      });
      setRecentChecks((evRes.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  const validationRate = stats.qTotal ? Math.round((stats.qValidated / stats.qTotal) * 100) : 0;
  const taskRate = stats.tasksTotal ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;
  const accRate = stats.accTasksTotal ? Math.round((stats.accTasksDone / stats.accTasksTotal) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto" dir="rtl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">أدائي</h1>
            <p className="text-sm text-muted-foreground">{employee?.full_name} — {employee?.job_role}</p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BigKpi title="متوسط درجة إثباتاتي" value={`${stats.avgScore}/100`} hint="من فحص النظام التلقائي" tone="primary" icon={<TrendingUp />} />
          <BigKpi title="نسبة المساءلات المعتمدة" value={`${validationRate}%`} hint={`${stats.qValidated} من ${stats.qTotal}`} tone="emerald" icon={<ShieldCheck />} />
          <BigKpi title="نسبة إنجاز مهامي" value={`${taskRate}%`} hint={`${stats.tasksDone} من ${stats.tasksTotal}`} tone="blue" icon={<ListChecks />} />
          <BigKpi title="إنجاز مهام المساءلة" value={`${accRate}%`} hint={`${stats.accTasksDone} من ${stats.accTasksTotal}`} tone="amber" icon={<Target />} />
        </div>

        {/* Mid: progress bars */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-fuchsia-500" /> توزيع مساءلاتي</CardTitle>
              <CardDescription>الحالة الحالية لكل المساءلات الموجَّهة إليك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Bar label="مفتوحة" value={stats.qOpen} total={stats.qTotal} tone="amber" />
              <Bar label="قيد المراجعة" value={stats.qAnswered} total={stats.qTotal} tone="blue" />
              <Bar label="مُعتمدة" value={stats.qValidated} total={stats.qTotal} tone="emerald" />
              <Bar label="مرفوضة" value={stats.qRejected} total={stats.qTotal} tone="red" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" /> مهامي</CardTitle>
              <CardDescription>المهام العادية + مهام المساءلة المُولّدة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Bar label="مهام عامة منجزة" value={stats.tasksDone} total={stats.tasksTotal} tone="emerald" />
              <Bar label="مهام عامة قيد التنفيذ" value={stats.tasksPending} total={stats.tasksTotal} tone="amber" />
              <Bar label="مهام مساءلة منجزة" value={stats.accTasksDone} total={stats.accTasksTotal} tone="emerald" />
            </CardContent>
          </Card>
        </div>

        {/* Recent checks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500" /> آخر فحوصات لإثباتاتي</CardTitle>
          </CardHeader>
          <CardContent>
            {recentChecks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">لا توجد فحوصات بعد. ابدأ بالإجابة على <Link to="/my-accountability" className="text-primary underline">مساءلاتك</Link>.</div>
            ) : (
              <ul className="space-y-2">
                {recentChecks.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <VerdictPill v={c.verdict} />
                      <span className="text-sm font-medium">درجة: {c.score ?? 0}/100</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar-SA")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {stats.qOpen > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>لديك <strong>{stats.qOpen}</strong> مساءلة مفتوحة بانتظار إجابتك.</span>
              </div>
              <Link to="/my-accountability" className="text-primary font-semibold hover:underline">انتقل للإجابة ←</Link>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function BigKpi({ title, value, hint, icon, tone }: { title: string; value: string; hint: string; icon: React.ReactNode; tone: "primary"|"emerald"|"blue"|"amber" }) {
  const colors = {
    primary: "from-fuchsia-500 to-pink-600",
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-sky-500 to-blue-600",
    amber: "from-amber-500 to-orange-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors} flex items-center justify-center text-white shadow`}>{icon}</div>
        </div>
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm font-medium text-foreground/80 mt-1">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      </CardContent>
    </Card>
  );
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "amber"|"blue"|"emerald"|"red" }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const color = {
    amber: "[&>div]:bg-amber-500",
    blue: "[&>div]:bg-sky-500",
    emerald: "[&>div]:bg-emerald-500",
    red: "[&>div]:bg-red-500",
  }[tone];
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span><span className="text-muted-foreground">{value}/{total} ({pct}%)</span>
      </div>
      <Progress value={pct} className={color} />
    </div>
  );
}

function VerdictPill({ v }: { v: string | null }) {
  if (!v) return <Badge variant="secondary">—</Badge>;
  const styles: Record<string, string> = {
    accepted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    partial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    insufficient: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    rejected: "bg-red-500/15 text-red-700 border-red-500/30",
  };
  const labels: Record<string, string> = {
    accepted: "مقبول كامل", partial: "مقبول جزئيًا", insufficient: "ناقص", rejected: "مرفوض",
  };
  return <Badge variant="outline" className={styles[v] ?? ""}>{labels[v] ?? v}</Badge>;
}