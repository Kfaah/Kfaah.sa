import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Award, Filter, Loader2, Trash2, Sparkles,
  TrendingUp, CheckCircle2, Star, Clock, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

type Criterion = {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  is_automatic: boolean;
  metric_key: string | null;
  is_active: boolean;
  display_order: number;
};

type Employee = {
  id: string;
  user_id: string | null;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
  job_role: string | null;
  avatar_url: string | null;
};

type ScoreRow = {
  id: string;
  employee_user_id: string;
  criterion_id: string;
  score: number;
  period: string;
  period_start?: string | null;
  period_end?: string | null;
  notes: string | null;
};

const PERIODS = [
  { value: "yesterday", label: "أمس" },
  { value: "last_week", label: "الأسبوع الماضي" },
  { value: "month_to_date", label: "الشهر حتى الآن" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "last_year", label: "السنة الماضية" },
  { value: "custom", label: "فترة مخصصة" },
];

/** Map a period preset to ISO date range [start, end] (inclusive). */
function rangeForPeriod(p: string, customFrom?: string, customTo?: string): { start: string; end: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  switch (p) {
    case "yesterday":
      return { start: fmt(yesterday), end: fmt(yesterday), label: `أمس (${fmt(yesterday)})` };
    case "last_week": {
      // Last completed week: previous Sunday → previous Saturday
      const dow = today.getDay(); // 0 (Sun) .. 6 (Sat)
      const lastSat = new Date(today); lastSat.setDate(today.getDate() - dow - 1);
      const lastSun = new Date(lastSat); lastSun.setDate(lastSat.getDate() - 6);
      return { start: fmt(lastSun), end: fmt(lastSat), label: `الأسبوع الماضي (${fmt(lastSun)} → ${fmt(lastSat)})` };
    }
    case "month_to_date": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(first), end: fmt(yesterday), label: `الشهر حتى الآن (${fmt(first)} → ${fmt(yesterday)})` };
    }
    case "last_month": {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastPrev = new Date(firstThis); lastPrev.setDate(0);
      const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
      return { start: fmt(firstPrev), end: fmt(lastPrev), label: `الشهر الماضي (${fmt(firstPrev)} → ${fmt(lastPrev)})` };
    }
    case "last_year": {
      const y = today.getFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `السنة الماضية (${y})` };
    }
    case "custom": {
      const s = customFrom || fmt(yesterday);
      const e = customTo || fmt(yesterday);
      return { start: s, end: e, label: `${s} → ${e}` };
    }
    default:
      return { start: fmt(yesterday), end: fmt(yesterday), label: "أمس" };
  }
}

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task_completion: CheckCircle2,
  task_quality: Star,
  time_efficiency: Clock,
  ai_usage: Bot,
};

