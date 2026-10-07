import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { AlertCircle, CalendarDays, CheckCheck, ClipboardList, Database, FileText, FlaskConical, Loader2, Play, ShieldCheck, Users, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RuleApprovalPanel } from "@/components/automation/RuleApprovalPanel";
import { requestAutomationPreview, useAutomationCapabilities } from "@/components/automation/AutomationModeNotice";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// These contracts mirror the preview responses. They deliberately contain no write actions.
type Operation = "donors" | "file" | "plans" | "tasks";
type Evidence = Record<string, unknown> | unknown[];
interface DonorResult {
  preview_only: true;
  source: "rules-v1";
  organization_id: string;
  daily_brief: string;
  kpi_highlights: { label: string; value: string; hint: string; evidence: Evidence }[];
  insights: { rule_id: string; title: string; summary: string; severity: string; recommended_actions: string[]; evidence: Evidence }[];
  suggested_tasks: { title: string; description: string; evidence: Evidence }[];
  limitations: string[];
  summary: {
    totals: Record<string, number | null>;
    quality: Record<string, unknown>;
    comparisons: Evidence;
    cohorts: Evidence;
    evidence: Evidence;
  };
}
interface FileResult {
  preview_only: true;
  source: "rules-v1";
  chars: number;
  legacy_analysis_preserved: boolean;
  analysis: { document_type: string; summary: string; route_reason: string; key_points: string[]; numbers: string[]; warnings: string[]; partial: boolean; evidence: Evidence };
}
interface PlanResult {
  preview_only: true;
  organization_id: string;
  generated_by: "deterministic_rules";
  requires_confirmation: true;
  rule_version: string;
  plans: { id: string; activity_name: string; date: string; daily_target: number; responsible_employee_id: string; evidence: Evidence }[];
  tasks?: { id: string; title: string; description: string; due_date: string; target: number | null; assigned_employee_id: string; metadata: Evidence }[];
  needs_review: { message: string; code: string; source_plan_id?: string; field?: string }[];
  skipped: unknown[];
  skipped_tasks?: unknown[];
  monthly_allocations: unknown[];
  calendar: { timezone: string; weekend_days: number[]; excluded_dates: string[] };
  evidence: Evidence;
}
// Treat successful HTTP responses as untrusted data too. No defaults, coercions,
// or partial filtering: a malformed member invalidates the entire preview before render.
const countSchema = z.number().finite().int().nonnegative();
const evidenceSchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);
const stringsSchema = z.array(z.string());
const donorResultSchema = z.object({
  preview_only: z.literal(true), source: z.literal("rules-v1"), organization_id: z.string().min(1),
  daily_brief: z.string(),
  kpi_highlights: z.array(z.object({ label: z.string(), value: z.string(), hint: z.string(), evidence: evidenceSchema })),
  insights: z.array(z.object({
    rule_id: z.string(), title: z.string(), summary: z.string(), severity: z.enum(["info", "low", "medium", "high"]),
    recommended_actions: stringsSchema, evidence: evidenceSchema,
  })),
  suggested_tasks: z.array(z.object({ title: z.string(), description: z.string(), evidence: evidenceSchema })),
  limitations: stringsSchema,
  summary: z.object({
    totals: z.record(z.number().finite().nonnegative().nullable()),
    quality: z.object({ input_rows: countSchema, accepted_rows: countSchema, invalid_values: countSchema, unsupported_rows: countSchema }),
    comparisons: z.record(z.unknown()), cohorts: z.record(z.unknown()), evidence: evidenceSchema,
  }),
});
const fileResultSchema = z.object({
  preview_only: z.literal(true), source: z.literal("rules-v1"), chars: countSchema,
  organization_id: z.string().min(1).optional(),
  legacy_analysis_preserved: z.boolean(),
  analysis: z.object({
    document_type: z.string(), summary: z.string(), route_reason: z.string(),
    key_points: stringsSchema, numbers: stringsSchema, warnings: stringsSchema,
    partial: z.boolean(), evidence: z.array(z.object({
      id: z.string(), kind: z.enum(["text", "row", "page"]), excerpt: z.string(),
      sheet: z.string().optional(), row: countSchema.optional(), page: countSchema.optional(),
    })),
  }),
});
const planRowSchema = z.object({
  id: z.string().min(1), activity_name: z.string(), date: z.string(), daily_target: countSchema,
  responsible_employee_id: z.string().min(1), evidence: z.record(z.unknown()),
});
const taskRowSchema = z.object({
  id: z.string().min(1), title: z.string(), description: z.string(), due_date: z.string(),
  target: countSchema.nullable(), assigned_employee_id: z.string().min(1), metadata: z.record(z.unknown()),
});
const skippedRowSchema = z.object({ source_plan_id: z.string(), reason: z.string(), id: z.string().optional() });
const planResultSchema = z.object({
  preview_only: z.literal(true), organization_id: z.string().min(1), generated_by: z.literal("deterministic_rules"),
  requires_confirmation: z.literal(true), rule_version: z.literal("plan-rules-v1"),
  plans: z.array(planRowSchema), tasks: z.array(taskRowSchema).optional(),
  needs_review: z.array(z.object({ message: z.string(), code: z.string(), source_plan_id: z.string().optional(), field: z.string().optional() })),
  skipped: z.array(skippedRowSchema), skipped_tasks: z.array(skippedRowSchema).optional(),
  monthly_allocations: z.array(z.object({
    source_plan_id: z.string(), year: countSchema, month: z.number().int().min(1).max(12),
    monthly_target: countSchema, selected: z.boolean(), origin: z.string(),
  })),
  calendar: z.object({ timezone: z.string().min(1), weekend_days: z.array(z.number().int().min(0).max(6)), excluded_dates: stringsSchema }),
  evidence: z.record(z.unknown()),
});
const resultSchemas = {
  donors: donorResultSchema,
  file: fileResultSchema,
  plans: planResultSchema,
  tasks: planResultSchema.extend({ tasks: z.array(taskRowSchema), skipped_tasks: z.array(skippedRowSchema) }),
};
function validatePreviewResult(value: unknown, operation: Operation, organizationId: string): asserts value is DonorResult | FileResult | PlanResult {
  const parsed = resultSchemas[operation].safeParse(value);
  if (!parsed.success) throw new Error("استجابة المعاينة غير صالحة أو غير مكتملة. لم تُعرض نتيجة غير مؤكدة. أعد المحاولة.");
  if ("organization_id" in parsed.data && parsed.data.organization_id !== organizationId) {
    throw new Error("تعذر تأكيد نطاق المعاينة؛ لم تُعرض النتيجة.");
  }
  // Validation deliberately keeps the original payload, including all technical evidence.
}
type Result = { scope: string; operation: Operation; data: DonorResult | FileResult | PlanResult };
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const operationLabels: Record<Operation, string> = { donors: "بيانات المتبرعين", file: "استخراج ملف", plans: "الخطط التنفيذية", tasks: "مقترحات المهام" };
const formatNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ar-SA") : "غير متاح";

