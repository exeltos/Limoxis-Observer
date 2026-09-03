alter table public.organizations
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_organizations_is_demo_status
  on public.organizations (is_demo, status);

comment on column public.organizations.is_demo is
  'True only for isolated demo organizations created by Platform Owner demo access workflow.';
