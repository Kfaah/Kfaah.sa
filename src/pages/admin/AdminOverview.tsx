import { useMemo } from "react";
import {
  Building2, Users, HandCoins, TrendingUp, Sparkles, AlertTriangle,
  ShoppingCart, Banknote, Target, Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAdminAggregates } from "@/hooks/useAdminAggregates";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n);
const fmtSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#f43f5e", "#84cc16"];

export default function AdminOverview() {
  const { metrics, loading } = useAdminAggregates();

  const totals = useMemo(() => {
    return metrics.reduce((acc, m) => ({
      orgs: acc.orgs + 1,
      active: acc.active + (m.is_active ? 1 : 0),
      donors: acc.donors + m.donors,
      donations: acc.donations + m.donations_count,
      revenue: acc.revenue + m.total_donated,
      employees: acc.employees + m.employees_count,
      abandoned: acc.abandoned + m.abandoned_carts,
      recovered: acc.recovered + m.recovered_carts,
      tasks: acc.tasks + m.tasks_total,
      done: acc.done + m.tasks_completed,
      ideas: acc.ideas + m.marketing_ideas,
      insights: acc.insights + m.insights,
    }), { orgs: 0, active: 0, donors: 0, donations: 0, revenue: 0, employees: 0,
          abandoned: 0, recovered: 0, tasks: 0, done: 0, ideas: 0, insights: 0 });
  }, [metrics]);

  const revenueByOrg = useMemo(() =>
    [...metrics].sort((a, b) => b.total_donated - a.total_donated).slice(0, 8).map(m => ({
      name: m.org_name.length > 12 ? m.org_name.slice(0, 12) + "…" : m.org_name,
      revenue: Math.round(m.total_donated),
      donors: m.donors,
    })), [metrics]);

  const donorsDist = useMemo(() =>
    metrics.filter(m => m.donors > 0).slice(0, 8).map(m => ({
      name: m.org_name, value: m.donors,
    })), [metrics]);

  const recoveryRate = totals.abandoned ? (totals.recovered / totals.abandoned) * 100 : 0;
  const completionRate = totals.tasks ? (totals.done / totals.tasks) * 100 : 0;

  const topOrg = useMemo(() =>
    [...metrics].sort((a, b) => b.overall_score - a.overall_score)[0], [metrics]);

  return (
    <div className="p-8 space-y-6">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">نظرة عامة موحّدة</h1>
          <p className="text-slate-400 mt-1">
            مجموع البيانات من جميع الجمعيات في مكان واحد · لحظة بلحظة
          </p>
        </div>
        {topOrg && (
          <Card className="bg-gradient-to-l from-amber-500/20 to-orange-500/20 border-amber-500/30 px-4 py-3 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-[11px] text-amber-300">الجمعية الأعلى أداءً</div>
              <div className="text-white font-bold">{topOrg.org_name}</div>
            </div>
            <Badge className="bg-amber-500 text-amber-950 mr-2">
              {topOrg.overall_score.toFixed(0)}/100
            </Badge>
          </Card>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard icon={Building2} label="الجمعيات" value={fmt(totals.orgs)}
          sub={`${totals.active} نشطة`} grad="from-cyan-400 to-blue-600" />
        <KpiCard icon={Users} label="المتبرعون" value={fmt(totals.donors)}
          sub="إجمالي" grad="from-violet-500 to-purple-600" />
        <KpiCard icon={HandCoins} label="التبرعات" value={fmt(totals.donations)}
          sub="عملية" grad="from-emerald-400 to-teal-600" />
        <KpiCard icon={TrendingUp} label="الإيرادات" value={fmtSAR(totals.revenue)}
          sub="إجمالي" grad="from-amber-400 to-orange-500" />
        <KpiCard icon={Users} label="الموظفون" value={fmt(totals.employees)}
          sub="عبر كل الجمعيات" grad="from-pink-400 to-rose-600" />
        <KpiCard icon={Sparkles} label="رؤى ذكية" value={fmt(totals.insights)}
          sub={`${totals.ideas} فكرة تسويق`} grad="from-fuchsia-500 to-pink-600" />
      </div>

      {/* Health bars */}
      <div className="grid md:grid-cols-2 gap-4">
        <HealthCard
          icon={ShoppingCart} title="استرجاع السلال المتروكة"
          rate={recoveryRate} detail={`${fmt(totals.recovered)} مسترجعة من ${fmt(totals.abandoned)}`}
          color="emerald"
        />
        <HealthCard
          icon={Target} title="إنجاز المهام"
          rate={completionRate} detail={`${fmt(totals.done)} مكتملة من ${fmt(totals.tasks)}`}
          color="cyan"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold">إيرادات الجمعيات</h3>
              <p className="text-slate-400 text-xs">أعلى 8 جمعيات</p>
            </div>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">SAR</Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByOrg}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Bar dataKey="revenue" fill="url(#grad1)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-slate-900/60 border-slate-700/50 p-5">
          <h3 className="text-white font-bold mb-1">توزيع المتبرعين</h3>
          <p className="text-slate-400 text-xs mb-4">حصة كل جمعية</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={donorsDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                   innerRadius={50} outerRadius={90} paddingAngle={2}>
                {donorsDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: "#cbd5e1" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400">جاري تجميع البيانات…</div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, grad }: {
  icon: any; label: string; value: string; sub: string; grad: string;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-700/50 p-4 relative overflow-hidden group hover:border-slate-500/50 transition-colors">
      <div className={`absolute -top-4 -left-4 w-20 h-20 rounded-full bg-gradient-to-br ${grad} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`} />
      <div className="relative">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center mb-2 shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="text-xl font-bold text-white mt-0.5 leading-tight">{value}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </div>
    </Card>
  );
}

function HealthCard({ icon: Icon, title, rate, detail, color }: {
  icon: any; title: string; rate: number; detail: string; color: "emerald" | "cyan";
}) {
  const colorMap = {
    emerald: "from-emerald-400 to-teal-600 text-emerald-300",
    cyan: "from-cyan-400 to-blue-600 text-cyan-300",
  };
  return (
    <Card className="bg-slate-900/60 border-slate-700/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color].split(" text-")[0]} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">{title}</h4>
            <p className="text-slate-400 text-xs">{detail}</p>
          </div>
        </div>
        <div className={`text-2xl font-bold ${colorMap[color].split("text-")[1] ? "text-" + colorMap[color].split("text-")[1] : ""}`}>
          {rate.toFixed(1)}%
        </div>
      </div>
      <Progress value={rate} className="h-2 bg-slate-800" />
    </Card>
  );
}
