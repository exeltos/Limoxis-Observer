-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: σβήνονται οι έλεγχοι ΚΑΡΠΑ σε τμήματα που δεν τους είχαν στο FileMaker.
-- Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete).
--   Τροχήλατο ΚΑΡΠΑ (FM-CTRL-0145): ΜΕΝΝ, Ακτινοθεραπεία
--   Δίσκος διασωλήνωσης ενηλίκου (FM-CTRL-0066): IVF, Ενδοσκοπικό, Κέντρο Μαστού, Χειρουργεία, Ακτινοθεραπεία
-- Η Μονάδα Τεχνητού Νεφρού κρατά και τα δύο. Κανένας από τους 7 δεν έχει καταγραφή· αν έχει, δεν αλλάζει τίποτα.

begin;

create temp table doomed on commit drop as
select a.id
from public.control_assignments a
join public.control_definitions c on c.id = a.control_id
join public.departments d on d.id = a.department_id
where c.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
  and ((c.code = 'FM-CTRL-0145' and d.name in ('ΜΕΝΝ', 'Ακτινοθεραπεία'))
    or (c.code = 'FM-CTRL-0066' and d.name in ('IVF', 'Ενδοσκοπικό', 'Κέντρο Μαστού', 'Χειρουργεία', 'Ακτινοθεραπεία')));

do $$
declare v bigint;
begin
  select count(*) into v from doomed;
  if v <> 7 then raise exception 'Βρέθηκαν % αντιστοιχίσεις αντί για 7', v; end if;
  select count(*) into v from public.control_executions where assignment_id in (select id from doomed);
  if v <> 0 then raise exception '% καταγραφές δείχνουν σε αυτές τις αντιστοιχίσεις', v; end if;
end $$;

delete from public.control_assignments where id in (select id from doomed);

select c.code, c.title, string_agg(d.name, ', ' order by d.name) as τμηματα
from public.control_assignments a
join public.control_definitions c on c.id = a.control_id
join public.departments d on d.id = a.department_id
where c.code in ('FM-CTRL-0145', 'FM-CTRL-0066') and c.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
group by c.code, c.title;
commit;
