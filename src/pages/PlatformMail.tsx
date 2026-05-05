import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Inbox, Send, ChevronRight, Sparkles, Construction } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const OWNER_EMAIL = "info@kfaah.org";

export default function PlatformMail() {
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
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl text-center"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/30"
            style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
            <Mail className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            بريد <span style={{ color: `hsl(${accentHsl})` }}>كفاءة</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-8">
            صندوق الوارد الرسمي للمنصة — قريباً ستتمكن من قراءة وإرسال رسائل البريد الإلكتروني مباشرة من هنا.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl p-5 bg-white/[0.05] backdrop-blur-xl border border-white/15 text-right">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                  <Inbox className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-white">الوارد</h3>
              </div>
              <p className="text-xs text-slate-400">عرض الرسائل الواردة من الجمعيات والشركاء.</p>
            </div>
            <div className="rounded-2xl p-5 bg-white/[0.05] backdrop-blur-xl border border-white/15 text-right">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-white">إرسال</h3>
              </div>
              <p className="text-xs text-slate-400">إنشاء وإرسال بريد جديد من حساب المنصة الرسمي.</p>
            </div>
          </div>

          <div className="rounded-2xl p-5 bg-white/[0.04] border border-white/15 mb-6 text-right">
            <div className="flex items-center gap-2 mb-2">
              <Construction className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
              <span className="text-xs font-bold text-white">قيد التهيئة</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              جاري ربط صندوق البريد الرسمي{" "}
              <span dir="ltr" className="font-bold text-white">{OWNER_EMAIL}</span>{" "}
              مع المنصة. حتى ذلك الحين يمكنك استخدام نظام التواصل الذكي لمتابعة الرسائل الواردة من النموذج.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate("/inbox")}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white border border-white/20 bg-white/[0.06] hover:bg-white/[0.12] transition-all"
            >
              <Sparkles className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
              فتح نظام التواصل الذكي
            </button>
            <a
              href={`mailto:${OWNER_EMAIL}`}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <Mail className="w-4 h-4" />
              فتح البريد الرسمي
            </a>
          </div>

          <button
            onClick={() => navigate("/auth")}
            className="mt-8 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            العودة إلى تسجيل الدخول
          </button>
        </motion.div>
      </main>
    </div>
  );
}
