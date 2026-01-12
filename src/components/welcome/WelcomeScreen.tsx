import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { Sparkles } from "lucide-react";
import atefLogo from "@/assets/atef-logo-icon.jpg";

// استيراد الخلفيات
import bg1 from "@/assets/welcome-bg-1.jpg";
import bg2 from "@/assets/welcome-bg-2.jpg";
import bg3 from "@/assets/welcome-bg-3.jpg";
import bg4 from "@/assets/welcome-bg-4.jpg";
import bg5 from "@/assets/welcome-bg-5.jpg";
import bg6 from "@/assets/welcome-bg-6.jpg";

// 30 عبارة إيجابية - واحدة لكل يوم من الشهر
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
  { quote: "أنت قادر على تحقيق المستحيل", emoji: "⭐" },
  { quote: "العطاء يجعل الحياة أجمل", emoji: "🎁" },
  { quote: "ثق بنفسك، فأنت أقوى مما تظن", emoji: "💎" },
  { quote: "كل تحدٍ يخفي فرصة عظيمة", emoji: "🔥" },
  { quote: "السعادة تكمن في خدمة الآخرين", emoji: "💝" },
  { quote: "أنت تستحق كل النجاح والتوفيق", emoji: "🌺" },
  { quote: "الأمل هو نور يضيء أحلك الليالي", emoji: "🕯️" },
  { quote: "كل لحظة هي بداية جديدة", emoji: "🌱" },
  { quote: "أنت تمتلك قوة التغيير", emoji: "⚡" },
  { quote: "العمل الجماعي يصنع المعجزات", emoji: "👥" },
  { quote: "الصبر والمثابرة طريق النجاح", emoji: "🎖️" },
  { quote: "أنت نعمة لكل من حولك", emoji: "🌸" },
  { quote: "الإحسان يعود عليك أضعافاً", emoji: "♻️" },
  { quote: "كل يوم فرصة لتكون أفضل نسخة منك", emoji: "🦋" },
  { quote: "معاً نصنع المستحيل ممكناً", emoji: "🏅" },
];

// الخلفيات الطبيعية
const backgrounds = [bg1, bg2, bg3, bg4, bg5, bg6];

export function WelcomeScreen() {
  const { user } = useUser();
  const [currentQuote, setCurrentQuote] = useState(positiveQuotes[0]);
  const [currentBg, setCurrentBg] = useState(backgrounds[0]);
  const [animationType, setAnimationType] = useState(0);

  useEffect(() => {
    // اختيار عبارة وخلفية بناءً على اليوم
    const now = new Date();
    const dayOfMonth = now.getDate(); // 1-31
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const quoteIndex = (dayOfMonth - 1) % positiveQuotes.length;
    const bgIndex = dayOfYear % backgrounds.length;
    const animIndex = dayOfYear % 6; // 6 أنواع حركة مختلفة
    
    setCurrentQuote(positiveQuotes[quoteIndex]);
    setCurrentBg(backgrounds[bgIndex]);
    setAnimationType(animIndex);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 17) return "مساء الخير";
    return "مساء النور";
  };

  // أنماط حركة مختلفة للخلفية
  const bgAnimations = [
    { scale: [1, 1.05, 1], transition: { duration: 20, repeat: Infinity } },
    { x: [0, -20, 0], transition: { duration: 25, repeat: Infinity } },
    { y: [0, -15, 0], transition: { duration: 22, repeat: Infinity } },
    { scale: [1.05, 1, 1.05], x: [-10, 10, -10], transition: { duration: 30, repeat: Infinity } },
    { rotate: [0, 1, 0, -1, 0], transition: { duration: 15, repeat: Infinity } },
    { scale: [1, 1.08, 1], y: [0, -10, 0], transition: { duration: 18, repeat: Infinity } },
  ];

  return (
    <div className="relative w-full min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden rounded-3xl">
      {/* خلفية طبيعية متحركة */}
      <motion.div 
        className="absolute inset-0 rounded-3xl"
        animate={bgAnimations[animationType]}
      >
        <img 
          src={currentBg} 
          alt="خلفية طبيعية" 
          className="w-full h-full object-cover rounded-3xl"
        />
        {/* طبقة تعتيم خفيفة لوضوح النص */}
        <div className="absolute inset-0 bg-black/20 rounded-3xl" />
      </motion.div>
      
      {/* تأثيرات زخرفية */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        {/* نجوم/شرارات صغيرة متحركة */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0], 
              scale: [0, 1, 0],
              y: [0, -30, -60]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              delay: i * 0.4,
              repeatDelay: 3
            }}
            className="absolute w-2 h-2 bg-white/70 rounded-full shadow-lg"
            style={{
              left: `${5 + (i * 6.5)}%`,
              top: `${70 + (i % 4) * 7}%`,
            }}
          />
        ))}

        {/* فقاعات ضوئية */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute top-20 left-20 w-40 h-40 bg-white/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute bottom-32 right-20 w-56 h-56 bg-white/10 rounded-full blur-3xl"
        />
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
            className="absolute -inset-4 border-4 border-dashed border-white/50 rounded-full"
          />
          
          {/* الشعار - دائرة بيضاء */}
          <div className="relative w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl">
            <img
              src={atefLogo}
              alt="جمعية عطف"
              className="w-32 h-32 object-contain rounded-full"
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
          className="text-2xl font-bold text-white drop-shadow-lg mb-6"
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
          <p className="text-xl text-white/90 drop-shadow-md">{getGreeting()}</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
            أهلاً بك، {user.firstName}! 👋
          </h1>
        </motion.div>

        {/* العبارة الإيجابية */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-white/25 backdrop-blur-md rounded-2xl px-8 py-6 border border-white/40 shadow-xl"
        >
          <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed drop-shadow-md">
            {currentQuote.emoji} {currentQuote.quote}
          </p>
        </motion.div>

        {/* نص إرشادي */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-8 text-white/80 text-sm drop-shadow-md"
        >
          اختر من القائمة للبدء في العمل
        </motion.p>
      </motion.div>
    </div>
  );
}