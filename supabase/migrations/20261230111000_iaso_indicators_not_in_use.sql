-- ΙΑΣΩ Θεσσαλίας: οι κοινοί δείκτες χωρίς πηγή δεδομένων στο νοσοκομείο (εγκρίθηκε από τον ιδιοκτήτη) δεν είναι «σε χρήση»:
-- μένουν στον κατάλογο της Διαχείρισης, όχι στα «Δείκτες & Στόχοι». Επανέρχονται από τη Διαχείριση › Ορισμοί δεικτών.
insert into public.organization_indicator_settings (organization_id, indicator_key, enabled)
select o.id, d.indicator_key, false
from public.organizations o
join public.indicator_definitions d on d.organization_id is null and d.status = 'active'
where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
  and (d.indicator_key like 'amr-%' or d.indicator_key like 'mdr-isolation-%'
       or d.indicator_key in ('bundle-compliance', 'eody-reporting-completeness', 'hai-per-1000'))
on conflict (organization_id, indicator_key) do update set enabled = false, updated_at = now();
