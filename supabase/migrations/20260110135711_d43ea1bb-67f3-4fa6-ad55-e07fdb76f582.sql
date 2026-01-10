-- Set default estimated time to 30 minutes for all tasks
ALTER TABLE public.tasks 
ALTER COLUMN estimated_time_minutes SET DEFAULT 30;

-- Update existing tasks that have NULL estimated_time_minutes to 30
UPDATE public.tasks 
SET estimated_time_minutes = 30 
WHERE estimated_time_minutes IS NULL;