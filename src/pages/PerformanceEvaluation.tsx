import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Award, Filter, Loader2, Pencil, Trash2 } from "lucide-react";

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
  department: string | null;
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

export default function PerformanceEvaluation() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [period, setPeriod] = useState<string>("month");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Add criterion dialog
  const [openCriterion, setOpenCriterion] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newWeight, setNewWeight] = useState<number>(10);

  // Add/edit score dialog
  const [scoreDialog, setScoreDialog] = useState<{
    open: boolean;
    employee_user_id?: string;
    criterion_id?: string;
    existing?: ScoreRow;
  }>({ open: false });
  const [scoreValue, setScoreValue] = useState<number>(0);
  const [scoreNotes, setScoreNotes] = useState("");

  const loadAll = async () => {
    setLoading(true);
    const [cRes, eRes, sRes] = await Promise.all([
      supabase.from("evaluation_criteria").select("*").eq("is_active", true).order("display_order"),
      supabase.from("employees").select("id, user_id, full_name, department").not("user_id", "is", null),
      supabase.from("employee_evaluation_scores").select("*").eq("period", period),
    ]);
    if (cRes.error) toast.error("تعذر تحميل المعايير");
    if (eRes.error) toast.error("تعذر تحميل الموظفين");
    if (sRes.error) toast.error("تعذر تحميل الدرجات");
    setCriteria((cRes.data ?? []) as Criterion[]);
    setEmployees(((eRes.data ?? []) as any[]).filter(e => e.user_id) as Employee[]);
    setScores((sRes.data ?? []) as ScoreRow[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [period]);

  const departments = useMemo(() => {
    const set = new Set(employees.map(e => e.department).filter(Boolean) as string[]);
    return Array.from(set);
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (empFilter !== "all" && e.id !== empFilter) return false;
      if (deptFilter !== "all" && e.department !== deptFilter) return false;
      return true;
    });
  }, [employees, empFilter, deptFilter]);

  const getScore = (uid: string, cid: string): ScoreRow | undefined =>
    scores.find(s => s.employee_user_id === uid && s.criterion_id === cid);

  const totalWeight = useMemo(
    () => criteria.reduce((a, c) => a + Number(c.weight || 0), 0) || 1,
    [criteria]
  );

  const finalScore = (uid: string): number => {
    let total = 0;
    for (const c of criteria) {
      const s = getScore(uid, c.id);
      if (s) total += (Number(s.score) * Number(c.weight)) / totalWeight;
    }
    return Math.round(total);
  };

  const submitCriterion = async () => {
    if (!newName.trim()) { toast.error("اسم المعيار مطلوب"); return; }
    const { error } = await supabase.from("evaluation_criteria").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      weight: newWeight,
      is_automatic: false,
      display_order: criteria.length + 1,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error("تعذر إضافة المعيار: " + error.message); return; }
    toast.success("تمت إضافة المعيار");
    setOpenCriterion(false);
    setNewName(""); setNewDesc(""); setNewWeight(10);
    loadAll();
  };

  const deleteCriterion = async (id: string) => {
    if (!confirm("حذف هذا المعيار؟")) return;
    const { error } = await supabase.from("evaluation_criteria").update({ is_active: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    loadAll();
  };

  const openScore = (uid: string, cid: string) => {
    const ex = getScore(uid, cid);
    setScoreDialog({ open: true, employee_user_id: uid, criterion_id: cid, existing: ex });
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

  const scoreColor = (v: number) => {
    if (v >= 85) return "text-emerald-600";
    if (v >= 70) return "text-blue-600";
    if (v >= 50) return "text-amber-600";
    return "text-rose-600";
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow"
                 style={{ background: "linear-gradient(135deg, hsl(160 50% 30%), hsl(45 70% 50%))" }}>
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">تقييم الأداء</h1>
              <p className="text-sm text-muted-foreground">معايير التقييم، درجات الموظفين، والتقييم النهائي</p>
            </div>
          </div>

          <Dialog open={openCriterion} onOpenChange={setOpenCriterion}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة معيار تقييم
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة معيار تقييم جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم المعيار</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="مثال: التعاون مع الفريق" />
                </div>
                <div>
                  <Label>الوصف (اختياري)</Label>
                  <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label>الوزن (نسبة من 100)</Label>
                  <Input type="number" min={1} max={100} value={newWeight}
                         onChange={e => setNewWeight(Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    إجمالي الأوزان الحالية: {totalWeight}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenCriterion(false)}>إلغاء</Button>
                <Button onClick={submitCriterion}>حفظ المعيار</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">الفترة</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الموظف</Label>
              <Select value={empFilter} onValueChange={setEmpFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الموظفين</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">القسم</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأقسام</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Criteria summary chips */}
        <div className="flex flex-wrap gap-2">
          {criteria.map(c => (
            <Badge key={c.id} variant="secondary" className="gap-2 py-1.5 px-3">
              <span>{c.name}</span>
              <span className="text-xs opacity-70">({c.weight}%)</span>
              {c.is_automatic && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">تلقائي</span>}
              {!c.is_automatic && (
                <button onClick={() => deleteCriterion(c.id)} className="ms-1 text-rose-500 hover:text-rose-700">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-right sticky right-0 bg-muted/40 min-w-[180px]">الموظف</TableHead>
                    {criteria.map(c => (
                      <TableHead key={c.id} className="text-center min-w-[140px]">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">وزن {c.weight}%</div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[120px] bg-primary/5">التقييم النهائي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={criteria.length + 2} className="text-center py-10 text-muted-foreground">
                        لا يوجد موظفون مطابقون للفلاتر
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredEmployees.map(e => {
                    const final = finalScore(e.user_id!);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-right sticky right-0 bg-background font-medium">
                          <div>{e.full_name}</div>
                          {e.department && <div className="text-xs text-muted-foreground">{e.department}</div>}
                        </TableCell>
                        {criteria.map(c => {
                          const s = getScore(e.user_id!, c.id);
                          return (
                            <TableCell key={c.id} className="text-center">
                              <button
                                onClick={() => openScore(e.user_id!, c.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition"
                              >
                                {s ? (
                                  <span className={`font-bold ${scoreColor(Number(s.score))}`}>
                                    {Number(s.score)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">— أضف</span>
                                )}
                                <Pencil className="w-3 h-3 opacity-50" />
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center bg-primary/5">
                          <span className={`text-lg font-bold ${scoreColor(final)}`}>{final}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Score dialog */}
        <Dialog open={scoreDialog.open} onOpenChange={(o) => setScoreDialog(s => ({ ...s, open: o }))}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {scoreDialog.existing ? "تعديل الدرجة" : "إضافة درجة"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الدرجة (0 - 100)</Label>
                <Input type="number" min={0} max={100} value={scoreValue}
                       onChange={e => setScoreValue(Number(e.target.value))} />
              </div>
              <div>
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={scoreNotes} onChange={e => setScoreNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScoreDialog({ open: false })}>إلغاء</Button>
              <Button onClick={saveScore}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}