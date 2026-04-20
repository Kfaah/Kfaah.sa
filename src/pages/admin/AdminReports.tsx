import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileBarChart2, Download, Users, HandCoins, ShoppingCart, Briefcase, Trophy } from "lucide-react";
import { useAdminAggregates, type OrgMetrics } from "@/hooks/useAdminAggregates";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));
const pct = (n: number) => `${n.toFixed(1)}%`;

type ReportKey = "fundraising" | "donors" | "service" | "team" | "ranking";

const reports: { key: ReportKey; title: string; desc: string; icon: any }[] = [
  { key: "fundraising", title: "تقرير جمع التبرعات", desc: "إيرادات · عدد العمليات · متوسط التبرع · حملات", icon: HandCoins },
  { key: "donors", title: "تقرير المتبرعين", desc: "إجمالي · منتظمون · معدل الاحتفاظ", icon: Users },
  { key: "service", title: "تقرير خدمة المتبرع", desc: "سلال متروكة · تحويلات بنكية · مطابقة", icon: ShoppingCart },
  { key: "team", title: "تقرير أداء الفِرق", desc: "موظفون · مهام · معدل الإنجاز", icon: Briefcase },
  { key: "ranking", title: "ترتيب الجمعيات الشامل", desc: "مؤشر تقييم متعدد المعايير", icon: Trophy },
];

export default function AdminReports() {
  const { metrics, loading } = useAdminAggregates();
  const [active, setActive] = useState<ReportKey>("fundraising");
  const [employees, setEmployees] = useState<any[]>([]);

  const sorted = useMemo(() => {
    const list = [...metrics];
    switch (active) {
      case "fundraising": return list.sort((a, b) => b.total_donated - a.total_donated);
      case "donors": return list.sort((a, b) => b.donors - a.donors);
      case "service": return list.sort((a, b) => b.recovery_rate - a.recovery_rate);
      case "team": return list.sort((a, b) => b.task_completion_rate - a.task_completion_rate);
      case "ranking": return list.sort((a, b) => b.overall_score - a.overall_score);
    }
  }, [metrics, active]);

  useEffect(() => {
    if (active !== "team") return;
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, job_role, tasks_completed, tasks_total, performance, organization_id, organizations(name)")
        .order("performance", { ascending: false })
        .limit(20);
      setEmployees(data || []);
    })();
  }, [active]);

  const exportCSV = () => {
    if (!sorted.length) return;
    const headers = columns[active].map(c => c.label);
    const rows = sorted.map(m => columns[active].map(c => c.get(m)));
    const csv = [headers, ...rows].map(r => r.map(v =>
      typeof v === "string" && v.includes(",") ? `"${v}"` : v
    ).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير التقرير");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileBarChart2 className="w-8 h-8 text-accent" />
            التقارير
          </h1>
          <p className="text-muted-foreground mt-1">تقارير دقيقة وعميقة لكل المحاور · قابلة للتصدير</p>
        </div>
        <Button onClick={exportCSV} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Download className="w-4 h-4" /> تصدير CSV
        </Button>
      </div>

      {/* Report tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {reports.map(r => {
          const Icon = r.icon;
          const isActive = active === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setActive(r.key)}
              className={cn(
                "text-right p-4 rounded-xl border transition-all",
                isActive
                  ? "bg-accent text-accent-foreground border-accent shadow-card"
                  : "bg-card border-border text-foreground hover:border-accent/50 hover:shadow-sm"
              )}
            >
              <Icon className={cn("w-6 h-6 mb-2", isActive ? "text-accent-foreground" : "text-muted-foreground")} />
              <div className="font-bold text-sm">{r.title}</div>
              <div className={cn("text-[11px] mt-1", isActive ? "text-accent-foreground/85" : "text-muted-foreground")}>
                {r.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-3 text-right text-foreground w-12">#</th>
                <th className="px-3 py-3 text-right text-foreground">الجمعية</th>
                {columns[active].map(c => (
                  <th key={c.key} className="px-3 py-3 text-center text-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={m.org_id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-3 text-center">
                    <Badge variant="outline" className="border-border">{i + 1}</Badge>
                  </td>
                  <td className="px-3 py-3 text-right text-foreground font-medium">{m.org_name}</td>
                  {columns[active].map(c => (
                    <td key={c.key} className="px-3 py-3 text-center text-foreground">{c.get(m)}</td>
                  ))}
                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={columns[active].length + 2} className="text-center text-muted-foreground py-8">لا توجد بيانات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {active === "team" && employees.length > 0 && (
        <Card className="bg-card border-border p-5 shadow-sm">
          <h3 className="text-foreground font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            ترتيب أفضل الموظفين عبر كل الجمعيات
          </h3>
          <div className="space-y-2">
            {employees.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition">
                <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-xs">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-foreground font-medium">{e.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.job_role} · {e.organizations?.name || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-success font-bold">{e.performance || 0}%</div>
                  <div className="text-[10px] text-muted-foreground">
                    {e.tasks_completed || 0}/{e.tasks_total || 0} مهام
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const columns: Record<ReportKey, { key: string; label: string; get: (m: OrgMetrics) => string | number }[]> = {
  fundraising: [
    { key: "revenue", label: "الإيرادات (ر.س)", get: m => fmt(m.total_donated) },
    { key: "count", label: "عدد التبرعات", get: m => fmt(m.donations_count) },
    { key: "avg", label: "متوسط التبرع", get: m => fmt(m.avg_donation) },
    { key: "campaigns", label: "حملات", get: m => fmt(m.campaigns) },
    { key: "score", label: "النقاط", get: m => m.fundraising_score.toFixed(0) },
  ],
  donors: [
    { key: "total", label: "إجمالي المتبرعين", get: m => fmt(m.donors) },
    { key: "recurring", label: "منتظمون", get: m => fmt(m.recurring_donors) },
    { key: "rate", label: "% المنتظمين", get: m => m.donors ? pct((m.recurring_donors / m.donors) * 100) : "0%" },
    { key: "score", label: "النقاط", get: m => m.donor_engagement_score.toFixed(0) },
  ],
  service: [
    { key: "abandoned", label: "سلال متروكة", get: m => fmt(m.abandoned_carts) },
    { key: "recovered", label: "مسترجعة", get: m => fmt(m.recovered_carts) },
    { key: "rec_rate", label: "% الاسترجاع", get: m => pct(m.recovery_rate) },
    { key: "transfers", label: "تحويلات بنكية", get: m => fmt(m.bank_transfers) },
    { key: "matched", label: "مطابقة", get: m => fmt(m.matched_transfers) },
    { key: "score", label: "النقاط", get: m => m.service_score.toFixed(0) },
  ],
  team: [
    { key: "emp", label: "الموظفون", get: m => fmt(m.employees_count) },
    { key: "tasks", label: "المهام", get: m => fmt(m.tasks_total) },
    { key: "done", label: "مكتملة", get: m => fmt(m.tasks_completed) },
    { key: "rate", label: "% الإنجاز", get: m => pct(m.task_completion_rate) },
    { key: "score", label: "النقاط", get: m => m.team_score.toFixed(0) },
  ],
  ranking: [
    { key: "fund", label: "جمع التبرعات", get: m => m.fundraising_score.toFixed(0) },
    { key: "engage", label: "التفاعل", get: m => m.donor_engagement_score.toFixed(0) },
    { key: "service", label: "الخدمة", get: m => m.service_score.toFixed(0) },
    { key: "team", label: "الفريق", get: m => m.team_score.toFixed(0) },
    { key: "overall", label: "التقييم العام", get: m => m.overall_score.toFixed(0) + "/100" },
  ],
};
