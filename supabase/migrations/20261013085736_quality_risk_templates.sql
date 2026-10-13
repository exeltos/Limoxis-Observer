-- Risk assessment templates kept by the platform owner: a whole register
-- (one or more periods, with risks and opportunities) read from a hospital's
-- spreadsheet, loaded into an organization only when the platform owner asks.
-- Templates hold a customer's own content, so only the platform owner reads
-- or writes them; nothing is granted to anon, and no organization member sees them.

create table if not exists public.quality_risk_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  source_file text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger trg_quality_risk_templates_touch_updated_at before update on public.quality_risk_templates for each row execute function public.touch_updated_at();

alter table public.quality_risk_templates enable row level security;

create policy quality_risk_templates_owner_read on public.quality_risk_templates
  for select to authenticated using (public.current_user_is_platform_owner());
create policy quality_risk_templates_owner_insert on public.quality_risk_templates
  for insert to authenticated with check (public.current_user_is_platform_owner());
create policy quality_risk_templates_owner_update on public.quality_risk_templates
  for update to authenticated using (public.current_user_is_platform_owner())
  with check (public.current_user_is_platform_owner());

revoke all on public.quality_risk_templates from anon;
grant select, insert, update on public.quality_risk_templates to authenticated;
