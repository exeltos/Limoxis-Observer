-- ΙΑΣΩ: όλες οι επιθεωρήσεις πήραν το βασικό ερωτηματολόγιο των 31 ερωτήσεων.
-- Σε δύο επιθεωρήσεις έμειναν περιττές γραμμές του παλιού ερωτηματολογίου ISO 9001 (θέση > 31):
-- Αίθουσα Τοκετών (30 γραμμές) και Αιμοδοσία (65 γραμμές). Αφαιρούνται εδώ.
-- Εκτελείται από τον ιδιοκτήτη στο SQL Editor (delete: δεν εκτελείται από τον agent).
delete from public.quality_audit_checklist_items c
using public.quality_audits a
where a.id = c.audit_id
  and a.organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' and not is_demo)
  and a.code in ('AUD-250515-800072', 'AUD-2611-5FBF67')
  and c.position > 31;
