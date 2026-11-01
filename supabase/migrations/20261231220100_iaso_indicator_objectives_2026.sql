-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: οι στόχοι της «Εικόνας νοσοκομείου» ως στόχοι πάνω στους δείκτες της πλατφόρμας (2026).
-- Ο υπάρχων στόχος «Εκπαίδευση προσωπικού τουλάχιστον 70%» (QO-2026-016) μετριέται πια από τον δείκτη ολοκλήρωσης
-- εκπαίδευσης· προστίθενται η υγιεινή χεριών όλου του προσωπικού (70%, όπως οι στόχοι νοσηλευτών και ιατρών)
-- και η πλήρης συμμόρφωση στις δέσμες μέτρων (90%). Μόνο εφόσον λείπουν (επαναλήψιμο).
do $$
declare org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
begin
  if not exists (select 1 from public.organizations where id = org) then return; end if;

  update public.quality_objectives set platform_indicator_key = 'training-completion', level = 'hospital'
   where organization_id = org and code = 'QO-2026-016' and platform_indicator_key is null and register_id is null;

  if not exists (select 1 from public.quality_objectives where organization_id = org and year = 2026 and platform_indicator_key = 'hh-compliance') then
    insert into public.quality_objectives (organization_id, code, year, level, title, platform_indicator_key, target, direction, unit, owner_label, due_date, status)
    values (org, (select 'QO-2026-' || lpad((coalesce(max(substring(code from 'QO-2026-(\d+)')::int), 0) + 1)::text, 3, '0') from public.quality_objectives where organization_id = org and code like 'QO-2026-%'),
            2026, 'hospital', 'Υγιεινή χεριών όλου του προσωπικού τουλάχιστον 70%', 'hh-compliance', 70, 'higher', '%', 'Επιτροπή Λοιμώξεων', '2026-12-31', 'active');
  end if;

  if not exists (select 1 from public.quality_objectives where organization_id = org and year = 2026 and platform_indicator_key = 'bundle-compliance') then
    insert into public.quality_objectives (organization_id, code, year, level, title, platform_indicator_key, target, direction, unit, owner_label, due_date, status)
    values (org, (select 'QO-2026-' || lpad((coalesce(max(substring(code from 'QO-2026-(\d+)')::int), 0) + 1)::text, 3, '0') from public.quality_objectives where organization_id = org and code like 'QO-2026-%'),
            2026, 'hospital', 'Πλήρης συμμόρφωση στις δέσμες μέτρων τουλάχιστον 90%', 'bundle-compliance', 90, 'higher', '%', 'Επιτροπή Λοιμώξεων', '2026-12-31', 'active');
  end if;
end $$;
