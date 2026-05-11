import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Megaphone, AlertTriangle, ShoppingCart, RefreshCw, Repeat, Gift, Target,
  ArrowRight, ArrowLeft, Sparkles, Loader2, Download, ListPlus, Phone, MessageSquare,
  Mail, FileText as FileTextIcon, MapPin, Settings2, Save,
} from "lucide-react";
import { toast } from "sonner";

type ReportKey =
  | "donor_tiers" | "campaigns" | "failed_donations" | "abandoned_carts"
  | "subscriptions" | "recurring_donors" | "gifts" | "project_donors";

interface ReportDef {
  key: ReportKey;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
}

const REPORTS: ReportDef[] = [
  { key: "donor_tiers", title: "المتبرعون حسب الفئة المالية", subtitle: "شرائح المبالغ + قناة التواصل المقترحة", icon: Users, color: "from-rose-500 to-pink-600" },
  { key: "campaigns", title: "الحملات", subtitle: "تنفيذ الحملات وإرسال التقارير", icon: Megaphone, color: "from-violet-500 to-purple-600" },
  { key: "failed_donations", title: "التبرعات الفاشلة", subtitle: "أسباب الفشل + إعادة المحاولة", icon: AlertTriangle, color: "from-amber-500 to-orange-600" },
  { key: "abandoned_carts", title: "السلال المتروكة", subtitle: "فرص الاسترداد + التواصل", icon: ShoppingCart, color: "from-sky-500 to-blue-600" },
  { key: "subscriptions", title: "المستقطعون", subtitle: "نشط / متوقف / يحتاج تجديد", icon: RefreshCw, color: "from-emerald-500 to-teal-600" },
  { key: "recurring_donors", title: "المتبرعون المتكررون", subtitle: "انتظام، شكر، مشاريع مفضلة", icon: Repeat, color: "from-indigo-500 to-blue-700" },
  { key: "gifts", title: "الإهداءات", subtitle: "أكثر المُهدين + حالة التسليم", icon: Gift, color: "from-pink-500 to-rose-600" },
  { key: "project_donors", title: "متبرعو المشاريع", subtitle: "متبرعو الزكاة/الأوقاف/المشاريع وتقارير الإرسال", icon: Target, color: "from-orange-500 to-red-600" },
];

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n || 0));
const sar = (n: number) => `${fmt(n)} ر.س`;

