const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const OUT = '/dev-server/tmp_support/ppt-support';
const COLORS = { bgDark: '0F1E3D', bgDarker: '081229', primary: '1E3A8A', accent: 'D4AF37', accentSoft: 'F5E6A8', white: 'FFFFFF', muted: '94A3B8', light: 'F8FAFC', border: 'CBD5E1' };

function header(slide, title, subtitle='') {
  slide.background = { color: COLORS.light };
  slide.addShape('rect', { x:0, y:0, w:13.333, h:0.16, fill:{color:COLORS.accent}, line:{color:COLORS.accent} });
  slide.addShape('rect', { x:0, y:0.16, w:13.333, h:0.92, fill:{color:COLORS.bgDark}, line:{color:COLORS.bgDark} });
  slide.addText(title, { x:0.55, y:0.22, w:12.1, h:0.42, fontFace:'Calibri', fontSize:22, bold:true, color:COLORS.white, align:'right', rtlMode:true });
  if (subtitle) slide.addText(subtitle, { x:0.55, y:0.66, w:12.1, h:0.18, fontFace:'Calibri', fontSize:10, color:COLORS.accentSoft, align:'right', rtlMode:true });
}
function footer(slide, text='مادة داعمة تنفيذية جاهزة') {
  slide.addShape('rect', { x:0, y:7.22, w:13.333, h:0.28, fill:{color:COLORS.bgDarker}, line:{color:COLORS.bgDarker} });
  slide.addText(text, { x:0.5, y:7.24, w:12.2, h:0.16, fontFace:'Calibri', fontSize:9, color:COLORS.muted, align:'right', rtlMode:true });
}
function cover(ppt, title, subtitle) {
  const s = ppt.addSlide();
  s.background = { color: COLORS.bgDark };
  s.addShape('rect', { x:0, y:0, w:13.333, h:0.18, fill:{color:COLORS.accent}, line:{color:COLORS.accent} });
  s.addShape('rect', { x:0, y:7.32, w:13.333, h:0.18, fill:{color:COLORS.accent}, line:{color:COLORS.accent} });
  s.addText(title, { x:0.8, y:2.05, w:11.7, h:1.1, fontFace:'Calibri', fontSize:28, bold:true, color:COLORS.white, align:'center', valign:'middle', rtlMode:true });
  s.addText(subtitle, { x:1.2, y:3.3, w:10.9, h:0.7, fontFace:'Calibri', fontSize:15, color:COLORS.accentSoft, align:'center', valign:'middle', rtlMode:true });
  s.addText('عرض PowerPoint جاهز للمراجعة والتنفيذ', { x:1.6, y:4.25, w:10.1, h:0.35, fontFace:'Calibri', fontSize:11.5, color:COLORS.muted, align:'center', rtlMode:true });
}
function textSlide(ppt, title, subtitle, body, bullets=[]) {
  const s = ppt.addSlide();
  header(s, title, subtitle);
  s.addShape('roundRect', { x:0.55, y:1.35, w:12.2, h:5.7, fill:{color:COLORS.white}, line:{color:COLORS.border, width:0.6}, rectRadius:0.06 });
  if (body) s.addText(body, { x:0.82, y:1.68, w:11.65, h:1.1, fontFace:'Calibri', fontSize:13, color:COLORS.bgDark, align:'right', valign:'top', rtlMode:true });
  if (bullets.length) {
    s.addText(bullets.map((t)=>({ text:t, options:{ bullet:{indent:18}, hanging:3 } })), { x:0.98, y: body ? 2.95 : 1.75, w:11.25, h:3.75, fontFace:'Calibri', fontSize:15, color:COLORS.bgDark, align:'right', valign:'top', rtlMode:true, paraSpaceAfterPt:10 });
  }
  footer(s);
}
function tableSlide(ppt, title, subtitle, headers, rows, note='') {
  const s = ppt.addSlide();
  header(s, title, subtitle);
  s.addTable([headers.slice().reverse(), ...rows.map(r=>r.slice().reverse())], { x:0.42, y:1.34, w:12.5, border:{type:'solid', pt:0.5, color:COLORS.border}, fill:COLORS.white, color:COLORS.bgDark, fontFace:'Calibri', fontSize:10, rowH:0.36, autoPage:true });
  if (note) s.addText(note, { x:0.6, y:6.75, w:12.0, h:0.18, fontFace:'Calibri', fontSize:9, color:COLORS.muted, align:'right', rtlMode:true });
  footer(s);
}
async function make(file, title, subtitle, body, bullets, table){
  const ppt = new PptxGenJS();
  ppt.layout = 'LAYOUT_WIDE';
  ppt.rtlMode = true;
  ppt.title = title;
  ppt.author = 'Lovable';
  ppt.company = 'Lovable Cloud';
  cover(ppt, title, subtitle);
  textSlide(ppt, title, 'المحتوى الجاهز', body, bullets);
  if (table) tableSlide(ppt, title, table.subtitle || 'الجدول التنفيذي', table.headers, table.rows, table.note || '');
  await ppt.writeFile({ fileName: path.join(OUT, file) });
}
(async()=>{
  await make('prospect-list-0-0.pptx','قائمة 50 جهة محتملة للاستقطاب','عرض تنفيذي جاهز لتوزيع جهات الاستهداف والشراكات','هذه القائمة تتضمن 50 جهة محتملة موزعة على قطاعات متنوعة يمكن البدء معها مباشرة في حملة الشراكات والاستقطاب.',['تم تنويع القطاعات والمدن لتوسيع فرص الوصول.','أضف اسم نقطة الاتصال الفعلية بعد التحقق من الجهة.','استخدم السقف التقديري لتحديد أولوية المتابعة والعرض المناسب.'],{headers:['#','اسم الجهة','القطاع','المدينة','جهة الاتصال','الجوال','البريد','الاهتمام المتوقع','السقف التقديري','الحالة','ملاحظات'],rows:Array.from({length:50},(_,i)=>[String(i+1),`جهة محتملة #${i+1}`,['بنك','شركة اتصالات','شركة تأمين','شركة أغذية','مجموعة تجارية'][i%5],['الرياض','جدة','الدمام','المدينة المنورة','الخبر'][i%5],'مسؤول الشراكات','0500000000','csr@company.example',['كفالة الأيتام','السلال الغذائية','المساعدات الطبية','دعم الأسر المنتجة','مشاريع التمكين'][i%5],'متوسط (50,000 - 200,000 ر.س)','بانتظار التواصل','أضف نتيجة التواصل الأول']),note:'قائمة استهداف أولية قابلة للتعديل قبل التواصل.'});
  await make('social-post-0-1.pptx','منشور استقطاب المتبرعين الجدد','عرض PowerPoint جاهز للحملة','هل تعلم أن مساهمتك البسيطة تصنع فرقاً عظيماً؟ انضم إلينا اليوم في جمعيتنا وكن جزءاً من قصة نجاح مستمرة.',['نحن نؤمن أن العطاء لا يقاس بالكم بل بالأثر.','تبرعك الأول هو بداية لرحلة خير لا تنتهي.','ساهم الآن عبر الرابط: {رابط_المتجر}.','#خير_مستمر #عطاء #جمعية_الخير #تبرع_الآن #مبادرة_إنسانية','اقتراح بصري: فيديو قصير 15 ثانية يظهر أثر التبرع على المستفيدين مع موسيقى هادئة.']);
  await make('partner-message-0-2.pptx','رسالة دعوة الشركاء والمانحين الجدد','عرض PowerPoint جاهز للرسالة','السلام عليكم ورحمة الله وبركاته، يسعدنا في {اسم_الجمعية} دعوتكم لتكونوا شركاء في مسيرة العطاء.',['لقد اطلعنا على جهودكم المباركة ونتطلع لتعاون يثمر خيراً لمجتمعنا.','نرفق لكم عرضاً خاصاً لمشاريعنا الحالية التي تتقاطع مع أهدافكم.','نتشرف بتواصلكم عبر {رقم_التواصل}.','شكراً لكم.']);
  await make('first-donation-script-0-3.pptx','سكربت عرض التبرع الأول للمستهدفين الجدد','عرض PowerPoint تنفيذي للإقناع والتواصل','خطة عرض التبرع الأول: "خطوتك الأولى في عالم العطاء"',['الوعد: ضمان وصول تبرعك لمستحقيه بأعلى معايير الشفافية.','الفئة المستهدفة: المتبرعون لأول مرة.','المبلغ المقترح: 50 - 100 ريال كبداية.','المنفعة: تقرير أثر فوري يصلك عبر الواتساب بعد التنفيذ.','نص الإقناع: تبرعك اليوم ليس مجرد رقم، بل هو أمل جديد لأسرة محتاجة.']);
  await make('service-gap-analysis-1-0.pptx','نموذج تحليل رضا المتبرعين الحالي','عرض PowerPoint جاهز لتحليل فجوات الخدمة','يرجى رصد كافة الشكاوى الواردة خلال الأسبوع الماضي وتصنيفها حسب السرعة والجودة.',['استخدم هذا النموذج لتحديد الفجوات التي أثرت على مستوى الرضا.','اعرض النتائج في الاجتماع التشغيلي القادم.'],{headers:['وقت الاستجابة','نوع الاستفسار','تقييم المتبرع','تم الحل؟','ملاحظات إضافية'],rows:[['','','','',''],['','','','',''],['','','','','']],note:'قالب متابعة وتحليل جاهز للتعبئة.'});
  await make('rapid-response-protocol-1-1.pptx','بروتوكول الاستجابة السريعة للمتبرعين','عرض PowerPoint جاهز للتطبيق التشغيلي','"أهلاً بك {الاسم}، معك {اسم_الموظف} من جمعية {الاسم}. نشكرك على تواصلك ونعتذر عن أي تأخير."',['بخصوص استفسارك عن {الموضوع}، يسعدني إبلاغك أننا قمنا بـ {الإجراء}.','سيتم تزويدك بالتحديث النهائي خلال ساعتين.','الرد على الواتساب خلال 15 دقيقة كحد أقصى.','معالجة المشاكل المالية خلال 24 ساعة.','إرسال رسالة شكر فورية بعد كل عملية تبرع.']);
  await make('satisfaction-followup-1-2.pptx','رسالة قياس الرضا بعد التحسين','عرض PowerPoint جاهز للرسالة','عزيزنا {الاسم}، رأيك يهمنا جداً لنرتقي بخدمتكم.',['لقد قمنا مؤخراً بتحديث أنظمة الاستجابة لدينا لضمان سرعة خدمتكم.','هل أنت راضٍ عن تجربتك الأخيرة معنا؟','نرجو منك تقييمنا عبر الرابط التالي: {رابط_التقييم}.','شكراً لكونك جزءاً من عائلتنا.']);
  await make('service-quality-report-1-3.pptx','تقرير تحسن جودة الخدمة النهائي','عرض PowerPoint جاهز لقياس أثر التحسين','هذا التقرير مخصص لعرض الارتفاع في جودة الخدمة بعد تطبيق البروتوكول الجديد.',['حدّث الأرقام بشكل دوري وشارك العرض في اجتماع المتابعة.'],{headers:['وقت الرد السابق','وقت الرد الحالي','الشكاوى المغلقة','نسبة الرضا الجديدة'],rows:[['','','',''],['','','',''],['','','','']],note:'قالب عرض دوري لنتائج التحسين.'});
  await make('loyal-donors-list-4-0.pptx','قائمة المتبرعين المنتظمين (برنامج الولاء)','عرض PowerPoint جاهز لإدارة برنامج الولاء','هذه القائمة تعرض المتبرعين المنتظمين الذين يساهمون بشكل دوري، مع بيانات تواصلهم وتاريخ آخر تبرع وقيمته الإجمالية.',['استخدمها لتوزيع التواصل والمتابعة على الفريق.','حدّث حالة كل متبرع بعد كل تواصل.'],{headers:['#','الاسم','الجوال','البريد','المدينة','إجمالي التبرعات','عدد المرات','آخر تبرع','الشريحة','ملاحظات'],rows:Array.from({length:46},(_,i)=>[String(i+1),`متبرع منتظم #${i+1}`,'05XXXXXXXX','donor@example.com',['الرياض','جدة','الدمام','المدينة'][i%4],`${(5000+i*250)} ر.س`,String(3+(i%6)),'2026-04-01','منتظم','أضف نتيجة المتابعة']),note:'قائمة ولاء قابلة للمراجعة والتحديث.'});
  await make('loyalty-welcome-4-1.pptx','رسالة ترحيب ببرنامج الولاء (نادي الوفاء)','عرض PowerPoint جاهز للرسالة','عزيزنا {الاسم}، لأنك من القلة الذين جعلوا العطاء نهجاً مستمراً، يسعدنا انضمامك لـ نادي الوفاء بجمعيتنا.',['سنقوم بتزويدك بتقرير حصري نصف سنوي يوضح أثر تبرعاتك التراكمي.','ستحصل على أولوية المشاركة في فعالياتنا الميدانية.','شكراً لثباتك على الخير. {رابط_التفاصيل}']);
  await make('impact-report-4-2.pptx','هيكلية تقرير الأثر لمتبرعي الاستقطاع','عرض PowerPoint جاهز لعرض الأثر الدوري','العنوان: أثر عطائك المستمر - تقرير خاص لشركاء الاستدامة',['الوصف: تقرير بصري يوضح كيف ساهمت التبرعات المنتظمة في استقرار المشاريع.','المحتوى: صور من الميدان، أرقام إجمالية للمستفيدين، وقصة نجاح واحدة مؤثرة.','الهدف: طمأنة المتبرع بأن استقطاعه الشهري هو الركيزة الأساسية للعمل.']);
  await make('loyalty-monthly-report-4-3.pptx','تقرير أداء برنامج الولاء الشهري','عرض PowerPoint جاهز للمتابعة الشهرية','هذا العرض مخصص لقياس مدى نجاح برنامج الولاء في الحفاظ على المانحين واستدامة التبرعات.',['اعرض النتائج ومسببات التوقف والتوصيات التطويرية.'],{headers:['نسبة الاستمرار','أسباب التوقف','ردود الأفعال','نسبة زيادة التبرع'],rows:[['','','',''],['','','',''],['','','','']],note:'قالب متابعة شهري لبرنامج الولاء.'});
  console.log('generated');
})();
