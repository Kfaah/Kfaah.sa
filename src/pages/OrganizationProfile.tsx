import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Globe, ShoppingBag, Sparkles, Save, Loader2, Building2, Link as LinkIcon, Wand2, Palette, Target, RefreshCcw, Radar, ScanSearch, FileText, Plus, Trash2, FolderInput } from "lucide-react";
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

export interface OrgDocument {
  url: string;
  title: string;
  type?: string;
  source_page?: string;
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
  const [sources, setSources] = useState<any[]>([]);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [newsPath, setNewsPath] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [newDocUrl, setNewDocUrl] = useState("");
  const [importingDocs, setImportingDocs] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);


  const loadSources = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("org_external_sources" as any)
      .select("*")
      .eq("organization_id", orgId);
    setSources(((data as any) || []));
  };

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
        const docs = (p as Record<string, unknown>).documents;
        setDocuments(Array.isArray(docs) ? (docs as OrgDocument[]) : []);
      }
    await loadSources();
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
    // Merge newly discovered documents / regulations with existing ones
    const fetched = Array.isArray(data.documents) ? (data.documents as OrgDocument[]) : [];
    let added = 0;
    setDocuments((prev) => {
      const seen = new Set(prev.map((d) => d.url));
      const merged = [...prev];
      for (const d of fetched) {
        if (!d?.url || seen.has(d.url)) continue;
        seen.add(d.url);
        merged.push(d);
        added += 1;
      }
      return merged;
    });
    toast.success(
      added > 0
        ? `تم جلب هوية الجمعية و ${added} ملف/وثيقة`
        : "تم جلب هوية الجمعية تلقائياً"
    );
  };

  const addDocument = () => {
    const url = newDocUrl.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error("أدخل رابطاً صحيحاً"); return; }
    if (documents.some((d) => d.url === url)) { toast.info("الملف مضاف مسبقاً"); return; }
    const name = decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).pop() || "مستند");
    setDocuments((prev) => [...prev, { url, title: name, type: "ملف" }]);
    setNewDocUrl("");
  };

  const removeDocument = (url: string) => {
    setDocuments((prev) => prev.filter((d) => d.url !== url));
  };

  const uploadLocalFiles = async (fileList: FileList | null) => {
    if (!orgId || !fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const tooBig = files.find((f) => f.size > 25 * 1024 * 1024);
    if (tooBig) { toast.error(`حجم الملف «${tooBig.name}» يتجاوز 25 ميجابايت`); return; }
    setUploadingFiles(true);
    try {
      const payload = await Promise.all(
        files.map(async (f) => {
          const buf = new Uint8Array(await f.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 8192) {
            bin += String.fromCharCode(...buf.subarray(i, i + 8192));
          }
          return { name: f.name, content_type: f.type || "application/octet-stream", data_base64: btoa(bin) };
        })
      );
      const { data, error } = await supabase.functions.invoke("import-org-documents", {
        body: { organization_id: orgId, files: payload },
      });
      if (error || !data?.success) {
        toast.error(`تعذّر إرفاق الملفات${error?.message ? ` — ${error.message}` : ""}`);
        return;
      }
      const imported = Number(data.imported || 0);
      const firstReason = (data.results || []).find((r: any) => !r.ok && r.reason)?.reason;
      if (imported === 0) {
        toast.error(`تعذّر إرفاق الملفات${firstReason ? ` — ${firstReason}` : ""}`);
        return;
      }
      toast.success(`تم إرفاق ${imported} ملف في مركز ملفات الجمعية`);
    } catch (e) {
      toast.error(`تعذّر إرفاق الملفات — ${e instanceof Error ? e.message : "خطأ غير متوقع"}`);
    } finally {
      setUploadingFiles(false);
    }
  };

  const importDocuments = async () => {
    if (!orgId) return;
    if (documents.length === 0) { toast.info("لا توجد ملفات لإضافتها"); return; }
    setImportingDocs(true);
    await save();
    const { data, error } = await supabase.functions.invoke("import-org-documents", {
      body: { organization_id: orgId, documents },
    });
    setImportingDocs(false);
    if (error || !data?.success) {
      toast.error(`تعذّر إضافة الملفات إلى مركز الملفات${error?.message ? ` — ${error.message}` : ""}`);
      return;
    }
    const imported = Number(data.imported || 0);
    const skipped = Number(data.skipped || 0);
    const firstReason = (data.results || []).find((r: any) => !r.ok && r.reason)?.reason;
    if (imported === 0 && skipped > 0) { toast.info("جميع الملفات مضافة مسبقاً"); return; }
    if (imported === 0) {
      toast.error("تعذّر تنزيل الملفات من الموقع" + (firstReason ? ` — ${firstReason}` : ""));
      return;
    }
    toast.success(`تمت إضافة ${imported} ملف إلى مركز الملفات${skipped ? ` (${skipped} مكرر)` : ""}`);
  };


  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase
      .from("organization_profiles")
      .upsert({ organization_id: orgId, ...form, documents: documents as unknown as never }, { onConflict: "organization_id" });
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

  const KIND_LABEL: Record<string, string> = {
    website: "الموقع الإلكتروني", store: "المتجر / صفحة التبرع",
    twitter: "تويتر / X", instagram: "إنستغرام", tiktok: "تيك توك",
    snapchat: "سناب شات", youtube: "يوتيوب", facebook: "فيسبوك", linkedin: "لينكدإن",
  };

  // Build the list of syncable channels from the profile fields
  const syncTargets = useMemo(() => {
    const map: { key: keyof ProfileForm; kind: string }[] = [
      { key: "website_url", kind: "website" },
      { key: "store_url", kind: "store" },
      { key: "twitter_url", kind: "twitter" },
      { key: "instagram_url", kind: "instagram" },
      { key: "tiktok_url", kind: "tiktok" },
      { key: "snapchat_url", kind: "snapchat" },
      { key: "youtube_url", kind: "youtube" },
      { key: "facebook_url", kind: "facebook" },
      { key: "linkedin_url", kind: "linkedin" },
    ];
    return map
      .filter((t) => (form[t.key] || "").trim().length > 0)
      .map((t) => {
        const url = form[t.key].trim();
        const existing = sources.find((s) => s.kind === t.kind && s.url === url);
        return { ...t, url, existing };
      });
  }, [form, sources]);

  const websiteSource = sources.find((s) => s.kind === "website");
  useEffect(() => {
    setNewsPath(websiteSource?.news_path ?? "");
  }, [websiteSource?.id]);

  const syncOne = async (target: { kind: string; url: string; existing: any }) => {
    if (!orgId) return;
    const key = `${target.kind}:${target.url}`;
    setSyncingKey(key);
    try {
      let sourceId = target.existing?.id as string | undefined;
      if (!sourceId) {
        const insertPayload: any = {
          organization_id: orgId,
          kind: target.kind,
          url: target.url,
          label: KIND_LABEL[target.kind] || target.kind,
        };
        if (target.kind === "website" && newsPath.trim()) insertPayload.news_path = newsPath.trim();
        const { data, error } = await supabase
          .from("org_external_sources" as any)
          .insert(insertPayload)
          .select("id")
          .single();
        if (error) throw error;
        sourceId = (data as any).id;
      } else if (target.kind === "website" && (target.existing.news_path ?? "") !== newsPath.trim()) {
        await supabase
          .from("org_external_sources" as any)
          .update({ news_path: newsPath.trim() || null })
          .eq("id", sourceId);
      }
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("sync-external-source", { body: { source_id: sourceId } });
      if (fnErr) throw fnErr;
      if (fnData?.skipped) {
        toast.warning(fnData.message || "تم تخطّي هذا المصدر");
      } else {
        toast.success("تمت المزامنة بنجاح");
      }
      await loadSources();
    } catch (e: any) {
      toast.error("تعذّرت المزامنة: " + (e?.message || ""));
    } finally {
      setSyncingKey(null);
    }
  };

  const syncAll = async () => {
    for (const t of syncTargets) {
      await syncOne(t);
    }
  };

  const discoverAccounts = async () => {
    if (!orgId) return;
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("discover-org-accounts", {
        body: { organization_id: orgId, overwrite: false },
      });
      if (error) throw error;
      const found: Record<string, { url: string }> = (data as any)?.discovered || {};
      const keys = Object.keys(found);
      if (keys.length === 0) {
        toast.info("لم يتم العثور على حسابات إضافية موثوقة");
      } else {
        toast.success(`تم اكتشاف ${keys.length} حساب/حسابات بنجاح`);
        // Update the form with newly discovered URLs
        setForm((prev) => {
          const next = { ...prev } as any;
          const map: Record<string, string> = {
            twitter: "twitter_url", instagram: "instagram_url", tiktok: "tiktok_url",
            snapchat: "snapchat_url", youtube: "youtube_url", facebook: "facebook_url", linkedin: "linkedin_url",
          };
          for (const k of keys) {
            const field = map[k]; if (!field) continue;
            if (!next[field]) next[field] = found[k].url;
          }
          return next;
        });
        // Persist + reload sources
        await loadSources();
      }
    } catch (e: any) {
      toast.error("تعذّر الاكتشاف: " + (e?.message || ""));
    } finally {
      setDiscovering(false);
    }
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
        {/* Header — same style as Admin Settings page */}
        <div
          className="flex items-center gap-4 rounded-2xl p-5 shadow-card text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(190 55% 26%) 0%, hsl(195 65% 18%) 60%, hsl(200 70% 14%) 100%)" }}
        >
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-300/60 rounded-tl-md" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-300/60 rounded-br-md" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/organizations")} className="gap-1 text-white hover:bg-white/10 relative z-10">
            <ArrowRight className="w-4 h-4" /> رجوع
          </Button>
          <div className="w-14 h-14 rounded-2xl bg-white/10 ring-2 ring-amber-300/60 flex items-center justify-center shadow-lg overflow-hidden relative z-10">
            {form.logo_url ? (
              <img src={form.logo_url} alt={orgName} className="w-full h-full object-contain p-1 bg-white/90" />
            ) : (
              <Building2 className="w-7 h-7 text-amber-200" />
            )}
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white">{orgName}</h1>
            <p className="text-amber-100/80 text-sm">التعرف على الجمعية وهويتها البصرية</p>
          </div>
        </div>

        {/* 1) Website URL on top — triggers identity extraction */}
        <div
          className="rounded-2xl p-6 shadow-card text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(190 55% 26%) 0%, hsl(195 65% 18%) 60%, hsl(200 70% 14%) 100%)" }}
        >
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-300/60 rounded-tl-md" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-300/60 rounded-br-md" />
          <div className="relative z-10">
            <h2 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
              <div className="w-9 h-9 rounded-lg bg-white/10 ring-1 ring-amber-300/50 flex items-center justify-center">
                <Globe className="w-5 h-5 text-amber-200" />
              </div>
              الموقع الإلكتروني للجمعية
              {extracting && (
                <span className="text-xs text-amber-100/80 flex items-center gap-1 font-normal">
                  <Loader2 className="w-3 h-3 animate-spin" /> جاري قراءة الموقع...
                </span>
              )}
            </h2>
            <p className="text-xs text-amber-100/70 mb-4">
              بمجرد إدخال الموقع، تقوم المنصة تلقائياً بجلب الشعار، الألوان، المتجر، وحسابات التواصل.
            </p>
            <div className="flex gap-2">
              <Input
                dir="ltr" placeholder="https://..." value={form.website_url}
                onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                onBlur={(e) => autoExtract(e.target.value)}
                className="flex-1 bg-white/95 text-foreground border-amber-300/40 placeholder:text-muted-foreground focus-visible:ring-amber-300"
              />
              <Button
                type="button"
                className="gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold shadow-md"
                onClick={() => autoExtract(form.website_url)}
                disabled={!form.website_url || extracting}
              >
                <Wand2 className="w-3.5 h-3.5" />
                {extracting ? "جاري الجلب..." : "جلب الهوية"}
              </Button>
            </div>
          </div>
        </div>

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

        {/* 4.5) Documents & regulations fetched from the website */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> المرفقات والوثائق
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                اللوائح والتقارير والسياسات التي تم جلبها من موقع الجمعية، وتُستخدم لتعزيز دقة التحليل الذكي.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{documents.length} ملف</Badge>
              <Button type="button" size="sm" variant="outline" onClick={importDocuments}
                disabled={importingDocs || documents.length === 0} className="gap-1.5">
                {importingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                إضافة الملفات إلى مركز الملفات
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Input
              dir="ltr"
              placeholder="https://... رابط لائحة أو تقرير"
              value={newDocUrl}
              onChange={(e) => setNewDocUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDocument(); } }}
            />
            <Button type="button" variant="outline" onClick={addDocument} className="gap-1.5 flex-shrink-0">
              <Plus className="w-4 h-4" /> إضافة
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              لا توجد وثائق بعد. اضغط «جلب الهوية» أعلاه لاستخراج اللوائح والتقارير من الموقع.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.url} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{d.type || "ملف"}</Badge>
                      <span className="text-sm font-medium truncate">{d.title}</span>
                    </div>
                    <a href={d.url} target="_blank" rel="noreferrer" dir="ltr" className="text-[11px] text-primary hover:underline truncate block mt-1">
                      {d.url}
                    </a>
                  </div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeDocument(d.url)} className="flex-shrink-0 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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

        {/* 6) Periodic external sources sync */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Radar className="w-5 h-5 text-primary" /> المزامنة الدورية للمصادر الخارجية
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                النظام يقرأ روابط الجمعية أعلاه (الموقع، المتجر، حسابات التواصل) ويستخرج المحتوى تلقائياً لإثراء التقارير والتحليلات.
              </p>
            </div>
            <Button
              size="sm"
              onClick={syncAll}
              disabled={syncTargets.length === 0 || syncingKey !== null}
              className="gap-2"
            >
              <RefreshCcw className={`w-4 h-4 ${syncingKey ? "animate-spin" : ""}`} />
              مزامنة الكل
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={discoverAccounts}
              disabled={discovering}
              className="gap-2"
            >
              {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              اكتشاف الحسابات تلقائياً
            </Button>
          </div>

          {form.website_url && (
            <div className="mb-4 p-3 rounded-lg border bg-muted/30 space-y-2">
              <Label className="text-xs">مسار قسم الأخبار في الموقع (اختياري)</Label>
              <Input
                dir="ltr"
                placeholder="/news أو /articles"
                value={newsPath}
                onChange={(e) => setNewsPath(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                اتركه فارغاً ليُكتشف القسم تلقائياً (news / articles / media / blog / أخبار…).
              </p>
            </div>
          )}

          {syncTargets.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              أضف الموقع أو حسابات التواصل أعلاه لتفعيل المزامنة.
            </div>
          ) : (
            <div className="space-y-2">
              {syncTargets.map((t) => {
                const key = `${t.kind}:${t.url}`;
                const isSyncing = syncingKey === key;
                const last = t.existing?.last_synced_at;
                const status = t.existing?.last_status;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[t.kind] || t.kind}</Badge>
                        <a href={t.url} target="_blank" rel="noreferrer" dir="ltr" className="text-xs text-primary hover:underline truncate">
                          {t.url}
                        </a>
                      </div>
                      {last && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          آخر مزامنة: {new Date(last).toLocaleString("ar-SA-u-nu-latn")}
                          {status && <span> · {status}</span>}
                        </div>
                      )}
                      {t.existing?.summary && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.existing.summary}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncOne(t)}
                      disabled={isSyncing}
                      className="gap-1.5 flex-shrink-0"
                    >
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                      مزامنة
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
    governance_documents: "الوثائق واللوائح",
    recommendations_for_innovation: "توصيات للابتكار",
    summary: "ملخص شامل",
  };
  return map[key] || key;
}