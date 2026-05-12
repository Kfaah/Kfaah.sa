import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ArrowUpDown, GitCompareArrows, TrendingUp, Heart, HandHeart, Users, Star, Info, Gauge, Building2, ListOrdered, ChevronDown } from "lucide-react";
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
  { key: "service_score",          label: "خدمة المتبرع",  icon: HandHeart,  gradient: "from-primary/15 to-primary/5" },
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
  const [viewMode, setViewMode] = useState<"orgs" | "criteria">("orgs");
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const formatMetric = (item: (typeof sortable)[number], value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    return item.format
      ? item.format(safeValue)
      : new Intl.NumberFormat("en-US").format(Math.round(safeValue));
  };

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
            <p className="text-muted-foreground text-xs">
              {viewMode === "orgs"
                ? "انقر عمودًا للترتيب · انقر صفًا للمقارنة"
                : "ترتيب الجمعيات حسب كل معيار على حدة"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode("orgs")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors",
                  viewMode === "orgs"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="بحسب الجمعيات"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>بحسب الجمعيات</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("criteria")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors",
                  viewMode === "criteria"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="بحسب المعايير"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>بحسب المعايير</span>
              </button>
            </div>
            {viewMode === "orgs" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>الترتيب حسب:</span>
                <Badge className="bg-accent/15 text-accent border-accent/40">
                  {sortable.find(s => s.key === sortKey)?.label}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {viewMode === "orgs" && (
        <>
        <div className="hidden lg:block w-full overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-2 py-4 text-center text-foreground font-bold text-sm w-12 sticky right-0 bg-muted/60 z-10">#</th>
                <th className="px-3 py-4 text-right text-foreground font-bold text-sm w-[200px] sticky right-12 bg-muted/60 z-10">الجمعية</th>
                {sortable.map(s => (
                  <th key={s.key as string}
                      className={cn(
                        "px-3 py-4 text-center text-foreground font-bold text-[12px] leading-snug cursor-pointer hover:bg-muted select-none align-middle whitespace-nowrap min-w-[110px]",
                        sortKey === s.key && "text-accent bg-accent/10"
                      )}
                      onClick={() => handleSort(s.key)}>
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
                    <td className="px-2 py-4 text-center sticky right-0 bg-card z-10">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted text-foreground font-bold text-base" dir="ltr">
                        {M ? <M className={cn("w-5 h-5", medalColor)} /> : idx + 1}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right sticky right-12 bg-card z-10">
                      <div className="font-bold text-foreground text-sm leading-tight truncate" title={m.org_name}>{m.org_name}</div>
                      {m.org_slug && <div className="text-[11px] text-muted-foreground mt-1 truncate" dir="ltr">/{m.org_slug}</div>}
                    </td>
                    {sortable.map(s => {
                      const v = Number(m[s.key]) || 0;
                      const display = formatMetric(s, v);
                      const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
                      return (
                        <td key={s.key as string} className="px-3 py-4 text-center text-foreground whitespace-nowrap">
                          {isScore ? (
                            <ScoreBadge value={v} display={display} />
                          ) : (
                            <span dir="ltr" className={cn("inline-block text-sm font-semibold tabular-nums", sortKey === s.key && "text-accent font-bold")}>{display}</span>
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
        <div className="lg:hidden divide-y divide-border">
          {sorted.map((m, idx) => {
            const medalIcon = idx === 0 ? Trophy : idx === 1 ? Medal : idx === 2 ? Award : null;
            const medalColor = idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "";
            const M = medalIcon;
            return (
              <article key={m.org_id} className="p-4 space-y-3 bg-card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted text-foreground font-bold text-sm flex items-center justify-center shrink-0" dir="ltr">
                    {M ? <M className={cn("w-5 h-5", medalColor)} /> : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="font-bold text-foreground text-sm leading-relaxed">{m.org_name}</div>
                    {m.org_slug && <div className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">/{m.org_slug}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sortable.map(s => {
                    const v = Number(m[s.key]) || 0;
                    const display = formatMetric(s, v);
                    const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
                    return (
                      <button
                        key={s.key as string}
                        type="button"
                        onClick={() => handleSort(s.key)}
                        className={cn(
                          "min-w-0 rounded-lg border border-border bg-muted/35 p-2 text-right transition-colors",
                          sortKey === s.key && "border-accent/50 bg-accent/10"
                        )}
                      >
                        <span className="block text-[10px] leading-tight text-muted-foreground">{s.label}</span>
                        <span dir="ltr" className="mt-1 block text-sm font-bold tabular-nums text-foreground truncate">
                          {isScore ? Math.round(v) : display}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
          {!loading && sorted.length === 0 && (
            <div className="text-center text-muted-foreground py-8">لا توجد بيانات بعد</div>
          )}
        </div>
        </>
        )}

        {viewMode === "criteria" && (
          <div className="divide-y divide-border">
            {sortable.map(s => {
              const isOpen = expandedCriterion === (s.key as string);
              const ranked = [...metrics].sort(
                (a, b) => (Number(b[s.key]) || 0) - (Number(a[s.key]) || 0)
              );
              const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
              return (
                <div key={s.key as string} className="bg-card">
                  <button
                    type="button"
                    onClick={() => setExpandedCriterion(isOpen ? null : (s.key as string))}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-5 py-4 text-right transition-colors hover:bg-muted/40",
                      isOpen && "bg-accent/10"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform shrink-0",
                          isOpen && "rotate-180 text-accent"
                        )}
                      />
                      <Badge className="bg-muted text-muted-foreground border-border text-[10px] shrink-0">
                        {ranked.length} جمعية
                      </Badge>
                    </div>
                    <h4 className={cn("font-bold text-sm flex-1 text-right truncate", isOpen ? "text-accent" : "text-foreground")}>
                      {s.label}
                    </h4>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-muted/10 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="px-2 py-2 text-center text-muted-foreground font-bold text-xs w-12">#</th>
                            <th className="px-3 py-2 text-right text-muted-foreground font-bold text-xs">الجمعية</th>
                            <th className="px-3 py-2 text-left text-muted-foreground font-bold text-xs whitespace-nowrap">{s.label}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranked.map((m, idx) => {
                            const v = Number(m[s.key]) || 0;
                            const display = formatMetric(s, v);
                            const medalIcon = idx === 0 ? Trophy : idx === 1 ? Medal : idx === 2 ? Award : null;
                            const medalColor = idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "";
                            const Mi = medalIcon;
                            return (
                              <tr key={m.org_id} className="border-t border-border hover:bg-muted/30">
                                <td className="px-2 py-2 text-center">
                                  <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-foreground font-bold text-xs" dir="ltr">
                                    {Mi ? <Mi className={cn("w-4 h-4", medalColor)} /> : idx + 1}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="font-semibold text-foreground text-xs leading-tight truncate" title={m.org_name}>
                                    {m.org_name}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-left">
                                  {isScore ? (
                                    <ScoreBadge value={v} display={display} />
                                  ) : (
                                    <span dir="ltr" className="inline-block text-sm font-bold tabular-nums text-foreground">{display}</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {!loading && ranked.length === 0 && (
                            <tr><td colSpan={3} className="text-center text-muted-foreground py-6 text-xs">لا توجد بيانات</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
