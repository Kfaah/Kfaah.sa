import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GraduationCap, BookOpen, CheckCircle2, Circle, Trophy, Clock, Sparkles, ChevronLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Lesson = { title: string; minutes: number; content: string; key_points: string[] };
type Module = {
  id: string;
  title: string;
  level: "أساسي" | "متوسط" | "متقدم";
  description: string;
  duration: string;
  lessons: Lesson[];
};

const CURRICULUM: Module[] = [
  {
    id: "foundations",
    title: "الأساسيات: ما هو التسويق الخيري الاحترافي؟",
    level: "أساسي",
    description: "ابدأ من الصفر · افهم الفرق بين التسويق التجاري والخيري وكيف تبني هوية الجمعية",
    duration: "٤٥ دقيقة",
    lessons: [
      {
        title: "مفهوم التسويق الخيري",
        minutes: 10,
        content: "التسويق الخيري ليس بيع منتج، بل دعوة لشراكة في أثر. مهمتك أن توصل قصة المستفيد لقلب المتبرع وتحوّل التعاطف إلى فعل.",
        key_points: [
          "ركّز على الأثر لا على الجمعية",
          "القصة الفردية أقوى من الإحصائيات",
          "كل تبرع شراكة، ليس صدقة عابرة",
          "الشفافية = ولاء طويل الأمد",
        ],
      },
      {
        title: "رسالة الجمعية ورؤيتها",
        minutes: 12,
        content: "قبل أي حملة، يجب أن تتقن رسالة جمعيتك. اقرأها، احفظها، وتأكد أن كل تصميم وكلمة ينطلق منها.",
        key_points: [
          "اكتب جملة واحدة تلخص الجمعية في ٢٠ كلمة",
          "حدّد ٣ قيم أساسية (مثل: شفافية، رحمة، أثر)",
          "كل حملة يجب أن تخدم على الأقل قيمة واحدة",
        ],
      },
      {
        title: "دورة المتبرع: من الجاهل إلى السفير",
        minutes: 15,
        content: "المتبرع يمر بـ ٥ مراحل: لم يسمع → سمع → تبرع لأول مرة → تبرع متكرر → سفير يدعو غيره. مهمتك تصميم محتوى لكل مرحلة.",
        key_points: [
          "الجاهل يحتاج وعي + قصة",
          "المتبرع الأول يحتاج تأكيد + شكر مخصص",
          "المتكرر يحتاج تقارير أثر",
          "السفير يحتاج فخر + أدوات مشاركة",
        ],
      },
      {
        title: "أخلاقيات التسويق الخيري",
        minutes: 8,
        content: "احذر استغلال العاطفة بشكل مبالغ، أو نشر صور المستفيدين دون إذن، أو الوعود التي لا تستطيع الوفاء بها. مصداقيتك أغلى من أي حملة.",
        key_points: [
          "لا تنشر صور أطفال تكشف هويتهم",
          "لا تبالغ في وصف الحالات",
          "أوفِ بكل وعد للمتبرع",
          "كن شفافًا حول نسبة المصاريف الإدارية",
        ],
      },
    ],
  },
  {
    id: "audience",
    title: "الجمهور: من تخاطب وكيف؟",
    level: "أساسي",
    description: "تعلّم تقسيم الجمهور وبناء شخصيات (Personas) للمتبرعين والاستهداف الذكي",
    duration: "٤٠ دقيقة",
    lessons: [
      {
        title: "تقسيم المتبرعين (Segmentation)",
        minutes: 12,
        content: "لا توجد رسالة واحدة تناسب الجميع. قسّم متبرعيك إلى: كبار المتبرعين، المتكررين، المنقطعين، الجدد المحتملين، وكل قسم له لغة ومحتوى مختلف.",
        key_points: [
          "كبار المتبرعين: تواصل شخصي + تقارير أثر تفصيلية",
          "المتكررون: تذكير بأثر تبرعهم + مشاريع جديدة",
          "المنقطعون: حملة استرجاع برسالة عاطفية",
          "الجدد: قصة قوية + سهولة في أول تبرع",
        ],
      },
      {
        title: "بناء شخصية المتبرع (Donor Persona)",
        minutes: 10,
        content: "تخيّل متبرعًا واحدًا حقيقيًا: عمره، عمله، اهتماماته، لماذا يتبرع، ما الذي يوقفه. اكتب له رسالة مخصصة وسترى الفرق.",
        key_points: [
          "حدّد ٣-٥ شخصيات للمتبرعين",
          "اربط كل شخصية بالمنصة المناسبة",
          "اختبر رسائل مختلفة لكل شخصية",
        ],
      },
      {
        title: "استثمار قواعد البيانات",
        minutes: 18,
        content: "بياناتك كنز: تواريخ التبرعات، المشاريع المفضلة، المبالغ، التكرار. استخدم هذه البيانات لاستهداف ذكي وحملات مخصصة.",
        key_points: [
          "حلّل المتبرعين الأكثر ولاءً",
          "اكتشف المشاريع الأكثر جذبًا",
          "ارصد أنماط التبرع الموسمية",
          "استخدم راصد الفرص في النظام",
        ],
      },
    ],
  },
  {
    id: "content",
    title: "المحتوى: نص، صورة، فيديو",
    level: "متوسط",
    description: "اكتب رسائل تؤثر · صمم بصريات تلفت · اصنع فيديو يحرك المشاعر",
    duration: "ساعة",
    lessons: [
      {
        title: "كتابة رسائل احترافية",
        minutes: 15,
        content: "كل رسالة تحتاج: خطاف يجذب أول ثانيتين، قصة تربط، أثر يلمس، دعوة فعل واضحة. اختصر، استخدم ضمير المخاطب، وأنهِ بسؤال أو دعوة.",
        key_points: [
          "ابدأ بسؤال أو إحصائية صادمة",
          "استخدم 'أنت' و'تبرعك'",
          "اذكر مبلغًا محددًا (٥٠ ر.س = وجبة)",
          "أنهِ بزر/رابط واضح",
        ],
      },
      {
        title: "التصميم البصري",
        minutes: 15,
        content: "بصرياتك تمثل جمعيتك. التزم بألوان الهوية، استخدم خط واضح، صور حقيقية لا Stock، ومساحة بيضاء كافية. اللوحة الجميلة تُشارك أكثر.",
        key_points: [
          "استخدم ٢-٣ ألوان فقط من هوية الجمعية",
          "خط Cairo أو IBM Plex Arabic",
          "صور بدقة عالية وحقيقية",
          "قاعدة الثلث في تكوين الصورة",
        ],
      },
      {
        title: "الفيديو والمونتاج",
        minutes: 18,
        content: "الفيديو ملك المحتوى الآن. اصنع فيديو ٣٠-٦٠ ثانية لكل حملة: قصة مستفيد، شهادة متبرع، أو شرح مشروع. استخدم موسيقى هادئة ونص واضح.",
        key_points: [
          "أول ٣ ثوانٍ تحدد المشاهدة",
          "نص مكتوب على الشاشة (٨٠٪ يشاهدون بدون صوت)",
          "نهاية بدعوة فعل واضحة",
          "صيغ متعددة: عمودي للسناب/تيك توك، أفقي ليوتيوب",
        ],
      },
      {
        title: "استخدم الذكاء الاصطناعي في النظام",
        minutes: 12,
        content: "النظام يولّد لك نسخ محتوى احترافية لكل منصة، وبريفات تصميم وسيناريوهات فيديو. استخدمها كنقطة بداية وعدّل عليها لتناسب صوت الجمعية.",
        key_points: [
          "استوديو المحتوى يعطي ٣ نسخ لكل قناة",
          "بريف التصميم جاهز للمصمم مباشرة",
          "لا تنسخ كما هي · أضف لمستك",
        ],
      },
    ],
  },
  {
    id: "channels",
    title: "المنصات: أين ومتى تنشر؟",
    level: "متوسط",
    description: "واتساب، SMS، تويتر، إنستغرام، سناب، تيك توك، يوتيوب · لكل منصة قواعد",
    duration: "٥٠ دقيقة",
    lessons: [
      {
        title: "واتساب وSMS — الرسائل المباشرة",
        minutes: 12,
        content: "أعلى نسبة فتح (٩٨٪). استخدمها لكبار المتبرعين والمتكررين فقط. رسالة قصيرة، شخصية، ورابط دفع مباشر.",
        key_points: [
          "احفظ الإذن قبل الإرسال",
          "لا تتجاوز ١٦٠ حرف في SMS",
          "خاطب باسم المتبرع",
          "أرسل في أوقات محترمة (٩ص-٩م)",
        ],
      },
      {
        title: "X (تويتر) — التأثير العام",
        minutes: 10,
        content: "منصة الرأي والوعي. غرّد قصص قصيرة، أرقام، إنفوجرافيك، واستخدم هاشتاقات الجمعية + الموسم.",
        key_points: [
          "أفضل أوقات: ٧-٩ ص و ٨-١١ م",
          "هاشتاق ٢-٣ كحد أقصى",
          "صور وفيديوهات تزيد التفاعل ٣x",
        ],
      },
      {
        title: "إنستغرام وسناب — البصري والقصص",
        minutes: 14,
        content: "لجمهور أصغر سنًا. قصص يومية، Reels قصيرة، Stories تفاعلية باستفتاءات. ركّز على الجمال البصري والقصص اللحظية.",
        key_points: [
          "Reels تحقق وصولًا أعلى من المنشورات",
          "استخدم Stickers تفاعلية",
          "غطِ الفعاليات لحظة بلحظة",
        ],
      },
      {
        title: "تيك توك ويوتيوب — الفيديو الطويل والقصير",
        minutes: 14,
        content: "تيك توك للوصول السريع، يوتيوب لبناء ثقة عميقة. اصنع سلسلة شهرية: قصص نجاح، خلف الكواليس، تقارير أثر.",
        key_points: [
          "تيك توك: ٣٠-٦٠ ث، إيقاع سريع، نص واضح",
          "يوتيوب: ٣-٧ دقائق، قصص متعمقة",
          "Thumbnails مهمة جدًا في يوتيوب",
        ],
      },
    ],
  },
  {
    id: "campaign-launch",
    title: "إطلاق حملة احترافية: من الفكرة إلى التقييم",
    level: "متقدم",
    description: "خطوات عملية لإطلاق حملة كاملة باستخدام النظام",
    duration: "ساعة",
    lessons: [
      {
        title: "خطوة ١: التخطيط والبريف",
        minutes: 12,
        content: "ابدأ بسؤال: ما الهدف؟ (مبلغ، عدد متبرعين، وعي؟). من الجمهور؟ ما القصة؟ ما الميزانية؟ ما المنصات؟ كل هذا في تبويب 'البريف' في النظام.",
        key_points: [
          "هدف SMART (محدد، قابل للقياس، واقعي)",
          "اختر جمهورًا واحدًا أساسيًا",
          "حدد KPIs قبل البدء",
        ],
      },
      {
        title: "خطوة ٢: المحتوى والتصميم",
        minutes: 15,
        content: "استخدم 'استوديو المحتوى' لتوليد نسخ لكل قناة، و'بريف التصميم' لتسليم المصمم بريفًا احترافيًا. راجع، عدّل، ثم احفظ كأصول.",
        key_points: [
          "ولّد ٣ خيارات لكل منصة",
          "اختبر A/B قبل الإطلاق الكبير",
          "احفظ كل الأصول في الحملة",
        ],
      },
      {
        title: "خطوة ٣: الجدولة والإطلاق",
        minutes: 12,
        content: "في تبويب 'القنوات'، جدول كل منشور بتاريخ ووقت محددين. ابدأ بالقنوات المباشرة (واتساب) ثم العامة (سوشيال) ثم الإعلانات المدفوعة.",
        key_points: [
          "ابدأ بالجمهور الدافئ",
          "وزّع المحتوى على ٧-١٤ يوم",
          "لا تكرر نفس المنشور في كل المنصات",
        ],
      },
      {
        title: "خطوة ٤: المتابعة والتقييم",
        minutes: 13,
        content: "أدخل النتائج يوميًا في 'الميزانية والأداء'. عند انتهاء الحملة، اضغط 'ابدأ التقييم' في تبويب الرؤى وستحصل على تقرير ذكي مع توصيات للحملة القادمة.",
        key_points: [
          "حدّث الأرقام يوميًا",
          "احتفل بالنجاحات الصغيرة",
          "احفظ الدروس في 'دفتر اللعب' (Playbook)",
          "كل حملة تتعلم منها للقادم",
        ],
      },
    ],
  },
  {
    id: "seasonal",
    title: "التسويق الموسمي السعودي",
    level: "متقدم",
    description: "كيف تستثمر رمضان، العشر، الأعياد، اليوم الوطني · دروس عملية",
    duration: "٤٠ دقيقة",
    lessons: [
      {
        title: "رمضان: ذروة التبرعات",
        minutes: 12,
        content: "٤٠٪ من التبرعات السنوية تأتي في رمضان. خطّط من شعبان، نوّع المشاريع (إفطار صائم، زكاة، عيدية)، واصنع محتوى يومي. ليلة ٢٧ هي القمة المطلقة.",
        key_points: [
          "ابدأ التسخين في شعبان",
          "محتوى يومي طوال الشهر",
          "ركّز على ليالي الوتر",
          "ذكّر بالزكاة في النصف الثاني",
        ],
      },
      {
        title: "العشر من ذي الحجة",
        minutes: 8,
        content: "أيام مضاعفة الأجر · فرصة ذهبية للأضاحي والمشاريع التنموية. جهّز حملتك قبل ذي القعدة.",
        key_points: [
          "مشروع الأضاحي الرئيسي",
          "ذكّر بأيام الفضل يوميًا",
          "اربط بمشاريع التنمية",
        ],
      },
      {
        title: "اليوم الوطني والتأسيس",
        minutes: 10,
        content: "مواسم وطنية بحتة · فرصة لربط الجمعية بهوية الوطن. حملات بألوان الوطن، شراكات مع جهات حكومية، ومحتوى يفخر بالعطاء السعودي.",
        key_points: [
          "استخدم الأخضر والأبيض في الهوية",
          "أبرز إنجازات الجمعية كجزء من الوطن",
          "اشكر القيادة في رسائلك",
        ],
      },
      {
        title: "حملات الشتاء وشدة الحر",
        minutes: 10,
        content: "حاجات إنسانية موسمية واضحة: كسوة الشتاء، تكييف وماء في الصيف. هذه حملات سهلة الإقناع لأن الأثر فوري.",
        key_points: [
          "صور حقيقية للحالات",
          "أرقام محددة (X بطانية = Y ر.س)",
          "أطلق قبل أسبوعين من الذروة",
        ],
      },
    ],
  },
];

