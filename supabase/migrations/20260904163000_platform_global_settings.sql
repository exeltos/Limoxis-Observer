-- Limoxis Observer — global Platform Owner settings
create table if not exists public.platform_settings (
  id text primary key default 'global' check (id = 'global'),
  support_email text,
  default_demo_duration_days integer not null default 30 check (default_demo_duration_days between 1 and 365),
  maintenance_notice_enabled boolean not null default false,
  maintenance_notice_el text not null default '',
  maintenance_notice_en text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings(id)
values ('global')
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_owner_read on public.platform_settings;
create policy platform_settings_owner_read
on public.platform_settings for select
using (public.current_user_is_platform_owner());

drop policy if exists platform_settings_owner_update on public.platform_settings;
create policy platform_settings_owner_update
on public.platform_settings for update
using (public.current_user_is_platform_owner())
with check (public.current_user_is_platform_owner());

create or replace function public.touch_platform_settings()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_platform_settings on public.platform_settings;
create trigger trg_touch_platform_settings
before update on public.platform_settings
for each row execute function public.touch_platform_settings();

create or replace function public.audit_platform_settings_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.system_audit_log(
    organization_id, actor_user_id, actor_role, event_type, entity_type, entity_id, metadata
  ) values (
    null,
    auth.uid(),
    'platform_owner',
    'platform_settings_update',
    'platform_settings',
    new.id,
    jsonb_build_object('source','platform_settings')
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_platform_settings_update on public.platform_settings;
create trigger trg_audit_platform_settings_update
after update on public.platform_settings
for each row execute function public.audit_platform_settings_update();
