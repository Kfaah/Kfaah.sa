import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HeartHandshake, Users, Trophy, Repeat, Megaphone, XCircle, ShoppingCart,
  CalendarClock, Search, Filter, Loader2, TrendingUp, Calendar as CalendarIcon, Wallet, Gift,
} from "lucide-react";

type SubKey =
  | "overview" | "donors" | "donations" | "top" | "recurring"
  | "subscriptions" | "campaigns" | "gifts" | "failed" | "abandoned";

const SUB_TABS: { key: SubKey; label: string; Icon: any; desc: string }[] = [
  { key: "overview", label: "لوحة عامة", Icon: HeartHandshake, desc: "ملخّص شامل لأداء التبرعات" },
  { key: "donors", label: "كل المتبرعين", Icon: Users, desc: "قائمة وبحث وتصنيف" },
  { key: "donations", label: "التبرعات", Icon: Wallet, desc: "فلترة بالمشروع والسنة" },
  { key: "top", label: "أعلى المتبرعين", Icon: Trophy, desc: "المتصدّرون بالتبرع" },
  { key: "recurring", label: "متكرّرون", Icon: Repeat, desc: "تبرّعوا مرتين فأكثر" },
  { key: "subscriptions", label: "المستقطعون", Icon: CalendarClock, desc: "اشتراكات شهرية ودورية" },
  { key: "campaigns", label: "الحملات", Icon: Megaphone, desc: "نتائج وأهداف الحملات" },
  { key: "gifts", label: "الإهداءات", Icon: Gift, desc: "المهدون وتكرار الإهداء" },
  { key: "failed", label: "تبرعات فاشلة", Icon: XCircle, desc: "محاولات لم تكتمل" },
  { key: "abandoned", label: "السلال المتروكة", Icon: ShoppingCart, desc: "تنبيهات استرداد" },
];

