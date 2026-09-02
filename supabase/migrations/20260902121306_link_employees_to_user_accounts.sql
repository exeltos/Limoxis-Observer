alter table public.employees
  add column if not exists user_id uuid null references auth.users(id) on delete set null;

create unique index if not exists employees_org_user_unique
  on public.employees(organization_id,user_id)
  where user_id is not null;

create index if not exists employees_user_id_idx
  on public.employees(user_id)
  where user_id is not null;

comment on column public.employees.user_id is
  'Explicit link from employee record to the Supabase Auth account used for self-service workflows such as training.';
