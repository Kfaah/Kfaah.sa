import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Upload, FileText, X, Loader2, Brain, ArrowRight, CheckCircle2, FileSpreadsheet, FileImage, Calendar, Building2, Users, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableYears, getCurrentYear } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";

const MAX_FILES = 10;
const MAX_SIZE_MB = 20;

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(lower)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return <FileImage className="w-5 h-5 text-blue-600" />;
  return <FileText className="w-5 h-5 text-violet-600" />;
}

/**
 * صفحة توليد الخطط التنفيذية بالذكاء الاصطناعي
 * تدعم الوضع "مع ملفات مرجعية" — يرفع المستخدم ملفاته ثم يطلب التوليد
 */
export default function AIGenerateExecutivePlan() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const { currentOrg } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const withFiles = params.get("withFiles") === "1";

  const [planName, setPlanName] = useState("");
  const [year, setYear] = useState<number>(getCurrentYear());
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");

  // Scope filters
  const [routeOrgId, setRouteOrgId] = useState<string | null>(null);
  const activeOrgId = slug ? routeOrgId : currentOrg?.id ?? null;
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; user_id: string | null; department_id: string | null }[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]); // [] => all employees in scope

  useEffect(() => {
    const resolve = async () => {
      if (!slug) { setRouteOrgId(null); return; }
      if (currentOrg?.slug === slug) { setRouteOrgId(currentOrg.id); return; }
      const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
      setRouteOrgId(data?.id ?? null);
    };
    resolve();
  }, [slug, currentOrg?.id, currentOrg?.slug]);

  useEffect(() => {
    const loadFilters = async () => {
      if (slug && !activeOrgId) return;
      let dq = supabase.from("departments").select("id, name").order("name");
      let eq = supabase
        .from("employees")
        .select("id, full_name, user_id, department_id")
        .eq("status", "active")
        .order("full_name");
      if (activeOrgId) {
        dq = dq.eq("organization_id", activeOrgId);
        eq = eq.eq("organization_id", activeOrgId);
      }
      const [{ data: deps }, { data: emps }] = await Promise.all([dq, eq]);
      setDepartments(deps || []);
      setEmployees((emps || []) as any);
    };
    loadFilters();
  }, [activeOrgId, slug]);

  const filteredEmployees = useMemo(() => {
    if (departmentId === "all") return employees;
    return employees.filter((e) => e.department_id === departmentId);
  }, [employees, departmentId]);

  // Effective userIds to send (undefined => no filter, generate for all)
  const effectiveUserIds = useMemo(() => {
    const pool = selectedEmployeeIds.length > 0
      ? employees.filter((e) => selectedEmployeeIds.includes(e.id))
      : filteredEmployees;
    const ids = pool.map((e) => e.user_id).filter((v): v is string => !!v);
    return ids;
  }, [employees, filteredEmployees, selectedEmployeeIds]);

  const years = getAvailableYears();

  const toggleMonth = (m: number) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );
  };
  const selectAllMonths = () => setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const clearAllMonths = () => setSelectedMonths([]);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        toast({ title: `الحد الأقصى ${MAX_FILES} ملفات`, variant: "destructive" });
        break;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast({ title: `الملف ${f.name} أكبر من ${MAX_SIZE_MB} ميجا`, variant: "destructive" });
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (selectedMonths.length === 0) {
      toast({ title: "اختر شهر واحد على الأقل", variant: "destructive" });
      return;
    }

    try {
      setStage("uploading");
      const uploadedPaths: string[] = [];

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || "anon";

      // ارفع الملفات (إن وُجدت) كمرجع
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${uid}/executive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
        const { error } = await supabase.storage.from("ai-plan-references").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) {
          console.error(error);
          toast({ title: `فشل رفع ${file.name}`, description: error.message, variant: "destructive" });
          setStage("idle");
          return;
        }
        uploadedPaths.push(path);
      }

      setStage("analyzing");

      const { data, error } = await supabase.functions.invoke("generate-executive-plans", {
        body: {
          months: selectedMonths,
          year,
          plan_name: planName.trim() || undefined,
          user_brief: brief.trim() || undefined,
          reference_file_paths: uploadedPaths,
          // Scope: only generate for these users (if any filter applied)
          userIds:
            departmentId !== "all" || selectedEmployeeIds.length > 0
              ? effectiveUserIds
              : undefined,
        },
      });

      if (error) {
        console.error(error);
        toast({ title: "فشل التوليد", description: error.message || "خطأ غير معروف", variant: "destructive" });
        setStage("idle");
        return;
      }

      if (data && (data as any).success === false) {
        toast({ title: "فشل التوليد", description: (data as any).error || "تعذر التوليد", variant: "destructive" });
        setStage("idle");
        return;
      }

      setStage("done");
      toast({
        title: "✨ تم توليد الخطط التنفيذية بنجاح",
        description: `${(data as any)?.totalPlansGenerated || 0} يوم تنفيذي تم إنشاؤها`,
      });

      setTimeout(() => navigate("/executive-plans"), 800);
    } catch (e: any) {
      console.error(e);
      toast({ title: "خطأ غير متوقع", description: e?.message || "", variant: "destructive" });
      setStage("idle");
    }
  };

  const isWorking = stage === "uploading" || stage === "analyzing";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <PageHeader
          icon={<Brain className="w-6 h-6" />}
          title="توليد الخطط التنفيذية بالذكاء الاصطناعي"
          subtitle={withFiles
            ? "ارفع نماذج/تقارير سابقة وسيدرسها الذكاء الاصطناعي مع بيانات الجمعية"
            : "دراسة الخطط التشغيلية وتوزيع المستهدفات على أيام التنفيذ"}
          actions={
            <Button
              variant="outline"
              className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25"
              onClick={() => navigate("/executive-plans")}
            >
              <ArrowRight className="w-4 h-4" />
              رجوع
            </Button>
          }
        />

        {/* معلومات الخطة */}
        <div className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">معلومات الخطة التنفيذية</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-right block mb-2">اسم مرجعي للخطة (اختياري)</Label>
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="مثال: خطة الربع الأول التنفيذية"
                disabled={isWorking}
                dir="rtl"
              />
            </div>
            <div>
              <Label className="text-right block mb-2">السنة</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))} disabled={isWorking} dir="rtl">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* اختيار الأشهر */}
        <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">الأشهر المستهدفة</h3>
                <p className="text-xs text-gray-500">اختر الأشهر التي ترغب بتوليد خطط تنفيذية لها</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllMonths} className="text-xs h-7 px-2">
                تحديد الكل
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAllMonths} className="text-xs h-7 px-2">
                إلغاء الكل
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {MONTHS_AR.map((month, idx) => {
              const monthNum = idx + 1;
              const isSelected = selectedMonths.includes(monthNum);
              return (
                <div
                  key={idx}
                  onClick={() => !isWorking && toggleMonth(monthNum)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all border-2",
                    isSelected
                      ? "bg-blue-100 border-blue-400 text-blue-800"
                      : "bg-white hover:bg-gray-50 border-gray-200 hover:border-blue-200",
                    isWorking && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  <span className="text-sm font-medium">{month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* الملفات المرجعية - تظهر دائماً لكن أبرز عند withFiles */}
        <div className={cn(
          "bg-white rounded-2xl border p-6 shadow-sm",
          withFiles ? "border-emerald-200 ring-2 ring-emerald-100" : "border-emerald-100",
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">
                  الملفات المرجعية {withFiles ? "" : "(اختياري)"}
                </h3>
                <p className="text-xs text-gray-500">
                  ارفع نماذج، تقارير، أو خطط سابقة — حتى {MAX_FILES} ملفات، {MAX_SIZE_MB}MB لكل ملف
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              {files.length}/{MAX_FILES}
            </span>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isWorking || files.length >= MAX_FILES}
            className="w-full border-2 border-dashed border-emerald-300 rounded-xl p-8 text-center hover:border-emerald-500 hover:bg-emerald-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 mb-1">اسحب الملفات هنا أو اضغط للاختيار</p>
            <p className="text-xs text-gray-500">PDF · Word · Excel · صور · نصوص</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
            />
          </button>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  {fileIcon(f.name)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{f.name}</div>
                    <div className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => removeFile(i)}
                    disabled={isWorking}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ملاحظات */}
        <div className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm">
          <Label className="text-right block mb-2">ملاحظات أو تركيز خاص <span className="text-gray-400 text-xs">(اختياري)</span></Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="مثال: ركّز على أيام بداية الشهر، تجنب فترة الاختبارات..."
            disabled={isWorking}
            dir="rtl"
            rows={3}
            className="resize-none"
          />
        </div>

        {/* مؤشر */}
        <div className="bg-gradient-to-br from-violet-50 via-white to-emerald-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-violet-600" />
            <h4 className="font-semibold text-gray-900">سيقوم الذكاء الاصطناعي بـ:</h4>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              "تحليل الخطط التشغيلية والمستهدفات الشهرية",
              "توزيع المستهدفات على أيام العمل",
              "تجنب عطلات نهاية الأسبوع",
              "إنشاء مهام (قبل/أثناء/بعد) لكل يوم",
              "مراعاة بيانات الجمعية والموظفين",
              ...(files.length > 0 ? ["دراسة الملفات المرجعية المرفقة"] : []),
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-gray-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* زر التوليد */}
        <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-gradient-to-r from-blue-600 to-blue-700 border border-blue-800 rounded-2xl p-4 shadow-xl shadow-blue-500/30">
          <div className="text-sm text-white/95 font-medium">
            {stage === "uploading" && "جاري رفع الملفات..."}
            {stage === "analyzing" && "الذكاء الاصطناعي يدرس البيانات ويبني الخطط..."}
            {stage === "done" && "✓ تم التوليد بنجاح، جاري التحويل..."}
            {stage === "idle" && `${selectedMonths.length} شهر محدد · جاهز للتوليد`}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isWorking || stage === "done" || selectedMonths.length === 0}
            className="gap-2 bg-white text-blue-700 hover:bg-blue-50 font-bold shadow-lg px-6 disabled:bg-white/80 disabled:text-blue-700"
            size="lg"
          >
            {isWorking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {stage === "uploading" ? "رفع..." : "تحليل عميق..."}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                توليد الخطط التنفيذية
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}