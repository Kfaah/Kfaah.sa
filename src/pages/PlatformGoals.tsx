import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Target, Megaphone, HeartHandshake, BarChart3, Workflow } from "lucide-react";

const goals = [
  { icon: Megaphone, title: "تحسين الحملات التسويقية", desc: "تصميم وتشغيل حملات أكثر استهدافًا وأعلى تأثيرًا اعتمادًا على بيانات حقيقية." },
  { icon: HeartHandshake, title: "رفع معدلات التبرع والتفاعل", desc: "رفع جودة العلاقة مع المتبرع وزيادة معدلات الاستجابة والتحويل." },
  { icon: BarChart3, title: "قرارات مبنية على البيانات", desc: "تحويل الأرقام إلى مؤشرات واضحة تُمكّن القيادة من اتخاذ قرارات دقيقة." },
  { icon: Workflow, title: "أتمتة العمليات", desc: "تقليل الجهد التشغيلي وأتمتة المهام المتكررة لتحرير فرق العمل للأهم." },
];

export default function PlatformGoals() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Target className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-slate-700">منصة كفاءة</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 mb-3">أهداف المنصة</h1>
          <p className="text-slate-600">نحو أداء أكثر احترافية… ونتائج قابلة للقياس</p>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-l from-amber-500 to-orange-500 px-6 md:px-10 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold">أهداف المنصة</h2>
              <p className="text-sm opacity-90">ما الذي تسعى كفاءة لتحقيقه</p>
            </div>
          </div>
          <div className="p-6 md:p-10">
            <p className="text-slate-600 leading-loose mb-6">
              كفاءة ليست مجرد منصة إلكترونية فحسب، بل منظومة ذكية تُعيد تعريف طريقة إدارة التسويق في القطاع
              غير الربحي. من خلال أدوات متقدمة تعتمد على تحليل البيانات والذكاء الاصطناعي، تُمكّن المنصة الجمعيات من:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {goals.map((g, i) => (
                <motion.div
                  key={g.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-br from-amber-50/60 to-white p-5 flex items-start gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                    <g.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">{g.title}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{g.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="mt-10 flex justify-center">
          <button onClick={() => navigate("/about")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowRight className="w-4 h-4" /> العودة إلى عن المنصة
          </button>
        </div>
      </div>
    </div>
  );
}