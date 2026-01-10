-- Add started_at column to track when task execution started
ALTER TABLE public.tasks 
ADD COLUMN started_at timestamp with time zone DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.tasks.started_at IS 'وقت بدء تنفيذ المهمة';