-- جدول الأسئلة
CREATE TABLE public.intelligence_profile_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL CHECK (step_key IN ('skills','duties','personality','goals','availability')),
  question_key TEXT NOT NULL,
  data_field TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('chips','radio','text','textarea','number')),
  label TEXT NOT NULL,
  placeholder TEXT,
  helper_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  min_value INTEGER,
  max_value INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, question_key)
);

CREATE INDEX idx_ipq_org ON public.intelligence_profile_questions(organization_id);
CREATE INDEX idx_ipq_step ON public.intelligence_profile_questions(step_key);

-- جدول الخيارات
CREATE TABLE public.intelligence_profile_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.intelligence_profile_questions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ipo_question ON public.intelligence_profile_options(question_id);

ALTER TABLE public.intelligence_profile_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_profile_options ENABLE ROW LEVEL SECURITY;

-- دالة الصلاحيات
CREATE OR REPLACE FUNCTION public.can_manage_intelligence_profile(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      _org_id IS NOT NULL
      AND public.user_belongs_to_org(_user_id, _org_id)
      AND public.has_any_role(_user_id, ARRAY['admin','hr_manager','moderator']::app_role[])
    );
$$;

-- سياسات الأسئلة
CREATE POLICY "Users read questions in their org or defaults"
ON public.intelligence_profile_questions FOR SELECT TO authenticated
USING (organization_id IS NULL OR public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Managers insert questions"
ON public.intelligence_profile_questions FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), organization_id));

CREATE POLICY "Managers update questions"
ON public.intelligence_profile_questions FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), organization_id));

CREATE POLICY "Managers delete questions"
ON public.intelligence_profile_questions FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), organization_id));

-- سياسات الخيارات
CREATE POLICY "Users read options"
ON public.intelligence_profile_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.intelligence_profile_questions q
  WHERE q.id = question_id
    AND (q.organization_id IS NULL OR public.user_belongs_to_org(auth.uid(), q.organization_id))
));

CREATE POLICY "Managers insert options"
ON public.intelligence_profile_options FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.intelligence_profile_questions q
  WHERE q.id = question_id
    AND (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), q.organization_id))
));

CREATE POLICY "Managers update options"
ON public.intelligence_profile_options FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.intelligence_profile_questions q
  WHERE q.id = question_id
    AND (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), q.organization_id))
));

CREATE POLICY "Managers delete options"
ON public.intelligence_profile_options FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.intelligence_profile_questions q
  WHERE q.id = question_id
    AND (public.is_super_admin(auth.uid()) OR public.can_manage_intelligence_profile(auth.uid(), q.organization_id))
));

-- مشغلات تحديث الـ updated_at
CREATE TRIGGER update_ipq_updated_at BEFORE UPDATE ON public.intelligence_profile_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ipo_updated_at BEFORE UPDATE ON public.intelligence_profile_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- تعبئة الأسئلة الافتراضية
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
(NULL, 'availability', 'peak_hours', 'peak_hours', 'radio', 'أوقات الذروة في إنتاجيتك', NULL, NULL, 3, NULL, NULL);

-- تعبئة الخيارات
INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('Excel متقدم',1),('إدارة المشاريع',2),('التسويق الرقمي',3),('إدارة المتبرعين',4),
('تحليل البيانات',5),('كتابة التقارير',6),('إعداد العروض التقديمية',7),('إدارة وسائل التواصل',8),
('خدمة العملاء',9),('المحاسبة المالية',10),('إدارة الفعاليات',11),('التواصل المؤسسي',12),
('العمل التطوعي',13),('إدارة المتاجر الإلكترونية',14)) AS x(v,ord)
WHERE q.question_key = 'technical_skills' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('العربية',1),('الإنجليزية',2),('الفرنسية',3),('الأردية',4),('التركية',5)) AS x(v,ord)
WHERE q.question_key = 'languages' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('PMP',1),('شهادة في التسويق الرقمي',2),('إدارة الجودة',3),
('محاسبة معتمدة',4),('شهادة في القيادة',5),('تحليل البيانات',6)) AS x(v,ord)
WHERE q.question_key = 'certifications' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('قيادة الفرق',1),('التخطيط الاستراتيجي',2),('التحليل المالي',3),
('مهارات التفاوض',4),('العرض والإلقاء',5),('إدارة الوقت',6),('الذكاء الاصطناعي',7)) AS x(v,ord)
WHERE q.question_key = 'development_areas' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.v, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('العمل مع المتبرعين',1),('إعداد التقارير',2),('إدارة الحملات',3),
('تطوير المحتوى',4),('خدمة المستفيدين',5),('العمليات الميدانية',6),('الأنشطة الرقمية',7)) AS x(v,ord)
WHERE q.question_key = 'preferred_domains' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('solo','أعمل بشكل منفرد وأركّز',1),('team','أعمل ضمن فريق وأتفاعل',2),('hybrid','مختلط حسب المهمة',3)) AS x(v,l,ord)
WHERE q.question_key = 'work_style' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('low','أفضّل بيئة هادئة بلا ضغط',1),('medium','أتعامل مع ضغط متوسط بسلاسة',2),('high','أتألق تحت الضغط العالي',3)) AS x(v,l,ord)
WHERE q.question_key = 'pressure_handling' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('long_term','تخطيط طويل المدى وعميق',1),('short_term','تنفيذ سريع ومهام قصيرة',2),('mixed','مزيج بين الاثنين',3)) AS x(v,l,ord)
WHERE q.question_key = 'planning_preference' AND q.organization_id IS NULL;

INSERT INTO public.intelligence_profile_options (question_id, value, label, display_order)
SELECT q.id, x.v, x.l, x.ord FROM public.intelligence_profile_questions q,
LATERAL (VALUES ('morning','الصباح الباكر',1),('afternoon','بعد الظهر',2),('evening','المساء',3)) AS x(v,l,ord)
WHERE q.question_key = 'peak_hours' AND q.organization_id IS NULL;