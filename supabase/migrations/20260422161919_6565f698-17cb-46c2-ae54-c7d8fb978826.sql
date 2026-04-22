
-- Update prospect list subtask attachment to xlsx
UPDATE public.action_plan_tasks
SET subtasks = jsonb_set(
  subtasks,
  '{0,attachment_url}',
  to_jsonb('https://jopvcsrmccoulujeyjvw.supabase.co/storage/v1/object/public/action-plan-files/25e17864-ca4d-4dd5-8f92-16da4986d8d3/b44670b1-2a7c-4e61-b95f-9b117572565a/prospect-list-b44670b1-2a7c-4e61-b95f-9b117572565a-0-0.xlsx'::text)
)
WHERE id = 'e7620e49-e693-48e1-802e-b46dafb2e29c';

UPDATE public.action_plan_tasks
SET subtasks = jsonb_set(
  subtasks,
  '{0,attachment_name}',
  to_jsonb('قائمة 50 جهة محتملة جاهزة.xlsx'::text)
)
WHERE id = 'e7620e49-e693-48e1-802e-b46dafb2e29c';

-- Update donor list subtask attachment to xlsx
UPDATE public.action_plan_tasks
SET subtasks = jsonb_set(
  subtasks,
  '{0,attachment_url}',
  to_jsonb('https://jopvcsrmccoulujeyjvw.supabase.co/storage/v1/object/public/action-plan-files/25e17864-ca4d-4dd5-8f92-16da4986d8d3/b44670b1-2a7c-4e61-b95f-9b117572565a/donor-list-b44670b1-2a7c-4e61-b95f-9b117572565a-4-0.xlsx'::text)
)
WHERE id = '9591a569-fe85-48a2-b783-86cb704304c5';

UPDATE public.action_plan_tasks
SET subtasks = jsonb_set(
  subtasks,
  '{0,attachment_name}',
  to_jsonb('قائمة جاهزة (46 متبرع).xlsx'::text)
)
WHERE id = '9591a569-fe85-48a2-b783-86cb704304c5';
