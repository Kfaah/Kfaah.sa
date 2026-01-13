-- Add display_order column to strategic_goals table
ALTER TABLE public.strategic_goals 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Update existing goals with sequential order
UPDATE public.strategic_goals 
SET display_order = subquery.row_num 
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num 
  FROM public.strategic_goals
) as subquery 
WHERE public.strategic_goals.id = subquery.id;