function EvidenceDetails({ value, title = "تفاصيل المصدر والقواعد" }: { value: unknown; title?: string }) {
  if (value === undefined || value === null) return null;
  return <details className="rounded-lg border bg-muted/30 p-3 text-xs">
    <summary className="cursor-pointer font-medium leading-6">{title}</summary>
    <pre dir="ltr" className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-left font-mono leading-5">{JSON.stringify(value, null, 2)}</pre>
  </details>;
}
function Notes({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return <ul className="list-disc space-y-2 pr-5 text-sm leading-7">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}
function EmptyResult({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm leading-7 text-muted-foreground">{children}</div>;
}
function Stat({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{formatNumber(value)}</p></div>;
}

function DonorResults({ data }: { data: DonorResult }) {
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="text-lg">ملخص البيانات المسجلة</CardTitle></CardHeader><CardContent><p className="text-sm leading-8">{data.daily_brief}</p></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.kpi_highlights.map((kpi, index) => <Card key={index}><CardContent className="space-y-3 pt-5"><p className="text-sm text-muted-foreground">{kpi.label}</p><p className="text-xl font-bold leading-8">{kpi.value}</p><p className="text-xs leading-6 text-muted-foreground">{kpi.hint}</p><EvidenceDetails value={kpi.evidence} title="كيف حُسب هذا المؤشر؟" /></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-lg">جودة البيانات وحدود القراءة</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="صفوف المصدر" value={data.summary.quality.input_rows} /><Stat label="الصفوف المقبولة" value={data.summary.quality.accepted_rows} /><Stat label="القيم غير الصالحة" value={data.summary.quality.invalid_values} /><Stat label="الصفوف غير المدعومة" value={data.summary.quality.unsupported_rows} /></div>
      <Notes items={data.limitations} /><EvidenceDetails value={data.summary.quality} title="سجل جودة البيانات والاستبعادات" />
    </CardContent></Card>
    <section className="space-y-3"><h2 className="text-lg font-bold">ملاحظات مرتبطة بقواعد واضحة</h2>
      {!data.insights.length && <EmptyResult>لم تنطبق قواعد ملاحظات على البيانات المتاحة.</EmptyResult>}
      {data.insights.map((finding, index) => <Card key={`${finding.rule_id}-${index}`}><CardContent className="space-y-3 pt-5"><h3 className="font-semibold">{finding.title}</h3><p className="text-sm leading-7">{finding.summary}</p><Notes items={finding.recommended_actions} /><EvidenceDetails value={{ rule_id: finding.rule_id, ...finding.evidence }} /></CardContent></Card>)}
    </section>
    {data.suggested_tasks.length > 0 && <Card><CardHeader><CardTitle className="text-lg">مقترحات متابعة للمراجعة فقط</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">هذه المقترحات لم تُنشأ في قائمة المهام ولم تُرسل إلى أحد.</p>{data.suggested_tasks.map((task, index) => <div key={index} className="space-y-2 rounded-lg border p-4"><h3 className="font-semibold">{task.title}</h3><p className="whitespace-pre-line text-sm leading-7">{task.description}</p><EvidenceDetails value={task.evidence} /></div>)}</CardContent></Card>}
    <EvidenceDetails value={data.summary} title="الإجماليات والفترات والمجموعات وأدلة المصدر الكاملة" />
  </div>;
}

function FileResults({ data }: { data: FileResult }) {
  return <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">{data.analysis.document_type}</CardTitle>{data.analysis.partial && <Badge variant="outline">استخراج جزئي</Badge>}</div></CardHeader><CardContent className="space-y-5">
    <p className="text-sm leading-8">{data.analysis.summary}</p>
    <div className="rounded-lg bg-muted/50 p-4 text-sm leading-7">{data.analysis.route_reason}</div>
    <Notes items={data.analysis.key_points} /><Notes items={data.analysis.numbers} />
    {data.analysis.warnings.length > 0 && <div className="rounded-xl border border-amber-400/40 bg-amber-50/40 p-4"><h3 className="mb-2 font-semibold">تنبيهات الاستخراج</h3><Notes items={data.analysis.warnings} /></div>}
    <p className="text-sm text-muted-foreground">{data.legacy_analysis_preserved ? "للملف تحليل سابق محفوظ؛ لم تُستبدل مخرجاته بهذه المعاينة." : "هذه نتيجة مؤقتة للمعاينة؛ لم تُحفظ على سجل الملف."}</p>
    <EvidenceDetails value={data.analysis.evidence} title="مواضع النص والجداول المستخرجة" />
  </CardContent></Card>;
}

function PlanResults({ data, operation, userId, tasksPath }: { data: PlanResult; operation: "plans" | "tasks"; userId: string; tasksPath: string }) {
  const [limit, setLimit] = useState(50);
  const taskMode = operation === "tasks";
  const rows = taskMode ? data.tasks! : data.plans;
  return <div className="space-y-5">
    <div className="rounded-xl border border-amber-400/40 bg-amber-50/30 p-4 text-sm leading-7"><p className="font-semibold">تحتاج النتائج إلى مراجعة واعتماد بشري قبل التنفيذ</p><p>{taskMode ? "المعاينة لم تحفظ تكليفاً. المراجعة الشهرية أدناه مسار منفصل يحتاج موافقة صريحة وبوابات حفظ مفعّلة، ولا يغيّر درجات التقييم." : "لا يوجد زر تنفيذ في معاينة الخطط. لم يُحفظ أي توزيع أو تكليف، ولم تتغير المسؤوليات أو درجات التقييم."}</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label={taskMode ? "مهام مقترحة" : "أنشطة تنفيذية مقترحة"} value={rows.length} /><Stat label="نقاط تحتاج مراجعة" value={data.needs_review.length} /><Stat label="خطط مستبعدة" value={data.skipped.length} /><Stat label={taskMode ? "مهام قائمة لم تتكرر" : "توزيعات شهرية"} value={taskMode ? data.skipped_tasks!.length : data.monthly_allocations.length} /></div>
    {data.needs_review.length > 0 && <Card className="border-amber-400/40"><CardHeader><CardTitle className="text-lg">أكمل البيانات قبل اعتماد الخطة</CardTitle></CardHeader><CardContent className="space-y-3">{data.needs_review.slice(0, 50).map((item, index) => <div key={index} className="rounded-lg bg-muted/40 p-3 text-sm"><p className="leading-7">{item.message}</p>{item.source_plan_id && <p className="mt-1 break-all text-xs text-muted-foreground">خطة المصدر: <bdi>{item.source_plan_id}</bdi></p>}</div>)}{data.needs_review.length > 50 && <p className="text-xs text-muted-foreground">تظهر أول ٥٠ نقطة. القائمة الكاملة ضمن التفاصيل أدناه.</p>}<EvidenceDetails value={data.needs_review} title="جميع نقاط المراجعة وحقول المصدر" /></CardContent></Card>}
    <Card><CardHeader><CardTitle className="text-lg">{taskMode ? "معاينة المهام" : "معاينة التوزيع اليومي"}</CardTitle></CardHeader><CardContent className="space-y-4">
      <p className="text-xs leading-6 text-muted-foreground">المنطقة الزمنية: <bdi>{data.calendar.timezone}</bdi>. يُوزع المستهدف السنوي على السنة كاملة، ثم تُعرض الأشهر المختارة. أيام الإجازة تعتمد على الإعدادات الصريحة فقط.</p>
      {!rows.length ? <EmptyResult>لا توجد نتائج قابلة للمعاينة لهذه الفترة. راجع نقاط المراجعة والخطط المصدرية.</EmptyResult> : <>
        <Table><TableHeader><TableRow><TableHead className="text-right">{taskMode ? "المهمة" : "النشاط"}</TableHead><TableHead className="text-right">التاريخ</TableHead><TableHead className="text-right">المستهدف</TableHead><TableHead className="text-right">المسؤول ودليل المصدر</TableHead></TableRow></TableHeader><TableBody>
          {taskMode ? data.tasks!.slice(0, limit).map(task => <TableRow key={task.id}><TableCell className="min-w-48"><p className="font-medium">{task.title}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{task.description}</p></TableCell><TableCell><bdi>{task.due_date}</bdi></TableCell><TableCell>{formatNumber(task.target)}</TableCell><TableCell className="min-w-48"><EvidenceDetails value={{ assigned_employee_id: task.assigned_employee_id, ...task.metadata }} title="التكليف المسجل ودليله" /></TableCell></TableRow>) : data.plans.slice(0, limit).map(plan => <TableRow key={plan.id}><TableCell className="min-w-48 font-medium">{plan.activity_name}</TableCell><TableCell><bdi>{plan.date}</bdi></TableCell><TableCell>{formatNumber(plan.daily_target)}</TableCell><TableCell className="min-w-48"><EvidenceDetails value={{ responsible_employee_id: plan.responsible_employee_id, ...plan.evidence }} title="المسؤول المسجل ودليله" /></TableCell></TableRow>)}
        </TableBody></Table>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>عرض {formatNumber(Math.min(rows.length, limit))} من {formatNumber(rows.length)}</p>{rows.length > limit && <Button size="sm" variant="outline" onClick={() => setLimit(value => value + 50)}>عرض المزيد</Button>}</div>
      </>}
    </CardContent></Card>
    {taskMode && <RuleApprovalPanel organizationId={data.organization_id} userId={userId} tasks={data.tasks!} tasksPath={tasksPath} />}
    <EvidenceDetails value={{ rule_version: data.rule_version, calendar: data.calendar, evidence: data.evidence, monthly_allocations: data.monthly_allocations, skipped: data.skipped, skipped_tasks: data.skipped_tasks }} title="قواعد التوزيع والاستبعاد ومنع تكرار المهام" />
  </div>;
}

export default function AutomationPreview() {
  const { user } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganization();
  const capabilities = useAutomationCapabilities();
  const [operation, setOperation] = useState<Operation>("donors");
  const [uploadId, setUploadId] = useState("");
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getUTCMonth() + 1]);
  const [result, setResult] = useState<Result | null>(null);
  const [requestError, setRequestError] = useState<{ scope: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const scope = `${user?.id ?? ""}:${currentOrg?.id ?? ""}`;
  const activeScope = useRef(scope);
  activeScope.current = scope;

  // Abort on tenant/user change or unmount. Every response also checks its originating scope.
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    requestSequence.current += 1;
    setResult(null);
    setRequestError(null);
    setUploadId("");
    setBusy(false);
    return () => { controller.current?.abort(); controller.current = null; requestSequence.current += 1; };
  }, [scope]);

  const uploads = useQuery({
    queryKey: ["automation-preview-uploads", user?.id, currentOrg?.id],
    enabled: Boolean(user?.id && currentOrg?.id && !orgLoading && operation === "file"),
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from("data_uploads_log")
        .select("id,file_name,file_path,created_at")
        .eq("organization_id", currentOrg!.id)
        .not("file_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(200)
        .abortSignal(signal);
      if (error) throw new Error("تعذر تحميل الملفات المصرح لك بقراءتها.");
      return data ?? [];
    },
  });

  const clearPreview = () => {
    controller.current?.abort();
    controller.current = null;
    requestSequence.current += 1;
    setBusy(false);
    setResult(null);
    setRequestError(null);
  };
  const selectedUpload = uploads.data?.find(upload => upload.id === uploadId);
  const validPeriod = /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= 9999 && selectedMonths.length > 0;
  const supported = !capabilities.isError && capabilities.data?.supported.includes(operation);
  const canRun = Boolean(user && currentOrg && !orgLoading && supported && !busy && (operation !== "file" || selectedUpload) && (!["plans", "tasks"].includes(operation) || validPeriod));
  const visibleResult = result?.scope === scope && result.operation === operation ? result : null;
  const visibleError = requestError?.scope === scope ? requestError.message : null;
  const uploadsPath = currentOrg?.slug ? `/${encodeURIComponent(currentOrg.slug)}/uploads` : "/uploads";

  const runPreview = async () => {
    // A ref is the lock, so repeated clicks before React re-renders cannot enqueue another request.
    if (!canRun || controller.current || !currentOrg) return;
    const abort = new AbortController();
    controller.current = abort;
    const sequence = ++requestSequence.current;
    const requestScope = scope;
    setBusy(true);
    setResult(null);
    setRequestError(null);
    try {
      const data = await requestAutomationPreview<unknown>({
        operation,
        organization_id: currentOrg.id,
        ...(operation === "file" ? { upload_id: uploadId } : {}),
        ...(["plans", "tasks"].includes(operation) ? { year: Number(year), months: [...selectedMonths].sort((a, b) => a - b) } : {}),
      }, abort.signal);
      if (abort.signal.aborted || requestSequence.current !== sequence || activeScope.current !== requestScope) return;
      validatePreviewResult(data, operation, currentOrg.id);
      setResult({ scope: requestScope, operation, data });
    } catch (error) {
      if (!abort.signal.aborted && requestSequence.current === sequence && activeScope.current === requestScope) setRequestError({ scope: requestScope, message: error instanceof Error ? error.message : "تعذرت المعاينة." });
    } finally {
      if (requestSequence.current === sequence && activeScope.current === requestScope) { controller.current = null; setBusy(false); }
    }
  };

  return <DashboardLayout><div dir="rtl" className="mx-auto max-w-6xl space-y-6">
    <PageHeader icon={<FlaskConical />} title="معاينة القواعد الآلية" subtitle={`تجربة قابلة للمراجعة للبيانات والملفات والخطط${currentOrg ? ` في ${currentOrg.name}` : ""}`} actions={<Badge className="border-white/30 bg-white/15 text-white" variant="outline">معاينة ومراجعة بشرية</Badge>} />
    <div className="grid gap-3 sm:grid-cols-3">{[
      { icon: Database, title: "المصدر واضح", description: "حسابات وقوالب ثابتة مع أدلة قابلة للفحص." },
      { icon: ShieldCheck, title: "دون مزوّد خارجي", description: "هذه المعاينة تُعالج داخل الخدمة ولا تستدعي نموذجاً توليدياً." },
      { icon: CheckCheck, title: "القرار لك", description: "المعاينة بلا حفظ. اعتماد مهام محددة يتطلب مراجعة وموافقة صريحة؛ أوزان التقييم ثابتة." },
    ].map(item => <div key={item.title} className="flex gap-3 rounded-xl border bg-card p-4"><item.icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" /><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{item.description}</p></div></div>)}</div>
    {!currentOrg && !orgLoading && <div role="alert" className="rounded-xl border p-4 text-sm">اختر جمعية للوصول إلى معاينة بياناتها.</div>}
    <Card><CardContent className="space-y-5 pt-6">
      <Tabs dir="rtl" value={operation} onValueChange={value => { clearPreview(); setOperation(value as Operation); }}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">{([{ value: "donors", icon: Users }, { value: "file", icon: FileText }, { value: "plans", icon: CalendarDays }, { value: "tasks", icon: ClipboardList }] as const).map(tab => <TabsTrigger key={tab.value} value={tab.value} className="gap-2 py-3 text-xs sm:text-sm"><tab.icon className="h-4 w-4" />{operationLabels[tab.value]}</TabsTrigger>)}</TabsList>
        <TabsContent value="donors" className="pt-5"><p className="text-sm leading-7">راجع التبرعات الناجحة، المقارنات الزمنية، استمرار عطاء المتبرعين، وجودة البيانات. تعرض النتائج السجلات المصرح بقراءتها وقواعد احتسابها؛ لا تتنبأ بسلوك المتبرعين.</p></TabsContent>
        <TabsContent value="file" className="space-y-4 pt-5">
          <p className="text-sm leading-7">اختر ملفاً محفوظاً لاستخراج النص والجداول محلياً. الصيغ المدعومة: TXT وCSV وXLSX وXLS وPDF النصي، حتى ٣٠ ميجابايت. الصور وPDF الممسوح ضوئياً يحتاجان OCR غير مدعوم في هذه التجربة.</p>
          <div className="space-y-2"><Label htmlFor="preview-upload">الملف المحفوظ</Label><select id="preview-upload" value={uploadId} disabled={busy || uploads.isPending || uploads.isError} onChange={event => { clearPreview(); setUploadId(event.target.value); }} className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"><option value="">{uploads.isPending ? "جارٍ تحميل الملفات…" : "اختر ملفاً للمعاينة"}</option>{uploads.data?.map(upload => <option key={upload.id} value={upload.id}>{upload.file_name} · {upload.created_at.slice(0, 10)}</option>)}</select></div>
          {uploads.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><span>تعذر تحميل قائمة الملفات.</span><Button variant="outline" size="sm" disabled={uploads.isFetching} onClick={() => uploads.refetch()}>إعادة المحاولة</Button></div>}
          {!uploads.isPending && !uploads.isError && uploads.data?.length === 0 && <p className="text-sm text-muted-foreground">لا توجد ملفات محفوظة متاحة لهذه الجمعية.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>تعرض القائمة أحدث ٢٠٠ ملف متاح. التحليلات القديمة تبقى محفوظة.</p><Button asChild size="sm" variant="outline"><Link to={uploadsPath}>مركز الملفات</Link></Button></div>
        </TabsContent>
        {(["plans", "tasks"] as const).map(tab => <TabsContent key={tab} value={tab} className="space-y-4 pt-5"><p className="text-sm leading-7">{tab === "plans" ? "وزّع المستهدفات الصريحة من الخطط التشغيلية على أيام العمل. الأنشطة غير المعروفة أو المسؤوليات الناقصة تظهر للمراجعة دون اختراع بدائل." : "راجع مهاماً مقترحة من الخطط التشغيلية المسجلة، مع استبعاد المهام الموجودة حيث تتوفر روابط مصدر صريحة. المعاينة وحدها لا تنشئ تكليفات؛ اعتماد المهام الشهرية مسار منفصل بعد المراجعة."}</p>
          <div className="max-w-48 space-y-2"><Label htmlFor={`preview-year-${tab}`}>السنة الميلادية</Label><Input id={`preview-year-${tab}`} type="number" inputMode="numeric" min={1900} max={9999} value={year} disabled={busy} onChange={event => { clearPreview(); setYear(event.target.value); }} /></div>
          <fieldset disabled={busy} className="space-y-3"><legend className="mb-2 text-sm font-medium">الأشهر المطلوبة</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">{months.map((month, index) => <Button type="button" key={month} variant={selectedMonths.includes(index + 1) ? "default" : "outline"} size="sm" aria-pressed={selectedMonths.includes(index + 1)} onClick={() => { clearPreview(); setSelectedMonths(previous => previous.includes(index + 1) ? previous.filter(value => value !== index + 1) : [...previous, index + 1]); }}>{month}</Button>)}</div></fieldset>
          {!validPeriod && <p role="alert" className="text-sm text-destructive">أدخل سنة من ١٩٠٠ إلى ٩٩٩٩ واختر شهراً واحداً على الأقل.</p>}
        </TabsContent>)}
      </Tabs>
      <div className="flex flex-wrap items-center gap-3 border-t pt-5"><Button onClick={runPreview} disabled={!canRun} className="gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{busy ? "جارٍ إعداد المعاينة…" : "تشغيل المعاينة"}</Button>{busy && <Button variant="outline" onClick={clearPreview} className="gap-2"><X className="h-4 w-4" />إلغاء المعاينة</Button>}<p className="text-xs leading-6 text-muted-foreground">النتائج مؤقتة، وتُمسح عند تغيير الجمعية أو نوع المعاينة أو مدخلاتها.</p></div>
      {capabilities.isPending && currentOrg && <p role="status" className="text-sm text-muted-foreground">جارٍ التحقق من القدرات المتاحة في الخادم…</p>}
      {capabilities.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive"><p>لم نتمكن من تأكيد قدرات الخادم. أعد التحقق قبل المعاينة.</p><Button size="sm" variant="outline" disabled={capabilities.isFetching} onClick={() => capabilities.refetch()}>إعادة التحقق</Button></div>}
      {capabilities.data && !capabilities.isError && !supported && <p role="alert" className="text-sm text-muted-foreground">هذه العملية غير مدعومة في الإصدار الحالي للخادم.</p>}
    </CardContent></Card>
    {busy && <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border p-5 text-sm"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span>قراءة البيانات المصرح بها وتطبيق القواعد. يمكنك إلغاء الانتظار دون تغيير البيانات.</span></div>}
    {visibleError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm leading-7"><AlertCircle className="mt-1 h-5 w-5 shrink-0 text-destructive" /><p>{visibleError}</p></div>}
    {visibleResult && <section aria-label="نتائج المعاينة" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">نتيجة المعاينة: {operationLabels[visibleResult.operation]}</h2><Badge variant="outline">قواعد آلية · للمراجعة فقط</Badge></div>{visibleResult.operation === "donors" ? <DonorResults data={visibleResult.data as DonorResult} /> : visibleResult.operation === "file" ? <FileResults data={visibleResult.data as FileResult} /> : <PlanResults key={`${scope}-${requestSequence.current}`} data={visibleResult.data as PlanResult} operation={visibleResult.operation} userId={user?.id ?? ""} tasksPath={currentOrg?.slug ? `/${encodeURIComponent(currentOrg.slug)}/tasks` : "/tasks"} />}</section>}
    {!busy && !visibleResult && !visibleError && <EmptyResult>اختر نوع المعاينة ثم شغّلها. ستظهر النتائج مع أدلتها هنا، دون حفظ تغييرات.</EmptyResult>}
    <p className="text-xs leading-7 text-muted-foreground">حدود التجربة: لا محادثة عامة توليدية، ولا تعرّف ضوئي على النصوص، ولا أحكام آلية على جودة عمل الموظفين. المعاينة لا تغيّر عدادات استخدام الذكاء الاصطناعي أو السجل التاريخي.</p>
  </div></DashboardLayout>;
}
