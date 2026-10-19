-- Κουζίνα: «Άσκηση ανάκλησης» (mock recall drill).
--
-- HACCP (and the audit checklist item ΠΠ-11) asks that the recall procedure exists and
-- is tested: a drill starts from a scenario (a supplier's lot, a product, or a dish),
-- the kitchen traces where it went (forward) and where it came from (backward), checks
-- the mass balance (received = used + in stock + written off) and the time it took
-- against the target (usually 4 hours), records whom it notified, what it did and the
-- lessons, and closes with pass / fail. The trace as found is kept with the drill
-- (trace_snapshot) so the report stays what the team saw that day.
--
-- Access as the other kitchen records: view reads, record / manage write, manage deletes.

alter table public.kitchen_settings
  add column if not exists recall_drill_months integer not null default 12 check (recall_drill_months between 1 and 60);

create table if not exists public.kitchen_recall_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  drill_date date not null default current_date,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  scenario text not null default 'supplier_lot' check (scenario in ('supplier_lot','product','dish')),
  trigger_text text,
  receipt_item_id uuid,
  product_id uuid,
  product_name text,
  dish_name text,
  target_minutes integer not null default 240 check (target_minutes > 0),
  elapsed_minutes integer check (elapsed_minutes is null or elapsed_minutes >= 0),
  received_quantity numeric check (received_quantity is null or received_quantity >= 0),
  used_quantity numeric check (used_quantity is null or used_quantity >= 0),
  stock_quantity numeric check (stock_quantity is null or stock_quantity >= 0),
  written_off_quantity numeric check (written_off_quantity is null or written_off_quantity >= 0),
  quantity_unit text check (quantity_unit is null or quantity_unit in ('kg','pcs','l','mixed')),
  accounted_percent numeric check (accounted_percent is null or accounted_percent >= 0),
  batches_count integer check (batches_count is null or batches_count >= 0),
  affected_days integer check (affected_days is null or affected_days >= 0),
  affected_meals integer check (affected_meals is null or affected_meals >= 0),
  affected_portions integer check (affected_portions is null or affected_portions >= 0),
  traced_within_target boolean,
  trace_snapshot jsonb,
  notified text,
  actions text,
  result text check (result in ('pass','fail')),
  lessons text,
  conducted_by_employee_id uuid references public.employees(id) on delete set null,
  conducted_by_name text,
  status text not null default 'draft' check (status in ('draft','completed')),
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  foreign key (receipt_item_id, organization_id) references public.kitchen_receipt_items(id, organization_id) on delete set null (receipt_item_id),
  foreign key (product_id, organization_id) references public.kitchen_products(id, organization_id) on delete set null (product_id),
  check (finished_at is null or finished_at >= started_at),
  check (status = 'draft' or (result is not null and finished_at is not null))
);
create index if not exists kitchen_recall_drills_org_idx on public.kitchen_recall_drills (organization_id, drill_date desc);
create index if not exists kitchen_recall_drills_item_idx on public.kitchen_recall_drills (receipt_item_id) where receipt_item_id is not null;

-- The drill's code (ANK-0001, …) and who changed it last.
create or replace function private.kitchen_recall_drill_rules()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'ANK-' || lpad((coalesce((select max(substring(d.code from '^ANK-([0-9]+)$')::integer) from public.kitchen_recall_drills d where d.organization_id = new.organization_id), 0) + 1)::text, 4, '0');
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
revoke all on function private.kitchen_recall_drill_rules() from public, anon, authenticated;
create or replace trigger trg_kitchen_recall_drills_rules before insert or update on public.kitchen_recall_drills for each row execute function private.kitchen_recall_drill_rules();

alter table public.kitchen_recall_drills enable row level security;
revoke all on public.kitchen_recall_drills from anon;
grant select, insert, update, delete on public.kitchen_recall_drills to authenticated;
drop policy if exists kitchen_recall_drills_read on public.kitchen_recall_drills;
drop policy if exists kitchen_recall_drills_insert on public.kitchen_recall_drills;
drop policy if exists kitchen_recall_drills_update on public.kitchen_recall_drills;
drop policy if exists kitchen_recall_drills_delete on public.kitchen_recall_drills;
create policy kitchen_recall_drills_read on public.kitchen_recall_drills for select to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('view'))::uuid[]));
create policy kitchen_recall_drills_insert on public.kitchen_recall_drills for insert to authenticated
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_recall_drills_update on public.kitchen_recall_drills for update to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_recall_drills_delete on public.kitchen_recall_drills for delete to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('manage'))::uuid[]));

comment on table public.kitchen_recall_drills is 'Κουζίνα: άσκηση ανάκλησης (σενάριο, ιχνηλάτηση εμπρός / πίσω, ισοζύγιο μάζας, χρόνος έναντι στόχου, ενημερώσεις, ενέργειες, αποτέλεσμα).';
comment on column public.kitchen_settings.recall_drill_months is 'Κάθε πόσους μήνες γίνεται άσκηση ανάκλησης (προεπιλογή 12).';
