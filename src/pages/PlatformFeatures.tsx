import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, Target, Lightbulb,
  ListChecks, BrainCircuit, Database, HeartHandshake,
  Workflow, Bot, LineChart, Megaphone, FileSpreadsheet, Layers,
} from "lucide-react";

const features = [
  {
    icon: Workflow,
    title: "أتمتة كاملة لإدارة العمل",
    desc: "المنصة تبني نظامًا إلكترونيًا متكاملًا يدير دورة العمل من التخطيط حتى التنفيذ والتقييم دون تدخل بشري.",
  },
  {
    icon: Layers,
    title: "إعداد الخطط تلقائيًا",
    desc: "تفهم المنصة طبيعة الجمعية وتُعد الخطط التشغيلية والتنفيذية والمهام بشكل متكامل ومترابط.",
  },
  {
    icon: ListChecks,
    title: "تنزيل المهام اليومية",
    desc: "توزيع المهام يوميًا على الموظفين أوتوماتيكيًا بناءً على ملفات الجمعية أو الربط المباشر مع المتجر الإلكتروني.",
  },
  {
    icon: Bot,
    title: "تقييم الموظفين بالذكاء الاصطناعي",
    desc: "تقييمات دورية وآلية لأداء الموظفين بناءً على جودة الإنجاز والالتزام والإنتاجية.",
  },
  {
    icon: BrainCircuit,
    title: "تعلّم ذاتي مستمر",
    desc: "تُعيد المنصة برمجة نفسها لتتعرف في كل مرة على طبيعة عمل الجمعية من خلال البيانات المُدخلة.",
  },
  {
    icon: Lightbulb,
    title: "أفكار ومبادرات وابتكارات",
    desc: "اقتراحات وتوصيات ذكية لإدارة العمل التسويقي وإطلاق مبادرات جديدة قابلة للتنفيذ.",
  },
  {
    icon: HeartHandshake,
    title: "فهم سلوك المتبرعين",
    desc: "تتعرف المنصة على أنماط المتبرعين وتُرشد الجمعية للتعامل الأمثل مع كل شريحة.",
  },
  {
    icon: Megaphone,
    title: "ربط ذكي بين التبرعات",
    desc: "ربط تبرعات المتبرعين عبر الحملات والمشاريع، مع تذكيرات وأفكار للتعامل معها بأفضل صورة.",
  },
  {
    icon: LineChart,
    title: "استخراج البيانات والمؤشرات",
    desc: "استخراج أرقام ومؤشرات تسويقية مفيدة وتحويلها إلى رؤى عملية للقرار والتنفيذ.",
  },
  {
    icon: Database,
    title: "قاعدة بيانات متكاملة",
    desc: "قاعدة شاملة من البيانات والتحليلات عن كل متبرع وكل مشروع وكل حملة في مكان واحد.",
  },
  {
    icon: FileSpreadsheet,
    title: "تكامل مع متجر الجمعية",
    desc: "ربط مباشر مع المتجر الإلكتروني لتغذية النظام بالبيانات وتحديث الخطط والمهام تلقائيًا.",
  },
  {
    icon: Target,
    title: "متابعة دقيقة للأداء",
    desc: "لوحات تحكم حيّة لمتابعة المؤشرات في الوقت الفعلي، وتقارير قابلة للتصدير بصيغ احترافية.",
  },
];

export default function PlatformFeatures() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-bold text-slate-700">منصة كفاءة</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 mb-3">مميزات المنصة</h1>
          <p className="text-slate-600">كيف تُسهم كفاءة في أتمتة العمل وبناء نظام إلكتروني متكامل</p>
        </motion.div>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden"
        >
          <div className="bg-gradient-to-l from-violet-600 to-fuchsia-600 px-6 md:px-10 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold">مميزات المنصة</h2>
              <p className="text-sm opacity-90">كيف تُسهم كفاءة في أتمتة العمل وبناء نظام إلكتروني متكامل</p>
            </div>
          </div>
          <div className="p-6 md:p-10">
            <p className="text-slate-600 leading-loose mb-6">
              تعمل كفاءة كعقلٍ رقميٍّ ذكيّ يتكامل مع جميع جوانب العمل التسويقي في الجمعية،
              ويتعلّم باستمرار من بياناتها ليمنحها أدوات قرار وتنفيذ في كل مرحلة:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-gradient-to-br from-violet-50/40 to-white rounded-2xl p-5 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center mb-4 shadow-md">
                <f.icon className="w-6 h-6 text-white" />
              </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
            <div className="mt-8 rounded-2xl bg-gradient-to-l from-slate-900 to-slate-800 text-white p-6 md:p-8 text-center">
              <p className="text-base md:text-lg leading-relaxed">
                نحو أداء أكثر احترافية… ونتائج قابلة للقياس.
              </p>
            </div>
          </div>
        </motion.section>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate("/subscribe")}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition-all hover:scale-105"
          >
            اشترك في المنصة
          </button>
          <button
            onClick={() => navigate("/about")}
            className="bg-white text-slate-700 font-bold px-6 py-3 rounded-2xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            العودة إلى عن المنصة
          </button>
        </div>
      </div>
    </div>
  );
}