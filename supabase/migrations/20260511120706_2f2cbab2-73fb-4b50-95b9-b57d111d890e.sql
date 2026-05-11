
-- Reseed default intelligence profile questions (organization_id IS NULL = defaults for all orgs)
INSERT INTO public.intelligence_profile_questions
(organization_id, step_key, question_key, data_field, question_type, label, placeholder, helper_text, display_order, min_value, max_value)
VALUES
(NULL, 'skills', 'technical_skills', 'technical_skills', 'chips', 'المهارات التقنية', 'أضف مهارة (مثال: Excel، إدارة المشاريع)', NULL, 1, NULL, NULL),
(NULL, 'skills', 'languages', 'languages', 'chips', 'اللغات', 'مثال: العربية، الإنجليزية', NULL, 2, NULL, NULL),
(NULL, 'skills', 'certifications', 'certifications', 'chips', 'الشهادات والدورات', 'مثال: PMP، شهادة في التسويق', NULL, 3, NULL, NULL),
(NULL, 'skills', 'years_of_experience', 'years_of_experience', 'number', 'سنوات الخبرة', NULL, NULL, 4, 0, 60),
(NULL, 'skills', 'previous_roles', 'previous_roles', 'text', 'أبرز الأدوار السابقة', 'مثال: منسق مشاريع، أخصائي علاقات', NULL, 5, NULL, NULL),
(NULL, 'personality', 'work_style', 'work_style', 'radio', 'أسلوب العمل المفضل', NULL, NULL, 1, NULL, NULL),
(NULL, 'personality', 'pressure_handling', 'pressure_handling', 'radio', 'التعامل مع الضغط', NULL, NULL, 2, NULL, NULL),
(NULL, 'personality', 'planning_preference', 'planning_preference', 'radio', 'نمط التخطيط', NULL, NULL, 3, NULL, NULL),
(NULL, 'personality', 'communication_style', 'communication_style', 'text', 'أسلوب التواصل', 'مثال: أفضل التواصل المكتوب، أو الاجتماعات القصيرة', NULL, 4, NULL, NULL),
(NULL, 'personality', 'personality_notes', 'personality_notes', 'textarea', 'ملاحظات إضافية عن شخصيتك (اختياري)', 'أي شيء يساعد المنصة على فهمك بشكل أفضل', NULL, 5, NULL, NULL),
(NULL, 'goals', 'career_goals', 'career_goals', 'textarea', 'أهدافك المهنية', 'ما الذي تطمح للوصول إليه خلال السنة القادمة؟', NULL, 1, NULL, NULL),
(NULL, 'goals', 'development_areas', 'development_areas', 'chips', 'مجالات تريد التطور فيها', 'مثال: قيادة الفرق، التحليل المالي', NULL, 2, NULL, NULL),
(NULL, 'goals', 'preferred_domains', 'preferred_domains', 'chips', 'المجالات/المهام المفضلة لديك', 'مثال: العمل مع المتبرعين، إعداد التقارير', NULL, 3, NULL, NULL),
(NULL, 'availability', 'focus_hours_per_day', 'focus_hours_per_day', 'number', 'ساعات التركيز اليومية', NULL, 'عدد الساعات التي تستطيع التركيز فيها بصفاء', 1, 1, 12),
(NULL, 'availability', 'max_parallel_tasks', 'max_parallel_tasks', 'number', 'الحد الأقصى للمهام المتوازية', NULL, 'كم مهمة تستطيع متابعتها في نفس الوقت', 2, 1, 20),
(NULL, 'availability', 'peak_hours', 'peak_hours', 'radio', 'أوقات الذروة في إنتاجيتك', NULL, NULL, 3, NULL, NULL)
ON CONFLICT (organization_id, question_key) DO NOTHING;

-- Options
INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('Excel متقدم',1),('إدارة المشاريع',2),('التسويق الرقمي',3),('إدارة المتبرعين',4),
('تحليل البيانات',5),('كتابة التقارير',6),('إعداد العروض التقديمية',7),('إدارة وسائل التواصل',8),
('خدمة العملاء',9),('المحاسبة المالية',10),('إدارة الفعاليات',11),('التواصل المؤسسي',12),
('العمل التطوعي',13),('إدارة المتاجر الإلكترونية',14)) AS x(v,ord)
WHERE q.question_key = 'technical_skills' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('العربية',1),('الإنجليزية',2),('الفرنسية',3),('الأردية',4),('التركية',5)) AS x(v,ord)
WHERE q.question_key = 'languages' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('PMP',1),('شهادة في التسويق الرقمي',2),('إدارة الجودة',3),
('محاسبة معتمدة',4),('شهادة في القيادة',5),('تحليل البيانات',6)) AS x(v,ord)
WHERE q.question_key = 'certifications' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('قيادة الفرق',1),('التخطيط الاستراتيجي',2),('التحليل المالي',3),
('مهارات التفاوض',4),('العرض والإلقاء',5),('إدارة الوقت',6),('الذكاء الاصطناعي',7)) AS x(v,ord)
WHERE q.question_key = 'development_areas' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('العمل مع المتبرعين',1),('إعداد التقارير',2),('إدارة الحملات',3),
('تطوير المحتوى',4),('خدمة المستفيدين',5),('العمليات الميدانية',6),('الأنشطة الرقمية',7)) AS x(v,ord)
WHERE q.question_key = 'preferred_domains' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('solo','أعمل بشكل منفرد وأركّز',1),('team','أعمل ضمن فريق وأتفاعل',2),('hybrid','مختلط حسب المهمة',3)) AS x(v,l,ord)
WHERE q.question_key = 'work_style' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('low','أفضّل بيئة هادئة بلا ضغط',1),('medium','أتعامل مع ضغط متوسط بسلاسة',2),('high','أتألق تحت الضغط العالي',3)) AS x(v,l,ord)
WHERE q.question_key = 'pressure_handling' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('long_term','تخطيط طويل المدى وعميق',1),('short_term','تنفيذ سريع ومهام قصيرة',2),('mixed','مزيج بين الاثنين',3)) AS x(v,l,ord)
WHERE q.question_key = 'planning_preference' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('morning','الصباح الباكر',1),('afternoon','بعد الظهر',2),('evening','المساء',3)) AS x(v,l,ord)
WHERE q.question_key = 'peak_hours' AND q.organization_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.intelligence_profile_options o WHERE o.question_id = q.id AND o.value = x.v);
