-- 1) email_send_state: service role only, no grants to anon/authenticated
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state"
  ON public.email_send_state FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.email_send_state FROM anon, authenticated;
GRANT ALL ON public.email_send_state TO service_role;

-- 2) task_generation_jobs: managers limited to their approved org
DROP POLICY IF EXISTS "Users can view their own task generation jobs" ON public.task_generation_jobs;
CREATE POLICY "Users can view their own task generation jobs"
  ON public.task_generation_jobs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      organization_id IS NOT NULL
      AND public.user_belongs_to_org(auth.uid(), organization_id)
      AND public.manager_can_access_org(organization_id)
    )
  );

-- 3) storage: tie admin access to a real ownership row, not just the folder name
DROP POLICY IF EXISTS "Org admins manage employee files select" ON storage.objects;
DROP POLICY IF EXISTS "Org admins manage employee files update" ON storage.objects;
DROP POLICY IF EXISTS "Org admins manage employee files delete" ON storage.objects;
DROP POLICY IF EXISTS "Owners and org admins can view task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files from storage" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;

CREATE POLICY "Users can upload their own employee files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'employee-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Employee files select owner or verified org admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'employee-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.employee_files ef
        WHERE ef.file_url = storage.objects.name
          AND ef.user_id::text = (storage.foldername(storage.objects.name))[1]
          AND ef.organization_id IS NOT NULL
          AND public.admin_can_access_org(ef.organization_id)
      )
    )
  );

CREATE POLICY "Employee files update owner or verified org admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'employee-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.employee_files ef
        WHERE ef.file_url = storage.objects.name
          AND ef.user_id::text = (storage.foldername(storage.objects.name))[1]
          AND ef.organization_id IS NOT NULL
          AND public.admin_can_access_org(ef.organization_id)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'employee-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Employee files delete owner or verified org admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'employee-files'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.employee_files ef
        WHERE ef.file_url = storage.objects.name
          AND ef.user_id::text = (storage.foldername(storage.objects.name))[1]
          AND ef.organization_id IS NOT NULL
          AND public.admin_can_access_org(ef.organization_id)
      )
    )
  );

CREATE POLICY "Task attachments select owner or verified org admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.task_messages tm
        WHERE tm.attachment_url = storage.objects.name
          AND tm.user_id::text = (storage.foldername(storage.objects.name))[1]
          AND tm.organization_id IS NOT NULL
          AND public.admin_can_access_org(tm.organization_id)
      )
    )
  );
