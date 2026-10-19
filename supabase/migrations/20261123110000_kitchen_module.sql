-- Κουζίνα (HACCP / ασφάλεια τροφίμων): a module of its own.
--
-- The flow follows the FileMaker kitchen of ΙΑΣΩ, made complete for HACCP:
--   kitchen_receipts / _items     a delivery from a supplier (checks, accepted or not) and
--                                 its products, each a batch in stock (batch, expiry,
--                                 temperature, accepted or rejected with a reason);
--   kitchen_stock_writeoffs       a batch withdrawn or discarded, with a reason;
--   kitchen_products              the catalogue (storage: chilled / frozen / ambient);
--   kitchen_menus                 the standard menus (one per weekday in FileMaker);
--   kitchen_productions           the production day: the hub (menu, notes, disinfection
--                                 of vegetables and fruit, the day's sign-off);
--   kitchen_production_meals      the meal plan of a day (meal, diet, dish, portions);
--   kitchen_material_usage        a batch used in a production (traceability: supplier →
--                                 batch → production → dish), taken off its stock;
--   kitchen_thermal_processes     cooking, chilling, reheating and frying of a dish;
--   kitchen_pureeing              pureeing / sieving (visual and blade check);
--   kitchen_defrosting            start / end, method, temperatures and the HACCP sign-off;
--   kitchen_limits                the critical limits (configurable per organization);
--   kitchen_haccp_steps           the HACCP plan: hazards and CCPs per process step;
--   kitchen_settings              expiry warning, review cycle and the HACCP plan document.
-- Every measurement is marked in / out of limits by the database (trigger) from the
-- organization's limits; an entry out of limits made in the app needs a corrective
-- action. Rows imported (source 'filemaker') keep their result without that demand.
-- A signed-off defrost or production day is locked until reopened with a reason.
--
-- Access: view_kitchen reads, record_kitchen records, manage_kitchen (limits, plan,
-- catalogue, sign-off, delete). Hospital Admin has all; Quality Manager all three;
-- the Infection Control Lead reads. A kitchen manager is a custom role with
-- record_kitchen + manage_kitchen; kitchen staff record_kitchen.

-- 1. Capabilities -------------------------------------------------------------------
-- Unchanged except for the three kitchen cases.
create or replace function public.current_user_has_capability(target_org uuid, capability_key text)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select public.current_user_is_platform_owner()
  or exists (
    select 1
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'active'
      and om.role = 'hospital_admin'
      and capability_key not in ('view_platform','manage_platform')
      and (
        capability_key not in ('view_occupational_health','manage_occupational_health')
        or exists (select 1 from public.organizations o where o.id = target_org and o.is_demo)
      )
  )
  or exists (
    select 1
    from public.organization_members om
    where om.user_id=auth.uid()
      and om.organization_id=target_org
      and om.status='active'
      and (
        exists (
          select 1
          from public.custom_role_capabilities crc
          where crc.custom_role_id=om.custom_role_id
            and crc.capability=capability_key
        )
        or exists (
          select 1
          from public.organization_member_capabilities omc
          where omc.membership_id=om.id
            and (
              (omc.capability='lab_access' and capability_key='view_lab')
              or (omc.capability='quality_access' and capability_key in ('view_quality','view_controls'))
            )
        )
        or case capability_key
          when 'view_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','hr_office')
          when 'manage_training' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_prevention' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse')
          when 'view_lab' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer')
          when 'manage_libraries' then om.role in ('hospital_admin','infection_control_lead')
          when 'view_controls' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','department_user','laboratory','quality_manager')
          when 'manage_controls' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'view_indicators' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','link_nurse','department_manager','pharmacy','doctor_reviewer','quality_manager')
          when 'manage_indicators' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'record_pharmacy' then om.role in ('hospital_admin','infection_control_lead','pharmacy')
          when 'record_prevalence_survey' then om.role in ('hospital_admin','infection_control_lead','infection_control_member')
          when 'record_hand_hygiene' then om.role in ('link_nurse')
          when 'record_waste' then om.role in ('link_nurse')
          when 'record_antiseptic' then om.role in ('link_nurse')
          when 'record_prevention_bundle' then om.role in ('link_nurse')
          when 'view_kitchen' then om.role in ('hospital_admin','infection_control_lead','quality_manager')
          when 'record_kitchen' then om.role in ('hospital_admin','quality_manager')
          when 'manage_kitchen' then om.role in ('hospital_admin','quality_manager')
          else false
        end
      )
  );
$function$;

-- The organizations where the user reads / records / manages the kitchen.
create or replace function private.current_user_kitchen_orgs(p_level text)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(distinct om.organization_id), '{}') from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
    and (public.current_user_has_capability(om.organization_id, 'manage_kitchen')
      or (p_level in ('view','record') and public.current_user_has_capability(om.organization_id, 'record_kitchen'))
      or (p_level = 'view' and public.current_user_has_capability(om.organization_id, 'view_kitchen')));
$$;
revoke all on function private.current_user_kitchen_orgs(text) from public, anon;
grant execute on function private.current_user_kitchen_orgs(text) to authenticated;

-- 2. Settings, limits, HACCP plan -------------------------------------------------------

create table if not exists public.kitchen_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  expiry_warning_days integer not null default 2 check (expiry_warning_days between 0 and 30),
  haccp_review_months integer not null default 12 check (haccp_review_months between 1 and 60),
  haccp_last_review_on date,
  haccp_document_id uuid references public.controlled_documents(id) on delete set null,
  haccp_team text,
  notes text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kitchen_limits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  limit_key text not null check (limit_key in ('receipt_chilled','receipt_frozen','receipt_hot','cooking_core','chilling','reheating','frying_oil','defrost')),
  label text not null,
  min_value numeric,
  max_value numeric,
  within_minutes integer check (within_minutes is null or within_minutes > 0),
  unit text not null default '°C',
  active boolean not null default true,
  notes text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (organization_id, limit_key),
  check (min_value is not null or max_value is not null)
);

