-- Limoxis Observer v0.27.21 — governed external Demo accounts
alter table public.profiles
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_entitlement_id uuid;

alter table public.platform_demo_entitlements
  add column if not exists demo_user_id uuid references auth.users(id) on delete set null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='profiles_demo_entitlement_fk'
  ) then
    alter table public.profiles add constraint profiles_demo_entitlement_fk
      foreign key (demo_entitlement_id) references public.platform_demo_entitlements(id) on delete set null;
  end if;
end $$;

create index if not exists platform_demo_entitlements_user_idx on public.platform_demo_entitlements(demo_user_id);
