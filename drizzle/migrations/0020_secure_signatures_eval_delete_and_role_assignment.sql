drop policy if exists "Anyone can view signatures" on storage.objects;
drop policy if exists "Users can upload own signature" on storage.objects;
drop policy if exists "Users can update own signature" on storage.objects;
drop policy if exists "Users can delete own signature" on storage.objects;

create policy "Signature owners and org admins can read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'signatures'
  and (
    (storage.foldername(name))[1] = (auth.uid())::text
    or public.is_super_admin(auth.uid())
    or (
      public.has_role(auth.uid(), 'admin'::app_role)
      and exists (
        select 1
        from public.user_organizations me
        join public.user_organizations target
          on target.organization_id = me.organization_id
        where me.user_id = auth.uid()
          and me.approval_status = 'approved'
          and target.approval_status = 'approved'
          and (target.user_id)::text = (storage.foldername(name))[1]
      )
    )
  )
);

create policy "Users manage own signature insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "Users manage own signature update"
on storage.objects for update
to authenticated
using (bucket_id = 'signatures' and (storage.foldername(name))[1] = (auth.uid())::text)
with check (bucket_id = 'signatures' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy "Users manage own signature delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'signatures'
  and (
    (storage.foldername(name))[1] = (auth.uid())::text
    or public.is_super_admin(auth.uid())
  )
);

drop policy if exists "Admins can delete scores" on public.employee_evaluation_scores;
create policy "Admins can delete scores"
on public.employee_evaluation_scores for delete
to authenticated
using (
  public.admin_can_access_org(organization_id)
  and public.eval_score_org_matches(organization_id, employee_user_id, criterion_id)
);

drop policy if exists "Admins can insert roles" on public.user_roles;
drop policy if exists "Admins can update roles" on public.user_roles;
drop policy if exists "Admins can delete roles" on public.user_roles;

create policy "Admins can insert roles"
on public.user_roles for insert
to authenticated
with check (
  public.is_super_admin(auth.uid())
  or (
    public.can_manage_user_role(user_id)
    and role = any (array['user'::app_role, 'viewer'::app_role, 'time_editor'::app_role])
  )
);

create policy "Admins can update roles"
on public.user_roles for update
to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    public.can_manage_user_role(user_id)
    and role = any (array['user'::app_role, 'viewer'::app_role, 'time_editor'::app_role])
  )
)
with check (
  public.is_super_admin(auth.uid())
  or (
    public.can_manage_user_role(user_id)
    and role = any (array['user'::app_role, 'viewer'::app_role, 'time_editor'::app_role])
  )
);

create policy "Admins can delete roles"
on public.user_roles for delete
to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    public.can_manage_user_role(user_id)
    and role = any (array['user'::app_role, 'viewer'::app_role, 'time_editor'::app_role])
  )
);