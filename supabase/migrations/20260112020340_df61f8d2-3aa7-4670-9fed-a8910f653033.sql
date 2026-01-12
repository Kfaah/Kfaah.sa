-- إضافة حقل التوقيع لجدول الموظفين
ALTER TABLE public.employees 
ADD COLUMN signature_url text DEFAULT NULL;

-- إضافة حقل رابط PDF النهائي لطلبات HR
ALTER TABLE public.hr_requests 
ADD COLUMN final_pdf_url text DEFAULT NULL;

-- إضافة حقل توقيع الموافق
ALTER TABLE public.hr_requests 
ADD COLUMN approver_signature_url text DEFAULT NULL;