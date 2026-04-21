import { useMemo } from "react";
import {
  Building2, Users, HandCoins, TrendingUp, Sparkles,
  ShoppingCart, Target, Trophy,
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByOrg}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="revenue" fill="url(#revGrad)" radius={[8, 8, 0, 0]} />
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} />
                  <stop offset="100%" stopColor={PRIMARY} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="bg-card border-border p-5 shadow-sm">
          <h3 className="text-foreground font-bold mb-1">توزيع المتبرعين</h3>
          <p className="text-muted-foreground text-xs mb-4">حصة كل جمعية</p>
          <DonorsDonutWithLeaders data={donorsDist} colors={PIE_COLORS} />
        </Card>
      </div>

      {loading && (
        <div className="text-center py-8 text-muted-foreground">جاري تجميع البيانات…</div>
      )}
    </div>
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
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-foreground mt-0.5 leading-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
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
            <h4 className="text-foreground font-bold text-sm">{title}</h4>
            <p className="text-muted-foreground text-xs">{detail}</p>
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
 * Donut chart مع خطوط leader منحنية تربط كل شريحة باسم الجمعية
 * - الدائرة في المنتصف
 * - الأسماء موزّعة على اليمين واليسار حسب موقع الشريحة
 */
function DonorsDonutWithLeaders({
  data,
  colors,
}: {
  data: { name: string; value: number }[];
  colors: string[];
}) {
  const W = 560;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;
  const innerR = 58;
  const outerR = 95;

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  // حساب زوايا كل شريحة
  let acc = -Math.PI / 2; // البداية من الأعلى
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

    // نقطة الانطلاق على حافة الشريحة
    const startX = cx + (outerR + 2) * Math.cos(mid);
    const startY = cy + (outerR + 2) * Math.sin(mid);

    // الجانب: يمين أو يسار
    const isRight = Math.cos(mid) >= 0;

    return {
      path,
      color: colors[i % colors.length],
      name: d.name,
      value: d.value,
      pct: (d.value / total) * 100,
      mid,
      startX,
      startY,
      isRight,
    };
  });

  // ترتيب التسميات على كل جانب من الأعلى للأسفل لتفادي التداخل
  const rightSlices = slices
    .filter((s) => s.isRight)
    .sort((a, b) => a.startY - b.startY);
  const leftSlices = slices
    .filter((s) => !s.isRight)
    .sort((a, b) => a.startY - b.startY);

  const labelGap = 28; // أدنى مسافة عمودية بين التسميات
  const labelTop = 20;
  const labelBottom = H - 20;

  // حساب مواقع التسميات النهائية على كل جانب
  function distributeLabels(group: typeof slices) {
    const n = group.length;
    if (n === 0) return [];
    // ابدأ بالموقع الطبيعي (startY) ثم وزّع لتفادي التداخل
    const positions = group.map((s) => s.startY);
    // مرّر للأمام
    for (let i = 1; i < n; i++) {
      if (positions[i] < positions[i - 1] + labelGap) {
        positions[i] = positions[i - 1] + labelGap;
      }
    }
    // إذا تجاوزنا الحد السفلي، مرّر للخلف
    if (positions[n - 1] > labelBottom) {
      positions[n - 1] = labelBottom;
      for (let i = n - 2; i >= 0; i--) {
        if (positions[i] > positions[i + 1] - labelGap) {
          positions[i] = positions[i + 1] - labelGap;
        }
      }
    }
    // تأكد من عدم تجاوز الحد العلوي
    if (positions[0] < labelTop) {
      positions[0] = labelTop;
      for (let i = 1; i < n; i++) {
        if (positions[i] < positions[i - 1] + labelGap) {
          positions[i] = positions[i - 1] + labelGap;
        }
      }
    }
    return positions;
  }

  const rightYs = distributeLabels(rightSlices);
  const leftYs = distributeLabels(leftSlices);

  const rightLabelX = W - 12;
  const leftLabelX = 12;
  const rightAnchorX = cx + outerR + 90;
  const leftAnchorX = cx - outerR - 90;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ direction: "ltr" }}>
      {/* الشرائح */}
      {slices.map((s, i) => (
        <path
          key={`slice-${i}`}
          d={s.path}
          fill={s.color}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        />
      ))}

      {/* خطوط leader + تسميات اليمين */}
      {rightSlices.map((s, i) => {
        const ly = rightYs[i];
        const lx = rightAnchorX;
        // مسار منحني Bezier من حافة الشريحة إلى نقطة قرب التسمية ثم خط أفقي قصير
        const c1x = s.startX + 30;
        const c1y = s.startY;
        const c2x = lx - 30;
        const c2y = ly;
        const path = `M ${s.startX} ${s.startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${lx} ${ly} L ${rightLabelX - 4} ${ly}`;
        return (
          <g key={`r-${i}`}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.7} />
            <circle cx={s.startX} cy={s.startY} r={3} fill={s.color} />
            <text
              x={rightLabelX}
              y={ly - 6}
              textAnchor="end"
              fontSize={12}
              fontWeight={700}
              fill={s.color}
            >
              {s.name}
            </text>
            <text
              x={rightLabelX}
              y={ly + 9}
              textAnchor="end"
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
            >
              {s.value.toLocaleString("ar-SA")} متبرع · {s.pct.toFixed(1)}%
            </text>
          </g>
        );
      })}

      {/* خطوط leader + تسميات اليسار */}
      {leftSlices.map((s, i) => {
        const ly = leftYs[i];
        const lx = leftAnchorX;
        const c1x = s.startX - 30;
        const c1y = s.startY;
        const c2x = lx + 30;
        const c2y = ly;
        const path = `M ${s.startX} ${s.startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${lx} ${ly} L ${leftLabelX + 4} ${ly}`;
        return (
          <g key={`l-${i}`}>
            <path d={path} fill="none" stroke={s.color} strokeWidth={1.5} opacity={0.7} />
            <circle cx={s.startX} cy={s.startY} r={3} fill={s.color} />
            <text
              x={leftLabelX}
              y={ly - 6}
              textAnchor="start"
              fontSize={12}
              fontWeight={700}
              fill={s.color}
            >
              {s.name}
            </text>
            <text
              x={leftLabelX}
              y={ly + 9}
              textAnchor="start"
              fontSize={10}
              fill="hsl(var(--muted-foreground))"
            >
              {s.value.toLocaleString("ar-SA")} متبرع · {s.pct.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
