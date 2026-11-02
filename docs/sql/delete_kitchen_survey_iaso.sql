-- ΙΑΣΩ: το «Ερωτηματολόγιο Κουζίνας» (SRV-2026-03) δεν χρειάζεται. Οι ερωτήσεις για το φαγητό είναι
-- η ενότητα «Διατροφή» μέσα στα ερωτηματολόγια των τμημάτων (SRV-2026-01 και SRV-2026-02).
-- Έχει 0 απαντήσεις. Το τρέχει ο ιδιοκτήτης στο SQL Editor (delete), μετά ελέγχεται με το select.
begin;
-- Το SQL Editor δεν έχει χρήστη: το audit της βάσης (private.audit_management_change) τον απαιτεί, γι' αυτό ορίζεται ο ιδιοκτήτης της πλατφόρμας μόνο για αυτή τη συναλλαγή.
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
delete from quality_surveys s
where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
  and s.code = 'SRV-2026-03'
  and not exists (select 1 from quality_survey_responses r where r.survey_id = s.id);
commit;

-- Έλεγχος (μόνο ανάγνωση): πρέπει να μείνουν 2 ερωτηματολόγια.
select code, title from quality_surveys where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' order by code;
