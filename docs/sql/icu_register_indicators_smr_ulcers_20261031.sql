-- ΕΦΑΡΜΟΣΤΗΚΕ 31/10/2026 στον ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ (REG-002 «Μητρώο ασθενών ΜΕΘ», με ρητό ΟΚ του ιδιοκτήτη).
-- 1) «% με κατάκλιση»: μετριέται στον μήνα εξόδου (date_field_key = discharge_date), παρονομαστής μόνο όσοι βγήκαν.
-- 2) Νέος δείκτης «SMR (θνησιμότητα προς προβλεπόμενη)» μετά τη «Θνησιμότητα ασθενών με APACHE II» (χωρίς στόχο).
-- Προϋπόθεση: το constraint department_register_indicators_aggregation_check δέχεται 'smr' (docs/sql/register_indicator_smr.sql).
-- Σημ.: η έκδοση του μητρώου ανέβηκε και από το προηγούμενο script, που έτρεξε δύο φορές (το περιεχόμενο δεν διπλασιάστηκε).
do $$
declare
  rid uuid := '60811e65-5dc1-41f6-8bc0-bf51f2127425';
  org uuid; ulcer uuid; sid uuid; scored_pos integer;
begin
  select organization_id into org from public.department_registers where id = rid;
  if org is null then raise exception 'ICU register not found'; end if;
  select id into ulcer from public.department_register_indicators where register_id = rid and key = 'pressure_ulcers';
  update public.department_register_indicators set date_field_key = 'discharge_date', note_el = 'Μόνο όσοι βγήκαν, στον μήνα εξόδου.', note_en = 'Discharged patients only, in the month of discharge.' where id = ulcer;
  if not exists (select 1 from public.department_register_indicator_filters where indicator_id = ulcer and part = 'denominator') then
    insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value) values (org, rid, ulcer, 'denominator', 0, 'discharge_date', 'filled', null);
  end if;
  if not exists (select 1 from public.department_register_indicators where register_id = rid and key = 'smr') then
    select position into scored_pos from public.department_register_indicators where register_id = rid and key = 'mortality_scored';
    update public.department_register_indicators set position = position + 1 where register_id = rid and position > scored_pos;
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, field_key, date_field_key, direction, note_el, note_en)
    values (org, rid, 'smr', scored_pos + 1, 'SMR (θνησιμότητα προς προβλεπόμενη)', 'SMR (observed to predicted mortality)', 'smr', 'apache_mortality', 'discharge_date', 'lower',
      'Θάνατοι ÷ θάνατοι που προβλέπει το APACHE II. Κάτω από 1: λιγότεροι από τους αναμενόμενους. Χρειάζεται αρκετούς ασθενείς.', 'Deaths ÷ deaths predicted by APACHE II. Below 1: fewer than expected. Needs enough patients.')
    returning id into sid;
    insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value) values
      (org, rid, sid, 'numerator', 0, 'outcome', 'eq', 'death'),
      (org, rid, sid, 'denominator', 0, 'outcome', 'filled', null),
      (org, rid, sid, 'denominator', 1, 'apache_mortality', 'filled', null);
  end if;
  update public.department_registers set version = version + 1,
    history = coalesce(history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'actor', 'Ενημέρωση δεικτών ΜΕΘ (SMR, κατακλίσεις)', 'action', 'updated'))
  where id = rid;
end $$;
