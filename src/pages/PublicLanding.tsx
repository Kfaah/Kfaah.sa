import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getArabicErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KafaaLogoArtworkCropped } from "@/components/brand/PlatformBrand";
import SpaceScene from "@/components/space/SpaceScene";
const normalizeDigits = (value: string, trim = false) => {
  const input = trim ? value.trim() : value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
};

const Icon = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center justify-center ${className}`} aria-hidden="true">
    {children}
  </span>
);

export default function PublicLanding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // If already logged in, route by role
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      // Honor stored admin destination (e.g. /inbox, /platform-mail)
      const dest = sessionStorage.getItem("adminPostLoginPath");
      if (dest) {
        sessionStorage.removeItem("adminPostLoginPath");
        navigate(dest, { replace: true });
        return;
      }
      const { data: superCheck } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      navigate(superCheck ? "/admin" : "/app", { replace: true });
    })();
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: normalizedPassword,
      });
      if (error) throw error;

      const dest = sessionStorage.getItem("adminPostLoginPath");
      if (dest) {
        sessionStorage.removeItem("adminPostLoginPath");
        toast.success("تم تسجيل الدخول بنجاح");
        navigate(dest, { replace: true });
        return;
      }

      const { data: superCheck } = await supabase.rpc("is_super_admin", {
        _user_id: data.user.id,
      });
      toast.success("تم تسجيل الدخول بنجاح");
      navigate(superCheck ? "/admin" : "/app", { replace: true });
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ أثناء تسجيل الدخول"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      dir="rtl"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)",
      }}
    >
      {/* 3D space scene: stars, planets, nebulae */}
      <SpaceScene />

      {/* Soft vignette to keep UI readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, hsl(230 80% 3% / 0.6) 100%)",
        }}
      />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-0 items-center justify-items-center">
          {/* RIGHT (RTL first): logo matched to the login block height */}
          <div className="relative hidden md:flex items-center justify-center animate-fade-in order-1 w-[22rem] h-[24rem] -translate-y-6 md:-ml-6 lg:-ml-8 overflow-visible">
            <KafaaLogoArtworkCropped
              className="relative h-full w-full object-contain"
              style={{
                filter:
                  "drop-shadow(0 0 30px hsl(0 0% 100% / 0.35)) drop-shadow(0 24px 48px hsl(220 75% 3% / 0.55))",
              }}
            />
          </div>

          {/* LEFT (RTL second): Login card + feature pills below */}
          <div className="flex flex-col justify-center gap-4 order-2 animate-scale-in w-full max-w-md md:justify-self-start md:-mr-10 lg:-mr-14">
            <Card
              dir="rtl"
              className="relative w-full border border-cyan-200/70 shadow-2xl bg-white"
              style={{
                boxShadow:
                  "0 30px 60px -12px rgba(0,0,0,0.35), 0 0 0 1px rgba(8,145,178,0.08)",
              }}
            >
          <CardHeader className="text-center space-y-2 pb-4 pt-7">
            <CardTitle className="text-2xl md:text-3xl text-cyan-700 font-extrabold tracking-tight">دخول مدير النظام</CardTitle>
            <CardDescription className="text-slate-600 text-sm">
              بوابة آمنة للتحكم الكامل بالمنصة
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-right" dir="rtl">
                <Label htmlFor="username" className="block w-full text-right text-cyan-700 text-sm font-semibold">
                  اسم المستخدم / رقم الهوية
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="أدخل رقم الهوية"
                  className="h-11 text-right bg-white border-cyan-200 text-slate-900 text-sm placeholder:text-slate-400 focus-visible:ring-cyan-400/50"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2 text-right" dir="rtl">
                <Label htmlFor="password" className="block w-full text-right text-cyan-700 text-sm font-semibold">
                  كلمة المرور
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
                    className="h-11 pe-10 text-right bg-white border-cyan-200 text-slate-900 text-sm placeholder:text-slate-400 focus-visible:ring-cyan-400/50"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 hover:text-cyan-800"
                  >
                    {showPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 gap-2 text-base bg-gradient-to-l from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-bold shadow-lg shadow-cyan-500/40 border-0"
                disabled={loading}
              >
                {loading ? <span className="animate-spin">⏳</span> : <Icon className="text-lg">↤</Icon>}
                تسجيل الدخول
              </Button>
            </form>
          </CardContent>
        </Card>

            {/* Feature pills below the login card */}
            <div className="flex flex-wrap gap-2 justify-center">
              {["إدارة متعددة الجمعيات", "تقارير لحظية", "ذكاء اصطناعي"].map((t) => (
                <span
                  key={t}
                  className="px-4 py-1.5 rounded-full border border-cyan-300/70 bg-white text-xs md:text-sm text-cyan-700 font-semibold shadow-lg"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center text-slate-200/80 text-sm py-4">
        <div className="max-w-3xl mx-auto px-4 space-y-2">
          <p className="text-sm md:text-base text-slate-200/90 leading-relaxed">
            <span className="text-cyan-300 font-bold">منصة إدارة التسويق الإلكتروني للجمعيات بالذكاء الاصطناعي</span> — منصة موحدة تتيح للجمعيات إدارة حملاتها التسويقية، متابعة المتبرعين، وقياس الأداء بكفاءة عالية.
          </p>
          <p className="text-xs text-slate-400/70 pt-1">
            جميع الحقوق محفوظة لمنصة كفاءة الإلكترونية © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