const SAR = (n: number) => `${(n || 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("ar-SA") : "—";

/* ---------- Arabic label maps ---------- */
const STATUS_AR: Record<string, string> = {
  active: "نشِطة", inactive: "متوقفة", paused: "متوقفة مؤقتاً",
  open: "مفتوحة", closed: "مغلقة", completed: "مكتملة",
  pending: "قيد الانتظار", cancelled: "ملغاة", canceled: "ملغاة",
  expired: "منتهية", draft: "مسودة", success: "ناجحة", failed: "فاشلة",
  scheduled: "مجدولة", running: "جارية", planned: "مخطّطة",
  upcoming: "قادمة", executed: "منفّذة", archived: "مؤرشفة",
  ongoing: "جارية", finished: "منتهية", live: "مباشرة",
};
const METHOD_AR: Record<string, string> = {
  mada: "مدى", visa: "فيزا", mastercard: "ماستركارد", amex: "أميكس",
  applepay: "أبل باي", apple_pay: "أبل باي", "apple-pay": "أبل باي",
  stcpay: "STC Pay", stc_pay: "STC Pay", "stc-pay": "STC Pay",
  transfer: "تحويل بنكي", bank_transfer: "تحويل بنكي", "bank-transfer": "تحويل بنكي",
  cash: "نقدي", sadad: "سداد", paypal: "باي بال", wallet: "محفظة",
  card: "بطاقة", credit_card: "بطاقة ائتمان",
};
const FOLLOWUP_AR: Record<string, string> = {
  pending: "قيد المتابعة", contacted: "تم التواصل", recovered: "مُسترد",
  failed: "فشلت المتابعة", ignored: "متجاهَل", scheduled: "مجدولة",
};
const RETRY_AR: Record<string, string> = {
  pending: "بانتظار الإعادة", retrying: "جاري الإعادة", succeeded: "نجحت",
  failed: "فشلت", abandoned: "تم التخلي", scheduled: "مجدولة",
};
const SEGMENT_AR: Record<string, string> = {
  new: "جديد", regular: "منتظم", vip: "VIP", lapsed: "منقطع",
  recurring: "متكرر", "one-time": "لمرة واحدة", one_time: "لمرة واحدة",
  major: "متبرع كبير", small: "متبرع صغير",
};
const ar = (map: Record<string, string>, v: string | null | undefined) =>
  v ? (map[v.toLowerCase()] || v) : "—";

interface Donation {
  id: string; donor_id: string | null; donor_name: string | null; donor_phone: string | null;
  project_name: string | null; amount: number; payment_method: string | null;
  status: string; donation_date: string; campaign_name?: string | null;
}
interface DonorRow {
  id: string; full_name: string; phone: string | null; email: string | null;
  city: string | null; segment: string; total_donated: number; donations_count: number;
  first_donation_at: string | null; last_donation_at: string | null;
}

/* ---------- Date + Project filter helpers ---------- */
type Range = { from: Date | null; to: Date | null };
type DateValue = { key: string; custom?: Range };
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

const DATE_PRESETS: { key: string; label: string }[] = [
  { key: "all", label: "كل الفترات" },
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "الأمس" },
  { key: "this_week", label: "هذا الأسبوع" },
  { key: "last_week", label: "الأسبوع الماضي" },
  { key: "this_month", label: "هذا الشهر" },
  { key: "last_month", label: "الشهر الماضي" },
  { key: "this_year", label: "هذه السنة" },
  { key: "last_year", label: "السنة الماضية" },
  { key: "last_3_months", label: "آخر 3 أشهر" },
  { key: "last_6_months", label: "آخر 6 أشهر" },
  { key: "last_12_months", label: "آخر 12 شهراً" },
  { key: "last_24_months", label: "آخر 24 شهراً" },
  { key: "custom", label: "فترة مخصصة" },
];

function buildDateRange(value: DateValue | string): Range {
  const key = typeof value === "string" ? value : value.key;
  const custom = typeof value === "string" ? undefined : value.custom;
  const now = new Date();
  const today = startOfDay(now);
  const dow = now.getDay();
  switch (key) {
    case "today": return { from: today, to: endOfDay(now) };
    case "yesterday": { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: y, to: endOfDay(y) }; }
    case "this_week": { const f = new Date(today); f.setDate(f.getDate() - dow); return { from: f, to: endOfDay(now) }; }
    case "last_week": { const f = new Date(today); f.setDate(f.getDate() - dow - 7); const t = new Date(f); t.setDate(t.getDate() + 6); return { from: f, to: endOfDay(t) }; }
    case "this_month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "last_month": { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const t = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)); return { from: f, to: t }; }
    case "this_year": return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "last_year": { const f = new Date(now.getFullYear() - 1, 0, 1); const t = endOfDay(new Date(now.getFullYear() - 1, 11, 31)); return { from: f, to: t }; }
    case "last_3_months": { const f = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); return { from: startOfDay(f), to: endOfDay(now) }; }
    case "last_6_months": { const f = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()); return { from: startOfDay(f), to: endOfDay(now) }; }
    case "last_12_months": { const f = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); return { from: startOfDay(f), to: endOfDay(now) }; }
    case "last_24_months": { const f = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()); return { from: startOfDay(f), to: endOfDay(now) }; }
    case "custom": return custom ? { from: custom.from ? startOfDay(custom.from) : null, to: custom.to ? endOfDay(custom.to) : null } : { from: null, to: null };
    default: return { from: null, to: null };
  }
}
function inRange(d: string | null | undefined, r: Range) {
  if (!r.from && !r.to) return true;
  if (!d) return false;
  const t = new Date(d).getTime();
  if (r.from && t < r.from.getTime()) return false;
  if (r.to && t > r.to.getTime()) return false;
  return true;
}
function DateSelect({ value, onChange }: { value: DateValue; onChange: (v: DateValue) => void }) {
  const [openCustom, setOpenCustom] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(value.custom?.from || undefined);
  const [tempTo, setTempTo] = useState<Date | undefined>(value.custom?.to || undefined);
  const customLabel = value.key === "custom" && value.custom?.from && value.custom?.to
    ? `${value.custom.from.toLocaleDateString("ar-SA")} – ${value.custom.to.toLocaleDateString("ar-SA")}`
    : null;
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={value.key}
        onValueChange={(v) => {
          if (v === "custom") {
            // defer so the Select dropdown can close before popover opens
            setTimeout(() => setOpenCustom(true), 60);
            return;
          }
          onChange({ key: v });
        }}
      >
        <SelectTrigger className="w-40 h-9"><SelectValue placeholder="الفترة" /></SelectTrigger>
        <SelectContent>
          {DATE_PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Popover open={openCustom} onOpenChange={setOpenCustom}>
        <PopoverTrigger asChild>
          <span aria-hidden className="sr-only" />
        </PopoverTrigger>
        {customLabel && (
          <Badge
            variant="outline"
            className="h-9 px-3 text-xs font-semibold bg-accent/10 text-accent border-accent/40 cursor-pointer flex items-center"
            onClick={() => setOpenCustom(true)}
          >
            {customLabel}
          </Badge>
        )}
        <PopoverContent className="w-auto p-3 bg-popover" align="end">
          <div className="flex gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">من</div>
              <Calendar mode="single" selected={tempFrom} onSelect={setTempFrom} className={cn("p-0 pointer-events-auto")} />
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">إلى</div>
              <Calendar mode="single" selected={tempTo} onSelect={setTempTo} className={cn("p-0 pointer-events-auto")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={() => setOpenCustom(false)}>إلغاء</Button>
            <Button
              size="sm"
              disabled={!tempFrom || !tempTo}
              onClick={() => {
                if (tempFrom && tempTo) {
                  onChange({ key: "custom", custom: { from: tempFrom, to: tempTo } });
                  setOpenCustom(false);
                }
              }}
            >تطبيق</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
function ProjectSelect({ value, onChange, projects }: { value: string; onChange: (v: string) => void; projects: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52 h-9"><SelectValue placeholder="المشروع" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">كل المشاريع</SelectItem>
        {projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function DonorsHub({ orgId }: { orgId: string }) {
  const [active, setActive] = useState<SubKey>("overview");
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [loading, setLoading] = useState(true);
  const [donors, setDonors] = useState<DonorRow[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);
  const [abandoned, setAbandoned] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [dn, dr, cm, fl, ab, sb] = await Promise.all([
        supabase.from("donations")
          .select("id,donor_id,donor_name,donor_phone,project_name,amount,payment_method,status,donation_date")
          .eq("organization_id", orgId).order("donation_date", { ascending: false }).limit(20000),
        supabase.from("donors")
          .select("id,full_name,phone,email,city,segment,total_donated,donations_count,first_donation_at,last_donation_at")
          .eq("organization_id", orgId).order("total_donated", { ascending: false }).limit(20000),
        supabase.from("campaigns").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(2000),
        supabase.from("failed_donations").select("*").eq("organization_id", orgId).order("attempted_at", { ascending: false }).limit(5000),
        supabase.from("abandoned_carts").select("*").eq("organization_id", orgId).order("abandoned_at", { ascending: false }).limit(5000),
        supabase.from("subscriptions").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(5000),
      ]);
      if (cancelled) return;
      setDonations((dn.data || []) as any);
      setDonors((dr.data || []) as any);
      setCampaigns(cm.data || []);
      setFailed(fl.data || []);
      setAbandoned(ab.data || []);
      setSubs(sb.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // Project list pulled from all sources to be exhaustive
  const projects = useMemo(() => {
    const set = new Set<string>();
    donations.forEach((d) => d.project_name && set.add(d.project_name));
    campaigns.forEach((c: any) => c.project_name && set.add(c.project_name));
    failed.forEach((r: any) => r.project_name && set.add(r.project_name));
    abandoned.forEach((r: any) => r.project_name && set.add(r.project_name));
    subs.forEach((r: any) => r.project_name && set.add(r.project_name));
    return Array.from(set).sort();
  }, [donations, campaigns, failed, abandoned, subs]);

  const totals = useMemo(() => {
    const total = donations.reduce((s, r) => s + Number(r.amount || 0), 0);
    const recurring = donors.filter(d => d.donations_count >= 2).length;
    const projectsCount = new Set(donations.map(d => d.project_name).filter(Boolean)).size;
    return { total, recurring, projects: projectsCount };
  }, [donations, donors]);

  return (
    <div className="space-y-5" dir="rtl" style={{ ["--brand" as any]: brand }}>
      {/* Hero header */}
      <div
        className="relative overflow-hidden rounded-2xl border p-6 shadow-sm"
        style={{
          borderColor: `${brand}33`,
          background: `linear-gradient(to left, ${brand}14, #ffffff 55%, ${brand}0d)`,
        }}
      >
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: `${brand}33` }} />
        <div className="absolute bottom-0 right-1/3 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: `${brand}1a` }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ring-2"
              style={{
                background: `linear-gradient(135deg, ${brand}, ${brand}cc)`,
                boxShadow: `0 10px 30px -10px ${brand}80`,
                ['--tw-ring-color' as any]: `${brand}66`,
              }}
            >
              <HeartHandshake className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900">مركز المتبرعين</h2>
              <p className="text-base text-slate-600">قاعدة بيانات شاملة · فلترة ذكية · رؤية متكاملة لكل دورة العطاء</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <KpiPill brand={brand} icon={<Users className="w-4 h-4" />} label="متبرعون" value={donors.length.toLocaleString("ar-SA")} />
            <KpiPill brand={brand} icon={<TrendingUp className="w-4 h-4" />} label="إجمالي" value={SAR(totals.total)} />
            <KpiPill brand={brand} icon={<Repeat className="w-4 h-4" />} label="متكرّرون" value={totals.recurring.toLocaleString("ar-SA")} />
            <KpiPill brand={brand} icon={<CalendarIcon className="w-4 h-4" />} label="مشاريع" value={totals.projects.toLocaleString("ar-SA")} />
          </div>
        </div>
      </div>

      {/* Sub-icons */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {SUB_TABS.map((t, idx) => {
          const Icon = t.Icon;
          const isActive = active === t.key;
          const palettes = [
            { from: brand, to: `${brand}cc`, ring: `${brand}55`, soft: `${brand}18`, text: brand },
            { from: "#10b981", to: "#059669", ring: "#10b98155", soft: "#10b98118", text: "#047857" },
          ];
          const p = palettes[idx % 2];
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-300 bg-white",
                isActive
                  ? "shadow-lg ring-2 -translate-y-0.5"
                  : "border-slate-200 hover:shadow-md hover:-translate-y-0.5"
              )}
              style={isActive ? { borderColor: p.from, ['--tw-ring-color' as any]: p.ring } : undefined}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ring-1 transition-transform group-hover:scale-110",
                  isActive && "scale-110"
                )}
                style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})`, ['--tw-ring-color' as any]: p.ring }}
              >
                <Icon className="w-5 h-5" style={{ color: "#fff" }} strokeWidth={2.4} />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold leading-tight" style={isActive ? { color: p.text } : undefined}>
                  {t.label}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight mt-1 hidden lg:block">{t.desc}</div>
              </div>
              {isActive && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rotate-45" style={{ background: p.from, boxShadow: `0 0 6px ${p.from}b3` }} />}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> جاري تحميل بيانات المتبرعين…
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          {active === "overview" && <OverviewPanel donations={donations} donors={donors} campaigns={campaigns} failed={failed} abandoned={abandoned} subs={subs} />}
          {active === "donors" && <DonorsPanel donors={donors} donations={donations} projects={projects} />}
          {active === "donations" && <DonationsPanel donations={donations} projects={projects} />}
          {active === "top" && <TopDonorsPanel donors={donors} donations={donations} projects={projects} />}
          {active === "recurring" && <RecurringPanel donors={donors} donations={donations} projects={projects} />}
          {active === "campaigns" && <CampaignsPanel campaigns={campaigns} projects={projects} />}
          {active === "failed" && <FailedPanel rows={failed} projects={projects} />}
          {active === "abandoned" && <AbandonedPanel rows={abandoned} projects={projects} />}
          {active === "subscriptions" && <SubscriptionsPanel rows={subs} donations={donations} projects={projects} />}
        </div>
      )}
    </div>
  );
}

function KpiPill({ icon, label, value, brand }: { icon: React.ReactNode; label: string; value: string; brand: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-white/80 backdrop-blur px-4 py-2.5 shadow-sm" style={{ borderColor: `${brand}55` }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>{icon}</div>
      <div className="leading-tight">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-base font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

/* ---------- Panels ---------- */

function OverviewPanel({ donations, donors, campaigns, failed, abandoned, subs }: any) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const byYear = useMemo(() => {
    const map = new Map<number, number>();
    donations.forEach((d: Donation) => {
      const y = new Date(d.donation_date).getFullYear();
      map.set(y, (map.get(y) || 0) + Number(d.amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [donations]);
  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    donations.forEach((d: Donation) => {
      const k = d.project_name || "غير محدد";
      map.set(k, (map.get(k) || 0) + Number(d.amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [donations]);
  const max = Math.max(1, ...byProject.map((p) => p[1]));
  const yearMax = Math.max(1, ...byYear.map((y) => y[1]));

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card style={{ borderColor: `${brand}33` }}>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><CalendarIcon className="w-5 h-5" style={{ color: brand }} />التبرعات حسب السنة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {byYear.length === 0 && <p className="text-sm text-slate-500">لا توجد بيانات.</p>}
          {byYear.map(([y, v]) => (
            <div key={y} className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="font-semibold">{y}</span><span className="font-bold text-base" style={{ color: brand }}>{SAR(v)}</span></div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${(v / yearMax) * 100}%`, background: `linear-gradient(to left, ${brand}, ${brand}99)` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card style={{ borderColor: `${brand}33` }}>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><Megaphone className="w-5 h-5" style={{ color: brand }} />أعلى 8 مشاريع تبرّعاً</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {byProject.length === 0 && <p className="text-sm text-slate-500">لا توجد بيانات.</p>}
          {byProject.map(([k, v]) => (
            <div key={k} className="space-y-1.5">
              <div className="flex justify-between text-sm"><span className="font-semibold truncate">{k}</span><span className="font-bold text-base" style={{ color: brand }}>{SAR(v)}</span></div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${(v / max) * 100}%`, background: `linear-gradient(to left, ${brand}, ${brand}99)` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:col-span-2">
        <MiniStat label="حملات" desc="حملات تبرع نشطة وسابقة" value={campaigns.length} icon={Megaphone} gradient="from-emerald-500 to-teal-500" />
        <MiniStat label="تبرعات فاشلة" desc="محاولات لم تكتمل" value={failed.length} icon={XCircle} gradient="from-rose-500 to-pink-500" />
        <MiniStat label="سلال متروكة" desc="فرص استرداد محتملة" value={abandoned.length} icon={ShoppingCart} gradient="from-amber-500 to-orange-500" />
        <MiniStat label="اشتراكات" desc="استقطاعات شهرية ودورية" value={subs.length} icon={CalendarClock} gradient="from-violet-500 to-fuchsia-500" />
      </div>
    </div>
  );
}

function MiniStat({
  label, desc, value, icon: Icon, gradient,
}: {
  label: string; desc: string; value: number;
  icon: React.ComponentType<{ className?: string }>; gradient: string;
}) {
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-border bg-card p-5",
      "hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
      "flex flex-col items-start gap-3 min-h-[160px]"
    )}>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg", gradient)}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-extrabold text-foreground leading-none">{value.toLocaleString("ar-SA")}</div>
        <h3 className="font-bold text-sm text-foreground leading-tight mt-1">{label}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
      </div>
    </div>
  );
}

function DonorsPanel({ donors, donations, projects }: { donors: DonorRow[]; donations: Donation[]; projects: string[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<string>("all");
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);
  const segments = useMemo(() => Array.from(new Set(donors.map((d) => d.segment))), [donors]);

  const allowedDonorIds = useMemo(() => {
    if (dateKey.key === "all" && project === "all") return null;
    const set = new Set<string>();
    donations.forEach((d) => {
      if (project !== "all" && d.project_name !== project) return;
      if (!inRange(d.donation_date, range)) return;
      if (d.donor_id) set.add(d.donor_id);
    });
    return set;
  }, [donations, dateKey, project, range]);

  const filtered = useMemo(() => {
    return donors.filter((d) => {
      if (seg !== "all" && d.segment !== seg) return false;
      if (allowedDonorIds && !allowedDonorIds.has(d.id)) return false;
      if (q && !`${d.full_name} ${d.phone || ""} ${d.email || ""} ${d.city || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [donors, q, seg, allowedDonorIds]);

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم، الجوال، المدينة…" />
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={seg} onValueChange={setSeg}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الشرائح</SelectItem>
            {segments.map((s) => <SelectItem key={s} value={s}>{ar(SEGMENT_AR, s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={donors.length} />
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "المدينة", "الشريحة", "عدد التبرعات", "إجمالي التبرع", "آخر تبرع"]}
        rows={filtered.slice(0, 500).map((d, i) => [
          String(i + 1), d.full_name, d.phone || "—", d.city || "—",
          <Badge variant="outline" style={{ borderColor: `${brand}55`, color: brand, background: `${brand}10` }}>{ar(SEGMENT_AR, d.segment)}</Badge>,
          d.donations_count, SAR(Number(d.total_donated)), fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function DonationsPanel({ donations, projects }: { donations: Donation[]; projects: string[] }) {
  const [q, setQ] = useState("");
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);

  const methods = useMemo(() => Array.from(new Set(donations.map((d) => d.payment_method).filter(Boolean) as string[])).sort(), [donations]);

  const filtered = useMemo(() => {
    return donations.filter((d) => {
      if (!inRange(d.donation_date, range)) return false;
      if (project !== "all" && d.project_name !== project) return false;
      if (method !== "all" && d.payment_method !== method) return false;
      if (q && !`${d.donor_name || ""} ${d.donor_phone || ""} ${d.project_name || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [donations, q, range, project, method]);

  const sum = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث بالمتبرع أو المشروع…" />
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="وسيلة الدفع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوسائل</SelectItem>
            {methods.map((m) => <SelectItem key={m} value={m}>{ar(METHOD_AR, m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={donations.length} extra={SAR(sum)} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "الوسيلة", "المبلغ", "الحالة"]}
        rows={filtered.slice(0, 1000).map((d, i) => [
          String(i + 1), fmtDate(d.donation_date), d.donor_name || "—", d.donor_phone || "—",
          d.project_name || "—", ar(METHOD_AR, d.payment_method),
          <span className="font-bold text-emerald-700">{SAR(Number(d.amount))}</span>,
          <Badge variant="outline" className={cn(
            d.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"
          )}>{ar(STATUS_AR, d.status)}</Badge>,
        ])}
      />
    </div>
  );
}

function TopDonorsPanel({ donors, donations, projects }: { donors: DonorRow[]; donations: Donation[]; projects: string[] }) {
  const [limit, setLimit] = useState<string>("50");
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);

  const aggregates = useMemo(() => {
    if (dateKey.key === "all" && project === "all") {
      return donors.map((d) => ({ ...d, _total: Number(d.total_donated || 0), _count: d.donations_count }));
    }
    const map = new Map<string, { total: number; count: number }>();
    donations.forEach((d) => {
      if (!d.donor_id) return;
      if (project !== "all" && d.project_name !== project) return;
      if (!inRange(d.donation_date, range)) return;
      const cur = map.get(d.donor_id) || { total: 0, count: 0 };
      cur.total += Number(d.amount || 0); cur.count += 1;
      map.set(d.donor_id, cur);
    });
    return donors.filter((d) => map.has(d.id)).map((d) => {
      const a = map.get(d.id)!;
      return { ...d, _total: a.total, _count: a.count };
    });
  }, [donors, donations, dateKey, project, range]);

  const top = useMemo(() => [...aggregates].sort((a, b) => b._total - a._total).slice(0, Number(limit)), [aggregates, limit]);

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["10", "25", "50", "100", "500"].map((n) => <SelectItem key={n} value={n}>أعلى {n}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={top.length} total={aggregates.length} />
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "المدينة", "عدد التبرعات", "إجمالي التبرع", "أول تبرع", "آخر تبرع"]}
        rows={top.map((d: any, i) => [
          <span className={cn("font-bold", i < 3 ? "text-amber-600" : "text-slate-700")}>{i + 1}</span>,
          d.full_name, d.phone || "—", d.city || "—",
          d._count,
          <span className="font-bold text-amber-700">{SAR(Number(d._total))}</span>,
          fmtDate(d.first_donation_at), fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function RecurringPanel({ donors, donations, projects }: { donors: DonorRow[]; donations: Donation[]; projects: string[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [min, setMin] = useState<string>("2");
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);

  const aggregates = useMemo(() => {
    if (dateKey.key === "all" && project === "all") {
      return donors.map((d) => ({ ...d, _total: Number(d.total_donated || 0), _count: d.donations_count }));
    }
    const map = new Map<string, { total: number; count: number }>();
    donations.forEach((d) => {
      if (!d.donor_id) return;
      if (project !== "all" && d.project_name !== project) return;
      if (!inRange(d.donation_date, range)) return;
      const cur = map.get(d.donor_id) || { total: 0, count: 0 };
      cur.total += Number(d.amount || 0); cur.count += 1;
      map.set(d.donor_id, cur);
    });
    return donors.filter((d) => map.has(d.id)).map((d) => {
      const a = map.get(d.id)!;
      return { ...d, _total: a.total, _count: a.count };
    });
  }, [donors, donations, dateKey, project, range]);

  const list = useMemo(() => aggregates.filter((d: any) => d._count >= Number(min)).sort((a: any, b: any) => b._count - a._count), [aggregates, min]);

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={min} onValueChange={setMin}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 5, 10, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}+ تبرعات</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={list.length} total={aggregates.length} />
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "عدد التبرعات", "إجمالي", "آخر تبرع"]}
        rows={list.slice(0, 1000).map((d: any, i) => [
          String(i + 1), d.full_name, d.phone || "—",
          <Badge style={{ background: `${brand}1f`, color: brand, borderColor: `${brand}55` }}>{d._count}</Badge>,
          <span className="font-bold" style={{ color: brand }}>{SAR(Number(d._total))}</span>,
          fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function CampaignsPanel({ campaigns, projects }: { campaigns: any[]; projects: string[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);

  const statuses = useMemo(() => Array.from(new Set(campaigns.map((c) => c.status).filter(Boolean))) as string[], [campaigns]);

  const filtered = useMemo(() => campaigns.filter((c) => {
    const ref = c.start_date || c.created_at;
    if (!inRange(ref, range)) return false;
    if (project !== "all" && c.project_name !== project) return false;
    if (status !== "all" && c.status !== status) return false;
    return true;
  }), [campaigns, range, project, status]);

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{ar(STATUS_AR, s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={campaigns.length} />
      </Toolbar>
      <DataTable
        head={["#", "اسم الحملة", "المشروع", "الهدف", "المُحصّل", "نسبة الإنجاز", "عدد التبرعات", "البداية", "النهاية", "الحالة"]}
        rows={filtered.map((c, i) => {
          const goal = Number(c.goal_amount || 0);
          const got = Number(c.collected_amount || 0);
          const pct = goal > 0 ? Math.round((got / goal) * 100) : 0;
          return [
            String(i + 1), c.name, c.project_name || "—", goal ? SAR(goal) : "—",
            <span className="font-bold" style={{ color: brand }}>{SAR(got)}</span>,
            <div className="flex items-center gap-2 min-w-[110px]">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(to left, ${brand}, ${brand}99)` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-9 text-left">{pct}%</span>
            </div>,
            c.donations_count || 0, fmtDate(c.start_date), fmtDate(c.end_date),
            <Badge
              variant="outline"
              style={c.status === "active"
                ? { background: `${brand}10`, color: brand, borderColor: `${brand}55` }
                : { background: "rgb(248 250 252)", color: "rgb(51 65 85)", borderColor: "rgb(226 232 240)" }}
            >{ar(STATUS_AR, c.status)}</Badge>,
          ];
        })}
      />
    </div>
  );
}

function FailedPanel({ rows, projects }: { rows: any[]; projects: string[] }) {
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);
  const filtered = useMemo(() => rows.filter((r) => {
    if (!inRange(r.attempted_at, range)) return false;
    if (project !== "all" && r.project_name !== project) return false;
    return true;
  }), [rows, range, project]);
  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <CountChip n={filtered.length} total={rows.length} extra={`فُقد محتمل: ${SAR(total)}`} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "الوسيلة", "المبلغ", "السبب", "حالة الإعادة"]}
        rows={filtered.slice(0, 1000).map((r, i) => [
          String(i + 1), fmtDate(r.attempted_at), r.donor_name || "—", r.donor_phone || "—",
          r.project_name || "—", ar(METHOD_AR, r.payment_method),
          <span className="font-bold text-rose-700">{SAR(Number(r.amount))}</span>,
          <span className="text-xs text-slate-600">{r.failure_reason || "—"}</span>,
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{ar(RETRY_AR, r.retry_status)}</Badge>,
        ])}
      />
    </div>
  );
}

function AbandonedPanel({ rows, projects }: { rows: any[]; projects: string[] }) {
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);
  const filtered = useMemo(() => rows.filter((r) => {
    if (!inRange(r.abandoned_at, range)) return false;
    if (project !== "all" && r.project_name !== project) return false;
    return true;
  }), [rows, range, project]);
  const recovered = filtered.filter((r) => r.recovered).length;
  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <CountChip n={filtered.length} total={rows.length} extra={`مُسترد: ${recovered} · قيمة: ${SAR(total)}`} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "المبلغ", "حالة المتابعة", "مُسترد"]}
        rows={filtered.slice(0, 1000).map((r, i) => [
          String(i + 1), fmtDate(r.abandoned_at), r.donor_name || "—", r.donor_phone || "—",
          r.project_name || "—",
          <span className="font-bold text-amber-700">{SAR(Number(r.amount))}</span>,
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{ar(FOLLOWUP_AR, r.follow_up_status)}</Badge>,
          r.recovered
            ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">نعم</Badge>
            : <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">لا</Badge>,
        ])}
      />
    </div>
  );
}