function scoreTone(v: number) {
  if (v >= 96) return { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", grad: "from-emerald-500 to-teal-500", label: "ممتاز جداً" };
  if (v >= 90) return { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200", grad: "from-emerald-500 to-green-500", label: "ممتاز" };
  if (v >= 80) return { text: "text-sky-600",     bg: "bg-sky-50",     ring: "ring-sky-200",     grad: "from-sky-500 to-blue-500",       label: "جيد جداً" };
  if (v >= 70) return { text: "text-indigo-600",  bg: "bg-indigo-50",  ring: "ring-indigo-200",  grad: "from-indigo-500 to-violet-500",  label: "جيد" };
  if (v >= 60) return { text: "text-amber-600",   bg: "bg-amber-50",   ring: "ring-amber-200",   grad: "from-amber-500 to-orange-500",   label: "مقبول" };
  return         { text: "text-rose-600",    bg: "bg-rose-50",    ring: "ring-rose-200",    grad: "from-rose-500 to-red-500",       label: "ضعيف" };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

// Deterministic demo score (0-100) per employee+criterion, used only when
// no real score exists yet, to preview the table visually.
function demoScore(uid: string, cid: string): number {
  let h = 0;
  const s = uid + "|" + cid;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 55 + (h % 46); // 55..100
}

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [period, setPeriod] = useState<string>("month_to_date");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const [openCriterion, setOpenCriterion] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [scoreDialog, setScoreDialog] = useState<{
    open: boolean;
    employee_user_id?: string;
    criterion_id?: string;
    employeeName?: string;
    criterionName?: string;
    existing?: ScoreRow;
  }>({ open: false });
  const [scoreValue, setScoreValue] = useState<number>(0);
  const [scoreNotes, setScoreNotes] = useState("");

  const range = useMemo(
    () => rangeForPeriod(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const loadAll = async () => {
    setLoading(true);
    // Resolve current user's organization to scope the table
    const { data: orgId } = await supabase.rpc("get_user_organization_id", { _user_id: user?.id });
    const [cRes, eRes, sRes, dRes] = await Promise.all([
      supabase.from("evaluation_criteria").select("*").eq("is_active", true).order("display_order"),
      (orgId
        ? supabase.from("employees").select("id, user_id, full_name, department_id, job_role, avatar_url").not("user_id", "is", null).eq("organization_id", orgId as string)
        : supabase.from("employees").select("id, user_id, full_name, department_id, job_role, avatar_url").not("user_id", "is", null)
      ),
      // Fetch all scores; filter client-side by date range OR by legacy period label.
      supabase.from("employee_evaluation_scores").select("*"),
      supabase.from("departments").select("id, name"),
    ]);
    if (cRes.error) toast.error("تعذر تحميل المعايير");
    if (eRes.error) toast.error("تعذر تحميل الموظفين");
    if (sRes.error) toast.error("تعذر تحميل الدرجات");
    const deptMap = new Map<string, string>();
    for (const d of (dRes.data ?? []) as any[]) deptMap.set(d.id, d.name);
    setCriteria((cRes.data ?? []) as Criterion[]);
    setEmployees(
      ((eRes.data ?? []) as any[])
        .filter(e => e.user_id)
        .map(e => ({ ...e, department_name: e.department_id ? (deptMap.get(e.department_id) ?? null) : null })) as Employee[]
    );
    // Filter scores: keep rows whose [period_start, period_end] intersects the active range,
    // OR (for legacy seed data without dates) whose `period` label maps to the same preset.
    const all = (sRes.data ?? []) as ScoreRow[];
    const legacyMap: Record<string, string> = {
      yesterday: "day",
      last_week: "week",
      month_to_date: "month",
      last_month: "month",
      last_year: "year",
    };
    const legacyPeriod = legacyMap[period];
    const inRange = (s: ScoreRow) => {
      if (s.period_start && s.period_end) {
        return !(s.period_end < range.start || s.period_start > range.end);
      }
      // No dates → fall back to legacy label match
      return legacyPeriod ? s.period === legacyPeriod : false;
    };
    setScores(all.filter(inRange));
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [period, customFrom, customTo]);

  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department_name).filter(Boolean) as string[]);
    return Array.from(set);
  }, [employees]);

  // Department filter constrains the employee dropdown options
  const employeesInDept = useMemo(
    () => deptFilter === "all" ? employees : employees.filter(e => e.department_name === deptFilter),
    [employees, deptFilter]
  );

  const filteredEmployees = useMemo(() => {
    return employeesInDept.filter(e => {
      if (empFilter !== "all" && e.id !== empFilter) return false;
      return true;
    });
  }, [employeesInDept, empFilter]);

  const getScore = (uid: string, cid: string): ScoreRow | undefined =>
    scores.find(s => s.employee_user_id === uid && s.criterion_id === cid);

  // Simple average across criteria (only counted ones with a score)
  const finalScore = (uid: string): number => {
    if (criteria.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const c of criteria) {
      const s = getScore(uid, c.id);
      if (s) { sum += Number(s.score); count++; }
    }
    if (count === 0) return 0;
    return Math.round(sum / count);
  };

  const orgAverage = useMemo(() => {
    const vals = filteredEmployees.map(e => finalScore(e.user_id!)).filter(v => v > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [filteredEmployees, scores, criteria]);

  const topEmployee = useMemo(() => {
    let best: { name: string; score: number } | null = null;
    for (const e of filteredEmployees) {
      const s = finalScore(e.user_id!);
      if (!best || s > best.score) best = { name: e.full_name, score: s };
    }
    return best;
  }, [filteredEmployees, scores, criteria]);

  const submitCriterion = async () => {
    if (!newName.trim()) { toast.error("اسم المعيار مطلوب"); return; }
    const { error } = await supabase.from("evaluation_criteria").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      weight: 1, // not used anymore (simple average), kept for schema
      is_automatic: false,
      display_order: criteria.length + 1,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error("تعذر إضافة المعيار: " + error.message); return; }
    toast.success("تمت إضافة المعيار");
    setOpenCriterion(false);
    setNewName(""); setNewDesc("");
    loadAll();
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("حذف هذا المعيار؟")) return;
    const { error } = await supabase.from("evaluation_criteria").update({ is_active: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    loadAll();
  };

  const openScore = (uid: string, cid: string, empName: string, critName: string) => {
    const ex = getScore(uid, cid);
    setScoreDialog({ open: true, employee_user_id: uid, criterion_id: cid, employeeName: empName, criterionName: critName, existing: ex });
    setScoreValue(ex?.score ?? 0);
    setScoreNotes(ex?.notes ?? "");
  };

  const saveScore = async () => {
    if (!scoreDialog.employee_user_id || !scoreDialog.criterion_id) return;
    if (scoreValue < 0 || scoreValue > 100) { toast.error("الدرجة بين 0 و 100"); return; }
    if (scoreDialog.existing) {
      const { error } = await supabase.from("employee_evaluation_scores")
        .update({ score: scoreValue, notes: scoreNotes || null, evaluated_by: user?.id ?? null })
        .eq("id", scoreDialog.existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("employee_evaluation_scores").insert({
        employee_user_id: scoreDialog.employee_user_id,
        criterion_id: scoreDialog.criterion_id,
        score: scoreValue,
        period,
        period_start: range.start,
        period_end: range.end,
        notes: scoreNotes || null,
        evaluated_by: user?.id ?? null,
      });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("تم الحفظ");
    setScoreDialog({ open: false });
    loadAll();
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6" dir="rtl">
        <PageHeader
          icon={<Award className="w-7 h-7" />}
          title={
            <span className="flex items-center gap-2">
              تقييم الأداء
              <Sparkles className="w-5 h-5 text-white/80" />
            </span>
          }
          subtitle="متوسط درجات الموظفين على معايير التقييم — التقييم النهائي = متوسط جميع المعايير"
          actions={
            <>
              <StatPill label="متوسط الجمعية" value={orgAverage} icon={<TrendingUp className="w-4 h-4" />} />
              {topEmployee && topEmployee.score > 0 && (
                <StatPill label={`الأعلى: ${topEmployee.name}`} value={topEmployee.score} icon={<Star className="w-4 h-4" />} />
              )}
              <Dialog open={openCriterion} onOpenChange={setOpenCriterion}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-white text-primary hover:bg-white/90 font-bold">
                    <Plus className="w-4 h-4" />
                    إضافة معيار
                  </Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="text-right">إضافة معيار تقييم جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-right">
                    <div>
                      <Label>اسم المعيار</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)}
                             placeholder="مثال: التعاون مع الفريق" dir="rtl" />
                    </div>
                    <div>
                      <Label>الوصف (اختياري)</Label>
                      <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} dir="rtl" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      التقييم النهائي يُحسب كمتوسط حسابي بسيط لجميع المعايير (بدون أوزان).
                    </p>
                  </div>
                  <DialogFooter className="flex-row-reverse">
                    <Button onClick={submitCriterion}>حفظ المعيار</Button>
                    <Button variant="outline" onClick={() => setOpenCriterion(false)}>إلغاء</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground">
              <Filter className="w-4 h-4" />
              الفلاتر
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3" dir="rtl">
              <div>
                <Label className="text-xs mb-1.5 block">القسم</Label>
                <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setEmpFilter("all"); }} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">الموظف</Label>
                <Select value={empFilter} onValueChange={setEmpFilter} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {employeesInDept.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">الفترة الزمنية</Label>
                <Select value={period} onValueChange={setPeriod} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {period === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3" dir="rtl">
                <div>
                  <Label className="text-xs mb-1.5 block">من تاريخ</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} dir="ltr" className="text-right" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">إلى تاريخ</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} dir="ltr" className="text-right" />
                </div>
              </div>
            )}
            <div className="mt-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              النطاق المطبّق: <span className="font-semibold text-foreground">{range.label}</span>
            </div>
          </CardContent>
        </Card>

        {/* Beautiful Table */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
            ) : (
              <table className="w-full text-sm border-collapse" dir="rtl">
                <thead>
                  <tr
                    className="text-white text-[12px] uppercase tracking-wide"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(var(--sidebar-primary)) 0%, hsl(174 52% 45%) 100%)",
                    }}
                  >
                    <th className="text-right py-2.5 px-3 font-semibold sticky right-0 z-10"
                        style={{ background: "hsl(var(--sidebar-primary))" }}>
                      الموظف
                    </th>
                    {criteria.map(c => {
                      const Icon = METRIC_ICONS[c.metric_key ?? ""] ?? Sparkles;
                      return (
                        <th key={c.id} className="py-2.5 px-2 font-semibold whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{c.name}</span>
                            {!c.is_automatic && (
                              <button onClick={() => deleteCriterion(c.id)}
                                      className="text-white/60 hover:text-rose-200 ms-0.5">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-3 font-semibold text-center border-r border-white/20"
                        style={{ background: "hsl(174 52% 38%)" }}>
                      التقييم النهائي
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={criteria.length + 2} className="text-center py-12 text-muted-foreground">
                        لا يوجد موظفون مطابقون للفلاتر
                      </td>
                    </tr>
                  )}
                  {filteredEmployees.map((e, idx) => {
                    const final = finalScore(e.user_id!);
                    const tone = scoreTone(final);
                    return (
                      <tr key={e.id}
                          className={cn(
                            "border-b border-border/40 transition-colors hover:bg-primary/5 group",
                            idx % 2 === 0 ? "bg-background" : "bg-muted/15",
                          )}>
                        {/* Employee cell */}
                        <td className="py-2 px-3 sticky right-0 bg-inherit z-[1]">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-amber-400 flex items-center justify-center text-white font-bold text-[12px] shadow-sm flex-shrink-0 ring-2 ring-white">
                              {e.avatar_url ? (
                                <img src={e.avatar_url} alt={e.full_name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                initials(e.full_name)
                              )}
                            </div>
                            <div className="min-w-0 flex flex-col items-center text-center mx-auto">
                              <div className="font-semibold text-[13px] truncate leading-tight">{e.full_name}</div>
                              <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                                {e.job_role || e.department_name || "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Score cells */}
                        {criteria.map(c => {
                          const s = getScore(e.user_id!, c.id);
                          const real = s ? Number(s.score) : null;
                          const v = real ?? demoScore(e.user_id!, c.id);
                          const t = scoreTone(v);
                          return (
                            <td key={c.id} className="py-1.5 px-2 text-center">
                              <button
                                onClick={() => openScore(e.user_id!, c.id, e.full_name, c.name)}
                                className={cn(
                                  "inline-flex flex-col items-center gap-1 px-2.5 py-1 rounded-lg transition-all min-w-[58px]",
                                  "hover:scale-105 hover:shadow-sm",
                                  `${t.bg} ring-1 ${t.ring}`,
                                  real === null && "opacity-80",
                                )}
                              >
                                <span className={cn("text-[15px] font-bold leading-none tabular-nums", t.text)}>
                                  {v}
                                </span>
                                <span className="h-[3px] w-10 rounded-full bg-white/70 overflow-hidden">
                                  <span className={cn("block h-full rounded-full bg-gradient-to-r", t.grad)}
                                        style={{ width: `${v}%` }} />
                                </span>
                              </button>
                            </td>
                          );
                        })}

                        {/* Final score */}
                        {(() => {
                          // Use real avg if any real scores exist; otherwise compute demo avg.
                          const realCount = criteria.reduce((n, c) => n + (getScore(e.user_id!, c.id) ? 1 : 0), 0);
                          const finalShown = realCount > 0
                            ? final
                            : Math.round(criteria.reduce((sum, c) => sum + demoScore(e.user_id!, c.id), 0) / Math.max(1, criteria.length));
                          const ft = scoreTone(finalShown);
                          return (
                            <td className="py-1.5 px-3 text-center bg-amber-50/40 border-r border-amber-100">
                              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/70 ring-1 ring-amber-200/70 shadow-sm">
                                <span className={cn("text-[18px] font-extrabold tabular-nums leading-none", ft.text)}>
                                  {finalShown}
                                </span>
                                <span className="h-5 w-px bg-amber-300/70" />
                                <span className={cn("text-[12px] font-bold leading-none", ft.text)}>{ft.label}</span>
                              </div>
                            </td>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Score dialog */}
        <Dialog open={scoreDialog.open} onOpenChange={(o) => setScoreDialog(s => ({ ...s, open: o }))}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">
                {scoreDialog.existing ? "تعديل الدرجة" : "إضافة درجة"}
              </DialogTitle>
              {scoreDialog.employeeName && (
                <p className="text-sm text-muted-foreground text-right">
                  {scoreDialog.employeeName} — {scoreDialog.criterionName}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4 text-right">
              <div>
                <Label>الدرجة (0 - 100)</Label>
                <Input type="number" min={0} max={100} value={scoreValue}
                       onChange={e => setScoreValue(Number(e.target.value))} dir="rtl" />
              </div>
              <div>
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={scoreNotes} onChange={e => setScoreNotes(e.target.value)} rows={3} dir="rtl" />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse">
              <Button onClick={saveScore}>حفظ</Button>
              <Button variant="outline" onClick={() => setScoreDialog({ open: false })}>إلغاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function StatPill({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="hidden md:flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-2 rounded-xl ring-1 ring-white/30">
      {icon}
      <div className="text-right leading-tight">
        <div className="text-[10px] text-white/80">{label}</div>
        <div className="text-sm font-bold">{value}/100</div>
      </div>
    </div>
  );
}