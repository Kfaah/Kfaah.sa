import { ReportDataState } from "@/components/admin/ReportDataState";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Sparkles, Loader2, TrendingUp, Lightbulb,
  AlertTriangle, CheckCircle2, Building2, Users, HandCoins, Target, CalendarDays, RefreshCw,
} from "lucide-react";
import { useAdminAggregates } from "@/hooks/useAdminAggregates";
import type { DateRange } from "@/hooks/useAdminAggregates";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { toast } from "sonner";

interface AIInsight {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: { title: string; impact: "high" | "medium" | "low"; action: string }[];
}

const fmt = (n: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n);
const fmtSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
function buildPreset(key: string): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  const dow = now.getDay();
  switch (key) {
    case "today": return { from: today, to: endOfDay(now), label: "اليوم" };
    case "yesterday": { const y = new Date(today); y.setDate(y.getDate()-1); return { from: y, to: endOfDay(y), label: "الأمس" }; }
    case "this_week": { const f = new Date(today); f.setDate(f.getDate()-dow); return { from: f, to: endOfDay(now), label: "هذا الأسبوع" }; }
    case "last_week": { const f = new Date(today); f.setDate(f.getDate()-dow-7); const t = new Date(f); t.setDate(t.getDate()+6); return { from: f, to: endOfDay(t), label: "الأسبوع الماضي" }; }
    case "this_month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), label: "هذا الشهر" };
    case "last_month": { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)); return { from: f, to: t, label: "الشهر الماضي" }; }
    case "this_year": return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now), label: "هذه السنة" };
    case "last_year": { const f = new Date(now.getFullYear()-1, 0, 1); const t = endOfDay(new Date(now.getFullYear()-1, 11, 31)); return { from: f, to: t, label: "السنة الماضية" }; }
    default: return { from: null, to: null, label: "منذ البداية" };
  }
}
const PERIOD_OPTIONS: [string, string][] = [
  ["all", "منذ البداية"],
  ["today", "اليوم"],
  ["yesterday", "الأمس"],
  ["this_week", "هذا الأسبوع"],
  ["last_week", "الأسبوع الماضي"],
  ["this_month", "هذا الشهر"],
  ["last_month", "الشهر الماضي"],
  ["this_year", "هذه السنة"],
  ["last_year", "السنة الماضية"],
  ["custom", "فترة مخصصة..."],
];

