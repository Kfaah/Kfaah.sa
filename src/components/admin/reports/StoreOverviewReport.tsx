import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Download, Loader2, Store, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { UnifiedDateFilter, DatePeriod, resolvePeriod } from "./UnifiedDateFilter";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
const sar = (n: number) => `${fmt(n)} ر.س`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];


const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`;

const KAFAAH_LOGO = "/favicon.png";

// تحويل الشعار إلى data URL حتى يظهر داخل ملف PDF بلا مشاكل CORS
async function toDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}


interface Analysis {
  donationsCount: number;
  donationsTotal: number;
  avgDonation: number;
  uniqueDonors: number;
  reachDonors: number;
  repeatDonors: number;
  oneTimeDonors: number;
  hourly: { hour: number; label: string; count: number; total: number }[];
  weekday: { day: string; count: number; total: number }[];
  topProjects: { name: string; count: number; total: number }[];
  monthly: { month: string; count: number; total: number }[];
  topDonors: { name: string; phone: string; count: number; total: number }[];
  campaignsCount: number;
  campaignsGoal: number;
  campaignsCollected: number;
  topCampaigns: { name: string; goal: number; collected: number; status: string }[];
  failedCount: number;
  failedTotal: number;
  failReasons: { reason: string; count: number; total: number }[];
  cartsCount: number;
  cartsTotal: number;
  cartsRecovered: number;
  subsCount: number;
  subsActive: number;
  subsMonthly: number;
  giftsCount: number;
  giftsTotal: number;
  giftsDelivered: number;
  /** كل التفاصيل المحسوبة على الخادم (تُرسل كاملة للتحليل الذكي) */
  breakdowns: Record<string, any>;
}


interface SmartAnalysis {
  executive_summary?: string;
  headline_findings?: string[];
  donor_analysis?: {
    overview?: string;
    segments?: { name?: string; criteria?: string; size_estimate?: string; value?: string; behavior?: string; risk?: string; action?: string }[];
    retention?: string;
    churn_signals?: string[];
  };
  digital_presence?: { overview?: string; strengths?: string[]; gaps?: string[]; actions?: string[] };
  web_review?: Record<string, { strengths?: string[]; gaps?: string[]; fix_list?: string[] }>;
  send_timing?: {
    summary?: string;
    best_hours?: { window?: string; why?: string; channels?: string }[];
    best_days?: { day?: string; why?: string; note?: string }[];
    avoid?: string[];
    frequency?: string;
    cadence_by_segment?: { segment?: string; channel?: string; best_day?: string; best_time?: string; frequency?: string }[];
    seasonal_windows?: string[];
  };
  messaging_plan?: {
    objective?: string;
    waves?: { wave?: string; segment?: string; channel?: string; timing?: string; send_day?: string; send_time?: string; audience_size?: string; goal?: string; message_ar?: string; variant_b?: string; follow_up?: string; cta?: string; kpi?: string; expected_result?: string; owner?: string }[];
    calendar?: { week?: string; tasks?: string[] }[];
  };
  operational_details?: {
    data_hygiene?: string[];
    compliance?: string[];
    tools?: string[];
    ab_tests?: { test?: string; hypothesis?: string; metric?: string }[];
  };
  recommendations?: { title?: string; why?: string; how?: string[]; impact?: string; effort?: string; priority?: string }[];
  kpi_targets?: { kpi?: string; current?: string; target_90d?: string }[];
  risks?: string[];
}

const ARABIC_DISPLAY_TERMS: Record<string, string> = {
  critical: "حرجة",
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
  whatsapp: "واتساب",
  sms: "رسالة نصية",
  email: "بريد إلكتروني",
  call: "اتصال هاتفي",
  website: "الموقع الإلكتروني",
  store: "المتجر الإلكتروني",
  social: "حسابات التواصل الاجتماعي",
};

function arabicDisplay(value: string | number | undefined | null): string | number {
  if (typeof value !== "string") return value ?? "—";
  const exact = ARABIC_DISPLAY_TERMS[value.trim().toLowerCase()];
  if (exact) return exact;
  return value
    .replace(/\bKPI(?:s)?\b/gi, "مؤشر الأداء")
    .replace(/\bCTA\b/gi, "الدعوة إلى الإجراء")
    .replace(/\bA\s*\/\s*B\b/gi, "المقارنة بين نسختين")
    .replace(/\bCRM\b/gi, "إدارة علاقات المتبرعين")
    .replace(/\bSMS\b/gi, "الرسائل النصية")
    .replace(/\bWhatsApp\b/gi, "واتساب")
    .replace(/\bEmail\b/gi, "البريد الإلكتروني");
}

function unifiedDigitalPresence(smart: SmartAnalysis) {
  if (smart.digital_presence) return smart.digital_presence;
  const legacy = Object.values(smart.web_review || {});
  return {
    strengths: legacy.flatMap((item) => item.strengths || []).slice(0, 2),
    gaps: legacy.flatMap((item) => item.gaps || []).slice(0, 2),
    actions: legacy.flatMap((item) => item.fix_list || []).slice(0, 3),
  };
}

export default function StoreOverviewReport({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const [period, setPeriod] = useState<DatePeriod>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<Analysis | null>(null);
  const [orgName, setOrgName] = useState("");
  const [smart, setSmart] = useState<SmartAnalysis | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const smartRef = useRef<HTMLDivElement>(null);
  const branding = useOrgBranding();
  const orgLogo = branding?.logoUrl || null;
  const todayLabel = new Date().toLocaleDateString("ar-SA-u-nu-latn", { day: "2-digit", month: "2-digit", year: "numeric" });

  const range = useMemo(() => resolvePeriod(period, { from: customFrom, to: customTo }), [period, customFrom, customTo]);
  const fromDate = range.from ? range.from.toISOString().slice(0, 10) : null;
  const toDate = range.to ? range.to.toISOString().slice(0, 10) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [org, agg] = await Promise.all([
          supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
          supabase.rpc("store_overview", { p_org: orgId, p_from: fromDate, p_to: toDate }),
        ]);
        if (cancelled) return;
        if (agg.error) throw agg.error;
        setOrgName((org.data as any)?.name || "");
        const r = (agg.data || {}) as any;
        const num = (v: any) => Number(v || 0);
        const donationsCount = num(r.donations_count);
        const donationsTotal = num(r.donations_total);
        setData({
          donationsCount,
          donationsTotal,
          avgDonation: donationsCount ? donationsTotal / donationsCount : 0,
          uniqueDonors: num(r.unique_donors),
          reachDonors: num(r.reach_donors),
          repeatDonors: num(r.repeat_donors),
          oneTimeDonors: num(r.one_time_donors),
          hourly: (r.hourly || []).map((h: any) => ({
            hour: num(h.hour),
            label: hourLabel(num(h.hour)),
            count: num(h.count),
            total: num(h.total),
          })),
          weekday: (r.weekday || []).map((d: any) => ({
            day: DAY_NAMES[num(d.dow)] || "—",
            count: num(d.count),
            total: num(d.total),
          })),
          topProjects: (r.top_projects || []).map((p: any) => ({ name: p.name || "غير محدد", count: num(p.count), total: num(p.total) })),
          monthly: (r.monthly || []).map((m: any) => ({ month: m.month || "—", count: num(m.count), total: num(m.total) })),
          topDonors: (r.top_donors || []).map((d: any) => ({ name: d.name || "—", phone: d.phone || "—", count: num(d.count), total: num(d.total) })),
          campaignsCount: num(r.campaigns_count),
          campaignsGoal: num(r.campaigns_goal),
          campaignsCollected: num(r.campaigns_collected),
          topCampaigns: (r.top_campaigns || []).map((c: any) => ({ name: c.name || "—", goal: num(c.goal), collected: num(c.collected), status: c.status || "—" })),
          failedCount: num(r.failed_count),
          failedTotal: num(r.failed_total),
          failReasons: (r.fail_reasons || []).map((f: any) => ({ reason: f.reason || "غير محدد", count: num(f.count), total: num(f.total) })),
          cartsCount: num(r.carts_count),
          cartsTotal: num(r.carts_total),
          cartsRecovered: num(r.carts_recovered),
          subsCount: num(r.subs_count),
          subsActive: num(r.subs_active),
          subsMonthly: num(r.subs_monthly),
          giftsCount: num(r.gifts_count),
          giftsTotal: num(r.gifts_total),
          giftsDelivered: num(r.gifts_delivered),
          breakdowns: r,
        });
      } catch (e: any) {
        toast.error(e.message || "تعذر تحميل التحليل الشامل");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId, fromDate, toDate]);

  const insights = useMemo(() => {
    if (!data) return [] as string[];
    const out: string[] = [];
    out.push(`إجمالي مبيعات المتجر خلال الفترة ${sar(data.donationsTotal)} من ${fmt(data.donationsCount)} عملية تبرع، بمتوسط ${sar(data.avgDonation)} للعملية.`);
    if (data.topProjects[0]) out.push(`أعلى مشروع تحصيلاً: ${data.topProjects[0].name} بمبلغ ${sar(data.topProjects[0].total)} (${pct(data.topProjects[0].total, data.donationsTotal)} من الإجمالي).`);
    if (data.failedCount) out.push(`التبرعات الفاشلة ${fmt(data.failedCount)} بقيمة ${sar(data.failedTotal)} — فرصة استرداد مباشرة بمعاودة المتبرعين.`);
    if (data.cartsCount) out.push(`السلال المتروكة ${fmt(data.cartsCount)} بقيمة ${sar(data.cartsTotal)}، نسبة الاسترداد الحالية ${pct(data.cartsRecovered, data.cartsCount)}.`);
    if (data.subsCount) out.push(`الاستقطاع الشهري النشط ${fmt(data.subsActive)} مشترك بقيمة شهرية ${sar(data.subsMonthly)} (إيراد متكرر متوقع سنوياً ${sar(data.subsMonthly * 12)}).`);
    if (data.giftsCount) out.push(`الإهداءات ${fmt(data.giftsCount)} بقيمة ${sar(data.giftsTotal)}، نسبة التسليم ${pct(data.giftsDelivered, data.giftsCount)}.`);
    if (data.campaignsCount) out.push(`الحملات ${fmt(data.campaignsCount)} حملة، نسبة تحقيق الأهداف ${pct(data.campaignsCollected, data.campaignsGoal)}.`);
    out.push(`قاعدة التواصل الفعلية ${fmt(data.reachDonors)} متبرعاً مختلفاً عبر جميع القنوات (تبرعات، إهداءات، استقطاع، سلال)، منهم ${fmt(data.uniqueDonors)} متبرعاً في التبرعات المباشرة.`);
    out.push(`المتبرعون المتكررون ${fmt(data.repeatDonors)} (${pct(data.repeatDonors, data.uniqueDonors)}) ومن تبرع مرة واحدة ${fmt(data.oneTimeDonors)} — أكبر فرصة لرفع التكرار.`);
    if (data.hourly[0]) out.push(`أفضل وقت للإرسال: ${data.hourly.slice(0, 3).map((h) => h.label).join(" ثم ")} بتوقيت الرياض (${pct(data.hourly.slice(0, 3).reduce((s, h) => s + h.count, 0), data.donationsCount)} من التبرعات).`);
    if (data.weekday[0]) out.push(`أفضل أيام الإرسال: ${data.weekday.slice(0, 3).map((d) => d.day).join(" • ")}، وأضعفها ${data.weekday[data.weekday.length - 1]?.day || "—"}.`);
    return out;
  }, [data]);

  const runSmart = async () => {
    if (!data) return;
    setSmartLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-deep-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${session?.session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)}`,
          },
          body: JSON.stringify({
            organization_id: orgId,
          from: fromDate,
          to: toDate,
          metrics: {
            donations: {
              count: data.donationsCount,
              total: data.donationsTotal,
              avg: Math.round(data.avgDonation),
              unique_donors: data.uniqueDonors,
              total_reachable_donors_all_channels: data.reachDonors,
              repeat_donors: data.repeatDonors,
              one_time_donors: data.oneTimeDonors,
            },
            timing: {
              timezone: "Asia/Riyadh",
              best_hours: data.hourly.slice(0, 6).map((h) => ({ window: h.label, donations: h.count, total: Math.round(h.total) })),
              weakest_hours: data.hourly.slice(-4).map((h) => ({ window: h.label, donations: h.count })),
              best_days: data.weekday.map((d) => ({ day: d.day, donations: d.count, total: Math.round(d.total) })),
            },
            top_projects: data.topProjects,
            monthly: data.monthly,
            top_donors: data.topDonors.map((d) => ({ name: d.name, count: d.count, total: d.total })),
            campaigns: { count: data.campaignsCount, goal: data.campaignsGoal, collected: data.campaignsCollected, top: data.topCampaigns, by_status: data.breakdowns.campaigns_by_status },
            failed: { count: data.failedCount, total: data.failedTotal, reasons: data.failReasons },
            abandoned_carts: {
              count: data.cartsCount,
              total: data.cartsTotal,
              recovered: data.cartsRecovered,
              avg: data.breakdowns.carts_avg,
              by_status: data.breakdowns.carts_by_status,
              projects: data.breakdowns.carts_projects,
              monthly: data.breakdowns.carts_monthly,
            },
            subscriptions: {
              count: data.subsCount,
              active: data.subsActive,
              monthly_value: data.subsMonthly,
              avg: data.breakdowns.subs_avg,
              by_status: data.breakdowns.subs_by_status,
              projects: data.breakdowns.subs_projects,
              cancellation_reasons: data.breakdowns.subs_cancel_reasons,
            },
            gifts: {
              count: data.giftsCount,
              total: data.giftsTotal,
              delivered: data.giftsDelivered,
              avg: data.breakdowns.gifts_avg,
              unique_givers: data.breakdowns.gifts_givers,
              occasions: data.breakdowns.gifts_occasions,
              projects: data.breakdowns.gifts_projects,
              monthly: data.breakdowns.gifts_monthly,
              delivery_statuses: data.breakdowns.gifts_statuses,
              best_hours: data.breakdowns.gifts_hourly,
              top_givers: data.breakdowns.top_givers,
            },
            donation_channels: {
              payment_methods: data.breakdowns.payment_methods,
              sources: data.breakdowns.donation_sources,
              statuses: data.breakdowns.donation_statuses,
              amount_bands: data.breakdowns.amount_bands,
            },
            donor_segmentation: {
              value_bands: data.breakdowns.donor_value_bands,
              recency: data.breakdowns.donor_recency,
              frequency: data.breakdowns.donor_frequency,
              crm_donors: data.breakdowns.crm_donors_count,
              crm_repeat_donors: data.breakdowns.crm_repeat_donors,
              crm_total_donated: data.breakdowns.crm_total_donated,
              crm_segments: data.breakdowns.crm_segments,
              cities: data.breakdowns.crm_cities,
              gender: data.breakdowns.crm_gender,
            },
            data_coverage: data.breakdowns.data_coverage,
            },
          }),
        },
      );
      if (!resp.ok || !resp.body) throw new Error("تعذر الاتصال بخدمة التحليل");

      // الخدمة تبث نبضات أثناء التحليل ثم النتيجة بعد العلامة __RESULT__
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
      const marker = raw.indexOf("__RESULT__");
      if (marker < 0) throw new Error("لم يكتمل التحليل، حاول مرة أخرى");
      const res = JSON.parse(raw.slice(marker + "__RESULT__".length));
      if (res?.error) throw new Error(res.error);
      setSmart((res?.analysis || null) as SmartAnalysis | null);
      toast.success("تم توليد التحليل الذكي الشامل");
      setTimeout(() => smartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    } catch (e: any) {
      toast.error(e.message || "تعذر توليد التحليل الذكي");
    } finally {
      setSmartLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      // تأكد من تحميل الخط العربي قبل الرسم حتى لا تظهر الحروف غريبة
      try { await (document as any).fonts?.ready; } catch { /* ignore */ }
      if (!document.querySelector('link[data-store-report-font]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.setAttribute("data-store-report-font", "1");
        link.href = "https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap";
        document.head.appendChild(link);
        await new Promise((r) => setTimeout(r, 600));
        try { await (document as any).fonts?.ready; } catch { /* ignore */ }
      }

      const esc = (s: string) =>
        String(s ?? "").replace(/[&<>"']/g, (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
        );
      const GREEN = "#0d7a5f";
      const table = (title: string, head: string[], rows: (string | number)[][]) =>
        rows.length
          ? `<div data-pdf-table="true" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid">
              <div style="background:${GREEN};color:#fff;padding:8px 14px;font-weight:700;font-size:13px">${esc(title)}</div>
              <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px">
                <thead><tr>${head.map((h) => `<th style="background:#f1f5f9;padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0">${esc(h)}</th>`).join("")}</tr></thead>
                 <tbody>${rows.map((r) => `<tr style="break-inside:avoid">${r.map((c) => `<td style="padding:7px 10px;text-align:right;vertical-align:top;border-bottom:1px solid #f1f5f9;overflow-wrap:anywhere">${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody>
              </table>
            </div>`
          : "";
      const kpi = (label: string, value: string) =>
        `<div style="background:linear-gradient(135deg,#f8fafc 0%,#eef7f3 100%);border:1px solid #d8e8e1;border-right:4px solid ${GREEN};border-radius:10px;padding:12px">
           <div style="font-size:10px;color:#64748b">${esc(label)}</div>
           <div style="font-size:15px;font-weight:800;margin-top:4px;color:${GREEN}">${esc(value)}</div>
         </div>`;

      const [orgLogoData, kafaahLogoData] = await Promise.all([toDataUrl(orgLogo), toDataUrl(KAFAAH_LOGO)]);
      const logoBox = (src: string | null, alt: string, size: number) =>
        src
          ? `<div style="width:${size}px;height:${size}px;background:#fff;border-radius:12px;padding:6px;box-shadow:0 2px 6px rgba(0,0,0,.12)">
               <img src="${src}" alt="${esc(alt)}" style="width:100%;height:100%;object-fit:contain" />
             </div>`
          : "";

      // نرسم التقرير داخل إطار معزول صغير: html2canvas ينسخ المستند كاملاً،
      // فرسمه داخل إطار خفيف يجعل التصدير أسرع بعدة أضعاف من رسمه داخل صفحة اللوحة.
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;top:0;left:0;width:820px;height:1200px;border:0;z-index:-1;pointer-events:none;opacity:0";
      document.body.appendChild(frame);
      const doc = frame.contentDocument!;
      doc.open();
      doc.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" />
        <style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:'Tajawal','Cairo','Segoe UI',sans-serif}</style>
        </head><body></body></html>`);
      doc.close();
      try { await (doc as any).fonts?.ready; } catch { /* ignore */ }

      const wrap = doc.createElement("div");
      wrap.dir = "rtl";
      wrap.setAttribute("lang", "ar");
      wrap.style.cssText = `position:absolute;top:0;left:0;width:714px;background:#ffffff;color:#0f172a;font-family:'Tajawal','Cairo','Segoe UI',sans-serif;line-height:1.7;font-size:13px`;
      wrap.innerHTML = `
        <div style="background:linear-gradient(115deg,${GREEN} 0%,#0f8f6d 55%,#16a97f 100%);color:#fff;border-radius:16px;padding:22px 24px;margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;gap:16px">
          <div style="display:flex;align-items:center;gap:14px">
            ${logoBox(orgLogoData, orgName, 62)}
            <div>
              <div style="font-size:11px;opacity:.85">${esc(orgName)}</div>
              <div style="font-size:24px;font-weight:800;margin:2px 0 4px">التحليل الشامل للمتجر</div>
              <div style="font-size:11px;opacity:.85">الفترة: ${fromDate || "من البداية"} — ${toDate || "حتى الآن"} · تاريخ التقرير: ${esc(todayLabel)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${logoBox(kafaahLogoData, "منصة كفاءة", 48)}
            <div style="font-size:10px;line-height:1.5">
              <div style="font-weight:800;font-size:12px">منصة كفاءة</div>
              <div style="opacity:.85">لإدارة التسويق الإلكتروني للجمعيات</div>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px">
          ${kpi("إجمالي التبرعات", sar(data.donationsTotal))}
          ${kpi("عدد العمليات", fmt(data.donationsCount))}
          ${kpi("متوسط التبرع", sar(data.avgDonation))}
          ${kpi("متبرعو التبرعات المباشرة", fmt(data.uniqueDonors))}
          ${kpi("قاعدة المتبرعين (كل القنوات)", fmt(data.reachDonors))}
          ${kpi("متبرعون متكررون", `${fmt(data.repeatDonors)} · ${pct(data.repeatDonors, data.uniqueDonors)}`)}
          ${kpi("تبرعوا مرة واحدة", fmt(data.oneTimeDonors))}
          ${kpi("التبرعات الفاشلة", `${fmt(data.failedCount)} · ${sar(data.failedTotal)}`)}
          ${kpi("السلال المتروكة", `${fmt(data.cartsCount)} · ${sar(data.cartsTotal)}`)}
          ${kpi("الاستقطاع النشط", `${fmt(data.subsActive)} · ${sar(data.subsMonthly)}/شهر`)}
          ${kpi("الإهداءات", `${fmt(data.giftsCount)} · ${sar(data.giftsTotal)}`)}
        </div>

        <div style="margin-bottom:22px;border:1px solid ${GREEN}55;border-radius:10px;padding:14px">
          <div style="font-weight:700;color:${GREEN};margin-bottom:8px;font-size:14px">قراءة تحليلية</div>
          <ul style="margin:0 20px 0 0;padding:0;color:#475569">${insights.map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join("")}</ul>
        </div>

        ${table("أعلى المشاريع تحصيلاً", ["المشروع", "عدد العمليات", "الإجمالي", "النسبة"], data.topProjects.map((p) => [p.name, fmt(p.count), sar(p.total), pct(p.total, data.donationsTotal)]))}
        ${table("أداء الحملات", ["الحملة", "الحالة", "الهدف", "المُحصَّل", "نسبة الإنجاز"], data.topCampaigns.map((c) => [c.name, c.status || "—", sar(c.goal), sar(c.collected), pct(c.collected, c.goal)]))}
        ${table("أعلى المتبرعين", ["المتبرع", "الجوال", "عدد التبرعات", "الإجمالي"], data.topDonors.map((d) => [d.name, d.phone, fmt(d.count), sar(d.total)]))}
        ${table("أسباب فشل التبرعات", ["السبب", "العدد", "القيمة المفقودة"], data.failReasons.map((r) => [r.reason, fmt(r.count), sar(r.total)]))}
        ${table("التوزيع الشهري للتبرعات", ["الشهر", "عدد العمليات", "الإجمالي"], data.monthly.map((m) => [m.month, fmt(m.count), sar(m.total)]))}
        ${table("أفضل ساعات التبرع (توقيت الرياض)", ["النافذة الزمنية", "عدد التبرعات", "الإجمالي", "النسبة"], data.hourly.slice(0, 8).map((h) => [h.label, fmt(h.count), sar(h.total), pct(h.count, data.donationsCount)]))}
        ${table("أفضل أيام الأسبوع للتبرع", ["اليوم", "عدد التبرعات", "الإجمالي", "النسبة"], data.weekday.map((d) => [d.day, fmt(d.count), sar(d.total), pct(d.count, data.donationsCount)]))}
        ${smart ? `
          <div style="margin:26px 0 14px;border-bottom:3px solid ${GREEN};padding-bottom:6px;font-size:18px;font-weight:800;color:${GREEN}">التحليل الذكي الشامل</div>
          ${smart.executive_summary ? `<div style="margin-bottom:16px;white-space:pre-wrap">${esc(smart.executive_summary)}</div>` : ""}
          ${smart.headline_findings?.length ? `<ul style="margin:0 20px 18px 0;padding:0;color:#475569">${smart.headline_findings.map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join("")}</ul>` : ""}
          ${smart.donor_analysis?.overview ? `<div style="margin-bottom:14px;white-space:pre-wrap"><b>تحليل المتبرعين:</b> ${esc(smart.donor_analysis.overview)}</div>` : ""}
          ${table("شرائح المتبرعين", ["الشريحة", "المعيار", "الحجم", "القيمة", "السلوك", "الإجراء"], (smart.donor_analysis?.segments || []).map((s) => [s.name || "—", s.criteria || "—", s.size_estimate || "—", s.value || "—", s.behavior || "—", s.action || "—"]))}
          ${smart.donor_analysis?.retention ? `<div style="margin-bottom:14px;white-space:pre-wrap"><b>الولاء والاستمرارية:</b> ${esc(smart.donor_analysis.retention)}</div>` : ""}
          ${(() => { const digital = unifiedDigitalPresence(smart); return `${digital.overview ? `<div style="margin-bottom:10px;white-space:pre-wrap"><b>خلاصة الحضور الرقمي:</b> ${esc(digital.overview)}</div>` : ""}${table("خلاصة الحضور الرقمي", ["نقاط القوة", "الفجوات", "إجراءات التحسين"], [[(digital.strengths || []).join(" • ") || "—", (digital.gaps || []).join(" • ") || "—", (digital.actions || []).join(" • ") || "—"]])}`; })()}
          ${smart.send_timing?.summary ? `<div style="margin-bottom:10px;white-space:pre-wrap"><b>أوقات الإرسال المثالية:</b> ${esc(smart.send_timing.summary)}</div>` : ""}
          ${table("أفضل ساعات الإرسال", ["النافذة", "المبرر", "القنوات"], (smart.send_timing?.best_hours || []).map((h) => [h.window || "—", h.why || "—", h.channels || "—"]))}
          ${table("أفضل أيام الإرسال", ["اليوم", "المبرر", "ملاحظة"], (smart.send_timing?.best_days || []).map((d) => [d.day || "—", d.why || "—", d.note || "—"]))}
          ${table("تكرار التواصل حسب الشريحة", ["الشريحة", "القناة", "اليوم", "الساعة", "التكرار"], (smart.send_timing?.cadence_by_segment || []).map((c) => [c.segment || "—", c.channel || "—", c.best_day || "—", c.best_time || "—", c.frequency || "—"]))}
          ${smart.send_timing?.frequency ? `<div style="margin-bottom:8px"><b>سقف التكرار:</b> ${esc(smart.send_timing.frequency)}</div>` : ""}
          ${smart.send_timing?.avoid?.length ? `<div style="margin-bottom:10px"><b>أوقات يُفضّل تجنبها:</b> ${esc(smart.send_timing.avoid.join(" • "))}</div>` : ""}
          ${smart.send_timing?.seasonal_windows?.length ? `<div style="margin-bottom:14px"><b>النوافذ الموسمية:</b><ul style="margin:6px 20px 0 0;padding:0;color:#475569">${smart.send_timing.seasonal_windows.map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join("")}</ul></div>` : ""}
          ${smart.messaging_plan?.objective ? `<div style="margin-bottom:10px"><b>هدف خطة الرسائل:</b> ${esc(smart.messaging_plan.objective)}</div>` : ""}
          ${table("الخطة التنفيذية لرسائل المتبرعين", ["الموجة", "الشريحة", "القناة", "اليوم", "الساعة", "الحجم", "نص الرسالة", "نسخة بديلة", "المتابعة", "الدعوة للإجراء", "المؤشر", "النتيجة المتوقعة", "المسؤول"], (smart.messaging_plan?.waves || []).map((w) => [w.wave || "—", w.segment || "—", w.channel || "—", w.send_day || w.timing || "—", w.send_time || "—", w.audience_size || "—", w.message_ar || "—", w.variant_b || "—", w.follow_up || "—", w.cta || "—", w.kpi || "—", w.expected_result || "—", w.owner || "—"]))}
          ${table("الجدول الأسبوعي للتنفيذ", ["الأسبوع", "المهام"], (smart.messaging_plan?.calendar || []).map((c) => [c.week || "—", (c.tasks || []).join(" • ")]))}
           ${table("اختبارات المقارنة بين نسختين", ["الاختبار", "الفرضية", "المؤشر"], (smart.operational_details?.ab_tests || []).map((t) => [arabicDisplay(t.test), arabicDisplay(t.hypothesis), arabicDisplay(t.metric)]))}
          ${smart.operational_details?.data_hygiene?.length ? `<div style="margin-bottom:8px"><b>تنقية البيانات:</b> ${esc(smart.operational_details.data_hygiene.join(" • "))}</div>` : ""}
          ${smart.operational_details?.compliance?.length ? `<div style="margin-bottom:8px"><b>الالتزام والخصوصية:</b> ${esc(smart.operational_details.compliance.join(" • "))}</div>` : ""}
          ${smart.operational_details?.tools?.length ? `<div style="margin-bottom:12px"><b>الأدوات المطلوبة:</b> ${esc(smart.operational_details.tools.join(" • "))}</div>` : ""}
           ${table("المقترحات التنفيذية", ["المقترح", "المبرر", "خطوات التنفيذ", "الأثر", "الجهد", "الأولوية"], (smart.recommendations || []).map((r) => [arabicDisplay(r.title), arabicDisplay(r.why), arabicDisplay((r.how || []).join(" • ")), arabicDisplay(r.impact), arabicDisplay(r.effort), arabicDisplay(r.priority)]))}
          ${table("مستهدفات المؤشرات (90 يوماً)", ["المؤشر", "الحالي", "المستهدف"], (smart.kpi_targets || []).map((k) => [k.kpi || "—", k.current || "—", k.target_90d || "—"]))}
          ${smart.risks?.length ? `<div style="margin-bottom:14px"><b>المخاطر:</b><ul style="margin:6px 20px 0 0;padding:0;color:#475569">${smart.risks.map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join("")}</ul></div>` : ""}
        ` : ""}
      `;

      doc.body.appendChild(wrap);
      let pagesHost: HTMLDivElement | null = null;
      try {
        const PAGE_WIDTH_PX = 794;
        const PAGE_HEIGHT_PX = 1123;
        const PAGE_PADDING_X = 40;
        const PAGE_PADDING_TOP = 38;
        const PAGE_PADDING_BOTTOM = 54;
        pagesHost = doc.createElement("div");
        pagesHost.style.cssText = "position:absolute;top:0;left:0;background:#ffffff";
        doc.body.appendChild(pagesHost);

        const pageContentHeight = PAGE_HEIGHT_PX - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM;
        const makePage = () => {
          const page = doc.createElement("div");
          page.dir = "rtl";
          page.setAttribute("lang", "ar");
          page.style.cssText = `position:relative;width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;box-sizing:border-box;padding:${PAGE_PADDING_TOP}px ${PAGE_PADDING_X}px ${PAGE_PADDING_BOTTOM}px;background:#fff;color:#0f172a;font-family:'Tajawal','Cairo','Segoe UI',sans-serif;line-height:1.7;font-size:13px;overflow:hidden`;
          const content = doc.createElement("div");
          content.style.cssText = `width:100%;height:${pageContentHeight}px;overflow:hidden`;
          const footer = doc.createElement("div");
          footer.style.cssText = `position:absolute;right:${PAGE_PADDING_X}px;left:${PAGE_PADDING_X}px;bottom:18px;border-top:1px solid #d8e8e1;padding-top:7px;display:flex;align-items:center;justify-content:space-between;font-size:9px;color:#64748b`;
          footer.innerHTML = `<span>${esc(orgName)} · التحليل الشامل للمتجر · ${esc(todayLabel)}</span><span style="display:flex;align-items:center;gap:5px">${kafaahLogoData ? `<img src="${kafaahLogoData}" alt="" style="width:16px;height:16px;object-fit:contain" />` : ""}منصة كفاءة</span>`;
          page.append(content, footer);
          pagesHost.appendChild(page);
          return { page, content };
        };

        const fits = (content: HTMLElement) => content.scrollHeight <= pageContentHeight + 1;
        let current = makePage();

        const addTableAcrossPages = (sourceTableBlock: HTMLElement) => {
          const sourceTable = sourceTableBlock.querySelector("table");
          const sourceBody = sourceTable?.querySelector("tbody");
          if (!sourceTable || !sourceBody) return;
          const rows = Array.from(sourceBody.rows);
          let chunk: HTMLElement | null = null;
          let chunkBody: HTMLTableSectionElement | null = null;

          const startChunk = () => {
            chunk = sourceTableBlock.cloneNode(true) as HTMLElement;
            chunkBody = chunk.querySelector("tbody");
            if (chunkBody) chunkBody.innerHTML = "";
            current.content.appendChild(chunk);
          };

          startChunk();
          rows.forEach((row) => {
            if (!chunk || !chunkBody) return;
            const rowClone = row.cloneNode(true) as HTMLTableRowElement;
            chunkBody.appendChild(rowClone);
            if (!fits(current.content)) {
              chunkBody.removeChild(rowClone);
              if (chunkBody.rows.length === 0) {
                chunkBody.appendChild(rowClone);
                return;
              }
              current = makePage();
              startChunk();
              chunkBody?.appendChild(rowClone);
            }
          });
        };

        Array.from(wrap.children).forEach((sourceChild) => {
          const child = sourceChild.cloneNode(true) as HTMLElement;
          if (child.dataset.pdfTable === "true") {
            const probe = child.cloneNode(true) as HTMLElement;
            current.content.appendChild(probe);
            if (fits(current.content)) return;
            current.content.removeChild(probe);
            addTableAcrossPages(child);
            return;
          }

          current.content.appendChild(child);
          if (!fits(current.content)) {
            current.content.removeChild(child);
            current = makePage();
            current.content.appendChild(child);
          }
        });

        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const pageCount = pagesHost.children.length;

        // رسم واحد لكل الصفحات مجتمعة (أسرع بكثير من رسم كل صفحة على حدة)
        const SCALE = 1.4;
        pagesHost.style.width = `${PAGE_WIDTH_PX}px`;
        const fullCanvas = await html2canvas(pagesHost, {
          scale: SCALE,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          imageTimeout: 0,
          width: PAGE_WIDTH_PX,
          height: PAGE_HEIGHT_PX * pageCount,
          windowWidth: PAGE_WIDTH_PX,
          windowHeight: PAGE_HEIGHT_PX * pageCount,
        });

        const sliceW = Math.round(PAGE_WIDTH_PX * SCALE);
        const sliceH = Math.round(PAGE_HEIGHT_PX * SCALE);
        const slice = document.createElement("canvas");
        slice.width = sliceW;
        slice.height = sliceH;
        const ctx = slice.getContext("2d")!;
        for (let index = 0; index < pageCount; index += 1) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceW, sliceH);
          ctx.drawImage(fullCanvas, 0, index * sliceH, sliceW, sliceH, 0, 0, sliceW, sliceH);
          const img = slice.toDataURL("image/jpeg", 0.85);
          if (index > 0) pdf.addPage();
          pdf.addImage(img, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
        }
        pdf.save(`التحليل-الشامل-للمتجر-${fromDate || "all"}.pdf`);
        toast.success("تم تصدير التحليل الشامل بصيغة PDF");
      } finally {
        if (frame.parentNode) frame.parentNode.removeChild(frame);
      }
    } catch (e: any) {
      toast.error(e.message || "تعذر تصدير الملف");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <div className="shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-3 text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">التحليل الشامل للمتجر</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">صورة كاملة لأداء المتجر: التبرعات، المشاريع، الحملات، الفاشلة، السلال، الاستقطاع، الإهداءات</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <Button onClick={runSmart} disabled={loading || smartLoading || !data} variant="secondary" className="h-auto min-h-10 gap-1 whitespace-normal py-2 leading-5 sm:h-10 sm:whitespace-nowrap sm:py-0">
            {smartLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {smart ? "إعادة توليد التحليل الذكي" : "توليد التحليل الذكي"}
          </Button>
          <Button onClick={exportPdf} disabled={loading || exporting || !data} className="h-auto min-h-10 gap-1 py-2 sm:h-10 sm:py-0">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            تصدير PDF
          </Button>
          <Button variant="ghost" onClick={onBack} className="col-span-2 sm:col-auto">
            رجوع للتقارير <ArrowRight className="h-4 w-4 mr-1" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
        <UnifiedDateFilter
          period={period}
          onPeriodChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> جارٍ تحليل بيانات المتجر…
        </div>
      ) : !data ? (
        <div className="py-20 text-center text-muted-foreground">لا توجد بيانات للمتجر في هذه الفترة</div>
      ) : (
        <div ref={printRef} className="min-w-0 space-y-4 rounded-xl bg-background px-0 py-3 sm:p-4">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-l from-primary via-primary/90 to-emerald-600 p-4 text-primary-foreground shadow-lg sm:rounded-2xl sm:p-6">
            <div className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-primary-foreground/10" />
            <div className="absolute -left-4 bottom-[-3rem] h-32 w-32 rounded-full bg-primary-foreground/5" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                {orgLogo && (
                  <div className="h-16 w-16 rounded-xl bg-primary-foreground p-1.5 shadow-sm shrink-0">
                    <img src={orgLogo} alt={orgName} className="h-full w-full object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs opacity-80">{orgName}</div>
                  <h3 className="mt-0.5 text-xl font-extrabold sm:text-2xl">التحليل الشامل للمتجر</h3>
                  <div className="mt-1 text-xs leading-5 opacity-80">
                    الفترة: {fromDate || "من البداية"} — {toDate || "حتى الآن"} · تاريخ التقرير: {todayLabel}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end text-xs sm:self-auto">
                <div className="h-12 w-12 rounded-xl bg-primary-foreground p-1.5 shadow-sm shrink-0">
                  <img src={KAFAAH_LOGO} alt="منصة كفاءة" className="h-full w-full object-contain" />
                </div>
                <div className="leading-tight">
                  <div className="font-bold">منصة كفاءة</div>
                  <div className="opacity-80">لإدارة التسويق الإلكتروني للجمعيات</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {[
              ["إجمالي التبرعات", sar(data.donationsTotal)],
              ["عدد العمليات", fmt(data.donationsCount)],
              ["متوسط التبرع", sar(data.avgDonation)],
              ["متبرعو التبرعات المباشرة", fmt(data.uniqueDonors)],
              ["قاعدة المتبرعين (كل القنوات)", fmt(data.reachDonors)],
              ["متبرعون متكررون", `${fmt(data.repeatDonors)} · ${pct(data.repeatDonors, data.uniqueDonors)}`],
              ["تبرعوا مرة واحدة", fmt(data.oneTimeDonors)],
              ["التبرعات الفاشلة", `${fmt(data.failedCount)} · ${sar(data.failedTotal)}`],
              ["السلال المتروكة", `${fmt(data.cartsCount)} · ${sar(data.cartsTotal)}`],
              ["الاستقطاع النشط", `${fmt(data.subsActive)} · ${sar(data.subsMonthly)}/شهر`],
              ["الإهداءات", `${fmt(data.giftsCount)} · ${sar(data.giftsTotal)}`],
            ].map(([k, v]) => (
              <Card key={k as string} className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-card to-primary/5 shadow-sm">
                <span className="absolute inset-y-0 right-0 w-1 bg-primary/70" />
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="mt-1 break-words text-lg font-bold text-primary">{v}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> قراءة تحليلية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 list-disc pr-5 text-muted-foreground">
                {insights.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </CardContent>
          </Card>

          <SectionTable
            title="أعلى المشاريع تحصيلاً"
            head={["المشروع", "عدد العمليات", "الإجمالي", "النسبة"]}
            rows={data.topProjects.map(p => [p.name, fmt(p.count), sar(p.total), pct(p.total, data.donationsTotal)])}
          />

          <SectionTable
            title="أداء الحملات"
            head={["الحملة", "الحالة", "الهدف", "المُحصَّل", "نسبة الإنجاز"]}
            rows={data.topCampaigns.map(c => [c.name, c.status || "—", sar(c.goal), sar(c.collected), pct(c.collected, c.goal)])}
          />

          <SectionTable
            title="أعلى المتبرعين"
            head={["المتبرع", "الجوال", "عدد التبرعات", "الإجمالي"]}
            rows={data.topDonors.map(d => [d.name, d.phone, fmt(d.count), sar(d.total)])}
          />

          <SectionTable
            title="أسباب فشل التبرعات"
            head={["السبب", "العدد", "القيمة المفقودة"]}
            rows={data.failReasons.map(r => [r.reason, fmt(r.count), sar(r.total)])}
          />

          <SectionTable
            title="التوزيع الشهري للتبرعات"
            head={["الشهر", "عدد العمليات", "الإجمالي"]}
            rows={data.monthly.map(m => [m.month, fmt(m.count), sar(m.total)])}
          />

          <SectionTable
            title="أفضل ساعات التبرع (توقيت الرياض)"
            head={["النافذة الزمنية", "عدد التبرعات", "الإجمالي", "النسبة"]}
            rows={data.hourly.slice(0, 8).map(h => [h.label, fmt(h.count), sar(h.total), pct(h.count, data.donationsCount)])}
          />

          <SectionTable
            title="أفضل أيام الأسبوع للتبرع"
            head={["اليوم", "عدد التبرعات", "الإجمالي", "النسبة"]}
            rows={data.weekday.map(d => [d.day, fmt(d.count), sar(d.total), pct(d.count, data.donationsCount)])}
          />


          {smartLoading && (
            <div className="py-10 text-center text-muted-foreground border border-dashed rounded-xl">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              جارٍ التحليل الذكي: مراجعة المتبرعين والموقع والمتجر وبناء خطة الرسائل…
            </div>
          )}

          {smart && (
            <div ref={smartRef} className="space-y-4 pt-2">
              <div className="border-b-4 border-primary pb-2">
                <h3 className="text-xl font-extrabold text-primary">التحليل الذكي الشامل</h3>
              </div>

              {smart.executive_summary && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2"><CardTitle className="text-base">الملخص التنفيذي</CardTitle></CardHeader>
                  <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">{smart.executive_summary}</CardContent>
                </Card>
              )}

              {!!smart.headline_findings?.length && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">أبرز النتائج</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1 list-disc pr-5 text-muted-foreground">
                      {smart.headline_findings.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {(smart.donor_analysis?.overview || smart.donor_analysis?.retention || !!smart.donor_analysis?.churn_signals?.length) && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">تحليل المتبرعين</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2 text-muted-foreground">
                    {smart.donor_analysis?.overview && <p className="whitespace-pre-wrap">{smart.donor_analysis.overview}</p>}
                    {smart.donor_analysis?.retention && <p className="whitespace-pre-wrap"><span className="font-semibold text-foreground">الولاء والاستمرارية: </span>{smart.donor_analysis.retention}</p>}
                    {!!smart.donor_analysis?.churn_signals?.length && (
                      <div>
                        <div className="font-semibold text-foreground">مؤشرات التسرب</div>
                        <ul className="list-disc pr-5 space-y-1">{smart.donor_analysis.churn_signals.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <SectionTable
                title="شرائح المتبرعين"
                head={["الشريحة", "المعيار", "الحجم", "القيمة", "السلوك", "الإجراء"]}
                rows={(smart.donor_analysis?.segments || []).map(s => [s.name || "—", s.criteria || "—", s.size_estimate || "—", s.value || "—", s.behavior || "—", s.action || "—"])}
              />

              {(() => {
                const digital = unifiedDigitalPresence(smart);
                const hasDigital = digital.overview || digital.strengths?.length || digital.gaps?.length || digital.actions?.length;
                return hasDigital ? (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">خلاصة الحضور الرقمي</CardTitle></CardHeader>
                  {digital.overview && <CardContent className="pb-0 text-sm whitespace-pre-wrap text-muted-foreground">{digital.overview}</CardContent>}
                  <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
                    {([["نقاط القوة", digital.strengths], ["الفجوات", digital.gaps], ["إجراءات التحسين", digital.actions]] as [string, string[] | undefined][]).map(([label, items]) => (
                      <div key={label}>
                        <div className="font-semibold text-foreground mb-1">{label}</div>
                        <ul className="list-disc pr-5 space-y-1">{(items || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                ) : null;
              })()}

              {(smart.send_timing?.summary || smart.send_timing?.frequency || !!smart.send_timing?.avoid?.length || !!smart.send_timing?.seasonal_windows?.length) && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2"><CardTitle className="text-base">أوقات الإرسال المثالية</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2 text-muted-foreground">
                    {smart.send_timing?.summary && <p className="whitespace-pre-wrap">{smart.send_timing.summary}</p>}
                    {smart.send_timing?.frequency && <p><span className="font-semibold text-foreground">سقف التكرار: </span>{smart.send_timing.frequency}</p>}
                    {!!smart.send_timing?.avoid?.length && (
                      <div>
                        <div className="font-semibold text-foreground">أوقات يُفضّل تجنبها</div>
                        <ul className="list-disc pr-5 space-y-1">{smart.send_timing.avoid.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {!!smart.send_timing?.seasonal_windows?.length && (
                      <div>
                        <div className="font-semibold text-foreground">النوافذ الموسمية</div>
                        <ul className="list-disc pr-5 space-y-1">{smart.send_timing.seasonal_windows.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <SectionTable
                title="أفضل ساعات الإرسال"
                head={["النافذة", "المبرر", "القنوات"]}
                rows={(smart.send_timing?.best_hours || []).map(h => [h.window || "—", h.why || "—", h.channels || "—"])}
              />

              <SectionTable
                title="أفضل أيام الإرسال"
                head={["اليوم", "المبرر", "ملاحظة"]}
                rows={(smart.send_timing?.best_days || []).map(d => [d.day || "—", d.why || "—", d.note || "—"])}
              />

              <SectionTable
                title="تكرار التواصل حسب الشريحة"
                head={["الشريحة", "القناة", "اليوم", "الساعة", "التكرار"]}
                rows={(smart.send_timing?.cadence_by_segment || []).map(c => [c.segment || "—", c.channel || "—", c.best_day || "—", c.best_time || "—", c.frequency || "—"])}
              />

              {smart.messaging_plan?.objective && (
                <Card className="border-primary/30">
                  <CardHeader className="pb-2"><CardTitle className="text-base">هدف خطة الرسائل</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{smart.messaging_plan.objective}</CardContent>
                </Card>
              )}

              <SectionTable
                title="الخطة التنفيذية لرسائل المتبرعين"
                head={["الموجة", "الشريحة", "القناة", "اليوم", "الساعة", "الحجم", "نص الرسالة", "نسخة بديلة", "المتابعة", "الدعوة للإجراء", "المؤشر", "النتيجة المتوقعة", "المسؤول"]}
                rows={(smart.messaging_plan?.waves || []).map(w => [w.wave || "—", w.segment || "—", w.channel || "—", w.send_day || w.timing || "—", w.send_time || "—", w.audience_size || "—", w.message_ar || "—", w.variant_b || "—", w.follow_up || "—", w.cta || "—", w.kpi || "—", w.expected_result || "—", w.owner || "—"])}
              />

              <SectionTable
                title="الجدول الأسبوعي للتنفيذ"
                head={["الأسبوع", "المهام"]}
                rows={(smart.messaging_plan?.calendar || []).map(c => [c.week || "—", (c.tasks || []).join(" • ")])}
              />

              <SectionTable
                title="المقترحات التنفيذية"
                head={["المقترح", "المبرر", "خطوات التنفيذ", "الأثر", "الجهد", "الأولوية"]}
                 rows={(smart.recommendations || []).map(r => [arabicDisplay(r.title), arabicDisplay(r.why), arabicDisplay((r.how || []).join(" • ")), arabicDisplay(r.impact), arabicDisplay(r.effort), arabicDisplay(r.priority)])}
              />

              <SectionTable
                title="مستهدفات المؤشرات (90 يوماً)"
                head={["المؤشر", "الحالي", "المستهدف"]}
                rows={(smart.kpi_targets || []).map(k => [k.kpi || "—", k.current || "—", k.target_90d || "—"])}
              />

              <SectionTable
                 title="اختبارات المقارنة بين نسختين"
                head={["الاختبار", "الفرضية", "المؤشر"]}
                 rows={(smart.operational_details?.ab_tests || []).map(t => [arabicDisplay(t.test), arabicDisplay(t.hypothesis), arabicDisplay(t.metric)])}
              />

              {(!!smart.operational_details?.data_hygiene?.length || !!smart.operational_details?.compliance?.length || !!smart.operational_details?.tools?.length) && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">تفاصيل التنفيذ</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
                    {([["تنقية البيانات", smart.operational_details?.data_hygiene], ["الالتزام والخصوصية", smart.operational_details?.compliance], ["الأدوات المطلوبة", smart.operational_details?.tools]] as [string, string[] | undefined][]).map(([label, items]) => (
                      <div key={label}>
                        <div className="font-semibold text-foreground mb-1">{label}</div>
                        <ul className="list-disc pr-5 space-y-1">{(items || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}


              {!!smart.risks?.length && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">المخاطر</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1 list-disc pr-5 text-muted-foreground">{smart.risks.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return null;
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="text-base leading-6">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border md:hidden">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="space-y-3 px-4 py-4 odd:bg-muted/20">
              {row.map((cell, cellIndex) => (
                <div key={cellIndex} className="grid min-w-0 grid-cols-[minmax(6.5rem,38%)_minmax(0,1fr)] items-start gap-3">
                  <div className="text-xs font-semibold leading-6 text-muted-foreground">{head[cellIndex] || "البيان"}</div>
                  <div className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{cell}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <Table className="hidden md:table">
          <TableHeader className="bg-muted">
            <TableRow>{head.map(h => <TableHead key={h} className="whitespace-nowrap text-right">{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => <TableCell key={j} className="min-w-28 max-w-80 whitespace-pre-wrap break-words text-right text-sm leading-6 [overflow-wrap:anywhere]">{c}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
