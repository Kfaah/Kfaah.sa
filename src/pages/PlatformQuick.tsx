import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Layers, ListTodo, ClipboardList, Users,
  Building2, MessageSquare, FolderKanban, Settings2, BarChart3,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const modules = [
  { icon: FolderKanban, title: "الخطط التشغيلية والتنفيذية", desc: "مساحة عمل لبناء الخطط ومتابعة الأهداف والمبادرات والمؤشرات." },
  { icon: ListTodo, title: "إدارة المهام", desc: "توزيع المهام، متابعة الإنجاز، والتواصل حول كل مهمة في مكان واحد." },
  { icon: Users, title: "ملفات الموظفين", desc: "ملف متكامل لكل موظف يضم بياناته ومهامه وتقييماته وأداءه." },
  { icon: BarChart3, title: "لوحات الأداء", desc: "مؤشرات حيّة لأداء الجمعية والموظفين تظهر الصورة الكاملة فورًا." },
  { icon: MessageSquare, title: "المساعد الذكي", desc: "مساعد محادثة يجيب عن الأسئلة ويقترح القرارات بناءً على بيانات الجمعية." },
  { icon: Building2, title: "الملف المؤسسي", desc: "تعريف بالجمعية ومجالاتها ومنتجاتها لتغذية المنصة بسياقٍ ذكي." },
  { icon: ClipboardList, title: "التقييم والمحاسبة", desc: "تقييمات دورية وآلية مع سجل واضح للمسؤوليات والإنجازات." },
  { icon: Settings2, title: "الإعدادات والصلاحيات", desc: "تحكم دقيق في الأدوار والصلاحيات وهوية الجمعية داخل المنصة." },
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
            <Layers className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
            <span className="text-xs font-bold text-white">وحدات النظام</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            الأقسام التي تتكوّن منها كفاءة
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            نظرة على الوحدات التشغيلية داخل المنصة وكيف يستخدمها فريق الجمعية في عمله اليومي.
          </p>
        </motion.div>

        <div className="w-full max-w-4xl space-y-3">
          {modules.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.45 }}
              className="group flex items-start gap-4 bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/15 p-4 md:p-5 text-right hover:border-white/35 hover:bg-white/[0.08] transition-all"
            >
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))`,
                }}
              >
                <m.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-white mb-1">{m.title}</h3>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{m.desc}</p>
              </div>
              <span
                className="hidden md:block text-xs font-bold mt-1.5"
                style={{ color: `hsl(${accentHsl})` }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
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