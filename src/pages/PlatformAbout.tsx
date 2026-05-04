import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, UserCircle2, Sparkles, BookOpen } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { KafaaLogoArtworkCropped } from "@/components/brand/PlatformBrand";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const cards = [
  {
    id: "creator",
    icon: UserCircle2,
    title: "مبتكر المنصة",
    desc: "تعرّف على رؤية ومسيرة من صمّم منصة كفاءة وأسس فلسفتها.",
    href: "/about/creator",
    gradient: "from-amber-400 via-amber-500 to-orange-500",
  },
  {
    id: "quick",
    icon: Sparkles,
    title: "نقاط سريعة",
    desc: "نظرة خاطفة على أبرز ما تقدّمه المنصة في سطور موجزة.",
    href: "/about/quick",
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
  },
  {
    id: "detailed",
    icon: BookOpen,
    title: "شرح مفصل",
    desc: "غُص في تفاصيل المنصة وميزاتها وآلية عملها بشكل وافٍ.",
    href: "/features",
    gradient: "from-violet-400 via-purple-500 to-fuchsia-500",
  },
];

export default function PlatformAbout() {
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
        {/* Kafaa logo — elegant centerpiece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex items-center justify-center mb-8"
        >
          {/* Soft outer glow */}
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-60"
            style={{
              background: `radial-gradient(circle, hsl(${primaryHsl} / 0.55) 0%, transparent 70%)`,
              transform: "scale(1.6)",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute -inset-6 rounded-full org-spin-slow pointer-events-none"
            style={{ border: `1px dashed hsl(${accentHsl} / 0.5)` }}
            aria-hidden="true"
          />
          <KafaaLogoArtworkCropped
            className="relative h-40 w-40 md:h-52 md:w-52 object-contain"
            style={{
              filter:
                "drop-shadow(0 0 24px hsl(0 0% 100% / 0.35)) drop-shadow(0 18px 40px hsl(220 75% 3% / 0.55))",
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-center mb-12 max-w-xl"
        >
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            عن منصة <span style={{ color: `hsl(${accentHsl})` }}>كفاءة</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            اختر من أين تبدأ رحلتك للتعرّف على المنصة.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4" aria-hidden="true">
            <span className="h-px w-12 bg-white/30" />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${accentHsl})` }} />
            <span className="h-px w-12 bg-white/30" />
          </div>
        </motion.div>

        {/* 3 elegant icon cards */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {cards.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.12, duration: 0.55, ease: "easeOut" }}
              onClick={() => navigate(c.href)}
              className="group relative text-right rounded-3xl p-6 md:p-7 bg-white/[0.06] backdrop-blur-xl border border-white/15 hover:border-white/40 shadow-[0_12px_40px_-12px_hsl(220_75%_3%/0.7)] hover:shadow-[0_20px_60px_-12px_hsl(220_75%_3%/0.9)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
            >
              {/* gradient wash on hover */}
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${c.gradient}`}
                aria-hidden="true"
              />
              {/* Icon */}
              <div className="relative flex items-center justify-between mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg shadow-black/30 group-hover:scale-110 transition-transform duration-500`}
                >
                  <c.icon className="w-7 h-7 text-white" />
                </div>
                <ArrowRight className="w-5 h-5 text-white/40 rotate-180 group-hover:text-white group-hover:-translate-x-1 transition-all" />
              </div>
              <h3 className="relative text-lg md:text-xl font-bold text-white mb-2">
                {c.title}
              </h3>
              <p className="relative text-sm text-slate-300 leading-relaxed">
                {c.desc}
              </p>
            </motion.button>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          onClick={() => navigate(-1)}
          className="mt-10 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </motion.button>
      </main>
    </div>
  );
}
