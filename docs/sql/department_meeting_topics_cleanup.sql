-- Συναντήσεις τμημάτων: καθαρισμός μετά τη μεταφορά των θεμάτων του FileMaker.
-- Τρέχει ο ιδιοκτήτης στο SQL Editor του Supabase (περιέχει delete).
--
-- ΒΗΜΑ 1 — Οι 264 «αποφάσεις» που έγιναν ήδη θέματα (migration 20261231140000):
-- υπάρχουν πια ως θέματα με το ίδιο id, οπότε σβήνονται από τις αποφάσεις.
begin;
delete from public.quality_department_meeting_decisions d
where exists (select 1 from public.quality_department_meeting_topics t where t.id = d.id);
-- Έλεγχος: πρέπει να μείνουν μόνο οι ανοιχτές του FileMaker (76) και 2 χειρόγραφες αποφάσεις.
select status, count(*) from public.quality_department_meeting_decisions group by status;
commit;

-- ΒΗΜΑ 2 — Οι 76 «ανοιχτές» του FileMaker (λίστα στο docs/sql/department_meeting_open_topics.md).
-- Είναι κι αυτές θέματα συζήτησης· τρέξτε το μόνο αφού τις δείτε.
-- begin;
-- insert into public.quality_department_meeting_topics (id, organization_id, meeting_id, position, subject)
-- select d.id, d.organization_id, d.meeting_id, d.position, d.title
-- from public.quality_department_meeting_decisions d
-- where d.status = 'open' and d.owner_label is null and d.due_date is null and d.capa_id is null
--   and exists (select 1 from public.fm_stage_links l where l.target_table = 'quality_department_meeting_decisions' and l.target_id = d.id)
-- on conflict (id) do nothing;
-- update public.fm_stage_links l set target_table = 'quality_department_meeting_topics'
-- where l.target_table = 'quality_department_meeting_decisions'
--   and exists (select 1 from public.quality_department_meeting_topics t where t.id = l.target_id);
-- delete from public.quality_department_meeting_decisions d
-- where exists (select 1 from public.quality_department_meeting_topics t where t.id = d.id);
-- commit;
