-- Επτά ακόμη στόχοι στους δείκτες των μητρώων του ΙΑΣΩ Θεσσαλίας (εγκρίθηκαν από τον ιδιοκτήτη).
-- Ενημερώνει μόνο όπου ο στόχος είναι κενός· ο δείκτης VBAC παίρνει και κατεύθυνση (καλύτερα όσο ανεβαίνει).
do $$
declare
  org uuid;
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then
    return;
  end if;

  update public.department_register_indicators i
  set target = v.target, direction = v.direction
  from (values
    ('REG-001', 'mean_ventilator', 5::numeric, 'lower'),
    ('REG-001', 'mean_cpap', 7, 'lower'),
    ('REG-002', 'mortality_scored', 15, 'lower'),
    ('REG-002', 'mean_ventilator_hours', 96, 'lower'),
    ('REG-003', 'weaning', 10, 'lower'),
    ('REG-004', 'vbac_rate', 10, 'higher'),
    ('REG-010', 'mean_los', 3, 'lower')
  ) as v(register_code, indicator_key, target, direction)
  join public.department_registers r on r.organization_id = org and r.code = v.register_code
  where i.register_id = r.id and i.key = v.indicator_key and i.target is null;
end $$;
