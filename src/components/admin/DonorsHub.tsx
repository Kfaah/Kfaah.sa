import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  HeartHandshake, Users, Trophy, Repeat, Megaphone, XCircle, ShoppingCart,
  CalendarClock, Search, Filter, Loader2, TrendingUp, Calendar, Wallet, Phone,
} from "lucide-react";

type SubKey =
  | "overview" | "donors" | "donations" | "top" | "recurring"
  | "campaigns" | "failed" | "abandoned" | "subscriptions";

const SUB_TABS: { key: SubKey; label: string; Icon: any; desc: string }[] = [
  { key: "overview", label: "لوحة عامة", Icon: HeartHandshake, desc: "ملخّص شامل لأداء التبرعات" },
  { key: "donors", label: "كل المتبرعين", Icon: Users, desc: "قائمة وبحث وتصنيف" },
  { key: "donations", label: "التبرعات", Icon: Wallet, desc: "فلترة بالمشروع والسنة" },
  { key: "top", label: "أعلى المتبرعين", Icon: Trophy, desc: "المتصدّرون بالتبرع" },
  { key: "recurring", label: "متكرّرون", Icon: Repeat, desc: "تبرّعوا مرتين فأكثر" },
  { key: "campaigns", label: "الحملات", Icon: Megaphone, desc: "نتائج وأهداف الحملات" },
  { key: "failed", label: "تبرعات فاشلة", Icon: XCircle, desc: "محاولات لم تكتمل" },
  { key: "abandoned", label: "السلال المتروكة", Icon: ShoppingCart, desc: "تنبيهات استرداد" },
  { key: "subscriptions", label: "الاستقطاع المتكرر", Icon: CalendarClock, desc: "اشتراكات شهرية ودورية" },
];

const SAR = (n: number) => `${(n || 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("ar-SA") : "—";

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

export function DonorsHub({ orgId }: { orgId: string }) {
  const [active, setActive] = useState<SubKey>("overview");
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const brandSoft = `${brand}1a`; // ~10% alpha
  const brandSofter = `${brand}0d`;
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

  // KPIs
  const totals = useMemo(() => {
    const total = donations.reduce((s, r) => s + Number(r.amount || 0), 0);
    const recurring = donors.filter(d => d.donations_count >= 2).length;
    const projects = new Set(donations.map(d => d.project_name).filter(Boolean)).size;
    const years = new Set(donations.map(d => new Date(d.donation_date).getFullYear())).size;
    return { total, recurring, projects, years };
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
              <h2 className="text-2xl font-extrabold text-slate-900">مركز المتبرعين</h2>
              <p className="text-sm text-slate-600">قاعدة بيانات شاملة · فلترة ذكية · رؤية متكاملة لكل دورة العطاء</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <KpiPill brand={brand} icon={<Users className="w-4 h-4" />} label="متبرعون" value={donors.length.toLocaleString("ar-SA")} />
            <KpiPill brand={brand} icon={<TrendingUp className="w-4 h-4" />} label="إجمالي" value={SAR(totals.total)} />
            <KpiPill brand={brand} icon={<Repeat className="w-4 h-4" />} label="متكرّرون" value={totals.recurring.toLocaleString("ar-SA")} />
            <KpiPill brand={brand} icon={<Calendar className="w-4 h-4" />} label="مشاريع" value={totals.projects.toLocaleString("ar-SA")} />
          </div>
        </div>
      </div>

      {/* Sub-icons / dropdown branches */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {SUB_TABS.map((t) => {
          const Icon = t.Icon;
          const isActive = active === t.key;
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
              style={isActive ? {
                borderColor: brand,
                ['--tw-ring-color' as any]: `${brand}55`,
              } : undefined}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ring-1 transition-transform group-hover:scale-110",
                  isActive && "scale-110"
                )}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${brand}, ${brand}cc)`
                    : `${brand}15`,
                  ['--tw-ring-color' as any]: `${brand}40`,
                }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: isActive ? "#fff" : brand }}
                  strokeWidth={2.4}
                />
              </div>
              <div className="text-center">
                <div className="text-[12px] font-bold leading-tight" style={isActive ? { color: brand } : undefined}>
                  {t.label}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5 hidden lg:block">{t.desc}</div>
              </div>
              {isActive && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rotate-45" style={{ background: brand, boxShadow: `0 0 6px ${brand}b3` }} />}
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
          {active === "donors" && <DonorsPanel donors={donors} />}
          {active === "donations" && <DonationsPanel donations={donations} />}
          {active === "top" && <TopDonorsPanel donors={donors} />}
          {active === "recurring" && <RecurringPanel donors={donors} />}
          {active === "campaigns" && <CampaignsPanel campaigns={campaigns} />}
          {active === "failed" && <FailedPanel rows={failed} />}
          {active === "abandoned" && <AbandonedPanel rows={abandoned} />}
          {active === "subscriptions" && <SubscriptionsPanel rows={subs} />}
        </div>
      )}
    </div>
  );
}

