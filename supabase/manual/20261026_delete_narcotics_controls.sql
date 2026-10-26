-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: σβήνονται οι έλεγχοι ναρκωτικών από όλα τα τμήματα, με όλες τις καταγραφές τους
-- (απόφαση του ιδιοκτήτη, 26/10/2026). Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete).
--   FM-CTRL-0123 «Έλεγχος ναρκωτικών · λήξεις» (12 τμήματα)
--   FM-CTRL-0114 «Έλεγχος ναρκωτικών · ποσότητα» (Αιμοδυναμικό)
-- Μαζί σβήνονται οι αντιστοιχίσεις, οι καταγραφές, οι διορθώσεις τους και τα πρόχειρα. Άλλοι έλεγχοι δεν αγγίζονται.
-- Αν οποιοσδήποτε έλεγχος αποτύχει, δεν αλλάζει τίποτα.

begin;

create temp table doomed on commit drop as
select id, code from public.control_definitions
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and code in ('FM-CTRL-0123', 'FM-CTRL-0114');

create temp table before_counts on commit drop as
select (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as definitions,
       (select count(*) from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as executions,
       (select count(*) from public.control_executions where control_id in (select id from doomed)) as doomed_executions;

do $$
declare v bigint;
begin
  select count(*) into v from doomed;
  if v <> 2 then raise exception 'Βρέθηκαν % έλεγχοι ναρκωτικών αντί για 2', v; end if;
  select count(*) into v from doomed d join public.control_definitions c on c.id = d.id where c.title not ilike '%ναρκωτικών%';
  if v <> 0 then raise exception 'Ένας από τους ελέγχους δεν είναι έλεγχος ναρκωτικών'; end if;
end $$;

delete from public.control_executions where control_id in (select id from doomed);
delete from public.control_drafts where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and control_id in (select code from doomed);
delete from public.control_definitions where id in (select id from doomed);

do $$
declare v_before record; v bigint;
begin
  select * into v_before from before_counts;
  select count(*) into v from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  if v <> v_before.definitions - 2 then raise exception 'Έμειναν % έλεγχοι αντί για %', v, v_before.definitions - 2; end if;
  select count(*) into v from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  if v <> v_before.executions - v_before.doomed_executions then raise exception 'Σβήστηκαν λάθος καταγραφές'; end if;
end $$;

select (select definitions from before_counts) as ελεγχοι_πριν,
       (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as ελεγχοι_μετα,
       (select doomed_executions from before_counts) as καταγραφες_που_σβηστηκαν;
commit;
