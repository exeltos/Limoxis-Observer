-- FileMaker migration, step 3: which Limoxis record each FileMaker record became
-- (or was matched to), so that the tables moved later (trainings, incidents,
-- staff health) find their department and employee, and a table can be moved
-- again without making duplicates. Closed to browser roles like the staging tables.

create table if not exists public.fm_stage_links (
  base_table text not null references public.fm_stage_tables(base_table) on delete cascade,
  record_id text not null,
  target_table text not null,
  target_id uuid not null,
  how text not null default 'created' check (how in ('created', 'matched')),
  note text,
  linked_at timestamptz not null default now(),
  primary key (base_table, record_id, target_table)
);
create index if not exists fm_stage_links_target_idx on public.fm_stage_links (target_table, target_id);
comment on table public.fm_stage_links is 'FileMaker migration: the Limoxis record each FileMaker record was created as or matched to.';
alter table public.fm_stage_links enable row level security;
revoke all on public.fm_stage_links from public, anon, authenticated;
