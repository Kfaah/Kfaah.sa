import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Globe, ShoppingBag, Sparkles, Save, Loader2, Building2, Link as LinkIcon } from "lucide-react";
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
  website_url: string;
  store_url: string;
  twitter_url: string;
  instagram_url: string;
  tiktok_url: string;
  snapchat_url: string;
  youtube_url: string;
  facebook_url: string;
  linkedin_url: string;
}

const empty: ProfileForm = {
  about: "", website_url: "", store_url: "",
  twitter_url: "", instagram_url: "", tiktok_url: "",
  snapchat_url: "", youtube_url: "", facebook_url: "", linkedin_url: "",
};

export default function OrganizationProfile() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
          website_url: p.website_url ?? "",
          store_url: p.store_url ?? "",
          twitter_url: p.twitter_url ?? "",
          instagram_url: p.instagram_url ?? "",
          tiktok_url: p.tiktok_url ?? "",
          snapchat_url: p.snapchat_url ?? "",
          youtube_url: p.youtube_url ?? "",
          facebook_url: p.facebook_url ?? "",
          linkedin_url: p.linkedin_url ?? "",
        });
        setAnalysis((p.ai_analysis as Record<string, unknown>) || null);
        setLastAnalyzed(p.last_analyzed_at);
      }
      setLoading(false);
    })();
  }, [orgId]);

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
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/organizations")} className="gap-1">
              <ArrowRight className="w-4 h-4" /> رجوع
            </Button>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <div>
                <h1 className="font-bold text-lg">التعرف على الجمعية</h1>
                <p className="text-xs text-muted-foreground">{orgName}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </Button>
            <Button onClick={analyze} disabled={analyzing} className="gap-2 bg-gradient-to-l from-primary to-accent">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? "جاري التحليل..." : "تحليل ذكي شامل"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> نبذة عن الجمعية
          </h2>
          <Textarea
            rows={4}
            placeholder="اكتب نبذة شاملة عن الجمعية: تخصصها، رسالتها، أبرز برامجها..."
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
          />
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> المواقع الرئيسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> الموقع الإلكتروني</Label>
              <Input dir="ltr" placeholder="https://..." value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> المتجر الإلكتروني</Label>
              <Input dir="ltr" placeholder="https://..." value={form.store_url}
                onChange={(e) => setForm({ ...form, store_url: e.target.value })} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" /> حسابات التواصل الاجتماعي
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {socials.map((s) => (
              <div key={s.key} className="space-y-2">
                <Label>{s.label}</Label>
                <Input dir="ltr" placeholder={s.placeholder} value={form[s.key]}
                  onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} />
              </div>
            ))}
          </div>
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