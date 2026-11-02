select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
-- ΙΑΣΩ: ετήσιος στόχος νοσοκομείου για τη διατροφή, δίπλα στον QO-2026-011 (ικανοποίηση ασθενών ≥90%).
insert into quality_objectives (organization_id, code, year, level, title, platform_indicator_key, target, direction, unit, owner_label, due_date, status, created_by)
select '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd', 'QO-2026-029', 2026, 'hospital', 'Ικανοποίηση από τη διατροφή τουλάχιστον 90%', 'food-satisfaction', '90', 'higher', '%', 'ΤΣΙΟΥΤΣΙΟΣ ΓΕΩΡΓΙΟΣ', '2026-12-31', 'active', '84066ee0-57b7-4cae-9186-09e491d3ea6d'
where exists (select 1 from organizations where id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd')
  and exists (select 1 from auth.users where id = '84066ee0-57b7-4cae-9186-09e491d3ea6d')
  and not exists (select 1 from quality_objectives where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and code = 'QO-2026-029');
