-- Δείκτες μητρώων ΙΑΣΩ (έλεγχος 2/11/2026, εγκρίθηκε από τον ιδιοκτήτη «ναι σε όλα»):
-- Αιμοδυναμικό (REG-005): «Ασθενείς» → «Πράξεις» (μία καρτέλα = μία πράξη)· «% με αγγειοπλαστική» → αγγειοπλαστικές προς
--   στεφανιογραφίες (41/121 αντί για 41/153 με τους βηματοδότες)· νέοι δείκτες πλήθους: ηλεκτροφυσιολογικές μελέτες, απινιδωτές.
-- ΤΕΠ (REG-007): νέος δείκτης πλήθους «Αλλαγές τραυμάτων» (δεν μπαίνει στο σύνολο περιστατικών).
-- Οι δείκτες που στηρίζονται σε πεδία που δεν συμπληρώθηκαν ποτέ γράφουν «Δεν καταγράφεται» (στον κώδικα, registerEngine).
do $$
declare
  org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  cath uuid; ed uuid; share_id uuid;
begin
  if not exists (select 1 from public.organizations where id = org) then return; end if;
  select id into cath from public.department_registers where organization_id = org and code = 'REG-005' and table_name = 'register_cathlab_68dec235';
  select id into ed from public.department_registers where organization_id = org and code = 'REG-007' and table_name = 'register_emergency_f6ceb2a5';

  if cath is not null then
    update public.department_register_indicators set title_el = 'Πράξεις', title_en = 'Procedures' where register_id = cath and key = 'patients';

    select id into share_id from public.department_register_indicators where register_id = cath and key = 'angioplasty_share';
    if share_id is not null then
      update public.department_register_indicators
         set title_el = '% αγγειοπλαστικής στις στεφανιογραφίες', title_en = '% angioplasty among coronary angiographies',
             note_el = 'Αγγειοπλαστικές προς στεφανιογραφίες· οι βηματοδότες και οι άλλες πράξεις δεν μπαίνουν στον παρονομαστή.',
             note_en = 'Angioplasties over coronary angiographies; pacemakers and other procedures are not in the denominator.'
       where id = share_id;
      if not exists (select 1 from public.department_register_indicator_filters where indicator_id = share_id and part = 'denominator') then
        insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
        values (org, cath, share_id, 'denominator', 0, 'procedures', 'eq', 'angiography');
      end if;
    end if;

    with v(key, pos, el, en, val) as (values
      ('ep_studies', 11, 'Ηλεκτροφυσιολογικές μελέτες', 'Electrophysiology studies', 'ep_study'),
      ('icds', 12, 'Απινιδωτές (ICD)', 'Defibrillators (ICD)', 'icd')),
    ins as (
      insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, denominator_rows, direction, archived, daily_only)
      select org, cath, v.key, v.pos, v.el, v.en, 'count', '{}', '{}', 'context', false, false from v
       where not exists (select 1 from public.department_register_indicators i where i.register_id = cath and i.key = v.key)
      returning id, key)
    insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
    select org, cath, ins.id, 'numerator', 0, 'procedures', 'eq', v.val from ins join v on v.key = ins.key;
  end if;

  if ed is not null and not exists (select 1 from public.department_register_indicators where register_id = ed and key = 'dressings') then
    insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, sheet_rows, denominator_rows, direction, archived, daily_only, note_el, note_en)
    values (org, ed, 'dressings', 9, 'Αλλαγές τραυμάτων', 'Wound dressings', 'sum', array['dressings'], '{}', 'context', false, false,
            'Δεν περιλαμβάνονται στο σύνολο περιστατικών.', 'Not part of the total cases.');
  end if;
end
$$;
