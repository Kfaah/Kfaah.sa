import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileBarChart2, Download, FileText, Users, HandCoins, ShoppingCart,
  Briefcase, Megaphone, Building2, Loader2, Sparkles, Calendar, Presentation, Award,
  Gift, HeartHandshake, Activity, Target,
} from "lucide-react";
import { useAdminAggregates, type DateRange, type OrgMetrics } from "@/hooks/useAdminAggregates";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import { exportExecutiveReportPpt, type ExecReport } from "@/utils/exportExecutiveReportPpt";
import { PageHeader } from "@/components/layout/PageHeader";

type ThemeKey =
  | "donors" | "campaigns" | "abandoned" | "team" | "fundraising"
  | "gifts" | "service" | "store_health" | "projects";
type Mode = "thematic" | "executive";

const THEMES: { key: ThemeKey; title: string; subtitle: string; icon: any; color: string }[] = [
  { key: "donors", title: "تقرير المتبرعين", subtitle: "تركيبة، انتظام، احتفاظ", icon: Users, color: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  { key: "fundraising", title: "تقرير جمع التبرعات", subtitle: "إيرادات، متوسط، حجم", icon: HandCoins, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { key: "campaigns", title: "تقرير الحملات", subtitle: "حملات نشطة، تحويل، إنتاجية", icon: Megaphone, color: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
  { key: "abandoned", title: "تقرير السلال المتروكة", subtitle: "تسرّب، استرجاع، تحويلات بنكية", icon: ShoppingCart, color: "bg-primary/10 text-primary border-primary/30" },
  { key: "team", title: "تقرير الموظفين والعمليات", subtitle: "إنجاز المهام، قدرة الفريق", icon: Briefcase, color: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  { key: "gifts", title: "تقرير الإهداءات", subtitle: "حجم، تسليم، مهدون متكررون", icon: Gift, color: "bg-pink-500/10 text-pink-600 border-pink-500/30" },
  { key: "service", title: "تقرير خدمة المتبرع", subtitle: "فشل الدفع، مطابقة، استجابة", icon: HeartHandshake, color: "bg-accent/10 text-accent border-accent/30" },
  { key: "store_health", title: "تقرير صحة المتجر", subtitle: "موثوقية، تجربة شراء، تشغيلية", icon: Activity, color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { key: "projects", title: "تقرير المشاريع", subtitle: "تنوّع المشاريع وتركّز الإيراد", icon: Target, color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
];

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtSAR = (n: number) => `${fmt(n)} ر.س`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function AdminReports({ embedded: embeddedProp = false }: { embedded?: boolean } = {}) {
  const [range, setRange] = useState<DateRange>({ from: null, to: null, label: "منذ البداية" });
  const { metrics, loading } = useAdminAggregates(range);
  const [mode, setMode] = useState<Mode>("thematic");
  const [theme, setTheme] = useState<ThemeKey>("donors");
  const [orgId, setOrgId] = useState<string>("");
  const [execReport, setExecReport] = useState<ExecReport | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const _params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEmbedded = embeddedProp || _params.get("embedded") === "1";
  const lockedSlug = _params.get("org") || "";
  const visibleMetrics = useMemo(
    () => (isEmbedded && lockedSlug ? metrics.filter((m) => m.org_slug === lockedSlug) : metrics),
    [metrics, isEmbedded, lockedSlug]
  );

  useEffect(() => {
    if (!orgId && visibleMetrics.length > 0) setOrgId(visibleMetrics[0].org_id);
  }, [visibleMetrics, orgId]);

  const selected = useMemo(() => visibleMetrics.find(m => m.org_id === orgId), [visibleMetrics, orgId]);

  const generateExecutive = async () => {
    if (!selected) return;
    setExecLoading(true);
    setExecReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("executive-report", {
        body: { metrics: selected, period_label: range.label },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setExecReport(data.report as ExecReport);
      toast.success("تم توليد التقرير التنفيذي");
    } catch (e: any) {
      toast.error(e.message || "تعذّر توليد التقرير");
    } finally {
      setExecLoading(false);
    }
  };

  const exportExecPpt = async () => {
    if (!selected || !execReport) return;
    setExportingPpt(true);
    try {
      await exportExecutiveReportPpt({
        orgName: selected.org_name,
        periodLabel: range.label,
        report: execReport,
      });
      toast.success("تم تصدير ملف PowerPoint");
    } catch (e: any) {
      toast.error(e.message || "تعذّر التصدير");
    } finally {
      setExportingPpt(false);
    }
  };

  const exportPDF = () => {
    if (!selected) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica");
    doc.setFontSize(18);
    doc.text(mode === "thematic" ? THEMES.find(t => t.key === theme)!.title : "Executive Report", 40, 50);
    doc.setFontSize(11);
    doc.text(`Organization: ${selected.org_name}`, 40, 75);
    doc.text(`Period: ${range.label}`, 40, 92);
    doc.line(40, 105, 555, 105);

    let y = 130;
    const line = (label: string, value: string) => {
      doc.setFontSize(10);
      doc.text(label, 40, y);
      doc.text(value, 555, y, { align: "right" });
      y += 18;
    };

    if (mode === "thematic") {
      const rows = themeRows(theme, selected);
      rows.forEach(r => line(r.label, r.value));
    } else {
      // executive: render summary + sections (basic; PowerPoint export is the polished output)
      if (!execReport) {
        doc.setFontSize(11);
        doc.text("Generate executive report first.", 40, y);
      } else {
        const sumLines = doc.splitTextToSize(execReport.executive_summary || "", 510);
        doc.setFontSize(11);
        doc.text(sumLines, 40, y);
        y += sumLines.length * 14 + 10;
        for (const s of execReport.sections || []) {
          doc.setFontSize(13);
          doc.text(s.title, 555, y, { align: "right" });
          y += 18;
          doc.setFontSize(10);
          for (const r of s.rows) {
            const txt = `${r.metric}: ${r.result}  —  ${r.analysis}`;
            const wrapped = doc.splitTextToSize(txt, 510);
            doc.text(wrapped, 555, y, { align: "right" });
            y += wrapped.length * 12 + 4;
            if (y > 780) { doc.addPage(); y = 50; }
          }
          y += 8;
        }
      }
    }

    doc.save(`${selected.org_name.replace(/\s+/g, "_")}_${mode}_${theme}.pdf`);
    toast.success("تم تنزيل PDF");
  };

  return (
    <div className={`${isEmbedded ? "" : "mx-auto max-w-[1280px] p-6"} w-full space-y-6`}>
      {!isEmbedded && (
      <PageHeader
        icon={<FileBarChart2 className="w-6 h-6" />}
        title="التقارير"
        subtitle="تقارير موضوعية متخصصة + تقارير تنفيذية سردية للمجلس والجهات الرسمية، قابلة للتصدير PDF"
        actions={
          <Button onClick={exportPDF} disabled={!selected} className="gap-2 bg-white text-primary hover:bg-white/90 disabled:bg-white/60">
            <Download className="w-4 h-4" /> تصدير PDF
          </Button>
        }
      />
      )}
      {isEmbedded && (
        <div className="flex justify-end">
          <Button onClick={exportPDF} disabled={!selected} className="gap-2">
            <Download className="w-4 h-4" /> تصدير PDF
          </Button>
        </div>
      )}

      {/* Mode tabs */}
      <div className="grid md:grid-cols-2 gap-3">
        <ModeCard
          active={mode === "thematic"}
          onClick={() => setMode("thematic")}
          icon={FileBarChart2}
          title="تقارير موضوعية متخصصة"
          desc="عمق رقمي حول محور بعينه (متبرعون، حملات، سلال، فريق...)"
        />
        <ModeCard
          active={mode === "executive"}
          onClick={() => setMode("executive")}
          icon={FileText}
          title="تقرير تنفيذي سردي"
          desc="صياغة سردية احترافية للمجلس والجهات الرسمية"
        />
      </div>

      {/* Filters: org + period */}
      <Card className="p-3 bg-card border-border">
        <div className="flex flex-wrap items-center gap-3">
          {!isEmbedded && (
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="اختر جمعية..." /></SelectTrigger>
              <SelectContent>
                {visibleMetrics.map(m => (
                  <SelectItem key={m.org_id} value={m.org_id}>{m.org_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </Card>

      {/* Thematic mode */}
      {mode === "thematic" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {THEMES.map(t => {
              const Icon = t.icon;
              const isActive = theme === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className={cn(
                    "text-right p-4 rounded-xl border transition-all bg-card",
                    isActive ? "border-accent ring-2 ring-accent/30 shadow-md" : "border-border hover:border-accent/40"
                  )}
                >
                  <div className={cn("inline-flex w-9 h-9 rounded-lg items-center justify-center border mb-2", t.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-sm text-foreground">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{t.subtitle}</div>
                </button>
              );
            })}
          </div>

          {selected && (
            <Card ref={reportRef as any} className="bg-card border-border p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{THEMES.find(t => t.key === theme)?.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> {selected.org_name}
                    <span className="opacity-50">·</span>
                    <Calendar className="w-4 h-4" /> {range.label}
                  </p>
                </div>
                <Badge variant="outline">تقرير موضوعي</Badge>
              </div>
              <ThematicView theme={theme} m={selected} />
            </Card>
          )}
        </>
      )}

      {/* Executive mode */}
      {mode === "executive" && (
        <ExecutiveReportView
          orgName={selected?.org_name}
          periodLabel={range.label}
          report={execReport}
          loading={execLoading}
          exporting={exportingPpt}
          onGenerate={generateExecutive}
          onExportPpt={exportExecPpt}
          disabled={!selected}
        />
      )}

      {loading && <div className="text-center text-muted-foreground">جاري التحميل...</div>}
    </div>
  );
}

function ModeCard({ active, onClick, icon: Icon, title, desc }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-right p-5 rounded-xl border transition-all bg-card flex items-start gap-3",
        active ? "border-accent ring-2 ring-accent/30 shadow-md" : "border-border hover:border-accent/40"
      )}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        active ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
      )}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    </button>
  );
}

function verdictTone(v?: string): string {
  if (!v) return "bg-muted text-foreground border-border";
  if (v.includes("ممتاز")) return "bg-primary/10 text-primary border-primary/30";
  if (v.includes("جيد")) return "bg-sky-500/10 text-sky-600 border-sky-500/30";
  if (v.includes("متوسط")) return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (v.includes("حرج")) return "bg-red-500/10 text-red-600 border-red-500/30";
  return "bg-violet-500/10 text-violet-600 border-violet-500/30";
}

function ExecutiveReportView({
  orgName, periodLabel, report, loading, exporting, onGenerate, onExportPpt, disabled,
}: {
  orgName?: string; periodLabel: string; report: ExecReport | null;
  loading: boolean; exporting: boolean; disabled: boolean;
  onGenerate: () => void; onExportPpt: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="bg-card border-border p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent border border-accent/30 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">تقرير الأداء التنفيذي</h2>
            <p className="text-sm text-muted-foreground">{orgName || "—"} · {periodLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onGenerate} disabled={disabled || loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {report ? "إعادة التوليد" : "توليد التقرير"}
          </Button>
          <Button onClick={onExportPpt} disabled={!report || exporting} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
            تصدير PowerPoint
          </Button>
        </div>
      </Card>

      {!report && !loading && (
        <Card className="bg-card border-border p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">اضغط "توليد التقرير" لإنشاء تقرير تنفيذي منظَّم بأعمدة (الواقع | التحليل والتوجيه)، قابل للتصدير إلى PowerPoint احترافي.</p>
        </Card>
      )}

      {loading && (
        <Card className="bg-card border-border p-12 text-center">
          <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">جارٍ تحليل البيانات وصياغة التقرير...</p>
        </Card>
      )}

      {report && (
        <>
          {/* Hero summary */}
          <Card className="overflow-hidden border-border" dir="rtl">
            <div className="bg-gradient-to-l from-[hsl(229_67%_25%)] to-[hsl(229_60%_15%)] p-6 text-white">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-amber-300/90 font-semibold mb-1">الملخص التنفيذي</div>
                  <h3 className="text-xl font-bold">{orgName}</h3>
                  <p className="text-sm text-white/70 mt-0.5">{periodLabel}</p>
                </div>
                {report.overall_verdict && (
                  <div className={cn("px-4 py-2 rounded-full border text-sm font-bold flex items-center gap-2", verdictTone(report.overall_verdict))}>
                    <Award className="w-4 h-4" />
                    {report.overall_verdict}
                  </div>
                )}
              </div>
              <p className="mt-4 text-base leading-loose text-white/95">{report.executive_summary}</p>
            </div>
          </Card>

          {/* Sections — two-column tables */}
          {(report.sections ?? []).map((section, idx) => (
            <Card key={idx} className="border-border overflow-hidden" dir="rtl">
              <div className="bg-muted/40 border-b border-border px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold tabular-nums">
                  {idx + 1}
                </div>
                <h3 className="font-bold text-foreground">{section.title}</h3>
                <Badge variant="outline" className="ms-auto">{section.rows.length} مؤشر</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[hsl(229_67%_25%)] text-white">
                      <th className="px-4 py-3 text-right font-bold w-[22%]">المؤشر</th>
                      <th className="px-4 py-3 text-right font-bold w-[30%]">النتيجة / الواقع</th>
                      <th className="px-4 py-3 text-right font-bold">التحليل والتوجيه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(section.rows ?? []).map((r, i) => (
                      <tr key={i} className={cn("border-t border-border", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                        <td className="px-4 py-3 text-right font-bold text-foreground align-top">{r.metric}</td>
                        <td className="px-4 py-3 text-right text-foreground align-top">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/20 font-bold tabular-nums">
                            {r.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground align-top leading-relaxed">{r.analysis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}

          {/* Strategic recommendations */}
          {report.strategic_recommendations && report.strategic_recommendations.length > 0 && (
            <Card className="overflow-hidden border-border" dir="rtl">
              <div className="bg-gradient-to-l from-[hsl(229_67%_25%)] to-[hsl(229_60%_15%)] px-5 py-3">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" /> التوصيات الاستراتيجية
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {report.strategic_recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 tabular-nums">{i + 1}</div>
                    <p className="text-foreground leading-relaxed flex-1">{r}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function themeRows(theme: ThemeKey, m: OrgMetrics): { label: string; value: string }[] {
  switch (theme) {
    case "donors": return [
      { label: "إجمالي المتبرعين (الكل)", value: fmt(m.donors_total) },
      { label: "متبرعون نشطون في الفترة", value: fmt(m.donors) },
      { label: "المتبرعون المنتظمون", value: fmt(m.recurring_donors) },
      { label: "نسبة الانتظام", value: pct(m.donors_total ? (m.recurring_donors / m.donors_total) * 100 : 0) },
      { label: "متوسط التبرع", value: fmtSAR(m.avg_donation) },
      { label: "نقاط تفاعل المتبرعين", value: m.donor_engagement_score.toFixed(0) + "/100" },
    ];
    case "fundraising": return [
      { label: "إجمالي الإيرادات", value: fmtSAR(m.total_donated) },
      { label: "عدد التبرعات", value: fmt(m.donations_count) },
      { label: "متوسط التبرع", value: fmtSAR(m.avg_donation) },
      { label: "تبرعات الشهر السابق", value: fmtSAR(m.prev_month_donations) },
      { label: "كفاءة المتبرع الشهرية", value: `${m.donor_efficiency.toFixed(2)} ر.س` },
      { label: "نقاط جمع التبرعات", value: m.fundraising_score.toFixed(0) + "/100" },
    ];
    case "campaigns": return [
      { label: "عدد الحملات", value: fmt(m.campaigns) },
      { label: "عدد التبرعات في الفترة", value: fmt(m.donations_count) },
      { label: "متوسط التبرع للحملة", value: m.campaigns ? fmtSAR(m.total_donated / m.campaigns) : "—" },
      { label: "أفكار تسويقية مقترحة", value: fmt(m.marketing_ideas) },
      { label: "رؤى مولّدة", value: fmt(m.insights) },
    ];
    case "abandoned": return [
      { label: "السلال المتروكة", value: fmt(m.abandoned_carts) },
      { label: "السلال المسترجعة", value: fmt(m.recovered_carts) },
      { label: "نسبة الاسترجاع", value: pct(m.recovery_rate) },
      { label: "التبرعات الفاشلة", value: fmt(m.failed_donations) },
      { label: "التحويلات البنكية", value: fmt(m.bank_transfers) },
      { label: "التحويلات المطابقة", value: fmt(m.matched_transfers) },
      { label: "نقاط الخدمة", value: m.service_score.toFixed(0) + "/100" },
    ];
    case "team": return [
      { label: "عدد الموظفين", value: fmt(m.employees_count) },
      { label: "إجمالي المهام", value: fmt(m.tasks_total) },
      { label: "المهام المكتملة", value: fmt(m.tasks_completed) },
      { label: "نسبة الإنجاز", value: pct(m.task_completion_rate) },
      { label: "نقاط الفريق", value: m.team_score.toFixed(0) + "/100" },
    ];
    case "gifts": return [
      { label: "عدد الإهداءات", value: fmt(m.gifts_count) },
      { label: "قيمة الإهداءات", value: fmtSAR(m.gifts_amount) },
      { label: "متوسط قيمة الإهداء", value: m.gifts_count ? fmtSAR(m.gifts_amount / m.gifts_count) : "—" },
      { label: "إهداءات مُسلَّمة", value: fmt(m.gifts_delivered) },
      { label: "نسبة التسليم", value: pct(m.gifts_delivery_rate) },
      { label: "عدد المُهدين الفريدين", value: fmt(m.unique_gift_givers) },
    ];
    case "service": return [
      { label: "تبرعات فاشلة", value: fmt(m.failed_donations) },
      { label: "نسبة الفشل", value: pct(m.failure_rate) },
      { label: "تحويلات بنكية", value: fmt(m.bank_transfers) },
      { label: "تحويلات مطابقة", value: fmt(m.matched_transfers) },
      { label: "نسبة المطابقة", value: pct(m.match_rate) },
      { label: "نقاط الخدمة", value: m.service_score.toFixed(0) + "/100" },
    ];
    case "store_health": return [
      { label: "نقاط صحة المتجر", value: m.store_health_score.toFixed(0) + "/100" },
      { label: "نسبة استرجاع السلال", value: pct(m.recovery_rate) },
      { label: "نسبة مطابقة التحويلات", value: pct(m.match_rate) },
      { label: "نسبة فشل الدفع", value: pct(m.failure_rate) },
      { label: "إجمالي محاولات الدفع", value: fmt(m.donations_count + m.failed_donations) },
      { label: "موثوقية القناة (1 - الفشل)", value: pct(100 - m.failure_rate) },
    ];
    case "projects": return [
      { label: "عدد المشاريع المختلفة", value: fmt(m.projects_count) },
      { label: "أعلى مشروع تبرعًا", value: m.top_project_name || "—" },
      { label: "إيراد أعلى مشروع", value: fmtSAR(m.top_project_amount) },
      { label: "حصة أعلى مشروع من الإجمالي", value: pct(m.top_project_share) },
      { label: "إجمالي الإيرادات", value: fmtSAR(m.total_donated) },
      { label: "متوسط التبرع", value: fmtSAR(m.avg_donation) },
    ];
  }
}

function ThematicView({ theme, m }: { theme: ThemeKey; m: OrgMetrics }) {
  const rows = themeRows(theme, m);
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
          <span className="text-sm text-muted-foreground">{r.label}</span>
          <span className="font-bold text-foreground tabular-nums" dir="ltr">{r.value}</span>
        </div>
      ))}
    </div>
  );
}