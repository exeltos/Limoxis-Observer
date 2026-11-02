select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- Προεπιλεγμένοι στόχοι για τους δείκτες μικροβιολογίας που δεν είχαν: προσωρινοί, αλλάζουν από τον ορισμό κάθε δείκτη.
update indicator_definitions set target_value = '25', direction = 'lower' where organization_id is null and indicator_key like 'amr-%' and target_value is null;
update indicator_definitions set target_value = '1', direction = 'lower' where organization_id is null and indicator_key = 'bacteremia-incidence-rate' and target_value is null;
update indicator_definitions set target_value = '0.5', direction = 'lower' where organization_id is null and indicator_key like 'bacteremia-%-rate' and indicator_key <> 'bacteremia-incidence-rate' and target_value is null;
