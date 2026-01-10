-- إضافة صلاحية time_editor للـ enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'time_editor';