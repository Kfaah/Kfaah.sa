alter table public.deep_analyses
  add column if not exists gap_evidence jsonb,
  add column if not exists source_previews jsonb;

drop policy if exists "analysis_previews_org_read" on storage.objects;
create policy "analysis_previews_org_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'analysis-previews'
  and (
    public.is_super_admin(auth.uid())
    or public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);