create table if not exists public.kitchen_haccp_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position integer not null default 0,
  step_key text,
  name text not null check (length(btrim(name)) > 1),
  hazard_biological boolean not null default false,
  hazard_chemical boolean not null default false,
  hazard_physical boolean not null default false,
  hazard_allergen boolean not null default false,
  hazards text,
  is_ccp boolean not null default false,
  control_measure text,
  limit_key text check (limit_key is null or limit_key in ('receipt_chilled','receipt_frozen','receipt_hot','cooking_core','chilling','reheating','frying_oil','defrost')),
  monitoring text,
  frequency text,
  corrective_action text,
  verification text,
  records text,
  responsible text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kitchen_haccp_steps_org_idx on public.kitchen_haccp_steps (organization_id, position);

-- The default limits (also the fallback while an organization has not saved its own).
create or replace function private.kitchen_default_limits()
returns table (limit_key text, label text, min_value numeric, max_value numeric, within_minutes integer)
language sql immutable set search_path = ''
as $$
  values
    ('receipt_chilled', 'Παραλαβή ψυχόμενου', null::numeric, 5::numeric, null::integer),
    ('receipt_frozen', 'Παραλαβή κατεψυγμένου', null, -18, null),
    ('receipt_hot', 'Παραλαβή ζεστού φαγητού', 63, null, null),
    ('cooking_core', 'Μαγείρεμα (θερμοκρασία πυρήνα)', 75, null, null),
    ('chilling', 'Ψύξη μετά το μαγείρεμα', null, 10, 120),
    ('reheating', 'Αναθέρμανση', 75, null, null),
    ('frying_oil', 'Τηγάνισμα (θερμοκρασία λαδιού)', null, 180, null),
    ('defrost', 'Απόψυξη (θερμοκρασία στο τέλος)', null, 5, 4320)
$$;

-- In / out of the organization's limit: 'in', 'out', or null when nothing was measured.
-- p_minutes is the time the measurement took (chilling, defrosting), when known.
create or replace function private.kitchen_check(p_org uuid, p_key text, p_value numeric, p_minutes numeric default null)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare
  v_min numeric; v_max numeric; v_within integer; v_active boolean;
begin
  if p_value is null then return null; end if;
  select l.min_value, l.max_value, l.within_minutes, l.active into v_min, v_max, v_within, v_active
  from public.kitchen_limits l where l.organization_id = p_org and l.limit_key = p_key;
  if not found then
    select d.min_value, d.max_value, d.within_minutes, true into v_min, v_max, v_within, v_active
    from private.kitchen_default_limits() d where d.limit_key = p_key;
  end if;
  if v_active is false then return null; end if;
  if v_min is not null and p_value < v_min then return 'out'; end if;
  if v_max is not null and p_value > v_max then return 'out'; end if;
  if v_within is not null and p_minutes is not null and p_minutes > v_within then return 'out'; end if;
  return 'in';
end;
$$;
revoke all on function private.kitchen_check(uuid, text, numeric, numeric) from public, anon;
grant execute on function private.kitchen_check(uuid, text, numeric, numeric) to authenticated;

-- The worst of several statuses ('out' wins, then 'in').
create or replace function private.kitchen_worst(variadic p_status text[])
returns text language sql immutable set search_path = ''
as $$
  select case when 'out' = any (p_status) then 'out' when 'in' = any (p_status) then 'in' else null end;
$$;

-- 3. Catalogue and menus ---------------------------------------------------------------

create table if not exists public.kitchen_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 1),
  category text not null default 'other' check (category in ('meat','poultry','fish','dairy','eggs','vegetables','fruit','dry','bakery','frozen','beverages','other')),
  storage text not null default 'chilled' check (storage in ('chilled','frozen','ambient')),
  unit text not null default 'kg' check (unit in ('kg','pcs','l')),
  supplier_id uuid references public.quality_suppliers(id) on delete set null,
  supplier_code text,
  low_stock_quantity numeric check (low_stock_quantity is null or low_stock_quantity >= 0),
  active boolean not null default true,
  notes text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table if not exists public.kitchen_menus (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  weekday smallint check (weekday between 1 and 7),
  menu_text text,
  active boolean not null default true,
  notes text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists kitchen_menus_org_idx on public.kitchen_menus (organization_id, weekday);

-- 4. Receipts and stock ------------------------------------------------------------------

create table if not exists public.kitchen_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  supplier_id uuid references public.quality_suppliers(id) on delete set null,
  supplier_name text,
  received_on date not null default current_date,
  received_time time,
  order_reference text,
  receiver_employee_id uuid references public.employees(id) on delete set null,
  receiver_name text,
  temperature_check text check (temperature_check in ('compliant','noncompliant')),
  packaging_check text check (packaging_check in ('compliant','noncompliant')),
  expiry_check text check (expiry_check in ('compliant','noncompliant')),
  vehicle_check text check (vehicle_check in ('compliant','noncompliant')),
  coding_check text check (coding_check in ('compliant','noncompliant')),
  temperature_class text check (temperature_class in ('chilled','frozen','hot','ambient')),
  measured_temperature numeric,
  measured_temperature_text text,
  temperature_unparsed boolean not null default false,
  temperature_status text check (temperature_status in ('in','out')),
  accepted boolean,
  status text not null default 'completed' check (status in ('in_progress','completed')),
  result text check (result in ('accepted','accepted_with_remarks','rejected','pending')),
  limit_status text check (limit_status in ('in','out')),
  quality_notes text,
  corrective_action text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists kitchen_receipts_org_idx on public.kitchen_receipts (organization_id, received_on desc);
create index if not exists kitchen_receipts_supplier_idx on public.kitchen_receipts (supplier_id);

create table if not exists public.kitchen_receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  receipt_id uuid not null,
  position integer not null default 0,
  product_id uuid references public.kitchen_products(id) on delete set null,
  product_name text not null check (length(btrim(product_name)) > 0),
  batch_code text,
  lot_label text,
  expiry_on date,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'kg' check (unit in ('kg','pcs','l')),
  storage text check (storage in ('chilled','frozen','ambient')),
  temperature numeric,
  temperature_text text,
  temperature_unparsed boolean not null default false,
  temperature_status text check (temperature_status in ('in','out')),
  accepted boolean not null default true,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (receipt_id, organization_id) references public.kitchen_receipts(id, organization_id) on delete cascade,
  check (accepted or length(btrim(coalesce(rejection_reason, ''))) > 0)
);
create index if not exists kitchen_receipt_items_receipt_idx on public.kitchen_receipt_items (receipt_id, position);
create index if not exists kitchen_receipt_items_org_idx on public.kitchen_receipt_items (organization_id, product_id);

