-- Add display_order column to initiatives table
ALTER TABLE public.initiatives 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Add display_order column to operational_plans table (for activities)
ALTER TABLE public.operational_plans 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Update existing initiatives with sequential order per strategic goal
UPDATE public.initiatives 
SET display_order = subquery.row_num 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY strategic_goal_id ORDER BY created_at) as row_num 
  FROM public.initiatives
) as subquery 
WHERE public.initiatives.id = subquery.id;

-- Update existing operational plans with sequential order per initiative
UPDATE public.operational_plans 
SET display_order = subquery.row_num 
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY initiative ORDER BY created_at) as row_num 
  FROM public.operational_plans
) as subquery 
WHERE public.operational_plans.id = subquery.id;