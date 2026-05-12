
-- =====================================================================
-- 🔐 إصلاحات أمنية شاملة: عزل البيانات بين الجمعيات وحماية الكشف العام
-- =====================================================================

-- 1) جدول الموظفين: إزالة سياسة "أي مستخدم يقرأ كل الموظفين" واستبدالها بعزل حسب الجمعية
DROP POLICY IF EXISTS "Authenticated users can view employees for messaging" ON public.employees;
DROP POLICY IF EXISTS "Anyone can view admin employees" ON public.employees;

CREATE POLICY "Members view employees of own organization"
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR auth.uid() = user_id
  OR (organization_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), organization_id))
);

-- 2) جدول user_roles: إزالة الكشف العام لمعرّفات المدراء
DROP POLICY IF EXISTS "Anyone can view admin roles" ON public.user_roles;

-- 3) جدول الجمعيات: إخفاء contact_email و contact_phone عن الزوار
--    صفحة تسجيل الدخول تستخدم RPC public.get_organization_by_slug (موجودة) فلن تتأثر.
DROP POLICY IF EXISTS "Public can view active orgs by slug lookup" ON public.organizations;

CREATE POLICY "Authenticated members view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_org(auth.uid(), id)
  )
);

-- 4) عزل الإدارات والوظائف والأهداف والمبادرات حسب الجمعية
DROP POLICY IF EXISTS "Anyone can view departments" ON public.departments;
CREATE POLICY "Members view departments of own org"
ON public.departments FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Anyone can view job_roles" ON public.job_roles;
CREATE POLICY "Members view job_roles of own org"
ON public.job_roles FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Anyone can view strategic goals" ON public.strategic_goals;
CREATE POLICY "Members view strategic_goals of own org"
ON public.strategic_goals FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Anyone can view initiatives" ON public.initiatives;
CREATE POLICY "Members view initiatives of own org"
ON public.initiatives FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Anyone can view initiative departments" ON public.initiative_departments;
CREATE POLICY "Authenticated view initiative_departments of own org"
ON public.initiative_departments FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

DROP POLICY IF EXISTS "Anyone can view strategic goal departments" ON public.strategic_goal_departments;
CREATE POLICY "Authenticated view strategic_goal_departments of own org"
ON public.strategic_goal_departments FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (organization_id IS NULL)
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

-- 5) Storage: تشديد إيصالات المصاريف (private bucket)
DROP POLICY IF EXISTS "Authenticated can read expense-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload expense-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update expense-receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete expense-receipts" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_authenticated_delete" ON storage.objects;

CREATE POLICY "expense_receipts_finance_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
  )
);

CREATE POLICY "expense_receipts_finance_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
  )
);

CREATE POLICY "expense_receipts_finance_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[]))
);

CREATE POLICY "expense_receipts_finance_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[]))
);

-- 6) Storage: تشديد كتابة branding-assets على المدراء فقط (القراءة تبقى عامة)
DROP POLICY IF EXISTS "branding_assets_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_assets_authenticated_delete" ON storage.objects;

CREATE POLICY "branding_assets_admin_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding-assets'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','hr_manager']::app_role[]))
);

CREATE POLICY "branding_assets_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','hr_manager']::app_role[]))
);

CREATE POLICY "branding_assets_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding-assets'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','hr_manager']::app_role[]))
);

-- 7) Storage: تشديد قراءة ai-plan-references على المدراء/super_admin (غير عامة أصلاً)
DROP POLICY IF EXISTS "Authenticated can read ai-plan-references" ON storage.objects;
DROP POLICY IF EXISTS "ai_plan_references_authenticated_read" ON storage.objects;

CREATE POLICY "ai_plan_references_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ai-plan-references'
  AND (public.is_super_admin(auth.uid())
       OR public.has_any_role(auth.uid(), ARRAY['admin','moderator','hr_manager']::app_role[]))
);

-- 8) Storage: ربط مرفقات الرسائل الداخلية بالمستخدم نفسه (مجلد=user_id)
DROP POLICY IF EXISTS "internal_message_attachments_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload internal-message-attachments" ON storage.objects;

CREATE POLICY "internal_message_attachments_owner_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'internal-message-attachments'
  AND (
    public.is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
