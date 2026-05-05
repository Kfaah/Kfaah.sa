-- جدول رسائل الدعم/التواصل الواردة
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_phone TEXT,
  organization_name TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'new',
  is_read BOOLEAN NOT NULL DEFAULT false,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول الردود (محادثة كاملة لكل رسالة)
CREATE TABLE public.support_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  from_owner BOOLEAN NOT NULL DEFAULT true,
  author_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_created ON public.support_messages(created_at DESC);
CREATE INDEX idx_support_messages_status ON public.support_messages(status);
CREATE INDEX idx_support_replies_msg ON public.support_replies(message_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

-- أي شخص يقدر يرسل رسالة دعم (نموذج عام)
CREATE POLICY "anyone_can_send_support_message"
ON public.support_messages FOR INSERT
WITH CHECK (true);

-- المالك (super_admin) فقط يقرأ ويعدل
CREATE POLICY "super_admin_read_messages"
ON public.support_messages FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_update_messages"
ON public.support_messages FOR UPDATE
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_delete_messages"
ON public.support_messages FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- الردود: المالك فقط يقرأ ويكتب
CREATE POLICY "super_admin_read_replies"
ON public.support_replies FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_insert_replies"
ON public.support_replies FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_support_messages_updated_at
BEFORE UPDATE ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();