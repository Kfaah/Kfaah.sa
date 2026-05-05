import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ChevronRight, ExternalLink, Sparkles } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

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
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl"
        >
          <button
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
            العودة
          </button>

          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
            <div
              className="px-6 py-5 flex items-center gap-3 border-b border-white/10"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.35), hsl(${accentHsl} / 0.18))` }}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-black/30">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold text-white">بريد كفاءة الرسمي</div>
                <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" style={{ color: `hsl(${accentHsl})` }} />
                  info@kfaah.org — مُستضاف على Zoho Mail
                </div>
              </div>
            </div>

            <div className="px-6 py-6 space-y-4 text-right">
              <p className="text-sm leading-relaxed text-slate-200">
                البريد الرسمي للجمعية يعمل بشكل كامل عبر <strong>Zoho Mail</strong>. للوصول إلى صندوق الوارد،
                إرسال واستقبال الرسائل، يُرجى الدخول مباشرة إلى لوحة Zoho.
              </p>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc pr-4">
                <li>المراسلات التلقائية للمنصة (تسجيل دخول، تنبيهات…) تعمل من <code className="text-amber-200">notify@kfaah.org</code></li>
                <li>المراسلات الرسمية اليدوية تُرسل من <code className="text-amber-200">info@kfaah.org</code> عبر Zoho</li>
              </ul>

              <a
                href="https://mail.zoho.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
              >
                <ExternalLink className="w-4 h-4" />
                فتح بريد Zoho (mail.zoho.com)
              </a>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
