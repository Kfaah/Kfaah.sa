import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ArrowUpDown, GitCompareArrows, TrendingUp, Heart, HandHeart, Users, Star, Info, Gauge } from "lucide-react";
import { useAdminAggregates, type OrgMetrics, type DateRange } from "@/hooks/useAdminAggregates";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { cn } from "@/lib/utils";

type SortKey = keyof OrgMetrics;

// لوحة ألوان متناغمة مع هوية عطف
const ORG_COLORS = [
  "hsl(174, 52%, 52%)", "hsl(210, 60%, 28%)", "hsl(38, 92%, 50%)",
  "hsl(160, 70%, 40%)", "hsl(220, 55%, 50%)", "hsl(195, 55%, 55%)",
  "hsl(280, 50%, 55%)", "hsl(340, 65%, 55%)", "hsl(20, 80%, 55%)",
  "hsl(140, 50%, 45%)", "hsl(250, 55%, 60%)", "hsl(45, 85%, 50%)",
];

const SCORE_AXES: { key: keyof OrgMetrics; label: string; icon: any; gradient: string }[] = [
  { key: "overall_score",          label: "التقييم العام",  icon: Star,       gradient: "from-primary/20 to-primary/5" },
  { key: "fundraising_score",      label: "جمع التبرعات",  icon: TrendingUp, gradient: "from-amber-500/15 to-amber-500/5" },
  { key: "donor_engagement_score", label: "تفاعل المتبرعين", icon: Heart,     gradient: "from-rose-500/15 to-rose-500/5" },
  { key: "service_score",          label: "خدمة المتبرع",  icon: HandHeart,  gradient: "from-emerald-500/15 to-emerald-500/5" },
  { key: "team_score",             label: "أداء الفريق",   icon: Users,      gradient: "from-sky-500/15 to-sky-500/5" },
  { key: "donor_efficiency_score", label: "كفاءة المتبرع الشهرية", icon: Gauge, gradient: "from-violet-500/15 to-violet-500/5" },
];

const sortable: { key: SortKey; label: string; format?: (n: any) => string }[] = [
  { key: "overall_score", label: "الترتيب العام" },
  { key: "donor_efficiency_score", label: "كفاءة المتبرع الشهرية", format: (n) => n.toFixed(0) },
  { key: "donor_efficiency", label: "ر.س / متبرع (شهري)", format: (n) => n.toFixed(2) },
  { key: "total_donated", label: "الإيرادات", format: (n) => new Intl.NumberFormat("en-US").format(Math.round(n)) },
  { key: "donations_count", label: "عدد التبرعات" },
  { key: "donors", label: "المتبرعون" },
  { key: "avg_donation", label: "متوسط التبرع", format: (n) => Math.round(n).toLocaleString("en-US") },
  { key: "recurring_donors", label: "متبرعون منتظمون" },
  { key: "recovery_rate", label: "% استرجاع السلال", format: (n) => `${n.toFixed(1)}%` },
  { key: "task_completion_rate", label: "% إنجاز المهام", format: (n) => `${n.toFixed(1)}%` },
  { key: "fundraising_score", label: "نقاط جمع التبرعات", format: (n) => n.toFixed(0) },
  { key: "donor_engagement_score", label: "نقاط التفاعل", format: (n) => n.toFixed(0) },
  { key: "service_score", label: "نقاط الخدمة", format: (n) => n.toFixed(0) },
  { key: "team_score", label: "نقاط الفريق", format: (n) => n.toFixed(0) },
];

