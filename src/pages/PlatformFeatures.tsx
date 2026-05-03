import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, ListTodo, BarChart3, Users, Brain,
  Calendar, FileText, Bell, Shield, Zap, Target,
} from "lucide-react";

const features = [
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

export default function PlatformFeatures() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-teal-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-bold text-slate-700">مميزات المنصة</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4">
            منصة متكاملة لإدارة الجمعيات الخيرية
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            كل ما تحتاجه جمعيتك في مكان واحد — مدعوم بالذكاء الاصطناعي ومصمم خصيصاً للعمل الخيري.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-slate-100"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mb-4 shadow-md">
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

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