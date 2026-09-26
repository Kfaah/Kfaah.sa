import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  TableLayoutType,
} from "docx";
import { saveAs } from "file-saver";

const PRIMARY_COLOR = "2D7A85";
const HEADER_BG = "2D7A85";
const HEADER_TEXT = "FFFFFF";
const ALT_ROW = "F0FAFA";
const BORDER_COLOR = "B0D4D8";

function createBorder() {
  const border = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: BORDER_COLOR,
  };
  return { top: border, bottom: border, left: border, right: border };
}

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: HEADER_TEXT, size: 22, font: "Cairo" })],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: { type: ShadingType.SOLID, color: HEADER_BG, fill: HEADER_BG },
    borders: createBorder(),
    ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
  });
}

function dataCell(text: string, shaded = false, bold = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 21, font: "Cairo", bold })],
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 40, after: 40 },
      }),
    ],
    shading: shaded ? { type: ShadingType.SOLID, color: ALT_ROW, fill: ALT_ROW } : undefined,
    borders: createBorder(),
  });
}

function numberedCell(text: string, shaded = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 21, font: "Arial" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
      }),
    ],
    shading: shaded ? { type: ShadingType.SOLID, color: ALT_ROW, fill: ALT_ROW } : undefined,
    borders: createBorder(),
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: PRIMARY_COLOR, size: level === HeadingLevel.HEADING_1 ? 32 : 26, font: "Cairo" })],
    heading: level,
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 300, after: 150 },
  });
}

function body(text: string, bullet = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Cairo" })],
    alignment: AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 60, after: 60 },
    ...(bullet ? { bullet: { level: 0 } } : {}),
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [], spacing: { before: 100, after: 100 } });
}

