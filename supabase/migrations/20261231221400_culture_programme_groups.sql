-- Πρόγραμμα καλλιεργειών: οι καλλιέργειες που δεν ανήκουν σε ένα τμήμα (απόφαση ιδιοκτήτη 2/11/2026) μπαίνουν ως κατηγορίες:
-- προσωπικό, αέρας, νερό δικτύου. Κάθε κατηγορία είναι μία γραμμή του προγράμματος και «έγινε» όταν παρθεί δείγμα του είδους
-- της σε οποιοδήποτε τμήμα. Μόνο προσθήκη στήλης και συμπλήρωση για το ΙΑΣΩ.
alter table public.control_definitions add column if not exists culture_group text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'control_definitions_culture_group_check') then
    alter table public.control_definitions add constraint control_definitions_culture_group_check check (culture_group is null or culture_group in ('staff', 'air', 'network_water'));
  end if;
end
$$;

do $$
declare
  org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
begin
  if not exists (select 1 from public.organizations where id = org) then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.control_definitions c
     set culture_group = v.grp
    from (values ('FM-CTRL-0197', 'staff'), ('FM-CTRL-0196', 'air'), ('FM-CTRL-1371', 'network_water')) as v(code, grp)
   where c.organization_id = org and c.code = v.code and c.culture_group is null;
end
$$;
