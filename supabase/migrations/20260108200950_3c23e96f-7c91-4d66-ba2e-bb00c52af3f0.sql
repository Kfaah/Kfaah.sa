-- Add job_role column to profiles table for non-employee users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS job_role text;