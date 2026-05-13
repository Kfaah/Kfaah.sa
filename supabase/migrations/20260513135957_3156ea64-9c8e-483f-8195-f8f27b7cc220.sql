
-- ============================================================
-- 1) employee-files: تحويل bucket من عام إلى خاص
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'employee-files';

-- التأكد من وجود سياسة للمالك للقراءة (سياسة قائمة بالفعل بالاسم "Users can view their own files in storage")
-- التأكد من وجود سياسة للأدمن (قائمة بالاسم "Admins can view all files in storage")
-- لا حاجة لتعديل السياسات

-- ============================================================
-- 2) user_organizations: قفل INSERT المباشر — الانضمام عبر RPC فقط
-- ============================================================
-- لا توجد INSERT policy permissive حالياً سوى تلك الخاصة بالـ demo، 
-- مما يعني (عملياً) أن أي insert authenticated مسموح بشرط ألا يكون demo.
-- نضيف سياسة صارمة: المستخدم يستطيع فقط إنشاء عضوية لنفسه بحالة pending.
CREATE POLICY "users_self_request_membership"
ON public.user_organizations FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND approval_status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

-- ============================================================
-- 3) admin_ai_insights_cache: السماح لمدير الجمعية بقراءة كاش جمعيته
-- ============================================================
CREATE POLICY "Org admins can read their org insights cache"
ON public.admin_ai_insights_cache FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.is_org_admin(auth.uid(), organization_id)
);
