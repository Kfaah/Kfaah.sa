import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sparkles, Loader2, ArrowLeft, ArrowRight, CheckCircle2, X,
  Target, Users, MessageCircle, Wand2, Rocket, Heart, RefreshCw, UserPlus, Calendar as CalendarIcon, Megaphone, Globe, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

type Goal = {
  key: string;
  title: string;
  desc: string;
  icon: any;
  hint: string;
};

const GOALS: Goal[] = [
  { key: "donations",   title: "جمع تبرعات",        desc: "زيادة التبرعات لمشروع أو هدف محدد",     icon: Heart,    hint: "مناسبة لإطلاق مشروع أو حملة موسمية" },
  { key: "awareness",   title: "نشر الوعي",         desc: "تعريف الجمهور برسالة الجمعية وأثرها",   icon: Megaphone, hint: "قبل المواسم أو لزيادة المتابعين" },
  { key: "reactivate",  title: "استرجاع المنقطعين",  desc: "استعادة المتبرعين الذين توقفوا",        icon: RefreshCw, hint: "نتائجها سريعة وتكلفتها منخفضة" },
  { key: "acquire",     title: "جذب متبرعين جدد",   desc: "بناء قاعدة متبرعين جديدة",              icon: UserPlus,  hint: "تحتاج محتوى قوي وميزانية إعلانية" },
  { key: "seasonal",    title: "حملة موسمية",       desc: "استثمار موسم ديني أو وطني قادم",        icon: CalendarIcon, hint: "أعلى استجابة في رمضان وذي الحجة" },
];

type Suggestion = any;

