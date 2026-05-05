import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, Compass, Target, Star, Lightbulb,
  ListChecks, BrainCircuit, Database, HeartHandshake, BarChart3,
  Workflow, Bot, LineChart, Megaphone, FileSpreadsheet, Layers,
} from "lucide-react";

const values = [
  { icon: BrainCircuit, label: "الذكاء" },
  { icon: Sparkles, label: "الكفاءة" },
  { icon: LineChart, label: "النمو" },
  { icon: Lightbulb, label: "الابتكار" },
  { icon: HeartHandshake, label: "الموثوقية" },
];

const goals = [
  { icon: Megaphone, title: "تحسين الحملات التسويقية", desc: "تصميم وتشغيل حملات أكثر استهدافًا وأعلى تأثيرًا اعتمادًا على بيانات حقيقية." },
  { icon: HeartHandshake, title: "رفع معدلات التبرع والتفاعل", desc: "رفع جودة العلاقة مع المتبرع وزيادة معدلات الاستجابة والتحويل." },
  { icon: BarChart3, title: "قرارات مبنية على البيانات", desc: "تحويل الأرقام إلى مؤشرات واضحة تُمكّن القيادة من اتخاذ قرارات دقيقة." },
  { icon: Workflow, title: "أتمتة العمليات", desc: "تقليل الجهد التشغيلي وأتمتة المهام المتكررة لتحرير فرق العمل للأهم." },
];

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
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-teal-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-slate-700">منصة كفاءة</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 leading-tight">
            نحو كفاءة أعلى… <span className="bg-gradient-to-l from-cyan-600 to-teal-600 bg-clip-text text-transparent">بذكاء تقني</span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            في عالم يتسارع فيه التحول الرقمي، تأتي <strong className="text-slate-800">كفاءة</strong> لتكون الشريك الذكي
            الذي يحوّل البيانات إلى قرارات، والجهد إلى أثر، والحملات إلى نتائج.
            <br />
            نؤمن أن كل جمعية تستحق أدوات احترافية تُمكّنها من تحقيق رسالتها بأعلى كفاءة… وهنا تبدأ رحلتك معنا.
          </p>
        </motion.div>

        {/* Section 1: Identity (Who / Vision / Mission / Values) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden"
        >
          <div className="bg-gradient-to-l from-cyan-600 to-teal-600 px-6 md:px-10 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold">الرؤية والرسالة</h2>
              <p className="text-sm opacity-90">التعريف · الرؤية · الرسالة · القيم</p>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ما هي منصة كفاءة؟</h3>
              <p className="text-slate-600 leading-loose">
                منصة كفاءة هي حلٌّ تقنيٌّ متكامل لإدارة التسويق الإلكتروني للجمعيات، تعتمد على
                الذكاء الاصطناعي وتحليل البيانات لرفع كفاءة الأداء وتحقيق نمو مستدام.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-cyan-700" />
                  <h4 className="font-bold text-slate-800">الرؤية</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  أن نكون الشريك التقني الأول للجمعيات في تطوير أدائها التسويقي وتحويل بياناتها
                  إلى قرارات تصنع أثرًا حقيقيًا ومستدامًا.
                </p>
              </div>
              <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-5 h-5 text-teal-700" />
                  <h4 className="font-bold text-slate-800">الرسالة</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  تمكين الجمعيات من إدارة عملها التسويقي بذكاء واحترافية، عبر منظومة رقمية
                  متكاملة تعتمد على الذكاء الاصطناعي وتحليل البيانات.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                قيم منصة كفاءة
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {values.map((v) => (
                  <div
                    key={v.label}
                    className="rounded-2xl border border-slate-100 bg-white p-4 text-center hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mb-2">
                      <v.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section 2: Goals */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden"
        >
          <div className="bg-gradient-to-l from-amber-500 to-orange-500 px-6 md:px-10 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold">أهداف المنصة</h2>
              <p className="text-sm opacity-90">نحو أداء أكثر احترافية… ونتائج قابلة للقياس</p>
            </div>
          </div>
          <div className="p-6 md:p-10">
            <p className="text-slate-600 leading-loose mb-6">
              كفاءة ليست مجرد منصة إلكترونية فحسب، بل منظومة ذكية تُعيد تعريف طريقة إدارة
              التسويق في القطاع غير الربحي. من خلال أدوات متقدمة تعتمد على تحليل البيانات
              والذكاء الاصطناعي، تُمكّن المنصة الجمعيات من:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {goals.map((g) => (
                <div
                  key={g.title}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-br from-amber-50/60 to-white p-5 flex items-start gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                    <g.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">{g.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Section 3: Features */}
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
            onClick={() => navigate("/demo")}
            className="bg-white text-slate-700 font-bold px-6 py-3 rounded-2xl shadow-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            العودة للنسخة التجريبية
          </button>
        </div>
      </div>
    </div>
  );
}