UPDATE public.tasks
SET title = regexp_replace(title, '^\[(قبل|أثناء|بعد)\]\s*', '')
WHERE title ~ '^\[(قبل|أثناء|بعد)\]';