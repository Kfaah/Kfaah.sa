-- إضافة عمود لحفظ موضع المحتوى (ارتفاع الكليشيه) لكل نوع طلب
ALTER TABLE public.hr_request_types
ADD COLUMN IF NOT EXISTS header_offset integer DEFAULT 200;