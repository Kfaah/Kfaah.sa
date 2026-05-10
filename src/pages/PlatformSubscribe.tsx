import { type MouseEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crown, Megaphone, Users, Calendar, Briefcase, Sparkles,
  Mail, Phone, MessageCircle, Check, ArrowRight, Crown as CrownIcon,
  Calculator, Building2, Handshake,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import BackToAboutButton from "@/components/platform/BackToAboutButton";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const OWNER_PHONE = "0595784433";
const OWNER_PHONE_INTL = "966595784433";
const OWNER_EMAIL = "info@kfaah.org";

// ===== نموذج تسعير ديناميكي =====
// السعر يحسب بناءً على المعايير الخمسة. كل معيار له وزن.
// النتيجة سعر تأسيس تقديري + سعر تجديد سنوي تقديري.

const BASE_SETUP = 8000;     // سعر تأسيس قاعدي
const BASE_RENEWAL = 4500;   // سعر تجديد سنوي قاعدي

function calcPricing(opts: {
  campaign: "none" | "light" | "active" | "intensive";
  donors: "lt500" | "500_2000" | "2000_5000" | "gt5000";
  age: "lt2" | "2_5" | "5_10" | "gt10";
  staff: "lt5" | "5_15" | "15_30" | "gt30";
  ai: boolean;
}) {
  const campaignMult = { none: 0.85, light: 1.0, active: 1.2, intensive: 1.45 }[opts.campaign];
  const donorsAdd = { lt500: 0, "500_2000": 1500, "2000_5000": 3500, gt5000: 6500 }[opts.donors];
  const ageMult = { lt2: 0.9, "2_5": 1.0, "5_10": 1.15, gt10: 1.3 }[opts.age];
  const staffAdd = { lt5: 0, "5_15": 1200, "15_30": 3000, gt30: 5500 }[opts.staff];
  const aiAdd = opts.ai ? 3500 : 0;

  const setup = Math.round((BASE_SETUP * campaignMult * ageMult + donorsAdd + staffAdd + aiAdd) / 100) * 100;
  const renewal = Math.round((BASE_RENEWAL * campaignMult + donorsAdd * 0.4 + staffAdd * 0.5 + (opts.ai ? 1800 : 0)) / 100) * 100;
  return { setup, renewal };
}

const fmt = (n: number) => n.toLocaleString("ar-SA");

const openExternalLink = (href: string) => {
  const opened = window.open("about:blank", "_blank");
  if (opened) {
    opened.opener = null;
    opened.location.href = href;
    return;
  }

  window.location.assign(href);
};

export default function PlatformSubscribe() {
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<"none" | "light" | "active" | "intensive">("light");
  const [donors, setDonors] = useState<"lt500" | "500_2000" | "2000_5000" | "gt5000">("500_2000");
  const [age, setAge] = useState<"lt2" | "2_5" | "5_10" | "gt10">("2_5");
  const [staff, setStaff] = useState<"lt5" | "5_15" | "15_30" | "gt30">("5_15");
  const [ai, setAi] = useState(true);

  const pricing = useMemo(
    () => calcPricing({ campaign, donors, age, staff, ai }),
    [campaign, donors, age, staff, ai],
  );

  const summary = `حساب اشتراك مقترح:
• الحملة التسويقية: ${labelCampaign(campaign)}
• عدد المتبرعين: ${labelDonors(donors)}
• عمر الجمعية: ${labelAge(age)}
• عدد الموظفين: ${labelStaff(staff)}
• المساعد الذكي: ${ai ? "مفعّل" : "غير مفعّل"}

السعر التقديري:
- التأسيس: ${fmt(pricing.setup)} ر.س
- التجديد السنوي: ${fmt(pricing.renewal)} ر.س

أرغب في تأكيد العرض والاشتراك.`;

  const whatsappLink = `https://wa.me/${OWNER_PHONE_INTL}?text=${encodeURIComponent(summary)}`;
  const ownershipWhatsappLink = `https://wa.me/${OWNER_PHONE_INTL}?text=${encodeURIComponent("السلام عليكم، نرغب في التفاوض على تملّك منصة كفاءة بالكامل لجمعيتنا.")}`;
  const mailLink = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent("طلب اشتراك في منصة كفاءة")}&body=${encodeURIComponent(summary)}`;

  const openWhatsApp = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openExternalLink(whatsappLink);
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
            <Crown className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
            <span className="text-xs font-bold text-white">الاشتراك في كفاءة</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
            اشتراك مرن يناسب حجم جمعيتك تماماً
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            لا توجد باقات جاهزة. نحسب اشتراكك بناءً على حجم نشاطك الفعلي —
            <span className="text-white font-bold"> الحملة التسويقية، عدد المتبرعين، عمر الجمعية، عدد الموظفين، </span>
            وتفعيل المساعد الذكي. السعر يشمل
            <span style={{ color: `hsl(${accentHsl})` }} className="font-bold"> التأسيس + التجديد السنوي</span>.
          </p>
        </motion.div>

        {/* Calculator card */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          {/* Inputs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl p-6 md:p-7 bg-white/[0.06] backdrop-blur-xl border border-white/15 space-y-6"
          >
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              <h2 className="text-lg font-extrabold text-white">احسب اشتراك جمعيتك</h2>
            </div>

            <Selector
              icon={Megaphone}
              label="الحملة التسويقية على منصات التواصل"
              hint="يعكس حجم النشاط الذي تحتاجه المنصة من أدوات تسويق وتحليلات"
              value={campaign}
              onChange={(v) => setCampaign(v as typeof campaign)}
              options={[
                { v: "none", label: "لا توجد", sub: "حضور رمزي" },
                { v: "light", label: "خفيفة", sub: "نشاط شهري" },
                { v: "active", label: "نشطة", sub: "أسبوعية منتظمة" },
                { v: "intensive", label: "مكثفة", sub: "حملات يومية وكبيرة" },
              ]}
            />

            <Selector
              icon={Users}
              label="عدد المتبرعين"
              hint="حجم قاعدة بياناتك من المتبرعين الحاليين"
              value={donors}
              onChange={(v) => setDonors(v as typeof donors)}
              options={[
                { v: "lt500", label: "أقل من 500" },
                { v: "500_2000", label: "500 — 2,000" },
                { v: "2000_5000", label: "2,000 — 5,000" },
                { v: "gt5000", label: "أكثر من 5,000" },
              ]}
            />

            <Selector
              icon={Calendar}
              label="عمر الجمعية"
              hint="الجمعيات الأقدم تحتاج بنية بيانات أعمق"
              value={age}
              onChange={(v) => setAge(v as typeof age)}
              options={[
                { v: "lt2", label: "أقل من سنتين" },
                { v: "2_5", label: "من 2 إلى 5 سنوات" },
                { v: "5_10", label: "من 5 إلى 10 سنوات" },
                { v: "gt10", label: "أكثر من 10 سنوات" },
              ]}
            />

            <Selector
              icon={Briefcase}
              label="عدد الموظفين"
              hint="يحدد عدد الحسابات وحجم وحدة الموارد البشرية"
              value={staff}
              onChange={(v) => setStaff(v as typeof staff)}
              options={[
                { v: "lt5", label: "أقل من 5" },
                { v: "5_15", label: "من 5 إلى 15" },
                { v: "15_30", label: "من 15 إلى 30" },
                { v: "gt30", label: "أكثر من 30" },
              ]}
            />

            {/* AI toggle */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
                <span className="text-sm font-bold text-white">المساعد الذكي</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                تحليلات ذكية، توليد خطط، اقتراح قرارات، ومحادثة بالذكاء الاصطناعي.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAi(true)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    ai ? "border-white/50 text-white" : "border-white/15 text-slate-300 hover:border-white/30"
                  }`}
                  style={ai ? { background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.6), hsl(${accentHsl} / 0.4))` } : { background: "hsl(0 0% 100% / 0.04)" }}
                >
                  مفعّل ✨
                </button>
                <button
                  type="button"
                  onClick={() => setAi(false)}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    !ai ? "border-white/50 text-white bg-white/10" : "border-white/15 text-slate-300 hover:border-white/30 bg-white/[0.04]"
                  }`}
                >
                  غير مفعّل
                </button>
              </div>
            </div>
          </motion.div>

          {/* Price summary (sticky) */}
          <motion.aside
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:sticky lg:top-6 h-fit rounded-3xl p-6 bg-gradient-to-br from-white/[0.1] to-white/[0.04] backdrop-blur-xl border border-white/20 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)]"
          >
            <div className="flex items-center gap-2 mb-4">
              <CrownIcon className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              <h3 className="font-extrabold text-white">السعر التقديري</h3>
            </div>

            <div className="space-y-3 mb-5">
              <PriceRow label="سعر التأسيس" value={pricing.setup} accent />
              <PriceRow label="التجديد السنوي" value={pricing.renewal} />
            </div>

            <div className="text-[11px] text-slate-400 mb-5 leading-relaxed border-t border-white/10 pt-4">
              ✨ السعر يشمل التهيئة الكاملة، التدريب الأولي، والدعم الفني.
              السعر تقديري وقابل للتفاوض حسب التفاصيل النهائية.
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-xl py-3 font-bold text-white shadow-lg shadow-black/30 mb-2 transition-all hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <MessageCircle className="inline w-4 h-4 ml-1.5" />
              تأكيد عبر واتساب
            </a>
            <a
              href={mailLink}
              className="block w-full text-center rounded-xl py-2.5 font-bold text-white/90 border border-white/20 hover:bg-white/5 transition-colors text-sm"
            >
              <Mail className="inline w-4 h-4 ml-1.5" />
              إرسال عبر البريد
            </a>
          </motion.aside>
        </div>

        {/* Full ownership section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-5xl mt-10 rounded-3xl p-7 md:p-10 relative overflow-hidden border border-white/20 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.18), hsl(${accentHsl} / 0.12))`,
          }}
        >
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-30" style={{ background: `hsl(${accentHsl})` }} />
          <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-extrabold text-white mb-2">
                ترغب في التملّك الكامل للمنصة؟
              </h3>
              <p className="text-sm md:text-base text-slate-200/90 leading-relaxed">
                أي جمعية ترغب في <span className="text-white font-bold">شراء المنصة وتملّكها بالكامل</span> يحق لها ذلك.
                التفاصيل والشروط يتم التفاوض عليها مباشرة مع مالك المنصة.
              </p>
            </div>
            <a
              href={ownershipWhatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 bg-white text-slate-900 font-extrabold shadow-lg hover:-translate-y-0.5 transition-transform whitespace-nowrap"
            >
              <Handshake className="w-4 h-4" />
              تواصل للتفاوض
            </a>
          </div>
        </motion.section>

        {/* Quick contact strip */}
        <div className="w-full max-w-5xl mt-6 flex flex-wrap gap-3 justify-center">
          <ContactPill icon={Phone} label={OWNER_PHONE} href={`tel:+${OWNER_PHONE_INTL}`} />
          <ContactPill icon={Mail} label={OWNER_EMAIL} href={`mailto:${OWNER_EMAIL}`} />
          <ContactPill
            icon={MessageCircle}
            label="واتساب مباشر"
            href={`https://wa.me/${OWNER_PHONE_INTL}`}
            external
          />
        </div>

        <div className="mt-10 flex justify-center">
          <BackToAboutButton onClick={() => navigate("/about")} />
        </div>
      </main>
    </div>
  );
}

