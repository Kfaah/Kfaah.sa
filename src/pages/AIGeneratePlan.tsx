import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Upload, FileText, X, Loader2, Brain, ArrowRight, CheckCircle2, FileSpreadsheet, FileImage } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAvailableYears, getCurrentYear } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";

const MAX_FILES = 10;
const MAX_SIZE_MB = 20;

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (/\.(xlsx?|csv)$/.test(lower)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (/\.(png|jpe?g|webp|gif)$/.test(lower)) return <FileImage className="w-5 h-5 text-blue-600" />;
  return <FileText className="w-5 h-5 text-violet-600" />;
}

export default function AIGeneratePlan() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const makeOrgUrl = (path: string) => (slug ? `/${slug}${path}` : path);
  const { currentOrg } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [planName, setPlanName] = useState("");
  const [year, setYear] = useState<number>(getCurrentYear());
  const [brief, setBrief] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");
  const [routeOrgId, setRouteOrgId] = useState<string | null>(null);
  const activeOrgId = slug ? routeOrgId : currentOrg?.id ?? null;

  const years = getAvailableYears();

  useEffect(() => {
    const resolveRouteOrg = async () => {
      if (!slug) { setRouteOrgId(null); return; }
      if (currentOrg?.slug === slug) { setRouteOrgId(currentOrg.id); return; }
      const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
      setRouteOrgId(data?.id ?? null);
    };
    resolveRouteOrg();
  }, [slug, currentOrg?.id, currentOrg?.slug]);

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
    if (slug && !activeOrgId) {
      toast({ title: "جاري تحديد الجمعية، حاول بعد لحظة", variant: "destructive" });
      return;
    }

    if (!planName.trim()) {
      toast({ title: "أدخل اسم الخطة", variant: "destructive" });
      return;
    }

    try {
      setStage("uploading");
      const uploadedPaths: string[] = [];

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || "anon";

      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
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

      const { data, error } = await supabase.functions.invoke("generate-plan-deep", {
        body: {
          plan_name: planName.trim(),
          year,
          organizationId: activeOrgId,
          user_brief: brief.trim(),
          reference_file_paths: uploadedPaths,
        },
      });

      if (error) {
        const ctx: any = (error as any).context;
        let serverData: any = null;
        try {
          if (ctx && typeof ctx.json === "function") serverData = await ctx.json();
        } catch {}
        const msg = serverData?.error || error.message || "فشل التوليد";
        if (serverData?.rejected_files?.length) {
          const list = serverData.rejected_files
            .map((f: any) => `• ${f.path.split("/").pop()} — ${f.category}: ${f.reason}`)
            .join("\n");
          toast({
            title: "🚫 ملفات غير مقبولة",
            description: `${msg}\n\n${list}`,
            variant: "destructive",
          });
        } else if (/429/.test(msg)) toast({ title: "تجاوز حد الطلبات", description: "حاول بعد قليل", variant: "destructive" });
        else if (/402/.test(msg)) toast({ title: "الرصيد غير كافٍ", variant: "destructive" });
        else toast({ title: "فشل التوليد", description: msg, variant: "destructive" });
        setStage("idle");
        return;
      }

      if (!data?.success) {
        toast({ title: "فشل التوليد", description: data?.error || "خطأ غير معروف", variant: "destructive" });
        setStage("idle");
        return;
      }

      setStage("done");
      if (data.rejected_files?.length) {
        const list = data.rejected_files
          .map((f: any) => `• ${f.path.split("/").pop()} (${f.category})`)
          .join("\n");
        toast({
          title: "تم تجاهل بعض الملفات غير ذات الصلة",
          description: list,
        });
      }
      toast({
        title: "✨ تم توليد الخطة بنجاح",
        description: `${data.rows_count} نشاط ضمن "${data.plan_name}"`,
      });

      // العودة لصفحة الخطط مع نفس السنة والخطة المولّدة حتى تظهر النتيجة مباشرة
      const generatedPlanName = encodeURIComponent(data.plan_name || planName.trim());
      setTimeout(() => navigate(makeOrgUrl(`/operational-plans?year=${year}&plan=${generatedPlanName}`)), 800);
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
          title="توليد خطة بالذكاء الاصطناعي"
          subtitle="دراسة عميقة لبيانات الجمعية والملفات المرفقة لإنتاج خطة احترافية"
          actions={
            <Button
              variant="outline"
              className="gap-2 bg-white/15 text-white border-white/30 hover:bg-white/25"
              onClick={() => navigate(makeOrgUrl("/operational-plans"))}
            >
              <ArrowRight className="w-4 h-4" />
              رجوع
            </Button>
          }
        />

        {/* القسم الأول: معلومات الخطة */}
        <div className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">معلومات الخطة</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="planName" className="text-right block mb-2">اسم الخطة *</Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="مثال: خطة تطوير الإيرادات 2026"
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

          <div className="mt-4">
            <Label htmlFor="brief" className="text-right block mb-2">
              ملاحظات أو تركيز خاص <span className="text-gray-400 text-xs">(اختياري)</span>
            </Label>
            <Textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="مثال: ركّز على استقطاب الشباب، تنويع مصادر الدخل، التحول الرقمي..."
              disabled={isWorking}
              dir="rtl"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        {/* القسم الثاني: الملفات المرجعية */}
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Upload className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">الملفات المرجعية</h3>
                <p className="text-xs text-gray-500">ارفع نماذج، تقارير، أو خطط سابقة (اختياري) — حتى {MAX_FILES} ملفات، {MAX_SIZE_MB}MB لكل ملف</p>
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

        {/* مؤشر ما يدرسه AI */}
        <div className="bg-gradient-to-br from-violet-50 via-white to-emerald-50 rounded-2xl border border-violet-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-violet-600" />
            <h4 className="font-semibold text-gray-900">سيقوم الذكاء الاصطناعي بدراسة:</h4>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              "الأهداف الاستراتيجية الحالية",
              "المبادرات والأنشطة السابقة",
              "بيانات الموظفين والإدارات",
              "المهام الجارية والسابقة",
              "الخطط التشغيلية المرفوعة",
              "الملفات المرجعية المرفقة",
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
            {stage === "analyzing" && "الذكاء الاصطناعي يدرس البيانات ويبني الخطة..."}
            {stage === "done" && "✓ تم التوليد بنجاح، جاري التحويل..."}
            {stage === "idle" && "اضغط للبدء بدراسة المعطيات وتوليد الخطة"}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isWorking || stage === "done" || !planName.trim()}
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
                توليد الخطة بالذكاء الاصطناعي
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}