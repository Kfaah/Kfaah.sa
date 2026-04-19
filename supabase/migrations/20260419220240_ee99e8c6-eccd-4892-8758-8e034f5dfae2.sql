
-- ============================================================
-- جدول الجمعيات
-- ============================================================
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscription_tier TEXT NOT NULL DEFAULT 'standard',
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ربط المستخدمين بالجمعيات
-- ============================================================
CREATE TABLE public.user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_in_org TEXT NOT NULL DEFAULT 'member',
  is_default BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_orgs_user ON public.user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON public.user_organizations(organization_id);

-- ============================================================
-- دوال SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.user_organizations
  WHERE user_id = _user_id
  ORDER BY is_default DESC, created_at ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = _user_id AND organization_id = _org_id
  ) OR public.is_super_admin(_user_id)
$$;

-- ============================================================
-- إضافة organization_id للجداول
-- ============================================================
ALTER TABLE public.employees ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.departments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.job_roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.operational_plans ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.strategic_goals ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.initiatives ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.task_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.active_task ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.executive_plans ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.operational_plan_months ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.operational_plan_custom_columns ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.operational_plan_custom_values ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.operational_plan_column_order ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.file_categories ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.employee_files ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.strategic_goal_departments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.initiative_departments ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============================================================
-- إنشاء جمعية "عطف للأيتام" ونقل البيانات
-- ============================================================
DO $$
DECLARE
  _default_org_id UUID;
BEGIN
  INSERT INTO public.organizations (name, slug, subscription_tier)
  VALUES ('جمعية عطف للأيتام', 'atf-orphans', 'standard')
  RETURNING id INTO _default_org_id;

  UPDATE public.employees SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.tasks SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.departments SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.job_roles SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.operational_plans SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.strategic_goals SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.initiatives SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.notifications SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.task_messages SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.active_task SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.executive_plans SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.operational_plan_months SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.operational_plan_custom_columns SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.operational_plan_custom_values SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.operational_plan_column_order SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.file_categories SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.employee_files SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.strategic_goal_departments SET organization_id = _default_org_id WHERE organization_id IS NULL;
  UPDATE public.initiative_departments SET organization_id = _default_org_id WHERE organization_id IS NULL;

  INSERT INTO public.user_organizations (user_id, organization_id, role_in_org, is_default)
  SELECT DISTINCT ur.user_id, _default_org_id,
    CASE WHEN ur.role = 'admin' THEN 'admin' ELSE 'member' END, true
  FROM public.user_roles ur
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  INSERT INTO public.user_organizations (user_id, organization_id, role_in_org, is_default)
  SELECT DISTINCT e.user_id, _default_org_id, 'member', true
  FROM public.employees e WHERE e.user_id IS NOT NULL
  ON CONFLICT (user_id, organization_id) DO NOTHING;
END $$;

-- ============================================================
-- جعل organization_id NOT NULL
-- ============================================================
ALTER TABLE public.employees ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.departments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.job_roles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_plans ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.strategic_goals ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.initiatives ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.task_messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.active_task ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.executive_plans ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_plan_months ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_plan_custom_columns ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_plan_custom_values ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operational_plan_column_order ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.file_categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.employee_files ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.strategic_goal_departments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.initiative_departments ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_employees_org ON public.employees(organization_id);
CREATE INDEX idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX idx_departments_org ON public.departments(organization_id);
CREATE INDEX idx_job_roles_org ON public.job_roles(organization_id);
CREATE INDEX idx_op_plans_org ON public.operational_plans(organization_id);
CREATE INDEX idx_strategic_goals_org ON public.strategic_goals(organization_id);
CREATE INDEX idx_initiatives_org ON public.initiatives(organization_id);
CREATE INDEX idx_notifications_org ON public.notifications(organization_id);

-- ============================================================
-- RLS — organizations & user_organizations
-- ============================================================
CREATE POLICY "Super admins can view all organizations"
ON public.organizations FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage organizations"
ON public.organizations FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own organizations"
ON public.organizations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_organizations uo
  WHERE uo.organization_id = organizations.id AND uo.user_id = auth.uid()
));

CREATE POLICY "Users can view own memberships"
ON public.user_organizations FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage memberships"
ON public.user_organizations FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Org admins can view org memberships"
ON public.user_organizations FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = public.get_user_organization_id(auth.uid())
);

-- ============================================================
-- صلاحيات Super Admin على كل الجداول الأساسية
-- ============================================================
CREATE POLICY "Super admins full access employees" ON public.employees FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access tasks" ON public.tasks FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access departments" ON public.departments FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access job_roles" ON public.job_roles FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access operational_plans" ON public.operational_plans FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access strategic_goals" ON public.strategic_goals FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access initiatives" ON public.initiatives FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins full access notifications" ON public.notifications FOR ALL
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- Trigger: تعبئة organization_id تلقائياً عند الإدراج
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_organization_id_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_organization_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_org_id_employees BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_tasks BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_departments BEFORE INSERT ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_job_roles BEFORE INSERT ON public.job_roles FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_op_plans BEFORE INSERT ON public.operational_plans FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_strategic_goals BEFORE INSERT ON public.strategic_goals FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_initiatives BEFORE INSERT ON public.initiatives FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_notifications BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_task_messages BEFORE INSERT ON public.task_messages FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_active_task BEFORE INSERT ON public.active_task FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_executive_plans BEFORE INSERT ON public.executive_plans FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_op_months BEFORE INSERT ON public.operational_plan_months FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_op_custom_cols BEFORE INSERT ON public.operational_plan_custom_columns FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_op_custom_vals BEFORE INSERT ON public.operational_plan_custom_values FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_op_col_order BEFORE INSERT ON public.operational_plan_column_order FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_file_cats BEFORE INSERT ON public.file_categories FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_emp_files BEFORE INSERT ON public.employee_files FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_sg_depts BEFORE INSERT ON public.strategic_goal_departments FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER set_org_id_init_depts BEFORE INSERT ON public.initiative_departments FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
