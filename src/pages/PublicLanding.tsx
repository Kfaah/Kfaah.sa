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
import { Lock, User, LogIn, Eye, EyeOff, Building2, Shield } from "lucide-react";

const normalizeDigits = (value: string, trim = false) => {
  const input = trim ? value.trim() : value;
  const arabicIndic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return input
    .replace(/[٠-٩]/g, (d) => String(arabicIndic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
};

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
          {/* Brand side */}
          <div className="text-white space-y-6 text-center md:text-right">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl mb-4">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              نظام إدارة التسويق الإلكتروني
              <span className="block text-2xl md:text-3xl text-cyan-300 mt-2">للجمعيات الخيرية</span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-md mx-auto md:mx-0">
              منصة موحدة تتيح للجمعيات إدارة حملاتها التسويقية، متابعة المتبرعين، وقياس الأداء بكفاءة عالية.
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
              <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm">
                إدارة متعددة الجمعيات
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm">
                تقارير لحظية
              </div>
              <div className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm">
                واجهة عربية كاملة
              </div>
            </div>
          </div>

          {/* Login card */}
          <Card className="border-0 shadow-2xl backdrop-blur-sm bg-white/95">
            <CardHeader className="text-center space-y-2">
              <div className="inline-flex mx-auto items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-2xl">دخول مدير النظام</CardTitle>
              <CardDescription>
                هذه الواجهة مخصصة لمدير المنصة. لدخول جمعيتك، استخدم الرابط الخاص بها.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> اسم المستخدم / رقم الهوية
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="أدخل رقم الهوية"
                    className="h-11"
                    dir="ltr"
                  />
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
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90"
                  disabled={loading}
                >
                  {loading ? <span className="animate-spin">⏳</span> : <LogIn className="w-5 h-5" />}
                  تسجيل الدخول
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="relative z-10 text-center text-slate-400 text-sm py-4">
        © {new Date().getFullYear()} نظام إدارة التسويق الإلكتروني للجمعيات
      </footer>
    </div>
  );
}