export default function CampaignWizard({
  orgId, onClose, onCreated,
}: { orgId: string; onClose: () => void; onCreated: (campaignId: string) => void }) {
  const [step, setStep] = useState(1);
  const [goalKey, setGoalKey] = useState<string>("");
  const [extraNote, setExtraNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [coldStart, setColdStart] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [answers, setAnswers] = useState({
    website_url: "",
    store_url: "",
    org_focus: "",
    main_projects: "",
    target_audience: "",
    unique_value: "",
    available_channels: "",
  });
  const [sourcesUsed, setSourcesUsed] = useState<any>(null);

  // On mount: detect cold-start by checking if org has any data
  useState(() => {
    (async () => {
      const [d, p, c, prof] = await Promise.all([
        supabase.from("donors").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("marketing_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("organization_profiles").select("website_url, store_url").eq("organization_id", orgId).maybeSingle(),
      ]);
      const hasData = (d.count ?? 0) > 0 || (p.count ?? 0) > 0 || (c.count ?? 0) > 0;
      setColdStart(!hasData);
      if (prof.data) {
        setAnswers((a) => ({ ...a, website_url: prof.data?.website_url ?? "", store_url: prof.data?.store_url ?? "" }));
      }
      setChecking(false);
    })();
    return () => {};
  });

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const generate = async () => {
    setGenerating(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-suggest-campaigns", {
        body: {
          organization_id: orgId,
          goal_key: goalKey,
          extra_note: extraNote,
          wizard_answers: coldStart ? answers : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list = data?.campaigns ?? [];
      setSuggestions(list);
      setSourcesUsed(data?.sources_used ?? null);
      if (list.length === 0) toast.error("لم يتم اقتراح أي حملة، حاول مرة أخرى");
      else { setStep(coldStart ? 4 : 3); }
    } catch (e: any) {
      toast.error(`فشل التوليد: ${e.message ?? e}`);
    } finally {
      setGenerating(false);
    }
  };

  const confirmAndSave = async () => {
    if (!selected) return;
    setSaving(true);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (selected.duration_days ?? 30));
    const { data, error } = await supabase.from("marketing_campaigns").insert({
      organization_id: orgId,
      name: selected.name,
      goal: selected.goal,
      audience_segment: selected.audience_segment,
      season_key: selected.season_key ?? null,
      related_project: selected.related_project ?? null,
      primary_message: selected.primary_message,
      content_angles: selected.content_angles ?? [],
      platforms: selected.platforms ?? [],
      budget_planned: selected.budget_planned ?? 0,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      expected_kpis: selected.expected_kpis ?? {},
      status: "planned",
      ai_generated: true,
      ai_metadata: {
        drafts: selected.drafts ?? {},
        design_brief: selected.design_brief ?? "",
        rationale: selected.rationale ?? "",
        wizard_goal: goalKey,
        wizard_note: extraNote,
      },
    }).select("id").maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error("فشل الحفظ"); return; }
    toast.success(`تم إطلاق حملة: ${selected.name}`);
    onCreated(data.id);
  };

  const stepTitlesNormal = ["", "ماذا تريد أن تحقق؟", "تحليل ذكي", "اختر حملتك", "راجع التفاصيل", "جاهز للإطلاق"];
  const stepTitlesCold = ["", "ماذا تريد أن تحقق؟", "أخبرنا عن جمعيتك", "تحليل ذكي", "اختر حملتك", "راجع التفاصيل", "جاهز للإطلاق"];
  const stepTitles = coldStart ? stepTitlesCold : stepTitlesNormal;
  const totalSteps = coldStart ? 6 : 5;

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">جاري تجهيز المعالج...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="container max-w-5xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5 text-primary"><Wand2 className="h-5 w-5" /></div>
            <div>
              <h1 className="text-lg font-bold">المعالج الذكي للحملات</h1>
              <p className="text-xs text-muted-foreground">{stepTitles[step]} · الخطوة {step} من {totalSteps}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* STEP 1: Choose goal */}
        {step === 1 && (
          <div className="space-y-5">
            {coldStart && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">جمعية جديدة بدون بيانات سابقة؟ لا مشكلة!</p>
                  <p className="text-muted-foreground mt-0.5">سنبني حملاتك من معرفتنا بجمعيتك (موقعك ومنصاتك) + إجابات بسيطة منك. لنبدأ معًا.</p>
                </div>
              </div>
            )}
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">ما هدفك من هذه الحملة؟</h2>
              <p className="text-sm text-muted-foreground">اختر الهدف الذي يصف ما تريد تحقيقه — والذكاء سيتولى الباقي</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {GOALS.map((g) => {
                const Icon = g.icon;
                const active = goalKey === g.key;
                return (
                  <button
                    key={g.key}
                    onClick={() => setGoalKey(g.key)}
                    className={`text-right rounded-xl border-2 p-4 transition-all hover:border-primary/60 hover:shadow-md ${active ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2.5 shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{g.title}</h3>
                          {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
                        <p className="text-[11px] text-primary/80 mt-2">💡 {g.hint}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-sm">ملاحظة إضافية (اختياري)</Label>
              <Textarea
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="مثال: نريد التركيز على مشروع كفالة الأيتام، أو لدينا ميزانية محدودة..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              {coldStart ? (
                <Button onClick={goNext} disabled={!goalKey} className="gap-2">
                  التالي: أخبرنا عن جمعيتك <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => { goNext(); generate(); }} disabled={!goalKey} className="gap-2">
                  ابدأ التحليل الذكي <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* COLD-START STEP 2: Guided questions */}
        {step === 2 && coldStart && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">عرّفنا على جمعيتك</h2>
              <p className="text-sm text-muted-foreground">إجاباتك تساعد الذكاء على بناء حملة تشبه جمعيتك تمامًا — كلها اختيارية لكن كلما زادت كلما تحسّنت الحملة</p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1"><Globe className="h-3.5 w-3.5" />موقع الجمعية الإلكتروني</Label>
                  <Input
                    type="url"
                    placeholder="https://example.org"
                    value={answers.website_url}
                    onChange={(e) => setAnswers({ ...answers, website_url: e.target.value })}
                  />
                  <p className="text-[11px] text-muted-foreground">سنقرأه لفهم رسالتك ومشاريعك تلقائيًا</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">رابط المتجر/التبرع (إن وجد)</Label>
                  <Input
                    type="url"
                    placeholder="https://store.example.org"
                    value={answers.store_url}
                    onChange={(e) => setAnswers({ ...answers, store_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">ما المجال الرئيسي الذي تعمل فيه الجمعية؟</Label>
                <Input
                  placeholder="مثال: كفالة الأيتام، إفطار صائم، علاج المرضى، التعليم..."
                  value={answers.org_focus}
                  onChange={(e) => setAnswers({ ...answers, org_focus: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">أبرز 2-3 مشاريع تقدّمونها حاليًا</Label>
                <Textarea
                  rows={2}
                  placeholder="مثال: مشروع كفالة يتيم، توزيع وجبات إفطار، حقيبة الطالب..."
                  value={answers.main_projects}
                  onChange={(e) => setAnswers({ ...answers, main_projects: e.target.value })}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm">من هو متبرعكم المثالي؟</Label>
                  <Input
                    placeholder="مثال: عائلات سعودية 30-50 سنة، رجال أعمال..."
                    value={answers.target_audience}
                    onChange={(e) => setAnswers({ ...answers, target_audience: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">القنوات المتاحة لديكم</Label>
                  <Input
                    placeholder="مثال: واتساب، تويتر، إنستغرام، إيميل"
                    value={answers.available_channels}
                    onChange={(e) => setAnswers({ ...answers, available_channels: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">ما الذي يميّز جمعيتكم عن غيرها؟</Label>
                <Textarea
                  rows={2}
                  placeholder="مثال: شفافية كاملة، أثر موثّق، فريق متخصص، تغطية مناطق نائية..."
                  value={answers.unique_value}
                  onChange={(e) => setAnswers({ ...answers, unique_value: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-3">
              <Button variant="ghost" onClick={goBack} className="gap-2"><ArrowRight className="h-4 w-4" /> رجوع</Button>
              <Button onClick={() => { goNext(); generate(); }} className="gap-2">
                <Sparkles className="h-4 w-4" /> ابدأ التحليل الذكي
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 (normal) / STEP 3 (cold): AI thinking */}
        {((step === 2 && !coldStart) || (step === 3 && coldStart)) && (
          <div className="py-20 text-center space-y-6">
            <div className="relative inline-flex">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative rounded-full bg-primary/15 p-6 text-primary">
                <Sparkles className="h-10 w-10" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">يحلل الذكاء بياناتك الآن...</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {coldStart
                  ? "نقرأ موقعكم ومنصاتكم وإجاباتكم لبناء حملة تشبه جمعيتكم تمامًا"
                  : "نقرأ المتبرعين، التبرعات، المشاريع، والمواسم القادمة لاقتراح أفضل حملة لك"}
              </p>
            </div>
            {!generating && suggestions.length === 0 && (
              <Button variant="outline" onClick={generate}><RefreshCw className="h-4 w-4 ml-2" />إعادة المحاولة</Button>
            )}
          </div>
        )}

        {/* STEP 3 (normal) / STEP 4 (cold): Choose suggestion */}
        {((step === 3 && !coldStart) || (step === 4 && coldStart)) && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">اختر الحملة الأنسب لك</h2>
              <p className="text-sm text-muted-foreground">{suggestions.length} حملة مقترحة بناءً على بياناتك الفعلية</p>
              {sourcesUsed && (
                <div className="flex flex-wrap justify-center gap-1 pt-1">
                  {sourcesUsed.website && <Badge variant="outline" className="text-[10px]">📄 من الموقع</Badge>}
                  {sourcesUsed.store && <Badge variant="outline" className="text-[10px]">🛒 من المتجر</Badge>}
                  {sourcesUsed.donor_data && <Badge variant="outline" className="text-[10px]">👥 من بيانات المتبرعين</Badge>}
                  {sourcesUsed.projects && <Badge variant="outline" className="text-[10px]">📂 من المشاريع</Badge>}
                  {sourcesUsed.employee_answers && <Badge variant="outline" className="text-[10px]">💬 من إجاباتك</Badge>}
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {suggestions.map((s, i) => {
                const active = selected === s;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(s)}
                    className={`text-right rounded-xl border-2 p-4 transition-all hover:shadow-md ${active ? "border-primary bg-primary/5 shadow-lg" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold">{s.name}</h3>
                      {active && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{s.goal}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 ml-1" />{s.audience_segment}</Badge>
                      {s.budget_planned ? <Badge variant="outline" className="text-[10px]">{s.budget_planned} ر.س</Badge> : null}
                      {s.duration_days ? <Badge variant="outline" className="text-[10px]">{s.duration_days} يوم</Badge> : null}
                    </div>
                    {s.expected_kpis?.donations_amount && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        🎯 متوقع: {s.expected_kpis.donations_amount.toLocaleString()} ر.س تبرعات
                      </p>
                    )}
                    {s.rationale && (
                      <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed border-r-2 border-primary/30 pr-2">
                        لماذا الآن: {s.rationale}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 pt-3">
              <Button variant="ghost" onClick={() => { setStep(coldStart ? 2 : 1); setSuggestions([]); setSelected(null); }} className="gap-2">
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
              <Button onClick={goNext} disabled={!selected} className="gap-2">
                راجع التفاصيل <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4 (normal) / STEP 5 (cold): Review */}
        {((step === 4 && !coldStart) || (step === 5 && coldStart)) && selected && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-bold">راجع تفاصيل حملتك</h2>
              <p className="text-sm text-muted-foreground">يمكنك تعديل أي شيء قبل الإطلاق</p>
            </div>
            <Card className="border-primary/30">
              <CardContent className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">اسم الحملة</Label>
                    <Input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">الميزانية (ر.س)</Label>
                    <Input type="number" value={selected.budget_planned ?? 0} onChange={(e) => setSelected({ ...selected, budget_planned: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">الهدف</Label>
                  <Textarea value={selected.goal ?? ""} onChange={(e) => setSelected({ ...selected, goal: e.target.value })} rows={2} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground"><MessageCircle className="inline h-3 w-3 ml-1" />الرسالة الرئيسية</Label>
                  <Textarea value={selected.primary_message ?? ""} onChange={(e) => setSelected({ ...selected, primary_message: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground"><Target className="inline h-3 w-3 ml-1" />القنوات</Label>
                  <div className="flex flex-wrap gap-1">
                    {(selected.platforms ?? []).map((p: string) => (
                      <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
                {selected.content_angles?.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">زوايا المحتوى</Label>
                    <ul className="text-xs space-y-1 pr-4 list-disc">
                      {selected.content_angles.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-between gap-2 pt-3">
              <Button variant="ghost" onClick={goBack} className="gap-2"><ArrowRight className="h-4 w-4" /> رجوع</Button>
              <Button onClick={goNext} className="gap-2">المتابعة <ArrowLeft className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* STEP 5 (normal) / STEP 6 (cold): Launch */}
        {((step === 5 && !coldStart) || (step === 6 && coldStart)) && selected && (
          <div className="space-y-5">
            <div className="text-center space-y-2 py-4">
              <div className="inline-flex rounded-full bg-emerald-500/15 p-4 text-emerald-600 dark:text-emerald-400">
                <Rocket className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold">جاهز للإطلاق! 🚀</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                بمجرد الإطلاق، سنولّد لك تلقائيًا: محتوى لكل قناة، بريف تصميم، سكربت فيديو، ومهام جاهزة لفريقك
              </p>
            </div>
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">الحملة:</span><span className="font-semibold">{selected.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الجمهور:</span><span>{selected.audience_segment}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">القنوات:</span><span>{(selected.platforms ?? []).length} قناة</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الميزانية:</span><span>{selected.budget_planned ?? 0} ر.س</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المدة:</span><span>{selected.duration_days ?? 30} يوم</span></div>
              </CardContent>
            </Card>
            <div className="flex justify-between gap-2 pt-3">
              <Button variant="ghost" onClick={goBack} className="gap-2"><ArrowRight className="h-4 w-4" /> تعديل</Button>
              <Button onClick={confirmAndSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {saving ? "جاري الإطلاق..." : "أطلق الحملة الآن"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}