-- Στόχοι στους δείκτες των μητρώων τμημάτων του ΙΑΣΩ Θεσσαλίας (εγκρίθηκαν από τον ιδιοκτήτη).
-- Ενημερώνει μόνο το πεδίο target και μόνο όπου είναι κενό· οι πληροφοριακοί δείκτες μένουν χωρίς στόχο.
-- Όπου υπάρχει στόχος ποιότητας 2026 για τον ίδιο δείκτη, η τιμή είναι η ίδια.
do $$
declare
  org uuid;
begin
  select id into org from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ';
  if org is null then
    return;
  end if;

  update public.department_register_indicators i
  set target = v.target
  from (values
    ('REG-001', 'mortality', 2::numeric),
    ('REG-001', 'readmissions', 5),
    ('REG-001', 'late_infection_rate', 5),
    ('REG-001', 'breast_milk', 50),
    ('REG-001', 'no_breast_milk', 15),
    ('REG-001', 'mean_los', 14),
    ('REG-002', 'readmissions_48h', 5),
    ('REG-002', 'pressure_ulcers', 5),
    ('REG-002', 'mortality', 15),
    ('REG-002', 'mean_icu_days', 5),
    ('REG-003', 'exclusive_bf', 60),
    ('REG-003', 'antenatal', 50),
    ('REG-004', 'cs_rate', 50),
    ('REG-005', 'complications', 2),
    ('REG-010', 'readmissions', 5),
    ('REG-010', 'hai', 2),
    ('REG-010', 'picu', 3),
    ('REG-010', 'falls', 0)
  ) as v(register_code, indicator_key, target)
  join public.department_registers r on r.organization_id = org and r.code = v.register_code
  where i.register_id = r.id and i.key = v.indicator_key and i.target is null;
end $$;
