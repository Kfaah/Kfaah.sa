import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, LayoutDashboard, Users, ListChecks, FileBarChart2,
  Lightbulb, ShieldAlert, Upload, HeartHandshake, Building2,
  Loader2, Sparkles, ExternalLink, Target, AlertTriangle, CheckCircle2,
  GitCompareArrows, CalendarCheck, ClipboardList, FileSpreadsheet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SourceLink } from "@/components/admin/SourceLink";

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

interface Profile {
  about: string | null;
  goals: string | null;
  website_url: string | null;
  store_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  snapchat_url: string | null;
  youtube_url: string | null;
  facebook_url: string | null;
}

interface DeepAnalysis {
  id: string;
  status: string;
  overall_assessment: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  recommendations: string[] | null;
  donations_summary: Record<string, unknown> | null;
  donors_segmentation: Record<string, unknown> | null;
  campaigns_analysis: Record<string, unknown> | null;
  website_insights: Record<string, unknown> | null;
  store_insights: Record<string, unknown> | null;
  social_insights: Record<string, unknown> | null;
  questions_generated: number;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface AccountabilityQuestion {
  id: string;
  title: string;
  question_text: string;
  category: string;
  priority: string;
  status: string;
  target_job_role: string;
  target_employee_id: string | null;
  expected_evidence: string | null;
  context: string | null;
  created_at: string;
}

interface AccountabilityTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_job_role: string | null;
  assigned_employee_id: string | null;
  due_date: string | null;
  ai_reason: string | null;
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "حرجة",
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة",
  answered: "تمت الإجابة",
  validated: "تم التحقق",
  rejected: "مرفوضة",
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};

