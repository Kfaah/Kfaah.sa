import { useEffect, useState, forwardRef, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, LayoutDashboard, Users, ListChecks, FileBarChart2,
  Lightbulb, ShieldAlert, Upload, HeartHandshake, Building2,
  Loader2, Sparkles, ExternalLink, Target, AlertTriangle, CheckCircle2,
  GitCompareArrows, CalendarCheck, ClipboardList, FileSpreadsheet, XCircle,
  Database, FileText, IdCard, FolderOpen,
  UserPlus, Briefcase, Search, Mail, Phone, Crown, Pencil,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SourceLink } from "@/components/admin/SourceLink";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { useOrganization } from "@/contexts/OrganizationContext";
import { LogIn } from "lucide-react";
const OperationalPlans = lazy(() => import("@/pages/OperationalPlans"));
const ExecutivePlans = lazy(() => import("@/pages/ExecutivePlans"));
const TasksPage = lazy(() => import("@/pages/Tasks"));

// اسم مختصر لكل جمعية (سطران × 3-4 كلمات) للعرض في رأس اللوحة الداخلية
const ORG_SHORT_NAME: Record<string, [string, string]> = {
  sakinah: ["جمعية سكينة لبناء", "وترميم المساجد بجازان"],
  ataa: ["جمعية عطاء الخير", "لرعاية الأيتام وأسرهم"],
  atff: ["جمعية عطف لرعاية", "الأيتام بمحافظة العارضة"],
  nujabaa: ["جمعية نجباء لرعاية", "الأيتام بالفرشة"],
  sawab: ["جمعية صواب لتأهيل", "المتعافين من الإدمان"],
  maather: ["جمعية مآثر للدعوة والإرشاد", "وتوعية الجاليات بمحافظة العارضة"],
  "d-alqasaba": ["جمعية الدعوة والإرشاد", "وتوعية الجاليات بمركز القصبة"],
  harf: ["جمعية حرف", "التعليمية"],
};

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

