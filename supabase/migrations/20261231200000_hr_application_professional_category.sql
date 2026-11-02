-- Συνεντεύξεις: ο υποψήφιος διαλέγει στο tablet μία κατηγορία από σταθερή λίστα
-- (nursing, medical, paramedical, administrative, technical, support, other).
-- Η υπάρχουσα hr_application_submit ξαναγράφεται όπως ήταν, με μία στήλη παραπάνω:
-- το κείμενο της συνάρτησης διαβάζεται από τη βάση και αλλάζουν μόνο δύο σημεία.
do $migration$
declare
  v_def text := pg_get_functiondef('public.hr_application_submit(text, jsonb)'::regprocedure);
  v_new text;
begin
  if position('professional_category' in v_def) > 0 then return; end if;
  v_new := replace(v_def, 'requested_position, employment_type,', 'requested_position, professional_category, employment_type,');
  v_new := replace(v_new, 'coalesce(v_link.requested_position, private.hr_app_t(v_p, ''requestedPosition'', 160)),',
    'coalesce(v_link.requested_position, private.hr_app_t(v_p, ''requestedPosition'', 160)),' || chr(10) ||
    '    case when v_p ->> ''professionalCategory'' in (''nursing'',''medical'',''paramedical'',''administrative'',''technical'',''support'',''other'') then v_p ->> ''professionalCategory'' end,');
  if v_new = v_def or position('professional_category' in v_new) = 0 or position('professionalCategory' in v_new) = 0 then
    raise exception 'hr_application_submit: the expected text was not found';
  end if;
  execute v_new;
end;
$migration$;