const LEVEL_COLOR: Record<string, string> = {
  "أساسي": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "متوسط": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "متقدم": "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
};

const STORAGE_KEY = "marketing_academy_progress_v1";

export default function MarketingAcademy() {
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
    catch { return new Set(); }
  });

  const toggleLesson = (key: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const totalLessons = CURRICULUM.reduce((s, m) => s + m.lessons.length, 0);
  const completedCount = completed.size;
  const progress = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

  if (openModule) {
    const m = CURRICULUM.find((x) => x.id === openModule)!;
    return (
      <div className="space-y-4" dir="rtl">
        <Button variant="ghost" size="sm" onClick={() => setOpenModule(null)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> رجوع للأكاديمية
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> {m.title}
                </CardTitle>
                <CardDescription className="mt-1">{m.description}</CardDescription>
              </div>
              <Badge className={LEVEL_COLOR[m.level]}>{m.level}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {m.lessons.map((l, idx) => {
                const key = `${m.id}__${idx}`;
                const done = completed.has(key);
                return (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-right flex-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLesson(key); }}
                          className="shrink-0"
                        >
                          {done
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="flex-1">
                          <div className="font-medium">{l.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" /> {l.minutes} دقيقة
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        <p className="text-sm leading-relaxed bg-muted/40 rounded-lg p-3">{l.content}</p>
                        <div>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-primary" /> النقاط المفتاحية:
                          </p>
                          <ul className="list-disc pr-5 text-sm space-y-1">
                            {l.key_points.map((kp, i) => <li key={i}>{kp}</li>)}
                          </ul>
                        </div>
                        <Button size="sm" variant={done ? "outline" : "default"} onClick={() => toggleLesson(key)} className="gap-1">
                          {done ? "إلغاء الإنجاز" : "أنجزتُ هذا الدرس"}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-emerald-500/10 via-primary/5 to-transparent p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-600"><GraduationCap className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-bold">أكاديمية التسويق التفاعلية</h3>
              <p className="text-sm text-muted-foreground">تعلّم التسويق الخيري من الصفر للاحتراف · ٦ مسارات · {totalLessons} درس</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="font-semibold">{completedCount}/{totalLessons}</span>
            <span className="text-muted-foreground">درس · {progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="mt-3 h-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {CURRICULUM.map((m) => {
          const moduleCompleted = m.lessons.filter((_, i) => completed.has(`${m.id}__${i}`)).length;
          const modProgress = Math.round((moduleCompleted / m.lessons.length) * 100);
          return (
            <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setOpenModule(m.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={LEVEL_COLOR[m.level]}>{m.level}</Badge>
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{m.duration}</Badge>
                      {modProgress === 100 && <Badge className="bg-emerald-500/15 text-emerald-700 gap-1"><CheckCircle2 className="h-3 w-3" />مكتمل</Badge>}
                    </div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <CardDescription className="mt-1 text-xs">{m.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{moduleCompleted}/{m.lessons.length} درس</span>
                  <Progress value={modProgress} className="h-1.5 flex-1" />
                  <span>{modProgress}%</span>
                </div>
                <Button size="sm" variant="outline" className="w-full">ابدأ التعلّم</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}