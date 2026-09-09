-- 1) employee-files: remove path-only insert policy, bind writes to ownership/org-admin check
DROP POLICY IF EXISTS "Users can upload their own employee files" ON storage.objects;

DROP POLICY IF EXISTS "Employee files update owner or verified org admin" ON storage.objects;
CREATE POLICY "Employee files update owner or verified org admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Employee files select owner or verified org admin" ON storage.objects;
CREATE POLICY "Employee files select owner or verified org admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Employee files delete owner or verified org admin" ON storage.objects;
CREATE POLICY "Employee files delete owner or verified org admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'employee-files'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND public.can_manage_employee_file(((storage.foldername(name))[1])::uuid)
);

-- 2) expense-receipts: require the first folder to be an organization the user actually belongs to
DROP POLICY IF EXISTS "expense_receipts_finance_read" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_finance_write" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_finance_update" ON storage.objects;
DROP POLICY IF EXISTS "expense_receipts_finance_delete" ON storage.objects;

CREATE POLICY "expense_receipts_finance_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
      AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.approval_status = 'approved'
          AND uo.organization_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  )
);

CREATE POLICY "expense_receipts_finance_write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
      AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.approval_status = 'approved'
          AND uo.organization_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  )
);

CREATE POLICY "expense_receipts_finance_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
      AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.approval_status = 'approved'
          AND uo.organization_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
      AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.approval_status = 'approved'
          AND uo.organization_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  )
);

CREATE POLICY "expense_receipts_finance_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR (
      public.has_any_role(auth.uid(), ARRAY['admin','moderator','finance_manager','accountant']::app_role[])
      AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = auth.uid()
          AND uo.approval_status = 'approved'
          AND uo.organization_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  )
);

-- 3) org-documents: allow org admins (or platform super admin) to update/delete their own org's documents
DROP POLICY IF EXISTS "org admins update org-documents" ON storage.objects;
CREATE POLICY "org admins update org-documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'org-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.admin_can_access_org(((storage.foldername(name))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'org-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.admin_can_access_org(((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS "org admins delete org-documents" ON storage.objects;
CREATE POLICY "org admins delete org-documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'org-documents'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (
    public.is_super_admin(auth.uid())
    OR public.admin_can_access_org(((storage.foldername(name))[1])::uuid)
  )
);