const CHANNEL_LABEL: Record<string, { label: string; icon: any }> = {
  letter: { label: "خطاب رسمي", icon: FileTextIcon },
  call: { label: "اتصال هاتفي", icon: Phone },
  whatsapp: { label: "واتساب", icon: MessageSquare },
  sms: { label: "رسالة SMS", icon: MessageSquare },
  email: { label: "بريد إلكتروني", icon: Mail },
  visit: { label: "زيارة", icon: MapPin },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

/* ================================================================
 * Donor tier configuration (per-organization, RLS-protected)
 * ================================================================ */
interface TierConfig {
  tier_a_min: number;
  tier_b_min: number;
  tier_c_min: number;
  tier_a_channel: string;
  tier_b_channel: string;
  tier_c_channel: string;
  tier_d_channel: string;
}

const DEFAULT_TIER_CONFIG: TierConfig = {
  tier_a_min: 5000,
  tier_b_min: 2000,
  tier_c_min: 500,
  tier_a_channel: "خطاب رسمي + اتصال",
  tier_b_channel: "اتصال هاتفي",
  tier_c_channel: "رسالة واتساب شخصية",
  tier_d_channel: "رسالة SMS",
};

function classifyTier(amount: number, cfg: TierConfig): { tier: "أ" | "ب" | "ج" | "د"; channel: string; rangeLabel: string } {
  if (amount >= cfg.tier_a_min) return { tier: "أ", channel: cfg.tier_a_channel, rangeLabel: `≥ ${fmt(cfg.tier_a_min)}` };
  if (amount >= cfg.tier_b_min) return { tier: "ب", channel: cfg.tier_b_channel, rangeLabel: `${fmt(cfg.tier_b_min)} – ${fmt(cfg.tier_a_min)}` };
  if (amount >= cfg.tier_c_min) return { tier: "ج", channel: cfg.tier_c_channel, rangeLabel: `${fmt(cfg.tier_c_min)} – ${fmt(cfg.tier_b_min)}` };
  return { tier: "د", channel: cfg.tier_d_channel, rangeLabel: `< ${fmt(cfg.tier_c_min)}` };
}

function downloadCsv(filename: string, rows: any[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(rows.map(r => headers.map(h => {
      const v = r[h] == null ? "" : String(r[h]).replace(/"/g, '""');
      return /[",\n]/.test(v) ? `"${v}"` : v;
    }).join(",")))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

interface AISuggestion {
  title: string;
  target_segment: string;
  estimated_count?: number;
  channel: string;
  priority: "low" | "medium" | "high";
  due_in_days: number;
  suggested_message: string;
  rationale: string;
}

interface AIResult {
  summary: string;
  key_insights: string[];
  actions: AISuggestion[];
}

interface Props {
  orgId: string;
  embedded?: boolean;
  onActiveReportChange?: (active: boolean) => void;
}

export default function OperationalReportsHub({ orgId, embedded = false, onActiveReportChange }: Props) {
  const [activeReport, setActiveReport] = useState<ReportKey | null>(null);

  useEffect(() => {
    onActiveReportChange?.(activeReport !== null);
  }, [activeReport, onActiveReportChange]);

  return (
    <div className="space-y-6" dir="rtl">
      {!activeReport ? (
        <>
          {!embedded && (
          <Card className="border-primary/30 bg-gradient-to-l from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-right">
                <Sparkles className="h-5 w-5 text-primary" />
                مركز التقارير التشغيلية الذكية
              </CardTitle>
              <CardDescription className="text-right">
                تقارير تفصيلية عن المتبرعين والحملات والتبرعات الفاشلة والسلال المتروكة، مع اقتراحات ذكية لكل تقرير قابلة للتحويل إلى مهام على الموظفين بضغطة زر.
              </CardDescription>
            </CardHeader>
          </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {REPORTS.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveReport(r.key)}
                  className="group text-right rounded-2xl border border-border bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${r.color} text-white mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.subtitle}</div>
                  <div className="flex items-center gap-1 text-xs text-primary mt-3">
                    فتح التقرير <ArrowLeft className="h-3 w-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <ReportView
          orgId={orgId}
          reportKey={activeReport}
          definition={REPORTS.find(r => r.key === activeReport)!}
          onBack={() => setActiveReport(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
 * ReportView – generic shell + per-report data fetcher
 * ================================================================ */
function ReportView({
  orgId, reportKey, definition, onBack,
}: { orgId: string; reportKey: ReportKey; definition: ReportDef; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [tier, setTier] = useState<string>("all");
  const [aiLoading, setAiLoading] = useState(false);
  const [ai, setAi] = useState<AIResult | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchReport(reportKey, orgId);
        if (!cancelled) setRows(data);
      } catch (e: any) {
        toast.error(e.message || "تعذر تحميل التقرير");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportKey, orgId]);

  const filtered = useMemo(() => {
    if (reportKey !== "donor_tiers" || tier === "all") return rows;
    return rows.filter(r => r.tier === tier);
  }, [rows, tier, reportKey]);

  const aggregates = useMemo(() => computeAggregates(reportKey, filtered), [reportKey, filtered]);

  const runAI = async () => {
    setAiLoading(true);
    setAi(null);
    try {
      const samples = filtered.slice(0, 25).map(anonymize);
      const { data, error } = await supabase.functions.invoke("report-suggestions", {
        body: { report_type: reportKey, filters: { tier }, aggregates, samples },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAi(data as AIResult);
      toast.success("تم توليد الاقتراحات الذكية");
    } catch (e: any) {
      toast.error(e.message || "تعذر توليد الاقتراحات");
    } finally {
      setAiLoading(false);
    }
  };

  const convertToTasks = async () => {
    if (!ai?.actions?.length) return;
    setCreatingTasks(true);
    try {
      const suggestions = ai.actions.map((a) => {
        const channel = CHANNEL_LABEL[a.channel]?.label || a.channel;
        return {
          source: `report:${reportKey}`,
          title: `[${definition.title}] ${a.title}`.slice(0, 200),
          description:
`الشريحة المستهدفة: ${a.target_segment}
القناة: ${channel}
العدد التقريبي: ${a.estimated_count ?? "—"}

الرسالة المقترحة:
${a.suggested_message}

المبرر:
${a.rationale}

— مولّدة من ${definition.title} عبر الاقتراحات الذكية`,
          channel: a.channel,
          priority: a.priority,
          suggested_message: a.suggested_message,
          due_in_days: Math.max(1, Math.min(14, a.due_in_days || 3)),
          category: "متابعة المتبرعين",
          dedupe_key: `report:${reportKey}|${a.title}`.slice(0, 200),
          metadata: { target_segment: a.target_segment, estimated_count: a.estimated_count, rationale: a.rationale },
        };
      });
      const { data, error } = await supabase.functions.invoke("smart-task-dispatcher", {
        body: { organization_id: orgId, suggestions },
      });
      if (error) throw error;
      const scheduled = data?.scheduled ?? 0;
      const overflow = data?.overflow ?? 0;
      const dupes = data?.skipped_dupes ?? 0;
      toast.success(
        `تم توزيع ${scheduled} مهمة على الموظفين` +
          (overflow ? ` · ${overflow} مهمة مؤجَّلة لتجاوز السعة اليومية` : "") +
          (dupes ? ` · ${dupes} مكرّرة تم تجاهلها` : "")
      );
    } catch (e: any) {
      toast.error(e.message || "تعذر إنشاء المهام");
    } finally {
      setCreatingTasks(false);
    }
  };

  const Icon = definition.icon;
  const columns = COLUMN_DEFS[reportKey];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${definition.color} text-white`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{definition.title}</h2>
            <p className="text-sm text-muted-foreground">{definition.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => downloadCsv(`${reportKey}.csv`, filtered)} disabled={!filtered.length}>
            <Download className="h-4 w-4 ml-1" /> تصدير CSV
          </Button>
          <Button variant="ghost" onClick={onBack}>
            رجوع للتقارير <ArrowRight className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {reportKey === "donor_tiers" && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">الفئة:</span>
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              <SelectItem value="≥ 5,000">≥ 5,000 ر.س</SelectItem>
              <SelectItem value="1,000 – 5,000">1,000 – 5,000 ر.س</SelectItem>
              <SelectItem value="500 – 1,000">500 – 1,000 ر.س</SelectItem>
              <SelectItem value="< 500">أقل من 500 ر.س</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(aggregates).map(([k, v]) => (
          <Card key={k} className="bg-card">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-2xl font-bold mt-1">{typeof v === "number" ? fmt(v) : v}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> جارٍ تحميل البيانات…
            </div>
          ) : !filtered.length ? (
            <div className="py-16 text-center text-muted-foreground">لا توجد بيانات لعرضها في هذا التقرير</div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    {columns.map(c => <TableHead key={c.key} className="text-right">{c.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((r, idx) => (
                    <TableRow key={idx}>
                      {columns.map(c => (
                        <TableCell key={c.key} className="text-right text-sm">
                          {c.render ? c.render(r[c.key], r) : (r[c.key] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 200 && (
                <div className="p-2 text-xs text-center text-muted-foreground border-t">
                  عرض أول 200 صف من أصل {fmt(filtered.length)}. استخدم زر التصدير لتنزيل القائمة الكاملة.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 via-card to-accent/5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-right">
              <Sparkles className="h-5 w-5 text-primary" /> اقتراحات ذكية لهذا التقرير
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={runAI} disabled={aiLoading || !filtered.length} className="gap-1">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {ai ? "إعادة توليد" : "توليد الاقتراحات"}
              </Button>
              {ai && ai.actions?.length > 0 && (
                <Button onClick={convertToTasks} disabled={creatingTasks} variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  {creatingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                  تنزيل كمهام على الموظفين
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!ai && !aiLoading && (
            <div className="text-sm text-muted-foreground text-center py-6">
              اضغط "توليد الاقتراحات" ليحلل الذكاء الاصطناعي بيانات التقرير ويقترح إجراءات قابلة للتنفيذ مع نص رسائل جاهز.
            </div>
          )}
          {ai && (
            <div className="space-y-4">
              {ai.summary && (
                <div className="rounded-lg bg-card p-4 border">
                  <div className="text-sm font-semibold mb-1">الملخص الاستراتيجي</div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{ai.summary}</p>
                </div>
              )}
              {ai.key_insights?.length > 0 && (
                <div className="rounded-lg bg-card p-4 border">
                  <div className="text-sm font-semibold mb-2">رؤى رقمية</div>
                  <ul className="text-sm space-y-1 list-disc pr-5 text-muted-foreground">
                    {ai.key_insights.map((k, i) => <li key={i}>{k}</li>)}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ai.actions?.map((a, i) => {
                  const Ch = CHANNEL_LABEL[a.channel]?.icon || MessageSquare;
                  return (
                    <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm flex-1">{a.title}</div>
                        <Badge className={`${PRIORITY_COLOR[a.priority]} border`}>
                          {a.priority === "high" ? "عاجل" : a.priority === "medium" ? "مهم" : "عادي"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="gap-1"><Ch className="h-3 w-3" /> {CHANNEL_LABEL[a.channel]?.label}</Badge>
                        <Badge variant="outline">الشريحة: {a.target_segment}</Badge>
                        {a.estimated_count != null && <Badge variant="outline">العدد: {fmt(a.estimated_count)}</Badge>}
                        <Badge variant="outline">خلال {a.due_in_days} يوم</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground italic">{a.rationale}</div>
                      <div className="rounded-md bg-muted/50 p-2 text-xs whitespace-pre-line">{a.suggested_message}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ================================================================
 * Data fetchers
 * ================================================================ */
async function fetchReport(key: ReportKey, orgId: string): Promise<any[]> {
  switch (key) {
    case "donor_tiers": {
      const { data } = await supabase.from("donors")
        .select("full_name, phone, total_donated, donations_count, last_donation_at, segment")
        .eq("organization_id", orgId)
        .order("total_donated", { ascending: false })
        .limit(5000);
      // Classification is applied later in the component using the org's tier config.
      return (data || []).map(d => {
        const t = Number(d.total_donated || 0);
        return {
          _amount: t,
          الاسم: d.full_name,
          الجوال: d.phone,
          "إجمالي التبرعات": sar(t),
          "عدد التبرعات": d.donations_count || 0,
          "آخر تبرع": d.last_donation_at ? new Date(d.last_donation_at).toLocaleDateString("ar-SA") : "—",
        };
      });
    }
    case "campaigns": {
      const { data } = await supabase.from("campaigns")
        .select("name, goal_amount, collected_amount, donations_count, status, start_date, end_date")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(500);
      return (data || []).map(c => {
        const goal = Number(c.goal_amount || 0); const got = Number(c.collected_amount || 0);
        const pct = goal ? Math.round((got / goal) * 100) : 0;
        return {
          "اسم الحملة": c.name,
          الحالة: c.status,
          "الهدف": sar(goal),
          "المُحصَّل": sar(got),
          "نسبة الإنجاز": `${pct}%`,
          "عدد المتبرعين": c.donations_count || 0,
          "بداية": c.start_date || "—",
          "نهاية": c.end_date || "—",
          "تقرير ختامي مُرسل": c.status === "completed" ? "نعم" : "لا",
        };
      });
    }
    case "failed_donations": {
      const { data } = await supabase.from("failed_donations")
        .select("donor_name, donor_phone, amount, project_name, failure_reason, attempted_at, retry_status")
        .eq("organization_id", orgId).order("attempted_at", { ascending: false }).limit(2000);
      return (data || []).map(f => ({
        المتبرع: f.donor_name || "—", الجوال: f.donor_phone || "—",
        المبلغ: sar(Number(f.amount || 0)), المشروع: f.project_name || "—",
        "سبب الفشل": f.failure_reason || "غير محدد",
        "حالة المعاودة": f.retry_status,
        "تاريخ المحاولة": f.attempted_at ? new Date(f.attempted_at).toLocaleDateString("ar-SA") : "—",
      }));
    }
    case "abandoned_carts": {
      const { data } = await supabase.from("abandoned_carts")
        .select("donor_name, donor_phone, amount, project_name, abandoned_at, follow_up_status, recovered")
        .eq("organization_id", orgId).order("abandoned_at", { ascending: false }).limit(2000);
      return (data || []).map(c => ({
        المتبرع: c.donor_name || "—", الجوال: c.donor_phone || "—",
        المبلغ: sar(Number(c.amount || 0)), المشروع: c.project_name || "—",
        "حالة المتابعة": c.follow_up_status,
        "تم الاسترداد": c.recovered ? "نعم" : "لا",
        "تاريخ الترك": c.abandoned_at ? new Date(c.abandoned_at).toLocaleDateString("ar-SA") : "—",
      }));
    }
    case "subscriptions": {
      const { data } = await supabase.from("subscriptions")
        .select("donor_name, donor_phone, amount, project_name, status, start_date, end_date, next_charge_date, cancellation_reason")
        .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(2000);
      return (data || []).map(s => ({
        المتبرع: s.donor_name || "—", الجوال: s.donor_phone || "—",
        "قيمة الاستقطاع": sar(Number(s.amount || 0)),
        المشروع: s.project_name || "—",
        الحالة: s.status,
        "بداية": s.start_date || "—",
        "نهاية": s.end_date || "—",
        "الاستقطاع القادم": s.next_charge_date || "—",
        "سبب الإلغاء": s.cancellation_reason || "—",
      }));
    }
    case "recurring_donors": {
      const { data } = await supabase.from("donors")
        .select("full_name, phone, total_donated, donations_count, first_donation_at, last_donation_at")
        .eq("organization_id", orgId).gte("donations_count", 2)
        .order("donations_count", { ascending: false }).limit(2000);
      return (data || []).map(d => ({
        الاسم: d.full_name, الجوال: d.phone,
        "عدد التبرعات": d.donations_count,
        "إجمالي": sar(Number(d.total_donated || 0)),
        "أول تبرع": d.first_donation_at ? new Date(d.first_donation_at).toLocaleDateString("ar-SA") : "—",
        "آخر تبرع": d.last_donation_at ? new Date(d.last_donation_at).toLocaleDateString("ar-SA") : "—",
      }));
    }
    case "gifts": {
      const { data } = await supabase.from("gifts")
        .select("giver_name, giver_phone, recipient_name, amount, occasion, delivery_status, gift_date, project_name")
        .eq("organization_id", orgId).order("gift_date", { ascending: false }).limit(2000);
      return (data || []).map(g => ({
        المُهدي: g.giver_name || "—",
        "جوال المُهدي": g.giver_phone || "—",
        المُهدى: g.recipient_name || "—",
        المبلغ: sar(Number(g.amount || 0)),
        المناسبة: g.occasion || "—",
        المشروع: g.project_name || "—",
        "حالة التسليم": g.delivery_status,
        التاريخ: g.gift_date ? new Date(g.gift_date).toLocaleDateString("ar-SA") : "—",
      }));
    }
    case "project_donors": {
      const { data } = await supabase.from("donations")
        .select("project_name, donor_name, donor_phone, amount, donation_date")
        .eq("organization_id", orgId)
        .not("project_name", "is", null)
        .order("donation_date", { ascending: false }).limit(5000);
      return (data || []).map(d => ({
        المشروع: d.project_name,
        المتبرع: d.donor_name || "—",
        الجوال: d.donor_phone || "—",
        المبلغ: sar(Number(d.amount || 0)),
        التاريخ: d.donation_date ? new Date(d.donation_date).toLocaleDateString("ar-SA") : "—",
      }));
    }
  }
}

/* ================================================================
 * Column definitions
 * ================================================================ */
type Col = { key: string; label: string; render?: (v: any, row: any) => any };
const COLUMN_DEFS: Record<ReportKey, Col[]> = {
  donor_tiers: [
    { key: "الاسم", label: "الاسم" }, { key: "الجوال", label: "الجوال" },
    { key: "إجمالي التبرعات", label: "إجمالي التبرعات" },
    { key: "عدد التبرعات", label: "عدد التبرعات" },
    { key: "tier", label: "الفئة", render: (v) => <Badge variant="outline">{v}</Badge> },
    { key: "آخر تبرع", label: "آخر تبرع" },
    { key: "قناة التواصل المقترحة", label: "قناة التواصل المقترحة" },
  ],
  campaigns: [
    { key: "اسم الحملة", label: "اسم الحملة" }, { key: "الحالة", label: "الحالة" },
    { key: "الهدف", label: "الهدف" }, { key: "المُحصَّل", label: "المُحصَّل" },
    { key: "نسبة الإنجاز", label: "نسبة الإنجاز" }, { key: "عدد المتبرعين", label: "عدد المتبرعين" },
    { key: "بداية", label: "بداية" }, { key: "نهاية", label: "نهاية" },
    { key: "تقرير ختامي مُرسل", label: "تقرير ختامي مُرسل" },
  ],
  failed_donations: [
    { key: "المتبرع", label: "المتبرع" }, { key: "الجوال", label: "الجوال" },
    { key: "المبلغ", label: "المبلغ" }, { key: "المشروع", label: "المشروع" },
    { key: "سبب الفشل", label: "سبب الفشل" },
    { key: "حالة المعاودة", label: "حالة المعاودة" }, { key: "تاريخ المحاولة", label: "تاريخ المحاولة" },
  ],
  abandoned_carts: [
    { key: "المتبرع", label: "المتبرع" }, { key: "الجوال", label: "الجوال" },
    { key: "المبلغ", label: "المبلغ" }, { key: "المشروع", label: "المشروع" },
    { key: "حالة المتابعة", label: "حالة المتابعة" },
    { key: "تم الاسترداد", label: "تم الاسترداد" }, { key: "تاريخ الترك", label: "تاريخ الترك" },
  ],
  subscriptions: [
    { key: "المتبرع", label: "المتبرع" }, { key: "الجوال", label: "الجوال" },
    { key: "قيمة الاستقطاع", label: "قيمة الاستقطاع" }, { key: "المشروع", label: "المشروع" },
    { key: "الحالة", label: "الحالة" }, { key: "بداية", label: "بداية" },
    { key: "نهاية", label: "نهاية" }, { key: "الاستقطاع القادم", label: "الاستقطاع القادم" },
    { key: "سبب الإلغاء", label: "سبب الإلغاء" },
  ],
  recurring_donors: [
    { key: "الاسم", label: "الاسم" }, { key: "الجوال", label: "الجوال" },
    { key: "عدد التبرعات", label: "عدد التبرعات" }, { key: "إجمالي", label: "إجمالي" },
    { key: "أول تبرع", label: "أول تبرع" }, { key: "آخر تبرع", label: "آخر تبرع" },
  ],
  gifts: [
    { key: "المُهدي", label: "المُهدي" }, { key: "جوال المُهدي", label: "جوال المُهدي" },
    { key: "المُهدى", label: "المُهدى" }, { key: "المبلغ", label: "المبلغ" },
    { key: "المناسبة", label: "المناسبة" }, { key: "المشروع", label: "المشروع" },
    { key: "حالة التسليم", label: "حالة التسليم" }, { key: "التاريخ", label: "التاريخ" },
  ],
  project_donors: [
    { key: "المشروع", label: "المشروع" }, { key: "المتبرع", label: "المتبرع" },
    { key: "الجوال", label: "الجوال" }, { key: "المبلغ", label: "المبلغ" },
    { key: "التاريخ", label: "التاريخ" },
  ],
};

/* ================================================================
 * Aggregates per report
 * ================================================================ */
function computeAggregates(key: ReportKey, rows: any[]): Record<string, number | string> {
  const n = rows.length;
  switch (key) {
    case "donor_tiers": {
      const tiers = rows.reduce((m: Record<string, number>, r: any) => { m[r.tier] = (m[r.tier] || 0) + 1; return m; }, {});
      return { "إجمالي المتبرعين": n, "≥ 5,000": tiers["≥ 5,000"] || 0, "1,000 – 5,000": tiers["1,000 – 5,000"] || 0, "أقل من 500": tiers["< 500"] || 0 };
    }
    case "campaigns": {
      const completed = rows.filter(r => r["تقرير ختامي مُرسل"] === "نعم").length;
      return { "إجمالي الحملات": n, "مُرسل تقرير ختامي": completed, "بدون تقرير": n - completed };
    }
    case "failed_donations": {
      const reasons: Record<string, number> = {};
      rows.forEach(r => { reasons[r["سبب الفشل"]] = (reasons[r["سبب الفشل"]] || 0) + 1; });
      const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      return { "إجمالي الفاشلة": n, "أبرز سبب": top ? `${top[0]} (${top[1]})` : "—" };
    }
    case "abandoned_carts": {
      const recovered = rows.filter(r => r["تم الاسترداد"] === "نعم").length;
      const rate = n ? Math.round((recovered / n) * 100) : 0;
      return { "إجمالي السلال": n, "مُستردة": recovered, "نسبة الاسترداد": `${rate}%` };
    }
    case "subscriptions": {
      const active = rows.filter(r => r.الحالة === "active").length;
      return { "إجمالي المستقطعين": n, "نشط": active, "متوقف/ملغى": n - active };
    }
    case "recurring_donors":
      return { "إجمالي المتكررين": n };
    case "gifts": {
      const delivered = rows.filter(r => r["حالة التسليم"] === "delivered").length;
      return { "إجمالي الإهداءات": n, "تم التسليم": delivered, "نسبة التسليم": n ? `${Math.round((delivered / n) * 100)}%` : "0%" };
    }
    case "project_donors": {
      const projects = new Set(rows.map(r => r.المشروع));
      return { "عدد المشاريع": projects.size, "إجمالي التبرعات للمشاريع": n };
    }
  }
}

function anonymize(row: any) {
  const out: any = {};
  for (const k of Object.keys(row)) {
    if (k === "الاسم" || k === "المتبرع" || k === "المُهدي" || k === "المُهدى") out[k] = "***";
    else if (k === "الجوال" || k === "جوال المُهدي") out[k] = row[k] ? "***" : "—";
    else out[k] = row[k];
  }
  return out;
}