function Selector({
  icon: Icon, label, hint, value, onChange, options,
}: {
  icon: any;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string; sub?: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      {hint && <p className="text-[11px] text-slate-400 mb-3">{hint}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={`p-3 rounded-xl border text-right transition-all ${
                active ? "border-white/50 text-white" : "border-white/15 text-slate-300 hover:border-white/30"
              }`}
              style={active ? { background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.6), hsl(${accentHsl} / 0.4))` } : { background: "hsl(0 0% 100% / 0.04)" }}
            >
              <div className="text-sm font-bold">{o.label}</div>
              {o.sub && <div className="text-[10px] opacity-75 mt-0.5">{o.sub}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceRow({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`flex items-end justify-between gap-3 p-3 rounded-xl ${accent ? "bg-white/10" : "bg-white/5"}`}>
      <span className="text-xs font-bold text-slate-300">{label}</span>
      <span className="text-2xl font-extrabold text-white tracking-tight">
        {fmt(value)} <span className="text-sm font-bold opacity-70">ر.س</span>
      </span>
    </div>
  );
}

function ContactPill({
  icon: Icon, label, href, external,
}: { icon: any; label: string; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/15 text-sm text-white hover:bg-white/[0.12] transition-colors"
    >
      <Icon className="w-4 h-4" style={{ color: `hsl(${accentHsl})` }} />
      <span dir={label.includes("@") || label.startsWith("0") ? "ltr" : undefined}>{label}</span>
    </a>
  );
}

function labelCampaign(v: string) {
  return ({ none: "لا توجد", light: "خفيفة", active: "نشطة", intensive: "مكثفة" } as any)[v];
}
function labelDonors(v: string) {
  return ({ lt500: "أقل من 500", "500_2000": "500–2000", "2000_5000": "2000–5000", gt5000: "أكثر من 5000" } as any)[v];
}
function labelAge(v: string) {
  return ({ lt2: "أقل من سنتين", "2_5": "2–5 سنوات", "5_10": "5–10 سنوات", gt10: "أكثر من 10 سنوات" } as any)[v];
}
function labelStaff(v: string) {
  return ({ lt5: "أقل من 5", "5_15": "5–15", "15_30": "15–30", gt30: "أكثر من 30" } as any)[v];
}