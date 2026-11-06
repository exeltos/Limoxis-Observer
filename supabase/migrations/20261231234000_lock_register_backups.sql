-- The backups of the department registers taken on 31/10 (bk_register_*_20261031) had no row level security:
-- any signed-in user could read them through the API. RLS on and no policy: only the database itself reads them.
alter table if exists public.bk_register_deliveryroom_20261031 enable row level security;
alter table if exists public.bk_register_emergency_20261031 enable row level security;
alter table if exists public.bk_register_emergency_shiftfix_20261031 enable row level security;
alter table if exists public.bk_register_endoscopy_20261031 enable row level security;
alter table if exists public.bk_register_ophthalmology_20261031 enable row level security;
