import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
        navigate("/");
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              first_name: firstName,
              last_name: lastName,
            },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.");
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message.includes("User already registered")) {
        toast.error("البريد الإلكتروني مسجل بالفعل");
      } else if (error.message.includes("Invalid login credentials")) {
        toast.error("بيانات الدخول غير صحيحة");
      } else {
        toast.error(error.message || "حدث خطأ أثناء العملية");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#3d9aa8] via-[#4A9BA8] to-[#2d7a85] p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating Orbs */}
      <div 
        className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-white/5 blur-2xl"
        style={{ animation: 'float 6s ease-in-out infinite' }}
      />
      <div 
        className="absolute bottom-1/3 left-1/4 w-24 h-24 rounded-full bg-cyan-300/10 blur-xl"
        style={{ animation: 'float 8s ease-in-out infinite reverse' }}
      />

      {/* Logo Section - Same as Dashboard */}
      <div className="relative z-10 mb-10 flex flex-col items-center">
        {/* Logo with animations */}
        <div className="relative mb-6 group">
          {/* Outer rotating ring */}
          <div 
            className="absolute inset-[-12px] w-[224px] h-[224px] rounded-full border-4 border-white/30 border-t-white animate-spin" 
            style={{ animationDuration: '8s' }} 
          />
          
          {/* Inner glow circle */}
          <div 
            className="absolute inset-3 w-[194px] h-[194px] rounded-full bg-gradient-to-br from-white/20 to-cyan-300/10 animate-pulse" 
            style={{ animationDuration: '3s' }} 
          />
          
          {/* Logo container with zoom animation and shimmer */}
          <div className="relative w-48 h-48 rounded-full bg-white border-4 border-white flex items-center justify-center shadow-xl overflow-hidden">
            <img 
              src={atefLogoIcon} 
              alt="جمعية عطف" 
              className="w-40 h-40 object-contain"
              style={{ animation: 'zoomPulse 4s ease-in-out infinite' }}
            />
            {/* Shimmer/Glow effect */}
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full"
              style={{ animation: 'shimmer 3s ease-in-out infinite' }}
            />
          </div>
          
          {/* Decorative dot */}
          <div 
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg animate-bounce" 
            style={{ animationDuration: '2s' }} 
          />
        </div>
        
        {/* Text under logo */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white whitespace-nowrap tracking-wide drop-shadow-lg">
            جمعية عطف للأيتام
          </h1>
          <div className="relative">
            <p className="text-lg font-semibold text-white/90">
              نظام إدارة التسويق الإلكتروني
            </p>
            <div className="mt-3 mx-auto w-32 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full" />
          </div>
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0">
        <CardHeader className="text-center space-y-2 pb-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            {isLogin ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "أدخل بياناتك للوصول إلى لوحة التحكم"
              : "أنشئ حسابك للبدء في استخدام النظام"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    الاسم الأول
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={!isLogin}
                    placeholder="محمد"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    اسم العائلة
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                    placeholder="العلي"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="example@email.com"
                className="h-11"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="h-11"
                dir="ltr"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90 text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  تسجيل الدخول
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  إنشاء حساب
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-accent hover:underline font-medium"
            >
              {isLogin ? "ليس لديك حساب؟ أنشئ حساباً جديداً" : "لديك حساب؟ سجل الدخول"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
