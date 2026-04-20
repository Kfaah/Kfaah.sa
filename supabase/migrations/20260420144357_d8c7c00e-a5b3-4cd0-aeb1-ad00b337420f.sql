
-- إزالة القيود الفريدة على الاسم لأن نفس الاسم يجب أن يتكرر بين الجمعيات المختلفة
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE public.job_roles DROP CONSTRAINT IF EXISTS job_roles_name_key;
ALTER TABLE public.strategic_goals DROP CONSTRAINT IF EXISTS strategic_goals_name_key;

-- إضافة قيود فريدة مركبة (الاسم + المؤسسة) بدلاً من ذلك
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_org_unique ON public.departments(name, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS job_roles_name_org_unique ON public.job_roles(name, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS strategic_goals_name_year_org_unique ON public.strategic_goals(name, year, organization_id);
