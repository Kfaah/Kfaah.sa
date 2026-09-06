create policy "org members read org-documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'org-documents'
  and exists (
    select 1 from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.approval_status = 'approved'
      and uo.organization_id::text = (storage.foldername(name))[1]
  )
);

create policy "org members write org-documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'org-documents'
  and exists (
    select 1 from public.user_organizations uo
    where uo.user_id = auth.uid()
      and uo.approval_status = 'approved'
      and uo.organization_id::text = (storage.foldername(name))[1]
  )
);