export default function OrgInternalDashboard({ orgIdProp, initialTab }: { orgIdProp?: string; initialTab?: string } = {}) {
  const params = useParams<{ orgId: string }>();
  const orgId = orgIdProp ?? params.orgId;
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null);
  const [questions, setQuestions] = useState<AccountabilityQuestion[]>([]);
  const [aTasks, setATasks] = useState<AccountabilityTask[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; job_role: string | null }>>([]);
  const [counts, setCounts] = useState({
    employees: 0, tasks: 0, donations: 0, campaigns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "overview");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const loadAll = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgRes, profRes, analysisRes, qRes, tRes, empRes, donCount, campCount, taskCount] = await Promise.all([
        supabase.from("organizations").select("id,name,slug,logo_url").eq("id", orgId).maybeSingle(),
        supabase.from("organization_profiles").select("about,goals,website_url,store_url,twitter_url,instagram_url,tiktok_url,snapchat_url,youtube_url,facebook_url").eq("organization_id", orgId).maybeSingle(),
        supabase.from("deep_analyses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("accountability_questions").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
        supabase.from("accountability_tasks").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
        supabase.from("employees").select("id,full_name,job_role").eq("organization_id", orgId).limit(500),
        supabase.from("donations").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      ]);

      if (orgRes.data) setOrg(orgRes.data as OrgInfo);
      setProfile((profRes.data as Profile) ?? null);
      setAnalysis((analysisRes.data as unknown as DeepAnalysis) ?? null);
      setQuestions((qRes.data as unknown as AccountabilityQuestion[]) ?? []);
      setATasks((tRes.data as unknown as AccountabilityTask[]) ?? []);
      setEmployees(empRes.data ?? []);
      setCounts({
        employees: empRes.data?.length ?? 0,
        donations: donCount.count ?? 0,
        campaigns: campCount.count ?? 0,
        tasks: taskCount.count ?? 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [orgId]);

  const runDeepAnalysis = async () => {
    if (!orgId) return;
    setAnalyzing(true);
    toast.loading("جاري التحليل الذكي الشامل...", { id: "deep" });
    try {
      const { data, error } = await supabase.functions.invoke("deep-org-analysis", {
        body: { organization_id: orgId, trigger_source: "manual" },
      });
      if (error) throw error;
      toast.success(`تم التحليل بنجاح — ${data?.questions_generated ?? 0} مساءلة`, { id: "deep" });
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "فشل التحليل";
      toast.error(msg, { id: "deep" });
    } finally {
      setAnalyzing(false);
    }
  };

  const empMap = new Map(employees.map((e) => [e.id, e]));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8" dir="rtl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary via-accent to-primary/90 p-6 shadow-lg">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
              <GitCompareArrows className="h-8 w-8 text-white" />
              لوحة الجمعية الداخلية
            </h1>
            <p className="mt-1 text-white/90">
              رؤية شاملة · تقييم ذكي · مساءلات ذكية
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 text-white shadow-md ring-1 ring-white/30 backdrop-blur">
                {org?.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold leading-tight text-white">{org?.name ?? "الجمعية"}</div>
                <div className="text-xs text-white/80">{org?.slug}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={runDeepAnalysis}
              disabled={analyzing}
              className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-md ring-1 ring-white/30"
            >
              {analyzing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
              تشغيل التحليل الذكي
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 border-transparent">
              <Link to={`/admin/organizations/${orgId}/profile`}>
                <Building2 className="ml-2 h-4 w-4" /> ملف الجمعية
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="موظفون" value={counts.employees} icon={<Users className="w-4 h-4" />} color="from-indigo-500 to-violet-600" />
        <KpiCard label="مهام" value={counts.tasks} icon={<ListChecks className="w-4 h-4" />} color="from-cyan-500 to-blue-600" />
        <KpiCard label="تبرعات" value={counts.donations} icon={<HeartHandshake className="w-4 h-4" />} color="from-rose-500 to-pink-600" />
        <KpiCard label="حملات" value={counts.campaigns} icon={<Target className="w-4 h-4" />} color="from-amber-500 to-orange-600" />
        <KpiCard label="مساءلات" value={questions.length} icon={<ShieldAlert className="w-4 h-4" />} color="from-fuchsia-500 to-purple-600" />
        <KpiCard label="مهام مساءلة" value={aTasks.length} icon={<AlertTriangle className="w-4 h-4" />} color="from-emerald-500 to-teal-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList dir="rtl" className="h-auto w-full flex-wrap justify-center gap-0 border border-accent/40 bg-accent p-1.5 text-accent-foreground [&>[role=separator]]:mx-1 [&>[role=separator]]:h-6 [&>[role=separator]]:w-px [&>[role=separator]]:self-center [&>[role=separator]]:bg-accent-foreground/30">
          {(() => {
            const tabs = [
              { value: "uploads", label: "رفع الملفات", Icon: Upload },
              { value: "analysis", label: "التحليل الذكي", Icon: Sparkles },
              { value: "overview", label: "نظرة عامة", Icon: LayoutDashboard },
              { value: "employees", label: "الموظفون", Icon: Users },
              { value: "operational-plans-main", label: "الخطط التشغيلية", Icon: Target },
              { value: "executive-plans", label: "الخطط التنفيذية", Icon: CalendarCheck },
              { value: "tasks", label: "المهام", Icon: ClipboardList },
              { value: "operational-plans", label: "الخطط من التوصيات", Icon: ListChecks },
              { value: "accountability", label: "تحليل المساءلات", Icon: ShieldAlert },
              { value: "performance", label: "تقييم الأداء", Icon: Target },
              { value: "reports", label: "التقارير", Icon: FileBarChart2 },
              { value: "innovation", label: "الابتكار والتحديث", Icon: Lightbulb },
              { value: "donors", label: "المتبرعون", Icon: HeartHandshake },
            ];
            return tabs.flatMap((t, i) => {
              const trigger = (
                <TabsTrigger
                  key={t.value}
                  dir="rtl"
                  value={t.value}
                  className="gap-2 text-accent-foreground/90 hover:bg-accent-foreground/10 data-[state=active]:bg-background data-[state=active]:text-foreground"
                >
                  <t.Icon className="h-4 w-4" /> {t.label}
                </TabsTrigger>
              );
              return i < tabs.length - 1
                ? [trigger, <span key={`sep-${i}`} role="separator" aria-hidden="true" />]
                : [trigger];
            });
          })()}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-6 space-y-4" dir="rtl">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
            <Card className="order-1 border-primary/20 bg-gradient-to-bl from-primary/5 via-background to-background" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle className="flex items-center justify-start gap-2 text-right">
                  <span>التقييم العام</span>
                  <Sparkles className="h-5 w-5 text-primary" />
                </CardTitle>
                <CardDescription className="text-right">
                  {analysis?.completed_at ? `آخر تحليل: ${new Date(analysis.completed_at).toLocaleString("ar-SA")}` : "لم يتم تشغيل التحليل بعد"}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-right">
                {analysis?.overall_assessment ? (
                  <p className="whitespace-pre-line leading-relaxed text-foreground/90">{analysis.overall_assessment}</p>
                ) : (
                  <EmptyState text="سيظهر التقييم العام تلقائياً بعد تشغيل التحليل الذكي من تبويب «التحليل الذكي»." />
                )}
              </CardContent>
            </Card>

            <Card className="order-2" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle className="flex items-center justify-start gap-2 text-right">
                  <Building2 className="h-5 w-5 text-primary" /> المصادر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-right text-sm" dir="rtl">
                <SourceLink label="الموقع الإلكتروني" url={profile?.website_url} />
                <SourceLink label="المتجر" url={profile?.store_url} />
                <SourceLink label="X (تويتر)" url={profile?.twitter_url} />
                <SourceLink label="Instagram" url={profile?.instagram_url} />
                <SourceLink label="TikTok" url={profile?.tiktok_url} />
                <SourceLink label="YouTube" url={profile?.youtube_url} />
                <SourceLink label="Snapchat" url={profile?.snapchat_url} />
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ListCard title="نقاط القوة" items={analysis?.strengths ?? []} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} emptyText="لا توجد بعد" tone="emerald" />
            <ListCard title="الفجوات الحرجة" items={analysis?.gaps ?? []} icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} emptyText="لا توجد فجوات مرصودة" tone="amber" />
          </div>

          <ListCard title="التوصيات التنفيذية" items={analysis?.recommendations ?? []} icon={<Target className="w-5 h-5 text-orange-400" />} emptyText="لا توجد توصيات بعد" tone="primary" />
        </TabsContent>

        {/* ANALYSIS */}
        <TabsContent value="analysis" className="space-y-4 mt-6" dir="rtl">
          <Card className="border-primary/20 bg-gradient-to-bl from-primary/5 via-background to-background">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-right">
                <p className="font-semibold">تشغيل التحليل الذكي</p>
                <p className="text-sm text-muted-foreground">
                  يعتمد التحليل على آخر الملفات المرفوعة لهذه الجمعية ومصادرها الرقمية.
                </p>
              </div>
              <Button onClick={runDeepAnalysis} disabled={analyzing} size="lg" className="gap-2">
                {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {analysis ? "إعادة تشغيل التحليل" : "تشغيل التحليل الذكي"}
              </Button>
            </CardContent>
          </Card>
          {!analysis ? (
            <Card>
              <CardContent className="py-12">
                <EmptyState text="لا يوجد تحليل ذكي بعد. ارفع الملفات أولاً ثم اضغط زر التشغيل أعلاه." />
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <InsightCard title="رؤى الموقع الإلكتروني" data={analysis.website_insights} />
              <InsightCard title="رؤى المتجر" data={analysis.store_insights} />
              <InsightCard title="رؤى التواصل الاجتماعي" data={analysis.social_insights} />
              <InsightCard title="تحليل الحملات" data={analysis.campaigns_analysis} />
              <InsightCard title="شرائح المتبرعين" data={analysis.donors_segmentation} />
              <InsightCard title="ملخص التبرعات" data={analysis.donations_summary} />
            </div>
          )}
        </TabsContent>

        {/* ACCOUNTABILITY */}
        <TabsContent value="accountability" className="space-y-4 mt-6" dir="rtl">
          <Card>
            <CardHeader>
              <CardTitle>مساءلات الموظفين ({questions.length})</CardTitle>
              <CardDescription>أسئلة مولّدة من التحليل الذكي ومُوزّعة بحسب الدور الوظيفي</CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <EmptyState text="لا توجد مساءلات بعد. شغّل التحليل الذكي." onAction={runDeepAnalysis} actionLabel="تشغيل" />
              ) : (
                <div className="space-y-3">
                  {questions.map((q) => {
                    const emp = q.target_employee_id ? empMap.get(q.target_employee_id) : null;
                    return (
                      <div key={q.id} className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={PRIORITY_STYLE[q.priority] ?? ""}>
                              {PRIORITY_LABEL[q.priority] ?? q.priority}
                            </Badge>
                            <Badge variant="secondary">{q.category}</Badge>
                            <Badge variant="outline">{STATUS_LABEL[q.status] ?? q.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {emp ? `→ ${emp.full_name}` : `الدور: ${q.target_job_role}`}
                          </div>
                        </div>
                        <h4 className="font-semibold mb-1">{q.title}</h4>
                        <p className="text-sm text-foreground/85 leading-relaxed">{q.question_text}</p>
                        {q.context && <p className="text-xs text-muted-foreground mt-2 italic">السياق: {q.context}</p>}
                        {q.expected_evidence && (
                          <p className="text-xs mt-2 text-primary">
                            <span className="font-semibold">الإثبات المتوقع:</span> {q.expected_evidence}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {aTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>مهام مساءلة مولّدة ({aTasks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المهمة</TableHead>
                      <TableHead className="text-right">الأولوية</TableHead>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aTasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell><Badge variant="outline" className={PRIORITY_STYLE[t.priority]}>{PRIORITY_LABEL[t.priority] ?? t.priority}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.target_job_role ?? "—"}</TableCell>
                        <TableCell className="text-sm">{t.assigned_employee_id ? empMap.get(t.assigned_employee_id)?.full_name ?? "—" : "—"}</TableCell>
                        <TableCell><Badge>{STATUS_LABEL[t.status] ?? t.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EMPLOYEES */}
        <TabsContent value="employees" className="mt-6" dir="rtl">
          <Card>
            <CardHeader>
              <CardTitle>الموظفون ({employees.length})</CardTitle>
              <CardDescription>عرض سريع — للإدارة الكاملة استخدم لوحة الموظفين</CardDescription>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? <EmptyState text="لا يوجد موظفون مسجلون." /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الدور الوظيفي</TableHead>
                      <TableHead className="text-right">عدد المساءلات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((e) => {
                      const qCount = questions.filter((q) => q.target_employee_id === e.id || (q.target_job_role && e.job_role && q.target_job_role === e.job_role)).length;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{e.job_role ?? "—"}</TableCell>
                          <TableCell><Badge variant={qCount > 0 ? "default" : "secondary"}>{qCount}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TASKS / REPORTS / INNOVATION / UPLOADS / DONORS - placeholder summaries linking to existing pages */}
        <TabsContent value="tasks" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/tasks" title="المهام" />
        </TabsContent>
        <TabsContent value="reports" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/admin/reports" title="التقارير" embedSlug={false} />
        </TabsContent>
        <TabsContent value="innovation" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/admin/innovation" title="الابتكار والتحديث" embedSlug={false} />
        </TabsContent>
        <TabsContent value="uploads" className="mt-6" dir="rtl">
          <OrgUploadsTab orgId={orgId!} orgName={org?.name ?? ""} onRunAnalysis={runDeepAnalysis} analyzing={analyzing} />
        </TabsContent>
        <TabsContent value="operational-plans" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/admin/action-plans" title="الخطط من التوصيات" embedSlug={false} />
        </TabsContent>
        <TabsContent value="operational-plans-main" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/operational-plans" title="الخطط التشغيلية" />
        </TabsContent>
        <TabsContent value="executive-plans" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/executive-plans" title="الخطط التنفيذية" />
        </TabsContent>
        <TabsContent value="performance" className="mt-6" dir="rtl">
          <EmbeddedOrgPage slug={org?.slug} path="/performance" title="تقييم الأداء" />
        </TabsContent>
        <TabsContent value="donors" className="mt-6" dir="rtl">
          <PlaceholderTab title="المتبرعون" desc={`إجمالي التبرعات المسجلة: ${counts.donations}. شريحة مفصّلة قادمة بعد رفع الملف الضخم.`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between gap-3 p-4 text-right" dir="rtl">
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white shadow`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}


function ListCard({ title, items, icon, emptyText, tone }: { title: string; items: string[]; icon: React.ReactNode; emptyText: string; tone: "emerald" | "amber" | "primary" }) {
  return (
    <Card
      dir="rtl"
      className="relative overflow-hidden border border-amber-300/40 ring-1 ring-amber-300/20 text-white shadow-lg backdrop-blur-sm"
      style={{
        background:
          "linear-gradient(135deg, hsl(190 50% 28%) 0%, hsl(192 55% 24%) 50%, hsl(195 60% 20%) 100%)",
      }}
    >
      <CardHeader className="text-right">
        <CardTitle className="flex items-center justify-start gap-2 text-right text-base text-white">
          {icon}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        {items.length === 0 ? (
          <p className="text-sm text-white/80">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s, i) => (
              <li key={i} className="flex items-start justify-start gap-2 text-right text-sm leading-relaxed text-white">
                <span className="mt-1 flex-shrink-0 text-amber-200">•</span>
                <span className="flex-1">{s}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard({ title, data }: { title: string; data: Record<string, unknown> | null | undefined }) {
  return (
    <Card dir="rtl">
      <CardHeader className="text-right">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        {!data || Object.keys(data).length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
        ) : (
          <div className="space-y-2 text-sm">
            {Object.entries(data).map(([k, v]) => (
              <div key={k} className="text-right">
                <div className="font-semibold text-xs text-muted-foreground uppercase mb-1">{k}</div>
                <div className="text-foreground/90">
                  {Array.isArray(v) ? (
                    v.length === 0 ? <span className="text-muted-foreground">—</span> : (
                      <ul className="list-disc space-y-1 pr-4">{v.map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul>
                    )
                  ) : typeof v === "object" && v !== null ? (
                    <pre className="overflow-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(v, null, 2)}</pre>
                  ) : (
                    String(v ?? "—")
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text, onAction, actionLabel }: { text: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 gap-3">
      <p className="text-muted-foreground">{text}</p>
      {onAction && actionLabel && (
        <Button onClick={onAction} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Sparkles className="w-4 h-4 ml-2" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

function PlaceholderTab({ title, desc, linkTo, linkLabel }: { title: string; desc: string; linkTo?: string; linkLabel?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      {linkTo && linkLabel && (
        <CardContent>
          <Button asChild variant="outline"><Link to={linkTo}>{linkLabel}</Link></Button>
        </CardContent>
      )}
    </Card>
  );
}

function EmbeddedOrgPage({
  slug,
  path,
  title,
  embedSlug = true,
}: {
  slug?: string | null;
  path: string;
  title: string;
  embedSlug?: boolean;
}) {
  if (!slug) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>جارٍ تحميل بيانات الجمعية…</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const src = embedSlug ? `/${slug}${path}?embedded=1` : `${path}?embedded=1&org=${slug}`;
  return (
    <div className="w-full -mx-2">
      <iframe
        src={src}
        title={title}
        className="w-full border-0 bg-transparent block"
        style={{ height: "calc(100vh - 120px)", minHeight: 800 }}
      />
    </div>
  );
}

/* ---------- inline uploader for admin (org-scoped) ---------- */

const SCHEMA_LABELS: Record<string, { label: string; color: string }> = {
  donations: { label: "تبرعات", color: "bg-emerald-500" },
  failed_donations: { label: "تبرعات فاشلة", color: "bg-red-500" },
  bank_transfers: { label: "تحويلات بنكية", color: "bg-blue-500" },
  abandoned_carts: { label: "سلال متروكة", color: "bg-orange-500" },
  campaigns: { label: "حملات", color: "bg-purple-500" },
  subscriptions: { label: "استقطاعات/اشتراكات", color: "bg-cyan-500" },
  gifts: { label: "إهداءات", color: "bg-pink-500" },
  unknown: { label: "غير معروف", color: "bg-slate-500" },
};

type UploadStatus = "queued" | "uploading" | "success" | "error";
interface PendingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  result?: { detected: string; inserted: number; duplicates: number; failed: number };
  error?: string;
}
interface HistoryRow {
  id: string;
  file_name: string;
  detected_schema: string | null;
  status: string;
  inserted_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  for_date: string | null;
  created_at: string;
}

function OrgUploadsTab({ orgId, orgName, onRunAnalysis, analyzing }: { orgId: string; orgName: string; onRunAnalysis: () => Promise<void> | void; analyzing: boolean }) {
  const [forDate, setForDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  let fileInputEl: HTMLInputElement | null = null;

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("data_uploads_log")
      .select("id,file_name,detected_schema,status,inserted_rows,failed_rows,duplicate_rows,for_date,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); /* eslint-disable-next-line */ }, [orgId]);

  const processFile = async (pf: PendingFile) => {
    setPending((prev) => prev.map((p) => p.id === pf.id ? { ...p, status: "uploading", progress: 30 } : p));
    try {
      const formData = new FormData();
      formData.append("file", pf.file);
      if (forDate) formData.append("for_date", forDate);
      formData.append("target_organization_id", orgId);

      const { data, error } = await supabase.functions.invoke("process-upload", { body: formData });
      if (error) throw error;

      setPending((prev) => prev.map((p) => p.id === pf.id ? {
        ...p, status: "success", progress: 100,
        result: { detected: data.detected, inserted: data.inserted ?? 0, duplicates: data.duplicates ?? 0, failed: data.failed ?? 0 },
      } : p));
      toast.success(`تم رفع "${pf.file.name}" — ${data.inserted ?? 0} سجل لجمعية ${orgName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الرفع";
      setPending((prev) => prev.map((p) => p.id === pf.id ? { ...p, status: "error", progress: 100, error: msg } : p));
      toast.error(`فشل رفع "${pf.file.name}": ${msg}`);
    } finally {
      loadHistory();
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (arr.length === 0) {
      toast.error("الرجاء اختيار ملفات Excel أو CSV فقط");
      return;
    }
    const newPending: PendingFile[] = arr.map((f) => ({
      id: crypto.randomUUID(), file: f, status: "queued", progress: 0,
    }));
    setPending((prev) => [...prev, ...newPending]);
    // Do NOT auto-upload — wait for user to click "بدء الرفع والتحليل".
  };

  const removeFile = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  };

  const startBatch = async () => {
    const queue = pending.filter((p) => p.status === "queued" || p.status === "error");
    if (queue.length === 0) {
      toast.error("لا توجد ملفات في قائمة الانتظار");
      return;
    }
    setBatchRunning(true);
    try {
      for (const pf of queue) {
        await processFile(pf);
      }
      toast.success("اكتمل رفع الملفات. انتقل إلى تبويب «التحليل الذكي» لتشغيل التحليل.");
    } finally {
      setBatchRunning(false);
    }
  };

  const queuedCount = pending.filter((p) => p.status === "queued" || p.status === "error").length;

  return (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="for_date_admin">تاريخ البيانات</Label>
              <Input id="for_date_admin" type="date" value={forDate} onChange={(e) => setForDate(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground pb-2">
              سيتم ربط الملفات المرفوعة بجمعية: <span className="font-semibold text-foreground">{orgName}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent
          className={`p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputEl?.click()}
        >
          <input
            ref={(el) => { fileInputEl = el; }}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
              <Upload className="w-10 h-10 text-rose-500" />
            </div>
            <div>
              <p className="text-xl font-semibold">اسحب الملفات هنا</p>
              <p className="text-sm text-muted-foreground mt-1">
                ارفع كل الملفات (تبرعات، حملات، استقطاعات، سلال…) ثم اضغط <span className="font-semibold text-foreground">بدء الرفع</span>. ثم انتقل إلى تبويب <span className="font-semibold text-foreground">التحليل الذكي</span> لتشغيل التحليل.
              </p>
            </div>
            <Button variant="outline" type="button">
              <FileSpreadsheet className="w-4 h-4 ml-2" /> اختر ملفات
            </Button>
          </div>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>قائمة الملفات ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Files Grid - Side by Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pending.map((p) => {
                const schema = p.result?.detected ? SCHEMA_LABELS[p.result.detected] ?? SCHEMA_LABELS.unknown : null;
                return (
                  <div key={p.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{p.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(p.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      {(p.status === "queued" || p.status === "error") && !batchRunning && (
                        <Button variant="ghost" size="sm" onClick={() => removeFile(p.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {p.status === "queued" && <Badge variant="secondary" className="w-full justify-center">في الانتظار</Badge>}
                    {p.status === "uploading" && (
                      <>
                        <Badge className="bg-blue-500 w-full justify-center"><Loader2 className="w-3 h-3 ml-1 animate-spin" />جاري المعالجة</Badge>
                        <Progress value={p.progress} className="h-2" />
                      </>
                    )}
                    {p.status === "success" && schema && (
                      <Badge className={`${schema.color} w-full justify-center`}><CheckCircle2 className="w-3 h-3 ml-1" />{schema.label}</Badge>
                    )}
                    {p.status === "error" && <Badge variant="destructive" className="w-full justify-center"><XCircle className="w-3 h-3 ml-1" />فشل</Badge>}

                    {p.status === "success" && p.result && (
                      <div className="flex flex-wrap gap-2 text-xs pt-1">
                        <span className="text-emerald-600 font-medium">✓ {p.result.inserted}</span>
                        {p.result.duplicates > 0 && <span className="text-amber-600">⚠ {p.result.duplicates}</span>}
                        {p.result.failed > 0 && <span className="text-red-600">✗ {p.result.failed}</span>}
                      </div>
                    )}
                    {p.status === "error" && p.error && (
                      <div className="flex items-start gap-2 text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{p.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Upload & Analyze Buttons - Bottom */}
            <div className="flex items-center justify-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                size="lg"
                onClick={() => fileInputEl?.click()}
                disabled={batchRunning || analyzing}
                className="gap-2"
              >
                <Upload className="w-5 h-5" />
                إضافة ملفات
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPending((prev) => prev.filter((p) => p.status !== "success"))}
                disabled={batchRunning || analyzing || !pending.some((p) => p.status === "success")}
              >
                مسح المكتملة
              </Button>
              <Button
                onClick={startBatch}
                disabled={batchRunning || analyzing || queuedCount === 0}
                size="lg"
                className="bg-primary text-primary-foreground gap-2"
              >
                {batchRunning || analyzing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري المعالجة…</>
                ) : (
                  <><Upload className="w-5 h-5" /> بدء الرفع ({queuedCount})</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>سجل الرفع لهذه الجمعية</CardTitle></CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد عمليات رفع سابقة</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الملف</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">تاريخ البيانات</TableHead>
                  <TableHead className="text-right">المُدخل</TableHead>
                  <TableHead className="text-right">المكرر</TableHead>
                  <TableHead className="text-right">الفاشل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الرفع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => {
                  const schema = row.detected_schema ? SCHEMA_LABELS[row.detected_schema] ?? SCHEMA_LABELS.unknown : SCHEMA_LABELS.unknown;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-xs truncate font-medium">{row.file_name}</TableCell>
                      <TableCell><Badge className={`${schema.color} text-white`}>{schema.label}</Badge></TableCell>
                      <TableCell>{row.for_date ?? "—"}</TableCell>
                      <TableCell className="text-emerald-600 font-medium">{row.inserted_rows}</TableCell>
                      <TableCell className="text-amber-600">{row.duplicate_rows}</TableCell>
                      <TableCell className="text-red-600">{row.failed_rows}</TableCell>
                      <TableCell>
                        {row.status === "completed" && <Badge className="bg-emerald-500">مكتمل</Badge>}
                        {row.status === "completed_with_errors" && <Badge className="bg-amber-500">مكتمل مع أخطاء</Badge>}
                        {row.status === "failed" && <Badge variant="destructive">فشل</Badge>}
                        {row.status === "processing" && <Badge variant="secondary">جاري المعالجة</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(row.created_at).toLocaleString("ar-SA")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}