function SubscriptionsPanel({ rows, donations, projects }: { rows: any[]; donations: any[]; projects: string[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [dateKey, setDateKey] = useState<DateValue>({ key: "all" });
  const [project, setProject] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [behavior, setBehavior] = useState<string>("all");
  const range = useMemo(() => buildDateRange(dateKey), [dateKey]);
  // Derive months window from the date filter (default 12)
  const months = useMemo(() => {
    switch (dateKey.key) {
      case "last_3_months": return 3;
      case "last_6_months": return 6;
      case "last_12_months": case "this_year": case "last_year": return 12;
      case "last_24_months": return 24;
      case "this_month": case "last_month": return 6;
      default: return 12;
    }
  }, [dateKey]);

  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status).filter(Boolean))) as string[], [rows]);

  // Build month buckets (oldest -> newest), each is YYYY-MM
  const monthKeys = useMemo(() => {
    const out: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return out;
  }, [months]);

  // Index donations by donor key + month
  const normPhone = (p?: string | null) => (p || "").replace(/\D+/g, "").replace(/^966/, "").replace(/^0/, "");
  const donationIndex = useMemo(() => {
    const idx = new Map<string, Map<string, number>>(); // key -> mkey -> sum
    for (const d of donations) {
      const dt = d.donation_date ? new Date(d.donation_date) : null;
      if (!dt) continue;
      const mkey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const keys = [
        d.donor_id ? `id:${d.donor_id}` : null,
        d.donor_phone ? `ph:${normPhone(d.donor_phone)}` : null,
      ].filter(Boolean) as string[];
      for (const k of keys) {
        if (!idx.has(k)) idx.set(k, new Map());
        const inner = idx.get(k)!;
        // optional project match: store per project in compound key too
        const pkey = d.project_name ? `${mkey}::${d.project_name}` : mkey;
        inner.set(mkey, (inner.get(mkey) || 0) + Number(d.amount || 0));
        inner.set(pkey, (inner.get(pkey) || 0) + Number(d.amount || 0));
      }
    }
    return idx;
  }, [donations]);

  // Per-subscription monthly grid + behavior classification
  const enriched = useMemo(() => {
    return rows.map((r) => {
      const startDate = r.start_date ? new Date(r.start_date) : null;
      const lookupKeys = [
        r.donor_id ? `id:${r.donor_id}` : null,
        r.donor_phone ? `ph:${normPhone(r.donor_phone)}` : null,
      ].filter(Boolean) as string[];
      const cells = monthKeys.map((m) => {
        // skip months before subscription start
        if (startDate) {
          const mEnd = new Date(m.year, m.month + 1, 0);
          if (mEnd < startDate) return { ...m, state: "na" as const, amount: 0 };
        }
        let amt = 0;
        for (const k of lookupKeys) {
          const inner = donationIndex.get(k);
          if (!inner) continue;
          const pkey = r.project_name ? `${m.key}::${r.project_name}` : m.key;
          amt = Math.max(amt, inner.get(pkey) || inner.get(m.key) || 0);
        }
        return { ...m, state: amt > 0 ? "paid" as const : "miss" as const, amount: amt };
      });
      const evalCells = cells.filter((c) => c.state !== "na");
      const paid = evalCells.filter((c) => c.state === "paid").length;
      const total = evalCells.length || 1;
      const ratio = paid / total;
      // recent miss streak (last 3)
      const recent = evalCells.slice(-3);
      const recentMiss = recent.length > 0 && recent.every((c) => c.state === "miss");
      let behaviorKey: "regular" | "lapsed" | "irregular" | "new" = "regular";
      if (evalCells.length <= 1) behaviorKey = "new";
      else if (paid === 0 || recentMiss) behaviorKey = "lapsed";
      else if (ratio >= 0.85) behaviorKey = "regular";
      else behaviorKey = "irregular";
      return { ...r, _cells: cells, _paid: paid, _total: evalCells.length, _ratio: ratio, _behavior: behaviorKey };
    });
  }, [rows, monthKeys, donationIndex]);

  const filtered = useMemo(() => enriched.filter((r) => {
    if (!inRange(r.start_date || r.created_at, range)) return false;
    if (project !== "all" && r.project_name !== project) return false;
    if (status !== "all" && r.status !== status) return false;
    if (behavior !== "all" && r._behavior !== behavior) return false;
    return true;
  }), [enriched, range, project, status, behavior]);

  const counts = useMemo(() => ({
    regular: enriched.filter((r) => r._behavior === "regular").length,
    lapsed: enriched.filter((r) => r._behavior === "lapsed").length,
    irregular: enriched.filter((r) => r._behavior === "irregular").length,
    new: enriched.filter((r) => r._behavior === "new").length,
  }), [enriched]);

  const monthlyExpected = filtered.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.amount || 0), 0);

  const BEHAVIOR_AR: Record<string, string> = {
    regular: "منتظم", lapsed: "منقطع", irregular: "متذبذب", new: "جديد",
  };
  const behaviorStyle = (b: string): React.CSSProperties => {
    if (b === "regular") return { background: `${brand}15`, color: brand, borderColor: `${brand}66` };
    if (b === "lapsed") return { background: "rgb(254 226 226)", color: "rgb(153 27 27)", borderColor: "rgb(252 165 165)" };
    if (b === "irregular") return { background: "rgb(254 243 199)", color: "rgb(146 64 14)", borderColor: "rgb(252 211 77)" };
    return { background: "rgb(219 234 254)", color: "rgb(30 64 175)", borderColor: "rgb(147 197 253)" };
  };

  return (
    <div className="space-y-3">
      <Toolbar>
        <DateSelect value={dateKey} onChange={setDateKey} />
        <ProjectSelect value={project} onChange={setProject} projects={projects} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{ar(STATUS_AR, s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={behavior} onValueChange={setBehavior}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="السلوك" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل السلوكيات</SelectItem>
            <SelectItem value="regular">منتظم ({counts.regular})</SelectItem>
            <SelectItem value="lapsed">منقطع ({counts.lapsed})</SelectItem>
            <SelectItem value="irregular">متذبذب ({counts.irregular})</SelectItem>
            <SelectItem value="new">جديد ({counts.new})</SelectItem>
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={rows.length} extra={`نشِط: ${counts.regular} · منقطع: ${counts.lapsed} · شهري متوقّع: ${SAR(monthlyExpected)}`} />
      </Toolbar>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 px-1">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: `${brand}` }} /> دفع</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-500" /> فاته</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200" /> قبل البدء</span>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-[12px]">
              <th className="px-3 py-2 text-right font-semibold w-10">#</th>
              <th className="px-3 py-2 text-right font-semibold">المتبرع</th>
              <th className="px-3 py-2 text-right font-semibold">الجوال</th>
              <th className="px-3 py-2 text-right font-semibold">المشروع</th>
              <th className="px-3 py-2 text-right font-semibold">المبلغ</th>
              <th className="px-3 py-2 text-right font-semibold">السلوك</th>
              <th className="px-3 py-2 text-center font-semibold">الانتظام</th>
              <th className="px-2 py-2 text-center font-semibold">سجل الأشهر</th>
              <th className="px-3 py-2 text-right font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 1000).map((r, i) => (
              <tr key={r.id || i} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{r.donor_name || "—"}</td>
                <td className="px-3 py-2 text-slate-600 tabular-nums">{r.donor_phone || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{r.project_name || "—"}</td>
                <td className="px-3 py-2 font-bold" style={{ color: brand }}>{SAR(Number(r.amount))}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" style={behaviorStyle(r._behavior)}>{BEHAVIOR_AR[r._behavior]}</Badge>
                </td>
                <td className="px-3 py-2 text-center text-slate-700 text-xs tabular-nums">
                  {r._total > 0 ? `${r._paid}/${r._total} · ${Math.round(r._ratio * 100)}%` : "—"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center justify-center gap-[3px]" dir="ltr">
                    {r._cells.map((c: any) => (
                      <span
                        key={c.key}
                        title={`${c.label} — ${c.state === "paid" ? "دفع " + SAR(c.amount) : c.state === "miss" ? "فاته" : "قبل البدء"}`}
                        className="w-3.5 h-5 rounded-sm"
                        style={{
                          background:
                            c.state === "paid" ? brand :
                            c.state === "miss" ? "rgb(244 63 94)" :
                            "rgb(226 232 240)",
                          opacity: c.state === "na" ? 0.6 : 1,
                        }}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    style={r.status === "active"
                      ? { background: `${brand}10`, color: brand, borderColor: `${brand}55` }
                      : { background: "rgb(248 250 252)", color: "rgb(51 65 85)", borderColor: "rgb(226 232 240)" }}
                  >{ar(STATUS_AR, r.status)}</Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">لا توجد اشتراكات بهذه المعايير</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
      <Filter className="w-4 h-4 text-slate-500 mr-1" />
      {children}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[220px]">
      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pr-8 bg-white" />
    </div>
  );
}

function CountChip({ n, total, extra }: { n: number; total: number; extra?: string }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-semibold text-sm">
        {n.toLocaleString("ar-SA")} / {total.toLocaleString("ar-SA")}
      </Badge>
      {extra && <Badge style={{ background: `${brand}1f`, color: brand, borderColor: `${brand}55` }}>{extra}</Badge>}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number | React.ReactNode)[][] }) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-500">لا توجد بيانات للعرض.</div>;
  }
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="overflow-auto max-h-[640px]">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
              {head.map((h, i) => <TableHead key={i} className="text-right font-bold text-slate-700 whitespace-nowrap text-sm py-3.5">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className="hover:bg-slate-50">
                {r.map((c, j) => <TableCell key={j} className="text-right whitespace-nowrap text-sm py-3.5">{c as any}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
