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
import { Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff, Building2, ArrowRight, Phone } from "lucide-react";

interface OrgInfo {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  is_active: boolean;
  allow_self_signup: boolean;
  contact_email?: string | null;
  contact_phone?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
}

const normalizeDigits = (value: string, trim = false) => {
  const input = trim ? value.trim() : value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
};

/** Convert "#rrggbb" → "h s% l%" string for CSS HSL tokens. */
function hexToHsl(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      case b: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function OrgAuth() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

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
        setOrgLoading(false);
        return;
      }
      const baseOrg = data[0] as OrgInfo;
      // Pull richer branding (colors + contact) without requiring auth
      const [{ data: orgRow }, { data: profRow }] = await Promise.all([
        supabase
          .from("organizations")
          .select("contact_email, contact_phone, logo_url")
          .eq("id", baseOrg.id)
          .maybeSingle(),
        supabase
          .from("organization_profiles")
          .select("logo_url, primary_color, accent_color")
          .eq("organization_id", baseOrg.id)
          .maybeSingle(),
      ]);
      setOrg({
        ...baseOrg,
        logo_url: profRow?.logo_url || orgRow?.logo_url || baseOrg.logo_url,
        contact_email: orgRow?.contact_email ?? null,
        contact_phone: orgRow?.contact_phone ?? null,
        primary_color: profRow?.primary_color ?? null,
        accent_color: profRow?.accent_color ?? null,
      });
      setOrgLoading(false);
    })();
  }, [slug]);

  // If a regular (non-super-admin) user is already logged in, send them straight
  // into this org's workspace. Super admins should still see the org login page
  // so they can sign in as a member of that specific organization if needed.
  useEffect(() => {
    if (authLoading || !user || !slug || !org) return;
    (async () => {
      const { data: superCheck } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (!superCheck) {
        const { data: membership } = await supabase
          .from("user_organizations")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("organization_id", org.id)
          .maybeSingle();

        if (membership) {
          navigate(`/${slug}/app`, { replace: true });
        } else {
          await signOut();
        }
      }
    })();
  }, [user, authLoading, navigate, slug, org, signOut]);

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
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: normalizedPassword,
        });
        if (error) throw error;

        toast.success("تم تسجيل الدخول بنجاح");
        navigate(`/${slug}/app`, { replace: true });
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
        const redirectUrl = `${window.location.origin}/${slug}/app`;
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
        navigate(`/${slug}/app`, { replace: true });
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

  const primaryHsl = hexToHsl(org.primary_color) || "210 60% 28%";
  const accentHsl  = hexToHsl(org.accent_color)  || "174 52% 52%";
  const brandStyle = {
    ["--brand-primary" as any]: primaryHsl,
    ["--brand-accent"  as any]: accentHsl,
  } as React.CSSProperties;

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      dir="rtl"
      style={{
        ...brandStyle,
        background: `radial-gradient(circle at 20% 10%, hsl(${accentHsl} / 0.18), transparent 55%),
                     radial-gradient(circle at 80% 90%, hsl(${primaryHsl} / 0.18), transparent 55%),
                     linear-gradient(135deg, hsl(${primaryHsl} / 0.08) 0%, hsl(0 0% 98%) 50%, hsl(${accentHsl} / 0.08) 100%)`,
      }}
    >
      {/* Decorative ambient blobs */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
        style={{ background: `hsl(${primaryHsl} / 0.45)` }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-40"
        style={{ background: `hsl(${accentHsl} / 0.45)` }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md">
        {/* Org branding with orbiting rings */}
        <div className="text-center mb-7">
          <div className="relative mx-auto w-44 h-44 mb-5">
            {/* Outer pulsing halo */}
            <div
              className="absolute inset-0 rounded-full org-halo-pulse"
              style={{
                background: `radial-gradient(circle, hsl(${accentHsl} / 0.35) 0%, transparent 70%)`,
              }}
              aria-hidden="true"
            />

            {/* Outer ring — slow clockwise, dashed */}
            <div
              className="absolute inset-0 rounded-full org-spin-slow"
              style={{
                border: `2px dashed hsl(${primaryHsl} / 0.45)`,
              }}
              aria-hidden="true"
            />

            {/* Mid ring — reverse direction, gradient conic */}
            <div
              className="absolute inset-2 rounded-full org-spin-reverse"
              style={{
                background: `conic-gradient(from 0deg, hsl(${primaryHsl}) 0%, transparent 30%, hsl(${accentHsl}) 60%, transparent 90%, hsl(${primaryHsl}) 100%)`,
                WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)",
                mask: "radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)",
              }}
              aria-hidden="true"
            />

            {/* Orbiting dots */}
            <div className="absolute inset-0 org-spin-medium" aria-hidden="true">
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-3 h-3 rounded-full shadow-lg"
                style={{ background: `hsl(${accentHsl})`, boxShadow: `0 0 12px hsl(${accentHsl})` }}
              />
            </div>
            <div className="absolute inset-0 org-spin-reverse" aria-hidden="true">
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2.5 h-2.5 rounded-full shadow-lg"
                style={{ background: `hsl(${primaryHsl})`, boxShadow: `0 0 10px hsl(${primaryHsl})` }}
              />
              <span
                className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 w-2 h-2 rounded-full shadow-lg"
                style={{ background: `hsl(${accentHsl})`, boxShadow: `0 0 8px hsl(${accentHsl})` }}
              />
            </div>

            {/* Logo card center */}
            <div
              className="absolute inset-6 rounded-full bg-white shadow-2xl flex items-center justify-center overflow-hidden"
              style={{
                boxShadow: `0 20px 50px -10px hsl(${primaryHsl} / 0.45), 0 0 0 4px white, 0 0 0 5px hsl(${primaryHsl} / 0.25)`,
              }}
            >
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="w-full h-full object-contain p-3"
                  loading="eager"
                />
              ) : (
                <Building2 className="w-12 h-12" style={{ color: `hsl(${primaryHsl})` }} />
              )}
            </div>
          </div>

          <h1
            className="text-3xl font-extrabold tracking-tight break-words leading-tight px-2"
            style={{ color: `hsl(${primaryHsl})` }}
          >
            {org.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">منصة إدارة التسويق الإلكتروني بالذكاء الاصطناعي</p>

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-2 mt-3" aria-hidden="true">
            <span className="h-px w-10" style={{ background: `hsl(${primaryHsl} / 0.4)` }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${accentHsl})` }} />
            <span className="h-px w-10" style={{ background: `hsl(${primaryHsl} / 0.4)` }} />
          </div>
        </div>

        <Card className="shadow-2xl border border-white/60 backdrop-blur-sm bg-white/95">
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

              <Button
                type="submit"
                className="w-full h-12 gap-2 text-white border-0 hover:opacity-90"
                style={{
                  background: `linear-gradient(to left, hsl(${accentHsl}), hsl(${primaryHsl}))`,
                }}
                disabled={loading}
              >
                {loading ? <span className="animate-spin">⏳</span> : isLogin ? <><LogIn className="w-5 h-5" /> تسجيل الدخول</> : <><UserPlus className="w-5 h-5" /> إنشاء حساب</>}
              </Button>
            </form>

            {org.allow_self_signup && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="hover:underline font-medium text-sm"
                  style={{ color: `hsl(${accentHsl})` }}
                >
                  {isLogin ? "ليس لديك حساب؟ أنشئ حساباً جديداً" : "لديك حساب؟ سجل الدخول"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact info chip */}
        {(org.contact_phone || org.contact_email) && (
          <div
            className="mt-4 flex items-center justify-center gap-3 text-xs px-4 py-2.5 rounded-full bg-white/70 backdrop-blur-sm border border-white/80 shadow-sm w-fit mx-auto"
            style={{ color: `hsl(${primaryHsl})` }}
          >
            {org.contact_phone && (
              <span className="inline-flex items-center gap-1.5 font-medium" dir="ltr">
                <Phone className="w-3.5 h-3.5" />
                {org.contact_phone}
              </span>
            )}
            {org.contact_phone && org.contact_email && (
              <span className="w-px h-3" style={{ background: `hsl(${primaryHsl} / 0.3)` }} />
            )}
            {org.contact_email && (
              <span className="inline-flex items-center gap-1.5 font-medium" dir="ltr">
                <Mail className="w-3.5 h-3.5" />
                {org.contact_email}
              </span>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
