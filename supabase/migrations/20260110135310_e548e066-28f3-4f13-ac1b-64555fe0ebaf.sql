-- Add estimated and actual time columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN estimated_time_minutes integer DEFAULT NULL,
ADD COLUMN actual_time_minutes integer DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.tasks.estimated_time_minutes IS 'الوقت المقدر للتنفيذ بالدقائق';
COMMENT ON COLUMN public.tasks.actual_time_minutes IS 'الوقت الفعلي للتنفيذ بالدقائق';