
-- 1) تحديد المهام التي ستبقى (4 لكل مرحلة، 12 إجمالاً لكل نشاط)
WITH ranked AS (
  SELECT
    id,
    executive_plan_id,
    phase,
    dispatched_task_id,
    ROW_NUMBER() OVER (
      PARTITION BY executive_plan_id, phase
      ORDER BY
        CASE WHEN source = 'manual' THEN 0 ELSE 1 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        created_at ASC
    ) AS phase_rank,
    ROW_NUMBER() OVER (
      PARTITION BY executive_plan_id
      ORDER BY
        CASE WHEN source = 'manual' THEN 0 ELSE 1 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        created_at ASC
    ) AS plan_rank
  FROM public.activity_related_tasks
),
to_delete AS (
  SELECT id, dispatched_task_id
  FROM ranked
  WHERE phase_rank > 4 OR plan_rank > 12
)
-- 2) حذف المهام المُرحَّلة المرتبطة من جدول tasks
DELETE FROM public.tasks
WHERE id IN (
  SELECT dispatched_task_id FROM to_delete WHERE dispatched_task_id IS NOT NULL
);

-- 3) حذف الـ activity_related_tasks الزائدة
WITH ranked AS (
  SELECT
    id,
    executive_plan_id,
    phase,
    ROW_NUMBER() OVER (
      PARTITION BY executive_plan_id, phase
      ORDER BY
        CASE WHEN source = 'manual' THEN 0 ELSE 1 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        created_at ASC
    ) AS phase_rank,
    ROW_NUMBER() OVER (
      PARTITION BY executive_plan_id
      ORDER BY
        CASE WHEN source = 'manual' THEN 0 ELSE 1 END,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        created_at ASC
    ) AS plan_rank
  FROM public.activity_related_tasks
)
DELETE FROM public.activity_related_tasks
WHERE id IN (
  SELECT id FROM ranked WHERE phase_rank > 4 OR plan_rank > 12
);
