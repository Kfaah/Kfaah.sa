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
        >
          {/* الهالات المتحركة */}
          <motion.div
            className="absolute inset-0 -m-4 rounded-full border-2 border-white/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 -m-6 rounded-full border-2 border-white/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-0 -m-8 rounded-full border border-white/10"
            animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          
          {/* النقاط المتحركة حول الشعار */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full shadow-lg"
              style={{
                top: "50%",
                left: "50%",
                transformOrigin: "center",
              }}
              animate={{
                x: [0, Math.cos((i * 45 * Math.PI) / 180) * 90],
                y: [0, Math.sin((i * 45 * Math.PI) / 180) * 90],
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
          
          {/* الشعار - دائرة بيضاء مع ظل */}
          <div className="relative w-36 h-36 bg-white rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white/50">
            <img
              src={atefLogo}
              alt="جمعية عطف"
              className="w-28 h-28 object-contain rounded-full"
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
