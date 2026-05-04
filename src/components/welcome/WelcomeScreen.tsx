import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
import demoOrgLogo from "@/assets/demo-org-logo.png";
import { kafaaLogo } from "@/components/brand/PlatformBrand";
import namozajLogo from "@/assets/namozaj-logo.png";

// العبارات الافتراضية (تستخدم إذا لم توجد عبارات في قاعدة البيانات)
const defaultQuotes = [
  { quote: "كل يوم هو فرصة جديدة للتميز والإبداع", emoji: "🌟" },
  { quote: "نجاحك يبدأ بخطوة واحدة، فاخطُها اليوم بثقة", emoji: "🚀" },
  { quote: "أنت تصنع الفرق في حياة الآخرين", emoji: "💫" },
  { quote: "الإيجابية هي مفتاح النجاح والسعادة", emoji: "☀️" },
  { quote: "كن مصدر إلهام لمن حولك", emoji: "✨" },
];

// الخلفيات الافتراضية
const defaultBackgrounds = [
  "/welcome-backgrounds/bg-01.jpg",
  "/welcome-backgrounds/bg-02.jpg",
  "/welcome-backgrounds/bg-03.jpg",
  "/welcome-backgrounds/bg-04.jpg",
  "/welcome-backgrounds/bg-05.jpg",
];

// خلفيات مخصصة لكل جمعية حسب تخصصها (تظهر تلقائياً عند اختيار الجمعية)
// يمكن إضافة المزيد من الجمعيات هنا لاحقاً
const orgBackgrounds: Record<string, string[]> = {
  // جمعية سكينة — مساجد جميلة وحدائق ورود
  sakinah: [
    "/welcome-backgrounds/sakina/mosque-01.jpg",
    "/welcome-backgrounds/sakina/mosque-02.jpg",
    "/welcome-backgrounds/sakina/mosque-03.jpg",
    "/welcome-backgrounds/sakina/mosque-04.jpg",
    "/welcome-backgrounds/sakina/mosque-05.jpg",
  ],
};

interface Quote {
  quote: string;
  emoji: string;
}

// عبارات موجَّهة إلى الجمعية ككيان (تُستخدم لحساب الجمعية / viewer)
const orgQuotes: Quote[] = [
  { quote: "{org} — جمعية رائدة بأثرٍ يمتد ويتجدّد", emoji: "🌟" },
  { quote: "{org} كيانٌ متألق، رسالتُه تُلهم وتُحدث الفرق", emoji: "✨" },
  { quote: "بارك الله في {org} وفي مجلس إدارتها وكل العاملين فيها", emoji: "🙏" },
  { quote: "{org} — صرحٌ خيريٌّ تتسع آثاره يوماً بعد يوم", emoji: "🚀" },
  { quote: "{org} رسالةٌ عظيمة وعطاءٌ لا ينقطع بإذن الله", emoji: "💚" },
  { quote: "{org} — ريادةٌ في الخير وقدوةٌ في العمل المؤسسي", emoji: "🏅" },
  { quote: "{org} تصنع الأثر وتبني الإنسان", emoji: "🌱" },
];

