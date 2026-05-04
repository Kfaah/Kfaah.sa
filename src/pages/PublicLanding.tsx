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
import { KafaaLogoArtwork } from "@/components/brand/PlatformBrand";

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
          "radial-gradient(ellipse at 30% 20%, hsl(195 80% 22%) 0%, hsl(210 70% 14%) 45%, hsl(220 75% 8%) 100%)",
      }}
    >
      {/* Animated aurora orbs */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-cyan-400/20 blur-[120px] pointer-events-none animate-pulse-subtle" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none animate-pulse-subtle" style={{ animationDelay: "1s" }} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-300/40"
            style={{
              top: `${(i * 53) % 100}%`,
              left: `${(i * 37) % 100}%`,
              animation: `pulse-subtle ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-0 items-center justify-items-center">
          {/* RIGHT (RTL first): logo without frame, larger */}
          <div className="relative flex items-center justify-center md:justify-end animate-fade-in order-1 w-full min-h-[28rem] md:min-h-[34rem] md:-ml-10 lg:-ml-14">
            <KafaaLogoArtwork
              className="relative w-full max-w-[31rem] md:max-w-[38rem] lg:max-w-[42rem] h-auto"
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
              className="relative w-full border border-white/15 shadow-2xl bg-white/[0.08] backdrop-blur-2xl"
              style={{
                boxShadow:
                  "0 30px 60px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
          <CardHeader className="text-center space-y-2 pb-4 pt-7">
            <CardTitle className="text-2xl md:text-3xl text-white font-extrabold tracking-tight">دخول مدير النظام</CardTitle>
            <CardDescription className="text-slate-300 text-sm">
              بوابة آمنة للتحكم الكامل بالمنصة
            </CardDescription>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-right" dir="rtl">
                <Label htmlFor="username" className="block w-full text-right text-slate-200 text-sm">
                  اسم المستخدم / رقم الهوية
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="أدخل رقم الهوية"
                  className="h-11 text-right bg-white/10 border-white/20 text-white text-sm placeholder:text-slate-400 focus-visible:ring-cyan-400/50"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2 text-right" dir="rtl">
                <Label htmlFor="password" className="block w-full text-right text-slate-200 text-sm">
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
                    className="h-11 pe-10 text-right bg-white/10 border-white/20 text-white text-sm placeholder:text-slate-400 focus-visible:ring-cyan-400/50"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white"
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
                  className="px-4 py-1.5 rounded-full bg-white/10 border border-cyan-300/30 text-xs md:text-sm text-cyan-100 backdrop-blur-md shadow-lg"
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
            © {new Date().getFullYear()} منصة كفاءة — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}
