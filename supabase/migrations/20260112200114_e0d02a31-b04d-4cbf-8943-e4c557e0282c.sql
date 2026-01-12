-- تغيير نوع عمود header_offset ليقبل الأرقام العشرية
ALTER TABLE public.hr_request_types 
ALTER COLUMN header_offset TYPE numeric USING header_offset::numeric;