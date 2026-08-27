-- Limoxis Observer v0.3.0
-- Expand base roles in a dedicated migration so enum values are committed before later policies use them.

alter type public.app_role add value if not exists 'infection_control_member';
alter type public.app_role add value if not exists 'department_manager';
alter type public.app_role add value if not exists 'committee_secretariat';
alter type public.app_role add value if not exists 'hr_office';
alter type public.app_role add value if not exists 'pharmacy';
alter type public.app_role add value if not exists 'occupational_physician';
alter type public.app_role add value if not exists 'quality_manager';
alter type public.app_role add value if not exists 'demo';
