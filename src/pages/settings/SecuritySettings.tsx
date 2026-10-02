import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function SecuritySettings() {
  const { slug } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState("");
  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!user?.email) return;
    if (password.length < 12) { setError("استخدم كلمة مرور من 12 حرفًا على الأقل."); return; }
    if (password !== repeat) { setError("تأكيد كلمة المرور غير مطابق."); return; }
    if (password === currentPassword) { setError("اختر كلمة مرور مختلفة عن الحالية."); return; }
    setSaving(true);
    // Verify the current password without replacing this browser's session.
    const verification = createClient(String(import.meta.env.VITE_SUPABASE_URL), String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "kfaah-password-verification" } });
    try {
      const checked = await verification.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (checked.error || checked.data.user?.id !== user.id) { setError("تعذر التحقق من كلمة المرور الحالية. تحقق منها وأعد المحاولة."); return; }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.code === "weak_password" ? "كلمة المرور ضعيفة أو مكشوفة. اختر كلمة مرور أخرى." : "تعذر تغيير كلمة المرور. أعد المحاولة أو سجّل الدخول مجددًا."); return; }
      setCurrentPassword(""); setPassword(""); setRepeat("");
      toast.success("تم تغيير كلمة المرور بنجاح");
    } catch { setError("تعذر الاتصال بالخادم. أعد المحاولة."); }
    finally { await verification.auth.signOut({ scope: "local" }).catch(() => {}); setSaving(false); }
  }
  async function revokeOthers() {
    if (!await confirm({ title: "تسجيل الخروج من الأجهزة الأخرى", description: "ستحتاج الأجهزة الأخرى إلى تسجيل الدخول مجددًا عند انتهاء جلساتها الحالية. ستبقى جلستك على هذا الجهاز مفتوحة.", confirmText: "تسجيل خروج الأجهزة الأخرى", variant: "warning" })) return;
    setRevoking(true);
    try { const { error } = await supabase.auth.signOut({ scope: "others" }); if (error) throw error; toast.success("تم إلغاء تجديد الجلسات على الأجهزة الأخرى"); }
    catch { toast.error("تعذر تسجيل خروج الأجهزة الأخرى. أعد المحاولة."); }
    finally { setRevoking(false); }
  }
  return <DashboardLayout><div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
    <div className="flex items-center justify-between gap-3"><PageHeader icon={<ShieldCheck className="w-6 h-6" />} title="الأمان والخصوصية" subtitle="إدارة أمان حسابك وكلمة المرور والجلسات" /><Button asChild variant="ghost"><Link to={slug ? `/${slug}/settings` : "/settings"}><ArrowRight className="w-4 h-4 ml-2" />عودة</Link></Button></div>
    <Card><CardContent className="p-6 space-y-3"><h2 className="font-bold">الحساب الحالي</h2><p>اسم الدخول: <span dir="auto">{user?.user_metadata?.username || user?.email || "—"}</span></p><p className="text-sm text-muted-foreground">آخر تسجيل دخول: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("ar-SA") : "غير متاح"}</p><p className="text-sm text-muted-foreground">تاريخ إنشاء الحساب: {user?.created_at ? new Date(user.created_at).toLocaleDateString("ar-SA") : "غير متاح"}</p></CardContent></Card>
    <Card><CardContent className="p-6"><form onSubmit={changePassword} className="space-y-5"><h2 className="font-bold">تغيير كلمة المرور</h2><div className="space-y-2"><Label htmlFor="current-password">كلمة المرور الحالية</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required disabled={saving} /></div><div className="space-y-2"><Label htmlFor="new-password">كلمة المرور الجديدة</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required disabled={saving} /><p className="text-xs text-muted-foreground">12 حرفًا على الأقل. استخدم عبارة مرور طويلة لا تستعملها في موقع آخر.</p></div><div className="space-y-2"><Label htmlFor="repeat-password">تأكيد كلمة المرور الجديدة</Label><Input id="repeat-password" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required disabled={saving} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={saving || !user?.email}><KeyRound className="w-4 h-4 ml-2" />{saving ? "جارٍ التغيير..." : "تغيير كلمة المرور"}</Button></form></CardContent></Card>
    <Card><CardContent className="p-6 space-y-4"><h2 className="font-bold">الأجهزة الأخرى</h2><p className="text-sm text-muted-foreground">أوقف تجديد جلسات حسابك على الأجهزة الأخرى. قد يستمر وصولها حتى انتهاء صلاحية الجلسة الحالية.</p><Button variant="outline" onClick={revokeOthers} disabled={revoking || !user}><LogOut className="w-4 h-4 ml-2" />{revoking ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج من الأجهزة الأخرى"}</Button></CardContent></Card>
  </div></DashboardLayout>;
}
