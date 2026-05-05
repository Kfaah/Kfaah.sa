import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LifeBuoy, Phone, Mail, MessageCircle, Send, ShieldCheck,
  Clock, Sparkles, CheckCircle2,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import BackToAboutButton from "@/components/platform/BackToAboutButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const OWNER_PHONE = "0595784433";
const OWNER_PHONE_INTL = "966595784433";
const OWNER_EMAIL = "info@kfaah.org";

const categories = [
  { id: "general", label: "استفسار عام" },
  { id: "technical", label: "مشكلة تقنية" },
  { id: "subscription", label: "الاشتراك والباقات" },
  { id: "purchase", label: "شراء وتملّك المنصة" },
  { id: "training", label: "طلب تدريب" },
  { id: "other", label: "أخرى" },
];

export default function PlatformSupport() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    sender_phone: "",
    organization_name: "",
    subject: "",
    message: "",
    category: "general",
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sender_name.trim() || !form.sender_email.trim() || !form.message.trim()) {
      toast.error("الاسم والإيميل والرسالة حقول مطلوبة");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        sender_name: form.sender_name.trim().slice(0, 120),
        sender_email: form.sender_email.trim().slice(0, 200),
        sender_phone: form.sender_phone.trim().slice(0, 30) || null,
        organization_name: form.organization_name.trim().slice(0, 200) || null,
        subject: (form.subject.trim() || "رسالة دعم").slice(0, 200),
        message: form.message.trim().slice(0, 5000),
        category: form.category,
      });
      if (error) throw error;
      setDone(true);
      toast.success("تم استلام رسالتك — سنتواصل معك قريباً");
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إرسال الرسالة، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

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

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 mb-5">
            <LifeBuoy className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
            <span className="text-xs font-bold text-white">الدعم الفني</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            نحن هنا لمساعدتك في كل خطوة
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            فريق <span style={{ color: `hsl(${accentHsl})` }} className="font-bold">كفاءة</span> جاهز للرد على استفساراتك،
            مساعدتك في التهيئة، وحل أي تحدٍّ تواجهه.
            تواصل معنا عبر القنوات أدناه أو أرسل لنا رسالة وسنرد عليك بأقصى سرعة.
          </p>

          {/* Trust strip */}
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {[
              { icon: Clock, label: "متوسط الرد خلال 24 ساعة" },
              { icon: ShieldCheck, label: "دعم آمن ومحفوظ" },
              { icon: Sparkles, label: "خبراء في القطاع غير الربحي" },
            ].map((t) => (
              <div
                key={t.label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-xs text-slate-200"
              >
                <t.icon className="w-3.5 h-3.5" style={{ color: `hsl(${accentHsl})` }} />
                {t.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick contact channels */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon: MessageCircle,
              title: "واتساب",
              value: OWNER_PHONE,
              href: `https://wa.me/${OWNER_PHONE_INTL}?text=${encodeURIComponent("السلام عليكم، لدي استفسار بخصوص منصة كفاءة")}`,
              gradient: "from-emerald-400 to-teal-600",
            },
            {
              icon: Phone,
              title: "اتصال مباشر",
              value: OWNER_PHONE,
              href: `tel:+${OWNER_PHONE_INTL}`,
              gradient: "from-cyan-400 to-blue-600",
            },
            {
              icon: Mail,
              title: "البريد الإلكتروني",
              value: OWNER_EMAIL,
              href: `mailto:${OWNER_EMAIL}`,
              gradient: "from-amber-400 to-orange-600",
            },
          ].map((c, i) => (
            <motion.a
              key={c.title}
              href={c.href}
              target={c.title === "واتساب" ? "_blank" : undefined}
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
              className="group flex items-center gap-4 rounded-2xl p-5 bg-white/[0.06] backdrop-blur-xl border border-white/15 hover:border-white/40 hover:bg-white/[0.1] transition-all hover:-translate-y-0.5"
            >
              <div
                className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.gradient} shadow-lg shadow-black/30 group-hover:scale-110 transition-transform`}
              >
                <c.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 mb-0.5">{c.title}</div>
                <div className="text-sm font-bold text-white" dir="ltr">{c.value}</div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Contact form */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.55 }}
          className="w-full max-w-3xl rounded-3xl p-6 md:p-8 bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)]"
        >
          {done ? (
            <div className="text-center py-10">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
              >
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mb-2">تم استلام رسالتك بنجاح</h3>
              <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
                شكراً للتواصل مع منصة كفاءة. سنرد عليك على
                {" "}<span className="text-white font-bold" dir="ltr">{form.sender_email}</span>{" "}
                في أقرب فرصة ممكنة.
              </p>
              <button
                onClick={() => {
                  setDone(false);
                  setForm({
                    sender_name: "", sender_email: "", sender_phone: "",
                    organization_name: "", subject: "", message: "", category: "general",
                  });
                }}
                className="text-sm font-bold text-white/80 hover:text-white underline-offset-4 hover:underline"
              >
                إرسال رسالة جديدة
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1">أرسل لنا رسالة</h2>
                <p className="text-xs text-slate-400">سنرد على بريدك خلال 24 ساعة عمل.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="الاسم الكامل *" >
                  <Input value={form.sender_name} onChange={(e) => update("sender_name", e.target.value)} placeholder="أدخل اسمك" required maxLength={120} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                </Field>
                <Field label="البريد الإلكتروني *">
                  <Input type="email" value={form.sender_email} onChange={(e) => update("sender_email", e.target.value)} placeholder="you@example.com" required maxLength={200} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                </Field>
                <Field label="رقم الجوال">
                  <Input value={form.sender_phone} onChange={(e) => update("sender_phone", e.target.value)} placeholder="05xxxxxxxx" maxLength={30} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                </Field>
                <Field label="اسم الجمعية">
                  <Input value={form.organization_name} onChange={(e) => update("organization_name", e.target.value)} placeholder="اسم الجمعية أو المنظمة" maxLength={200} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                </Field>
              </div>

              <Field label="نوع الاستفسار">
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => update("category", c.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        form.category === c.id
                          ? "border-white/50 text-white"
                          : "border-white/15 text-slate-300 hover:border-white/30"
                      }`}
                      style={form.category === c.id ? { background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.6), hsl(${accentHsl} / 0.4))` } : { background: "hsl(0 0% 100% / 0.04)" }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="موضوع الرسالة">
                <Input value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="عنوان مختصر" maxLength={200} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
              </Field>

              <Field label="الرسالة *">
                <Textarea value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="اشرح استفسارك أو طلبك بالتفصيل..." required maxLength={5000} rows={6} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none" />
                <div className="text-[10px] text-slate-500 mt-1 text-left">{form.message.length}/5000</div>
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="group w-full flex items-center justify-center gap-3 rounded-xl py-3.5 font-bold text-white shadow-lg shadow-black/30 hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
              >
                {submitting ? "جارٍ الإرسال..." : (
                  <>
                    <Send className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    إرسال الرسالة
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>

        <div className="mt-10 flex justify-center">
          <BackToAboutButton onClick={() => navigate("/about")} />
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-200 mb-1.5">{label}</label>
      {children}
    </div>
  );
}