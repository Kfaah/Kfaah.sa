import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Compass, Target, Star, Lightbulb, BrainCircuit, HeartHandshake, LineChart } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const values = [
  { icon: BrainCircuit, label: "الذكاء" },
  { icon: Sparkles, label: "الكفاءة" },
  { icon: LineChart, label: "النمو" },
  { icon: Lightbulb, label: "الابتكار" },
  { icon: HeartHandshake, label: "الموثوقية" },
];

export default function PlatformVisionMission() {
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
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 mb-5">
              <Compass className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
              <span className="text-xs font-bold text-white">منصة كفاءة</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">الرؤية والرسالة</h1>
            <p className="text-sm md:text-base text-slate-300">التعريف · الرؤية · الرسالة · القيم</p>
          </motion.div>

          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-10 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">ما هي منصة كفاءة؟</h3>
              <p className="text-slate-300 leading-loose text-sm md:text-base">
                منصة كفاءة هي حلٌّ تقنيٌّ متكامل لإدارة التسويق الإلكتروني للجمعيات، تعتمد على الذكاء
                الاصطناعي وتحليل البيانات لرفع كفاءة الأداء وتحقيق نمو مستدام.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                  <h4 className="font-bold text-white">الرؤية</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  أن نكون الشريك التقني الأول للجمعيات في تطوير أدائها التسويقي وتحويل بياناتها
                  إلى قرارات تصنع أثرًا حقيقيًا ومستدامًا.
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                  <h4 className="font-bold text-white">الرسالة</h4>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  تمكين الجمعيات من إدارة عملها التسويقي بذكاء واحترافية، عبر منظومة رقمية متكاملة
                  تعتمد على الذكاء الاصطناعي وتحليل البيانات.
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                قيم منصة كفاءة
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {values.map((v, i) => {
                  const isLight = i % 2 === 0;
                  return (
                    <div
                      key={v.label}
                      className={
                        "rounded-2xl p-4 text-center transition-colors " +
                        (isLight
                          ? "bg-white border border-white shadow-[0_18px_50px_-15px_hsl(220_75%_3%/0.7)]"
                          : "border border-white/15 bg-white/[0.04] hover:border-white/35")
                      }
                    >
                      <div
                        className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2"
                        style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                      >
                        <v.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className={`text-sm font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{v.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          <div className="mt-10 flex justify-center">
            <button onClick={() => navigate("/about")} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
              <ArrowRight className="w-4 h-4" /> العودة إلى عن المنصة
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