export function WelcomeScreen() {
  const { user } = useUser();
  const branding = useOrgBranding();
  const { currentOrg } = useOrganization();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [isViewer, setIsViewer] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<Quote>(defaultQuotes[0]);
  const [currentBg, setCurrentBg] = useState<string>(defaultBackgrounds[0]);
  const [quotes, setQuotes] = useState<Quote[]>(defaultQuotes);
  const [backgrounds, setBackgrounds] = useState<string[]>(defaultBackgrounds);
  const [hasFeaturedBg, setHasFeaturedBg] = useState(false);
  const isDemoRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/demo");
  const displayLogo = isDemoRoute ? namozajLogo : branding.logoUrl;
  const displayOrgName = isDemoRoute ? "جمعية النموذج الخيري" : branding.orgName;

  useEffect(() => {
    fetchContent();
  }, [currentOrg?.slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authUser?.id) { setIsViewer(false); return; }
      const { data } = await supabase.rpc("is_viewer", { _user_id: authUser.id });
      if (!cancelled) setIsViewer(!!data);
    })();
    return () => { cancelled = true; };
  }, [authUser?.id]);

  useEffect(() => {
    const now = new Date();
    const dayOfMonth = now.getDate(); // 1-31
    const orgName = displayOrgName?.trim() || "جمعيتكم";
    const sourceQuotes = isViewer && !isDemoRoute ? orgQuotes : quotes;
    const quoteIndex = (dayOfMonth - 1) % sourceQuotes.length;
    const selected = sourceQuotes[quoteIndex];
    const name = user.firstName?.trim() || "";
    setCurrentQuote({
      ...selected,
      quote: selected.quote
        .replace(/\{name\}/g, isViewer && !isDemoRoute ? orgName : name)
        .replace(/\{org\}/g, orgName),
    });
    
    // اختيار خلفية بناءً على اليوم فقط إذا لم توجد خلفية رئيسية
    if (!hasFeaturedBg) {
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const bgIndex = dayOfYear % backgrounds.length;
      setCurrentBg(backgrounds[bgIndex]);
    }
  }, [quotes, backgrounds, hasFeaturedBg, user.firstName, isViewer, displayOrgName]);

  const fetchContent = async () => {
    try {
      // إذا كانت الجمعية لها خلفيات مخصصة، استخدمها مباشرة وتجاوز قاعدة البيانات
      const orgSlug = currentOrg?.slug;
      if (orgSlug && orgBackgrounds[orgSlug]) {
        setBackgrounds(orgBackgrounds[orgSlug]);
        setHasFeaturedBg(false);
        // اجلب فقط العبارات
        const { data: qData } = await supabase
          .from("welcome_quotes")
          .select("quote, emoji")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        if (qData && qData.length > 0) setQuotes(qData);
        return;
      }

      const [quotesRes, bgRes] = await Promise.all([
        supabase
          .from("welcome_quotes")
          .select("quote, emoji")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
        supabase
          .from("welcome_backgrounds")
          .select("image_url, is_featured")
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
      ]);

      if (quotesRes.data && quotesRes.data.length > 0) {
        setQuotes(quotesRes.data);
      }

      if (bgRes.data && bgRes.data.length > 0) {
        // التحقق من وجود خلفية رئيسية
        const featuredBg = bgRes.data.find(bg => bg.is_featured);
        if (featuredBg) {
          setCurrentBg(featuredBg.image_url);
          setHasFeaturedBg(true);
        } else {
          setHasFeaturedBg(false);
        }
        setBackgrounds(bgRes.data.map(bg => bg.image_url));
      }
    } catch (error) {
      console.error("Error fetching welcome content:", error);
      // استخدام الافتراضي في حالة الخطأ
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء النور";
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden rounded-3xl">
      {/* خلفية هادئة */}
      <motion.div 
        className="absolute inset-0 rounded-3xl"
        initial={{ scale: 1.02 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      >
        <img 
          src={currentBg} 
          alt="خلفية" 
          className="w-full h-full object-cover rounded-3xl"
        />
        {/* طبقة تعتيم خفيفة لتحسين قراءة النصوص */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 rounded-3xl" />
      </motion.div>

      {/* المحتوى الرئيسي */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl"
      >
        {/* الشعار مع التأثيرات */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8 relative"
          style={{ width: 280, height: 280 }}
        >
          {/* شريط النقاط البيضاء الدوارة */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ width: 280, height: 280 }}
          >
            {[...Array(24)].map((_, i) => (
              <motion.div
                key={`white-dot-${i}`}
                className="absolute rounded-full bg-white"
                style={{
                  width: i < 6 ? 8 : i < 12 ? 6 : i < 18 ? 5 : 4,
                  height: i < 6 ? 8 : i < 12 ? 6 : i < 18 ? 5 : 4,
                  boxShadow: "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.5)",
                  top: "50%",
                  left: "50%",
                  opacity: 1 - (i * 0.03),
                  transform: `rotate(${i * 10}deg) translateY(-132px) translateX(-50%)`,
                }}
              />
            ))}
          </motion.div>

          {/* شريط نقاط بيضاء ثاني - عكس الاتجاه */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            style={{ width: 280, height: 280 }}
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={`white-dot2-${i}`}
                className="absolute rounded-full bg-white"
                style={{
                  width: i < 5 ? 6 : i < 10 ? 5 : 4,
                  height: i < 5 ? 6 : i < 10 ? 5 : 4,
                  boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                  top: "50%",
                  left: "50%",
                  opacity: 1 - (i * 0.04),
                  transform: `rotate(${i * 12}deg) translateY(-115px) translateX(-50%)`,
                }}
              />
            ))}
          </motion.div>

          {/* خط شريطي دوار */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              width: 270,
              height: 270,
              top: 5,
              left: 5,
              border: "3px dashed",
              borderColor: "rgba(59, 130, 246, 0.6)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          {/* خط شريطي دوار عكسي */}
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 245,
              height: 245,
              top: 17.5,
              left: 17.5,
              border: "2px dotted",
              borderColor: "rgba(168, 85, 247, 0.5)",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />

          {/* الشعار - دائرة بيضاء مع ظل */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/80">
            {branding.loading && !isDemoRoute ? (
              <div className="w-44 h-44 rounded-full bg-muted animate-pulse" />
            ) : isDemoRoute ? (
              <img
                src={namozajLogo}
                alt="جمعية النموذج الخيري"
                className="w-48 h-48 object-cover rounded-full"
              />
            ) : displayLogo ? (
              <img
                src={displayLogo}
                alt={displayOrgName || "الجمعية"}
                className="w-44 h-44 object-contain rounded-full"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center rounded-full bg-secondary text-5xl font-black text-primary">
                {(displayOrgName || "ج").trim().charAt(0)}
              </div>
            )}
          </div>
        </motion.div>

        {/* اسم الجمعية مع خلفية */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/90 backdrop-blur-sm rounded-full px-6 py-2 shadow-lg mb-6"
        >
          <h2 className="text-2xl font-bold text-slate-700">
            {isDemoRoute ? (
              <span className="bg-gradient-to-l from-emerald-600 to-slate-800 bg-clip-text text-transparent">
                جمعية النموذج الخيري
              </span>
            ) : (
              displayOrgName || "الجمعية"
            )}
          </h2>
        </motion.div>

        {/* الترحيب مع خلفية */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/85 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg mb-6"
        >
          <p className="text-lg text-slate-600 mb-1">{getGreeting()}</p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
            {isDemoRoute
              ? `أهلاً بك أيها الزائر الكريم 👋`
              : isViewer
              ? `أهلاً بكم في ${displayOrgName || "جمعيتكم"} 👋`
              : `أهلاً بك، ${user.firstName}! 👋`}
          </h1>
        </motion.div>

        {/* العبارة الإيجابية */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-xl border border-white/50"
        >
          <p className="text-xl md:text-2xl font-medium text-slate-700 leading-relaxed">
            {currentQuote.emoji} {currentQuote.quote}
          </p>
        </motion.div>

        {/* نص إرشادي مع خلفية */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 bg-white/80 backdrop-blur-sm rounded-full px-5 py-2 shadow-md"
        >
          <p className="text-slate-600 text-sm font-medium">
            اختر من القائمة للبدء في العمل
          </p>
        </motion.div>

        {/* أيقونات الإجراءات السريعة — تظهر فقط في النسخة التجريبية */}
        {isDemoRoute && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-8 grid grid-cols-3 gap-3 md:gap-5 w-full max-w-xl"
          >
            <button
              onClick={() => navigate("/auth")}
              className="group bg-white/90 hover:bg-white backdrop-blur-sm rounded-2xl px-3 py-5 md:px-4 md:py-6 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 border border-white/60 flex flex-col items-center gap-2 md:gap-3"
              aria-label="الدخول إلى المنصة"
            >
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <LogIn className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-sm md:text-base font-bold text-slate-700">دخول المنصة</span>
            </button>

            <button
              onClick={() => navigate("/features")}
              className="group bg-white/90 hover:bg-white backdrop-blur-sm rounded-2xl px-3 py-5 md:px-4 md:py-6 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 border border-white/60 flex flex-col items-center gap-2 md:gap-3"
              aria-label="مميزات المنصة"
            >
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-sm md:text-base font-bold text-slate-700">مميزات المنصة</span>
            </button>

            <button
              onClick={() => navigate("/subscribe")}
              className="group bg-white/90 hover:bg-white backdrop-blur-sm rounded-2xl px-3 py-5 md:px-4 md:py-6 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 border border-white/60 flex flex-col items-center gap-2 md:gap-3"
              aria-label="الاشتراك في المنصة"
            >
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-sm md:text-base font-bold text-slate-700">الاشتراك في المنصة</span>
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
