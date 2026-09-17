-- 1) منع سرد مجلدات صور الموظفين لغير المسجّلين (الصور نفسها تظل متاحة عبر الرابط العام للحاوية)
DROP POLICY IF EXISTS "Anyone can view employee avatars" ON storage.objects;

CREATE POLICY "Employee avatars listable by org members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'employees'
  AND (
    is_super_admin(auth.uid())
    OR (
      (storage.foldername(name))[2] IS NOT NULL
      AND user_belongs_to_org(auth.uid(), ((storage.foldername(name))[2])::uuid)
    )
  )
);

-- 2) التحقق أن الموظف والمعيار يتبعان نفس الجمعية عند إدخال درجات التقييم
CREATE OR REPLACE FUNCTION public.eval_score_org_matches(
  _org uuid,
  _employee_user_id uuid,
  _criterion_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _org IS NOT NULL
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
$$;

DROP POLICY IF EXISTS "Admins can insert scores" ON public.employee_evaluation_scores;
CREATE POLICY "Admins can insert scores"
ON public.employee_evaluation_scores
FOR INSERT
TO authenticated
WITH CHECK (
  manager_can_access_org(organization_id)
  AND public.eval_score_org_matches(organization_id, employee_user_id, criterion_id)
);

DROP POLICY IF EXISTS "Admins can update scores" ON public.employee_evaluation_scores;
CREATE POLICY "Admins can update scores"
ON public.employee_evaluation_scores
FOR UPDATE
TO authenticated
USING (manager_can_access_org(organization_id))
WITH CHECK (
  manager_can_access_org(organization_id)
  AND public.eval_score_org_matches(organization_id, employee_user_id, criterion_id)
);

-- 3) إخفاء استراتيجية شرائح المتبرعين عن حسابات العرض فقط
DROP POLICY IF EXISTS "org members view donor tiers" ON public.org_donor_tiers;
CREATE POLICY "org members view donor tiers"
ON public.org_donor_tiers
FOR SELECT
TO authenticated
USING (
  user_belongs_to_org(auth.uid(), organization_id)
  AND NOT is_viewer(auth.uid())
);

REVOKE ALL ON public.org_donor_tiers FROM anon;
REVOKE ALL ON public.employee_evaluation_scores FROM anon;
