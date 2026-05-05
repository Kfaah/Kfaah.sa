import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Target, Megaphone, HeartHandshake, BarChart3, Workflow } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const goals = [
  { icon: Megaphone, title: "تحسين الحملات التسويقية", desc: "تصميم وتشغيل حملات أكثر استهدافًا وأعلى تأثيرًا اعتمادًا على بيانات حقيقية." },
  { icon: HeartHandshake, title: "رفع معدلات التبرع والتفاعل", desc: "رفع جودة العلاقة مع المتبرع وزيادة معدلات الاستجابة والتحويل." },
  { icon: BarChart3, title: "قرارات مبنية على البيانات", desc: "تحويل الأرقام إلى مؤشرات واضحة تُمكّن القيادة من اتخاذ قرارات دقيقة." },
  { icon: Workflow, title: "أتمتة العمليات", desc: "تقليل الجهد التشغيلي وأتمتة المهام المتكررة لتحرير فرق العمل للأهم." },
];

export default function PlatformGoals() {
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
              <Target className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
              <span className="text-xs font-bold text-white">منصة كفاءة</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">أهداف المنصة</h1>
            <p className="text-sm md:text-base text-slate-300">نحو أداء أكثر احترافية… ونتائج قابلة للقياس</p>
          </motion.div>

          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-10">
            <p className="text-slate-300 leading-loose mb-8 text-sm md:text-base">
              كفاءة ليست مجرد منصة إلكترونية فحسب، بل منظومة ذكية تُعيد تعريف طريقة إدارة التسويق في القطاع
              غير الربحي. من خلال أدوات متقدمة تعتمد على تحليل البيانات والذكاء الاصطناعي، تُمكّن المنصة الجمعيات من:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {goals.map((g, i) => {
                const isLight = i % 2 === 1;
                return (
                  <motion.div
                    key={g.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className={
                      "rounded-2xl p-5 flex items-start gap-4 transition-colors " +
                      (isLight
                        ? "bg-white border border-white shadow-[0_18px_50px_-15px_hsl(220_75%_3%/0.7)]"
                        : "border border-white/15 bg-white/[0.04] hover:border-white/35")
                    }
                  >
                    <div
                      className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                    >
                      <g.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className={`font-bold mb-1 ${isLight ? "text-slate-900" : "text-white"}`}>{g.title}</h4>
                      <p className={`text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-slate-300"}`}>{g.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
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
