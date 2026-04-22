import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Settings as SettingsIcon, UserCog, Palette, LayoutGrid,
  Image as ImageIcon, Save, Upload, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WelcomeContentManager } from "@/components/welcome/WelcomeContentManager";

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_role: string;
  avatar_url: string | null;
};

const BRAND_KEY = "admin_brand_settings";

type BrandSettings = {
  primary: string;
  accent: string;
  sidebarFrom: string;
  sidebarTo: string;
  goldAccent: string;
};

const DEFAULT_BRAND: BrandSettings = {
  primary: "#0e7490",
  accent: "#fbbf24",
  sidebarFrom: "#164e63",
  sidebarTo: "#082f49",
  goldAccent: "#fcd34d",
};

export default function AdminSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileForm>({
    first_name: "", last_name: "", email: "", phone: "", job_role: "مدير النظام", avatar_url: null,
  });
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRAND);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, job_role, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setProfile({
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          job_role: (data as { job_role?: string }).job_role ?? "مدير النظام",
          avatar_url: data.avatar_url ?? null,
        });
      } else {
        setProfile((p) => ({ ...p, email: user.email ?? "" }));
      }
    })();

    try {
      const stored = localStorage.getItem(BRAND_KEY);
      if (stored) setBrand({ ...DEFAULT_BRAND, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, [user?.id, user?.email]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          job_role: profile.job_role,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("تم حفظ الهوية الشخصية");
    } catch (e) {
      toast.error("تعذّر حفظ البيانات");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      if (updErr) throw updErr;
      setProfile((p) => ({ ...p, avatar_url: url }));
      // Notify sidebar/header to refresh immediately
      window.dispatchEvent(new CustomEvent("admin-profile-updated"));
      toast.success("تم تحديث الصورة");
    } catch (e) {
      toast.error("تعذّر رفع الصورة");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBrand = () => {
    localStorage.setItem(BRAND_KEY, JSON.stringify(brand));
    toast.success("تم حفظ الهوية المرئية");
  };

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "م";

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div
        className="flex items-center gap-4 rounded-2xl p-5 shadow-card text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(190 55% 26%) 0%, hsl(195 65% 18%) 60%, hsl(200 70% 14%) 100%)" }}
      >
        <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-300/60 rounded-tl-md" />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-300/60 rounded-br-md" />
        <div className="w-14 h-14 rounded-2xl bg-white/10 ring-2 ring-amber-300/60 flex items-center justify-center shadow-lg">
          <SettingsIcon className="w-7 h-7 text-amber-200" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">الإعدادات الشاملة</h1>
          <p className="text-amber-100/80 text-sm">تحكّم جذري في الهوية الشخصية والمرئية وعناصر النظام</p>
        </div>
      </div>

      <Tabs defaultValue="identity" dir="rtl" className="bg-white rounded-2xl shadow-card p-4">
        <TabsList className="grid grid-cols-4 w-full h-12 bg-slate-100 p-1" dir="rtl">
          <TabsTrigger value="identity" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow font-semibold text-slate-600">
            <UserCog className="w-4 h-4" /> الهوية الشخصية
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow font-semibold text-slate-600">
            <Palette className="w-4 h-4" /> الهوية المرئية
          </TabsTrigger>
          <TabsTrigger value="welcome" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow font-semibold text-slate-600">
            <Sparkles className="w-4 h-4" /> شاشة الترحيب
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow font-semibold text-slate-600">
            <LayoutGrid className="w-4 h-4" /> عام
          </TabsTrigger>
        </TabsList>

        {/* ===== Identity ===== */}
        <TabsContent value="identity" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="w-5 h-5 text-primary" /> الصورة الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar className="w-24 h-24 ring-2 ring-amber-300/70 ring-offset-2 shadow-lg">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="avatar" className="object-cover" />}
                <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Label htmlFor="avatar-input" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow">
                    <Upload className="w-4 h-4" />
                    {uploadingAvatar ? "جارٍ الرفع..." : "اختر صورة جديدة"}
                  </div>
                  <Input
                    id="avatar-input" type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                    disabled={uploadingAvatar}
                  />
                </Label>
                <p className="text-xs text-muted-foreground">PNG/JPG — تظهر مباشرة في القائمة الجانبية.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">البيانات الأساسية</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الأول</Label>
                <Input dir="rtl" className="text-right" value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الاسم الأخير</Label>
                <Input dir="rtl" className="text-right" value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input dir="ltr" className="text-left" value={profile.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>الجوال</Label>
                <Input dir="ltr" className="text-left" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>الصفة / المسمى</Label>
                <Input dir="rtl" className="text-right" value={profile.job_role} onChange={(e) => setProfile({ ...profile, job_role: e.target.value })} placeholder="مدير النظام" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                  <Save className="w-4 h-4" /> {savingProfile ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Brand ===== */}
        <TabsContent value="brand" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ألوان الهوية</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(
                [
                  ["primary", "اللون الأساسي"],
                  ["accent", "اللون المميز"],
                  ["sidebarFrom", "بداية تدرّج الشريط الجانبي"],
                  ["sidebarTo", "نهاية تدرّج الشريط الجانبي"],
                  ["goldAccent", "اللمسة الذهبية"],
                ] as Array<[keyof BrandSettings, string]>
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={brand[key]}
                      onChange={(e) => setBrand({ ...brand, [key]: e.target.value })}
                      className="h-11 w-16 rounded-lg border cursor-pointer"
                    />
                    <Input value={brand[key]} onChange={(e) => setBrand({ ...brand, [key]: e.target.value })} className="font-mono text-sm" />
                  </div>
                </div>
              ))}
              <div className="md:col-span-2">
                <Separator className="my-2" />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">يتم تطبيق الألوان على شارات المعاينة والصفحات المخصّصة.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBrand(DEFAULT_BRAND)}>استعادة الافتراضي</Button>
                    <Button onClick={handleSaveBrand} className="gap-2"><Save className="w-4 h-4" /> حفظ الهوية</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">معاينة مباشرة</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl p-6 text-white shadow-lg"
                style={{ background: `linear-gradient(160deg, ${brand.sidebarFrom}, ${brand.sidebarTo})` }}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 ring-2" style={{ boxShadow: `0 0 0 2px ${brand.goldAccent}` }}>
                    {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-bold">{profile.first_name} {profile.last_name}</div>
                    <div className="text-xs" style={{ color: brand.goldAccent }}>{profile.job_role}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Welcome ===== */}
        <TabsContent value="welcome" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إدارة شاشة الترحيب</CardTitle>
            </CardHeader>
            <CardContent>
              <WelcomeContentManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== General ===== */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">إعدادات عامة</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              ستُضاف هنا إعدادات الإشعارات، النسخ الاحتياطي، والتكاملات تباعًا.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}