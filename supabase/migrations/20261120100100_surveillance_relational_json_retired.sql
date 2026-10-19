-- Infection surveillance, clinical assessment and laboratory records: part 2 of 2.
-- Part 1 (20261120100000_surveillance_relational.sql) copied every JSON value
-- into columns and rows of their own and the application reads and writes
-- those. This part retires the JSON:
--   1. organism rows: a shortened label now also removes the rows beyond it;
--      rows left behind by a shortened draft label before this part are removed,
--      and every result is checked against its label;
--   2. the immutability of validated results no longer looks at the organisms
--      JSON;
--   3. recycle-bin entries filed before this change are put in the new shape so
--      they can still be restored (no organisms key on results; an AMR
--      classification's snapshot becomes its mechanism, categories_tested and
--      category rows);
--   4. the *_legacy triggers and the JSON columns go;
--   5. a vaccination may be recorded without a known date (FileMaker records
--      vaccinations whose date nobody wrote down).

-- 1. Organisms ----------------------------------------------------------------------------

create or replace function private.microbiology_result_organisms_sync()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  delete from public.microbiology_result_organisms o
  where o.microbiology_result_id = new.id
    and o.position > (select count(*) from private.organism_list(new.organism));
  insert into public.microbiology_result_organisms(organization_id, microbiology_result_id, position, organism, created_by, created_at, updated_by, updated_at)
  select new.organization_id, new.id, o.ord, o.organism, coalesce(new.updated_by, new.created_by), now(), coalesce(new.updated_by, new.created_by), now()
  from private.organism_list(new.organism) o
  on conflict (microbiology_result_id, position) do update
    set organism = excluded.organism, updated_by = excluded.updated_by, updated_at = now()
    where public.microbiology_result_organisms.organism is distinct from excluded.organism;
  return null;
end;
$function$;

delete from public.microbiology_result_organisms o
using public.microbiology_results m
where m.id = o.microbiology_result_id
  and o.position > (select count(*) from private.organism_list(m.organism));

do $verify$
declare v_n bigint;
begin
  select count(*) into v_n from public.microbiology_results m
  where coalesce((select string_agg(o.organism, ', ' order by o.position) from public.microbiology_result_organisms o where o.microbiology_result_id = m.id), '')
        is distinct from coalesce((select string_agg(l.organism, ', ' order by l.ord) from private.organism_list(m.organism) l), '');
  if v_n > 0 then raise exception 'SURVEILLANCE_RELATIONAL_ORGANISMS_MISMATCH: % results', v_n; end if;
end
$verify$;

-- 2. Immutability of validated results ----------------------------------------------------------

create or replace function public.enforce_microbiology_result_immutability()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.validation_status in ('validated','amended') and (
    new.result_status is distinct from old.result_status or
    new.organism is distinct from old.organism or
    new.resistance_class is distinct from old.resistance_class or
    new.susceptibility_summary is distinct from old.susceptibility_summary or
    new.resulted_at is distinct from old.resulted_at or
    new.method is distinct from old.method or
    new.preliminary is distinct from old.preliminary or
    new.validation_status is distinct from old.validation_status or
    new.validated_by is distinct from old.validated_by or
    new.validated_at is distinct from old.validated_at or
    new.amended_from is distinct from old.amended_from or
    new.interpretation_standard is distinct from old.interpretation_standard or
    new.interpretation_version is distinct from old.interpretation_version or
    new.cfu_count is distinct from old.cfu_count or
    new.cfu_limit is distinct from old.cfu_limit or
    new.within_limit is distinct from old.within_limit
  ) then
    raise exception 'Validated microbiology results are immutable; create an amendment instead.' using errcode='23514';
  end if;
  return new;
end;
$function$;

-- 3. Recycle-bin entries in the earlier shape ----------------------------------------------------

