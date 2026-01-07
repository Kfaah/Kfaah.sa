-- Add username column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS employees_username_unique ON public.employees(username) WHERE username IS NOT NULL;

-- Update existing employees to use email as username if username is null
UPDATE public.employees SET username = email WHERE username IS NULL;