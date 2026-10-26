-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: σβήνονται οι έλεγχοι ναρκωτικών από όλα τα τμήματα, με όλες τις καταγραφές τους
-- (απόφαση του ιδιοκτήτη, 26/10/2026). Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete).
--   FM-CTRL-0123 «Έλεγχος ναρκωτικών · λήξεις» (12 τμήματα)
--   FM-CTRL-0114 «Έλεγχος ναρκωτικών · ποσότητα» (Αιμοδυναμικό)
-- Μαζί σβήνονται οι αντιστοιχίσεις, οι καταγραφές, οι διορθώσεις τους και τα πρόχειρα. Άλλοι έλεγχοι δεν αγγίζονται.
-- Όλο το αρχείο είναι ένα μπλοκ: αν οποιοσδήποτε έλεγχος αποτύχει, δεν αλλάζει τίποτα.

do $$
declare
  v_org constant uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  v_ids uuid[];
  v_codes text[];
  v_definitions bigint; v_executions bigint; v_doomed_executions bigint; v bigint;
begin
  select array_agg(id), array_agg(code) into v_ids, v_codes
  from public.control_definitions
  where organization_id = v_org and code in ('FM-CTRL-0123', 'FM-CTRL-0114') and title ilike '%ναρκωτικών%';
  if coalesce(array_length(v_ids, 1), 0) <> 2 then
    raise exception 'Βρέθηκαν % έλεγχοι ναρκωτικών αντί για 2', coalesce(array_length(v_ids, 1), 0);
  end if;

  select count(*) into v_definitions from public.control_definitions where organization_id = v_org;
  select count(*) into v_executions from public.control_executions where organization_id = v_org;
  select count(*) into v_doomed_executions from public.control_executions where control_id = any(v_ids);

  delete from public.control_executions where control_id = any(v_ids);
  delete from public.control_drafts where organization_id = v_org and control_id = any(v_codes);
  delete from public.control_definitions where id = any(v_ids);

  select count(*) into v from public.control_definitions where organization_id = v_org;
  if v <> v_definitions - 2 then raise exception 'Έμειναν % έλεγχοι αντί για %', v, v_definitions - 2; end if;
  select count(*) into v from public.control_executions where organization_id = v_org;
  if v <> v_executions - v_doomed_executions then raise exception 'Σβήστηκαν λάθος καταγραφές'; end if;

  raise notice 'Έγινε: έλεγχοι % → %, σβήστηκαν % καταγραφές', v_definitions, v_definitions - 2, v_doomed_executions;
end $$;