create table if not exists public.kitchen_stock_writeoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  receipt_item_id uuid not null,
  written_off_on date not null default current_date,
  quantity numeric not null check (quantity > 0),
  reason text not null check (reason in ('expired','spoiled','damaged','temperature','recall','other')),
  notes text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (receipt_item_id, organization_id) references public.kitchen_receipt_items(id, organization_id) on delete cascade
);
create index if not exists kitchen_stock_writeoffs_item_idx on public.kitchen_stock_writeoffs (receipt_item_id);

-- 5. Production day and its records ----------------------------------------------------

create table if not exists public.kitchen_productions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_date date not null,
  menu_id uuid references public.kitchen_menus(id) on delete set null,
  menu_text text,
  notes text,
  disinfection_vegetables boolean not null default false,
  disinfection_fruit boolean not null default false,
  disinfection_agent text,
  disinfection_concentration_ppm numeric check (disinfection_concentration_ppm is null or disinfection_concentration_ppm >= 0),
  disinfection_minutes integer check (disinfection_minutes is null or disinfection_minutes >= 0),
  disinfection_notes text,
  verified_at timestamptz,
  verified_by uuid,
  verified_by_employee_id uuid references public.employees(id) on delete set null,
  verified_by_name text,
  verification_notes text,
  reopen_reason text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index if not exists kitchen_productions_org_idx on public.kitchen_productions (organization_id, production_date desc);

create table if not exists public.kitchen_production_meals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  production_id uuid not null,
  position integer not null default 0,
  meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  diet text not null default 'normal' check (diet in ('normal','diabetic','low_salt','soft','puree','gluten_free','vegetarian','other')),
  dish text not null check (length(btrim(dish)) > 0),
  portions integer check (portions is null or portions >= 0),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (production_id, organization_id) references public.kitchen_productions(id, organization_id) on delete cascade
);
create index if not exists kitchen_production_meals_idx on public.kitchen_production_meals (production_id, position);

create table if not exists public.kitchen_material_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid references public.kitchen_productions(id) on delete set null,
  receipt_item_id uuid references public.kitchen_receipt_items(id) on delete set null,
  product_id uuid references public.kitchen_products(id) on delete set null,
  product_name text not null check (length(btrim(product_name)) > 0),
  lot_label text,
  dish_name text,
  used_on date not null default current_date,
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'kg' check (unit in ('kg','pcs','l')),
  notes text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kitchen_material_usage_production_idx on public.kitchen_material_usage (production_id);
create index if not exists kitchen_material_usage_item_idx on public.kitchen_material_usage (receipt_item_id);
create index if not exists kitchen_material_usage_org_idx on public.kitchen_material_usage (organization_id, used_on desc);

create table if not exists public.kitchen_thermal_processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid references public.kitchen_productions(id) on delete set null,
  process_date date not null default current_date,
  process_time time,
  dish_name text not null check (length(btrim(dish_name)) > 0),
  product_id uuid references public.kitchen_products(id) on delete set null,
  cooking_temp numeric,
  cooking_text text,
  cooking_status text check (cooking_status in ('in','out')),
  chill_temp numeric,
  chill_minutes integer check (chill_minutes is null or chill_minutes >= 0),
  chill_text text,
  chill_status text check (chill_status in ('in','out')),
  reheat_temp numeric,
  reheat_text text,
  reheat_status text check (reheat_status in ('in','out')),
  frying_temp numeric,
  frying_text text,
  frying_status text check (frying_status in ('in','out')),
  temperature_unparsed boolean not null default false,
  limit_status text check (limit_status in ('in','out')),
  corrective_action text,
  notes text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kitchen_thermal_production_idx on public.kitchen_thermal_processes (production_id);
create index if not exists kitchen_thermal_org_idx on public.kitchen_thermal_processes (organization_id, process_date desc);

create table if not exists public.kitchen_pureeing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid references public.kitchen_productions(id) on delete set null,
  pureed_on date not null default current_date,
  method text not null default 'pureeing' check (method in ('pureeing','sieving')),
  product_name text not null check (length(btrim(product_name)) > 0),
  visual_check boolean,
  blade_check boolean,
  limit_status text check (limit_status in ('in','out')),
  corrective_action text,
  notes text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kitchen_pureeing_production_idx on public.kitchen_pureeing (production_id);
create index if not exists kitchen_pureeing_org_idx on public.kitchen_pureeing (organization_id, pureed_on desc);

