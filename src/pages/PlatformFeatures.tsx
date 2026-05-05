import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, Lightbulb,
  ListChecks, BrainCircuit, Database, HeartHandshake,
  Workflow, Bot, LineChart, Megaphone, FileSpreadsheet, Layers,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const features = [
  { icon: Workflow, title: "أتمتة كاملة لإدارة العمل", desc: "نظام يدير دورة العمل من التخطيط حتى التنفيذ والتقييم دون تدخل بشري." },
  { icon: Layers, title: "إعداد الخطط تلقائيًا", desc: "تفهم المنصة طبيعة الجمعية وتُعد الخطط التشغيلية والتنفيذية بشكل مترابط." },
  { icon: ListChecks, title: "تنزيل المهام اليومية", desc: "توزيع المهام يوميًا على الموظفين أوتوماتيكيًا بناءً على بيانات الجمعية." },
  { icon: Bot, title: "تقييم الموظفين بالذكاء الاصطناعي", desc: "تقييمات دورية وآلية بناءً على جودة الإنجاز والالتزام والإنتاجية." },
  { icon: BrainCircuit, title: "تعلّم ذاتي مستمر", desc: "تُعيد المنصة برمجة نفسها لتتعرف على طبيعة الجمعية من بياناتها المُدخلة." },
  { icon: Lightbulb, title: "أفكار ومبادرات وابتكارات", desc: "اقتراحات وتوصيات ذكية لإطلاق مبادرات جديدة قابلة للتنفيذ." },
  { icon: HeartHandshake, title: "فهم سلوك المتبرعين", desc: "تتعرف المنصة على أنماط المتبرعين وترشد للتعامل الأمثل مع كل شريحة." },
  { icon: Megaphone, title: "ربط ذكي بين التبرعات", desc: "ربط تبرعات المتبرعين عبر الحملات والمشاريع مع تذكيرات وأفكار للتعامل معها." },
  { icon: LineChart, title: "استخراج البيانات والمؤشرات", desc: "استخراج أرقام ومؤشرات تسويقية وتحويلها إلى رؤى عملية للقرار." },
  { icon: Database, title: "قاعدة بيانات متكاملة", desc: "قاعدة شاملة عن كل متبرع وكل مشروع وكل حملة في مكان واحد." },
  { icon: FileSpreadsheet, title: "تكامل مع متجر الجمعية", desc: "ربط مباشر مع المتجر الإلكتروني لتغذية النظام وتحديث الخطط تلقائيًا." },
];

export default function PlatformFeatures() {
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

      <main className="relative z-10 flex-1 px-4 py-12 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 mb-5">
              <Sparkles className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
              <span className="text-xs font-bold text-white">منصة كفاءة</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">مميزات المنصة</h1>
            <p className="text-sm md:text-base text-slate-300">قدرات ذكية تُسهم في أتمتة العمل واتخاذ القرار</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.45 }}
                className="bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/15 p-5 text-right hover:border-white/35 hover:-translate-y-0.5 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                >
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/15 text-center p-6">
            <p className="text-sm md:text-base text-slate-200 leading-relaxed">
              نحو أداء أكثر احترافية… ونتائج قابلة للقياس.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate("/subscribe")}
              className="text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              اشترك في المنصة
            </button>
            <button
              onClick={() => navigate("/about")}
              className="bg-white/10 text-white font-bold px-6 py-3 rounded-2xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              العودة إلى عن المنصة
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
