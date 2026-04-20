import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Loader2, TrendingUp, TrendingDown, Lightbulb,
  AlertTriangle, CheckCircle2, Building2, Users, HandCoins, Target,
} from "lucide-react";
import { useAdminAggregates, type OrgMetrics } from "@/hooks/useAdminAggregates";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
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
  const { metrics, loading } = useAdminAggregates();
  const [selectedId, setSelectedId] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [heatmap, setHeatmap] = useState<{ day: number; value: number }[]>([]);
  const [monthly, setMonthly] = useState<{ m: string; donations: number; revenue: number }[]>([]);

  useEffect(() => {
    if (!selectedId && metrics.length > 0) setSelectedId(metrics[0].org_id);
  }, [metrics, selectedId]);

  const selected = useMemo(() => metrics.find(m => m.org_id === selectedId), [metrics, selectedId]);

  // Load heatmap (donations per day-of-week last 90 days) + monthly trend
  useEffect(() => {
    if (!selectedId) return;
    setInsight(null);
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await supabase
        .from("donations")
        .select("donation_date, amount")
        .eq("organization_id", selectedId)
        .gte("donation_date", since.toISOString())
        .limit(5000);

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
  }, [selectedId]);

  const runAI = async () => {
    if (!selected) return;
    setAiLoading(true);
    setInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-insights", {
        body: { metrics: selected, all: metrics },
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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-fuchsia-400" />
            التحليل العميق
          </h1>
          <p className="text-slate-400 mt-1">اختر جمعية لرؤية تحليل تفصيلي وتوصيات ذكية</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[280px] bg-slate-800 border-slate-700 text-white">
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
            className="gap-2 bg-gradient-to-l from-fuchsia-500 to-pink-600 hover:opacity-90"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            تحليل ذكي بالـ AI
          </Button>
        </div>
      </div>

      {!selected && !loading && (
        <Card className="bg-slate-900/60 border-slate-700/50 p-12 text-center text-slate-400">
          اختر جمعية للبدء
        </Card>
      )}

      {selected && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox icon={HandCoins} label="الإيرادات" value={fmtSAR(selected.total_donated)}
              grad="from-emerald-400 to-teal-600" />
            <StatBox icon={Users} label="المتبرعون" value={fmt(selected.donors)}
              sub={`${fmt(selected.recurring_donors)} منتظم`} grad="from-violet-500 to-purple-600" />
            <StatBox icon={Target} label="إنجاز المهام" value={`${selected.task_completion_rate.toFixed(1)}%`}
              sub={`${fmt(selected.tasks_completed)}/${fmt(selected.tasks_total)}`} grad="from-cyan-400 to-blue-600" />
            <StatBox icon={Building2} label="الموظفون" value={fmt(selected.employees_count)}
              sub={`${fmt(selected.campaigns)} حملة`} grad="from-amber-400 to-orange-500" />
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="bg-slate-900/60 border-slate-700/50 p-5">
              <h3 className="text-white font-bold mb-1">الإيرادات الشهرية (آخر فترة)</h3>
              <p className="text-slate-400 text-xs mb-3">
                {monthly.length > 0 ? `${monthly.length} شهر` : "لا توجد بيانات بعد"}
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="m" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="bg-slate-900/60 border-slate-700/50 p-5">
              <h3 className="text-white font-bold mb-1">خريطة حرارة الأيام</h3>
              <p className="text-slate-400 text-xs mb-3">عدد التبرعات بحسب يوم الأسبوع — آخر 90 يومًا</p>
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

function StatBox({ icon: Icon, label, value, sub, grad }: any) {
  return (
    <Card className="bg-slate-900/60 border-slate-700/50 p-4">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center mb-2 shadow-lg`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
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
              className="w-full aspect-square rounded-lg flex items-center justify-center text-white font-bold text-sm transition-transform hover:scale-105"
              style={{
                background: `hsl(${280 - intensity * 80}, 70%, ${20 + intensity * 35}%)`,
                opacity: 0.4 + intensity * 0.6,
              }}
              title={`${labels[d.day]}: ${d.value} تبرع`}
            >
              {d.value}
            </div>
            <span className="text-[10px] text-slate-400">{labels[d.day]}</span>
          </div>
        );
      })}
    </div>
  );
}

function AIInsightView({ insight }: { insight: AIInsight }) {
  const impactColor = (i: string) =>
    i === "high" ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
    : i === "medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
    : "bg-slate-500/20 text-slate-300 border-slate-500/40";

  return (
    <Card className="bg-gradient-to-br from-fuchsia-500/10 via-slate-900/60 to-pink-500/10 border-fuchsia-500/30 p-6 space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-fuchsia-400" />
        <h3 className="text-white font-bold text-lg">التحليل الذكي</h3>
        <Badge className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 mr-auto">Gemini</Badge>
      </div>

      <div className="bg-slate-900/40 rounded-xl p-4 border border-slate-700/50">
        <p className="text-slate-100 leading-relaxed">{insight.summary}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <InsightList icon={CheckCircle2} title="نقاط القوة" items={insight.strengths} color="emerald" />
        <InsightList icon={AlertTriangle} title="نقاط الضعف" items={insight.weaknesses} color="rose" />
        <InsightList icon={Lightbulb} title="فرص" items={insight.opportunities} color="amber" />
      </div>

      <div>
        <div className="text-white font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          توصيات قابلة للتنفيذ
        </div>
        <div className="space-y-2">
          {insight.recommendations.map((r, i) => (
            <div key={i} className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h5 className="font-bold text-white">{r.title}</h5>
                <Badge className={impactColor(r.impact)}>تأثير {r.impact === "high" ? "عالٍ" : r.impact === "medium" ? "متوسط" : "منخفض"}</Badge>
              </div>
              <p className="text-sm text-slate-300">{r.action}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function InsightList({ icon: Icon, title, items, color }: any) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    rose: "text-rose-300 border-rose-500/40 bg-rose-500/10",
    amber: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-2 font-bold">
        <Icon className="w-4 h-4" />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm text-slate-200">
        {items.map((it: string, i: number) => (
          <li key={i} className="flex gap-2">
            <span className="text-slate-500">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
