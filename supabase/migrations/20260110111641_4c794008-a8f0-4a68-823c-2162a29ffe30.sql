-- Create task_messages table for communication and attachments
CREATE TABLE public.task_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT, -- 'image', 'video', 'pdf', 'document'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_messages ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- RLS Policies for task_messages

-- Users can view messages for their own tasks
CREATE POLICY "Users can view messages for own tasks"
ON public.task_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_messages.task_id 
    AND tasks.user_id = auth.uid()
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.task_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert messages for their own tasks
CREATE POLICY "Users can insert messages for own tasks"
ON public.task_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_messages.task_id 
    AND tasks.user_id = auth.uid()
  )
);

-- Admins can insert messages for any task
CREATE POLICY "Admins can insert messages"
ON public.task_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role)
);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.task_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Storage policies for task-attachments bucket
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view task attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete own task attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for task_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_messages;