-- Αίθουσα Τοκετών (ΙΑΣΩ, AUD-250515-800072): οι πρώτες 31 γραμμές έγιναν το βασικό ερωτηματολόγιο.
-- Οι υπόλοιπες 30 γραμμές του παλιού ερωτηματολογίου ISO 9001 αφαιρούνται εδώ.
-- Εκτελείται από τον ιδιοκτήτη στο SQL Editor (delete: δεν εκτελείται από τον agent).
delete from public.quality_audit_checklist_items c
using public.quality_audits a
where a.id = c.audit_id
  and a.code = 'AUD-250515-800072'
  and a.organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' and not is_demo)
  and c.position > 31;
