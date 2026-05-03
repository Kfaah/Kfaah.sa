import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageGuide } from "@/components/layout/PageGuide";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, XCircle, Link2, FileSearch, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface AQ {
  id: string;
  title: string;
  question_text: string;
  category: string;
  priority: string;
  status: string;
  expected_evidence: string | null;
  context: string | null;
  evidence_url: string | null;
  evidence_notes: string | null;
  evidence_score: number | null;
  evidence_verdict: string | null;
  evidence_findings: any;
  generated_task_id: string | null;
  created_at: string;
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: "حرجة", high: "عالية", medium: "متوسطة", low: "منخفضة",
};
const VERDICT_LABEL: Record<string, string> = {
  accepted: "مقبول كامل", partial: "مقبول جزئيًا", insufficient: "ناقص", rejected: "مرفوض",
};
const VERDICT_TONE: Record<string, string> = {
  accepted: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  insufficient: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  rejected: "bg-red-500/15 text-red-700 border-red-500/30",
};

export default function MyAccountability() {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      setEmployeeId(emp?.id ?? null);
      if (!emp?.id) { setLoading(false); return; }

      const { data: qs } = await supabase
        .from("accountability_questions")
        .select("*")
        .eq("target_employee_id", emp.id)
        .order("created_at", { ascending: false });
      setQuestions((qs as unknown as AQ[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const open = useMemo(() => questions.filter((q) => q.status === "open"), [questions]);
  const inReview = useMemo(() => questions.filter((q) => q.status === "answered"), [questions]);
  const validated = useMemo(() => questions.filter((q) => q.status === "validated"), [questions]);
  const rejected = useMemo(() => questions.filter((q) => q.status === "rejected"), [questions]);

  const refresh = async () => {
    if (!employeeId) return;
    const { data: qs } = await supabase
      .from("accountability_questions")
      .select("*")
      .eq("target_employee_id", employeeId)
      .order("created_at", { ascending: false });
    setQuestions((qs as unknown as AQ[]) ?? []);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!employeeId) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto mt-20 p-8 text-center bg-card rounded-2xl border">
          <h2 className="text-xl font-bold mb-2">لا يوجد ملف موظف مرتبط بحسابك</h2>
          <p className="text-muted-foreground">تواصل مع مدير النظام لربط حسابك بسجل الموظف.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <PageHeader
          icon={<ShieldAlert className="w-6 h-6" />}
          title="مساءلاتي"
          subtitle="الأسئلة المُولّدة من تحليل الجمعية والموجَّهة إليك. أجب وارفع رابط الإثبات — يفحص النظام صحة الإثبات تلقائيًا."
        />
        <PageGuide
          description="هذه الصفحة تعرض جميع المساءلات الموجَّهة إليك من نظام التحليل الذكي. كل مساءلة تطلب منك إجابة + رابط إثبات (ملف، مستند، تقرير)؛ ويفحص النظام تلقائياً صحة الإثبات ويصنّف المساءلة (مفتوحة، قيد المراجعة، معتمدة، مرفوضة)."
          features={[
            "استلام المساءلات المُولّدة من التحليل الذكي",
            "إرفاق إجابة ورابط إثبات لكل مساءلة",
            "فحص آلي لصحة الإثبات بالذكاء الاصطناعي",
            "متابعة حالة كل مساءلة بشكل مرئي",
            "أرشيف كامل للمساءلات السابقة",
          ]}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="مفتوحة" value={open.length} tone="amber" icon={<ShieldAlert className="w-4 h-4" />} />
          <KpiCard label="قيد المراجعة" value={inReview.length} tone="blue" icon={<FileSearch className="w-4 h-4" />} />
          <KpiCard label="مُعتمدة" value={validated.length} tone="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
          <KpiCard label="مرفوضة" value={rejected.length} tone="red" icon={<XCircle className="w-4 h-4" />} />
        </div>

        <Tabs defaultValue="open" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="open" className="gap-2"><ShieldAlert className="w-4 h-4" /> المفتوحة ({open.length})</TabsTrigger>
            <TabsTrigger value="review" className="gap-2"><FileSearch className="w-4 h-4" /> قيد المراجعة ({inReview.length})</TabsTrigger>
            <TabsTrigger value="validated" className="gap-2"><CheckCircle2 className="w-4 h-4" /> مُعتمدة ({validated.length})</TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2"><XCircle className="w-4 h-4" /> مرفوضة ({rejected.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-6 space-y-4">
            {open.length === 0 ? <Empty msg="لا توجد مساءلات مفتوحة حاليًا. عمل ممتاز!" /> :
              open.map((q) => <QuestionCard key={q.id} q={q} onSubmitted={refresh} />)}
          </TabsContent>
          <TabsContent value="review" className="mt-6 space-y-4">
            {inReview.length === 0 ? <Empty msg="لا توجد مساءلات قيد المراجعة." /> :
              inReview.map((q) => <QuestionCard key={q.id} q={q} onSubmitted={refresh} readOnly />)}
          </TabsContent>
          <TabsContent value="validated" className="mt-6 space-y-4">
            {validated.length === 0 ? <Empty msg="لا توجد مساءلات معتمدة بعد." /> :
              validated.map((q) => <QuestionCard key={q.id} q={q} onSubmitted={refresh} readOnly />)}
          </TabsContent>
          <TabsContent value="rejected" className="mt-6 space-y-4">
            {rejected.length === 0 ? <Empty msg="لا توجد مساءلات مرفوضة." /> :
              rejected.map((q) => <QuestionCard key={q.id} q={q} onSubmitted={refresh} />)}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "amber"|"blue"|"emerald"|"red" }) {
  const colors = {
    amber: "from-amber-500 to-orange-600",
    blue: "from-sky-500 to-blue-600",
    emerald: "from-emerald-500 to-teal-600",
    red: "from-red-500 to-rose-600",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors} flex items-center justify-center text-white shadow`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">{msg}</CardContent></Card>
  );
}

function QuestionCard({ q, onSubmitted, readOnly = false }: { q: AQ; onSubmitted: () => void; readOnly?: boolean }) {
  const [answer, setAnswer] = useState<"yes" | "no">((q as any).answer_yes_no || "yes");
  const [url, setUrl] = useState(q.evidence_url ?? "");
  const [notes, setNotes] = useState(q.evidence_notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [resultOpen, setResultOpen] = useState(!!q.evidence_verdict);

  const submit = async () => {
    if (!url.trim()) {
      toast.error("رابط الإثبات مطلوب");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("رابط غير صالح");
      return;
    }
    setSubmitting(true);
    toast.loading("جارٍ فحص الإثبات بدقة...", { id: `v-${q.id}` });
    try {
      const { data, error } = await supabase.functions.invoke("verify-evidence", {
        body: { question_id: q.id, evidence_url: url, evidence_notes: notes, answer_yes_no: answer },
      });
      if (error) throw error;
      toast.success(`اكتمل الفحص: ${VERDICT_LABEL[data.verdict] ?? data.verdict} (${data.score}/100)`, { id: `v-${q.id}` });
      setResultOpen(true);
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل الفحص";
      toast.error(msg, { id: `v-${q.id}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={PRIORITY_STYLE[q.priority] ?? ""}>{PRIORITY_LABEL[q.priority] ?? q.priority}</Badge>
            <Badge variant="secondary">{q.category}</Badge>
            {q.evidence_verdict && (
              <Badge variant="outline" className={VERDICT_TONE[q.evidence_verdict]}>
                {VERDICT_LABEL[q.evidence_verdict]} • {q.evidence_score ?? 0}/100
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("ar-SA")}</div>
        </div>
        <CardTitle className="text-lg mt-2">{q.title}</CardTitle>
        <CardDescription className="text-foreground/80 leading-relaxed">{q.question_text}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {q.expected_evidence && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
            <div className="font-semibold text-primary mb-1 flex items-center gap-1"><FileSearch className="w-4 h-4" /> الإثبات المتوقع</div>
            <p className="text-foreground/85">{q.expected_evidence}</p>
          </div>
        )}

        {!readOnly && (
          <div className="space-y-3">
            <div>
              <Label className="mb-2 block">الإجابة</Label>
              <RadioGroup value={answer} onValueChange={(v) => setAnswer(v as "yes"|"no")} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="yes" id={`y-${q.id}`} /><Label htmlFor={`y-${q.id}`}>نعم — أرفع الإثبات</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="no" id={`n-${q.id}`} /><Label htmlFor={`n-${q.id}`}>لا — مع توضيح</Label></div>
              </RadioGroup>
            </div>

            <div>
              <Label className="mb-2 block flex items-center gap-1"><Link2 className="w-4 h-4" /> رابط الإثبات (يتم فحصه تلقائيًا)</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." dir="ltr" />
            </div>

            <div>
              <Label className="mb-2 block">ملاحظات إضافية</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="أي توضيح يساعد الفحص..." />
            </div>

            <Button onClick={submit} disabled={submitting} className="bg-gradient-to-l from-fuchsia-500 to-pink-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Sparkles className="w-4 h-4 ml-2" />}
              {q.evidence_verdict ? "إعادة الفحص" : "إرسال الإثبات للفحص"}
            </Button>
          </div>
        )}

        {q.evidence_verdict && (
          <div className="border-t pt-4 space-y-2">
            <button onClick={() => setResultOpen(!resultOpen)} className="text-sm font-semibold text-primary hover:underline">
              {resultOpen ? "▼" : "◀"} نتائج الفحص التفصيلية
            </button>
            {resultOpen && (
              <div className="bg-muted/40 rounded-lg p-4 space-y-3 text-sm">
                {Array.isArray(q.evidence_findings) && q.evidence_findings.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1 flex items-center gap-1"><ListChecks className="w-4 h-4" /> الملاحظات</div>
                    <ul className="list-disc pr-5 space-y-1">{q.evidence_findings.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
                  </div>
                )}
                {q.generated_task_id && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    تم توليد مهمة تلقائية لاستكمال الإثبات.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}