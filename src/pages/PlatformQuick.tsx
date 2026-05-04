import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, BarChart3, Brain } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const points = [
  { icon: Users, label: "إدارة متعددة الجمعيات" },
  { icon: BarChart3, label: "تقارير لحظية" },
  { icon: Brain, label: "ذكاء اصطناعي" },
];

export default function PlatformQuick() {
  const navigate = useNavigate();

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 mb-5">
            <Sparkles className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
            <span className="text-xs font-bold text-white">نقاط سريعة</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            عن منصة <span style={{ color: `hsl(${accentHsl})` }}>كفاءة</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            <span className="font-bold" style={{ color: `hsl(${accentHsl})` }}>
              منصة إدارة التسويق الإلكتروني للجمعيات بالذكاء الاصطناعي
            </span>
            <br />
            منصة موحدة تتيح للجمعيات إدارة حملاتها التسويقية، متابعة المتبرعين،
            وقياس الأداء بكفاءة عالية.
          </p>
        </motion.div>

        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {points.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/15 p-5 flex flex-col items-center text-center gap-3 hover:border-white/35 transition-colors"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))`,
                }}
              >
                <p.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-bold text-white">{p.label}</span>
            </motion.div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate("/about")}
          className="mt-10 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لصفحة عن المنصة
        </motion.button>
      </main>
    </div>
  );
}