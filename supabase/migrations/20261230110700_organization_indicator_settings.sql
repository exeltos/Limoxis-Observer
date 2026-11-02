-- Ποιοι από τους κοινούς δείκτες της πλατφόρμας είναι ενεργοί σε κάθε νοσοκομείο. Χωρίς γραμμή = ενεργός.
-- Ο κατάλογος μένει ολόκληρος στη Διαχείριση· όσοι απενεργοποιούνται δεν εμφανίζονται στα «Δείκτες & Στόχοι».
create table if not exists public.organization_indicator_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  indicator_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (organization_id, indicator_key)
);

alter table public.organization_indicator_settings enable row level security;
grant select, insert, update on table public.organization_indicator_settings to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_indicator_settings' and policyname = 'organization_indicator_settings_read') then
    create policy organization_indicator_settings_read on public.organization_indicator_settings for select to authenticated
      using (public.is_org_member(organization_id) or public.current_user_is_platform_owner());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_indicator_settings' and policyname = 'organization_indicator_settings_insert') then
    create policy organization_indicator_settings_insert on public.organization_indicator_settings for insert to authenticated
      with check (public.is_org_admin(organization_id) or public.current_user_is_platform_owner());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_indicator_settings' and policyname = 'organization_indicator_settings_update') then
    create policy organization_indicator_settings_update on public.organization_indicator_settings for update to authenticated
      using (public.is_org_admin(organization_id) or public.current_user_is_platform_owner())
      with check (public.is_org_admin(organization_id) or public.current_user_is_platform_owner());
  end if;
end $$;
