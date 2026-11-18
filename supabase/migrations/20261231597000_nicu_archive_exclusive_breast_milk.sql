-- ΜΕΝΝ (owner, 18/11/2026): «% με αποκλειστικά μητρικό γάλα» leaves the indicators. The register records only
-- whether breast milk was kept (yes/no), so it always read «Δεν καταγράφεται». Archived, not deleted, as the PICC ones.
update public.department_register_indicators set archived = true
where key = 'breast_milk' and archived is distinct from true
  and register_id in (select id from public.department_registers where template_key = 'nicu');
