import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageGuide } from "@/components/layout/PageGuide";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Sparkles, TrendingUp, AlertTriangle, Target, Lightbulb, Users, Megaphone, RefreshCcw, CheckCircle2, MessageCircle, Phone, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Insight {
  id: string;
  insight_type: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  recommended_actions: string[] | null;
  generated_at: string;
  is_pinned: boolean;
}
interface SmartTask {
  id: string;
  task_type: string;
  category: string;
  priority: string;
  title: string;
  description: string | null;
  suggested_message: string | null;
  suggested_channel: string | null;
  status: string;
  due_date: string | null;
  context: any;
  created_at: string;
}
interface Idea {
  id: string;
  idea_type: string;
  title: string;
  description: string;
  target_segment: string | null;
  channels: string[] | null;
  expected_impact: string | null;
  effort_level: string | null;
  content_draft: string | null;
  hashtags: string[] | null;
  status: string;
  created_at: string;
}
interface Run {
  id: string;
  status: string;
  insights_generated: number;
  tasks_generated: number;
  ideas_generated: number;
  events_detected: number;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
}

interface FileAnalysis {
  id: string;
  file_name: string;
  ai_analysis: Record<string, unknown>;
  ai_analyzed_at: string | null;
}

type AnalysisRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnalysisRecord | null => {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as AnalysisRecord : null;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";

const field = (record: AnalysisRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
};

const safeLink = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

const sourceFindings = (source: AnalysisRecord): AnalysisRecord[] => {
  const keys = ["findings", "gaps", "issues", "observations", "recommendations"];
  const findings = keys.flatMap((key) =>
    Array.isArray(source[key]) ? (source[key] as unknown[]).map((item) => asRecord(item) ?? (text(item) ? { observation: text(item) } : null)).filter((item): item is AnalysisRecord => item !== null) : [],
  );
  const hasDirectFinding = field(source, ["observation", "finding", "gap", "issue", "evidence", "proof", "impact", "risk", "action", "recommendation"]);
  return hasDirectFinding ? [source, ...findings] : findings;
};

const detail = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(detail).filter(Boolean).join("، ");
  const record = asRecord(value);
  return record ? field(record, ["text", "description", "detail", "quote", "url", "link"]) : text(value);
};

const findingDetail = (record: AnalysisRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = detail(record[key]);
    if (value) return value;
  }
  return "";
};

const analysisSources = (analysis: AnalysisRecord): { source: AnalysisRecord; kind: string }[] => {
  const groups: [string, string][] = [
    ["stores", "متجر إلكتروني"], ["websites", "موقع إلكتروني"],
    ["social_accounts", "حساب اجتماعي"], ["accounts", "حساب"],
    ["channels", "قناة"], ["sources", "جهة مذكورة"],
  ];
  const sources = groups.flatMap(([key, kind]) =>
    Array.isArray(analysis[key]) ? (analysis[key] as unknown[]).map(asRecord)
      .filter((item): item is AnalysisRecord => item !== null)
      .map((source) => ({ source, kind })) : [],
  );
  const general = sourceFindings(analysis).length > 0 || field(analysis, ["summary", "overview", "description"]);
  // لا ننقل نتائج الملف العامة إلى أي متجر أو حساب لم يسمّه التحليل صراحةً.
  return [...sources, ...(general || !sources.length ? [{ source: analysis, kind: "تحليل عام للمرفق" }] : [])];
};

const severityLabel = (severity: string) =>
  ({ critical: "حرج", high: "مرتفع", medium: "متوسط", low: "منخفض" } as Record<string, string>)[severity] ?? severity;

const severityColor = (s: string) =>
  s === "critical" ? "bg-destructive text-destructive-foreground" :
  s === "high" ? "bg-orange-500 text-white" :
  s === "medium" ? "bg-yellow-500 text-white" :
  s === "low" ? "bg-blue-500 text-white" :
  "bg-muted text-muted-foreground";

const channelIcon = (c: string | null) =>
  c === "whatsapp" ? <MessageCircle className="w-4 h-4" /> :
  c === "call" ? <Phone className="w-4 h-4" /> :
  c === "email" ? <Mail className="w-4 h-4" /> :
  <MessageCircle className="w-4 h-4" />;

