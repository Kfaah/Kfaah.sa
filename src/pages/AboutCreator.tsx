import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, GraduationCap, Briefcase, Award, Code2, Users, Mail,
  Phone, Globe, MapPin, Calendar, Heart, BookOpen, Megaphone,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import BackToAboutButton from "@/components/platform/BackToAboutButton";
import creatorPortrait from "@/assets/creator-portrait.png";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.55, ease: "easeOut" as const },
});

export default function AboutCreator() {
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, hsl(230 80% 3% / 0.6) 100%)",
        }}
      />

      <main className="relative z-10 flex-1 px-4 py-10 md:py-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero — portrait + name */}
          <motion.section {...fadeUp(0)} className="flex flex-col items-center text-center gap-5">
            {/* Portrait with decorative rings */}
            <div className="relative w-40 h-40 md:w-48 md:h-48">
              <div
                className="absolute -inset-3 rounded-full org-spin-slow pointer-events-none"
                style={{ border: `1.5px dashed hsl(${accentHsl} / 0.5)` }}
                aria-hidden="true"
              />
              <div
                className="absolute -inset-1 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, hsl(${primaryHsl}) 0%, transparent 30%, hsl(${accentHsl}) 60%, transparent 90%, hsl(${primaryHsl}) 100%)`,
                  WebkitMask: "radial-gradient(circle, transparent 75%, #000 77%, #000 85%, transparent 87%)",
                  mask: "radial-gradient(circle, transparent 75%, #000 77%, #000 85%, transparent 87%)",
                  animation: "spin 12s linear infinite reverse",
                }}
                aria-hidden="true"
              />
              <img
                src={creatorPortrait}
                alt="جابر علي الحريصي"
                className="relative w-full h-full rounded-full object-cover border-4 border-white shadow-2xl"
              />
            </div>

            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                جابر علي سلمان الحريصي
              </h1>
              <p className="mt-2 text-sm md:text-base font-medium" style={{ color: `hsl(${accentHsl})` }}>
                مبتكر منصة كفاءة · طالب مرحلة دكتوراه هندسة برمجيات
              </p>
              <p className="mt-1 text-xs md:text-sm text-slate-400">
                خبير في تطوير المبادرات المجتمعية والتسويق وتنمية الموارد المالية والتحول الرقمي في القطاع غير الربحي
              </p>
            </div>

            <div className="flex items-center justify-center gap-2" aria-hidden="true">
              <span className="h-px w-12 bg-white/30" />
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${accentHsl})` }} />
              <span className="h-px w-12 bg-white/30" />
            </div>
          </motion.section>

          {/* Bio */}
          <motion.section {...fadeUp(0.15)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-3">
              <BookOpen className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              نبذة تعريفية
            </h2>
            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              قيادي في القطاع غير الربحي بخبرة تمتد لـ 15 سنة في تأسيس وإدارة الجمعيات والمبادرات المجتمعية،
              ومتخصص في التسويق وتنمية الموارد المالية وبناء الشراكات الاستراتيجية.
              يمتلك خبرة متقدمة في تصميم وتطوير البوابات الإلكترونية الذكية المعتمدة على تقنيات الذكاء الاصطناعي،
              ويسعى إلى تمكين الجهات الخيرية من التحول الرقمي وتحقيق الاستدامة المؤسسية.
            </p>
          </motion.section>

          {/* Education & Experience grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Education */}
            <motion.section {...fadeUp(0.25)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                <GraduationCap className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                المؤهلات العلمية
              </h2>
              <ul className="space-y-4">
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">بكالوريوس — كلية المعلمين، جامعة جازان</p>
                  <p className="text-xs text-slate-400 mt-0.5">امتياز مع مرتبة الشرف</p>
                </li>
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">ماجستير في تقنيات التعليم — جامعة جازان</p>
                  <p className="text-xs text-slate-400 mt-0.5">امتياز مع مرتبة الشرف الأولى</p>
                </li>
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${accentHsl})` }}>
                  <p className="text-white font-semibold text-sm">طالب مرحلة دكتوراه — هندسة برمجيات</p>
                  <p className="text-xs text-slate-400 mt-0.5">قيد الدراسة حالياً</p>
                </li>
              </ul>
            </motion.section>

            {/* Experience */}
            <motion.section {...fadeUp(0.3)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                <Briefcase className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                الخبرات العملية
              </h2>
              <ul className="space-y-4">
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">رئيس مجلس إدارة جمعية نجاة</p>
                  <p className="text-xs text-slate-400 mt-0.5">الدورة الحالية</p>
                </li>
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">معلم وخطيب</p>
                  <p className="text-xs text-slate-400 mt-0.5">منذ عام 1429هـ</p>
                </li>
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">مستشار تنمية موارد مالية</p>
                  <p className="text-xs text-slate-400 mt-0.5">لعدد من الجمعيات متعددة التخصصات</p>
                </li>
                <li className="border-r-2 pr-4" style={{ borderColor: `hsl(${primaryHsl})` }}>
                  <p className="text-white font-semibold text-sm">مشرف مشروع المبادرات الشبابية</p>
                  <p className="text-xs text-slate-400 mt-0.5">لتنمية محافظة العارضة</p>
                </li>
              </ul>
            </motion.section>
          </div>

          {/* Founding memberships */}
          <motion.section {...fadeUp(0.35)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Users className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              عضو مؤسس في
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "جمعية نجاة للدعوة والإرشاد",
                "جمعية التنمية الأهلية بالحميراء",
                "جمعية تدبر لتحفيظ القرآن الكريم",
                "جمعية صواب لتأهيل المتعافين",
                "جمعية مطورون لتطوير القطاع غير الربحي",
              ].map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/10 px-4 py-2.5"
                >
                  <Heart className="w-4 h-4 shrink-0" style={{ color: `hsl(${primaryHsl})` }} />
                  <span className="text-sm text-slate-200">{name}</span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Technical achievements */}
          <motion.section {...fadeUp(0.4)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Code2 className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              الإنجازات التقنية
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "مشرف الفريق التقني", sub: "في المجال التعليمي", link: "batal-edu.org" },
                { title: "مؤسس شبكة جمعية نجاة", sub: "تضم 5 بوابات إلكترونية", link: "najah-h.sa" },
                { title: "مؤسس بوابة إدارة الجمعيات", sub: "بالذكاء الاصطناعي", link: "charity-crm.org" },
                { title: "مطور متجر التبرعات", sub: "شركة الإجراء الذكي", link: "store.najah-h.sa" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 p-4 hover:border-white/25 transition-colors"
                >
                  <p className="text-white font-bold text-sm">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
                  <p className="text-xs mt-2 font-mono" style={{ color: `hsl(${primaryHsl})` }}>
                    {item.link}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Skills */}
          <motion.section {...fadeUp(0.45)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Award className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              المهارات
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                "التصميم", "المونتاج", "تطوير المواقع", "برامج الأوفيس",
                "الخطابة والإلقاء", "الكتابة والتأليف", "بناء الخطط",
                "قيادة فرق العمل", "تطوير البوابات الذكية بالذكاء الاصطناعي",
                "التسويق الرقمي", "تنمية الموارد المالية", "إدارة المبادرات",
              ].map((skill) => (
                <span
                  key={skill}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border"
                  style={{
                    color: `hsl(${primaryHsl})`,
                    borderColor: `hsl(${primaryHsl} / 0.4)`,
                    background: `hsl(${primaryHsl} / 0.1)`,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </motion.section>

          {/* Contact */}
          <motion.section {...fadeUp(0.5)} className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/15 p-6 md:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
              <Megaphone className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
              بيانات التواصل
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span dir="ltr">gaberalhrese@gmail.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <span dir="ltr">0595784433</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <span dir="ltr">asir-almaali.com</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>جازان — العارضة</span>
              </div>
            </div>
          </motion.section>

          {/* Back */}
          <motion.div {...fadeUp(0.55)} className="flex justify-center pb-6">
            <BackToAboutButton onClick={() => navigate("/about")} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}