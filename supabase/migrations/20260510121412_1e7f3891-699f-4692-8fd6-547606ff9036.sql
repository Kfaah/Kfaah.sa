CREATE TABLE IF NOT EXISTS public.platform_email_deleted_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL UNIQUE,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pem_deleted_ids_provider ON public.platform_email_deleted_ids(provider_message_id);

ALTER TABLE public.platform_email_deleted_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage deleted email ids"
ON public.platform_email_deleted_ids
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));