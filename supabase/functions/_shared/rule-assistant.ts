/** Constrained, read-only intent parser. It cannot execute SQL, tools, or instructions in documents. */
export type AssistantIntent = 'help' | 'donation_summary' | 'overdue_tasks' | 'my_tasks' | 'organization_profile' | 'clarify';
export type AssistantRequest = { intent: AssistantIntent; period: 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'all'; clarification?: string };
export function parseAssistantIntent(input: unknown): AssistantRequest {
  if (typeof input !== 'string' || input.length > 2000) return { intent: 'clarify', period: 'all', clarification: 'أرسل سؤالاً قصيراً عن التبرعات أو مهامك أو نبذة الجمعية.' };
  const text = input.normalize('NFKC').replace(/[٠-٩]/g, d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[إأآ]/g,'ا').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().trim();
  if (/(احذف|حذف|ارسل|اكتب رساله|انشر|عدل|انشئ|create|delete|send|update|sql|select\s+\*|تجاهل التعليمات|ignore.*instruction)/.test(text)) return { intent:'clarify', period:'all', clarification:'هذا المساعد للقراءة فقط. استخدم شاشة الإجراء لمراجعة التغيير واعتماده.' };
  // Multiple time periods are ambiguous and must not be silently guessed.
  const times: AssistantRequest['period'][] = [];
  if (/(اليوم|today)/.test(text)) times.push('today');
  if (/(امس|yesterday)/.test(text)) times.push('yesterday');
  if (/(اخر\s*(7|٧|سبع)|اسبوع|last\s*(7|seven)\s*days)/.test(text)) times.push('last_7_days');
  if (/(هذا الشهر|الشهر الحالي|this month)/.test(text)) times.push('this_month');
  if (times.length > 1 || /(20\d{2}|٢٠\d{2}|من\s+\d|سنه|عام|last month|previous month|الشهر الماضي|الشهر السابق)/.test(text)) return { intent:'clarify', period:'all', clarification:'اختر فترة مدعومة واحدة: اليوم، أمس، آخر 7 أيام، هذا الشهر، أو كل البيانات.' };
  const relativeDays = text.match(/(?:last|اخر)\s*(\d+)\s*(?:days?|يوم|ايام)/);
  if ((relativeDays && relativeDays[1] !== '7') || /(غدا|tomorrow|next |القادم|القادمه|الشهر السابق|سابقه|قبل اسبوع|last year)/.test(text)) return { intent:'clarify', period:'all', clarification:'الفترة غير مدعومة. اختر اليوم، أمس، آخر 7 أيام، هذا الشهر، أو كل البيانات.' };
  const period = times[0] || 'all';
  if (/^(مرحبا|اهلا|السلام عليكم|مساعده|help|hi|hello)[!.؟\s]*$/.test(text)) return { intent:'help', period };
  const matches: AssistantIntent[] = [];
  if (/(تبرع|تبرعات|donation)/.test(text) && /(اجمال|مجموع|كم|عدد|ملخص|total|summary|count)/.test(text)) matches.push('donation_summary');
  if (/(مهام|مهمه|tasks?)/.test(text)) matches.push(/(متاخر|overdue)/.test(text) ? 'overdue_tasks':'my_tasks');
  if (/(جمعيه|جمعيتي|organization)/.test(text) && /(نبذه|عن|تعرف|رؤيه|رساله|profile|about)/.test(text)) matches.push('organization_profile');
  if (matches.length !== 1) return { intent:'clarify', period, clarification:'أستطيع عرض إجمالي التبرعات لفترة محددة، مهامك، مهامك المتأخرة، أو نبذة الجمعية. أيّها تريد؟' };
  return { intent:matches[0], period };
}
export function assistantEventStream(content: string, extra: Record<string, unknown> = {}): Response {
  return new Response(`data: ${JSON.stringify({ choices:[{ delta:{content} }], source:'rules-v1', ...extra })}\n\ndata: [DONE]\n\n`, {
    headers:{ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache', 'Access-Control-Allow-Origin':'*' },
  });
}