export async function exportGrantProposal() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Cairo", size: 22 },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } },
        children: [
          // العنوان الرئيسي
          new Paragraph({
            children: [
              new TextRun({ text: "ملف تقديم مشروع", bold: true, color: PRIMARY_COLOR, size: 40, font: "Cairo" }),
            ],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "بوابة الإدارة المؤسسية الذكية للمنظمات غير الربحية", bold: true, color: PRIMARY_COLOR, size: 32, font: "Cairo" }),
            ],
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Smart NGO Management Portal", size: 24, font: "Arial", color: "666666", italics: true }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // أولاً: الملخص التنفيذي
          heading("أولاً: الملخص التنفيذي"),
          body("اسم المشروع: بوابة الإدارة المؤسسية الذكية (Smart NGO Management Portal)"),
          emptyLine(),
          body("الفكرة: منصة إلكترونية متكاملة مصممة خصيصاً للمنظمات غير الربحية والجمعيات الخيرية، تُمكّنها من إدارة عملياتها الإدارية والتشغيلية والبشرية بكفاءة عالية عبر واجهة عربية موحّدة وذكية، مع دعم الذكاء الاصطناعي في التخطيط وتوليد المهام."),
          emptyLine(),
          body("المشكلة: تعاني المنظمات غير الربحية من تشتت أدواتها الإدارية بين أنظمة متعددة (Excel، أنظمة حضور منفصلة، مراسلات عبر واتساب، طلبات ورقية)، مما يُهدر الوقت والموارد ويُضعف الحوكمة والشفافية."),
          emptyLine(),
          body("الحل: بوابة واحدة تجمع 12 نظاماً إدارياً في منصة واحدة، مصممة بلغة عربية كاملة ومتوافقة مع بيئة العمل في المنظمات غير الربحية."),

          // ثانياً: الميزات التنافسية
          heading("ثانياً: الميزات التنافسية الفريدة"),
          heading("1. التخطيط الاستراتيجي → التشغيلي → التنفيذي (سلسلة متكاملة)", HeadingLevel.HEADING_2),
          body("ربط الأهداف الاستراتيجية بالمبادرات بالأنشطة التشغيلية بالمهام اليومية في تدفق واحد متصل", true),
          body("لا توجد منصة عربية تقدم هذا التسلسل المتكامل: هدف استراتيجي ← مبادرة ← نشاط تشغيلي ← خطة تنفيذية يومية ← مهام مُولّدة تلقائياً", true),
          body("جدول خطة تشغيلية تفاعلي بدمج خلايا ذكي، أعمدة مخصصة ديناميكية، وعمليات حسابية مُدمجة", true),

          heading("2. توليد المهام بالذكاء الاصطناعي", HeadingLevel.HEADING_2),
          body("النظام يُولّد المهام اليومية تلقائياً كل صباح (أيام العمل: الأحد-الخميس) بناءً على الخطط المعرّفة", true),
          body("يُوزّع المهام على الموظفين بالتناوب حسب أولوياتهم وتخصصاتهم", true),
          body("يراعي التقويم الهجري وأيام العطل السعودية", true),

          heading("3. نظام طلبات الموارد البشرية بسير عمل متعدد المراحل", HeadingLevel.HEADING_2),
          body("سير عمل قابل للتخصيص بالكامل (مدير مباشر ← مدير تنفيذي ← مدير موارد بشرية ← مدير مالي)", true),
          body("توليد خطابات رسمية بصيغة PDF تلقائياً مع ترويسة الجهة وتوقيع إلكتروني", true),
          body("قوالب طلبات مخصصة (إجازات، خطابات تعريف، طلبات مالية...) مع حقول مخصصة لكل نوع", true),
          body("نظام أرصدة إجازات ذكي يخصم تلقائياً عند الموافقة", true),

          heading("4. وضع المعاينة كموظف (Impersonation Mode)", HeadingLevel.HEADING_2),
          body("يستطيع المدير رؤية النظام بعينيّ أي موظف دون الحاجة لبيانات دخوله", true),
          body("ميزة نادرة في الأنظمة العربية تُسهّل الدعم الفني وفهم تجربة الموظف", true),

          heading("5. أعمدة ديناميكية ذكية في الخطط التشغيلية", HeadingLevel.HEADING_2),
          body("إضافة أعمدة بأنواع محتوى متعددة: نصي، رقمي، نسبة مئوية، تاريخ، قائمة موظفين، قائمة خيارات", true),
          body("أعمدة حسابية (جمع، طرح، ضرب، قسمة، متوسط) تعمل تلقائياً على أعمدة أخرى", true),
          body("أعمدة موظفين مُفلترة حسب القسم لتسهيل الاختيار", true),

          heading("6. تتبع الحضور والانصراف الذكي", HeadingLevel.HEADING_2),
          body("تسجيل دخول وخروج بنقرة واحدة مع حساب ساعات العمل تلقائياً", true),
          body("لوحة إدارة حضور مركزية للمشرفين", true),

          heading("7. نظام مراسلات فوري داخلي", HeadingLevel.HEADING_2),
          body("محادثات مباشرة بين الموظفين مع دعم المرفقات", true),
          body("إشعارات فورية (Real-time) للرسائل والمهام والطلبات", true),
          body("ربط المراسلات بالمهام مباشرة", true),

          // ثالثاً: الأنظمة الفرعية
          heading("ثالثاً: الأنظمة الفرعية المتكاملة (12 نظاماً)"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [headerCell("الوصف", 60), headerCell("النظام", 30), headerCell("#", 10)],
              }),
              ...([
                ["1", "لوحة المعلومات الذكية", "إحصائيات فورية مخصصة لكل دور (مدير/موظف) مع شاشة ترحيب تحفيزية"],
                ["2", "إدارة الموظفين", "ملفات شاملة، صور، مسميات وظيفية، أقسام، مدراء مباشرين وتنفيذيين"],
                ["3", "الأدوار والصلاحيات", "7 أدوار مُعرّفة (مدير، مشرف، موظف، محرر وقت، مدير HR، مدير مالي، محاسب)"],
                ["4", "التخطيط الاستراتيجي", "أهداف استراتيجية مرتبطة بأقسام ومبادرات"],
                ["5", "الخطط التشغيلية", "جداول تفاعلية بأعمدة قابلة للتخصيص مع أهداف سنوية وشهرية"],
                ["6", "الخطط التنفيذية", "تحويل الخطط الشهرية إلى مهام يومية مع تتبع الإنجاز"],
                ["7", "إدارة المهام", "مهام بأولويات وتصنيفات مع مؤقت زمني حي وتواصل مباشر"],
                ["8", "الموارد البشرية", "طلبات، موافقات، قوالب، أرصدة، سير عمل متعدد المراحل"],
                ["9", "الحضور والانصراف", "تسجيل ذكي مع تقارير يومية وشهرية"],
                ["10", "المراسلات", "محادثات فورية مع مرفقات وإشعارات"],
                ["11", "الملف الشخصي", "معلومات شاملة مع إدارة ملفات وتصنيفات مخصصة"],
                ["12", "الإعدادات", "تخصيص شاشة الترحيب والإشعارات"],
              ] as string[][]).map((row, i) =>
                new TableRow({
                  children: [
                    dataCell(row[2], i % 2 === 1),
                    dataCell(row[1], i % 2 === 1, true),
                    numberedCell(row[0], i % 2 === 1),
                  ],
                })
              ),
            ],
          }),

          // رابعاً: المواصفات التقنية
          heading("رابعاً: المواصفات التقنية"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [headerCell("التفصيل", 65), headerCell("العنصر", 35)],
              }),
              ...([
                ["واجهة المستخدم", "React + TypeScript + Tailwind CSS (تصميم عصري متجاوب)"],
                ["قاعدة البيانات", "PostgreSQL سحابية مع أمان على مستوى الصف (RLS)"],
                ["المصادقة", "نظام تسجيل دخول آمن مع تحقق بالبريد الإلكتروني"],
                ["البيانات الفورية", "تحديث لحظي عبر WebSocket (Realtime)"],
                ["الذكاء الاصطناعي", "توليد مهام وخطط تنفيذية ذكية"],
                ["اللغة", "عربية بالكامل مع دعم RTL"],
                ["التوافق", "متجاوب مع جميع الأجهزة (حاسوب، جوال، لوحي)"],
                ["الأمان", "تشفير كامل، صلاحيات متعددة المستويات، حماية البيانات"],
              ] as string[][]).map((row, i) =>
                new TableRow({
                  children: [
                    dataCell(row[1], i % 2 === 1),
                    dataCell(row[0], i % 2 === 1, true),
                  ],
                })
              ),
            ],
          }),

          // خامساً: الفئة المستهدفة
          heading("خامساً: الفئة المستهدفة"),
          body("الجمعيات الخيرية (رعاية الأيتام، الإغاثة، التنمية)", true),
          body("المؤسسات الأهلية غير الربحية", true),
          body("المنظمات التطوعية", true),
          body("الأوقاف والصناديق الخيرية", true),
          emptyLine(),
          body("حجم السوق المحتمل: أكثر من 2,000 جمعية مسجلة في المملكة العربية السعودية وحدها، ومعظمها يفتقر لنظام إداري متكامل."),

          // سادساً: الميزانية
          heading("سادساً: الميزانية التقديرية"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [headerCell("التكلفة (ريال)", 35), headerCell("البند", 65)],
              }),
              ...([
                ["تطوير النسخة الكاملة (فريق تطوير 6 أشهر)", "350,000"],
                ["البنية التحتية السحابية (سنة)", "48,000"],
                ["تصميم واجهة المستخدم UX/UI", "60,000"],
                ["اختبارات الجودة والأمان", "40,000"],
                ["التدريب والتوثيق", "25,000"],
                ["الدعم الفني (سنة أولى)", "36,000"],
                ["التسويق والإطلاق", "30,000"],
                ["احتياطي (10%)", "58,900"],
              ] as string[][]).map((row, i) =>
                new TableRow({
                  children: [
                    numberedCell(row[1], i % 2 === 1),
                    dataCell(row[0], i % 2 === 1),
                  ],
                })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: "647,900", bold: true, size: 24, font: "Arial", color: HEADER_TEXT })],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 60, after: 60 },
                    })],
                    shading: { type: ShadingType.SOLID, color: PRIMARY_COLOR, fill: PRIMARY_COLOR },
                    borders: createBorder(),
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      children: [new TextRun({ text: "الإجمالي", bold: true, size: 24, font: "Cairo", color: HEADER_TEXT })],
                      alignment: AlignmentType.RIGHT,
                      bidirectional: true,
                      spacing: { before: 60, after: 60 },
                    })],
                    shading: { type: ShadingType.SOLID, color: PRIMARY_COLOR, fill: PRIMARY_COLOR },
                    borders: createBorder(),
                  }),
                ],
              }),
            ],
          }),

          // سابعاً: المخرجات
          heading("سابعاً: مخرجات المشروع"),
          body("✅ بوابة إلكترونية جاهزة للنشر مع نسخة تجريبية عاملة (MVP موجود فعلياً)", true),
          body("✅ نظام قابل للتطبيق على عدة جمعيات (Multi-tenant)", true),
          body("✅ دليل مستخدم ودليل إداري", true),
          body("✅ تقارير أداء دورية", true),
          body("✅ نموذج استدامة مالية (اشتراك شهري مُيسّر للجمعيات)", true),

          // ثامناً: الاستدامة
          heading("ثامناً: نموذج الاستدامة"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [headerCell("التفصيل", 55), headerCell("النموذج", 45)],
              }),
              ...([
                ["اشتراك شهري", "500-1500 ريال/شهر حسب حجم الجمعية"],
                ["عدد الجمعيات المستهدفة (سنة أولى)", "20 جمعية"],
                ["الإيراد السنوي المتوقع", "240,000 ريال"],
                ["نقطة التعادل", "خلال 30 شهراً"],
              ] as string[][]).map((row, i) =>
                new TableRow({
                  children: [
                    dataCell(row[1], i % 2 === 1),
                    dataCell(row[0], i % 2 === 1, true),
                  ],
                })
              ),
            ],
          }),

          // تاسعاً: لماذا يستحق الدعم
          heading("تاسعاً: لماذا هذا المشروع يستحق الدعم؟"),
          body("1. النموذج الأولي موجود فعلياً – ليس مجرد فكرة على ورق، بل نظام عامل يمكن تجربته", true),
          body("2. لا يوجد بديل عربي متكامل – المنصات الحالية إما إنجليزية أو تغطي جانباً واحداً فقط", true),
          body("3. أثر اجتماعي مضاعف – تحسين كفاءة الجمعيات يعني وصول أفضل للمستفيدين", true),
          body("4. قابلية التوسع – النظام مصمم ليخدم عدة جمعيات بتكلفة هامشية", true),
          body("5. الاستدامة المالية – نموذج الاشتراك يضمن استمرارية المشروع بعد انتهاء الدعم", true),

          // عاشراً: الجدول الزمني
          heading("عاشراً: الجدول الزمني"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [headerCell("المخرج", 40), headerCell("المدة", 25), headerCell("المرحلة", 35)],
              }),
              ...([
                ["تطوير النواة وتحسين MVP", "شهران", "نظام أساسي محسّن"],
                ["إضافة التقارير وتقييم الأداء", "شهران", "نظام تقارير متقدم"],
                ["دعم تعدد الجمعيات (Multi-tenant)", "شهر", "نظام مركزي متعدد"],
                ["الاختبار والأمان", "شهر", "نظام آمن ومُختبر"],
                ["الإطلاق التجريبي (5 جمعيات)", "شهر", "تغذية راجعة حقيقية"],
                ["الإطلاق الرسمي", "شهر", "منصة جاهزة للسوق"],
              ] as string[][]).map((row, i) =>
                new TableRow({
                  children: [
                    dataCell(row[2], i % 2 === 1),
                    dataCell(row[1], i % 2 === 1),
                    dataCell(row[0], i % 2 === 1, true),
                  ],
                })
              ),
            ],
          }),

          emptyLine(),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "ملف_تقديم_مشروع_البوابة_الذكية.docx");
}
