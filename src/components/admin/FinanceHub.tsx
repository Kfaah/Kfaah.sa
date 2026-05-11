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
import { exportSmartReportPdf } from "@/utils/exportSmartReport";
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
  const [orgName, setOrgName] = useState<string>("الجمعية");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sumRes, orgRes] = await Promise.all([
        supabase
          .from("donor_spend_summary" as any)
          .select("donor_id, total_donated, total_allocated, projects_funded, fully_spent, fully_spent_message, primary_project, donors(full_name, phone)")
          .eq("organization_id", orgId)
          .order("total_donated", { ascending: false })
          .limit(500),
        supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
      ]);
      if (!cancelled) {
        setRows(((sumRes as any).data) || []);
        setOrgName((orgRes as any).data?.name || "الجمعية");
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
                    <TableHead className="text-right w-[260px]">حالة الشفافية المعروضة للمتبرع</TableHead>
                    <TableHead className="text-right">المشاريع المموّلة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const donated = Number(r.total_donated || 0);
                    const allocated = Number(r.total_allocated || 0);
                    const projects: string[] = Array.isArray(r.projects_funded) ? r.projects_funded.filter(Boolean) : [];
                    const fullySpent: boolean = !!r.fully_spent;
                    const message: string = r.fully_spent_message || "";
                    const data = {
                      donor_name: r.donors?.full_name || "كريم",
                      donor_phone: r.donors?.phone,
                      org_name: orgName,
                      total_donated: donated,
                      total_allocated: allocated,
                      fully_spent: fullySpent,
                      primary_project: r.primary_project,
                      projects_funded: projects,
                    };
                    return (
                      <TableRow key={r.donor_id}>
                        <TableCell className="font-medium">{r.donors?.full_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.donors?.phone || "—"}</TableCell>
                        <TableCell className="font-bold">{fmtSAR(donated)}</TableCell>
                        <TableCell>{fmtSAR(allocated)}</TableCell>
                        <TableCell>
                          {fullySpent ? (
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                              <div className="text-xs leading-5 text-emerald-700 font-medium">{message}</div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <Clock className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
                              <div className="text-xs leading-5 text-muted-foreground">{message || "جارٍ توجيه التبرع"}</div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {projects.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                              projects.slice(0, 3).map((p) => <Badge key={p} variant="outline" className="text-xs">{p}</Badge>)}
                            {projects.length > 3 && <Badge variant="secondary" className="text-xs">+{projects.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => exportDonorTransparencyPdf(data)} title="تقرير شفافية PDF">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => exportDonorThankYouDocx(data)} title="خطاب شكر Word">
                              <Mail className="h-4 w-4" />
                            </Button>
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

/* ---------- Excel Import View ---------- */
interface PreviewRow {
  description: string;
  amount: number;
  vendor?: string;
  expense_date?: string;
  kind: Kind;
  project_name?: string | null;
  _row: number;
}

function normalizeHeader(h: string): string {
  const s = String(h || "").trim().toLowerCase();
  if (/(date|تاريخ)/.test(s)) return "date";
  if (/(amount|مبلغ|قيمة)/.test(s)) return "amount";
  if (/(desc|بيان|وصف|تفاصيل)/.test(s)) return "description";
  if (/(vendor|مورد|جهة)/.test(s)) return "vendor";
  if (/(project|مشروع|حملة|campaign)/.test(s)) return "project";
  return s;
}

function ExcelImportView({ orgId, projects, onDone }: { orgId: string; projects: string[]; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseFile = async (f: File) => {
    setFile(f);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
    const out: PreviewRow[] = json.map((r, i) => {
      const norm: any = {};
      Object.keys(r).forEach((k) => { norm[normalizeHeader(k)] = r[k]; });
      let dateStr: string | undefined;
      const d = norm.date;
      if (d instanceof Date) dateStr = d.toISOString().slice(0, 10);
      else if (typeof d === "number") dateStr = new Date(Math.round((d - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
      else if (typeof d === "string" && d.trim()) dateStr = d.trim();
      return {
        _row: i + 2,
        description: String(norm.description || "").trim(),
        amount: Number(String(norm.amount || "").toString().replace(/[^\d.\-]/g, "")) || 0,
        vendor: String(norm.vendor || "").trim() || undefined,
        expense_date: dateStr,
        kind: "operational" as Kind,
        project_name: String(norm.project || "").trim() || null,
      };
    }).filter((r) => r.description && r.amount > 0);
    setRows(out);
    if (out.length === 0) toast.error("لم نجد صفوفاً صالحة. تأكد من وجود الأعمدة: التاريخ، الوصف، المبلغ");
  };

  const classifyAll = async () => {
    if (rows.length === 0) return;
    setClassifying(true);
    try {
      const batchSize = 15;
      const updated = [...rows];
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map((r, j) => ({
          id: String(i + j),
          description: r.description,
          amount: r.amount,
          vendor: r.vendor,
        }));
        const { data, error } = await supabase.functions.invoke("classify-expense-batch", {
          body: { rows: batch, projects },
        });
        if (error) throw error;
        const cls = (data as any)?.classifications || [];
        cls.forEach((c: any) => {
          const idx = i + (c.index - 1);
          if (updated[idx]) {
            updated[idx].kind = c.kind || updated[idx].kind;
            if (c.project_name) updated[idx].project_name = c.project_name;
          }
        });
      }
      setRows(updated);
      toast.success("تم التصنيف الذكي لكل الصفوف");
    } catch (e: any) {
      console.error(e);
      toast.error("تعذّر التصنيف الذكي: " + (e.message || ""));
    } finally {
      setClassifying(false);
    }
  };

  const saveAll = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = rows.map((r) => ({
      organization_id: orgId,
      expense_date: r.expense_date || new Date().toISOString().slice(0, 10),
      amount: r.amount,
      description: r.description,
      vendor: r.vendor || null,
      kind: r.kind,
      project_name: r.kind === "project" ? (r.project_name || null) : null,
      auto_classified: true,
      created_by: u.user?.id || null,
    }));
    const { error } = await supabase.from("expenses" as any).insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ: " + error.message);
    } else {
      toast.success(`تم استيراد ${payload.length} مصروف وتوزيعها على التبرعات`);
      onDone();
    }
  };

  const updateRow = (idx: number, patch: Partial<PreviewRow>) => {
    const next = [...rows];
    next[idx] = { ...next[idx], ...patch };
    setRows(next);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<FileSpreadsheet />}
        title="استيراد مصروفات من Excel"
        subtitle="ارفع الملف، راجع التصنيف الذكي، ثم احفظ — التوزيع على التبرعات يتم تلقائياً"
        actions={
          <Button onClick={onDone} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10">
            <label className="flex flex-col items-center gap-4 border-2 border-dashed border-primary/40 rounded-2xl p-12 cursor-pointer hover:bg-primary/5 transition">
              <FileSpreadsheet className="h-16 w-16 text-primary/60" />
              <div className="text-center">
                <div className="font-bold text-lg">اسحب ملف Excel هنا أو اضغط للاختيار</div>
                <div className="text-sm text-muted-foreground mt-1">
                  الأعمدة المتوقعة: التاريخ، الوصف، المبلغ، المورد (اختياري)، المشروع (اختياري)
                </div>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
              />
              <Button type="button" onClick={(e) => { e.preventDefault(); (e.currentTarget.previousSibling as HTMLInputElement)?.click(); }}>
                اختيار ملف
              </Button>
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{file?.name} — {rows.length} صف</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setFile(null); setRows([]); }}>
                    إعادة رفع
                  </Button>
                  <Button variant="outline" size="sm" onClick={classifyAll} disabled={classifying}>
                    {classifying ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
                    تصنيف ذكي بالـAI
                  </Button>
                  <Button size="sm" onClick={saveAll} disabled={saving}>
                    <Save className="ml-2 h-4 w-4" />
                    {saving ? "جارٍ الحفظ…" : `حفظ ${rows.length} مصروف`}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الوصف</TableHead>
                      <TableHead className="text-right">المورد</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">التصنيف</TableHead>
                      <TableHead className="text-right">المشروع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{r.expense_date || "—"}</TableCell>
                        <TableCell className="text-sm">{r.description}</TableCell>
                        <TableCell className="text-sm">{r.vendor || "—"}</TableCell>
                        <TableCell className="font-bold">{fmtSAR(r.amount)}</TableCell>
                        <TableCell>
                          <Select value={r.kind} onValueChange={(v) => updateRow(idx, { kind: v as Kind })}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="project">مشروع</SelectItem>
                              <SelectItem value="marketing">تسويق</SelectItem>
                              <SelectItem value="operational">تشغيلي</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {r.kind === "project" ? (
                            <Input
                              list="proj-import-list"
                              value={r.project_name || ""}
                              onChange={(e) => updateRow(idx, { project_name: e.target.value })}
                              className="h-8 w-44"
                              placeholder="اسم المشروع"
                            />
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <datalist id="proj-import-list">
                  {projects.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Smart Reports View ---------- */
function SmartReportsView({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [buildingId, setBuildingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("smart_report_suggestions" as any)
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("priority", { ascending: false });
    setItems(((data as any) || []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("suggest-finance-reports", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      toast.success("تم توليد اقتراحات تقارير جديدة");
      await load();
    } catch (e: any) {
      toast.error("تعذّر التوليد: " + (e.message || ""));
    } finally {
      setGenerating(false);
    }
  };

  const buildReport = async (suggestion: any) => {
    setBuildingId(suggestion.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-smart-report", {
        body: { suggestion_id: suggestion.id, organization_id: orgId },
      });
      if (error) throw error;
      if (!data?.report) throw new Error("empty");
      await exportSmartReportPdf(data as any);
      toast.success("تم إنشاء التقرير");
    } catch (e: any) {
      toast.error("تعذّر إنشاء التقرير: " + (e.message || ""));
    } finally {
      setBuildingId(null);
    }
  };

  const CATEGORY_COLORS: Record<string, string> = {
    donor: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30",
    executive: "from-primary/10 to-primary/5 border-primary/30",
    project: "from-sky-500/10 to-sky-500/5 border-sky-500/30",
    marketing: "from-amber-500/10 to-amber-500/5 border-amber-500/30",
    operational: "from-violet-500/10 to-violet-500/5 border-violet-500/30",
  };
  const CATEGORY_LABEL: Record<string, string> = {
    donor: "للمتبرعين", executive: "تنفيذي", project: "مشاريع", marketing: "تسويق", operational: "تشغيلي",
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Lightbulb />}
        title="تقارير ذكية مقترحة"
        subtitle="يحلل النظام بياناتك ويقترح التقارير الأنسب لتعزيز ثقة المتبرعين وكفاءة الجمعية"
        actions={
          <div className="flex gap-2">
            <Button onClick={generate} disabled={generating} size="sm" className="bg-white text-primary hover:bg-white/90">
              {generating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="ml-2 h-4 w-4" />}
              توليد اقتراحات جديدة
            </Button>
            <Button onClick={onBack} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
              <ArrowRight className="ml-2 h-4 w-4" /> رجوع
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">جارٍ التحميل…</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Lightbulb className="mx-auto h-16 w-16 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">لا توجد اقتراحات بعد. اضغط "توليد اقتراحات جديدة" لتحليل بيانات الجمعية.</p>
            <Button className="mt-4" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
              ابدأ التوليد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => (
            <Card key={s.id} className={cn("bg-gradient-to-br border-2", CATEGORY_COLORS[s.category] || "")}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base font-bold leading-6">{s.title}</CardTitle>
                  <Badge variant="outline" className="flex-shrink-0">{CATEGORY_LABEL[s.category] || s.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground/80">{s.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <div><span className="text-muted-foreground">الجمهور: </span><span className="font-medium">{s.audience}</span></div>
                </div>
                <div className="text-xs"><span className="text-muted-foreground">الفائدة: </span>{s.benefit}</div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> أولوية {s.priority}/10
                  </div>
                  <Button size="sm" variant="outline" disabled={buildingId === s.id} onClick={() => buildReport(s)}>
                    {buildingId === s.id ? <Loader2 className="ml-2 h-3 w-3 animate-spin" /> : <FileText className="ml-2 h-3 w-3" />}
                    إنشاء التقرير PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- External Sources View ---------- */
function ExternalSourcesView({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("website");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("org_external_sources" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setSources(((data as any) || []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const addSource = async () => {
    if (!newUrl.trim()) { toast.error("الرابط مطلوب"); return; }
    setAdding(true);
    const { error } = await supabase.from("org_external_sources" as any).insert({
      organization_id: orgId,
      kind: newKind,
      url: newUrl.trim(),
      label: newLabel.trim() || null,
    } as any);
    setAdding(false);
    if (error) toast.error("تعذّر الإضافة"); else { toast.success("تمت الإضافة"); setNewUrl(""); setNewLabel(""); load(); }
  };

  const sync = async (id: string) => {
    setSyncingId(id);
    try {
      const { error } = await supabase.functions.invoke("sync-external-source", { body: { source_id: id } });
      if (error) throw error;
      toast.success("تمت المزامنة وتم استخراج المحتوى");
      load();
    } catch (e: any) {
      toast.error("تعذّرت المزامنة: " + (e.message || ""));
    } finally {
      setSyncingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذا المصدر؟")) return;
    const { error } = await supabase.from("org_external_sources" as any).delete().eq("id", id);
    if (error) toast.error("تعذّر الحذف"); else { toast.success("تم الحذف"); load(); }
  };

  const KIND_LABEL: Record<string, string> = {
    website: "الموقع الإلكتروني", twitter: "تويتر/X", instagram: "إنستجرام",
    facebook: "فيسبوك", linkedin: "لينكدإن", youtube: "يوتيوب", tiktok: "تيك توك",
  };

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        icon={<Globe />}
        title="المصادر الخارجية للجمعية"
        subtitle="أضف موقع الجمعية وحساباتها، والنظام يستخرج الأخبار والفعاليات تلقائياً لإثراء التقارير"
        actions={
          <Button onClick={onBack} variant="secondary" size="sm" className="bg-white/15 text-white hover:bg-white/25 border-0">
            <ArrowRight className="ml-2 h-4 w-4" /> رجوع
          </Button>
        }
      />
      <Card>
        <CardHeader><CardTitle>إضافة مصدر جديد</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={newKind} onValueChange={setNewKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="الرابط (https://...)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="md:col-span-2" />
            <div className="flex gap-2">
              <Input placeholder="تسمية (اختياري)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Button onClick={addSource} disabled={adding}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            يدعم النظام الآن مزامنة الموقع الإلكتروني وحسابات السوشيال العامة (تويتر/X، إنستجرام، فيسبوك، لينكدإن، يوتيوب، تيك توك). تأكد أن الصفحة عامة بدون تسجيل دخول.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>المصادر المسجلة ({sources.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
          ) : sources.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">لا توجد مصادر بعد.</div>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge>{KIND_LABEL[s.kind] || s.kind}</Badge>
                      <span className="font-medium truncate">{s.label || s.url}</span>
                    </div>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block mt-1">{s.url}</a>
                    {s.last_synced_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        آخر مزامنة: {new Date(s.last_synced_at).toLocaleString("ar-SA-u-nu-latn")} {s.last_status && <span>· {s.last_status}</span>}
                      </div>
                    )}
                    {s.summary && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.summary}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => sync(s.id)} disabled={syncingId === s.id}>
                      {syncingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}