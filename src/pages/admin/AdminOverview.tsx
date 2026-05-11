import { useMemo } from "react";
import {
  Building2, Users, HandCoins, TrendingUp, Sparkles,
  ShoppingCart, Target, Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAdminAggregates } from "@/hooks/useAdminAggregates";

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n);
const fmtSAR = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);

// ألوان مستمدّة من هوية عطف (HSL من index.css)
const PRIMARY = "hsl(210, 60%, 28%)";   // أزرق داكن
const ACCENT  = "hsl(174, 52%, 52%)";   // تركوازي
const PIE_COLORS = [
  "hsl(174, 52%, 52%)", "hsl(210, 60%, 28%)", "hsl(174, 60%, 45%)",
  "hsl(210, 50%, 45%)", "hsl(195, 55%, 55%)", "hsl(160, 50%, 45%)",
  "hsl(220, 55%, 50%)", "hsl(190, 50%, 60%)",
];

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

  const shortenOrgName = (name: string) => {
    const stripped = name.replace(/^جمعية\s+/, "").replace(/\s+الخيرية$/, "");
    return stripped.length > 10 ? stripped.slice(0, 10) + "…" : stripped;
  };

  const revenueByOrg = useMemo(() =>
    [...metrics]
      .filter(m => m.total_donated > 0)
      .sort((a, b) => b.total_donated - a.total_donated)
      .slice(0, 8)
      .map(m => ({
        name: shortenOrgName(m.org_name),
        fullName: m.org_name,
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
          <p className="text-white/80 mt-1">
            مجموع البيانات من جميع الجمعيات في مكان واحد · لحظة بلحظة
          </p>
        </div>
        {topOrg && (
          <Card className="bg-white border-0 px-4 py-3 flex items-center gap-3 shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">الجمعية الأعلى أداءً</div>
              <div className="text-foreground font-bold">{topOrg.org_name}</div>
            </div>
            <Badge className="bg-accent text-accent-foreground mr-2">
              {topOrg.overall_score.toFixed(0)}/100
            </Badge>
          </Card>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard icon={Building2} label="الجمعيات" value={fmt(totals.orgs)} sub={`${totals.active} نشطة`} />
        <KpiCard icon={Users} label="المتبرعون" value={fmt(totals.donors)} sub="إجمالي" />
        <KpiCard icon={HandCoins} label="التبرعات" value={fmt(totals.donations)} sub="عملية" />
        <KpiCard icon={TrendingUp} label="الإيرادات" value={fmtSAR(totals.revenue)} sub="إجمالي" />
        <KpiCard icon={Users} label="الموظفون" value={fmt(totals.employees)} sub="عبر كل الجمعيات" />
        <KpiCard icon={Sparkles} label="رؤى ذكية" value={fmt(totals.insights)} sub={`${totals.ideas} فكرة تسويق`} />
      </div>

      {/* Health bars */}
      <div className="grid md:grid-cols-2 gap-4">
        <HealthCard
          icon={ShoppingCart} title="استرجاع السلال المتروكة"
          rate={recoveryRate} detail={`${fmt(totals.recovered)} مسترجعة من ${fmt(totals.abandoned)}`}
        />
        <HealthCard
          icon={Target} title="إنجاز المهام"
          rate={completionRate} detail={`${fmt(totals.done)} مكتملة من ${fmt(totals.tasks)}`}
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-foreground font-bold">إيرادات الجمعيات</h3>
              <p className="text-muted-foreground text-xs">أعلى 8 جمعيات</p>
            </div>
            <Badge variant="outline" className="border-accent/40 text-accent">SAR</Badge>
          </div>
          <RevenueBarChart data={revenueByOrg} />
        </Card>

        <Card className="bg-card border-border p-5 shadow-sm">
          <h3 className="text-foreground font-bold mb-1">توزيع المتبرعين</h3>
          <p className="text-muted-foreground text-xs mb-4">حصة كل جمعية</p>

          <div className="flex items-center gap-5" style={{ direction: "ltr" }}>
            {/* قائمة الجمعيات على اليسار */}
            <div className="flex-1 min-w-0 space-y-2 order-1">
              {donorsDist.map((item, i) => {
                const total = donorsDist.reduce((s, d) => s + d.value, 0);
                const pct = total ? (item.value / total) * 100 : 0;
                const color = PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-xs"
                    style={{ direction: "rtl" }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                        style={{ background: color }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-foreground font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-muted-foreground tabular-nums">{fmt(item.value)}</span>
                      <span
                        className="font-bold tabular-nums w-12 text-left"
                        style={{ color }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* الدائرة على اليمين مع الأرقام داخل كل شريحة */}
            <div className="flex-shrink-0 order-2" style={{ width: 200, height: 200 }}>
              <NumberedDonut data={donorsDist} colors={PIE_COLORS} />
            </div>
          </div>
        </Card>
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground">جاري تجميع البيانات…</div>
      )}
    </div>
  );
}

function RevenueBarChart({ data }: { data: { name: string; fullName?: string; revenue: number; donors: number }[] }) {
  const W = 760;
  const H = 300;
  const padX = 44;
  const padTop = 22;
  const padBottom = 54;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBottom;
  const max = Math.max(...data.map((item) => item.revenue), 1);
  const slot = chartW / Math.max(data.length, 1);
  const barW = Math.min(52, slot * 0.56);
  const ticks = [0.25, 0.5, 0.75, 1];

  if (!data.length) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">لا توجد بيانات إيرادات بعد</div>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[300px]" role="img" aria-label="إيرادات الجمعيات">
      <defs>
        <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} />
          <stop offset="100%" stopColor={PRIMARY} />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = padTop + chartH * (1 - tick);
        return (
          <g key={tick}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" />
            <text x={padX - 10} y={y + 4} textAnchor="end" fontSize="11" fill="hsl(var(--muted-foreground))">
              {fmt(Math.round(max * tick))}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const valueH = Math.max(4, (item.revenue / max) * chartH);
        const x = padX + slot * index + (slot - barW) / 2;
        const y = padTop + chartH - valueH;
        return (
          <g key={item.fullName || item.name}>
            <title>{`${item.fullName || item.name}: ${fmtSAR(item.revenue)} · ${fmt(item.donors)} متبرع`}</title>
            <rect x={x} y={y} width={barW} height={valueH} rx="8" fill="url(#adminRevenueGrad)" />
            <text x={x + barW / 2} y={Math.max(14, y - 8)} textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--foreground))">
              {fmt(item.revenue)}
            </text>
            <text x={x + barW / 2} y={H - 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="hsl(var(--muted-foreground))">
              {item.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: {
  icon: any; label: string; value: string; sub: string;
}) {
  return (
    <Card className="bg-card border-border p-4 hover:shadow-card transition-shadow">
      <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-[13px] text-muted-foreground font-medium">{label}</div>
      <div className="text-2xl font-bold text-foreground mt-1 leading-tight">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{sub}</div>
    </Card>
  );
}

function HealthCard({ icon: Icon, title, rate, detail }: {
  icon: any; title: string; rate: number; detail: string;
}) {
  return (
    <Card className="bg-card border-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-foreground font-bold text-base">{title}</h4>
            <p className="text-muted-foreground text-sm font-medium mt-0.5">{detail}</p>
          </div>
        </div>
        <div className="text-2xl font-bold text-accent">
          {rate.toFixed(1)}%
        </div>
      </div>
      <Progress value={rate} className="h-2" />
    </Card>
  );
}

/**
 * Donut chart مع رقم داخل كل شريحة يطابق رقم الجمعية في القائمة الجانبية
 */
function NumberedDonut({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  const W = 200;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const innerR = 50;
  const outerR = 92;
  const labelR = (innerR + outerR) / 2;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let acc = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + angle;
    const mid = start + angle / 2;
    acc = end;

    const large = angle > Math.PI ? 1 : 0;
    const x1 = cx + outerR * Math.cos(start);
    const y1 = cy + outerR * Math.sin(start);
    const x2 = cx + outerR * Math.cos(end);
    const y2 = cy + outerR * Math.sin(end);
    const x3 = cx + innerR * Math.cos(end);
    const y3 = cy + innerR * Math.sin(end);
    const x4 = cx + innerR * Math.cos(start);
    const y4 = cy + innerR * Math.sin(start);

    const path = [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4}`,
      "Z",
    ].join(" ");

    const lx = cx + labelR * Math.cos(mid);
    const ly = cy + labelR * Math.sin(mid);

    return {
      path,
      color: colors[i % colors.length],
      number: i + 1,
      lx,
      ly,
      angle,
    };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {slices.map((s, i) => (
        <g key={i}>
          <path
            d={s.path}
            fill={s.color}
            stroke="hsl(var(--card))"
            strokeWidth={2}
          />
          {s.angle > 0.18 && (
            <text
              x={s.lx}
              y={s.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={13}
              fontWeight={800}
              fill="white"
              style={{ pointerEvents: "none" }}
            >
              {s.number}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
