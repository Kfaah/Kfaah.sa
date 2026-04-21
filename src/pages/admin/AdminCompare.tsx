import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, ArrowUpDown, GitCompareArrows } from "lucide-react";
import { useAdminAggregates, type OrgMetrics } from "@/hooks/useAdminAggregates";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type SortKey = keyof OrgMetrics;

// ألوان الرادار من هوية عطف + ألوان متناغمة
const RADAR_COLORS = [
  "hsl(174, 52%, 52%)", "hsl(210, 60%, 28%)", "hsl(38, 92%, 50%)",
  "hsl(160, 70%, 40%)", "hsl(220, 55%, 50%)", "hsl(195, 55%, 55%)",
];

const sortable: { key: SortKey; label: string; format?: (n: any) => string }[] = [
  { key: "overall_score", label: "الترتيب العام" },
  { key: "total_donated", label: "الإيرادات", format: (n) => new Intl.NumberFormat("ar-SA").format(Math.round(n)) },
  { key: "donations_count", label: "عدد التبرعات" },
  { key: "donors", label: "المتبرعون" },
  { key: "avg_donation", label: "متوسط التبرع", format: (n) => Math.round(n).toLocaleString("ar-SA") },
  { key: "recurring_donors", label: "متبرعون منتظمون" },
  { key: "recovery_rate", label: "% استرجاع السلال", format: (n) => `${n.toFixed(1)}%` },
  { key: "task_completion_rate", label: "% إنجاز المهام", format: (n) => `${n.toFixed(1)}%` },
  { key: "fundraising_score", label: "نقاط جمع التبرعات", format: (n) => n.toFixed(0) },
  { key: "donor_engagement_score", label: "نقاط التفاعل", format: (n) => n.toFixed(0) },
  { key: "service_score", label: "نقاط الخدمة", format: (n) => n.toFixed(0) },
  { key: "team_score", label: "نقاط الفريق", format: (n) => n.toFixed(0) },
];

export default function AdminCompare() {
  const { metrics, loading } = useAdminAggregates();
  const [sortKey, setSortKey] = useState<SortKey>("overall_score");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    const list = [...metrics];
    list.sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDesc ? bv - av : av - bv;
    });
    return list;
  }, [metrics, sortKey, sortDesc]);

  const effectiveSelected = useMemo(() => {
    if (selected.size > 0) return selected;
    return new Set(sorted.slice(0, Math.min(4, sorted.length)).map(m => m.org_id));
  }, [selected, sorted]);

  const radarData = useMemo(() => {
    const axes = [
      { key: "fundraising_score", label: "جمع التبرعات" },
      { key: "donor_engagement_score", label: "تفاعل المتبرعين" },
      { key: "service_score", label: "خدمة المتبرع" },
      { key: "team_score", label: "أداء الفريق" },
      { key: "overall_score", label: "التقييم العام" },
    ];
    return axes.map(axis => {
      const point: any = { axis: axis.label };
      metrics.filter(m => effectiveSelected.has(m.org_id)).forEach(m => {
        point[m.org_name] = Math.round((m as any)[axis.key]);
      });
      return point;
    });
  }, [metrics, effectiveSelected]);

  const selectedOrgs = metrics.filter(m => effectiveSelected.has(m.org_id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev.size === 0
        ? sorted.slice(0, Math.min(4, sorted.length)).map(m => m.org_id)
        : prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <GitCompareArrows className="w-8 h-8 text-accent" />
          المقارنة بين الجمعيات
        </h1>
        <p className="text-muted-foreground mt-1">
          ترتيب متعدد المعايير + رادار للجمعيات المختارة
        </p>
      </div>

      {/* Radar */}
      <Card className="bg-card border-border p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-foreground font-bold">رادار المقارنة الذكية</h3>
            <p className="text-muted-foreground text-xs">
              {selectedOrgs.length} جمعية مختارة · انقر صفًا في الجدول لإضافته/إزالته
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedOrgs.map((m, i) => (
              <Badge key={m.org_id} className="gap-2" style={{
                backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] + "22",
                color: RADAR_COLORS[i % RADAR_COLORS.length],
                border: `1px solid ${RADAR_COLORS[i % RADAR_COLORS.length]}55`,
              }}>
                <span className="w-2 h-2 rounded-full" style={{ background: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                {m.org_name}
              </Badge>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} angle={90} domain={[0, 100]} />
            {selectedOrgs.map((m, i) => (
              <Radar
                key={m.org_id}
                name={m.org_name}
                dataKey={m.org_name}
                stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 14, fontWeight: 700, paddingTop: 12 }}
              iconSize={14}
            />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-3 text-right text-foreground font-semibold w-12">#</th>
                <th className="px-3 py-3 text-right text-foreground font-semibold">الجمعية</th>
                {sortable.map(s => (
                  <th key={s.key as string}
                      className={cn(
                        "px-3 py-3 text-center text-foreground font-semibold cursor-pointer hover:bg-muted select-none",
                        sortKey === s.key && "text-accent bg-accent/10"
                      )}
                      onClick={() => {
                        if (sortKey === s.key) setSortDesc(!sortDesc);
                        else { setSortKey(s.key); setSortDesc(true); }
                      }}>
                    <span className="inline-flex items-center gap-1">
                      {s.label}
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, idx) => {
                const isSel = effectiveSelected.has(m.org_id);
                const medalIcon = idx === 0 ? Trophy : idx === 1 ? Medal : idx === 2 ? Award : null;
                const medalColor = idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-500" : "";
                const M = medalIcon;
                return (
                  <tr key={m.org_id}
                      onClick={() => toggleSelect(m.org_id)}
                      className={cn(
                        "border-t border-border cursor-pointer transition-colors",
                        isSel ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-muted/40"
                      )}>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-bold text-xs">
                        {M ? <M className={cn("w-4 h-4", medalColor)} /> : idx + 1}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-semibold text-foreground">{m.org_name}</div>
                      {m.org_slug && <div className="text-[10px] text-muted-foreground" dir="ltr">/{m.org_slug}</div>}
                    </td>
                    {sortable.map(s => {
                      const v = m[s.key] as number;
                      const display = s.format ? s.format(v) : new Intl.NumberFormat("ar-SA").format(Math.round(v));
                      const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
                      return (
                        <td key={s.key as string} className="px-3 py-3 text-center text-foreground">
                          {isScore ? (
                            <ScoreBadge value={v} display={display} />
                          ) : (
                            <span className={sortKey === s.key ? "text-accent font-bold" : ""}>{display}</span>
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
    <span className={cn("inline-block px-2 py-1 rounded-md text-xs font-bold border", color)}>
      {display}
    </span>
  );
}
