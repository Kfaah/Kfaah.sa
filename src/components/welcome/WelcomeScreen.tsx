import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowLeft } from "lucide-react";
import atefLogo from "@/assets/atef-logo-icon-white.png";

// عبارات إيجابية متنوعة
const positiveQuotes = [
  { quote: "كل يوم هو فرصة جديدة للتميز والإبداع", emoji: "🌟" },
  { quote: "نجاحك يبدأ بخطوة واحدة، فاخطُها اليوم بثقة", emoji: "🚀" },
  { quote: "أنت تصنع الفرق في حياة الآخرين", emoji: "💫" },
  { quote: "الإيجابية هي مفتاح النجاح والسعادة", emoji: "☀️" },
  { quote: "كن مصدر إلهام لمن حولك", emoji: "✨" },
  { quote: "عملك له أثر عظيم في المجتمع", emoji: "🌈" },
  { quote: "الإبداع يبدأ من الشغف بما تفعل", emoji: "🎯" },
  { quote: "معاً نبني مستقبلاً أفضل للأيتام", emoji: "🤝" },
  { quote: "كل جهد صغير يصنع تغييراً كبيراً", emoji: "💪" },
  { quote: "ابتسامتك تنير يوم الآخرين", emoji: "😊" },
  { quote: "النجاح ليس وجهة بل رحلة ممتعة", emoji: "🏆" },
  { quote: "أنت جزء من عائلة عطف الكبيرة", emoji: "❤️" },
  { quote: "اجعل يومك مليئاً بالإنجازات", emoji: "📈" },
  { quote: "طاقتك الإيجابية معدية، انشرها!", emoji: "🌻" },
  { quote: "كل يوم جديد يحمل آمالاً جديدة", emoji: "🌅" },
];

// خلفيات طبيعية جميلة (ألوان تدرجية مع أنماط)
const backgrounds = [
  "from-emerald-400 via-teal-500 to-cyan-600", // أخضر زاهي
  "from-green-400 via-emerald-500 to-teal-600", // أخضر طبيعي
  "from-cyan-400 via-sky-500 to-blue-600", // سماء صافية
  "from-teal-400 via-cyan-500 to-sky-600", // بحر هادئ
  "from-lime-400 via-green-500 to-emerald-600", // ربيع
];

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { user } = useUser();
  const [isVisible, setIsVisible] = useState(true);
  const [currentQuote, setCurrentQuote] = useState(positiveQuotes[0]);
  const [currentBg, setCurrentBg] = useState(backgrounds[0]);

  useEffect(() => {
    // اختيار عبارة وخلفية بناءً على اليوم
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const quoteIndex = dayOfYear % positiveQuotes.length;
    const bgIndex = dayOfYear % backgrounds.length;
    
    setCurrentQuote(positiveQuotes[quoteIndex]);
    setCurrentBg(backgrounds[bgIndex]);
  }, []);

  const handleContinue = () => {
    setIsVisible(false);
    setTimeout(onContinue, 500);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء النور";
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
        >
          {/* خلفية متدرجة */}
          <div className={`absolute inset-0 bg-gradient-to-br ${currentBg}`} />
          
          {/* تأثيرات زخرفية */}
          <div className="absolute inset-0 overflow-hidden">
            {/* أمواج */}
            <svg
              className="absolute bottom-0 left-0 right-0 w-full h-64 text-white/10"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
            >
              <path
                fill="currentColor"
                d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
              />
            </svg>
            
            {/* دوائر زخرفية */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            />
            <motion.div
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.1, 0.15] }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute bottom-40 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"
            />
            
            {/* نجوم/شرارات صغيرة */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0], 
                  scale: [0, 1, 0],
                  y: [0, -20, -40]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  delay: i * 0.3,
                  repeatDelay: 2
                }}
                className="absolute w-2 h-2 bg-white/50 rounded-full"
                style={{
                  left: `${10 + (i * 4.5)}%`,
                  top: `${60 + (i % 5) * 8}%`,
                }}
              />
            ))}
          </div>

          {/* المحتوى الرئيسي */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl"
          >
            {/* الشعار */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.3, type: "spring" }}
              className="relative mb-8"
            >
              {/* حلقة خارجية متحركة */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-4 border-4 border-dashed border-white/30 rounded-full"
              />
              
              {/* توهج خلفي */}
              <div className="absolute inset-0 bg-white/20 rounded-full blur-2xl scale-150" />
              
              {/* الشعار */}
              <div className="relative w-40 h-40 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-4 border-white/40 shadow-2xl">
                <img
                  src={atefLogo}
                  alt="جمعية عطف"
                  className="w-28 h-28 object-contain"
                />
              </div>
              
              {/* نجمة صغيرة */}
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-5 h-5 text-yellow-800" />
              </motion.div>
            </motion.div>

            {/* اسم الجمعية */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-white/90 mb-6"
            >
              جمعية عطف للأيتام
            </motion.h2>

            {/* الترحيب */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3 mb-8"
            >
              <p className="text-xl text-white/80">{getGreeting()}</p>
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                أهلاً بك، {user.firstName}! 👋
              </h1>
            </motion.div>

            {/* العبارة الإيجابية */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="bg-white/20 backdrop-blur-md rounded-2xl px-8 py-6 mb-10 border border-white/30 shadow-xl"
            >
              <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed">
                {currentQuote.emoji} {currentQuote.quote}
              </p>
            </motion.div>

            {/* زر المتابعة */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <Button
                onClick={handleContinue}
                size="lg"
                className="gap-3 bg-white text-emerald-700 hover:bg-white/90 text-lg px-10 py-6 rounded-full shadow-xl font-bold transition-transform hover:scale-105"
              >
                <span>ابدأ يومك</span>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}