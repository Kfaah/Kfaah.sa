-- حذف بيانات الخطط القديمة لجمعية صواب فقط
DELETE FROM public.tasks WHERE organization_id = 'a8a8aa31-3247-4cbe-b9e3-489e066fc941';
DELETE FROM public.executive_plans WHERE organization_id = 'a8a8aa31-3247-4cbe-b9e3-489e066fc941';
DELETE FROM public.operational_plans WHERE organization_id = 'a8a8aa31-3247-4cbe-b9e3-489e066fc941';

-- حذف الأهداف الاستراتيجية والمبادرات (إن وجدت جداول لها)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sub_initiatives') THEN
    EXECUTE 'DELETE FROM public.sub_initiatives WHERE organization_id = ''a8a8aa31-3247-4cbe-b9e3-489e066fc941''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='initiatives') THEN
    EXECUTE 'DELETE FROM public.initiatives WHERE organization_id = ''a8a8aa31-3247-4cbe-b9e3-489e066fc941''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='strategic_goals') THEN
    EXECUTE 'DELETE FROM public.strategic_goals WHERE organization_id = ''a8a8aa31-3247-4cbe-b9e3-489e066fc941''';
  END IF;
END $$;