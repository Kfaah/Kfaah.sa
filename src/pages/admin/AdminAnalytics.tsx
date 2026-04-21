import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Loader2, TrendingUp, Lightbulb,
  AlertTriangle, CheckCircle2, Building2, Users, HandCoins, Target,
} from "lucide-react";
import { useAdminAggregates } from "@/hooks/useAdminAggregates";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
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

export default function AdminAnalytics() {
  const [range, setRange] = useState<DateRange>({ from: null, to: null, label: "منذ البداية" });
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

  const runAI = async () => {
    if (!selected) return;
    setAiLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-insights", {
        body: { metrics: selected, all: metrics, period_label: range.label },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsight(data.insight);
      toast.success("تم توليد التحليل الذكي");
    } catch (e: any) {
      toast.error(e.message || "تعذّر توليد التحليل");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-accent" />
            التحليل العميق
          </h1>
          <p className="text-white mt-1">اختر جمعية لرؤية تحليل تفصيلي وتوصيات ذكية</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="اختر جمعية..." />
            </SelectTrigger>
            <SelectContent>
              {metrics.map(m => (
                <SelectItem key={m.org_id} value={m.org_id}>
                  {m.org_name} {!m.is_active && "(موقوفة)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={runAI}
            disabled={!selected || aiLoading}
            className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تحليل ذكي بالـ AI
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
  const impactColor = (i: string) =>
    i === "high" ? "bg-destructive/15 text-destructive border-destructive/40"
    : i === "medium" ? "bg-warning/15 text-warning border-warning/40"
    : "bg-muted text-muted-foreground border-border";

  return (
    <Card className="bg-transparent border-accent/30 p-6 space-y-5 shadow-sm">
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