function KpiPill({ icon, label, value, brand }: { icon: React.ReactNode; label: string; value: string; brand: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-white/80 backdrop-blur px-3 py-2 shadow-sm" style={{ borderColor: `${brand}55` }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}cc)` }}>{icon}</div>
      <div className="leading-tight">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-sm font-bold text-slate-800">{value}</div>
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
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" style={{ color: brand }} />التبرعات حسب السنة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {byYear.length === 0 && <p className="text-sm text-slate-500">لا توجد بيانات.</p>}
          {byYear.map(([y, v]) => (
            <div key={y} className="space-y-1">
              <div className="flex justify-between text-xs"><span className="font-semibold">{y}</span><span className="font-bold" style={{ color: brand }}>{SAR(v)}</span></div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full" style={{ width: `${(v / yearMax) * 100}%`, background: `linear-gradient(to left, ${brand}, ${brand}99)` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card style={{ borderColor: `${brand}33` }}>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" style={{ color: brand }} />أعلى 8 مشاريع تبرّعاً</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {byProject.length === 0 && <p className="text-sm text-slate-500">لا توجد بيانات.</p>}
          {byProject.map(([k, v]) => (
            <div key={k} className="space-y-1">
              <div className="flex justify-between text-xs"><span className="font-semibold truncate">{k}</span><span className="font-bold" style={{ color: brand }}>{SAR(v)}</span></div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
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
  label,
  desc,
  value,
  icon: Icon,
  gradient,
}: {
  label: string;
  desc: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-5",
        "hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
        "flex flex-col items-start gap-3 min-h-[160px]"
      )}
    >
      <div
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center",
          "bg-gradient-to-br shadow-lg",
          gradient
        )}
      >
        <Icon className="w-7 h-7 text-white" />
      </div>
      <div className="space-y-1">
        <div className="text-3xl font-extrabold text-foreground leading-none">
          {value.toLocaleString("ar-SA")}
        </div>
        <h3 className="font-bold text-sm text-foreground leading-tight mt-1">{label}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
      </div>
    </div>
  );
}

function DonorsPanel({ donors }: { donors: DonorRow[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<string>("all");
  const segments = useMemo(() => Array.from(new Set(donors.map((d) => d.segment))), [donors]);
  const filtered = useMemo(() => {
    return donors.filter((d) => {
      if (seg !== "all" && d.segment !== seg) return false;
      if (q && !`${d.full_name} ${d.phone || ""} ${d.email || ""} ${d.city || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [donors, q, seg]);

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث بالاسم، الجوال، المدينة…" />
        <Select value={seg} onValueChange={setSeg}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الشرائح</SelectItem>
            {segments.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={donors.length} />
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "المدينة", "الشريحة", "عدد التبرعات", "إجمالي التبرع", "آخر تبرع"]}
        rows={filtered.slice(0, 500).map((d, i) => [
          String(i + 1), d.full_name, d.phone || "—", d.city || "—",
          <Badge variant="outline" style={{ borderColor: `${brand}55`, color: brand, background: `${brand}10` }}>{d.segment}</Badge>,
          d.donations_count, SAR(Number(d.total_donated)), fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function DonationsPanel({ donations }: { donations: Donation[] }) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<string>("all");
  const [project, setProject] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");

  const years = useMemo(() => Array.from(new Set(donations.map((d) => new Date(d.donation_date).getFullYear()))).sort((a, b) => b - a), [donations]);
  const projects = useMemo(() => Array.from(new Set(donations.map((d) => d.project_name).filter(Boolean) as string[])).sort(), [donations]);
  const methods = useMemo(() => Array.from(new Set(donations.map((d) => d.payment_method).filter(Boolean) as string[])).sort(), [donations]);

  const filtered = useMemo(() => {
    return donations.filter((d) => {
      if (year !== "all" && new Date(d.donation_date).getFullYear() !== Number(year)) return false;
      if (project !== "all" && d.project_name !== project) return false;
      if (method !== "all" && d.payment_method !== method) return false;
      if (q && !`${d.donor_name || ""} ${d.donor_phone || ""} ${d.project_name || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [donations, q, year, project, method]);

  const sum = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-3">
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="ابحث بالمتبرع أو المشروع…" />
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="السنة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل السنوات</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="w-52 h-9"><SelectValue placeholder="المشروع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المشاريع</SelectItem>
            {projects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="وسيلة الدفع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الوسائل</SelectItem>
            {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={filtered.length} total={donations.length} extra={SAR(sum)} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "الوسيلة", "المبلغ", "الحالة"]}
        rows={filtered.slice(0, 1000).map((d, i) => [
          String(i + 1), fmtDate(d.donation_date), d.donor_name || "—", d.donor_phone || "—",
          d.project_name || "—", d.payment_method || "—",
          <span className="font-bold text-emerald-700">{SAR(Number(d.amount))}</span>,
          <Badge variant="outline" className={cn(
            d.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"
          )}>{d.status}</Badge>,
        ])}
      />
    </div>
  );
}

function TopDonorsPanel({ donors }: { donors: DonorRow[] }) {
  const [limit, setLimit] = useState<string>("50");
  const top = useMemo(() => [...donors].sort((a, b) => Number(b.total_donated) - Number(a.total_donated)).slice(0, Number(limit)), [donors, limit]);
  return (
    <div className="space-y-3">
      <Toolbar>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["10", "25", "50", "100", "500"].map((n) => <SelectItem key={n} value={n}>أعلى {n}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "المدينة", "عدد التبرعات", "إجمالي التبرع", "أول تبرع", "آخر تبرع"]}
        rows={top.map((d, i) => [
          <span className={cn("font-bold", i < 3 ? "text-amber-600" : "text-slate-700")}>{i + 1}</span>,
          d.full_name, d.phone || "—", d.city || "—",
          d.donations_count,
          <span className="font-bold text-amber-700">{SAR(Number(d.total_donated))}</span>,
          fmtDate(d.first_donation_at), fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function RecurringPanel({ donors }: { donors: DonorRow[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const [min, setMin] = useState<string>("2");
  const list = useMemo(() => donors.filter((d) => d.donations_count >= Number(min)).sort((a, b) => b.donations_count - a.donations_count), [donors, min]);
  return (
    <div className="space-y-3">
      <Toolbar>
        <Select value={min} onValueChange={setMin}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2, 3, 5, 10, 20].map((n) => <SelectItem key={n} value={String(n)}>{n}+ تبرعات</SelectItem>)}
          </SelectContent>
        </Select>
        <CountChip n={list.length} total={donors.length} />
      </Toolbar>
      <DataTable
        head={["#", "الاسم", "الجوال", "عدد التبرعات", "إجمالي", "آخر تبرع"]}
        rows={list.slice(0, 1000).map((d, i) => [
          String(i + 1), d.full_name, d.phone || "—",
          <Badge style={{ background: `${brand}1f`, color: brand, borderColor: `${brand}55` }}>{d.donations_count}</Badge>,
          <span className="font-bold" style={{ color: brand }}>{SAR(Number(d.total_donated))}</span>,
          fmtDate(d.last_donation_at),
        ])}
      />
    </div>
  );
}

function CampaignsPanel({ campaigns }: { campaigns: any[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  return (
    <DataTable
      head={["#", "اسم الحملة", "الهدف", "المُحصّل", "نسبة الإنجاز", "عدد التبرعات", "البداية", "النهاية", "الحالة"]}
      rows={campaigns.map((c, i) => {
        const goal = Number(c.goal_amount || 0);
        const got = Number(c.collected_amount || 0);
        const pct = goal > 0 ? Math.round((got / goal) * 100) : 0;
        return [
          String(i + 1), c.name, goal ? SAR(goal) : "—",
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
          >{c.status}</Badge>,
        ];
      })}
    />
  );
}

function FailedPanel({ rows }: { rows: any[] }) {
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <>
      <Toolbar>
        <CountChip n={rows.length} total={rows.length} extra={`فُقد محتمل: ${SAR(total)}`} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "الوسيلة", "المبلغ", "السبب", "حالة الإعادة"]}
        rows={rows.slice(0, 1000).map((r, i) => [
          String(i + 1), fmtDate(r.attempted_at), r.donor_name || "—", r.donor_phone || "—",
          r.project_name || "—", r.payment_method || "—",
          <span className="font-bold text-rose-700">{SAR(Number(r.amount))}</span>,
          <span className="text-xs text-slate-600">{r.failure_reason || "—"}</span>,
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{r.retry_status}</Badge>,
        ])}
      />
    </>
  );
}

function AbandonedPanel({ rows }: { rows: any[] }) {
  const recovered = rows.filter((r) => r.recovered).length;
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <>
      <Toolbar>
        <CountChip n={rows.length} total={rows.length} extra={`مُسترد: ${recovered} · قيمة: ${SAR(total)}`} />
      </Toolbar>
      <DataTable
        head={["#", "التاريخ", "المتبرع", "الجوال", "المشروع", "المبلغ", "حالة المتابعة", "مُسترد"]}
        rows={rows.slice(0, 1000).map((r, i) => [
          String(i + 1), fmtDate(r.abandoned_at), r.donor_name || "—", r.donor_phone || "—",
          r.project_name || "—",
          <span className="font-bold text-amber-700">{SAR(Number(r.amount))}</span>,
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{r.follow_up_status}</Badge>,
          r.recovered
            ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">نعم</Badge>
            : <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">لا</Badge>,
        ])}
      />
    </>
  );
}

function SubscriptionsPanel({ rows }: { rows: any[] }) {
  const branding = useOrgBranding();
  const brand = branding?.primary || "#2f8e8c";
  const active = rows.filter((r) => r.status === "active").length;
  const monthly = rows.filter((r) => r.status === "active").reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <>
      <Toolbar>
        <CountChip n={rows.length} total={rows.length} extra={`نشِط: ${active} · شهري متوقع: ${SAR(monthly)}`} />
      </Toolbar>
      <DataTable
        head={["#", "المتبرع", "الجوال", "المشروع", "المبلغ", "البداية", "الاستقطاع التالي", "الحالة"]}
        rows={rows.slice(0, 1000).map((r, i) => [
          String(i + 1), r.donor_name || "—", r.donor_phone || "—", r.project_name || "—",
          <span className="font-bold" style={{ color: brand }}>{SAR(Number(r.amount))}</span>,
          fmtDate(r.start_date), fmtDate(r.next_charge_date),
          <Badge
            variant="outline"
            style={r.status === "active"
              ? { background: `${brand}10`, color: brand, borderColor: `${brand}55` }
              : { background: "rgb(248 250 252)", color: "rgb(51 65 85)", borderColor: "rgb(226 232 240)" }}
          >{r.status}</Badge>,
        ])}
      />
    </>
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
    <div className="ml-auto flex items-center gap-2 text-xs">
      <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-semibold">
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
              {head.map((h, i) => <TableHead key={i} className="text-right font-bold text-slate-700 whitespace-nowrap">{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className="hover:bg-slate-50">
                {r.map((c, j) => <TableCell key={j} className="text-right whitespace-nowrap">{c as any}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}