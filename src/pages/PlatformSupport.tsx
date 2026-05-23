import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LifeBuoy, Phone, Mail, MessageCircle, Send, ShieldCheck,
  Clock, Sparkles, CheckCircle2, ArrowRight, Contact, MessagesSquare, CreditCard, ChevronRight,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import BackToAboutButton from "@/components/platform/BackToAboutButton";
import { KafaaLogoArtworkCropped } from "@/components/brand/PlatformBrand";
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

type View = "home" | "info" | "contact";

export default function PlatformSupport() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("home");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    sender_name: "", sender_email: "", sender_phone: "",
    organization_name: "", subject: "", message: "", category: "general",
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

  const cards = [
    {
      id: "info" as View,
      icon: Contact,
      title: "بيانات التواصل",
      desc: "رسالتنا الترحيبية وقنوات التواصل المباشرة",
      gradient: "from-cyan-400 to-blue-600",
    },
    {
      id: "contact" as View,
      icon: MessagesSquare,
      title: "راسلنا",
      desc: "نظام التواصل الذكي — أرسل رسالتك وسنرد عليك",
      gradient: "from-emerald-400 to-teal-600",
    },
    {
      id: "subscribe" as const,
      icon: CreditCard,
      title: "باقات الاشتراك",
      desc: "أسعار ديناميكية وخيار التملك الكامل للمنصة",
      gradient: "from-amber-400 to-orange-600",
    },
  ];

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
        {/* Kafaa logo — same circles as /about */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex items-center justify-center mb-8"
        >
          <div
            className="absolute inset-0 rounded-full blur-3xl opacity-60"
            style={{
              background: `radial-gradient(circle, hsl(${primaryHsl} / 0.55) 0%, transparent 70%)`,
              transform: "scale(1.6)",
            }}
            aria-hidden="true"
          />
          <div
            className="absolute -inset-6 rounded-full org-spin-slow pointer-events-none"
            style={{ border: `1px dashed hsl(${accentHsl} / 0.5)` }}
            aria-hidden="true"
          />
          <KafaaLogoArtworkCropped
            className="relative h-32 w-32 md:h-44 md:w-44 object-contain"
            style={{
              filter:
                "drop-shadow(0 0 24px hsl(0 0% 100% / 0.35)) drop-shadow(0 18px 40px hsl(220 75% 3% / 0.55))",
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.55 }}
          className="text-center mb-10 max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/15 mb-4">
            <LifeBuoy className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
            <span className="text-xs font-bold text-white">الدعم الفني</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            مرحباً بك في مركز دعم <span style={{ color: `hsl(${accentHsl})` }}>كفاءة</span>
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            اختر ما تحتاجه وسنكون معك في كل خطوة.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              {cards.map((c, i) => (
                <motion.button
                  key={c.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.5 }}
                  onClick={() => {
                    if (c.id === "subscribe") navigate("/subscribe");
                    else setView(c.id);
                  }}
                  className="group relative text-right rounded-3xl p-6 md:p-7 bg-white/[0.06] backdrop-blur-xl border border-white/15 hover:border-white/40 shadow-[0_12px_40px_-12px_hsl(220_75%_3%/0.7)] hover:shadow-[0_20px_60px_-12px_hsl(220_75%_3%/0.9)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
                >
                  <div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${c.gradient}`}
                    aria-hidden="true"
                  />
                  <div className="relative flex items-center justify-between mb-5">
                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-lg shadow-black/30 group-hover:scale-110 transition-transform duration-500`}
                    >
                      <c.icon className="w-7 h-7 text-white" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/40 rotate-180 group-hover:text-white group-hover:-translate-x-1 transition-all" />
                  </div>
                  <h3 className="relative text-lg md:text-xl font-bold text-white mb-2">{c.title}</h3>
                  <p className="relative text-xs md:text-sm text-slate-300 leading-relaxed">{c.desc}</p>
                </motion.button>
              ))}
            </motion.div>
          )}

          {view === "info" && (
            <motion.section
              key="info"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-4xl"
            >
              <BackInline onBack={() => setView("home")} />

              <div className="rounded-3xl p-6 md:p-8 bg-white/[0.05] backdrop-blur-xl border border-white/15 mb-6">
                <h2 className="text-xl md:text-2xl font-extrabold text-white mb-3">رسالتنا إليك</h2>
                <p className="text-sm md:text-base text-slate-300 leading-loose">
                  في <span className="font-bold text-white">كفاءة</span> نؤمن بأن كل جمعية تستحق منصة تليق بطموحها.
                  نحن هنا لمساعدتك على تهيئة المنصة، تدريب فريقك، وحل أي تحدٍّ قد يواجهك. تواصل معنا في أي وقت
                  عبر القنوات أدناه — متوسط وقت الرد خلال 24 ساعة.
                </p>
                <div className="flex flex-wrap gap-3 mt-5">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    icon: MessageCircle, title: "واتساب", value: OWNER_PHONE,
                    href: `https://wa.me/${OWNER_PHONE_INTL}?text=${encodeURIComponent("السلام عليكم، لدي استفسار بخصوص منصة كفاءة")}`,
                    gradient: "from-emerald-400 to-teal-600", external: true,
                  },
                  { icon: Phone, title: "اتصال مباشر", value: OWNER_PHONE, href: `tel:+${OWNER_PHONE_INTL}`, gradient: "from-cyan-400 to-blue-600" },
                  { icon: Mail, title: "البريد الإلكتروني", value: OWNER_EMAIL, href: `mailto:${OWNER_EMAIL}`, gradient: "from-amber-400 to-orange-600" },
                ].map((c) => (
                  <a
                    key={c.title}
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl p-5 bg-white/[0.06] backdrop-blur-xl border border-white/15 hover:border-white/40 hover:bg-white/[0.1] transition-all hover:-translate-y-0.5"
                  >
                    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${c.gradient} shadow-lg shadow-black/30 group-hover:scale-110 transition-transform`}>
                      <c.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400 mb-0.5">{c.title}</div>
                      <div className="text-sm font-bold text-white" dir="ltr">{c.value}</div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.section>
          )}

          {view === "contact" && (
            <motion.section
              key="contact"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45 }}
              className="w-full max-w-3xl"
            >
              <BackInline onBack={() => setView("home")} />
              <div className="rounded-3xl p-6 md:p-8 bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)]">
                {done ? (
                  <div className="text-center py-10">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                      style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-extrabold text-white mb-2">تم استلام رسالتك بنجاح</h3>
                    <p className="text-sm text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
                      شكراً للتواصل مع منصة كفاءة. سنرد عليك على{" "}
                      <span className="text-white font-bold" dir="ltr">{form.sender_email}</span> في أقرب فرصة.
                    </p>
                    <button
                      onClick={() => {
                        setDone(false);
                        setForm({ sender_name: "", sender_email: "", sender_phone: "", organization_name: "", subject: "", message: "", category: "general" });
                      }}
                      className="text-sm font-bold text-white/80 hover:text-white underline-offset-4 hover:underline"
                    >
                      إرسال رسالة أخرى
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4">
                    <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1">نظام التواصل الذكي</h2>
                    <p className="text-xs md:text-sm text-slate-300 mb-4">املأ الحقول التالية وسنرد عليك مباشرة على بريدك.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="الاسم *">
                        <Input value={form.sender_name} onChange={(e) => update("sender_name", e.target.value)} required maxLength={120} placeholder="اسمك الكامل" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                      </Field>
                      <Field label="البريد الإلكتروني *">
                        <Input type="email" value={form.sender_email} onChange={(e) => update("sender_email", e.target.value)} required maxLength={200} placeholder="example@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                      </Field>
                      <Field label="رقم الجوال">
                        <Input value={form.sender_phone} onChange={(e) => update("sender_phone", e.target.value)} maxLength={30} placeholder="05xxxxxxxx" className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                      </Field>
                      <Field label="اسم الجمعية">
                        <Input value={form.organization_name} onChange={(e) => update("organization_name", e.target.value)} placeholder="اسم الجمعية أو المنظمة" maxLength={200} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                      </Field>
                    </div>

                    <Field label="نوع الاستفسار">
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c) => (
                          <button
                            key={c.id} type="button"
                            onClick={() => update("category", c.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                              form.category === c.id ? "border-white/50 text-white" : "border-white/15 text-slate-300 hover:border-white/30"
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
                      type="submit" disabled={submitting}
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
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="mt-10 flex justify-center">
          {view === "home" ? (
            <BackToAboutButton onClick={() => navigate("/about")} />
          ) : (
            <BackToAboutButton onClick={() => { setView("home"); setDone(false); }} label="العودة إلى الدعم الفني" />
          )}
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

function BackInline({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
    >
      <ChevronRight className="w-4 h-4" />
      العودة إلى خيارات الدعم
    </button>
  );
}
