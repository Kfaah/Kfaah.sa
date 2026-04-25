import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Brain,
  Target,
  Clock,
  Award,
  Loader2,
  X,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";

type StepKey = "skills" | "duties" | "personality" | "goals" | "availability" | "summary";

const STEPS: { key: StepKey; title: string; subtitle: string; icon: any }[] = [
  { key: "skills", title: "مهاراتك وخبراتك", subtitle: "ساعدنا نتعرف على قدراتك التقنية", icon: Award },
  { key: "duties", title: "مهامك الوظيفية", subtitle: "سجّل المهام التي تقوم بها فعلياً ليتعرّف عليها النظام", icon: ListChecks },
  { key: "personality", title: "نمطك الشخصي", subtitle: "كيف تحب أن تعمل؟", icon: Brain },
  { key: "goals", title: "أهدافك وتوجهاتك", subtitle: "ما الذي تطمح إليه؟", icon: Target },
  { key: "availability", title: "توفرك وقدرتك", subtitle: "متى وكيف تعمل بأفضل أداء؟", icon: Clock },
  { key: "summary", title: "المراجعة والحفظ", subtitle: "تأكد من المعلومات قبل الإرسال", icon: Sparkles },
];

interface JobDuty {
  id?: string;
  title: string;
  description: string;
  category: string;
  frequency: "daily" | "weekly" | "monthly" | "adhoc";
  priority: "low" | "medium" | "high";
  estimated_time_minutes: number | null;
}

const NEW_DUTY: JobDuty = {
  title: "",
  description: "",
  category: "",
  frequency: "daily",
  priority: "medium",
  estimated_time_minutes: null,
};

const frequencyLabel: Record<string, string> = {
  daily: "يومية",
  weekly: "أسبوعية",
  monthly: "شهرية",
  adhoc: "حسب الحاجة",
};
const priorityLabel: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

