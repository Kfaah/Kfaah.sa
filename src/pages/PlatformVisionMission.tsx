import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Compass, Target, Star, Lightbulb, BrainCircuit, HeartHandshake, LineChart } from "lucide-react";

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
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-teal-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Compass className="w-5 h-5 text-cyan-600" />
            <span className="text-sm font-bold text-slate-700">منصة كفاءة</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-800 mb-3">الرؤية والرسالة</h1>
          <p className="text-slate-600">التعريف · الرؤية · الرسالة · القيم</p>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-l from-cyan-600 to-teal-600 px-6 md:px-10 py-6 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div className="text-white">
              <h2 className="text-2xl font-extrabold">الرؤية والرسالة</h2>
              <p className="text-sm opacity-90">من نحن · ما نسعى إليه · ما نؤمن به</p>
            </div>
          </div>
          <div className="p-6 md:p-10 space-y-8">
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ما هي منصة كفاءة؟</h3>
              <p className="text-slate-600 leading-loose">
                منصة كفاءة هي حلٌّ تقنيٌّ متكامل لإدارة التسويق الإلكتروني للجمعيات، تعتمد على الذكاء
                الاصطناعي وتحليل البيانات لرفع كفاءة الأداء وتحقيق نمو مستدام.
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
                  تمكين الجمعيات من إدارة عملها التسويقي بذكاء واحترافية، عبر منظومة رقمية متكاملة
                  تعتمد على الذكاء الاصطناعي وتحليل البيانات.
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
                  <div key={v.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center hover:shadow-md transition-shadow">
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

        <div className="mt-10 flex justify-center">
          <button onClick={() => navigate("/about")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowRight className="w-4 h-4" /> العودة إلى عن المنصة
          </button>
        </div>
      </div>
    </div>
  );
}