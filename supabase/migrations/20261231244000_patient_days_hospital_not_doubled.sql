-- Κλινοημέρες (ιδιοκτήτης, 8/11/2026): τα τμήματα με δικές τους κλινοημέρες (ΜΕΘ, ΜΕΘ Παίδων, ΜΕΝΝ, Παιδιατρική)
-- καταχωρούνται στην ίδια περίοδο με το σύνολο του νοσοκομείου. Ο δείκτης του νοσοκομείου παίρνει το σύνολο του
-- νοσοκομείου (όχι σύνολο + τμήματα, που θα μετρούσε τις ημέρες δύο φορές)· μόνο όπου δεν υπάρχει σύνολο για την
-- περίοδο, το άθροισμα των τμημάτων. Ο δείκτης ενός τμήματος παίρνει μόνο τις κλινοημέρες του τμήματος.
do $$
declare
  def text;
  old text := 'and (p_department_id is null or pp.department_id=p_department_id)';
  new text := 'and (case when p_department_id is null then pp.department_id is null or not exists (select 1 from public.patient_day_periods h where h.organization_id=p_organization_id and h.department_id is null and h.period_start<=p_to and h.period_end>=p_from) else pp.department_id=p_department_id end)';
begin
  select pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure) into def;
  if position(old in def) > 0 then execute replace(def, old, new); end if;
end $$;
