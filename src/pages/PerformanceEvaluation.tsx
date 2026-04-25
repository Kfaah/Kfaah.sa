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
  job_title: string | null;
  avatar_url: string | null;
};

type ScoreRow = {
  id: string;
  employee_user_id: string;
  criterion_id: string;
  score: number;
  period: string;
  notes: string | null;
};

const PERIODS = [
  { value: "day", label: "يومي" },
  { value: "week", label: "أسبوعي" },
  { value: "month", label: "شهري" },
  { value: "year", label: "سنوي" },
];

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  task_completion: CheckCircle2,
  task_quality: Star,
  time_efficiency: Clock,
  ai_usage: Bot,
};

function scoreTone(v: number) {
  if (v >= 85) return { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200", grad: "from-emerald-500 to-teal-500", label: "ممتاز" };
  if (v >= 70) return { text: "text-sky-600", bg: "bg-sky-50", ring: "ring-sky-200", grad: "from-sky-500 to-blue-500", label: "جيد جداً" };
  if (v >= 50) return { text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200", grad: "from-amber-500 to-orange-500", label: "مقبول" };
  return { text: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200", grad: "from-rose-500 to-red-500", label: "ضعيف" };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [period, setPeriod] = useState<string>("month");
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

  const loadAll = async () => {
    setLoading(true);
    const [cRes, eRes, sRes, dRes] = await Promise.all([
      supabase.from("evaluation_criteria").select("*").eq("is_active", true).order("display_order"),
      supabase.from("employees").select("id, user_id, full_name, department_id, job_title, avatar_url").not("user_id", "is", null),
      supabase.from("employee_evaluation_scores").select("*").eq("period", period),
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
    setScores((sRes.data ?? []) as ScoreRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [period]);

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
        {/* Hero header */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg"
          style={{
            background:
              "linear-gradient(135deg, hsl(160 50% 25%) 0%, hsl(170 45% 30%) 50%, hsl(45 65% 45%) 100%)",
          }}
        >
          <div className="absolute -left-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-0 bottom-0 w-32 h-32 rounded-full bg-yellow-300/20 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/40">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  تقييم الأداء
                  <Sparkles className="w-5 h-5 text-yellow-200" />
                </h1>
                <p className="text-sm text-white/80 mt-1">
                  متوسط درجات الموظفين على معايير التقييم — التقييم النهائي = متوسط جميع المعايير
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatPill label="متوسط الجمعية" value={orgAverage} icon={<TrendingUp className="w-4 h-4" />} />
              {topEmployee && topEmployee.score > 0 && (
                <StatPill label={`الأعلى: ${topEmployee.name}`} value={topEmployee.score} icon={<Star className="w-4 h-4" />} />
              )}
              <Dialog open={openCriterion} onOpenChange={setOpenCriterion}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-white text-emerald-800 hover:bg-white/90 font-bold">
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
                <Label className="text-xs mb-1.5 block">الفترة الزمنية</Label>
                <Select value={period} onValueChange={setPeriod} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">الموظف</Label>
                <Select value={empFilter} onValueChange={setEmpFilter} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">القسم</Label>
                <Select value={deptFilter} onValueChange={setDeptFilter} dir="rtl">
                  <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
              <table className="w-full" dir="rtl">
                <thead>
                  <tr
                    className="text-white text-sm"
                    style={{
                      background:
                        "linear-gradient(90deg, hsl(160 50% 25%) 0%, hsl(170 45% 30%) 100%)",
                    }}
                  >
                    <th className="text-right p-4 font-bold sticky right-0 z-10"
                        style={{ background: "linear-gradient(90deg, hsl(160 50% 25%), hsl(160 50% 27%))" }}>
                      الموظف
                    </th>
                    {criteria.map(c => {
                      const Icon = METRIC_ICONS[c.metric_key ?? ""] ?? Sparkles;
                      return (
                        <th key={c.id} className="p-4 font-bold whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{c.name}</span>
                            {!c.is_automatic && (
                              <button onClick={() => deleteCriterion(c.id)}
                                      className="text-white/70 hover:text-rose-200 ms-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="p-4 font-bold text-center bg-yellow-500/30 border-r border-white/20">
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
                            "border-b border-border/50 transition-colors hover:bg-muted/40",
                            idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                          )}>
                        {/* Employee cell */}
                        <td className="p-4 sticky right-0 bg-inherit z-[1]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-amber-400 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0">
                              {e.avatar_url ? (
                                <img src={e.avatar_url} alt={e.full_name} className="w-full h-full rounded-full object-cover" />
                              ) : (
                                initials(e.full_name)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">{e.full_name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {e.job_title || e.department || "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Score cells */}
                        {criteria.map(c => {
                          const s = getScore(e.user_id!, c.id);
                          const v = s ? Number(s.score) : null;
                          const t = v !== null ? scoreTone(v) : null;
                          return (
                            <td key={c.id} className="p-3 text-center">
                              <button
                                onClick={() => openScore(e.user_id!, c.id, e.full_name, c.name)}
                                className={cn(
                                  "group inline-flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                                  "hover:scale-105 hover:shadow-md",
                                  v !== null ? `${t!.bg} ring-1 ${t!.ring}` : "border border-dashed border-border hover:border-primary",
                                )}
                              >
                                {v !== null ? (
                                  <>
                                    <span className={cn("text-lg font-bold leading-none", t!.text)}>
                                      {v}
                                    </span>
                                    <span className="h-1 w-12 rounded-full bg-white/60 overflow-hidden">
                                      <span className={cn("block h-full rounded-full bg-gradient-to-r", t!.grad)}
                                            style={{ width: `${v}%` }} />
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground group-hover:text-primary">
                                    + إضافة
                                  </span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* Final score */}
                        <td className="p-4 text-center bg-yellow-50/50">
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn(
                              "w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-md text-white bg-gradient-to-br",
                              tone.grad,
                            )}>
                              {final}
                            </div>
                            <span className={cn("text-[11px] font-semibold", tone.text)}>{tone.label}</span>
                          </div>
                        </td>
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