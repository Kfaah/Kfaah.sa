-- Drop HR-related tables (in dependency order)
DROP TABLE IF EXISTS public.hr_request_workflow CASCADE;
DROP TABLE IF EXISTS public.hr_request_approvals CASCADE;
DROP TABLE IF EXISTS public.hr_workflow_stages CASCADE;
DROP TABLE IF EXISTS public.hr_leave_balances CASCADE;
DROP TABLE IF EXISTS public.hr_requests CASCADE;
DROP TABLE IF EXISTS public.hr_request_types CASCADE;

-- Drop attendance table
DROP TABLE IF EXISTS public.attendance CASCADE;

-- Drop helper functions no longer needed
DROP FUNCTION IF EXISTS public.get_hr_manager_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_finance_manager_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_accountants() CASCADE;
DROP FUNCTION IF EXISTS public.can_edit_time(uuid) CASCADE;