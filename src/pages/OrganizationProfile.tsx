import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Globe, ShoppingBag, Sparkles, Save, Loader2, Building2, Link as LinkIcon, Wand2, Palette, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileForm {
  about: string;
  goals: string;
  website_url: string;
  store_url: string;
  twitter_url: string;
  instagram_url: string;
  tiktok_url: string;
  snapchat_url: string;
  youtube_url: string;
  facebook_url: string;
  linkedin_url: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
}

const empty: ProfileForm = {
  about: "", goals: "", website_url: "", store_url: "",
  twitter_url: "", instagram_url: "", tiktok_url: "",
  snapchat_url: "", youtube_url: "", facebook_url: "", linkedin_url: "",
  logo_url: "", primary_color: "", secondary_color: "", accent_color: "",
};

export default function OrganizationProfile() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", orgId).single();
      if (org) setOrgName(org.name);
      const { data: p } = await supabase
        .from("organization_profiles")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (p) {
        setForm({
          about: p.about ?? "",
          goals: (p as Record<string, string | null>).goals ?? "",
          website_url: p.website_url ?? "",
          store_url: p.store_url ?? "",
          twitter_url: p.twitter_url ?? "",
          instagram_url: p.instagram_url ?? "",
          tiktok_url: p.tiktok_url ?? "",
          snapchat_url: p.snapchat_url ?? "",
          youtube_url: p.youtube_url ?? "",
          facebook_url: p.facebook_url ?? "",
          linkedin_url: p.linkedin_url ?? "",
          logo_url: (p as Record<string, string | null>).logo_url ?? "",
          primary_color: (p as Record<string, string | null>).primary_color ?? "",
          secondary_color: (p as Record<string, string | null>).secondary_color ?? "",
          accent_color: (p as Record<string, string | null>).accent_color ?? "",
        });
        setAnalysis((p.ai_analysis as Record<string, unknown>) || null);
        setLastAnalyzed(p.last_analyzed_at);
      }
      setLoading(false);
    })();
  }, [orgId]);

  const autoExtract = async (websiteUrl: string) => {
    if (!websiteUrl || !/^https?:\/\//i.test(websiteUrl)) return;
    setExtracting(true);
    const { data, error } = await supabase.functions.invoke("extract-website-info", {
      body: { url: websiteUrl },
    });
    setExtracting(false);
    if (error || !data?.success) {
      toast.error("تعذّر جلب البيانات من الموقع");
      return;
    }
    const d = data.data as Record<string, string | null>;
    setForm((prev) => ({
      ...prev,
      // only fill empty fields, don't overwrite user input
      logo_url: prev.logo_url || d.logo_url || "",
      primary_color: prev.primary_color || d.primary_color || "",
      secondary_color: prev.secondary_color || d.secondary_color || "",
      accent_color: prev.accent_color || d.accent_color || "",
      store_url: prev.store_url || d.store_url || "",
      twitter_url: prev.twitter_url || d.twitter_url || "",
      instagram_url: prev.instagram_url || d.instagram_url || "",
      tiktok_url: prev.tiktok_url || d.tiktok_url || "",
      snapchat_url: prev.snapchat_url || d.snapchat_url || "",
      youtube_url: prev.youtube_url || d.youtube_url || "",
      facebook_url: prev.facebook_url || d.facebook_url || "",
      linkedin_url: prev.linkedin_url || d.linkedin_url || "",
      about: prev.about || d.description || "",
    }));
    toast.success("تم جلب هوية الجمعية تلقائياً");
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase
      .from("organization_profiles")
      .upsert({ organization_id: orgId, ...form }, { onConflict: "organization_id" });
    setSaving(false);
    if (error) { toast.error("تعذّر الحفظ"); return; }
    toast.success("تم حفظ ملف التعريف");
  };

  const analyze = async () => {
    if (!orgId) return;
    await save();
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke("analyze-organization", {
      body: { organization_id: orgId },
    });
    setAnalyzing(false);
    if (error || !data?.success) {
      toast.error("تعذّر التحليل، تأكد من الروابط");
      return;
    }
    setAnalysis(data.analysis);
    setLastAnalyzed(new Date().toISOString());
    toast.success("اكتمل التحليل بنجاح");
  };

  const brand = useMemo(() => ({
    primary: form.primary_color || "#0F766E",
    secondary: form.secondary_color || "#0E7490",
    accent: form.accent_color || "#F59E0B",
  }), [form.primary_color, form.secondary_color, form.accent_color]);

  const socials: { key: keyof ProfileForm; label: string; placeholder: string }[] = [
    { key: "twitter_url", label: "تويتر / X", placeholder: "https://x.com/..." },
    { key: "instagram_url", label: "إنستغرام", placeholder: "https://instagram.com/..." },
    { key: "tiktok_url", label: "تيك توك", placeholder: "https://tiktok.com/@..." },
    { key: "snapchat_url", label: "سناب شات", placeholder: "https://snapchat.com/add/..." },
    { key: "youtube_url", label: "يوتيوب", placeholder: "https://youtube.com/@..." },
    { key: "facebook_url", label: "فيسبوك", placeholder: "https://facebook.com/..." },
    { key: "linkedin_url", label: "لينكدإن", placeholder: "https://linkedin.com/company/..." },
  ];

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header — same style as Settings page */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/organizations")} className="gap-1">
              <ArrowRight className="w-4 h-4" /> رجوع
            </Button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg overflow-hidden">
              {form.logo_url ? (
                <img src={form.logo_url} alt={orgName} className="w-full h-full object-contain p-1 bg-white/95" />
              ) : (
                <Building2 className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{orgName}</h1>
              <p className="text-muted-foreground text-sm">التعرف على الجمعية وهويتها البصرية</p>
            </div>
          </div>
        </div>

        {/* 1) Website URL on top — triggers identity extraction */}
        <Card className="p-6 border-primary/30 bg-gradient-to-bl from-primary/5 to-transparent">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> الموقع الإلكتروني للجمعية
            {extracting && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                <Loader2 className="w-3 h-3 animate-spin" /> جاري قراءة الموقع...
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            بمجرد إدخال الموقع، تقوم المنصة تلقائياً بجلب الشعار، الألوان، المتجر، وحسابات التواصل.
          </p>
          <div className="flex gap-2">
            <Input
              dir="ltr" placeholder="https://..." value={form.website_url}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              onBlur={(e) => autoExtract(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button" className="gap-1.5"
              onClick={() => autoExtract(form.website_url)}
              disabled={!form.website_url || extracting}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {extracting ? "جاري الجلب..." : "جلب الهوية"}
            </Button>
          </div>
        </Card>

        {/* 2) Identity: Logo + Colors */}
        {(form.logo_url || form.primary_color) && (
          <Card className="p-6">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" /> الهوية البصرية
            </h2>
            <div className="flex items-center gap-6 flex-wrap">
              {form.logo_url && (
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden border-2">
                  <img src={form.logo_url} alt="logo" className="w-full h-full object-contain p-2" />
                </div>
              )}
              <div className="flex gap-3">
                {(["primary_color", "secondary_color", "accent_color"] as const).map((k) => (
                  form[k] ? (
                    <div key={k} className="text-center">
                      <div className="w-14 h-14 rounded-lg shadow-sm border" style={{ background: form[k] }} />
                      <div dir="ltr" className="text-[10px] text-muted-foreground mt-1">{form[k]}</div>
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* 3) Org Name (read-only) + About + Goals */}
        <Card className="p-6 space-y-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> بيانات الجمعية
          </h2>
          <div className="space-y-2">
            <Label>اسم الجمعية</Label>
            <Input value={orgName} readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>نبذة عن الجمعية</Label>
            <Textarea
              rows={4}
              placeholder="اكتب نبذة شاملة عن الجمعية: تخصصها، رسالتها، أبرز برامجها..."
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> أهداف الجمعية
            </Label>
            <Textarea
              rows={4}
              placeholder="أهم الأهداف الاستراتيجية والتشغيلية للجمعية..."
              value={form.goals}
              onChange={(e) => setForm({ ...form, goals: e.target.value })}
            />
          </div>
        </Card>

        {/* 4) Store + social links at the bottom */}
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" /> المتجر وحسابات التواصل
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" /> المتجر الإلكتروني / صفحة التبرع
              </Label>
              <Input dir="ltr" placeholder="https://..." value={form.store_url}
                onChange={(e) => setForm({ ...form, store_url: e.target.value })} />
            </div>
            {socials.map((s) => (
              <div key={s.key} className="space-y-2">
                <Label>{s.label}</Label>
                <Input dir="ltr" placeholder={s.placeholder} value={form[s.key]}
                  onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />
              </div>
            ))}
          </div>
        </Card>

        {/* 5) Save + analyze actions */}
        <Card className="p-4 flex justify-end gap-2 sticky bottom-4 shadow-lg border-primary/20">
          <Button variant="outline" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ البيانات
          </Button>
          <Button onClick={analyze} disabled={analyzing} className="gap-2">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analyzing ? "جاري التحليل..." : "تحليل ذكي شامل"}
          </Button>
        </Card>

        {analysis && (
          <Card className="p-6 border-primary/30 bg-gradient-to-bl from-primary/5 to-accent/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> نتائج التحليل الذكي
              </h2>
              {lastAnalyzed && (
                <Badge variant="outline" className="text-[10px]">
                  آخر تحليل: {new Date(lastAnalyzed).toLocaleString("ar-SA")}
                </Badge>
              )}
            </div>
            <div className="space-y-4 text-sm">
              {Object.entries(analysis).map(([key, value]) => (
                <div key={key} className="bg-white/60 rounded-lg p-3 border">
                  <div className="font-semibold text-primary mb-1 text-xs uppercase tracking-wide">{labelFor(key)}</div>
                  {Array.isArray(value) ? (
                    <ul className="list-disc list-inside space-y-1">
                      {(value as unknown[]).map((v, i) => <li key={i}>{String(v)}</li>)}
                    </ul>
                  ) : (
                    <p className="text-foreground/80 leading-relaxed">{String(value)}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function labelFor(key: string): string {
  const map: Record<string, string> = {
    specialization: "التخصص الرئيسي",
    mission: "الرسالة",
    target_audience: "الفئات المستهدفة",
    main_programs: "أبرز البرامج",
    products_services: "المنتجات والخدمات",
    tone_of_voice: "نبرة التواصل",
    social_presence: "الحضور على وسائل التواصل",
    strengths: "نقاط القوة",
    opportunities: "الفرص التسويقية",
    recommendations_for_innovation: "توصيات للابتكار",
    summary: "ملخص شامل",
  };
  return map[key] || key;
}