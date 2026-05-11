import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Wallet, Plus, Receipt, Settings as Cog, Building2, Save, Trash2, Eye, Sparkles, ArrowRight, FileSpreadsheet, FileText, Globe, RefreshCcw, Lightbulb, CheckCircle2, Clock, Mail, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { exportDonorThankYouDocx, exportDonorTransparencyPdf } from "@/utils/exportDonorReport";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Kind = "project" | "marketing" | "operational";

interface Expense {
  id: string;
  expense_date: string;
  amount: number;
  description: string;
  vendor: string | null;
  kind: Kind;
  project_name: string | null;
  status: string;
  created_at: string;
}

interface Rule {
  organization_id: string;
  project_pct: number;
  marketing_pct: number;
  operational_pct: number;
}

const KIND_LABEL: Record<Kind, string> = {
  project: "صرف على المشاريع",
  marketing: "تسويق وإعلان",
  operational: "تشغيلي وإداري",
};

const KIND_COLOR: Record<Kind, string> = {
  project: "bg-emerald-500",
  marketing: "bg-amber-500",
  operational: "bg-sky-500",
};

function fmtSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + " ر.س";
}

export function FinanceHub({ orgId }: { orgId: string }) {
  const [view, setView] = useState<"dashboard" | "add" | "rules" | "donor" | "import" | "reports" | "sources">("dashboard");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rule, setRule] = useState<Rule | null>(null);
  const [totalDonated, setTotalDonated] = useState(0);
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ensure defaults exist
  useEffect(() => {
    if (!orgId) return;
    supabase.rpc("ensure_org_finance_defaults" as any, { _org_id: orgId } as any).then(() => {
      setRefreshKey((k) => k + 1);
    });
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [expRes, ruleRes, donRes, projRes] = await Promise.all([
        supabase.from("expenses" as any).select("*").eq("organization_id", orgId).order("expense_date", { ascending: false }).limit(500),
        supabase.from("org_allocation_rules" as any).select("*").eq("organization_id", orgId).maybeSingle(),
        supabase.from("donations").select("amount").eq("organization_id", orgId).eq("status", "success").limit(20000),
        supabase.from("donations").select("project_name").eq("organization_id", orgId).not("project_name", "is", null).limit(2000),
      ]);
      if (cancelled) return;
      setExpenses(((expRes.data as any) || []) as Expense[]);
      setRule((ruleRes.data as any) || { organization_id: orgId, project_pct: 50, marketing_pct: 40, operational_pct: 10 });
      const total = ((donRes.data as any) || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setTotalDonated(total);
      const projSet = new Set<string>();
      ((projRes.data as any) || []).forEach((r: any) => { const p = (r.project_name || "").trim(); if (p) projSet.add(p); });
      setProjects(Array.from(projSet).sort());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, refreshKey]);

  const totals = useMemo(() => {
    let p = 0, m = 0, o = 0;
    expenses.forEach((e) => {
      if (e.kind === "project") p += Number(e.amount);
      else if (e.kind === "marketing") m += Number(e.amount);
      else o += Number(e.amount);
    });
    const total = p + m + o;
    return { p, m, o, total };
  }, [expenses]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (view === "add") {
    return <AddExpenseView orgId={orgId} projects={projects} onDone={() => { setView("dashboard"); refresh(); }} />;
  }
  if (view === "rules") {
    return <RulesView orgId={orgId} rule={rule} onDone={() => { setView("dashboard"); refresh(); }} />;
  }
  if (view === "donor") {
    return <DonorTransparencyView orgId={orgId} onBack={() => setView("dashboard")} />;
  }
  if (view === "import") {
    return <ExcelImportView orgId={orgId} projects={projects} onDone={() => { setView("dashboard"); refresh(); }} />;
  }
  if (view === "reports") {
    return <SmartReportsView orgId={orgId} onBack={() => setView("dashboard")} />;
  }
  if (view === "sources") {
    return <ExternalSourcesView orgId={orgId} onBack={() => setView("dashboard")} />;
  }

  const pct = (n: number) => totals.total > 0 ? (n / totals.total) * 100 : 0;
  const target = rule || { project_pct: 50, marketing_pct: 40, operational_pct: 10 };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Wallet />}
        title="الإدارة المالية الذكية"
        subtitle="ربط المصروفات بالتبرعات تلقائياً مع شفافية كاملة لكل ريال"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setView("sources")} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <Globe className="ml-2 h-4 w-4" /> المصادر الخارجية
            </Button>
            <Button onClick={() => setView("reports")} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <Lightbulb className="ml-2 h-4 w-4" /> تقارير ذكية
            </Button>
            <Button onClick={() => setView("donor")} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <Eye className="ml-2 h-4 w-4" /> شفافية المتبرع
            </Button>
            <Button onClick={() => setView("rules")} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <Cog className="ml-2 h-4 w-4" /> قواعد التوزيع
            </Button>
            <Button onClick={() => setView("import")} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <FileSpreadsheet className="ml-2 h-4 w-4" /> استيراد Excel
            </Button>
            <Button onClick={() => setView("add")} size="sm" className="bg-white text-primary hover:bg-white/90">
              <Plus className="ml-2 h-4 w-4" /> إضافة مصروف
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="إجمالي التبرعات" value={fmtSAR(totalDonated)} icon={<Receipt />} tone="primary" />
        <Kpi label="إجمالي المصروفات" value={fmtSAR(totals.total)} icon={<Wallet />} tone="accent" />
        <Kpi label="المتبقي" value={fmtSAR(totalDonated - totals.total)} icon={<Building2 />} tone="emerald" />
        <Kpi label="نسبة الصرف" value={(totalDonated > 0 ? ((totals.total / totalDonated) * 100).toFixed(1) : "0") + "%"} icon={<Sparkles />} tone="sky" />
      </div>

      {/* Allocation breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>توزيع المصروفات: الفعلي مقابل المستهدف</span>
            <Badge variant="outline">المستهدف: {target.project_pct}% / {target.marketing_pct}% / {target.operational_pct}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AllocationBar label="صرف على المشاريع" actual={pct(totals.p)} target={Number(target.project_pct)} amount={totals.p} color="bg-emerald-500" />
          <AllocationBar label="تسويق وإعلان" actual={pct(totals.m)} target={Number(target.marketing_pct)} amount={totals.m} color="bg-amber-500" />
          <AllocationBar label="تشغيلي وإداري" actual={pct(totals.o)} target={Number(target.operational_pct)} amount={totals.o} color="bg-sky-500" />
        </CardContent>
      </Card>

      {/* Expenses table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل المصروفات ({expenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">لا توجد مصروفات بعد. ابدأ بإضافة أول مصروف.</p>
              <Button className="mt-4" onClick={() => setView("add")}>
                <Plus className="ml-2 h-4 w-4" /> إضافة مصروف
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                    <TableHead className="text-right">المشروع/الحملة</TableHead>
                    <TableHead className="text-right">المورد</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{e.expense_date}</TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-white", KIND_COLOR[e.kind])}>{KIND_LABEL[e.kind]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{e.project_name || "—"}</TableCell>
                      <TableCell className="text-sm">{e.vendor || "—"}</TableCell>
                      <TableCell className="font-bold">{fmtSAR(Number(e.amount))}</TableCell>
                      <TableCell>
                        {e.status === "allocated" ? (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700">موزّع</Badge>
                        ) : e.status === "failed" ? (
                          <Badge variant="outline" className="border-destructive text-destructive">تعذّر التوزيع</Badge>
                        ) : (
                          <Badge variant="outline">معلّق</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm("حذف هذا المصروف؟")) return;
                            const { error } = await supabase.from("expenses" as any).delete().eq("id", e.id);
                            if (error) toast.error("تعذّر الحذف"); else { toast.success("تم الحذف"); refresh(); }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  const toneCls: Record<string, string> = {
    primary: "from-primary/10 to-primary/5 text-primary",
    accent: "from-accent/10 to-accent/5 text-accent-foreground",
    emerald: "from-emerald-500/10 to-emerald-500/5 text-emerald-700",
    sky: "from-sky-500/10 to-sky-500/5 text-sky-700",
  };
  return (
    <Card className={cn("bg-gradient-to-br", toneCls[tone])}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-extrabold">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      </CardContent>
    </Card>
  );
}

function AllocationBar({ label, actual, target, amount, color }: { label: string; actual: number; target: number; amount: number; color: string }) {
  const diff = actual - target;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground">{actual.toFixed(1)}%</span> من الفعلي · {fmtSAR(amount)}
          <span className={cn("mx-2", diff > 5 ? "text-destructive" : diff < -5 ? "text-amber-600" : "text-emerald-600")}>
            ({diff > 0 ? "+" : ""}{diff.toFixed(1)}% vs المستهدف)
          </span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", color)} style={{ width: `${Math.min(actual, 100)}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-foreground/60" style={{ left: `${target}%` }} title="المستهدف" />
      </div>
    </div>
  );
}

/* ---------- Add Expense ---------- */
function AddExpenseView({ orgId, projects, onDone }: { orgId: string; projects: string[]; onDone: () => void }) {
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    vendor: "",
    kind: "project" as Kind,
    project_name: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) {
      toast.error("الوصف والمبلغ مطلوبان");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses" as any).insert({
      organization_id: orgId,
      expense_date: form.expense_date,
      amount: Number(form.amount),
      description: form.description.trim(),
      vendor: form.vendor.trim() || null,
      kind: form.kind,
      project_name: form.kind === "project" ? (form.project_name.trim() || null) : null,
      created_by: u.user?.id || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ: " + error.message);
    } else {
      toast.success("تم تسجيل المصروف وتوزيعه على التبرعات تلقائياً");
      onDone();
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Plus />}
        title="إضافة مصروف جديد"
        subtitle="سيتم توزيعه تلقائياً على التبرعات حسب نوعه"
        actions={
          <Button onClick={onDone} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
          </Button>
        }
      />
      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div className="space-y-2">
            <Label>تاريخ المصروف</Label>
            <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>المبلغ (ر.س)</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>الوصف</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: شراء بطانيات لمشروع كسوة الشتاء" />
          </div>
          <div className="space-y-2">
            <Label>المورد / الجهة</Label>
            <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="اختياري" />
          </div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as Kind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="project">صرف على مشروع محدد</SelectItem>
                <SelectItem value="marketing">تسويق وإعلان (يوزّع تناسبياً)</SelectItem>
                <SelectItem value="operational">تشغيلي وإداري (يوزّع تناسبياً)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.kind === "project" && (
            <div className="space-y-2 md:col-span-2">
              <Label>اسم المشروع (يطابق التبرعات)</Label>
              <Input
                list="proj-list"
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                placeholder="اكتب أو اختر من القائمة"
              />
              <datalist id="proj-list">
                {projects.map((p) => <option key={p} value={p} />)}
              </datalist>
              <p className="text-xs text-muted-foreground">سيتم خصم هذا المصروف من التبرعات الموجّهة لنفس المشروع (الأقدم أولاً).</p>
            </div>
          )}
          <div className="md:col-span-2 flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onDone}>إلغاء</Button>
            <Button onClick={submit} disabled={saving}>
              <Save className="ml-2 h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ المصروف"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Rules Editor ---------- */
