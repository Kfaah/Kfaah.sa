-- 1) Standardize welcome-backgrounds storage policies on the role helpers
DROP POLICY IF EXISTS "Admins can delete welcome backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload welcome backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update welcome backgrounds" ON storage.objects;

CREATE POLICY "Admins can upload welcome backgrounds"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'welcome-backgrounds'
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Admins can update welcome backgrounds"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'welcome-backgrounds'
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'welcome-backgrounds'
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Admins can delete welcome backgrounds"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'welcome-backgrounds'
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- 2) Harden the evaluation-score org guard with explicit NULL rejection
CREATE OR REPLACE FUNCTION public.eval_score_org_matches(_org uuid, _employee_user_id uuid, _criterion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _org IS NOT NULL
    AND _employee_user_id IS NOT NULL
    AND _criterion_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = _employee_user_id
        AND e.organization_id = _org
    )
    AND EXISTS (
      SELECT 1 FROM public.evaluation_criteria c
      WHERE c.id = _criterion_id
        AND (c.organization_id = _org OR c.organization_id IS NULL)
    )
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_user_approved_in_org(auth.uid(), _org)
    );
$function$;
