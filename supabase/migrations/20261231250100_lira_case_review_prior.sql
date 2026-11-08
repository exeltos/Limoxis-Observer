-- «Κρίση κρούσματος» στη διερεύνηση επιδημίας (8/11/2026): η πολιτική εισαγωγής κοιτούσε τον ίδιο της τον πίνακα
-- (την προηγούμενη κρίση που αντικαθίσταται) και σταματούσε με «infinite recursion». Ο έλεγχος γίνεται εδώ χωρίς RLS·
-- η αλλαγή της πολιτικής είναι στο 20261231250101 (τρέχει ο ιδιοκτήτης).
create or replace function private.lira_case_review_supersedes_ok(p_prior uuid, p_investigation uuid, p_record_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_prior is null or exists (
    select 1 from public.lira_outbreak_case_reviews prior
    where prior.id = p_prior and prior.investigation_id = p_investigation and prior.record_key = p_record_key
  )
$$;

grant execute on function private.lira_case_review_supersedes_ok(uuid, uuid, text) to authenticated;
