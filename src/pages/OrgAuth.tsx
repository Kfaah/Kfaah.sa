import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getArabicErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff, Building2, ArrowRight } from "lucide-react";

interface OrgInfo {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  is_active: boolean;
  allow_self_signup: boolean;
}

const normalizeDigits = (value: string, trim = false) => {
  const input = trim ? value.trim() : value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
};

export default function OrgAuth() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Load org by slug
  useEffect(() => {
    if (!slug) {
      setOrgError("الرابط غير صالح");
      setOrgLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_organization_by_slug", { _slug: slug });
      if (error || !data || data.length === 0) {
        setOrgError("لم يتم العثور على الجمعية أو أنها غير نشطة");
      } else {
        setOrg(data[0] as OrgInfo);
      }
      setOrgLoading(false);
    })();
  }, [slug]);

  // If a regular (non-super-admin) user is already logged in, send them straight
  // into this org's workspace. Super admins should still see the org login page
  // so they can sign in as a member of that specific organization if needed.
  useEffect(() => {
    if (authLoading || !user || !slug) return;
    (async () => {
      const { data: superCheck } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (!superCheck) {
        navigate(`/${slug}/app`, { replace: true });
      }
    })();
  }, [user, authLoading, navigate, slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setLoading(true);
    try {
      const normalized = normalizeDigits(username, true);
      const cleaned = normalized.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (!cleaned) {
        toast.error("يرجى إدخال رقم الهوية");
        setLoading(false);
        return;
      }
      const loginEmail = `${cleaned}@user.local`;
      const normalizedPassword = normalizeDigits(password, true);

      if (isLogin) {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: normalizedPassword,
        });
        if (error) throw error;
        const { data: superCheck } = await supabase.rpc("is_super_admin", {
          _user_id: signInData.user.id,
        });
        toast.success("تم تسجيل الدخول بنجاح");
        navigate(superCheck ? "/admin" : "/app", { replace: true });
      } else {
        if (!org.allow_self_signup) {
          toast.error("التسجيل الذاتي معطّل لهذه الجمعية. يرجى التواصل مع المسؤول");
          setLoading(false);
          return;
        }
        if (!email || !phone) {
          toast.error("يرجى إدخال البريد الإلكتروني ورقم الجوال");
          setLoading(false);
          return;
        }
        const redirectUrl = `${window.location.origin}/app`;
        const { error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password: normalizedPassword,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              first_name: firstName,
              last_name: lastName,
              username,
              email,
              phone,
            },
          },
        });
        if (signUpError) throw signUpError;

        // Sign in immediately to attach org membership
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: normalizedPassword,
        });
        if (signInError) throw signInError;

        const { error: joinError } = await supabase.rpc("join_organization_by_slug", {
          _slug: org.slug!,
        });
        if (joinError) throw joinError;

        toast.success(`تم إنشاء حسابك في ${org.name}`);
        navigate("/app", { replace: true });
      }
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ"));
    } finally {
      setLoading(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (orgError || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4" dir="rtl">
        <Card className="max-w-md w-full text-center shadow-xl">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <Building2 className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>الجمعية غير متاحة</CardTitle>
            <CardDescription>{orgError || "لم يتم العثور على الجمعية"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="w-4 h-4" /> العودة للصفحة الرئيسية
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Org branding */}
        <div className="text-center mb-6">
          <div className="mx-auto w-24 h-24 rounded-2xl bg-white shadow-lg border border-border flex items-center justify-center overflow-hidden mb-4">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain p-2" />
            ) : (
              <Building2 className="w-12 h-12 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">نظام إدارة التسويق الإلكتروني</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "أدخل بياناتك للدخول إلى لوحة الجمعية" : `سيتم ربط حسابك تلقائياً بـ ${org.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm">الاسم الأول</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="محمد" className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm">اسم العائلة</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="العلي" className="h-11" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="flex items-center gap-2">
                  <User className="w-4 h-4" /> رقم الهوية
                </Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="أدخل رقم الهوية الوطنية" className="h-11" dir="ltr" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" /> كلمة المرور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="h-11 pe-10"
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> البريد الإلكتروني *
                    </Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="example@email.com" className="h-11" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <User className="w-4 h-4" /> رقم الجوال *
                    </Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+966 5x xxx xxxx" className="h-11" dir="ltr" />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full h-12 gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90" disabled={loading}>
                {loading ? <span className="animate-spin">⏳</span> : isLogin ? <><LogIn className="w-5 h-5" /> تسجيل الدخول</> : <><UserPlus className="w-5 h-5" /> إنشاء حساب</>}
              </Button>
            </form>

            {org.allow_self_signup && (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-accent hover:underline font-medium text-sm">
                  {isLogin ? "ليس لديك حساب؟ أنشئ حساباً جديداً" : "لديك حساب؟ سجل الدخول"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> هذه ليست جمعيتك؟ ارجع للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
