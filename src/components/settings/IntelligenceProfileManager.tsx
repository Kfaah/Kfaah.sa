import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";

type StepKey = "skills" | "personality" | "goals" | "availability";

interface Question {
  id: string;
  organization_id: string | null;
  step_key: StepKey;
  question_key: string;
  data_field: string;
  question_type: "chips" | "radio" | "text" | "textarea" | "number";
  label: string;
  placeholder: string | null;
  helper_text: string | null;
  display_order: number;
  is_active: boolean;
}

interface Option {
  id: string;
  question_id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

const STEP_LABELS: Record<StepKey, string> = {
  skills: "🏆 المهارات والخبرات",
  personality: "🧠 النمط الشخصي",
  goals: "🎯 الأهداف والتوجهات",
  availability: "⏰ التوفر والقدرة",
};

const STEP_ORDER: StepKey[] = ["skills", "personality", "goals", "availability"];

export function IntelligenceProfileManager() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [optionsByQ, setOptionsByQ] = useState<Record<string, Option[]>>({});
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [newOptionByQ, setNewOptionByQ] = useState<Record<string, string>>({});

  const orgId = currentOrg?.id ?? null;

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user, orgId]);

  async function loadAll() {
    setLoading(true);
    try {
      // نجلب أسئلة الجمعية + الافتراضية، ونفضّل أسئلة الجمعية إذا كان نفس question_key
      const { data: qs, error } = await supabase
        .from("intelligence_profile_questions")
        .select("*")
        .or(orgId ? `organization_id.eq.${orgId},organization_id.is.null` : `organization_id.is.null`)
        .order("step_key", { ascending: true })
        .order("display_order", { ascending: true });
      if (error) throw error;

      // dedupe: لكل question_key نأخذ نسخة الجمعية إن وُجدت
      const map = new Map<string, Question>();
      (qs ?? []).forEach((q: any) => {
        const existing = map.get(q.question_key);
        if (!existing || (q.organization_id && !existing.organization_id)) {
          map.set(q.question_key, q as Question);
        }
      });
      const finalQs = Array.from(map.values()).sort(
        (a, b) =>
          STEP_ORDER.indexOf(a.step_key) - STEP_ORDER.indexOf(b.step_key) ||
          a.display_order - b.display_order,
      );
      setQuestions(finalQs);

      // جلب الخيارات لكل سؤال
      const ids = finalQs.map((q) => q.id);
      if (ids.length === 0) {
        setOptionsByQ({});
      } else {
        const { data: opts } = await supabase
          .from("intelligence_profile_options")
          .select("*")
          .in("question_id", ids)
          .order("display_order", { ascending: true });
        const grouped: Record<string, Option[]> = {};
        (opts ?? []).forEach((o: any) => {
          (grouped[o.question_id] ||= []).push(o as Option);
        });
        setOptionsByQ(grouped);
      }
    } catch (e: any) {
      toast.error(e.message ?? "تعذر تحميل الأسئلة");
    } finally {
      setLoading(false);
    }
  }

  /** نسخ سؤال افتراضي إلى نسخة خاصة بالجمعية قبل التعديل */
  async function ensureOrgCopy(q: Question): Promise<Question> {
    if (q.organization_id) return q;
    if (!orgId) throw new Error("لا توجد جمعية حالية");
    const { data, error } = await supabase
      .from("intelligence_profile_questions")
      .insert({
        organization_id: orgId,
        step_key: q.step_key,
        question_key: q.question_key,
        data_field: q.data_field,
        question_type: q.question_type,
        label: q.label,
        placeholder: q.placeholder,
        helper_text: q.helper_text,
        display_order: q.display_order,
        is_active: q.is_active,
      })
      .select()
      .single();
    if (error) throw error;
    // نسخ الخيارات
    const sourceOpts = optionsByQ[q.id] ?? [];
    if (sourceOpts.length > 0) {
      await supabase.from("intelligence_profile_options").insert(
        sourceOpts.map((o) => ({
          question_id: data.id,
          value: o.value,
          label: o.label,
          display_order: o.display_order,
          is_active: o.is_active,
        })),
      );
    }
    return data as Question;
  }

  async function toggleQuestion(q: Question, active: boolean) {
    try {
      const target = await ensureOrgCopy(q);
      const { error } = await supabase
        .from("intelligence_profile_questions")
        .update({ is_active: active })
        .eq("id", target.id);
      if (error) throw error;
      toast.success(active ? "تم تفعيل السؤال" : "تم إخفاء السؤال");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر التحديث");
    }
  }

  async function saveLabel(q: Question) {
    if (!labelDraft.trim()) return;
    try {
      const target = await ensureOrgCopy(q);
      const { error } = await supabase
        .from("intelligence_profile_questions")
        .update({ label: labelDraft.trim() })
        .eq("id", target.id);
      if (error) throw error;
      toast.success("تم حفظ النص");
      setEditingLabelId(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الحفظ");
    }
  }

  async function toggleOption(q: Question, opt: Option, active: boolean) {
    try {
      const target = await ensureOrgCopy(q);
      // إذا أصبح السؤال نسخة جديدة، نحتاج إيجاد الخيار المقابل بالقيمة
      const targetOpts = optionsByQ[target.id] ?? optionsByQ[q.id];
      const targetOpt = targetOpts.find((o) => o.value === opt.value) ?? opt;
      const { error } = await supabase
        .from("intelligence_profile_options")
        .update({ is_active: active })
        .eq("id", targetOpt.id);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر التحديث");
    }
  }

  async function deleteOption(q: Question, opt: Option) {
    const ok = await confirm({
      title: "حذف الخيار",
      description: `سيتم حذف الخيار "${opt.label}" نهائياً. لا يمكن التراجع.`,
      confirmText: "نعم، احذف",
      variant: "danger",
    });
    if (!ok) return;
    try {
      const target = await ensureOrgCopy(q);
      const targetOpts = optionsByQ[target.id] ?? optionsByQ[q.id];
      const targetOpt = targetOpts.find((o) => o.value === opt.value) ?? opt;
      const { error } = await supabase
        .from("intelligence_profile_options")
        .delete()
        .eq("id", targetOpt.id);
      if (error) throw error;
      toast.success("تم الحذف");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الحذف");
    }
  }

  async function addOption(q: Question) {
    const draft = (newOptionByQ[q.id] ?? "").trim();
    if (!draft) {
      toast.error("اكتب اسم الخيار");
      return;
    }
    try {
      const target = await ensureOrgCopy(q);
      const existing = optionsByQ[target.id] ?? optionsByQ[q.id] ?? [];
      const maxOrder = existing.reduce((m, o) => Math.max(m, o.display_order), 0);
      const { error } = await supabase.from("intelligence_profile_options").insert({
        question_id: target.id,
        value: draft,
        label: draft,
        display_order: maxOrder + 1,
        is_active: true,
      });
      if (error) throw error;
      toast.success("تمت إضافة الخيار");
      setNewOptionByQ((prev) => ({ ...prev, [q.id]: "" }));
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الإضافة");
    }
  }

  async function resetToDefault(q: Question) {
    if (!q.organization_id) return;
    const ok = await confirm({
      title: "استعادة الإعدادات الافتراضية",
      description: "سيتم حذف جميع تخصيصاتك لهذا السؤال والعودة إلى الإعدادات الافتراضية.",
      confirmText: "نعم، استعد",
      variant: "warning",
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("intelligence_profile_questions")
        .delete()
        .eq("id", q.id);
      if (error) throw error;
      toast.success("تم الاسترجاع");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "تعذّر الاسترجاع");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const groupedByStep: Record<StepKey, Question[]> = {
    skills: [], personality: [], goals: [], availability: [],
  };
  questions.forEach((q) => groupedByStep[q.step_key]?.push(q));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-foreground">
        💡 يمكنك تفعيل/إخفاء أي سؤال أو خيار، أو تعديل نصوصه، أو إضافة خيارات جديدة.
        التعديلات تُطبَّق على جمعيتك فقط.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {STEP_ORDER.map((s) => (
          <div key={s} className="rounded-md border bg-muted/30 px-3 py-2 text-center">
            <div className="font-semibold">{STEP_LABELS[s]}</div>
            <div className="text-muted-foreground mt-0.5">{groupedByStep[s].length} سؤال</div>
          </div>
        ))}
      </div>
      <Tabs defaultValue="skills" dir="rtl">
        <TabsList className="grid grid-cols-4 w-full">
          {STEP_ORDER.map((s) => (
            <TabsTrigger key={s} value={s} className="text-xs md:text-sm">
              {STEP_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>

        {STEP_ORDER.map((step) => (
          <TabsContent key={step} value={step} className="space-y-3 mt-4">
            {groupedByStep[step].length === 0 && (
              <div className="text-center text-muted-foreground py-8">لا توجد أسئلة في هذه الخطوة</div>
            )}
            {groupedByStep[step].map((q) => {
              const opts = optionsByQ[q.id] ?? [];
              const hasOptions = q.question_type === "chips" || q.question_type === "radio";
              return (
                <Card key={q.id} className={!q.is_active ? "opacity-60" : ""}>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-3">
                      <Switch checked={q.is_active} onCheckedChange={(v) => toggleQuestion(q, v)} />
                      <div className="flex-1 min-w-0">
                        {editingLabelId === q.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={labelDraft}
                              onChange={(e) => setLabelDraft(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveLabel(q);
                                if (e.key === "Escape") setEditingLabelId(null);
                              }}
                            />
                            <Button size="icon" variant="ghost" onClick={() => saveLabel(q)}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingLabelId(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-semibold">{q.label}</CardTitle>
                            <button
                              onClick={() => {
                                setEditingLabelId(q.id);
                                setLabelDraft(q.label);
                              }}
                              className="text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <Badge variant="outline" className="text-[10px]">
                              {q.question_type === "chips" ? "اختيار متعدد" :
                                q.question_type === "radio" ? "خيار واحد" :
                                  q.question_type === "number" ? "رقم" :
                                    q.question_type === "textarea" ? "نص طويل" : "نص"}
                            </Badge>
                            {hasOptions && (
                              <Badge variant="secondary" className="text-[10px]">
                                {opts.length} خيار
                              </Badge>
                            )}
                            {q.organization_id && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">مخصّص</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {q.organization_id && (
                        <Button size="sm" variant="ghost" onClick={() => resetToDefault(q)} title="استعادة الافتراضي">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {q.helper_text && (
                      <div className="text-xs text-muted-foreground mt-1 pr-12">{q.helper_text}</div>
                    )}
                  </CardHeader>
                  {hasOptions && (
                    <CardContent className="pt-0 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {opts.map((o) => (
                          <div key={o.id} className={`flex items-center gap-2 rounded border p-2 ${!o.is_active ? "opacity-50" : ""}`}>
                            <Switch checked={o.is_active} onCheckedChange={(v) => toggleOption(q, o, v)} />
                            <span className="flex-1 text-sm">{o.label}</span>
                            <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => deleteOption(q, o)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        {opts.length === 0 && (
                          <div className="col-span-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            ⚠️ لا توجد خيارات بعد — أضف الخيارات حتى يستطيع الموظف الاختيار.
                          </div>
                        )}
                      </div>
                      <div className="flex items-end gap-2 border-t pt-3">
                        <div className="flex-1">
                          <Label className="text-xs">إضافة خيار جديد</Label>
                          <Input
                            placeholder="نص الخيار كما يراه الموظف"
                            value={newOptionByQ[q.id] ?? ""}
                            onChange={(e) =>
                              setNewOptionByQ((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addOption(q);
                            }}
                          />
                        </div>
                        <Button size="sm" onClick={() => addOption(q)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Plus className="w-4 h-4 ml-1" /> إضافة
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}