create table if not exists public.kitchen_defrosting (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_id uuid references public.kitchen_productions(id) on delete set null,
  receipt_item_id uuid references public.kitchen_receipt_items(id) on delete set null,
  product_id uuid references public.kitchen_products(id) on delete set null,
  product_name text not null check (length(btrim(product_name)) > 0),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text not null default 'kg' check (unit in ('kg','pcs','l')),
  method text check (method in ('refrigerator','microwave','running_water','cooking')),
  started_at timestamptz not null,
  start_temp numeric,
  start_text text,
  ended_at timestamptz,
  end_temp numeric,
  end_text text,
  temperature_unparsed boolean not null default false,
  limit_status text check (limit_status in ('in','out')),
  corrective_action text,
  verified_at timestamptz,
  verified_by uuid,
  verified_by_employee_id uuid references public.employees(id) on delete set null,
  verified_by_name text,
  reopen_reason text,
  notes text,
  recorded_by_employee_id uuid references public.employees(id) on delete set null,
  recorded_by_name text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists kitchen_defrosting_org_idx on public.kitchen_defrosting (organization_id, started_at desc);

-- Stock per received batch: received, used, written off, remaining. A rejected
-- receipt or item adds no stock. Read with the caller's rights.
create or replace view public.kitchen_stock with (security_invoker = true) as
select i.id as receipt_item_id, i.organization_id, i.receipt_id, r.code as receipt_code, r.received_on,
  r.supplier_id, coalesce(s.name, r.supplier_name) as supplier_name,
  i.product_id, i.product_name, i.batch_code, i.lot_label, i.expiry_on, i.unit, i.storage,
  (coalesce(r.accepted, true) and i.accepted) as in_stock,
  coalesce(i.quantity, 0) as received_quantity,
  coalesce(u.used, 0) as used_quantity,
  coalesce(w.written_off, 0) as written_off_quantity,
  case when coalesce(r.accepted, true) and i.accepted
    then coalesce(i.quantity, 0) - coalesce(u.used, 0) - coalesce(w.written_off, 0) else 0 end as remaining_quantity,
  coalesce(u.uses, 0) as uses
from public.kitchen_receipt_items i
join public.kitchen_receipts r on r.id = i.receipt_id
left join public.quality_suppliers s on s.id = r.supplier_id
left join lateral (select sum(m.quantity) as used, count(*) as uses from public.kitchen_material_usage m where m.receipt_item_id = i.id) u on true
left join lateral (select sum(x.quantity) as written_off from public.kitchen_stock_writeoffs x where x.receipt_item_id = i.id) w on true;

-- 6. Rules (triggers) -------------------------------------------------------------------

create or replace function private.kitchen_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.kitchen_touch() from public, anon, authenticated;

-- A record of a signed-off production day is not changed until the day is reopened.
create or replace function private.kitchen_day_locked(p_production uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.kitchen_productions p where p.id = p_production and p.verified_at is not null);
$$;
revoke all on function private.kitchen_day_locked(uuid) from public, anon;
grant execute on function private.kitchen_day_locked(uuid) to authenticated;

create or replace function private.kitchen_child_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
begin
  if coalesce(v_row->>'source', 'app') = 'app'
     and ((v_row->>'production_id' is not null and private.kitchen_day_locked((v_row->>'production_id')::uuid))
       or (v_old->>'production_id' is not null and private.kitchen_day_locked((v_old->>'production_id')::uuid))) then
    raise exception 'KITCHEN_DAY_VERIFIED' using errcode = '42501', hint = 'The production day is signed off; reopen it first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.kitchen_child_guard() from public, anon, authenticated;

create or replace function private.kitchen_require_action(p_source text, p_status text, p_action text)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if coalesce(p_source, 'app') = 'app' and p_status = 'out' and length(btrim(coalesce(p_action, ''))) < 3 then
    raise exception 'KITCHEN_CORRECTIVE_ACTION_REQUIRED' using errcode = '23514', hint = 'An entry out of limits needs a corrective action.';
  end if;
end;
$$;

create or replace function private.kitchen_receipt_rules()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_key text;
  v_nonconforming boolean;
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := 'PAR-' || lpad((coalesce((select max(substring(r.code from '^PAR-([0-9]+)$')::integer) from public.kitchen_receipts r where r.organization_id = new.organization_id), 0) + 1)::text, 4, '0');
  end if;
  v_key := case new.temperature_class when 'frozen' then 'receipt_frozen' when 'hot' then 'receipt_hot' when 'chilled' then 'receipt_chilled' else null end;
  new.temperature_status := case when v_key is null then null else private.kitchen_check(new.organization_id, v_key, new.measured_temperature) end;
  if new.temperature_status = 'out' and new.temperature_check is null then new.temperature_check := 'noncompliant'; end if;
  v_nonconforming := 'noncompliant' in (coalesce(new.temperature_check, ''), coalesce(new.packaging_check, ''), coalesce(new.expiry_check, ''), coalesce(new.vehicle_check, ''), coalesce(new.coding_check, ''))
    or new.temperature_status = 'out'
    or exists (select 1 from public.kitchen_receipt_items i where i.receipt_id = new.id and (i.temperature_status = 'out' or not i.accepted));
  new.limit_status := case when v_nonconforming then 'out'
    when coalesce(new.temperature_check, new.packaging_check, new.expiry_check, new.vehicle_check, new.coding_check, new.temperature_status) is not null then 'in' else null end;
  new.result := case when new.accepted is false then 'rejected'
    when new.accepted is null then 'pending'
    when v_nonconforming then 'accepted_with_remarks' else 'accepted' end;
  if coalesce(new.source, 'app') = 'app' and new.limit_status = 'out'
     and length(btrim(coalesce(new.corrective_action, ''))) < 3 and length(btrim(coalesce(new.quality_notes, ''))) < 3 then
    raise exception 'KITCHEN_CORRECTIVE_ACTION_REQUIRED' using errcode = '23514', hint = 'A nonconforming receipt needs a note or a corrective action.';
  end if;
  return new;
end;
$$;
revoke all on function private.kitchen_receipt_rules() from public, anon, authenticated;

create or replace function private.kitchen_receipt_item_rules()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_storage text;
begin
  v_storage := coalesce(new.storage, (select p.storage from public.kitchen_products p where p.id = new.product_id));
  new.storage := v_storage;
  new.temperature_status := case v_storage when 'frozen' then private.kitchen_check(new.organization_id, 'receipt_frozen', new.temperature)
    when 'chilled' then private.kitchen_check(new.organization_id, 'receipt_chilled', new.temperature) else null end;
  return new;
end;
$$;
revoke all on function private.kitchen_receipt_item_rules() from public, anon, authenticated;

-- The receipt's overall result follows its items.
create or replace function private.kitchen_receipt_item_refresh()
returns trigger language plpgsql set search_path = ''
as $$
begin
  update public.kitchen_receipts r set updated_at = now()
  where r.id = case when tg_op = 'DELETE' then old.receipt_id else new.receipt_id end;
  return null;
end;
$$;
revoke all on function private.kitchen_receipt_item_refresh() from public, anon, authenticated;

-- A batch is used only while it is in stock, not expired and not rejected (in the app).
create or replace function private.kitchen_usage_rules()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_item record;
  v_remaining numeric;
begin
  if new.receipt_item_id is not null then
    select i.product_id, i.product_name, i.unit, i.expiry_on, i.lot_label, i.batch_code, s.in_stock, s.remaining_quantity
      into v_item
    from public.kitchen_receipt_items i join public.kitchen_stock s on s.receipt_item_id = i.id
    where i.id = new.receipt_item_id;
    if found then
      new.product_id := coalesce(new.product_id, v_item.product_id);
      new.lot_label := coalesce(new.lot_label, v_item.lot_label, v_item.batch_code);
      if coalesce(new.source, 'app') = 'app' then
        if not v_item.in_stock then
          raise exception 'KITCHEN_BATCH_REJECTED' using errcode = '23514';
        end if;
        if v_item.expiry_on is not null and v_item.expiry_on < new.used_on then
          raise exception 'KITCHEN_BATCH_EXPIRED' using errcode = '23514';
        end if;
        v_remaining := v_item.remaining_quantity + case when tg_op = 'UPDATE' and old.receipt_item_id = new.receipt_item_id then coalesce(old.quantity, 0) else 0 end;
        if coalesce(new.quantity, 0) > v_remaining + 0.0005 then
          raise exception 'KITCHEN_STOCK_INSUFFICIENT' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.kitchen_usage_rules() from public, anon, authenticated;

create or replace function private.kitchen_thermal_rules()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.cooking_status := private.kitchen_check(new.organization_id, 'cooking_core', new.cooking_temp);
  new.chill_status := private.kitchen_check(new.organization_id, 'chilling', new.chill_temp, new.chill_minutes);
  new.reheat_status := private.kitchen_check(new.organization_id, 'reheating', new.reheat_temp);
  -- A frying value up to 120 °C is the food's core (cooking limit); above, the oil.
  new.frying_status := case when new.frying_temp is null then null
    when new.frying_temp <= 120 then private.kitchen_check(new.organization_id, 'cooking_core', new.frying_temp)
    else private.kitchen_check(new.organization_id, 'frying_oil', new.frying_temp) end;
  new.limit_status := private.kitchen_worst(new.cooking_status, new.chill_status, new.reheat_status, new.frying_status);
  perform private.kitchen_require_action(new.source, new.limit_status, new.corrective_action);
  return new;
end;
$$;
revoke all on function private.kitchen_thermal_rules() from public, anon, authenticated;

create or replace function private.kitchen_pureeing_rules()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.limit_status := case when new.visual_check is false or new.blade_check is false then 'out'
    when new.visual_check or new.blade_check then 'in' else null end;
  perform private.kitchen_require_action(new.source, new.limit_status, new.corrective_action);
  return new;
end;
$$;
revoke all on function private.kitchen_pureeing_rules() from public, anon, authenticated;

-- Signed-off rows: only manage_kitchen signs or reopens; a reopen needs a reason;
-- a signed row is not changed.
create or replace function private.kitchen_signoff_guard(p_org uuid, p_old_at timestamptz, p_new_at timestamptz, p_changed boolean, p_reason text)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_old_at is distinct from p_new_at and auth.uid() is not null
     and not public.current_user_has_capability(p_org, 'manage_kitchen') then
    raise exception 'KITCHEN_SIGNOFF_FORBIDDEN' using errcode = '42501';
  end if;
  if p_old_at is not null and p_new_at is null and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'KITCHEN_REOPEN_REASON_REQUIRED' using errcode = '23514';
  end if;
  if p_old_at is not null and p_new_at is not null and p_changed then
    raise exception 'KITCHEN_RECORD_VERIFIED' using errcode = '42501', hint = 'Reopen the record before changing it.';
  end if;
end;
$$;
revoke all on function private.kitchen_signoff_guard(uuid, timestamptz, timestamptz, boolean, text) from public, anon;
grant execute on function private.kitchen_signoff_guard(uuid, timestamptz, timestamptz, boolean, text) to authenticated;

create or replace function private.kitchen_defrost_rules()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_minutes numeric := case when new.ended_at is not null then extract(epoch from (new.ended_at - new.started_at)) / 60 end;
begin
  new.limit_status := private.kitchen_check(new.organization_id, 'defrost', new.end_temp, v_minutes);
  if tg_op = 'UPDATE' then
    perform private.kitchen_signoff_guard(new.organization_id, old.verified_at, new.verified_at,
      (to_jsonb(new) - array['verified_at','verified_by','verified_by_employee_id','verified_by_name','reopen_reason','updated_at','limit_status'])
        is distinct from (to_jsonb(old) - array['verified_at','verified_by','verified_by_employee_id','verified_by_name','reopen_reason','updated_at','limit_status']),
      new.reopen_reason);
  elsif new.verified_at is not null and coalesce(new.source, 'app') = 'app' then
    perform private.kitchen_signoff_guard(new.organization_id, null, new.verified_at, false, null);
  end if;
  perform private.kitchen_require_action(new.source, new.limit_status, new.corrective_action);
  return new;
end;
$$;
revoke all on function private.kitchen_defrost_rules() from public, anon, authenticated;

create or replace function private.kitchen_production_rules()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    perform private.kitchen_signoff_guard(new.organization_id, old.verified_at, new.verified_at,
      (to_jsonb(new) - array['verified_at','verified_by','verified_by_employee_id','verified_by_name','verification_notes','reopen_reason','updated_at'])
        is distinct from (to_jsonb(old) - array['verified_at','verified_by','verified_by_employee_id','verified_by_name','verification_notes','reopen_reason','updated_at']),
      new.reopen_reason);
  end if;
  return new;
end;
$$;
revoke all on function private.kitchen_production_rules() from public, anon, authenticated;

create or replace trigger trg_kitchen_receipts_rules before insert or update on public.kitchen_receipts for each row execute function private.kitchen_receipt_rules();
create or replace trigger trg_kitchen_receipts_touch before update on public.kitchen_receipts for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_receipt_items_rules before insert or update on public.kitchen_receipt_items for each row execute function private.kitchen_receipt_item_rules();
create or replace trigger trg_kitchen_receipt_items_touch before update on public.kitchen_receipt_items for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_receipt_items_refresh after insert or update or delete on public.kitchen_receipt_items for each row execute function private.kitchen_receipt_item_refresh();
create or replace trigger trg_kitchen_usage_rules before insert or update on public.kitchen_material_usage for each row execute function private.kitchen_usage_rules();
create or replace trigger trg_kitchen_usage_guard before insert or update or delete on public.kitchen_material_usage for each row execute function private.kitchen_child_guard();
create or replace trigger trg_kitchen_usage_touch before update on public.kitchen_material_usage for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_thermal_rules before insert or update on public.kitchen_thermal_processes for each row execute function private.kitchen_thermal_rules();
create or replace trigger trg_kitchen_thermal_guard before insert or update or delete on public.kitchen_thermal_processes for each row execute function private.kitchen_child_guard();
create or replace trigger trg_kitchen_thermal_touch before update on public.kitchen_thermal_processes for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_pureeing_rules before insert or update on public.kitchen_pureeing for each row execute function private.kitchen_pureeing_rules();
create or replace trigger trg_kitchen_pureeing_guard before insert or update or delete on public.kitchen_pureeing for each row execute function private.kitchen_child_guard();
create or replace trigger trg_kitchen_pureeing_touch before update on public.kitchen_pureeing for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_defrosting_rules before insert or update on public.kitchen_defrosting for each row execute function private.kitchen_defrost_rules();
create or replace trigger trg_kitchen_defrosting_touch before update on public.kitchen_defrosting for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_productions_rules before update on public.kitchen_productions for each row execute function private.kitchen_production_rules();
create or replace trigger trg_kitchen_productions_touch before update on public.kitchen_productions for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_products_touch before update on public.kitchen_products for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_menus_touch before update on public.kitchen_menus for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_limits_touch before update on public.kitchen_limits for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_haccp_steps_touch before update on public.kitchen_haccp_steps for each row execute function private.kitchen_touch();
create or replace trigger trg_kitchen_settings_touch before update on public.kitchen_settings for each row execute function private.kitchen_touch();

-- 7. Row-level security -------------------------------------------------------------------
-- Read: view / record / manage. Records (receipts, usage, processes, defrosts, days,
-- meals, write-offs, products): record or manage. Limits, HACCP plan, settings, menus:
-- manage. Delete: manage.

do $policies$
declare
  t text;
  v_read text := '(select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs(''view''))::uuid[])';
  v_record text := '(select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs(''record''))::uuid[])';
  v_manage text := '(select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_kitchen_orgs(''manage''))::uuid[])';
begin
  foreach t in array array['kitchen_settings','kitchen_limits','kitchen_haccp_steps','kitchen_products','kitchen_menus','kitchen_receipts','kitchen_receipt_items','kitchen_stock_writeoffs','kitchen_productions','kitchen_production_meals','kitchen_material_usage','kitchen_thermal_processes','kitchen_pureeing','kitchen_defrosting'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_read', t, v_read);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    if t in ('kitchen_settings','kitchen_limits','kitchen_haccp_steps','kitchen_menus') then
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, v_manage);
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, v_manage, v_manage);
    else
      execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, v_record);
      execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, v_record, v_record);
    end if;
    -- A record of the day's work may be removed by whoever records it (a wrong line);
    -- the receipt itself, the catalogue and the plan only by the manager.
    if t in ('kitchen_receipt_items','kitchen_production_meals','kitchen_material_usage') then
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, v_record);
    else
      execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, v_manage);
    end if;
  end loop;
