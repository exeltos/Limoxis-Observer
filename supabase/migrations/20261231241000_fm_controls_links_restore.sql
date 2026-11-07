-- ΙΑΣΩ Θεσσαλίας, 6/11/2026: οι εκτελέσεις ελέγχων του FileMaker δεν περνούσαν από τις 2/11.
--  1. Ο νυχτερινός συγχρονισμός σταματούσε όλος όταν έλειπαν οι συνδέσεις των τμημάτων (private.fm_org() γύριζε null):
--     το νοσοκομείο του συγχρονισμού παίρνεται πλέον και από τους πίνακες του FileMaker.
--  2. Είχαν χαθεί οι συνδέσεις «έλεγχος FileMaker → έλεγχος τμήματος» (fm_stage_links, Controls): ξαναφτιάχτηκαν για 216
--     από τους 278 ελέγχους, από τις εκτελέσεις που είχαν ήδη περάσει (129) ή από όνομα + τμήμα (87, χωρίς αμφισημίες).
--     Μετά ο συγχρονισμός πέρασε 744 εκτελέσεις (2–6/11). Οι 62 χωρίς αντιστοίχιση (κυρίως «Έλεγχος Ναρκωτικών» και
--     αναισθησιολογικά μηχανήματα με άλλο όνομα) περιμένουν απόφαση.
create or replace function private.fm_org()
 returns uuid
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(
    (select d.organization_id from public.fm_stage_links l join public.departments d on d.id = l.target_id
      where l.base_table = 'Departments' and l.target_table = 'departments' limit 1),
    (select t.organization_id from public.fm_stage_tables t where t.organization_id is not null limit 1))
$function$;
