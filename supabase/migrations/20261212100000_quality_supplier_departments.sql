-- Quality → Suppliers: each supplier belongs to the departments that use it
-- (kitchen, laboratories, theatres…), and a department sees its own suppliers
-- with their evaluations and certificates (read only). The quality team still
-- reads and manages all of them.
--
-- quality_suppliers.department_ids        departments of the same hospital (the Quality
--                                          team edits it on the supplier).
-- quality_suppliers_department_read        a member scoped to one of those departments may
--                                          read the supplier (same scope list as equipment).
-- ..._evaluations / ..._certifications     readable when the supplier is (the sub-select
--                                          runs under the caller's own row-level security).
-- Backfill (ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ): from the FileMaker supplier groups (Προμήθειες Χειρουργείου /
-- Κουζίνας / Κ. Εργαστηρίων), matched to the supplier by name.

alter table public.quality_suppliers
  add column if not exists department_ids uuid[] not null default '{}';

create index if not exists quality_suppliers_department_ids_idx
  on public.quality_suppliers using gin (department_ids);

create policy quality_suppliers_department_read on public.quality_suppliers
  for select to authenticated
  using (
    exists (
      select 1 from unnest(department_ids) as d(id)
      where (organization_id::text || ':' || d.id::text) = any ((select private.current_user_department_scopes())::text[])
    )
  );

create policy quality_supplier_evaluations_department_read on public.quality_supplier_evaluations
  for select to authenticated
  using (exists (select 1 from public.quality_suppliers s where s.id = quality_supplier_evaluations.supplier_id));

create policy quality_supplier_certifications_department_read on public.quality_supplier_certifications
  for select to authenticated
  using (exists (select 1 from public.quality_suppliers s where s.id = quality_supplier_certifications.supplier_id));

-- Backfill from the FileMaker groups, only where nothing was chosen yet.
with org as (
  select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
),
norm as (
  select 'άέήίόύώϊϋΐΰΆΈΉΊΌΎΏ' as a, 'αεηιουωιυιυαεηιουω' as b
),
contacts as (
  select
    regexp_replace(lower(translate(trim(data->>'Contact Company Name'), (select a from norm), (select b from norm))), '[^[:alnum:]]', '', 'g') as k,
    data->>'All contact' as grp
  from public.fm_stage_records
  where base_table = 'Contacts' and nullif(data->>'All contact', '') is not null
),
target as (
  select s.id as supplier_id,
         array_agg(distinct d.id) as dept_ids
  from public.quality_suppliers s
  join org on org.id = s.organization_id
  join contacts c on c.k = regexp_replace(lower(translate(trim(s.name), (select a from norm), (select b from norm))), '[^[:alnum:]]', '', 'g')
  join public.departments d on d.organization_id = s.organization_id
    and d.name = case c.grp
      when 'Προμήθειες Χειρουργείου' then 'Χειρουργεία'
      when 'Προμήθειες Κουζίνας' then 'Κεντρική Κουζίνα'
      when 'Προμήθειες Κ. Εργαστηρίων' then 'Κεντρικά Εργαστήρια'
    end
  where s.department_ids = '{}'
  group by s.id
)
update public.quality_suppliers s
set department_ids = t.dept_ids
from target t
where s.id = t.supplier_id;

-- Those the FileMaker groups did not reach (names spelled differently): by their category.
update public.quality_suppliers s
set department_ids = array[d.id]
from public.organizations o, public.departments d
where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
  and s.organization_id = o.id
  and s.department_ids = '{}'
  and d.organization_id = o.id
  and d.name = case s.category when 'laboratory' then 'Κεντρικά Εργαστήρια' when 'kitchen' then 'Κεντρική Κουζίνα' end;