const Intelligence = () => {
  const { currentOrg, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [fileAnalyses, setFileAnalyses] = useState<FileAnalysis[]>([]);

  const loadAll = async (organizationId: string) => {
    setLoading(true);
    const [iR, tR, dR, rR, fR] = await Promise.all([
      supabase.from("donor_insights").select("*").eq("organization_id", organizationId).eq("is_active", true).order("generated_at", { ascending: false }).limit(50),
      supabase.from("smart_tasks").select("*").eq("organization_id", organizationId).eq("status", "pending").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(100),
      supabase.from("marketing_ideas").select("*").eq("organization_id", organizationId).in("status", ["new", "approved"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("analysis_runs").select("*").eq("organization_id", organizationId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("data_uploads_log")
        .select("id,file_name,ai_analysis,ai_analyzed_at")
        .eq("organization_id", organizationId)
        .not("ai_analysis", "is", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setInsights((iR.data ?? []) as any);
    setTasks((tR.data ?? []) as any);
    setIdeas((dR.data ?? []) as any);
    setLastRun((rR.data as any) ?? null);
    setFileAnalyses((fR.data ?? []) as FileAnalysis[]);
    setLoading(false);
  };

  useEffect(() => {
    if (orgLoading) return;
    if (!currentOrg?.id) {
      setInsights([]);
      setTasks([]);
      setIdeas([]);
      setLastRun(null);
      setFileAnalyses([]);
      setLoading(false);
      return;
    }
    void loadAll(currentOrg.id);
  }, [currentOrg?.id, orgLoading]);

  const runAnalysis = async () => {
    if (!currentOrg?.id) {
      toast.error("تعذر تحديد الجمعية الحالية.");
      return;
    }
    setRunning(true);
    toast.info("جاري التحليل الذكي للبيانات...");
    try {
      const { data, error } = await supabase.functions.invoke("run-intelligence", {
        body: { triggerSource: "manual", organizationId: currentOrg.id },
      });
      if (error) throw error;
      toast.success(`تم: ${data.insights} رؤية، ${data.tasks} مهمة، ${data.ideas} فكرة`);
      await loadAll(currentOrg.id);
    } catch (e: any) {
      toast.error(`فشل التحليل: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const completeTask = async (id: string) => {
    await supabase.from("smart_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
    setTasks((t) => t.filter((x) => x.id !== id));
    toast.success("تم إنجاز المهمة");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <PageHeader
          icon={<Brain className="w-6 h-6" />}
          title="التحليل الذكي"
          subtitle="قراءة منظّمة لنتائج الجمعية: كل جهة على حدة، وما ورد عنها من ملاحظات وشواهد وخطوات"
          actions={
            <Button size="lg" onClick={runAnalysis} disabled={running} className="gap-2 shadow-lg">
              <RefreshCcw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              {running ? "جاري التحليل..." : "تشغيل تحليل ذكي الآن"}
            </Button>
          }
        />
        <PageGuide
          description="هذه قراءة لنتائج التحليل المحفوظة، وليست إثباتًا لفحص مباشر للمواقع. تُعرض كل جهة مذكورة منفصلة؛ وما لم يُربط بجهة محددة يبقى ضمن تحليل المرفق العام. راجع الشاهد والرابط قبل اعتماد أي نتيجة."
          features={[
            "بطاقة لكل متجر أو موقع أو حساب حدّدته بيانات التحليل، دون دمج المتاجر المختلفة",
            "لكل ملاحظة: ما رُصد، والشاهد إن وُجد، والأثر والخطوة المقترحة",
            "تمييز النتائج التي تفتقر إلى رابط أو شاهد بدل تقديمها كحقائق مؤكدة",
            "الرؤى والمهام والأفكار المحفوظة متاحة أدناه، ويمكن إعادة التحليل",
          ]}
        />

        {!loading && (
          <section className="space-y-4" aria-label="تحليل الجهات والمرفقات">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">تحليل شامل للملفات المرفوعة</h2>
                <p className="text-sm text-muted-foreground">نتائج التحليل المحفوظة للملفات المرفوعة؛ بطاقة مستقلة لكل جهة وردت فيها، والتحليل العام لا يُنسب إلى متجر بعينه.</p>
              </div>
              <Badge variant="outline">{fileAnalyses.length} مرفق محلّل</Badge>
            </div>
            {fileAnalyses.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">لا توجد تحليلات ملفات محفوظة لهذه الجمعية في السجل الحالي.</CardContent></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 items-start">
                {fileAnalyses.flatMap((file) => {
                  const analysis = asRecord(file.ai_analysis) ?? {};
                  return analysisSources(analysis).map(({ source, kind }, index) => {
                    const isGeneral = source === analysis;
                    const name = field(source, ["store_name", "website_name", "account_name", "source_name", "name", "title", "platform"]);
                    const urlText = field(source, ["url", "link", "store_url", "website_url", "account_url", "profile_url", "website"]);
                    const url = safeLink(urlText);
                    const overview = field(source, ["summary", "overview", "description"]);
                    const findings = sourceFindings(source);
                    return (
                      <article key={`${file.id}-${index}`} className="rounded-xl border bg-card shadow-sm overflow-hidden min-w-0">
                        <div className="border-b bg-primary/5 p-5 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-semibold text-primary">{kind}</p>
                              <h3 className="text-lg font-bold leading-snug break-words">{isGeneral ? `نتائج عامة · ${file.file_name}` : name || urlText || "جهة لم يُذكر اسمها"}</h3>
                            </div>
                            <Badge variant={name || isGeneral ? "secondary" : "outline"}>{isGeneral ? "غير منسوبة لجهة" : name ? "جهة محددة" : "تحتاج تحديدًا"}</Badge>
                          </div>
                          {!isGeneral && (url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" dir="ltr" className="inline-flex max-w-full items-center gap-1 text-sm text-primary underline break-all">
                              <ExternalLink className="w-4 h-4 shrink-0" />{urlText}
                            </a>
                          ) : <p className="text-xs text-muted-foreground">{urlText ? "الرابط المسجل غير صالح للفتح؛ تحقّق منه قبل الاعتماد." : "لم يُذكر رابط لهذه الجهة؛ لا يمكن تحديد المتجر أو الحساب من الاسم وحده إذا تشابهت الأسماء."}</p>)}
                          <p className="text-xs text-muted-foreground break-words">مصدر البيانات: {file.file_name}{file.ai_analyzed_at ? ` · تحليل: ${new Date(file.ai_analyzed_at).toLocaleString("ar-SA")}` : ""}</p>
                        </div>
                        <div className="p-5 space-y-4">
                          {overview && <div className="border-r-2 border-primary pr-3"><p className="text-xs font-bold text-primary mb-1">خلاصة واردة في التحليل</p><p className="text-sm whitespace-pre-wrap leading-relaxed">{overview}</p></div>}
                          {findings.map((finding, findingIndex) => {
                            const observation = findingDetail(finding, ["observation", "finding", "gap", "issue", "title", "description", "summary"]);
                            const evidence = findingDetail(finding, ["evidence", "proof", "example", "reference", "screenshot", "source"]);
                            const evidenceUrl = safeLink(evidence);
                            const impact = findingDetail(finding, ["impact", "risk", "consequence", "expected_impact"]);
                            const action = findingDetail(finding, ["action", "recommendation", "recommended_action", "suggestion"]);
                            if (!observation && !evidence && !impact && !action) return null;
                            return (
                              <div key={findingIndex} className="rounded-lg border bg-muted/20 overflow-hidden text-sm leading-relaxed">
                                <div className="border-b px-4 py-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-primary">{`الملاحظة ${findingIndex + 1}`}</span>
                                  <Badge variant="outline" className="text-xs">{evidence ? "شاهد مذكور" : "شاهد غير مذكور"}</Badge>
                                </div>
                                <div className="p-4 space-y-3">
                                  <div><p className="text-xs font-semibold text-muted-foreground mb-1">ما الذي رُصد؟</p><p className="whitespace-pre-wrap">{observation || "لم تُذكر ملاحظة مفصّلة؛ راجع المصدر."}</p></div>
                                  <div><p className="text-xs font-semibold text-muted-foreground mb-1">الشاهد المذكور في البيانات</p>{evidenceUrl ? <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all inline-flex items-center gap-1" dir="ltr">{evidence}<ExternalLink className="w-3.5 h-3.5 shrink-0" /></a> : <p className="whitespace-pre-wrap break-words">{evidence || "لا يوجد شاهد محدد؛ هذه الملاحظة تحتاج تحققًا قبل اعتمادها."}</p>}</div>
                                  {impact && <div><p className="text-xs font-semibold text-muted-foreground mb-1">الأثر المذكور</p><p className="whitespace-pre-wrap">{impact}</p></div>}
                                  {action && <div className="rounded-md bg-primary/5 p-3"><p className="text-xs font-semibold text-primary mb-1">الخطوة المقترحة</p><p className="whitespace-pre-wrap">{action}</p></div>}
                                </div>
                              </div>
                            );
                          })}
                          {!overview && findings.length === 0 && <p className="text-sm text-muted-foreground">وردت هذه الجهة في التحليل، لكن لا توجد ملاحظات مفصّلة قابلة للعرض لها؛ لا تُنسب إليها نتائج المرفق العامة.</p>}
                        </div>
                      </article>
                    );
                  });
                })}
              </div>
            )}
          </section>
        )}

        {/* آخر تشغيل */}
        {lastRun && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">آخر تحليل: {format(new Date(lastRun.started_at), "yyyy-MM-dd HH:mm")}</p>
                  <p className="text-xs text-muted-foreground">{lastRun.summary}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1"><Target className="w-3 h-3" />{lastRun.insights_generated} رؤية</Badge>
                <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />{lastRun.tasks_generated} مهمة</Badge>
                <Badge variant="outline" className="gap-1"><Lightbulb className="w-3 h-3" />{lastRun.ideas_generated} فكرة</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="insights" className="gap-2 py-3"><TrendingUp className="w-4 h-4" />الرؤى ({insights.length})</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 py-3"><Target className="w-4 h-4" />المهام الذكية ({tasks.length})</TabsTrigger>
            <TabsTrigger value="ideas" className="gap-2 py-3"><Lightbulb className="w-4 h-4" />أفكار تسويقية ({ideas.length})</TabsTrigger>
          </TabsList>

          {/* الرؤى */}
          <TabsContent value="insights" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             insights.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد رؤى بعد. شغّل التحليل لاكتشاف كنوز بياناتك.</p>
              </CardContent></Card>
             ) :
             insights.map((i) => (
              <Card key={i.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={severityColor(i.severity)}>الأولوية: {severityLabel(i.severity)}</Badge>
                        <Badge variant="outline">{i.category}</Badge>
                        <Badge variant="secondary">{i.insight_type}</Badge>
                      </div>
                      <CardTitle className="text-lg">{i.title}</CardTitle>
                      <CardDescription className="mt-2 leading-relaxed whitespace-pre-wrap"><strong className="text-foreground">ما الذي رصده التحليل؟</strong><br />{i.summary}</CardDescription>
                    </div>
                    {i.severity === "critical" && <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
                  </div>
                </CardHeader>
                {i.recommended_actions && i.recommended_actions.length > 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs font-semibold text-primary mb-2">ما الخطوة التالية؟</p>
                    <ul className="space-y-1">
                      {i.recommended_actions.map((a, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span><span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* المهام الذكية */}
          <TabsContent value="tasks" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             tasks.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد مهام ذكية. شغّل التحليل لتوليد مهام علاقات متبرعين.</p>
              </CardContent></Card>
             ) :
             tasks.map((t) => (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={t.priority === "high" ? "bg-destructive text-destructive-foreground" : t.priority === "medium" ? "bg-yellow-500 text-white" : "bg-blue-500 text-white"}>{t.priority}</Badge>
                      <Badge variant="outline">{t.task_type}</Badge>
                      {t.suggested_channel && <Badge variant="secondary" className="gap-1">{channelIcon(t.suggested_channel)}{t.suggested_channel}</Badge>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => completeTask(t.id)}><CheckCircle2 className="w-4 h-4" /></Button>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                  {t.suggested_message && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />رسالة مقترحة بالذكاء:</p>
                      <p className="text-sm">{t.suggested_message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* أفكار تسويقية */}
          <TabsContent value="ideas" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             ideas.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد أفكار. شغّل التحليل لاستلهام أفكار تسويقية إبداعية.</p>
              </CardContent></Card>
             ) :
             ideas.map((idea) => (
              <Card key={idea.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="default" className="gap-1"><Megaphone className="w-3 h-3" />{idea.idea_type}</Badge>
                        {idea.effort_level && <Badge variant="outline">جهد {idea.effort_level}</Badge>}
                        {idea.target_segment && <Badge variant="secondary">{idea.target_segment}</Badge>}
                      </div>
                      <CardTitle className="text-lg">{idea.title}</CardTitle>
                      <CardDescription className="mt-2">{idea.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {idea.content_draft && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-semibold mb-1">مسودة المحتوى:</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{idea.content_draft}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {idea.channels?.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    {idea.hashtags?.map((h) => <Badge key={h} variant="secondary" className="text-xs">#{h}</Badge>)}
                  </div>
                  {idea.expected_impact && <p className="text-xs text-muted-foreground"><strong>الأثر المتوقع:</strong> {idea.expected_impact}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Intelligence;