with entries as (
  select b.id,
    (select jsonb_agg(part order by ord) from (
       -- An AMR classification's categories, restored after it (parts are in deletion order).
       select jsonb_build_object('table', 'amr_classification_categories', 'rows', (
                select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', gen_random_uuid(), 'organization_id', r->>'organization_id', 'amr_classification_id', r->>'id',
                  'susceptible', c.susceptible, 'position', c.ord, 'category', c.category, 'created_by', r->>'classified_by',
                  'created_at', coalesce(r->>'created_at', now()::text), 'updated_by', r->>'classified_by', 'updated_at', coalesce(r->>'created_at', now()::text))))
                from jsonb_array_elements(p.part->'rows') r
                cross join lateral (
                  select true as susceptible, e.ord, e.value #>> '{}' as category
                  from jsonb_array_elements(case when jsonb_typeof(r->'calculation_snapshot'->'susceptibleCategories') = 'array' then r->'calculation_snapshot'->'susceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
                  union all
                  select false, e.ord, e.value #>> '{}'
                  from jsonb_array_elements(case when jsonb_typeof(r->'calculation_snapshot'->'nonSusceptibleCategories') = 'array' then r->'calculation_snapshot'->'nonSusceptibleCategories' else '[]'::jsonb end) with ordinality e(value, ord)
                ) c)) as part, p.ord * 2 - 1 as ord
       from jsonb_array_elements(b.payload->'parts') with ordinality p(part, ord)
       where p.part->>'table' = 'amr_classifications'
         and exists (select 1 from jsonb_array_elements(p.part->'rows') r where jsonb_typeof(r->'calculation_snapshot') = 'object' and r->'calculation_snapshot' <> '{}'::jsonb)
       union all
       select case
           when p.part->>'table' = 'microbiology_results' then jsonb_set(p.part, '{rows}', (select jsonb_agg(r - 'organisms') from jsonb_array_elements(p.part->'rows') r))
           when p.part->>'table' = 'amr_classifications' then jsonb_set(p.part, '{rows}', (select jsonb_agg((r - 'calculation_snapshot') || jsonb_strip_nulls(jsonb_build_object(
               'mechanism', nullif(r->'calculation_snapshot'->>'mechanism', ''),
               'categories_tested', case when r->'calculation_snapshot'->>'categoriesTested' ~ '^\d+$' then (r->'calculation_snapshot'->>'categoriesTested')::integer end)))
             from jsonb_array_elements(p.part->'rows') r))
           else p.part end, p.ord * 2
       from jsonb_array_elements(b.payload->'parts') with ordinality p(part, ord)
     ) x) as parts
  from public.recycle_bin b
  where jsonb_typeof(b.payload->'parts') = 'array'
    and exists (select 1 from jsonb_array_elements(b.payload->'parts') p where p->>'table' in ('microbiology_results', 'amr_classifications'))
)
update public.recycle_bin b set payload = jsonb_set(b.payload, '{parts}', e.parts)
from entries e where e.id = b.id;

-- 4. The JSON goes ---------------------------------------------------------------------------------

drop trigger if exists trg_surveillance_events_legacy on public.surveillance_events;
drop trigger if exists trg_clinical_assessments_legacy on public.clinical_assessments;
drop trigger if exists trg_hai_classifications_legacy on public.hai_classifications;
drop trigger if exists trg_isolation_episodes_legacy on public.isolation_episodes;
drop trigger if exists trg_amr_classifications_legacy on public.amr_classifications;
drop function if exists private.surveillance_events_legacy();
drop function if exists private.clinical_assessments_legacy();
drop function if exists private.hai_classifications_legacy();
drop function if exists private.isolation_episodes_legacy();
drop function if exists private.amr_classifications_legacy();

alter table public.surveillance_events drop column if exists payload;
alter table public.clinical_assessments drop column if exists signs_symptoms, drop column if exists risk_factors;
alter table public.hai_classifications drop column if exists criteria_evidence;
alter table public.isolation_episodes drop column if exists precautions;
alter table public.microbiology_results drop column if exists organisms;
alter table public.amr_classifications drop column if exists calculation_snapshot;

-- 5. Vaccinations without a known date ---------------------------------------------------------------

alter table public.employee_vaccinations alter column vaccination_date drop not null;
comment on column public.employee_vaccinations.vaccination_date is 'When the vaccine was given; null when the record does not say.';

do $verify$
declare v_left text;
begin
  select string_agg(c.table_name || '.' || c.column_name, ', ') into v_left
  from information_schema.columns c
  where c.table_schema = 'public' and c.data_type in ('json', 'jsonb')
    and c.table_name in ('surveillance_cases','surveillance_events','clinical_assessments','clinical_assessment_findings','hai_classifications','hai_classification_criteria',
      'isolation_episodes','isolation_episode_precautions','microbiology_results','microbiology_result_organisms','amr_classifications','amr_classification_categories',
      'surveillance_case_infection_types','surveillance_surgical_procedures','surveillance_neonatal_details','antimicrobial_susceptibility_results','laboratory_samples');
  if v_left is not null then raise exception 'SURVEILLANCE_RELATIONAL_JSON_LEFT: %', v_left; end if;
end
$verify$;
