import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Lock, User, LogIn, Eye, Building2, Info, LifeBuoy, Sparkles } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { toast } from "sonner";

const DEMO_NAME = "جمعية النموذج الخيري";
const DEMO_TAGLINE = "منصة إدارة التسويق الإلكتروني بالذكاء الاصطناعي";
const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

/**
 * /demo — public demo entry. Shows the same login UX a real organization
 * would show, branded as "جمعية النموذج الخيري", with the credential fields
 * disabled (read-only) and a single "Demo login" button that signs the
 * visitor in to the demo viewer account and lands them in the demo workspace.
 */
export default function Demo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useLayoutEffect(() => {
    const gate = document.getElementById("__branding_gate__");
    if (gate?.parentNode) gate.parentNode.removeChild(gate);
    document.body.style.visibility = "";
  }, []);

  // If already signed in as the demo viewer, skip the login screen entirely.
  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentEmail = sessionData?.session?.user?.email?.toLowerCase();
      if (currentEmail === "111111111@user.local") {
        setSignedIn(true);
      }
    })();
  }, []);

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("setup-demo", { body: {} });
      if (fnErr) throw fnErr;
      if (!data?.email || !data?.password) throw new Error("invalid_response");

      await supabase.auth.signOut().catch(() => {});
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signErr) throw signErr;

      setSignedIn(true);
    } catch (e) {
      console.error("Demo init failed", e);
      toast.error("تعذّر تسجيل الدخول التجريبي. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (signedIn) {
    return (
      <DashboardLayout>
        <WelcomeScreen />
      </DashboardLayout>
    );
  }

  // Login screen — visually identical to OrgAuth, branded for the demo org.
  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      dir="rtl"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)",
      }}
    >
      <SpaceScene />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, hsl(230 80% 3% / 0.6) 100%)",
        }}
      />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl flex flex-col items-center gap-8">
          <div className="w-full flex flex-col md:flex-row items-stretch justify-center gap-4 md:gap-5 lg:gap-6">
            {/* Demo org logo with rotating halos — replaces the platform logo on this page */}
            <div className="relative hidden md:flex items-center justify-center animate-fade-in order-1 shrink-0 w-[20rem] h-[20rem] lg:w-[24rem] lg:h-[24rem] md:mt-[12rem] lg:mt-[12rem] overflow-visible">
              {/* Outer pulsing halo */}
              <div
                className="absolute inset-0 rounded-full org-halo-pulse pointer-events-none"
                style={{ background: `radial-gradient(circle, hsl(${accentHsl} / 0.45) 0%, transparent 70%)` }}
                aria-hidden="true"
              />
              {/* Outer ring — slow clockwise dashed */}
              <div
                className="absolute inset-4 rounded-full org-spin-slow pointer-events-none"
                style={{ border: `2px dashed hsl(${primaryHsl} / 0.55)` }}
                aria-hidden="true"
              />
              {/* Mid ring — reverse conic */}
              <div
                className="absolute inset-10 rounded-full org-spin-reverse pointer-events-none"
                style={{
                  background: `conic-gradient(from 0deg, hsl(${primaryHsl}) 0%, transparent 30%, hsl(${accentHsl}) 60%, transparent 90%, hsl(${primaryHsl}) 100%)`,
                  WebkitMask: "radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)",
                  mask: "radial-gradient(circle, transparent 62%, #000 64%, #000 70%, transparent 72%)",
                }}
                aria-hidden="true"
              />
              {/* Orbiting dots */}
              <div className="absolute inset-4 org-spin-medium pointer-events-none" aria-hidden="true">
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-3.5 h-3.5 rounded-full"
                  style={{ background: `hsl(${accentHsl})`, boxShadow: `0 0 14px hsl(${accentHsl})` }}
                />
              </div>
              <div className="absolute inset-4 org-spin-reverse pointer-events-none" aria-hidden="true">
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-3 h-3 rounded-full"
                  style={{ background: `hsl(${primaryHsl})`, boxShadow: `0 0 12px hsl(${primaryHsl})` }}
                />
              </div>
              {/* Logo center */}
              <div
                className="absolute inset-16 rounded-full bg-white shadow-2xl flex items-center justify-center overflow-hidden"
                style={{
                  boxShadow: `0 20px 50px -10px hsl(${primaryHsl} / 0.5), 0 0 0 6px white, 0 0 0 7px hsl(${primaryHsl} / 0.25)`,
                }}
              >
                <Building2 className="w-20 h-20" style={{ color: `hsl(${primaryHsl})` }} />
              </div>
            </div>

            {/* Login card */}
            <div className="flex flex-col gap-5 order-2 animate-scale-in w-full max-w-md justify-center md:z-10">
              {/* Org branding header */}
              <div className="text-center">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight break-words leading-tight px-2 text-white">
                  {DEMO_NAME}
                </h1>
                <p className="text-sm text-slate-300 mt-1.5">{DEMO_TAGLINE}</p>

                <div className="flex items-center justify-center gap-2 mt-3" aria-hidden="true">
                  <span className="h-px w-10 bg-white/30" />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${accentHsl})` }} />
                  <span className="h-px w-10 bg-white/30" />
                </div>
              </div>

              <Card className="shadow-2xl border border-white/60 backdrop-blur-sm bg-white/95">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
                  <CardDescription>
                    هذه نسخة تجريبية مفتوحة — اضغط الزر بالأسفل للدخول مباشرة
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleDemoLogin();
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2">
                        <User className="w-4 h-4" /> رقم الهوية
                      </Label>
                      <Input
                        id="username"
                        value="•••••••••"
                        disabled
                        readOnly
                        placeholder="أدخل رقم الهوية الوطنية"
                        className="h-11 bg-muted/40 cursor-not-allowed select-none"
                        dir="ltr"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center gap-2">
                        <Lock className="w-4 h-4" /> كلمة المرور
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value="••••••••"
                        disabled
                        readOnly
                        className="h-11 bg-muted/40 cursor-not-allowed select-none"
                        dir="ltr"
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 gap-2 text-white border-0 hover:opacity-90"
                      style={{
                        background: `linear-gradient(to left, hsl(${accentHsl}), hsl(${primaryHsl}))`,
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          جاري التحضير...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5" />
                          تسجيل الدخول الافتراضي
                        </>
                      )}
                    </Button>

                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-[12px] leading-relaxed text-emerald-900">
                      <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                      <span>
                        جولة تعريفية على منصة <span className="font-bold">كفاءة</span> ببيانات نموذجية للقراءة فقط — حقول الدخول معطّلة في النسخة التجريبية.
                      </span>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex flex-col items-center text-center gap-3 animate-fade-in max-w-2xl">
            <p className="text-sm md:text-base text-slate-100 leading-relaxed font-medium">
              <span className="text-cyan-300 font-bold">منصة كفاءة لإدارة التسويق الإلكتروني للجمعيات بالذكاء الاصطناعي</span>
              {" "}— تتيح للجمعيات إدارة حملاتها التسويقية، متابعة المتبرعين، وقياس الأداء بكفاءة عالية.
            </p>

            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm">
              <a
                href="/about"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-slate-100 hover:bg-white/10 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                عن المنصة
              </a>
              <span className="w-px h-4 bg-white/30" aria-hidden="true" />
              <a
                href="/support"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-slate-100 hover:bg-white/10 transition-colors"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                الدعم الفني
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 px-4">
        <p className="text-xs text-slate-300/80">
          © {new Date().getFullYear()} جميع الحقوق محفوظة لمنصة <span className="font-bold text-cyan-300">كفاءة</span> الإلكترونية
        </p>
      </footer>
    </div>
  );
}
