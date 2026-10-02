import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import MemberRolesSettings from "@/pages/settings/MemberRolesSettings";
import { fetchAllReportRows } from "@/lib/fetchAllReportRows";
import { DEFAULT_ADMIN_BRAND, loadAdminBrand, saveAdminBrand, validAdminBrand, type AdminBrand } from "@/lib/adminBrand";

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_role: string;
  avatar_url: string | null;
};

export default function AdminSettings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileForm>({
    first_name: "", last_name: "", email: "", phone: "", job_role: "مدير النظام", avatar_url: null,
  });
  const [brand, setBrand] = useState<AdminBrand>({ ...DEFAULT_ADMIN_BRAND });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [orgs, setOrgs] = useState<Array<{id: string; name: string; slug: string | null}>>([]);
  const [selectedOrg, setSelectedOrg] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setLoadError(false);
    try {
      const [profileResult, savedBrand, organizations] = await Promise.all([supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, job_role, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle(), loadAdminBrand(user.id),
        fetchAllReportRows(supabase.from("organizations").select("id,name,slug").order("name").order("id"))]);
      if (profileResult.error) throw profileResult.error;
      const data = profileResult.data;
      setBrand(savedBrand); setOrgs(organizations);
      setSelectedOrg(current => organizations.some(org => org.id === current) ? current : organizations[0]?.id || "");
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
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [user?.id, user?.email]);
  useEffect(() => { void load(); }, [load]);

  const handleSaveProfile = async () => {
    if (!user?.id || savingProfile || uploadingAvatar || loading || loadError) return;
    if (!profile.first_name.trim() || profile.first_name.trim().length > 80 || profile.last_name.trim().length > 80 || profile.phone.length > 30 || profile.job_role.length > 120) {
      toast.error("أدخل اسمًا صحيحًا؛ الحد الأقصى للاسم 80 حرفًا، والجوال 30 حرفًا، والمسمى 120 حرفًا"); return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          email: user.email,
          first_name: profile.first_name.trim(),
          last_name: profile.last_name.trim(),
          phone: profile.phone.trim(),
          job_role: profile.job_role.trim(),
        }, { onConflict: "user_id" }).select("user_id").single();
      if (error) throw error;
      window.dispatchEvent(new Event("admin-profile-updated"));
      toast.success("تم حفظ الهوية الشخصية");
    } catch (e) {
      toast.error("تعذّر حفظ البيانات");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id || uploadingAvatar || savingProfile || loading || loadError) return;
    const extensions: Record<string,string> = { "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp" };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) { toast.error("اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 5MB"); return; }
    setUploadingAvatar(true);
    const path = `${user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    let uploaded = false;
    try {
      const { error: upErr } = await supabase.storage
        .from("avatars").upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      uploaded = true;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase
        .from("profiles").upsert({ user_id:user.id, email:user.email, avatar_url: url }, { onConflict:"user_id" }).select("user_id").single();
      if (updErr) throw updErr;
      setProfile((p) => ({ ...p, avatar_url: url }));
      // Notify sidebar/header to refresh immediately
      window.dispatchEvent(new CustomEvent("admin-profile-updated"));
      toast.success("تم تحديث الصورة");
    } catch (e) {
      if (uploaded) await supabase.storage.from("avatars").remove([path]);
      toast.error("تعذّر رفع الصورة");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!user?.id || savingBrand || loading || loadError) return;
    if (!validAdminBrand(brand)) { toast.error("أدخل لونًا صحيحًا بصيغة #RRGGBB في كل حقل"); return; }
    setSavingBrand(true);
    try { setBrand(await saveAdminBrand(user.id,brand)); toast.success("تم حفظ الألوان وتطبيقها على لوحة المدير"); }
    catch { toast.error("تعذر حفظ الألوان. لم يتم تأكيد التغيير."); }
    finally { setSavingBrand(false); }
  };

  const initials = `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "م";
  if (loading) return <div className="p-10 text-white" role="status">جارٍ تحميل إعدادات المدير…</div>;
  if (loadError) return <div className="p-10 space-y-4 text-white" role="alert"><p>تعذر تحميل إعدادات المدير. أعد المحاولة قبل إجراء التعديلات.</p><Button onClick={load}>إعادة المحاولة</Button></div>;

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
        <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full h-auto gap-1 bg-slate-100 p-1" dir="rtl">
          <TabsTrigger value="identity" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow font-semibold text-slate-600">
            <UserCog className="w-4 h-4" /> الهوية الشخصية
          </TabsTrigger>
          <TabsTrigger value="brand" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow font-semibold text-slate-600">
            <Palette className="w-4 h-4" /> الهوية المرئية
          </TabsTrigger>
          <TabsTrigger value="welcome" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow font-semibold text-slate-600">
            <Sparkles className="w-4 h-4" /> شاشة الترحيب
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow font-semibold text-slate-600">
            <LayoutGrid className="w-4 h-4" /> عام
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2 h-10 data-[state=active]:bg-white data-[state=active]:text-primary font-semibold text-slate-600"><UserCog className="w-4 h-4" /> المستخدمون والصلاحيات</TabsTrigger>
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
                    id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAvatarUpload(f); e.target.value=""; }}
                    disabled={uploadingAvatar || savingProfile}
                  />
                </Label>
                <p className="text-xs text-muted-foreground">PNG/JPG/WebP حتى 5MB — تظهر مباشرة في القائمة الجانبية.</p>
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
                <Button onClick={handleSaveProfile} disabled={savingProfile || uploadingAvatar} className="gap-2">
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
                ] as Array<[keyof AdminBrand, string]>
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      aria-label={label} type="color" value={/^#[\da-f]{6}$/i.test(brand[key]) ? brand[key] : DEFAULT_ADMIN_BRAND[key]}
                      onChange={(e) => setBrand({ ...brand, [key]: e.target.value })}
                      className="h-11 w-16 rounded-lg border cursor-pointer"
                    />
                    <Input aria-label={`${label} رمز اللون`} value={brand[key]} onChange={(e) => setBrand({ ...brand, [key]: e.target.value })} className="font-mono text-sm" dir="ltr" />
                  </div>
                </div>
              ))}
              <div className="md:col-span-2">
                <Separator className="my-2" />
                <div className="flex flex-wrap gap-3 justify-between items-center">
                  <p className="text-xs text-muted-foreground">تُحفظ الألوان لحسابك على الخادم وتُطبّق على لوحة المدير في أجهزتك بعد الحفظ.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={savingBrand} onClick={() => setBrand({ ...DEFAULT_ADMIN_BRAND })}>استعادة الافتراضي</Button>
                    <Button onClick={handleSaveBrand} disabled={savingBrand} className="gap-2"><Save className="w-4 h-4" /> {savingBrand ? "جارٍ الحفظ…" : "حفظ الهوية"}</Button>
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
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline"><Link to="/admin/organizations">إدارة الجمعيات والاشتراكات</Link></Button>
              <Button asChild variant="outline"><Link to="/internal-inbox">مراسلات الجمعيات</Link></Button>
              <Button asChild variant="outline"><Link to="/platform-mail">بريد منصة كفاءة</Link></Button>
              <Button asChild variant="outline"><Link to="/admin/reports">التقارير والتصدير</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="members" className="mt-6 space-y-5">
          <Label>الجمعية التي تريد إدارة أعضائها</Label>
          <Select value={selectedOrg} onValueChange={setSelectedOrg} dir="rtl"><SelectTrigger aria-label="جمعية إدارة الأعضاء"><SelectValue placeholder="اختر الجمعية" /></SelectTrigger><SelectContent>{orgs.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}</SelectContent></Select>
          {selectedOrg ? <MemberRolesSettings key={selectedOrg} orgIdProp={selectedOrg} embedded /> : <p>لا توجد جمعيات متاحة.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
