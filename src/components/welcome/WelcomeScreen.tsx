import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import atefLogo from "@/assets/atef-logo-icon.jpg";

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

interface Quote {
  quote: string;
  emoji: string;
}

export function WelcomeScreen() {
  const { user } = useUser();
  const [currentQuote, setCurrentQuote] = useState<Quote>(defaultQuotes[0]);
  const [currentBg, setCurrentBg] = useState<string>(defaultBackgrounds[0]);
  const [quotes, setQuotes] = useState<Quote[]>(defaultQuotes);
  const [backgrounds, setBackgrounds] = useState<string[]>(defaultBackgrounds);
  const [hasFeaturedBg, setHasFeaturedBg] = useState(false);

  useEffect(() => {
    fetchContent();
  }, []);

  useEffect(() => {
    // اختيار عبارة بناءً على اليوم
    const now = new Date();
    const dayOfMonth = now.getDate(); // 1-31
    const quoteIndex = (dayOfMonth - 1) % quotes.length;
    setCurrentQuote(quotes[quoteIndex]);
    
    // اختيار خلفية بناءً على اليوم فقط إذا لم توجد خلفية رئيسية
    if (!hasFeaturedBg) {
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
      );
      const bgIndex = dayOfYear % backgrounds.length;
      setCurrentBg(backgrounds[bgIndex]);
    }
  }, [quotes, backgrounds, hasFeaturedBg]);

  const fetchContent = async () => {
    try {
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
            <img
              src={atefLogo}
              alt="جمعية عطف"
              className="w-44 h-44 object-contain rounded-full"
            />
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
            جمعية عطف للأيتام
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
            أهلاً بك، {user.firstName}! 👋
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
      </motion.div>
    </div>
  );
}
