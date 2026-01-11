-- Add work schedule columns to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS work_start_time TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS work_end_time TIME DEFAULT '16:00:00';