export default function EmployeeOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [employee, setEmployee] = useState<any>(null);
  const [jobDuties, setJobDuties] = useState<JobDuty[]>([]);
  const [draftDuty, setDraftDuty] = useState<JobDuty>({ ...NEW_DUTY });
  const [data, setData] = useState({
    technical_skills: [] as string[],
    languages: [] as string[],
    certifications: [] as string[],
    years_of_experience: 0,
    previous_roles: "",
    work_style: "" as "" | "solo" | "team" | "hybrid",
    pressure_handling: "" as "" | "low" | "medium" | "high",
    planning_preference: "" as "" | "long_term" | "short_term" | "mixed",
    communication_style: "",
    personality_notes: "",
    career_goals: "",
    development_areas: [] as string[],
    preferred_domains: [] as string[],
    focus_hours_per_day: 6,
    max_parallel_tasks: 5,
    peak_hours: "" as "" | "morning" | "afternoon" | "evening",
  });

  // chip inputs
  const [chipInputs, setChipInputs] = useState({
    technical_skills: "",
    languages: "",
    certifications: "",
    development_areas: "",
    preferred_domains: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("id, organization_id, full_name, job_role")
        .eq("user_id", user.id)
        .maybeSingle();
      setEmployee(emp);

      const { data: existing } = await supabase
        .from("employee_intelligence_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: duties } = await supabase
        .from("employee_job_duties")
        .select("id, title, description, category, frequency, priority, estimated_time_minutes")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (duties) setJobDuties(duties as any);

      if (existing) {
        setData((prev) => ({
          ...prev,
          technical_skills: (existing.technical_skills as string[]) ?? [],
          languages: (existing.languages as string[]) ?? [],
          certifications: (existing.certifications as string[]) ?? [],
          years_of_experience: existing.years_of_experience ?? 0,
          previous_roles: existing.previous_roles ?? "",
          work_style: (existing.work_style as any) ?? "",
          pressure_handling: (existing.pressure_handling as any) ?? "",
          planning_preference: (existing.planning_preference as any) ?? "",
          communication_style: existing.communication_style ?? "",
          personality_notes: existing.personality_notes ?? "",
          career_goals: existing.career_goals ?? "",
          development_areas: (existing.development_areas as string[]) ?? [],
          preferred_domains: (existing.preferred_domains as string[]) ?? [],
          focus_hours_per_day: existing.focus_hours_per_day ?? 6,
          max_parallel_tasks: existing.max_parallel_tasks ?? 5,
          peak_hours: (existing.peak_hours as any) ?? "",
        }));
      }
      setLoading(false);
    })();
  }, [user]);

  const addChip = (field: keyof typeof chipInputs) => {
    const val = chipInputs[field].trim();
    if (!val) return;
    setData((prev) => ({ ...prev, [field]: [...(prev as any)[field], val] }));
    setChipInputs((prev) => ({ ...prev, [field]: "" }));
  };

  const removeChip = (field: keyof typeof chipInputs, idx: number) => {
    setData((prev) => ({
      ...prev,
      [field]: ((prev as any)[field] as string[]).filter((_, i) => i !== idx),
    }));
  };

  const addDuty = () => {
    if (!draftDuty.title.trim()) {
      toast.error("اكتب عنوان المهمة أولاً");
      return;
    }
    setJobDuties((prev) => [...prev, { ...draftDuty, title: draftDuty.title.trim() }]);
    setDraftDuty({ ...NEW_DUTY });
  };

  const removeDuty = (idx: number) => {
    setJobDuties((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        employee_id: employee?.id ?? null,
        organization_id: employee?.organization_id ?? null,
        technical_skills: data.technical_skills,
        languages: data.languages,
        certifications: data.certifications,
        years_of_experience: data.years_of_experience,
        previous_roles: data.previous_roles,
        work_style: data.work_style || null,
        pressure_handling: data.pressure_handling || null,
        planning_preference: data.planning_preference || null,
        communication_style: data.communication_style,
        personality_notes: data.personality_notes,
        career_goals: data.career_goals,
        development_areas: data.development_areas,
        preferred_domains: data.preferred_domains,
        focus_hours_per_day: data.focus_hours_per_day,
        max_parallel_tasks: data.max_parallel_tasks,
        peak_hours: data.peak_hours || null,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("employee_intelligence_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      // حفظ المهام الوظيفية: مكان مركّز يفهم منه النظام مهام الموظف بدقة
      await supabase
        .from("employee_job_duties")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "self_declared");

      if (jobDuties.length > 0) {
        const dutyRows = jobDuties.map((d) => ({
          user_id: user.id,
          employee_id: employee?.id ?? null,
          organization_id: employee?.organization_id ?? null,
          title: d.title,
          description: d.description || null,
          category: d.category || null,
          frequency: d.frequency,
          priority: d.priority,
          estimated_time_minutes: d.estimated_time_minutes,
          source: "self_declared",
          is_active: true,
        }));
        const { error: dutiesError } = await supabase
          .from("employee_job_duties")
          .insert(dutyRows);
        if (dutiesError) throw dutiesError;
      }

      toast.success("تم حفظ ملفك الذكي بنجاح ✨");
      navigate("/app");
    } catch (e: any) {
      toast.error(e.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
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

  const currentStep = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;
  const StepIcon = currentStep.icon;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-4xl mx-auto" dir="rtl">
        {/* Header */}
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-l from-fuchsia-600 via-pink-600 to-rose-500 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">ملفك الذكي ✨</h1>
                <p className="text-white/90 text-sm mt-1">
                  أهلًا {employee?.full_name ?? ""} — ساعدنا في التعرف عليك لنبني خططك ومهامك بذكاء يطابق شخصيتك وقدراتك
                </p>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs mb-2">
                <span>الخطوة {stepIdx + 1} من {STEPS.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/20 [&>div]:bg-white" />
            </div>
          </div>
        </Card>

        {/* Step content */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white shadow">
                <StepIcon className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-xl">{currentStep.title}</CardTitle>
                <CardDescription>{currentStep.subtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep.key === "skills" && (
              <>
                <ChipField
                  label="المهارات التقنية"
                  placeholder="أضف مهارة (مثال: Excel، إدارة المشاريع، التسويق الرقمي)"
                  values={data.technical_skills}
                  inputValue={chipInputs.technical_skills}
                  onInputChange={(v) => setChipInputs((p) => ({ ...p, technical_skills: v }))}
                  onAdd={() => addChip("technical_skills")}
                  onRemove={(i) => removeChip("technical_skills", i)}
                />
                <ChipField
                  label="اللغات"
                  placeholder="مثال: العربية، الإنجليزية"
                  values={data.languages}
                  inputValue={chipInputs.languages}
                  onInputChange={(v) => setChipInputs((p) => ({ ...p, languages: v }))}
                  onAdd={() => addChip("languages")}
                  onRemove={(i) => removeChip("languages", i)}
                />
                <ChipField
                  label="الشهادات والدورات"
                  placeholder="مثال: PMP، شهادة في التسويق"
                  values={data.certifications}
                  inputValue={chipInputs.certifications}
                  onInputChange={(v) => setChipInputs((p) => ({ ...p, certifications: v }))}
                  onAdd={() => addChip("certifications")}
                  onRemove={(i) => removeChip("certifications", i)}
                />
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>سنوات الخبرة</Label>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={data.years_of_experience}
                      onChange={(e) => setData((p) => ({ ...p, years_of_experience: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>أبرز الأدوار السابقة</Label>
                    <Input
                      placeholder="مثال: منسق مشاريع، أخصائي علاقات"
                      value={data.previous_roles}
                      onChange={(e) => setData((p) => ({ ...p, previous_roles: e.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            {currentStep.key === "duties" && (
              <div className="space-y-5">
                <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 p-4 text-sm text-fuchsia-900">
                  سجّل هنا المهام الوظيفية التي تقوم بها بشكل دوري. ستستخدمها المنصة لتوليد خططك التنفيذية ومهامك اليومية تلقائياً، ولفهم قدراتك بدقة.
                </div>

                {jobDuties.length > 0 && (
                  <div className="space-y-2">
                    {jobDuties.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 border rounded-lg p-3 bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{d.title}</span>
                            <Badge variant="secondary" className="text-xs">{frequencyLabel[d.frequency]}</Badge>
                            <Badge variant="outline" className="text-xs">{priorityLabel[d.priority]}</Badge>
                            {d.category && <Badge variant="outline" className="text-xs">{d.category}</Badge>}
                            {d.estimated_time_minutes ? (
                              <Badge variant="outline" className="text-xs">{d.estimated_time_minutes} دقيقة</Badge>
                            ) : null}
                          </div>
                          {d.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeDuty(i)} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded-xl p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Plus className="w-4 h-4" />
                    إضافة مهمة وظيفية
                  </div>
                  <div>
                    <Label>عنوان المهمة</Label>
                    <Input
                      placeholder="مثال: متابعة المتبرعين الجدد، إعداد التقرير الأسبوعي"
                      value={draftDuty.title}
                      onChange={(e) => setDraftDuty((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>وصف مختصر (اختياري)</Label>
                    <Textarea
                      rows={2}
                      placeholder="ماذا تتضمن هذه المهمة بالتفصيل؟"
                      value={draftDuty.description}
                      onChange={(e) => setDraftDuty((p) => ({ ...p, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>التصنيف</Label>
                      <Input
                        placeholder="مثال: متبرعون، تقارير، تواصل"
                        value={draftDuty.category}
                        onChange={(e) => setDraftDuty((p) => ({ ...p, category: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>الوقت المقدّر (بالدقائق)</Label>
                      <Input
                        type="number"
                        min={5}
                        placeholder="30"
                        value={draftDuty.estimated_time_minutes ?? ""}
                        onChange={(e) =>
                          setDraftDuty((p) => ({
                            ...p,
                            estimated_time_minutes: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>تكرار المهمة</Label>
                      <RadioGroup
                        value={draftDuty.frequency}
                        onValueChange={(v) => setDraftDuty((p) => ({ ...p, frequency: v as any }))}
                        className="grid grid-cols-2 gap-2 mt-1"
                      >
                        {(["daily", "weekly", "monthly", "adhoc"] as const).map((f) => (
                          <label
                            key={f}
                            className={`border rounded-lg p-2 cursor-pointer flex items-center gap-2 text-sm ${
                              draftDuty.frequency === f ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            }`}
                          >
                            <RadioGroupItem value={f} />
                            {frequencyLabel[f]}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                    <div>
                      <Label>الأولوية</Label>
                      <RadioGroup
                        value={draftDuty.priority}
                        onValueChange={(v) => setDraftDuty((p) => ({ ...p, priority: v as any }))}
                        className="grid grid-cols-3 gap-2 mt-1"
                      >
                        {(["low", "medium", "high"] as const).map((p) => (
                          <label
                            key={p}
                            className={`border rounded-lg p-2 cursor-pointer flex items-center gap-2 text-sm ${
                              draftDuty.priority === p ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                            }`}
                          >
                            <RadioGroupItem value={p} />
                            {priorityLabel[p]}
                          </label>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                  <Button
                    onClick={addDuty}
                    type="button"
                    className="bg-gradient-to-l from-fuchsia-600 to-pink-600 hover:opacity-90 text-white"
                  >
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة المهمة
                  </Button>
                </div>
              </div>
            )}

            {currentStep.key === "personality" && (
              <>
                <RadioBlock
                  label="أسلوب العمل المفضل"
                  value={data.work_style}
                  onChange={(v) => setData((p) => ({ ...p, work_style: v as any }))}
                  options={[
                    { v: "solo", l: "أعمل بشكل منفرد وأركّز" },
                    { v: "team", l: "أعمل ضمن فريق وأتفاعل" },
                    { v: "hybrid", l: "مختلط حسب المهمة" },
                  ]}
                />
                <RadioBlock
                  label="التعامل مع الضغط"
                  value={data.pressure_handling}
                  onChange={(v) => setData((p) => ({ ...p, pressure_handling: v as any }))}
                  options={[
                    { v: "low", l: "أفضّل بيئة هادئة بلا ضغط" },
                    { v: "medium", l: "أتعامل مع ضغط متوسط بسلاسة" },
                    { v: "high", l: "أتألق تحت الضغط العالي" },
                  ]}
                />
                <RadioBlock
                  label="نمط التخطيط"
                  value={data.planning_preference}
                  onChange={(v) => setData((p) => ({ ...p, planning_preference: v as any }))}
                  options={[
                    { v: "long_term", l: "تخطيط طويل المدى وعميق" },
                    { v: "short_term", l: "تنفيذ سريع ومهام قصيرة" },
                    { v: "mixed", l: "مزيج بين الاثنين" },
                  ]}
                />
                <div>
                  <Label>أسلوب التواصل</Label>
                  <Input
                    placeholder="مثال: أفضل التواصل المكتوب، أو الاجتماعات القصيرة"
                    value={data.communication_style}
                    onChange={(e) => setData((p) => ({ ...p, communication_style: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>ملاحظات إضافية عن شخصيتك (اختياري)</Label>
                  <Textarea
                    rows={3}
                    placeholder="أي شيء يساعد المنصة على فهمك بشكل أفضل"
                    value={data.personality_notes}
                    onChange={(e) => setData((p) => ({ ...p, personality_notes: e.target.value }))}
                  />
                </div>
              </>
            )}

            {currentStep.key === "goals" && (
              <>
                <div>
                  <Label>أهدافك المهنية</Label>
                  <Textarea
                    rows={3}
                    placeholder="ما الذي تطمح للوصول إليه خلال السنة القادمة؟"
                    value={data.career_goals}
                    onChange={(e) => setData((p) => ({ ...p, career_goals: e.target.value }))}
                  />
                </div>
                <ChipField
                  label="مجالات تريد التطور فيها"
                  placeholder="مثال: قيادة الفرق، التحليل المالي"
                  values={data.development_areas}
                  inputValue={chipInputs.development_areas}
                  onInputChange={(v) => setChipInputs((p) => ({ ...p, development_areas: v }))}
                  onAdd={() => addChip("development_areas")}
                  onRemove={(i) => removeChip("development_areas", i)}
                />
                <ChipField
                  label="المجالات/المهام المفضلة لديك"
                  placeholder="مثال: العمل مع المتبرعين، إعداد التقارير"
                  values={data.preferred_domains}
                  inputValue={chipInputs.preferred_domains}
                  onInputChange={(v) => setChipInputs((p) => ({ ...p, preferred_domains: v }))}
                  onAdd={() => addChip("preferred_domains")}
                  onRemove={(i) => removeChip("preferred_domains", i)}
                />
              </>
            )}

            {currentStep.key === "availability" && (
              <>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>ساعات التركيز اليومية</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={data.focus_hours_per_day}
                      onChange={(e) => setData((p) => ({ ...p, focus_hours_per_day: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">عدد الساعات التي تستطيع التركيز فيها بصفاء</p>
                  </div>
                  <div>
                    <Label>الحد الأقصى للمهام المتوازية</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={data.max_parallel_tasks}
                      onChange={(e) => setData((p) => ({ ...p, max_parallel_tasks: Number(e.target.value) }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">كم مهمة تستطيع متابعتها في نفس الوقت</p>
                  </div>
                </div>
                <RadioBlock
                  label="أوقات الذروة في إنتاجيتك"
                  value={data.peak_hours}
                  onChange={(v) => setData((p) => ({ ...p, peak_hours: v as any }))}
                  options={[
                    { v: "morning", l: "الصباح الباكر" },
                    { v: "afternoon", l: "بعد الظهر" },
                    { v: "evening", l: "المساء" },
                  ]}
                />
              </>
            )}

            {currentStep.key === "summary" && (
              <SummaryView data={data} dutiesCount={jobDuties.length} />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0 || saving}
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            السابق
          </Button>

          {stepIdx < STEPS.length - 1 ? (
            <Button
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              className="bg-gradient-to-l from-fuchsia-600 to-pink-600 hover:opacity-90 text-white"
            >
              التالي
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-l from-emerald-500 to-teal-600 hover:opacity-90 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Check className="w-4 h-4 ml-2" />}
              حفظ ملفي الذكي
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ChipField({
  label,
  placeholder,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  values: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={onAdd}>
          إضافة
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {values.map((v, i) => (
            <Badge key={i} variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
              {v}
              <button onClick={() => onRemove(i)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function RadioBlock({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid md:grid-cols-3 gap-2">
        {options.map((o) => (
          <label
            key={o.v}
            className={`border rounded-lg p-3 cursor-pointer transition-colors flex items-center gap-2 ${
              value === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value={o.v} />
            <span className="text-sm">{o.l}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function SummaryView({ data, dutiesCount = 0 }: { data: any; dutiesCount?: number }) {
  const Section = ({ title, children }: any) => (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="font-semibold text-sm mb-2 text-primary">{title}</h4>
      <div className="text-sm space-y-1">{children}</div>
    </div>
  );
  const Row = ({ k, v }: { k: string; v: any }) => (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-left">{v || "—"}</span>
    </div>
  );
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Section title="🎯 المهارات والخبرات">
        <Row k="سنوات الخبرة" v={`${data.years_of_experience} سنة`} />
        <Row k="المهارات" v={data.technical_skills.join("، ") || "—"} />
        <Row k="اللغات" v={data.languages.join("، ") || "—"} />
        <Row k="الشهادات" v={data.certifications.join("، ") || "—"} />
      </Section>
      <Section title="📋 المهام الوظيفية">
        <Row k="عدد المهام المسجّلة" v={`${dutiesCount} مهمة`} />
      </Section>
      <Section title="🧠 النمط الشخصي">
        <Row k="أسلوب العمل" v={labelMap.work_style[data.work_style]} />
        <Row k="الضغط" v={labelMap.pressure_handling[data.pressure_handling]} />
        <Row k="التخطيط" v={labelMap.planning_preference[data.planning_preference]} />
      </Section>
      <Section title="🚀 الأهداف">
        <Row k="الأهداف المهنية" v={data.career_goals?.slice(0, 80) || "—"} />
        <Row k="مجالات التطور" v={data.development_areas.join("، ") || "—"} />
        <Row k="المجالات المفضلة" v={data.preferred_domains.join("، ") || "—"} />
      </Section>
      <Section title="⏰ التوفر">
        <Row k="ساعات التركيز" v={`${data.focus_hours_per_day} ساعات/يوم`} />
        <Row k="الحد الأقصى للمهام" v={`${data.max_parallel_tasks} مهام متوازية`} />
        <Row k="الذروة" v={labelMap.peak_hours[data.peak_hours]} />
      </Section>
    </div>
  );
}

const labelMap: Record<string, Record<string, string>> = {
  work_style: { solo: "منفرد ومركّز", team: "ضمن فريق", hybrid: "مختلط", "": "—" },
  pressure_handling: { low: "بيئة هادئة", medium: "ضغط متوسط", high: "ضغط عالي", "": "—" },
  planning_preference: { long_term: "طويل المدى", short_term: "قصير المدى", mixed: "مختلط", "": "—" },
  peak_hours: { morning: "الصباح", afternoon: "بعد الظهر", evening: "المساء", "": "—" },
};