export default function AdminCompare() {
  const [range, setRange] = useState<DateRange>({ from: null, to: null, label: "منذ البداية" });
  const { metrics, loading } = useAdminAggregates(range);
  const [sortKey, setSortKey] = useState<SortKey>("overall_score");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const list = [...metrics];
    list.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDesc ? bv - av : av - bv;
    });
    return list;
  }, [metrics, sortKey, sortDesc]);

  // خرائط لون ثابتة لكل جمعية + رتبة افتراضية حسب الترتيب العام
  const orgColor = useMemo(() => {
    const map = new Map<string, string>();
    [...metrics]
      .sort((a, b) => b.overall_score - a.overall_score)
      .forEach((m, i) => map.set(m.org_id, ORG_COLORS[i % ORG_COLORS.length]));
    return map;
  }, [metrics]);

  // ترتيب الجمعيات داخل كل عمود حسب نقاط ذلك المحور تنازلياً
  const rankedByAxis = useMemo(() => {
    const map: Record<string, OrgMetrics[]> = {};
    SCORE_AXES.forEach(axis => {
      map[axis.key as string] = [...metrics].sort(
        (a, b) => (b[axis.key] as number) - (a[axis.key] as number)
      );
    });
    return map;
  }, [metrics]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <GitCompareArrows className="w-8 h-8 text-accent" />
            المقارنة بين الجمعيات
          </h1>
          <p className="text-white mt-1">
            ترتيب جميع الجمعيات في كل محور تقييم — حسب الفترة الزمنية المختارة
          </p>
        </div>
      </div>

      {/* Date filter bar */}
      <Card className="p-3 bg-card border-border">
        <DateRangeFilter value={range} onChange={setRange} />
      </Card>

      {/* Formula explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-0 bg-accent/30 border-accent/40 shadow-sm overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-accent/30 bg-accent/20">
              <div className="w-11 h-11 rounded-xl bg-white/90 border border-accent/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-base text-white leading-tight">جمع التبرعات (حجم خام)</div>
                <div className="text-[11px] text-white/80 mt-0.5">⏱ يتأثر بالفلتر الزمني</div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 flex-1">
              <p className="text-sm text-white leading-relaxed">
                إجمالي التبرعات في الفترة المختارة، بمقياس لوغاريتمي للمقارنة العادلة بين الجمعيات.
              </p>
              <div className="font-mono text-sm bg-white/15 text-white border border-white/30 rounded-lg px-3 py-2 text-center font-bold tracking-wide">
                log10(الإجمالي) × 15
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-0 bg-accent/30 border-accent/40 shadow-sm overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-accent/30 bg-accent/20">
              <div className="w-11 h-11 rounded-xl bg-white/90 border border-accent/30 flex items-center justify-center shrink-0">
                <Gauge className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-base text-white leading-tight">كفاءة المتبرع الشهرية</div>
                <div className="text-[11px] text-white/80 mt-0.5">🔒 لا يتأثر بالفلتر</div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 flex-1">
              <p className="text-sm text-white leading-relaxed">
                مقياس الإنتاجية الحقيقي: 100 متبرع بـ 1000 ر.س تتفوّق على 1000 متبرع بـ 5000 ر.س.
              </p>
              <div className="font-mono text-sm bg-white/15 text-white border border-white/30 rounded-lg px-3 py-2 text-center font-bold tracking-wide">
                (تبرعات الشهر السابق ÷ المتبرعين) ÷ 10 × 100
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Columns: عمود لكل محور تقييم */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        {SCORE_AXES.map(axis => {
          const Icon = axis.icon;
          const list = rankedByAxis[axis.key as string] || [];
          const max = list.length ? Math.max(...list.map(m => Number(m[axis.key]) || 0), 1) : 1;
          return (
            <Card key={axis.key as string}
                  className="bg-card border-border overflow-hidden shadow-sm flex flex-col">
              <div className={cn(
                "p-4 border-b border-border bg-gradient-to-b",
                axis.gradient
              )}>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-background/60 border border-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-bold text-sm leading-tight">{axis.label}</h3>
                    <p className="text-muted-foreground text-[11px]">{list.length} جمعية</p>
                  </div>
                </div>
              </div>
              <div className="p-2 space-y-1.5 flex-1">
                {list.map((m, idx) => {
                  const v = Number(m[axis.key]) || 0;
                  const pct = (v / max) * 100;
                  const color = orgColor.get(m.org_id) || ORG_COLORS[0];
                  const isTop = idx === 0;
                  return (
                    <div key={m.org_id}
                         className={cn(
                           "relative rounded-md overflow-hidden border transition-all",
                           isTop ? "border-accent/40" : "border-border/60 hover:border-border"
                         )}>
                      {/* fill bar */}
                      <div className="absolute inset-y-0 right-0 transition-all"
                           style={{ width: `${pct}%`, background: `${color}22` }} />
                      <div className="relative flex items-center gap-2 px-2 py-1.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: color }}>
                          {idx + 1}
                        </span>
                        <span className="text-foreground text-xs font-semibold truncate flex-1" title={m.org_name}>
                          {m.org_name}
                        </span>
                        <span className={cn(
                          "text-xs font-bold tabular-nums shrink-0",
                          isTop ? "text-accent" : "text-foreground/80"
                        )}>
                          {Math.round(v)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!loading && list.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-6">
                    لا توجد بيانات
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Leaderboard */}
      <Card className="bg-card border-border overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-foreground font-bold">جدول الترتيب الذكي</h3>
            <p className="text-muted-foreground text-xs">انقر عمودًا للترتيب · انقر صفًا للمقارنة</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>الترتيب حسب:</span>
            <Badge className="bg-accent/15 text-accent border-accent/40">
              {sortable.find(s => s.key === sortKey)?.label}
            </Badge>
          </div>
        </div>

        <div className="w-full overflow-hidden">
          <table className="w-full text-base table-fixed">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-2 py-4 text-center text-foreground font-bold text-sm w-12">#</th>
                <th className="px-3 py-4 text-right text-foreground font-bold text-sm w-[180px]">الجمعية</th>
                {sortable.map(s => (
                  <th key={s.key as string}
                      className={cn(
                        "px-1.5 py-4 text-center text-foreground font-bold text-[13px] leading-snug cursor-pointer hover:bg-muted select-none align-middle",
                        sortKey === s.key && "text-accent bg-accent/10"
                      )}
                      onClick={() => {
                        if (sortKey === s.key) setSortDesc(!sortDesc);
                        else { setSortKey(s.key); setSortDesc(true); }
                      }}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="break-words hyphens-auto">{s.label}</span>
                      <ArrowUpDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, idx) => {
                const medalIcon = idx === 0 ? Trophy : idx === 1 ? Medal : idx === 2 ? Award : null;
                const medalColor = idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "";
                const M = medalIcon;
                return (
                  <tr key={m.org_id}
                      className="border-t border-border transition-colors hover:bg-muted/40">
                    <td className="px-2 py-4 text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted text-foreground font-bold text-base" dir="ltr">
                        {M ? <M className={cn("w-5 h-5", medalColor)} /> : idx + 1}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="font-bold text-foreground text-sm leading-tight truncate" title={m.org_name}>{m.org_name}</div>
                      {m.org_slug && <div className="text-[11px] text-muted-foreground mt-1 truncate" dir="ltr">/{m.org_slug}</div>}
                    </td>
                    {sortable.map(s => {
                      const v = m[s.key] as number;
                      const display = s.format ? s.format(v) : new Intl.NumberFormat("en-US").format(Math.round(v));
                      const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
                      return (
                        <td key={s.key as string} className="px-1.5 py-4 text-center text-foreground">
                          {isScore ? (
                            <ScoreBadge value={v} display={display} />
                          ) : (
                            <span dir="ltr" className={cn("inline-block text-base font-semibold tabular-nums", sortKey === s.key && "text-accent font-bold")}>{display}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={sortable.length + 2} className="text-center text-muted-foreground py-8">
                  لا توجد بيانات بعد
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ScoreBadge({ value, display }: { value: number; display: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 75 ? "bg-success/15 text-success border-success/40"
              : v >= 50 ? "bg-accent/15 text-accent border-accent/40"
              : v >= 25 ? "bg-warning/15 text-warning border-warning/40"
              : "bg-destructive/15 text-destructive border-destructive/40";
  return (
    <span dir="ltr" className={cn("inline-block px-2 py-1 rounded-md text-base font-bold border tabular-nums", color)}>
      {display}
    </span>
  );
}