export default function OrgInternalDashboard({
  orgIdProp,
  initialTab,
  standaloneTab = false,
}: {
  orgIdProp?: string;
  initialTab?: string;
  standaloneTab?: boolean;
} = {}) {
  const params = useParams<{ orgId: string }>();
  const orgId = orgIdProp ?? params.orgId;
  const navigate = useNavigate();
  const { isSuperAdmin } = useOrganization();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null);
  const [questions, setQuestions] = useState<AccountabilityQuestion[]>([]);
  const [aTasks, setATasks] = useState<AccountabilityTask[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; job_role: string | null; email: string | null; phone: string | null; avatar_url: string | null; title: string | null }>>([]);
  const [empSearch, setEmpSearch] = useState("");
  const [counts, setCounts] = useState({
    employees: 0, tasks: 0, donations: 0, campaigns: 0,
  });
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = Boolean(org);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "overview");

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Tabs that have been visited at least once. Once visited, we keep their
  // iframe mounted so that returning to the tab is instantaneous (no full
  // page/app reload inside the iframe).
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab ?? "overview"]));
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Background preload of the heaviest / most-used embedded tabs shortly
  // after the dashboard shell is ready. This makes the first click on
  // these tabs feel instant because the iframe is already warmed up.
  useEffect(() => {
    if (!org?.slug || standaloneTab) return;
    const t = setTimeout(() => {
      setVisitedTabs((prev) => {
        const next = new Set(prev);
        ["tasks", "reports", "performance", "operational-plans", "innovation"].forEach((k) => next.add(k));
        return next;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [org?.slug]);

  const loadAll = async () => {
    if (!orgId) return;
    // PERF: Render the page shell as soon as the organization header is
    // available. Heavier data (analysis, accountability, employees) streams
    // in afterwards so the UI never feels frozen behind a giant spinner.
    // Wave 1 — fast, unblocks the shell immediately.
    const wave1 = Promise.all([
      supabase.from("organizations").select("id,name,slug,logo_url").eq("id", orgId).maybeSingle(),
      supabase.from("organization_profiles").select("about,goals,website_url,store_url,twitter_url,instagram_url,tiktok_url,snapchat_url,youtube_url,facebook_url").eq("organization_id", orgId).maybeSingle(),
    ]).then(([orgRes, profRes]) => {
      if (orgRes.data) setOrg(orgRes.data as OrgInfo);
      setProfile((profRes.data as Profile) ?? null);
      setLoading(false); // hide the giant spinner ASAP
    });

    const needsDashboardData = !standaloneTab || ["overview", "analysis", "accountability", "employees", "uploads", "donors"].includes(activeTab);
    if (!needsDashboardData) {
      await wave1;
      return;
    }

    // Wave 2 — counts (all `head:true`, very cheap).
    const wave2 = Promise.all([
      supabase.from("donations").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ]).then(([donCount, campCount, taskCount, empCount]) => {
      setCounts({
        donations: donCount.count ?? 0,
        campaigns: campCount.count ?? 0,
        tasks: taskCount.count ?? 0,
        employees: empCount.count ?? 0,
      });
    });

    // Wave 3 — heavier rows used by specific tabs only. Streamed in.
    setEmployeesLoading(true);
    const wave3 = (async () => {
      const [analysisRes, qRes, tRes, empRes] = await Promise.all([
        supabase.from("deep_analyses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("accountability_questions").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
        supabase.from("accountability_tasks").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
        supabase.from("employees").select("id,full_name,job_role,email,phone,avatar_url,title").eq("organization_id", orgId).limit(500),
      ]);
      setAnalysis((analysisRes.data as unknown as DeepAnalysis) ?? null);
      setQuestions((qRes.data as unknown as AccountabilityQuestion[]) ?? []);
      setATasks((tRes.data as unknown as AccountabilityTask[]) ?? []);
      setEmployees(empRes.data ?? []);
      setEmployeesLoading(false);
    })();

    // Best-effort: resolve once everything is in. Errors in any wave are
    // intentionally non-fatal for the rest of the UI.
    try {
      await Promise.allSettled([wave1, wave2, wave3]);
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

  // PERF: Render the page shell immediately. The header / KPI cards / tabs
  // mount right away with placeholder values, and individual sections show
  // their own lightweight loading state as their data streams in. This
  // eliminates the large blocking spinner that previously hid the page.

  return (
    <div className={standaloneTab ? "space-y-6" : "space-y-6 p-8"} dir="rtl">
      {!standaloneTab && (
        <div
          className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          style={{ borderTop: `4px solid ${ORG_PRIMARY}` }}
        >
          {/* Subtle brand gradient backdrop */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{ background: ORG_GRADIENT }}
          />
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full opacity-10 blur-3xl"
            style={{ background: ORG_PRIMARY }}
          />
          <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full opacity-10 blur-3xl"
            style={{ background: ORG_ACCENT }}
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6 p-6">
            {/* Right: Identity */}
            <div className="flex min-w-0 flex-col items-center gap-3 sm:items-start">
              {/* Logo on top, full and untrimmed */}
              <div
                className="flex h-36 min-w-[8rem] max-w-[22rem] items-center justify-center overflow-hidden rounded-2xl bg-white px-5 py-3 shadow-md ring-1"
                style={{ ['--tw-ring-color' as string]: ORG_PRIMARY_RING, boxShadow: `0 4px 14px ${ORG_PRIMARY_SOFT}` }}
              >
                {org?.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="h-full w-auto max-w-full object-contain"
                  />
                ) : (
                  <Building2 className="h-10 w-10" style={{ color: ORG_PRIMARY }} />
                )}
              </div>
              {/* Subtitle pill below the logo (the org name is already part of the logo image) */}
              <div className="min-w-0 text-center sm:text-start">
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
                    style={{ backgroundColor: ORG_ACCENT_SOFT, color: ORG_PRIMARY, border: `1px solid ${ORG_ACCENT_RING}` }}
                  >
                    <Sparkles className="h-3 w-3" />
                    اللوحة الداخلية
                  </span>
                </div>
                <h1 className="sr-only">{org?.name ?? "الجمعية"}</h1>
                {org?.slug && ORG_SHORT_NAME[org.slug] && (
                  <div
                    className="mt-2 text-center sm:text-start font-extrabold leading-tight tracking-tight"
                    style={{ color: ORG_PRIMARY }}
                  >
                    <div className="text-lg sm:text-xl">{ORG_SHORT_NAME[org.slug][0]}</div>
                    {ORG_SHORT_NAME[org.slug][1] && (
                      <div className="text-base sm:text-lg text-foreground/80">
                        {ORG_SHORT_NAME[org.slug][1]}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  رؤية شاملة · تقييم ذكي · مساءلات ذكية
                </p>
              </div>
            </div>

            {/* Left: Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={runDeepAnalysis}
                disabled={analyzing}
                className="text-white shadow-md hover:opacity-95"
                style={{ background: ORG_GRADIENT }}
              >
                {analyzing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
                تشغيل التحليل الذكي
              </Button>
              <Button
                asChild
                variant="outline"
                style={{ borderColor: ORG_PRIMARY_RING, color: ORG_PRIMARY }}
              >
                <Link to={`/admin/organizations/${orgId}/profile`}>
                  <Building2 className="ml-2 h-4 w-4" /> ملف الجمعية
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      {!standaloneTab && <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="موظفون" value={counts.employees} icon={<Users className="w-4 h-4" />} />
        <KpiCard label="مهام" value={counts.tasks} icon={<ListChecks className="w-4 h-4" />} />
        <KpiCard label="تبرعات" value={counts.donations} icon={<HeartHandshake className="w-4 h-4" />} />
        <KpiCard label="حملات" value={counts.campaigns} icon={<Target className="w-4 h-4" />} />
        <KpiCard label="مساءلات" value={questions.length} icon={<ShieldAlert className="w-4 h-4" />} />
        <KpiCard label="مهام مساءلة" value={aTasks.length} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!standaloneTab && <TabsList dir="rtl" className="h-auto w-full flex-wrap justify-center gap-0 border border-accent/40 bg-accent p-1.5 text-accent-foreground [&>[role=separator]]:mx-1 [&>[role=separator]]:h-6 [&>[role=separator]]:w-px [&>[role=separator]]:self-center [&>[role=separator]]:bg-accent-foreground/30">
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
        </TabsList>}

        {/* OVERVIEW */}
        <TabsContent value="overview" className={standaloneTab ? "mt-0 space-y-4" : "mt-6 space-y-4"} dir="rtl">
          {standaloneTab && (
            <PageHeader
              icon={<LayoutDashboard />}
              title="نظرة عامة"
              subtitle="رؤية شاملة · تقييم ذكي · مساءلات ذكية"
              actions={
                <Button
                  onClick={runDeepAnalysis}
                  disabled={analyzing}
                  size="lg"
                  className="gap-2 bg-white shadow-md hover:bg-white/90"
                  style={{ color: ORG_PRIMARY }}
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  تشغيل التحليل الذكي
                </Button>
              }
            />
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
            <Card className="order-1 border-border bg-card" dir="rtl">
              <CardHeader className="text-right">
                <CardTitle className="flex items-center justify-start gap-2 text-right">
                  <span>التقييم العام</span>
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
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
                  <Building2 className="h-5 w-5 text-muted-foreground" /> المصادر
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
            <ListCard title="نقاط القوة" items={analysis?.strengths ?? []} icon={<CheckCircle2 className="w-5 h-5 text-muted-foreground" />} emptyText="لا توجد بعد" />
            <ListCard title="الفجوات الحرجة" items={analysis?.gaps ?? []} icon={<AlertTriangle className="w-5 h-5 text-muted-foreground" />} emptyText="لا توجد فجوات مرصودة" />
          </div>

          <ListCard title="التوصيات التنفيذية" items={analysis?.recommendations ?? []} icon={<Target className="w-5 h-5 text-muted-foreground" />} emptyText="لا توجد توصيات بعد" />
        </TabsContent>

        {/* ANALYSIS */}
        <TabsContent value="analysis" className={standaloneTab ? "mt-0 space-y-4" : "mt-6 space-y-4"} dir="rtl">
          {standaloneTab && (
            <PageHeader
              icon={<Sparkles />}
              title="التحليل الذكي"
              subtitle="يعتمد التحليل على آخر الملفات المرفوعة ومصادرها الرقمية"
              actions={
                <Button
                  onClick={runDeepAnalysis}
                  disabled={analyzing}
                  size="lg"
                  className="gap-2 bg-white shadow-md hover:bg-white/90"
                  style={{ color: ORG_PRIMARY }}
                >
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analysis ? "إعادة تشغيل التحليل" : "تشغيل التحليل الذكي"}
                </Button>
              }
            />
          )}
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
        <TabsContent value="accountability" className={standaloneTab ? "mt-0 space-y-4" : "mt-6 space-y-4"} dir="rtl">
          <PageHeader
            icon={<ShieldAlert />}
            title="مساءلات الموظفين"
            subtitle="أسئلة مولّدة من التحليل الذكي ومُوزّعة بحسب الدور الوظيفي"
          />
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
          <EmployeesShowcase
            employees={employees}
            loading={employeesLoading}
            questions={questions}
            empSearch={empSearch}
            setEmpSearch={setEmpSearch}
            orgSlug={org?.slug}
            canImpersonate={isSuperAdmin}
          />
        </TabsContent>

        {/* TASKS / REPORTS / INNOVATION / UPLOADS / DONORS - placeholder summaries linking to existing pages.
            Use forceMount so that once a tab has been visited (or preloaded),
            its iframe stays in the DOM and re-visits are instantaneous. */}
        <TabsContent
          value="tasks"
          forceMount
          className={cn(standaloneTab ? "mt-0" : "mt-6", "data-[state=inactive]:hidden")}
          dir="rtl"
        >
          {standaloneTab ? (
            <Suspense fallback={<div className="min-h-[70vh] bg-background" />}>
              <TasksPage embedded />
            </Suspense>
          ) : (
            <EmbeddedOrgPage
              slug={org?.slug}
              path="/tasks"
              title="المهام"
              isActive={visitedTabs.has("tasks")}
            />
          )}
        </TabsContent>
        <TabsContent
          value="reports"
          forceMount
          className={cn(standaloneTab ? "mt-0" : "mt-6", "data-[state=inactive]:hidden")}
          dir="rtl"
        >
          <EmbeddedOrgPage
            slug={org?.slug}
            path="/admin/reports"
            title="التقارير"
            embedSlug={false}
            isActive={visitedTabs.has("reports")}
          />
        </TabsContent>
        <TabsContent
          value="innovation"
          forceMount
          className={cn(standaloneTab ? "mt-0" : "mt-6", "data-[state=inactive]:hidden")}
          dir="rtl"
        >
          <EmbeddedOrgPage
            slug={org?.slug}
            path="/admin/innovation"
            title="الابتكار والتحديث"
            embedSlug={false}
            isActive={visitedTabs.has("innovation")}
          />
        </TabsContent>
        <TabsContent value="uploads" className={standaloneTab ? "mt-0" : "mt-6"} dir="rtl">
          <OrgUploadsTab orgId={orgId!} orgName={org?.name ?? ""} onRunAnalysis={runDeepAnalysis} analyzing={analyzing} />
        </TabsContent>
        <TabsContent
          value="operational-plans"
          forceMount
          className={cn(standaloneTab ? "mt-0" : "mt-6", "data-[state=inactive]:hidden")}
          dir="rtl"
        >
          <EmbeddedOrgPage
            slug={org?.slug}
            path="/admin/action-plans"
            title="الخطط من التوصيات"
            embedSlug={false}
            isActive={visitedTabs.has("operational-plans")}
          />
        </TabsContent>
        <TabsContent value="operational-plans-main" forceMount className={standaloneTab ? "mt-0 data-[state=inactive]:hidden" : "mt-6 data-[state=inactive]:hidden"} dir="rtl">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>}>
            {visitedTabs.has("operational-plans-main") ? <OperationalPlans embedded /> : <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>}
          </Suspense>
        </TabsContent>
        <TabsContent value="executive-plans" forceMount className={standaloneTab ? "mt-0 data-[state=inactive]:hidden" : "mt-6 data-[state=inactive]:hidden"} dir="rtl">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>}>
            {visitedTabs.has("executive-plans") ? <ExecutivePlans embedded /> : <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل…</div>}
          </Suspense>
        </TabsContent>
        <TabsContent
          value="performance"
          forceMount
          className={cn(standaloneTab ? "mt-0" : "mt-6", "data-[state=inactive]:hidden")}
          dir="rtl"
        >
          <EmbeddedOrgPage
            slug={org?.slug}
            path="/performance"
            title="تقييم الأداء"
            isActive={visitedTabs.has("performance")}
          />
        </TabsContent>
        <TabsContent value="donors" className={standaloneTab ? "mt-0" : "mt-6"} dir="rtl">
          <div className="space-y-4">
            <PageHeader
              icon={<HeartHandshake />}
              title="المتبرعون"
              subtitle={`إجمالي التبرعات المسجلة: ${counts.donations}. شريحة مفصّلة قادمة بعد رفع الملف الضخم.`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card
      className="relative overflow-hidden border-border"
      style={{
        background: `linear-gradient(135deg, ${ORG_PRIMARY_TINT} 0%, hsl(var(--card)) 60%, ${ORG_ACCENT_SOFT} 100%)`,
        borderRightWidth: 3,
        borderRightColor: ORG_PRIMARY,
      }}
    >
      <div
        className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full opacity-30 blur-2xl"
        style={{ background: ORG_ACCENT }}
      />
      <CardContent className="flex items-center justify-between gap-3 p-4 text-right" dir="rtl">
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold leading-none text-foreground">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-md"
          style={{ background: `linear-gradient(135deg, ${ORG_PRIMARY}, ${ORG_ACCENT})` }}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}


function ListCard({ title, items, icon, emptyText }: { title: string; items: string[]; icon: React.ReactNode; emptyText: string }) {
  return (
    <Card
      dir="rtl"
      className="relative overflow-hidden border-border bg-card shadow-sm"
      style={{ borderRightWidth: 3, borderRightColor: ORG_PRIMARY }}
    >
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: ORG_ACCENT }}
      />
      <CardHeader
        className="text-right"
        style={{
          background: `linear-gradient(to left, ${ORG_PRIMARY_TINT}, transparent)`,
          borderBottom: `1px solid ${ORG_PRIMARY_RING}`,
        }}
      >
        <CardTitle className="flex items-center justify-start gap-2 text-right text-base text-foreground">
          <span style={{ color: ORG_PRIMARY }}>{icon}</span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-right">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s, i) => (
              <li
                key={i}
                className="flex items-start justify-start gap-2 rounded-lg border border-border p-3 text-right text-sm leading-relaxed text-foreground transition-colors hover:shadow-sm"
                style={{
                  background: `linear-gradient(to left, ${ORG_PRIMARY_TINT}, transparent)`,
                  borderRightWidth: 2,
                  borderRightColor: ORG_PRIMARY,
                }}
              >
                <span className="mt-1 flex-shrink-0" style={{ color: ORG_PRIMARY }}>•</span>
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

const EmptyState = forwardRef<
  HTMLDivElement,
  { text: string; onAction?: () => void; actionLabel?: string }
>(function EmptyState({ text, onAction, actionLabel }, ref) {
  return (
    <div ref={ref} className="flex flex-col items-center justify-center text-center py-8 gap-3">
      <p className="text-muted-foreground">{text}</p>
      {onAction && actionLabel && (
        <Button onClick={onAction} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Sparkles className="w-4 h-4 ml-2" /> {actionLabel}
        </Button>
      )}
    </div>
  );
});

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

const EmbeddedOrgPage = forwardRef<HTMLDivElement, {
  slug?: string | null;
  path: string;
  title: string;
  embedSlug?: boolean;
  /**
   * When true, mount the iframe immediately even before the tab becomes
   * visible. Useful for preloading the most-used tabs in the background
   * so subsequent clicks render instantly.
   */
  preload?: boolean;
  /**
   * The currently-active tab value (if any). When provided, the iframe
   * will lazy-mount on first activation and then remain mounted, so
   * future visits to this tab are instant (no full reload).
   */
  isActive?: boolean;
}>(function EmbeddedOrgPage({ slug, path, title, embedSlug = true, preload = false, isActive = true }, ref) {
  // Once we have ever mounted the iframe, keep it mounted forever.
  const [hasMounted, setHasMounted] = useState<boolean>(preload || isActive);
  useEffect(() => {
    if (preload || isActive) setHasMounted(true);
  }, [preload, isActive]);

  if (!slug) {
    return (
      <Card ref={ref}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>جارٍ تحميل بيانات الجمعية…</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const src = embedSlug ? `/${slug}${path}?embedded=1` : `${path}?embedded=1&org=${slug}`;
  if (!hasMounted) {
    // Light placeholder until the tab is visited or preloaded.
    return (
      <div ref={ref} className="w-full" style={{ minHeight: 200 }} />
    );
  }
  return (
    <div ref={ref} className="w-full">
      <iframe
        src={src}
        title={title}
        className="w-full border-0 bg-transparent block"
        style={{ height: "calc(100vh - 120px)", minHeight: 800 }}
      />
    </div>
  );
});

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
type UploadCategory =
  | "auto"
  | "store_master"
  | "store_daily"
  | "staff_duties"
  | "reports"
  | "profiles"
  | "tasks"
  | "other";

interface PendingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  category: UploadCategory;
  result?: { detected: string; inserted: number; duplicates: number; failed: number };
  error?: string;
}

const ADMIN_CATEGORY_OPTIONS: {
  value: UploadCategory;
  label: string;
  desc: string;
  icon: any;
  color: string;
}[] = [
  { value: "auto", label: "بيانات عامة عن الجمعية", desc: "أي بيانات عامة عن الجمعية", icon: Sparkles, color: "from-fuchsia-500 to-pink-600" },
  { value: "store_master", label: "ملف المتجر (الضخم)", desc: "ملف تبرعات المتجر منذ تأسيس المتجر", icon: Database, color: "from-emerald-700 to-teal-800" },
  { value: "store_daily", label: "تبرعات المتجر اليومية", desc: "ملف تبرعات المتجر اليومي", icon: HeartHandshake, color: "from-emerald-500 to-teal-600" },
  { value: "staff_duties", label: "مهام موظفي المتجر", desc: "ربط المهام بكل موظف تلقائياً", icon: Users, color: "from-indigo-500 to-violet-600" },
  { value: "reports", label: "تقارير", desc: "تقارير دورية، ملفات تحليلية", icon: FileText, color: "from-rose-500 to-pink-600" },
  { value: "profiles", label: "ملفات تعريفية", desc: "بروفايلات، تعاريف موظفين/جمعية", icon: IdCard, color: "from-amber-500 to-orange-600" },
  { value: "tasks", label: "مهام/خطط", desc: "ملفات مهام أو خطط للأرشفة", icon: ListChecks, color: "from-orange-500 to-amber-600" },
  { value: "other", label: "ملفات أخرى", desc: "أي ملف آخر للأرشفة والتحليل", icon: FolderOpen, color: "from-slate-500 to-slate-600" },
];

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
  const [category, setCategory] = useState<UploadCategory>("auto");
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
      let result: PendingFile["result"];

      if (
        pf.category === "reports" ||
        pf.category === "profiles" ||
        pf.category === "tasks" ||
        pf.category === "other" ||
        pf.category === "staff_duties"
      ) {
        // أرشفة الملف في تخزين الجمعية + تسجيله في سجل الرفع
        const path = `${orgId}/archive/${pf.category}/${Date.now()}_${pf.file.name}`;
        const { error: upErr } = await supabase.storage
          .from("data-uploads")
          .upload(path, pf.file, { upsert: false });
        if (upErr) throw upErr;

        const { data: authData } = await supabase.auth.getUser();
        await supabase.from("data_uploads_log").insert({
          uploaded_by: authData.user?.id ?? "",
          organization_id: orgId,
          file_name: pf.file.name,
          file_type: pf.file.type || "application/octet-stream",
          detected_schema: pf.category,
          total_rows: 0,
          inserted_rows: 1,
          duplicate_rows: 0,
          failed_rows: 0,
          for_date: forDate || null,
          status: "completed",
          completed_at: new Date().toISOString(),
        });
        result = { detected: pf.category, inserted: 1, duplicates: 0, failed: 0 };
      } else {
        const formData = new FormData();
        formData.append("file", pf.file);
        if (forDate) formData.append("for_date", forDate);
        formData.append("target_organization_id", orgId);
        if (pf.category === "store_master") formData.append("source_kind", "store_master");
        if (pf.category === "store_daily") formData.append("source_kind", "store_daily");

        const { data, error } = await supabase.functions.invoke("process-upload", { body: formData });
        if (error) throw error;
        result = {
          detected: data.detected,
          inserted: data.inserted ?? 0,
          duplicates: data.duplicates ?? 0,
          failed: data.failed ?? 0,
        };
      }

      setPending((prev) => prev.map((p) => p.id === pf.id ? { ...p, status: "success", progress: 100, result } : p));
      toast.success(`تم رفع "${pf.file.name}" — ${result?.inserted ?? 0} سجل لجمعية ${orgName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الرفع";
      setPending((prev) => prev.map((p) => p.id === pf.id ? { ...p, status: "error", progress: 100, error: msg } : p));
      toast.error(`فشل رفع "${pf.file.name}": ${msg}`);
    } finally {
      loadHistory();
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const isDataCategory =
      category === "auto" ||
      category === "store_master" ||
      category === "store_daily";
    const arr = Array.from(files).filter((f) => {
      if (isDataCategory) return /\.(xlsx|xls|csv)$/i.test(f.name);
      return f.size <= 50 * 1024 * 1024;
    });
    if (arr.length === 0) {
      toast.error(
        isDataCategory
          ? "الرجاء اختيار ملفات Excel أو CSV فقط"
          : "تعذر قبول الملفات (الحد الأقصى 50MB)",
      );
      return;
    }
    const newPending: PendingFile[] = arr.map((f) => ({
      id: crypto.randomUUID(), file: f, status: "queued", progress: 0, category,
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
  const activeCat = ADMIN_CATEGORY_OPTIONS.find((c) => c.value === category)!;
  const ActiveIcon = activeCat.icon;
  const isDataCategory =
    category === "auto" || category === "store_master" || category === "store_daily";

  return (
    <div className="space-y-6" dir="rtl">
      {/* Category selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="w-5 h-5 text-primary" />
            نوع الملف
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ADMIN_CATEGORY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = category === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={`text-right rounded-xl border-2 p-3 transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${opt.color} flex items-center justify-center mb-2 shadow`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
            accept={isDataCategory ? ".xlsx,.xls,.csv" : undefined}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${activeCat.color} flex items-center justify-center shadow-lg`}>
              <ActiveIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-xl font-semibold">
                اسحب ملفات <span className="text-primary">{activeCat.label}</span> هنا
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isDataCategory
                  ? <>اختر ملفات Excel/CSV ثم اضغط <span className="font-semibold text-foreground">بدء الرفع</span>. ثم انتقل إلى تبويب <span className="font-semibold text-foreground">التحليل الذكي</span> لتشغيل التحليل.</>
                  : "أو انقر للاختيار — يقبل أي صيغة (PDF, Word, Excel, صور…) حتى 50MB"}
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

// ===== Creative Employees Showcase =====
function getInitials(name: string): string {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] ?? "") + (parts[1][0] ?? "");
}

const ORG_PRIMARY = "hsl(var(--primary))";
const ORG_PRIMARY_SOFT = "hsl(var(--primary) / 0.12)";
const ORG_PRIMARY_TINT = "hsl(var(--primary) / 0.08)";
const ORG_PRIMARY_RING = "hsl(var(--primary) / 0.28)";
const ORG_ACCENT = "hsl(var(--accent))";
const ORG_ACCENT_SOFT = "hsl(var(--accent) / 0.12)";
const ORG_ACCENT_RING = "hsl(var(--accent) / 0.4)";
const ORG_GRADIENT = `linear-gradient(to left, ${ORG_PRIMARY} 0%, ${ORG_PRIMARY} 68%, ${ORG_ACCENT} 100%)`;

function EmployeesShowcase({
  employees,
  loading,
  questions,
  empSearch,
  setEmpSearch,
  orgSlug,
  canImpersonate,
}: {
  employees: Array<{ id: string; full_name: string; job_role: string | null; email: string | null; phone: string | null; avatar_url: string | null; title: string | null }>;
  loading: boolean;
  questions: AccountabilityQuestion[];
  empSearch: string;
  setEmpSearch: (v: string) => void;
  orgSlug: string | undefined;
  canImpersonate: boolean;
}) {
  const branding = useOrgBranding();
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (employeeId: string, employeeName: string) => {
    if (!confirm(`الدخول بحساب ${employeeName}؟ سيتم تسجيل خروجك من حسابك الحالي.`)) return;
    try {
      setImpersonatingId(employeeId);
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { employee_id: employeeId },
      });
      if (error) throw error;
      if (!data?.token_hash || !data?.email) throw new Error("استجابة غير صالحة");
      // Sign out current session, then verify the magic link to sign in as the employee.
      await supabase.auth.signOut();
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: data.token_hash,
      });
      if (vErr) throw vErr;
      toast.success(`تم الدخول بحساب ${data.employee_name ?? employeeName}`);
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر الدخول كموظف");
      setImpersonatingId(null);
    }
  };

  const filtered = employees.filter((e) => {
    if (!empSearch.trim()) return true;
    const q = empSearch.trim().toLowerCase();
    return (
      e.full_name.toLowerCase().includes(q) ||
      (e.job_role ?? "").toLowerCase().includes(q) ||
      (e.title ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q)
    );
  });

  const totalQuestions = questions.length;
  const managersCount = employees.filter((e) =>
    /(مدير|رئيس|قائد|director|manager|head)/i.test((e.job_role ?? "") + " " + (e.title ?? ""))
  ).length;
  const addEmployeeHref = orgSlug ? `/${orgSlug}/employees/add` : "/employees/add";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users />}
        title="طاقم الموظفين"
        subtitle="منظومة بشرية متكاملة · إدارة ذكية · مساءلة عادلة"
        actions={
          <Link to={addEmployeeHref}>
            <Button
              size="lg"
              className="gap-2 bg-white text-primary shadow-md hover:bg-white/90"
              style={{ color: ORG_PRIMARY }}
            >
              <UserPlus className="h-5 w-5" />
              إضافة موظف جديد
            </Button>
          </Link>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={empSearch}
          onChange={(e) => setEmpSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الدور أو اللقب..."
          className="pr-10"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-3 text-muted-foreground">جاري تحميل الموظفين...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <p className="mt-3 text-muted-foreground">
            {employees.length === 0 ? "لا يوجد موظفون مسجلون بعد." : "لا توجد نتائج مطابقة."}
          </p>
          {employees.length === 0 && (
            <Link to={addEmployeeHref}>
              <Button className="mt-4 gap-2"><UserPlus className="h-4 w-4" /> إضافة أول موظف</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => {
            const qCount = questions.filter(
              (q) =>
                q.target_employee_id === e.id ||
                (q.target_job_role && e.job_role && q.target_job_role === e.job_role)
            ).length;
            const isLeader = /(مدير|رئيس|قائد|director|manager|head)/i.test(
              (e.job_role ?? "") + " " + (e.title ?? "")
            );
            const editHref = orgSlug ? `/${orgSlug}/employees/${e.id}/edit` : `/employees/${e.id}/edit`;
            return (
              <div
                key={e.id}
                className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  borderColor: 'hsl(var(--border))',
                  background: `linear-gradient(180deg, ${ORG_PRIMARY_TINT} 0%, hsl(var(--card)) 35%)`,
                }}
              >
                {/* شريط هوية علوي بتدرج */}
                <div
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ background: `linear-gradient(to left, ${ORG_PRIMARY}, ${ORG_ACCENT})` }}
                />
                <div
                  className="pointer-events-none absolute -left-12 -top-12 h-28 w-28 rounded-full opacity-25 blur-2xl"
                  style={{ background: ORG_ACCENT }}
                />
                <div className="relative flex items-start gap-3">
                  <div
                    className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white shadow-md ring-2 ring-white/60"
                    style={{ background: `linear-gradient(135deg, ${ORG_PRIMARY}, ${ORG_ACCENT})` }}
                  >
                    {e.avatar_url ? (
                      <img src={e.avatar_url} alt={e.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <span>{getInitials(e.full_name)}</span>
                    )}
                  </div>
                  {isLeader && (
                    <Badge
                      variant="outline"
                      className="gap-1 self-center bg-background shadow-sm"
                      style={{ borderColor: ORG_PRIMARY_RING, color: ORG_PRIMARY }}
                    >
                      <Crown className="h-3 w-3" /> قيادي
                    </Badge>
                  )}
                  <div className="ms-auto flex items-center gap-2">
                    <Link
                      to={editHref}
                      title="تعديل"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm opacity-0 transition-all hover:bg-muted group-hover:opacity-100"
                      style={{ ['--tw-text-opacity' as string]: 1 }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="relative mt-4">
                  <h3 className="truncate text-base font-bold text-foreground">{e.full_name}</h3>
                  {e.title && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      {e.title}
                    </p>
                  )}
                  <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    {e.job_role ?? "بدون دور"}
                  </p>
                </div>
                <div className="relative mt-3 space-y-1 text-xs text-muted-foreground">
                  {e.email && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{e.email}</span>
                    </div>
                  )}
                  {e.phone && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{e.phone}</span>
                    </div>
                  )}
                </div>
                <div className="relative mt-4 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">المساءلات:</span>
                    <span
                      className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ring-1"
                      style={
                        qCount > 0
                          ? { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--border))' }
                          : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))' }
                      }
                    >
                      {qCount}
                    </span>
                  </div>
                  <Link
                    to={editHref}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                    تعديل
                  </Link>
                </div>
                {canImpersonate && (
                  <button
                    type="button"
                    onClick={() => handleImpersonate(e.id, e.full_name)}
                    disabled={impersonatingId === e.id}
                    className="relative mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-50"
                    style={{ borderColor: ORG_PRIMARY_RING }}
                    title="الدخول إلى حساب هذا الموظف لمعاينة ما يراه"
                  >
                    {impersonatingId === e.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LogIn className="h-3 w-3" />
                    )}
                    دخول كموظف
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}