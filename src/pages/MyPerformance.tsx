import { fetchAllReportRows } from "@/lib/fetchAllReportRows";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageGuide } from "@/components/layout/PageGuide";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreviewMode } from "@/contexts/PreviewModeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, ShieldCheck, ShieldAlert, ListChecks, CheckCircle2, AlertTriangle, Award, Target } from "lucide-react";
import { Link } from "react-router-dom";

export default function MyPerformance() {
  const { user } = useAuth();
  const { isPreviewMode } = usePreviewMode();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState({
    qTotal: 0, qOpen: 0, qAnswered: 0, qValidated: 0, qRejected: 0,
    avgScore: null as number | null,
    tasksTotal: 0, tasksDone: 0, tasksPending: 0,
    accTasksTotal: 0, accTasksDone: 0,
  });
  const [recentChecks, setRecentChecks] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (isPreviewMode) {
      setEmployee({full_name: "معاينة", job_role: "وضع المعاينة"});
      setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        const {data: emp, error} = await supabase.from("employees").select("id,user_id,organization_id,full_name,job_role").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (!emp) throw new Error("لم يتم العثور على ملف الموظف.");
        const sb = supabase as any;
        const [qs, tasks, accTasks] = await Promise.all([
          fetchAllReportRows<any>(sb.from("accountability_questions").select("id,status,evidence_score,evidence_verdict")
            .eq("organization_id", emp.organization_id).eq("target_employee_id", emp.id).order("id")),
          fetchAllReportRows<any>(sb.from("tasks").select("status,id")
            .eq("organization_id", emp.organization_id)
            .or(`assigned_employee_id.eq.${emp.id},and(assigned_employee_id.is.null,user_id.eq.${user.id})`).order("id")),
          fetchAllReportRows<any>(sb.from("accountability_tasks").select("id,status")
            .eq("organization_id", emp.organization_id).eq("assigned_employee_id", emp.id).order("id")),
        ]);
        const checks: any[] = [];
        // Restrict evidence to this employee's questions, with bounded URL sizes.
        for (let i = 0; i < qs.length; i += 100) {
          const {data, error: evidenceError} = await sb.from("evidence_checks")
            .select("id,verdict,score,created_at,accountability_question_id")
            .eq("organization_id", emp.organization_id).in("accountability_question_id", qs.slice(i, i + 100).map(q => q.id))
            .order("created_at", {ascending: false}).order("id").limit(10);
          if (evidenceError) throw evidenceError;
          checks.push(...(data || []));
        }
        if (cancelled) return;
        const scores = qs.filter(q => q.evidence_score != null).map(q => Number(q.evidence_score));
        setEmployee(emp);
        setStats({
          qTotal: qs.length, qOpen: qs.filter(q => q.status === "open").length,
          qAnswered: qs.filter(q => q.status === "answered").length,
          qValidated: qs.filter(q => q.status === "validated").length,
          qRejected: qs.filter(q => q.status === "rejected").length,
          avgScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
          tasksTotal: tasks.length,
          tasksDone: tasks.filter(t => t.status === "completed" || t.status === "executed").length,
          tasksPending: tasks.filter(t => t.status !== "completed" && t.status !== "executed").length,
          accTasksTotal: accTasks.length, accTasksDone: accTasks.filter(t => t.status === "completed").length,
        });
        setRecentChecks(checks.sort((a,b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)).slice(0,10));
      } catch (error: any) {
        if (!cancelled) setLoadError(error.message || "تعذر تحميل بيانات الأداء.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, [user, isPreviewMode, retry]);

  if (loadError) return <DashboardLayout><div role="alert" className="p-6 space-y-4"><p>تعذر تحميل بيانات الأداء: {loadError}</p><button className="underline" onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</button></div></DashboardLayout>;

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  const validationRate = stats.qTotal ? Math.round((stats.qValidated / stats.qTotal) * 100) : 0;
  const taskRate = stats.tasksTotal ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0;
  const accRate = stats.accTasksTotal ? Math.round((stats.accTasksDone / stats.accTasksTotal) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <PageHeader
          icon={<Award className="w-6 h-6" />}
          title="أدائي"
          subtitle={`${employee?.full_name ?? ""}${employee?.job_role ? " — " + employee.job_role : ""}`}
        />
        <PageGuide
          description="هذه الصفحة هي بطاقتك الشخصية للأداء. تجمع نسب إنجاز مهامك، نتائج المساءلات، ومتوسط درجة إثباتاتك من فحص النظام التلقائي، لتمنحك صورة شاملة عن وضعك الوظيفي وفرص تطورك."
          features={[
            "متوسط درجة الإثباتات من الفحص التلقائي",
            "نسبة المساءلات المعتمدة مقابل المرفوضة",
            "نسبة إنجاز المهام العادية ومهام المساءلة",
            "توزيع تفصيلي لحالة المساءلات",
            "تتبّع التطور عبر الزمن",
          ]}
        />

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BigKpi title="متوسط درجة إثباتاتي" value={stats.avgScore === null ? "لم يُقيّم بعد" : `${stats.avgScore}/100`} hint={stats.avgScore === null ? "لا توجد إثباتات مقيّمة" : "من فحص النظام التلقائي"} tone="primary" icon={<TrendingUp />} />
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