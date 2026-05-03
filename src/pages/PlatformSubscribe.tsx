import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, Building2, Phone, Mail, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "الباقة الأساسية",
    price: "مجانية",
    period: "للجمعيات الناشئة",
    color: "from-cyan-500 to-teal-500",
    icon: Sparkles,
    features: [
      "حتى 10 موظفين",
      "إدارة المهام والخطط",
      "تقارير أساسية",
      "دعم فني عبر البريد",
    ],
    cta: "ابدأ مجاناً",
    highlight: false,
  },
  {
    name: "الباقة الاحترافية",
    price: "حسب الحجم",
    period: "الأكثر طلباً",
    color: "from-violet-600 to-purple-600",
    icon: Crown,
    features: [
      "موظفون غير محدودين",
      "الذكاء الاصطناعي الكامل",
      "تقارير وتحليلات متقدمة",
      "خطط تشغيلية ذكية",
      "دعم فني مخصص",
      "تدريب وتأهيل الفريق",
    ],
    cta: "اطلب عرض سعر",
    highlight: true,
  },
  {
    name: "باقة المؤسسات",
    price: "مخصصة",
    period: "للجمعيات الكبرى",
    color: "from-amber-500 to-orange-600",
    icon: Building2,
    features: [
      "تخصيص كامل للمنصة",
      "تكاملات خارجية",
      "تدريب موسّع",
      "مدير حساب مخصص",
      "اتفاقية مستوى خدمة (SLA)",
    ],
    cta: "تواصل معنا",
    highlight: false,
  },
];

export default function PlatformSubscribe() {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-md mb-4">
            <Crown className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-bold text-slate-700">الاشتراك في المنصة</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4">
            اختر الباقة المناسبة لجمعيتك
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            باقات مرنة تناسب حجم جمعيتك واحتياجاتها — مع إمكانية الترقية في أي وقت.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative bg-white rounded-3xl p-6 shadow-xl border-2 transition-all hover:-translate-y-2 ${
                p.highlight ? "border-violet-500 shadow-violet-200/50 md:scale-105" : "border-slate-100"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
                  الأكثر طلباً
                </div>
              )}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4 shadow-lg`}>
                <p.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">{p.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{p.period}</p>
              <div className="text-3xl font-extrabold text-slate-800 mb-6">{p.price}</div>
              <ul className="space-y-3 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  p.highlight
                    ? `bg-gradient-to-r ${p.color} text-white shadow-lg hover:shadow-xl`
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {p.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* تواصل */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 bg-white rounded-3xl p-8 shadow-xl border border-slate-100"
        >
          <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">للتواصل والاستفسار</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <a href="mailto:info@charity-crm.org" className="flex items-center gap-3 p-4 rounded-2xl bg-cyan-50 hover:bg-cyan-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">البريد الإلكتروني</div>
                <div className="font-bold text-slate-800">info@charity-crm.org</div>
              </div>
            </a>
            <a href="tel:+966500000000" className="flex items-center gap-3 p-4 rounded-2xl bg-violet-50 hover:bg-violet-100 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-violet-500 flex items-center justify-center">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-sm text-slate-600">للتواصل المباشر</div>
                <div className="font-bold text-slate-800" dir="ltr">+966 50 000 0000</div>
              </div>
            </a>
          </div>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate("/demo")}
            className="bg-white text-slate-700 font-bold px-6 py-3 rounded-2xl shadow-md border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            العودة للنسخة التجريبية
          </button>
        </div>
      </div>
    </div>
  );
}