end;
$policies$;

revoke all on public.kitchen_stock from anon;
grant select on public.kitchen_stock to authenticated;

-- 8. Defaults for every organization --------------------------------------------------------

create or replace function private.kitchen_seed_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.kitchen_settings (organization_id) values (p_organization_id) on conflict (organization_id) do nothing;
  insert into public.kitchen_limits (organization_id, limit_key, label, min_value, max_value, within_minutes)
  select p_organization_id, d.limit_key, d.label, d.min_value, d.max_value, d.within_minutes from private.kitchen_default_limits() d
  on conflict (organization_id, limit_key) do nothing;
  if not exists (select 1 from public.kitchen_haccp_steps s where s.organization_id = p_organization_id) then
    insert into public.kitchen_haccp_steps (organization_id, position, step_key, name, hazard_biological, hazard_chemical, hazard_physical, hazard_allergen, hazards, is_ccp, control_measure, limit_key, monitoring, frequency, corrective_action, verification, records, responsible)
    values
      (p_organization_id, 1, 'receipt', 'Παραλαβή πρώτων υλών', true, true, true, true, 'Ανάπτυξη μικροβίων από σπασμένη ψυχρή αλυσίδα, ληγμένα ή αλλοιωμένα προϊόντα, ξένα σώματα, ελλιπής επισήμανση αλλεργιογόνων.', true, 'Εγκεκριμένοι προμηθευτές· έλεγχος οχήματος, θερμοκρασίας, συσκευασίας, λήξης και κωδικοποίησης σε κάθε παραλαβή.', 'receipt_chilled', 'Θερμόμετρο διείσδυσης ή υπέρυθρο σε ψυχόμενα και κατεψυγμένα· οπτικός έλεγχος.', 'Κάθε παραλαβή', 'Απόρριψη ή διαχωρισμός της παρτίδας, ενημέρωση προμηθευτή, μη συμμόρφωση προμηθευτή.', 'Εβδομαδιαία ανασκόπηση των παραλαβών από τον υπεύθυνο κουζίνας.', 'Παραλαβές, αρχεία προμηθευτή.', 'Υπεύθυνος παραλαβής'),
      (p_organization_id, 2, 'storage_chilled', 'Αποθήκευση σε ψύξη', true, false, false, false, 'Ανάπτυξη μικροβίων σε θερμοκρασία πάνω από 5 °C.', false, 'Ψυκτικοί θάλαμοι ≤ 5 °C, διαχωρισμός ωμών και μαγειρεμένων, FIFO.', null, 'Θερμοκρασία θαλάμων (Έλεγχοι).', 'Δύο φορές την ημέρα', 'Μεταφορά των προϊόντων, αξιολόγηση ή απόρριψη, κλήση συντήρησης.', 'Μηνιαίος έλεγχος των θερμομέτρων.', 'Έλεγχοι θερμοκρασίας ψυγείων.', 'Μάγειρας βάρδιας'),
      (p_organization_id, 3, 'storage_frozen', 'Αποθήκευση σε κατάψυξη', true, false, false, false, 'Απόψυξη και επαναψύξη από βλάβη.', false, 'Καταψύκτες ≤ −18 °C, ημερομηνία κατάψυξης στη συσκευασία.', null, 'Θερμοκρασία καταψυκτών (Έλεγχοι).', 'Δύο φορές την ημέρα', 'Αξιολόγηση των προϊόντων, απόρριψη όσων αποψύχθηκαν.', 'Μηνιαίος έλεγχος των θερμομέτρων.', 'Έλεγχοι θερμοκρασίας καταψυκτών.', 'Μάγειρας βάρδιας'),
      (p_organization_id, 4, 'defrosting', 'Απόψυξη', true, false, false, false, 'Πολλαπλασιασμός μικροβίων στην επιφάνεια κατά την απόψυξη.', true, 'Απόψυξη στο ψυγείο (ή σε τρεχούμενο νερό / φούρνο μικροκυμάτων για άμεσο μαγείρεμα), όχι σε θερμοκρασία δωματίου.', 'defrost', 'Θερμοκρασία και ώρα στην αρχή και στο τέλος.', 'Κάθε απόψυξη', 'Επέκταση του χρόνου στο ψυγείο ή απόρριψη αν ξεπεράστηκε ο χρόνος / η θερμοκρασία.', 'Επαλήθευση HACCP κάθε απόψυξης από τον υπεύθυνο.', 'Αποψύξεις.', 'Μάγειρας'),
      (p_organization_id, 5, 'preparation', 'Προετοιμασία', true, true, true, true, 'Επιμόλυνση από χέρια, επιφάνειες, σκεύη· διασταυρούμενη επιμόλυνση αλλεργιογόνων.', false, 'Υγιεινή χεριών, χρωματική κωδικοποίηση επιφανειών κοπής, καθαρισμός και απολύμανση.', null, 'Οπτικός έλεγχος.', 'Κάθε βάρδια', 'Επανακαθαρισμός, εκπαίδευση προσωπικού.', 'Επιθεωρήσεις υγιεινής.', 'Πρόγραμμα καθαρισμού.', 'Υπεύθυνος κουζίνας'),
      (p_organization_id, 6, 'disinfection', 'Απολύμανση λαχανικών και φρούτων', true, true, true, false, 'Παθογόνα στην επιφάνεια ωμών λαχανικών και φρούτων· υπολείμματα απολυμαντικού.', true, 'Πλύσιμο και εμβάπτιση σε εγκεκριμένο απολυμαντικό στη σωστή συγκέντρωση και χρόνο, ξέβγαλμα.', null, 'Συγκέντρωση και χρόνος επαφής.', 'Κάθε ημέρα παραγωγής', 'Επανάληψη της απολύμανσης.', 'Ημερήσια επαλήθευση της ημέρας.', 'Παραγωγή ημέρας (απολύμανση).', 'Μάγειρας'),
      (p_organization_id, 7, 'cooking', 'Μαγείρεμα', true, false, false, false, 'Επιβίωση παθογόνων (Salmonella, Listeria, Campylobacter).', true, 'Μαγείρεμα ώσπου ο πυρήνας να φτάσει τουλάχιστον 75 °C.', 'cooking_core', 'Θερμόμετρο διείσδυσης στον πυρήνα του πιο χοντρού κομματιού.', 'Κάθε παρτίδα φαγητού', 'Συνέχιση του μαγειρέματος ώσπου να φτάσει το όριο· απόρριψη αν δεν είναι δυνατό.', 'Ημερήσια επαλήθευση, βαθμονόμηση θερμομέτρων.', 'Θερμικές επεξεργασίες.', 'Μάγειρας'),
      (p_organization_id, 8, 'chilling', 'Ψύξη μαγειρεμένου', true, false, false, false, 'Βλάστηση σπόρων (Clostridium perfringens, Bacillus cereus) κατά την αργή ψύξη.', true, 'Ταχεία ψύξη (blast chiller) ώστε ο πυρήνας να πέσει στους 10 °C μέσα σε 2 ώρες.', 'chilling', 'Θερμοκρασία πυρήνα και χρόνος στον ψύκτη.', 'Κάθε παρτίδα που ψύχεται', 'Απόρριψη αν δεν έφτασε το όριο στον χρόνο.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (ψύξη).', 'Μάγειρας'),
      (p_organization_id, 9, 'reheating', 'Αναθέρμανση', true, false, false, false, 'Επιβίωση μικροβίων που αναπτύχθηκαν μετά το μαγείρεμα.', true, 'Αναθέρμανση ώσπου ο πυρήνας να φτάσει τουλάχιστον 75 °C, μία φορά.', 'reheating', 'Θερμόμετρο διείσδυσης.', 'Κάθε αναθέρμανση', 'Συνέχιση ώσπου να φτάσει το όριο· απόρριψη αν δεν είναι δυνατό.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (αναθέρμανση).', 'Μάγειρας'),
      (p_organization_id, 10, 'frying', 'Τηγάνισμα', true, true, false, false, 'Ακρυλαμίδιο και πολικές ενώσεις από υπερθέρμανση ή παλιό λάδι· άψητο εσωτερικό.', false, 'Λάδι έως 180 °C, αλλαγή λαδιού κατά πρόγραμμα· πυρήνας ≥ 75 °C.', 'frying_oil', 'Θερμοκρασία λαδιού / πυρήνα.', 'Κάθε τηγάνισμα', 'Ρύθμιση θερμοκρασίας, αλλαγή λαδιού.', 'Ημερήσια επαλήθευση.', 'Θερμικές επεξεργασίες (τηγάνισμα).', 'Μάγειρας'),
      (p_organization_id, 11, 'pureeing', 'Πολτοποίηση / σούρωμα', true, false, true, false, 'Επιμόλυνση από το μηχάνημα· ξένα σώματα από φθαρμένη λεπίδα.', false, 'Καθαρό και απολυμασμένο μηχάνημα, έλεγχος λεπίδας πριν και μετά, οπτικός έλεγχος του πολτού.', null, 'Οπτικός έλεγχος, έλεγχος λεπίδας.', 'Κάθε πολτοποίηση', 'Απόρριψη του πολτού, αντικατάσταση της λεπίδας.', 'Ημερήσια επαλήθευση.', 'Πολτοποιήσεις.', 'Μάγειρας'),
      (p_organization_id, 12, 'serving', 'Διανομή', true, false, true, true, 'Ανάπτυξη μικροβίων σε θερμοκρασία μεταξύ 5 και 63 °C· λάθος δίαιτα / αλλεργιογόνο.', false, 'Ζεστά ≥ 63 °C, κρύα ≤ 5 °C, ετικέτα δίαιτας στον δίσκο.', null, 'Θερμοκρασία στη διανομή (Έλεγχοι).', 'Κάθε γεύμα', 'Αναθέρμανση ή απόρριψη, διόρθωση του δίσκου.', 'Μηνιαία επιθεώρηση.', 'Έλεγχοι διανομής.', 'Υπεύθυνος διανομής');
  end if;
