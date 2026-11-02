-- Συναντήσεις τμημάτων ΙΑΣΩ: οι «αποφάσεις» του FileMaker είναι θέματα συζήτησης.
-- Τρέχει ο ιδιοκτήτης στο SQL Editor του Supabase (περιέχει delete). Μία συναλλαγή, ασφαλές να
-- ξανατρέξει (δεν διπλογράφει). Σβήνει ΜΟΝΟ αποφάσεις που έχουν ήδη γίνει θέμα και δεν έχουν
-- υπεύθυνο, προθεσμία ή διορθωτική ενέργεια· οι πραγματικές αποφάσεις μένουν.
begin;

-- 1) Οι «ανοιχτές» αποφάσεις του FileMaker (χωρίς υπεύθυνο, προθεσμία, διορθωτική) γίνονται θέματα.
--    (Οι 264 «ολοκληρωμένες» έγιναν ήδη θέματα με το migration 20261231140000 και έχουν ήδη σβηστεί από τις αποφάσεις· εδώ έρχονται οι 70 «ανοιχτές».)
insert into public.quality_department_meeting_topics (id, organization_id, meeting_id, position, subject)
select d.id, d.organization_id, d.meeting_id, d.position, d.title
from public.quality_department_meeting_decisions d
where d.owner_label is null and d.due_date is null and d.capa_id is null and d.carried_from is null
  and exists (select 1 from public.fm_stage_links l where l.target_table = 'quality_department_meeting_decisions' and l.target_id = d.id)
on conflict (id) do nothing;

-- 2) Ο ωριαίος συγχρονισμός να μην τις ξαναφέρει ως αποφάσεις.
update public.fm_stage_links l set target_table = 'quality_department_meeting_topics'
where l.target_table = 'quality_department_meeting_decisions'
  and exists (select 1 from public.quality_department_meeting_topics t where t.id = l.target_id);

-- 3) Αφαίρεση των διπλών «αποφάσεων» (ίδιο id με θέμα, χωρίς υπεύθυνο/προθεσμία/διορθωτική).
delete from public.quality_department_meeting_decisions d
where d.owner_label is null and d.due_date is null and d.capa_id is null
  and exists (select 1 from public.quality_department_meeting_topics t where t.id = d.id);

-- Έλεγχος πριν το commit (τιμές σήμερα): topics = 334 (264 + 70), decisions_left = 2 (δύο χειρόγραφες αποφάσεις χωρίς FileMaker).
select (select count(*) from public.quality_department_meeting_topics) topics,
       (select count(*) from public.quality_department_meeting_decisions) decisions_left,
       (select count(*) from public.quality_department_meeting_decisions where status = 'open') open_left;

commit;
