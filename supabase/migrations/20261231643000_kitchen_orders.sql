-- Κουζίνα › Παραγγελίες (ιδιοκτήτης 27/11/2026, φάση Β1): όπως στο FileMaker (Λεπτομέρειες Παραγγελίας), η παραγγελία
-- προς έναν προμηθευτή με τα προϊόντα του και τις ποσότητες, που στέλνεται (email ή τηλέφωνο) και από την οποία ανοίγει η
-- παραλαβή με τα προϊόντα της.
-- 1. kitchen_orders: κωδικός (PRG-0001), ημερομηνία, προμηθευτής (quality_suppliers), κατάσταση (draft σε σύνταξη, sent
--    στάλθηκε, cancelled ακυρώθηκε)· η «μερική» και η «ολοκληρωμένη παραλαβή» βγαίνουν από τις παραλαβές της.
-- 2. kitchen_order_items: τα προϊόντα της παραγγελίας (προϊόν του καταλόγου, ποσότητα, μονάδα).
-- 3. kitchen_receipts.order_id: η παραλαβή της παραγγελίας. Μια παραγγελία με παραλαβές δεν διαγράφεται.
-- Πρόσβαση όπως οι άλλοι πίνακες της κουζίνας: προβολή / καταγραφή / διαχείριση (private.current_user_kitchen_orgs) και
-- κλείδωμα της ενότητας (module gate).

create table if not exists public.kitchen_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  ordered_on date not null default current_date,
  supplier_id uuid references public.quality_suppliers(id) on delete set null,
  supplier_name text,
  status text not null default 'draft' check (status in ('draft','sent','cancelled')),
  sent_via text check (sent_via in ('email','phone')),
  sent_at timestamptz,
  sent_by_name text,
  expected_on date,
  notes text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists kitchen_orders_org_idx on public.kitchen_orders (organization_id, ordered_on desc);
create index if not exists kitchen_orders_supplier_idx on public.kitchen_orders (supplier_id);

create table if not exists public.kitchen_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  position integer not null default 0,
  product_id uuid references public.kitchen_products(id) on delete set null,
  product_name text not null check (length(btrim(product_name)) > 0),
  quantity numeric check (quantity is null or quantity > 0),
  unit text not null default 'kg' check (unit in ('kg','pcs','l')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (order_id, organization_id) references public.kitchen_orders(id, organization_id) on delete cascade
);
create index if not exists kitchen_order_items_order_idx on public.kitchen_order_items (order_id, position);
create index if not exists kitchen_order_items_product_idx on public.kitchen_order_items (organization_id, product_id);

alter table public.kitchen_receipts add column if not exists order_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kitchen_receipts_order_fk') then
    alter table public.kitchen_receipts add constraint kitchen_receipts_order_fk
      foreign key (order_id, organization_id) references public.kitchen_orders(id, organization_id);
  end if;
end $$;
create index if not exists kitchen_receipts_order_idx on public.kitchen_receipts (order_id) where order_id is not null;

-- Κωδικός PRG-0001, ο επόμενος του οργανισμού.
create or replace function private.kitchen_order_rules()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'PRG-' || lpad((coalesce((select max(substring(o.code from '^PRG-([0-9]+)$')::integer) from public.kitchen_orders o where o.organization_id = new.organization_id), 0) + 1)::text, 4, '0');
  end if;
  if new.status = 'sent' and new.sent_at is null then new.sent_at := now(); end if;
  return new;
end;
$$;
revoke all on function private.kitchen_order_rules() from public, anon, authenticated;

create or replace trigger trg_kitchen_orders_rules before insert or update on public.kitchen_orders for each row execute function private.kitchen_order_rules();
create or replace trigger trg_kitchen_orders_touch before update on public.kitchen_orders for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_order_items_touch before update on public.kitchen_order_items for each row execute function private.kitchen_touch();

alter table public.kitchen_orders enable row level security;
alter table public.kitchen_order_items enable row level security;
revoke all on public.kitchen_orders from anon;
revoke all on public.kitchen_order_items from anon;
grant select, insert, update, delete on public.kitchen_orders to authenticated;
grant select, insert, update, delete on public.kitchen_order_items to authenticated;

create policy kitchen_orders_read on public.kitchen_orders for select to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('view'))::uuid[]));
create policy kitchen_orders_insert on public.kitchen_orders for insert to authenticated
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_orders_update on public.kitchen_orders for update to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_orders_delete on public.kitchen_orders for delete to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('manage'))::uuid[]));

create policy kitchen_order_items_read on public.kitchen_order_items for select to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('view'))::uuid[]));
create policy kitchen_order_items_insert on public.kitchen_order_items for insert to authenticated
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_order_items_update on public.kitchen_order_items for update to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]))
  with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));
create policy kitchen_order_items_delete on public.kitchen_order_items for delete to authenticated
  using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs('record'))::uuid[]));

-- Κλείδωμα της ενότητας Κουζίνα (όπως οι άλλοι πίνακες, 20261201200000).
create policy kitchen_orders_module_gate on public.kitchen_orders as restrictive for all to authenticated
  using ((select (not private.current_user_has_locked_modules())) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{kitchen}'::text[]))::uuid[])))
  with check ((select (not private.current_user_has_locked_modules())) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{kitchen}'::text[]))::uuid[])));
create policy kitchen_order_items_module_gate on public.kitchen_order_items as restrictive for all to authenticated
  using ((select (not private.current_user_has_locked_modules())) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{kitchen}'::text[]))::uuid[])))
  with check ((select (not private.current_user_has_locked_modules())) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{kitchen}'::text[]))::uuid[])));

-- Ο κατάλογος των πινάκων με κλείδωμα ενότητας (private.module_gated_tables) τους περιλαμβάνει.
do $do$
declare
  v_def text;
  v_old text := $o$('kitchen_receipt_items', array['kitchen']),$o$;
  v_new text := $n$('kitchen_receipt_items', array['kitchen']),
    ('kitchen_orders', array['kitchen']),
    ('kitchen_order_items', array['kitchen']),$n$;
begin
  select pg_get_functiondef('private.module_gated_tables()'::regprocedure) into v_def;
  if position('kitchen_orders' in v_def) > 0 then return; end if;
  if position(v_old in v_def) = 0 then raise exception 'module_gated_tables: the expected text was not found'; end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

comment on table public.kitchen_orders is 'Κουζίνα: παραγγελία προς προμηθευτή (FileMaker: Λεπτομέρειες Παραγγελίας).';
comment on table public.kitchen_order_items is 'Κουζίνα: προϊόν και ποσότητα μιας παραγγελίας.';
