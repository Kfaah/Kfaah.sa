import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, ListTodo, Target, BarChart3, Brain, Users,
  Calendar, FileText, Bell, Shield, Zap,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const points = [
  { icon: ListTodo, title: "إدارة المهام الذكية", desc: "تتبع المهام، إشعارات تلقائية، وتقييم جودة الإنجاز بالذكاء الاصطناعي." },
  { icon: Target, title: "الخطط التشغيلية", desc: "بناء خطط تشغيلية متكاملة بأهداف ومبادرات ومؤشرات أداء واضحة." },
  { icon: BarChart3, title: "تقارير وتحليلات", desc: "لوحات تحكم تفاعلية ومؤشرات أداء آنية لاتخاذ قرارات مبنية على البيانات." },
  { icon: Brain, title: "الذكاء الاصطناعي", desc: "مساعد ذكي يدعم الموظف، توليد خطط تلقائي، وتحليل الأداء بدقة." },
  { icon: Users, title: "إدارة الموظفين", desc: "ملفات ذكية للموظفين، هيكل تنظيمي، وتقييمات دورية شاملة." },
  { icon: Calendar, title: "التقويم والمتابعة", desc: "متابعة المواعيد والاستحقاقات بالتقويمين الميلادي والهجري." },
  { icon: FileText, title: "التقارير المؤسسية", desc: "تقارير قابلة للتصدير بصيغ احترافية تدعم اللغة العربية بالكامل." },
  { icon: Bell, title: "إشعارات لحظية", desc: "نظام إشعارات متقدم يضمن وصول التحديثات للأشخاص المعنيين فوراً." },
  { icon: Shield, title: "أمان وخصوصية", desc: "حماية متقدمة للبيانات وصلاحيات دقيقة لكل مستخدم وكل دور." },
  { icon: Zap, title: "أداء فائق", desc: "واجهة سريعة وسلسة مصممة خصيصاً للجمعيات الخيرية." },
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
            منصة متكاملة لإدارة الجمعيات الخيرية
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            كل ما تحتاجه جمعيتك في مكان واحد — مدعوم بالذكاء الاصطناعي ومصمم خصيصاً للعمل الخيري.
          </p>
        </motion.div>

        <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {points.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.5 }}
              className="bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/15 p-5 text-right hover:border-white/35 transition-colors"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))`,
                }}
              >
                <p.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">{p.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{p.desc}</p>
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