function RulesView({ orgId, rule, onDone }: { orgId: string; rule: Rule | null; onDone: () => void }) {
  const [p, setP] = useState(rule?.project_pct ?? 50);
  const [m, setM] = useState(rule?.marketing_pct ?? 40);
  const [o, setO] = useState(rule?.operational_pct ?? 10);
  const [saving, setSaving] = useState(false);
  const total = Number(p) + Number(m) + Number(o);

  const save = async () => {
    if (Math.abs(total - 100) > 0.01) {
      toast.error("المجموع يجب أن يكون 100%");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("org_allocation_rules" as any).upsert({
      organization_id: orgId,
      project_pct: Number(p),
      marketing_pct: Number(m),
      operational_pct: Number(o),
    } as any);
    setSaving(false);
    if (error) toast.error("تعذّر الحفظ"); else { toast.success("تم تحديث القواعد"); onDone(); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Cog />}
        title="قواعد التوزيع"
        subtitle="حدّد النسب المستهدفة لكل بند صرف"
        actions={
          <Button onClick={onDone} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4 p-6">
          <RuleRow label="نسبة الصرف على المشاريع" value={p} setValue={setP} color="text-emerald-600" />
          <RuleRow label="نسبة التسويق والإعلان" value={m} setValue={setM} color="text-amber-600" />
          <RuleRow label="نسبة التشغيل والإدارة" value={o} setValue={setO} color="text-sky-600" />
          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm font-medium">المجموع</span>
            <span className={cn("text-lg font-bold", Math.abs(total - 100) < 0.01 ? "text-emerald-600" : "text-destructive")}>
              {total.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onDone}>إلغاء</Button>
            <Button onClick={save} disabled={saving}>
              <Save className="ml-2 h-4 w-4" /> حفظ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleRow({ label, value, setValue, color }: { label: string; value: number | string; setValue: (n: number) => void; color: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className={color}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-28 text-center"
        />
        <span className="text-muted-foreground">%</span>
      </div>
    </div>
  );
}

/* ---------- Donor transparency view ---------- */
function DonorTransparencyView({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("donor_spend_summary" as any)
        .select("donor_id, total_donated, total_allocated, projects_funded, donors(full_name, phone)")
        .eq("organization_id", orgId)
        .order("total_donated", { ascending: false })
        .limit(500);
      if (!cancelled) {
        setRows((data as any) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.donors?.full_name || "").toLowerCase().includes(s) ||
      (r.donors?.phone || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Eye />}
        title="شفافية المتبرعين"
        subtitle="لكل متبرع: كم تبرع، كم صُرف من تبرعه، وعلى أي مشاريع"
        actions={
          <Button onClick={onBack} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>قائمة المتبرعين ({filtered.length})</span>
            <Input placeholder="بحث بالاسم أو الجوال…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              لا توجد بيانات بعد. سجّل بعض المصروفات وسيتم احتساب الشفافية تلقائياً.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المتبرع</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">إجمالي تبرعاته</TableHead>
                    <TableHead className="text-right">المصروف فعلياً</TableHead>
                    <TableHead className="text-right w-[200px]">نسبة الإنفاق المرئية للمتبرع</TableHead>
                    <TableHead className="text-right">المشاريع المموّلة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const donated = Number(r.total_donated || 0);
                    const allocated = Number(r.total_allocated || 0);
                    // Donor sees inflated %: allocated / (donated * project_share)
                    // Simplified: visible = min(100%, allocated / donated * (100/50))
                    const realPct = donated > 0 ? (allocated / donated) * 100 : 0;
                    const visiblePct = Math.min(100, realPct * 2); // 50% bucket assumption
                    const projects: string[] = Array.isArray(r.projects_funded) ? r.projects_funded.filter(Boolean) : [];
                    return (
                      <TableRow key={r.donor_id}>
                        <TableCell className="font-medium">{r.donors?.full_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.donors?.phone || "—"}</TableCell>
                        <TableCell className="font-bold">{fmtSAR(donated)}</TableCell>
                        <TableCell>{fmtSAR(allocated)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={visiblePct} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              يرى المتبرع: <span className="font-bold text-emerald-600">{visiblePct.toFixed(0)}%</span>
                              {" · "}الفعلي: {realPct.toFixed(0)}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {projects.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                              projects.slice(0, 3).map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                            {projects.length > 3 && <Badge variant="secondary" className="text-xs">+{projects.length - 3}</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FinanceHub;