end;
$$;
revoke all on function private.kitchen_seed_defaults(uuid) from public, anon, authenticated;

select private.kitchen_seed_defaults(o.id) from public.organizations o;

comment on table public.kitchen_receipts is 'Κουζίνα: παραλαβή από προμηθευτή (έλεγχοι, αποδοχή). FileMaker: Paralaves.';
comment on table public.kitchen_receipt_items is 'Κουζίνα: προϊόν / παρτίδα μιας παραλαβής, το απόθεμα. FileMaker: Paralaves_Products.';
comment on table public.kitchen_productions is 'Κουζίνα: ημέρα παραγωγής (μενού, απολύμανση, επαλήθευση). FileMaker: KitchenPlan.';
comment on table public.kitchen_material_usage is 'Κουζίνα: παρτίδα που χρησιμοποιήθηκε σε παραγωγή. FileMaker: Kitchen_UsedMaterial.';
comment on table public.kitchen_thermal_processes is 'Κουζίνα: μαγείρεμα, ψύξη, αναθέρμανση, τηγάνισμα. FileMaker: Kitchen_ThermalProcess.';
comment on table public.kitchen_pureeing is 'Κουζίνα: πολτοποίηση / σούρωμα. FileMaker: Kitchen_Poltopoiisi.';
comment on table public.kitchen_defrosting is 'Κουζίνα: απόψυξη με επαλήθευση HACCP. FileMaker: Kitchen_DEFROZE.';
comment on table public.kitchen_menus is 'Κουζίνα: τυπικά μενού. FileMaker: KitchenMenu.';
