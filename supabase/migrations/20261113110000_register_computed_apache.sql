-- Computed register field: APACHE II predicted mortality (%) from the score
-- band (0–4, 5–9 … 35+) and whether the admission is post-operative (Knaus 1985).
alter table public.department_register_fields drop constraint if exists department_register_fields_computed_kind_check;
alter table public.department_register_fields add constraint department_register_fields_computed_kind_check
  check (computed_kind in ('days','age_days','age_years','apache_ii'));

create or replace function private.register_column_sql(f public.department_register_fields)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
begin
  case f.field_type
    when 'number' then return 'numeric';
    when 'date' then return 'date';
    when 'yes_no' then return 'boolean';
    when 'choice' then return 'text';
    when 'multi_choice' then return 'text[]';
    when 'gestation' then return 'integer check (' || quote_ident(f.key) || ' between 0 and 400)';
    when 'text' then return 'text';
    when 'computed' then
      if f.computed_kind = 'age_years' then
        return format('integer generated always as (case when %2$I >= %1$I then date_part(''year'', age(%2$I::timestamp, %1$I::timestamp))::integer end) stored', f.computed_from, f.computed_to);
      end if;
      if f.computed_kind = 'apache_ii' then
        return format('integer generated always as (case when %1$I is null or %2$I is null then null
          when %2$I then (array[1,3,7,12,30,35,73,88])[least(8, greatest(1, floor(%1$I / 5)::integer + 1))]
          else (array[4,8,15,25,40,55,75,85])[least(8, greatest(1, floor(%1$I / 5)::integer + 1))] end) stored', f.computed_from, f.computed_to);
      end if;
      return format('integer generated always as (case when %2$I >= %1$I then %2$I - %1$I end) stored', f.computed_from, f.computed_to);
    else raise exception 'Unknown field type %', f.field_type;
  end case;
end;
$function$;
