
-- ============================================================
-- 1) organization_profiles: قفل الوصول العام + RPC آمن للـ branding
-- ============================================================
DROP POLICY IF EXISTS "Public can read organization profiles for branding" ON public.organization_profiles;

CREATE OR REPLACE FUNCTION public.get_org_branding(_org_id uuid)
RETURNS TABLE (
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT op.logo_url, op.primary_color, op.secondary_color, op.accent_color, op.updated_at
  FROM public.organization_profiles op
  JOIN public.organizations o ON o.id = op.organization_id
  WHERE op.organization_id = _org_id
    AND o.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_org_branding(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_org_branding(uuid) TO anon, authenticated;

-- ============================================================
-- 2) Storage: expense-receipts — حذف السياسات المتساهلة
-- ============================================================
DROP POLICY IF EXISTS "Org admins delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Org admins update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Org admins upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Org members view receipts" ON storage.objects;

-- ============================================================
-- 3) Storage: ai-plan-references — حذف القراءة المفتوحة + إبقاء قراءة المدراء + قراءة المالك
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read AI plan references" ON storage.objects;

CREATE POLICY "ai_plan_references_owner_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ai-plan-references'
  AND owner = auth.uid()
);

-- ============================================================
-- 4) Storage: action-plan-files — قفل الكتابة على المسجّلين + ملكية الملف
-- ============================================================
DROP POLICY IF EXISTS "Authenticated upload action plan files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update action plan files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete action plan files" ON storage.objects;

CREATE POLICY "action_plan_files_auth_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'action-plan-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "action_plan_files_owner_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'action-plan-files'
  AND (owner = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "action_plan_files_owner_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'action-plan-files'
  AND (owner = auth.uid() OR public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- ============================================================
-- 5) operational_plan_column_order / custom_columns — قفل عن الزوار
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view column order" ON public.operational_plan_column_order;
DROP POLICY IF EXISTS "Anyone can view custom columns" ON public.operational_plan_custom_columns;

CREATE POLICY "Org members view column order"
ON public.operational_plan_column_order FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);

CREATE POLICY "Org members view custom columns"
ON public.operational_plan_custom_columns FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.user_belongs_to_org(auth.uid(), organization_id)
);
