-- FileMaker migration, step 2: a profile of each staged table, field by field,
-- for the review before anything moves into Limoxis: how often a field is
-- filled, how many different values it has and, for list-like fields only, which
-- ones. Free text and fields that name or identify a person never show values.
-- Closed to browser roles like the staging tables.

create table if not exists public.fm_stage_profile (
  base_table text not null references public.fm_stage_tables(base_table) on delete cascade,
  field text not null,
  records integer not null,
  filled integer not null,
  distinct_values integer not null,
  personal boolean not null default false,
  kinds jsonb,
  top_values jsonb,
  min_text text,
  max_text text,
  max_length integer,
  profiled_at timestamptz not null default now(),
  primary key (base_table, field)
);
comment on table public.fm_stage_profile is 'FileMaker migration: per-field statistics of a staged table, for the review.';
alter table public.fm_stage_profile enable row level security;
revoke all on public.fm_stage_profile from public, anon, authenticated;

create or replace function private.fm_stage_profile_table(p_table text)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare
  v_records integer;
  v_fields integer;
begin
  select count(*) into v_records from public.fm_stage_records where base_table = p_table;
  delete from public.fm_stage_profile where base_table = p_table;
  insert into public.fm_stage_profile (base_table, field, records, filled, distinct_values, personal, kinds, top_values, min_text, max_text, max_length)
  with cells as (
    select e.key as field, e.value as v, jsonb_typeof(e.value) as kind,
      case when jsonb_typeof(e.value) = 'string' then nullif(btrim(e.value #>> '{}'), '') when jsonb_typeof(e.value) in ('number', 'boolean') then e.value #>> '{}' end as t
    from public.fm_stage_records r, jsonb_each(r.data) e
    where r.base_table = p_table and e.key not in ('ROWID', 'ROWMODID')
  ), stats as (
    select field,
      count(t) as filled,
      count(distinct t) as distinct_values,
      -- A field that names or identifies a person, or holds free text, never shows values.
      field ~* '(onom|eponym|name|amka|ΑΜΚΑ|ΑΦΜ|afm|τηλ|phone|mobile|email|mail|διευθ|address|πατρ|μητρ|birth|γενν|ασθεν|patient|σχολ|comment|note|παρατηρ|περιγραφ|descr|text|κειμ|ΟΝΟΜ|ΕΠΩΝ|password|user|account|χρηστ)' as personal,
      jsonb_object_agg(coalesce(kind, 'null'), 1) filter (where kind is not null) as kinds,
      min(t) as min_text, max(t) as max_text, max(length(t)) as max_length,
      min(t::numeric) filter (where kind = 'number') as min_num, max(t::numeric) filter (where kind = 'number') as max_num
    from cells group by field
  )
  select p_table, s.field, v_records, s.filled, s.distinct_values, s.personal, s.kinds,
    case when not s.personal and s.distinct_values between 1 and 40 then (
      select jsonb_agg(jsonb_build_object('value', left(x.t, 60), 'count', x.n) order by x.n desc)
      from (select c.t, count(*) n from cells c where c.field = s.field and c.t is not null group by c.t order by count(*) desc limit 15) x) end,
    -- The range only for numbers and dates: a free-text field never shows its first or last value.
    case when s.personal then null when s.kinds - 'null' = '{"number": 1}'::jsonb then s.min_num::text when s.min_text ~ '^\d{4}-\d\d-\d\d' then left(s.min_text, 40) end,
    case when s.personal then null when s.kinds - 'null' = '{"number": 1}'::jsonb then s.max_num::text when s.max_text ~ '^\d{4}-\d\d-\d\d' then left(s.max_text, 40) end,
    s.max_length
  from stats s;
  get diagnostics v_fields = row_count;
  return v_fields;
end;
$function$;
revoke all on function private.fm_stage_profile_table(text) from public, anon, authenticated;
