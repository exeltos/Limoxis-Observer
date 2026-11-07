-- ΙΑΣΩ Θεσσαλίας, 7/11/2026 (απόφαση ιδιοκτήτη): οι Απεικονίσεις και το Αναισθησιολογικό δεν κάνουν ελέγχους το
-- Σαββατοκύριακο. Οι ημερήσιοι έλεγχοί τους (11 και 8) γίνονται «Μόνο εργάσιμες (Δευτέρα–Παρασκευή)»: Σάββατο και Κυριακή
-- δεν μετρούν στην τήρηση. Η Παθολογική μένει όπως είναι. Εφαρμόστηκε στη βάση ως δεδομένα· ο νυχτερινός συγχρονισμός
-- μόνο διαβάζει το frequency_config.
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.control_assignments a
  set frequency_config = coalesce(a.frequency_config, def.frequency_config) || '{"weekdaysOnly":true}'::jsonb
  from public.control_definitions def, public.departments dep
  where def.id = a.control_id and dep.id = a.department_id
    and a.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
    and dep.name in ('Απεικονίσεις', 'Αναισθησιολογικό')
    and a.status = 'scheduled'
    and coalesce(a.frequency_config, def.frequency_config)->>'kind' = 'daily';
end $$;
