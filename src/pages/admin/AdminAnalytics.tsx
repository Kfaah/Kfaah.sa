import { useEffect, useMemo, useState } from "react";
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
  const { metrics, loading } = useAdminAggregates(range);
  const [selectedId, setSelectedId] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [heatmap, setHeatmap] = useState<{ day: number; value: number }[]>([]);
  const [monthly, setMonthly] = useState<{ m: string; donations: number; revenue: number }[]>([]);

  useEffect(() => {
    if (!selectedId && metrics.length > 0) setSelectedId(metrics[0].org_id);
  }, [metrics, selectedId]);

  const selected = useMemo(() => metrics.find(m => m.org_id === selectedId), [metrics, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setInsight(null);
    (async () => {
      let q = supabase
        .from("donations")
        .select("donation_date, amount")
        .eq("organization_id", selectedId);
      if (range.from) q = q.gte("donation_date", range.from.toISOString());
      if (range.to) q = q.lte("donation_date", range.to.toISOString());
      else {
        const since = new Date(); since.setDate(since.getDate() - 90);
        q = q.gte("donation_date", since.toISOString());
      }
      const { data } = await q.limit(20000);

      const days = [0, 0, 0, 0, 0, 0, 0];
      const months: Record<string, { donations: number; revenue: number }> = {};
      (data || []).forEach((r: any) => {
        const d = new Date(r.donation_date);
        days[d.getDay()] += 1;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!months[key]) months[key] = { donations: 0, revenue: 0 };
        months[key].donations += 1;
        months[key].revenue += Number(r.amount || 0);
      });

      setHeatmap(days.map((value, day) => ({ day, value })));
      setMonthly(
        Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
          .map(([m, v]) => ({ m, ...v }))
      );
    })();
  }, [selectedId, range.from, range.to]);

  const runAI = async (force = false) => {
    if (!selected) return;
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
      setInsight(data.insight);
      toast.success(force ? "تم إعادة توليد التحليل" : "تم توليد التحليل الذكي");
    } catch (e: any) {
      toast.error(e.message || "تعذّر توليد التحليل");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-4" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-accent" />
            التحليل العميق
          </h1>
          <p className="text-white mt-1">اختر فترة وجمعية لرؤية تحليل تفصيلي وتوصيات ذكية ثابتة لنفس البيانات</p>
        </div>

        <div className="flex items-center gap-3" dir="rtl">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger dir="rtl" className="w-[280px] text-right">
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
            <SelectTrigger dir="rtl" className="w-[200px] bg-accent text-accent-foreground border-accent hover:bg-accent/90 font-semibold gap-2 text-right">
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
                <Button size="sm" disabled={!tempFrom || !tempTo} onClick={() => {
                  if (!tempFrom || !tempTo) return;
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
            disabled={!selected || aiLoading}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تحليل ذكي بالـ AI
          </Button>
          <Button
            onClick={() => runAI(true)}
            disabled={!selected || aiLoading}
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

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="bg-card border-border p-5 shadow-sm">
              <h3 className="text-foreground font-bold mb-1">الإيرادات الشهرية (آخر فترة)</h3>
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
              <p className="text-muted-foreground text-xs mb-3">عدد التبرعات بحسب يوم الأسبوع — آخر 90 يومًا</p>
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
    <Card className="bg-card border-border p-4 shadow-sm">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
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
  const impactColor = (_: string) => "bg-transparent text-white border-white/60";

  return (
    <Card className="bg-transparent border-primary/30 p-6 space-y-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-white" />
        <h3 className="text-white font-bold text-lg">التحليل الذكي</h3>
        <Badge className="bg-white/15 text-white border-white/40 mr-auto">Gemini</Badge>
      </div>

      <div className="bg-white/10 rounded-xl p-4 border border-white/20">
        <p className="text-white leading-relaxed">{insight.summary}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <InsightList icon={CheckCircle2} title="نقاط القوة" items={insight.strengths} variant="success" />
        <InsightList icon={AlertTriangle} title="نقاط الضعف" items={insight.weaknesses} variant="destructive" />
        <InsightList icon={Lightbulb} title="فرص" items={insight.opportunities} variant="warning" />
      </div>

      <div>
        <div className="text-white font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-white" />
          توصيات قابلة للتنفيذ
        </div>
        <div className="space-y-2">
          {insight.recommendations.map((r, i) => (
            <div key={i} className="bg-white/10 border border-white/20 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h5 className="font-bold text-white">{r.title}</h5>
                <Badge className={impactColor(r.impact)}>تأثير {r.impact === "high" ? "عالٍ" : r.impact === "medium" ? "متوسط" : "منخفض"}</Badge>
              </div>
              <p className="text-sm text-white/85">{r.action}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function InsightList({ icon: Icon, title, items, variant }: any) {
  const variantMap: Record<string, string> = {
    success: "border-success/50 bg-success/25",
    destructive: "border-destructive/50 bg-destructive/25",
    warning: "border-warning/50 bg-warning/25",
  };
  return (
    <div className={`rounded-xl border p-3 text-white ${variantMap[variant]}`}>
      <div className="flex items-center gap-2 mb-2 font-bold text-white">
        <Icon className="w-4 h-4 text-white" />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm text-white">
        {items.map((it: string, i: number) => (
          <li key={i} className="flex gap-2">
            <span className="text-white/70">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
