-- Codex 23/11/2026 (#695): οι 3 έλεγχοι που δημιουργήθηκαν από το FileMaker (`20261231634000`) πήραν created_at = σήμερα,
-- οπότε οι εκτελέσεις τους πριν από σήμερα (π.χ. φιάλη οξυγόνου 6/11) έμεναν εκτός ημερολογίου και τήρησης
-- (`private.control_execution_marks` μετρά από greatest(p_from, created_at)). Η ημερομηνία έναρξης γίνεται η ημερομηνία
-- δημιουργίας τους στο FileMaker (CreationTimestamp), όπως στους υπόλοιπους ελέγχους FM-CTRL-…
update public.control_definitions def
   set created_at = (c.data->>'CreationTimestamp')::timestamptz
  from public.fm_stage_links l
  join public.fm_stage_records c on c.base_table = 'Controls' and c.record_id = l.record_id
  join public.control_assignments a on a.id = l.target_id
 where l.base_table = 'Controls' and l.note = 'created from FileMaker (23/11/2026)'
   and def.id = a.control_id
   and def.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
   and def.code in ('FM-CTRL-0011', 'FM-CTRL-1242', 'FM-CTRL-1380')
   and c.data->>'CreationTimestamp' is not null;
