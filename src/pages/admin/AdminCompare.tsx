import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Award, ArrowUpDown, GitCompareArrows } from "lucide-react";
import { useAdminAggregates, type OrgMetrics } from "@/hooks/useAdminAggregates";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Tooltip, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

type SortKey = keyof OrgMetrics;

const RADAR_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#3b82f6"];

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

  // Auto-select top 4 if user hasn't chosen
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
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitCompareArrows className="w-8 h-8 text-emerald-400" />
          المقارنة بين الجمعيات
        </h1>
        <p className="text-slate-400 mt-1">
          ترتيب متعدد المعايير + رادار للجمعيات المختارة
        </p>
      </div>

      {/* Radar */}
      <Card className="bg-slate-900/60 border-slate-700/50 p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-white font-bold">رادار المقارنة الذكية</h3>
            <p className="text-slate-400 text-xs">
              {selectedOrgs.length} جمعية مختارة · انقر صفًا في الجدول لإضافته/إزالته
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedOrgs.map((m, i) => (
              <Badge key={m.org_id} className="gap-2" style={{
                backgroundColor: RADAR_COLORS[i % RADAR_COLORS.length] + "33",
                color: RADAR_COLORS[i % RADAR_COLORS.length],
                border: `1px solid ${RADAR_COLORS[i % RADAR_COLORS.length]}66`,
              }}>
                <span className="w-2 h-2 rounded-full" style={{ background: RADAR_COLORS[i % RADAR_COLORS.length] }} />
                {m.org_name}
              </Badge>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#475569" opacity={0.4} />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: "#64748b", fontSize: 10 }} angle={90} domain={[0, 100]} />
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
              contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* Leaderboard */}
      <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-white font-bold">جدول الترتيب الذكي</h3>
            <p className="text-slate-400 text-xs">انقر عمودًا للترتيب · انقر صفًا للمقارنة</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>الترتيب حسب:</span>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
              {sortable.find(s => s.key === sortKey)?.label}
            </Badge>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60">
              <tr>
                <th className="px-3 py-3 text-right text-slate-300 font-semibold w-12">#</th>
                <th className="px-3 py-3 text-right text-slate-300 font-semibold">الجمعية</th>
                {sortable.map(s => (
                  <th key={s.key as string}
                      className={cn(
                        "px-3 py-3 text-center text-slate-300 font-semibold cursor-pointer hover:bg-slate-700/40 select-none",
                        sortKey === s.key && "text-cyan-300 bg-slate-700/30"
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
                const medalColor = idx === 0 ? "text-amber-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-orange-400" : "";
                const M = medalIcon;
                return (
                  <tr key={m.org_id}
                      onClick={() => toggleSelect(m.org_id)}
                      className={cn(
                        "border-t border-slate-700/40 cursor-pointer transition-colors",
                        isSel ? "bg-cyan-500/10 hover:bg-cyan-500/15" : "hover:bg-slate-800/40"
                      )}>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-200 font-bold text-xs">
                        {M ? <M className={cn("w-4 h-4", medalColor)} /> : idx + 1}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="font-semibold text-white">{m.org_name}</div>
                      {m.org_slug && <div className="text-[10px] text-slate-500" dir="ltr">/{m.org_slug}</div>}
                    </td>
                    {sortable.map(s => {
                      const v = m[s.key] as number;
                      const display = s.format ? s.format(v) : new Intl.NumberFormat("ar-SA").format(Math.round(v));
                      const isScore = (s.key as string).includes("score") || (s.key as string).includes("rate");
                      return (
                        <td key={s.key as string} className="px-3 py-3 text-center text-slate-200">
                          {isScore ? (
                            <ScoreBadge value={v} display={display} />
                          ) : (
                            <span className={sortKey === s.key ? "text-cyan-300 font-bold" : ""}>{display}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={sortable.length + 2} className="text-center text-slate-400 py-8">
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
  const color = v >= 75 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : v >= 50 ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
              : v >= 25 ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
              : "bg-rose-500/20 text-rose-300 border-rose-500/40";
  return (
    <span className={cn("inline-block px-2 py-1 rounded-md text-xs font-bold border", color)}>
      {display}
    </span>
  );
}