export default function AdminAnalytics() {
  const [range, setRange] = useState<DateRange>({ from: null, to: null, label: "منذ البداية" });
  const [periodKey, setPeriodKey] = useState<string>("all");
  const [customOpen, setCustomOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>();
  const [tempTo, setTempTo] = useState<Date | undefined>();
  const { metrics, loading, error: metricsError, refresh: refreshMetrics } = useAdminAggregates(range);
  const [selectedId, setSelectedId] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const aiRequest = useRef(0);
  const [chartRefresh, setChartRefresh] = useState(0);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<{ day: number; value: number }[]>([]);
  const [monthly, setMonthly] = useState<{ m: string; donations: number; revenue: number }[]>([]);

  useEffect(() => {
    if (!loading && !metricsError && !metrics.some(m => m.org_id === selectedId)) setSelectedId(metrics[0]?.org_id || "");
  }, [metrics, selectedId, loading, metricsError]);

  const selected = useMemo(() => metrics.find(m => m.org_id === selectedId), [metrics, selectedId]);

  useEffect(() => {
    let cancelled = false;
    aiRequest.current++; setInsight(null); setAiLoading(false);
    setHeatmap([]); setMonthly([]); setChartError(null);
    if (!selectedId) return;
    setChartLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("org_donation_chart", {
        p_org: selectedId, p_from: range.from?.toISOString() ?? null, p_to: range.to?.toISOString() ?? null,
      });
      if (error) throw error;
      if (cancelled) return;
      const chart = data as unknown as { days: { day: number; value: number }[]; months: { m: string; donations: number; revenue: number }[] };
      setHeatmap(chart.days); setMonthly(chart.months);
    })().catch(() => { if (!cancelled) setChartError("تعذر تحميل الرسم البياني؛ أعد تحميل البيانات"); })
      .finally(() => { if (!cancelled) setChartLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, range.from?.getTime(), range.to?.getTime(), chartRefresh]);

  const runAI = async (force = false) => {
    if (!selected || loading || aiLoading) return;
    const requestId = ++aiRequest.current;
    setAiLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-insights", {
        body: {
          metrics: selected,
          all: metrics,
          period_label: range.label,
          period_from: range.from?.toISOString() || null,
          period_to: range.to?.toISOString() || null,
          force,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (requestId !== aiRequest.current) return;
      setInsight(data.insight);
      toast.success(force ? "تم إعادة توليد التحليل" : "تم توليد التحليل الذكي");
    } catch (e: any) {
      if (requestId === aiRequest.current) toast.error(e.message || "تعذّر توليد التحليل");
    } finally {
      if (requestId === aiRequest.current) setAiLoading(false);
    }
  };

  if (loading || metricsError) return <ReportDataState loading={loading} error={metricsError} retry={refreshMetrics} />;

  return (
    <div className="p-4 sm:p-8 space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-4" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-accent" />
            التحليل الذكي
          </h1>
          <p className="text-white mt-1">اختر فترة وجمعية لرؤية تحليل تفصيلي وتوصيات ذكية ثابتة لنفس البيانات</p>
        </div>

        <div className="flex w-full sm:w-auto flex-wrap items-center gap-3" dir="rtl">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger dir="rtl" className="w-full sm:w-[280px] text-right">
              <SelectValue placeholder="اختر جمعية..." />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {metrics.map(m => (
                <SelectItem key={m.org_id} value={m.org_id}>
                  {m.org_name} {!m.is_active && "(موقوفة)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={periodKey}
            onValueChange={(k) => {
              setPeriodKey(k);
              setInsight(null);
              if (k === "custom") { setCustomOpen(true); }
              else { setRange(buildPreset(k)); }
            }}
          >
            <SelectTrigger dir="rtl" className="w-full sm:w-[200px] bg-accent text-accent-foreground border-accent hover:bg-accent/90 font-semibold gap-2 text-right">
              <CalendarDays className="w-4 h-4" />
              <SelectValue placeholder="الفترة">
                {periodKey === "custom" ? range.label : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent dir="rtl">
              {PERIOD_OPTIONS.map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild><span /></PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-popover" align="end">
              <div className="flex gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-semibold mb-1 text-muted-foreground">من</div>
                  <Calendar mode="single" selected={tempFrom} onSelect={setTempFrom} className={cn("p-0 pointer-events-auto")} />
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1 text-muted-foreground">إلى</div>
                  <Calendar mode="single" selected={tempTo} onSelect={setTempTo} className={cn("p-0 pointer-events-auto")} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => setCustomOpen(false)}>إلغاء</Button>
                <Button size="sm" disabled={!tempFrom || !tempTo || tempFrom > tempTo} onClick={() => {
                  if (!tempFrom || !tempTo || tempFrom > tempTo) return;
                  setRange({
                    from: startOfDay(tempFrom),
                    to: endOfDay(tempTo),
                    label: `من ${tempFrom.toLocaleDateString("ar-SA")} إلى ${tempTo.toLocaleDateString("ar-SA")}`,
                  });
                  setCustomOpen(false);
                }}>تطبيق</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={() => runAI(false)}
            disabled={!selected || loading || aiLoading}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تحليل ذكي بالـ AI
          </Button>
          <Button
            onClick={() => runAI(true)}
            disabled={!selected || loading || aiLoading}
            variant="outline"
            className="gap-2"
            title="تجاهل النسخة المحفوظة وأعد توليد التحليل من جديد"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            إعادة توليد
          </Button>
        </div>
      </div>

      {!selected && !loading && (
        <Card className="bg-card border-border p-12 text-center text-muted-foreground">
          اختر جمعية للبدء
        </Card>
      )}

      {selected && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox icon={HandCoins} label="الإيرادات" value={fmtSAR(selected.total_donated)} />
            <StatBox icon={Users} label="المتبرعون" value={fmt(selected.donors)}
              sub={`${fmt(selected.recurring_donors)} منتظم`} />
            <StatBox icon={Target} label="إنجاز المهام" value={`${selected.task_completion_rate.toFixed(1)}%`}
              sub={`${fmt(selected.tasks_completed)}/${fmt(selected.tasks_total)}`} />
            <StatBox icon={Building2} label="الموظفون" value={fmt(selected.employees_count)}
              sub={`${fmt(selected.campaigns)} حملة`} />
          </div>

          {chartError && <p role="alert" className="text-destructive">{chartError} <Button variant="outline" onClick={() => setChartRefresh(v => v + 1)}>إعادة المحاولة</Button></p>}
          {chartLoading && <p role="status">جاري تحميل الرسوم البيانية…</p>}
          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border p-5 shadow-sm">
              <h3 className="text-foreground font-bold mb-1">الإيرادات الشهرية للفترة المختارة</h3>
              <p className="text-muted-foreground text-xs mb-3">
                {monthly.length > 0 ? `${monthly.length} شهر` : "لا توجد بيانات بعد"}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={3}
                        dot={{ fill: "hsl(var(--accent))" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-card border-border p-5 shadow-sm">
              <h3 className="text-foreground font-bold mb-1">خريطة حرارة الأيام</h3>
              <p className="text-muted-foreground text-xs mb-3">عدد التبرعات بحسب يوم الأسبوع — {range.label}</p>
              <Heatmap data={heatmap} />
            </Card>
          </div>

          {/* AI insight */}
          {insight && <AIInsightView insight={insight} />}
        </>
      )}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="group relative overflow-hidden border-border/70 bg-gradient-to-br from-card via-card to-accent/5 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="absolute -left-5 -top-5 h-20 w-20 rounded-full bg-accent/5 transition-transform duration-300 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-xl font-bold leading-tight text-foreground sm:text-2xl">{value}</div>
          {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function Heatmap({ data }: { data: { day: number; value: number }[] }) {
  const labels = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="grid grid-cols-7 gap-2">
      {data.map(d => {
        const intensity = d.value / max;
        return (
          <div key={d.day} className="flex flex-col items-center gap-1">
            <div
              className="w-full aspect-square rounded-lg flex items-center justify-center font-bold text-sm transition-transform hover:scale-105 border border-border"
              style={{
                background: `hsl(174, 52%, ${92 - intensity * 45}%)`,
                color: intensity > 0.5 ? "white" : "hsl(var(--foreground))",
              }}
              title={`${labels[d.day]}: ${d.value} تبرع`}
            >
              {d.value}
            </div>
            <span className="text-[10px] text-muted-foreground">{labels[d.day]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AIInsightView({ insight }: { insight: AIInsight }) {
  const impactColor = (impact: string) => {
    if (impact === "high") return "border-destructive/25 bg-destructive/10 text-destructive";
    if (impact === "medium") return "border-warning/30 bg-warning/10 text-foreground";
    return "border-success/25 bg-success/10 text-success";
  };

  return (
    <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-accent/5 p-5 shadow-sm sm:p-7">
      <div className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-accent/5 blur-2xl" />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/15">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">التحليل الذكي</h3>
            <p className="text-xs text-muted-foreground">رؤى وتوصيات مبنية على بيانات الفترة المحددة</p>
          </div>
          <Badge className="mr-auto border-accent/20 bg-accent/10 text-accent">تحليل ذكي</Badge>
        </div>

        <div className="rounded-2xl border border-accent/15 bg-accent/[0.045] p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            الملخص التنفيذي
          </div>
          <p className="leading-7 text-muted-foreground">{insight.summary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <InsightList icon={CheckCircle2} title="نقاط القوة" items={insight.strengths} variant="success" />
          <InsightList icon={AlertTriangle} title="نقاط الضعف" items={insight.weaknesses} variant="destructive" />
          <InsightList icon={Lightbulb} title="الفرص" items={insight.opportunities} variant="warning" />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 font-bold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            توصيات قابلة للتنفيذ
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {insight.recommendations.map((r, i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-accent/30">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <h5 className="font-bold leading-6 text-foreground">{r.title}</h5>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${impactColor(r.impact)}`}>تأثير {r.impact === "high" ? "عالٍ" : r.impact === "medium" ? "متوسط" : "منخفض"}</Badge>
                </div>
                <p className="pr-8 text-sm leading-6 text-muted-foreground">{r.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InsightList({ icon: Icon, title, items, variant }: any) {
  const variantMap: Record<string, string> = {
    success: "border-success/20 bg-success/[0.06] text-success",
    destructive: "border-destructive/20 bg-destructive/[0.06] text-destructive",
    warning: "border-warning/25 bg-warning/[0.08] text-foreground",
  };
  const iconMap: Record<string, string> = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <div className={`rounded-2xl border p-4 ${variantMap[variant]}`}>
      <div className="mb-3 flex items-center gap-2 font-bold text-foreground">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconMap[variant]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {title}
        <span className="mr-auto rounded-full bg-background/70 px-2 py-0.5 text-xs font-semibold text-muted-foreground">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {items.map((it: string, i: number) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-current">•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">لا توجد ملاحظات مسجلة</p>}
    </div>
  );
}
