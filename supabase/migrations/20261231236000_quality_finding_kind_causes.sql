-- Deviations: what kind of deviation it is, the categories of its causes and the analysis, whether it recurs and
-- who reported it. The hospital's earlier register keeps all of these; the nightly sync fills them for new ones.
alter table public.quality_findings
  add column if not exists deviation_kind text
    check (deviation_kind is null or deviation_kind in ('breakdown', 'procedure', 'material', 'staff_behaviour', 'dispute',
      'loss', 'external_audit', 'risk_assessment', 'satisfaction', 'inspection', 'hotel_equipment', 'quality_control',
      'training_evaluation', 'other')),
  add column if not exists cause_categories text[] not null default '{}'::text[]
    check (cause_categories <@ array['human_error', 'procedure', 'material', 'method', 'equipment', 'measurement',
      'environment', 'supplier', 'other']::text[]),
  add column if not exists root_cause text,
  add column if not exists recurring boolean,
  add column if not exists reported_by_label text;

comment on column public.quality_findings.deviation_kind is 'Kind of deviation (breakdown, procedure not followed, unsuitable material, …).';
comment on column public.quality_findings.cause_categories is 'Categories of the causes (human error, procedure, material, method, equipment, measurement, environment, supplier, other).';
comment on column public.quality_findings.root_cause is 'The analysis of the causes.';
comment on column public.quality_findings.recurring is 'The deviation has happened before.';
comment on column public.quality_findings.reported_by_label is 'Who reported the deviation.';

-- The deviation's kind and causes as the earlier register writes them.
create or replace function private.fm_deviation_kind(p text)
returns text language sql immutable set search_path to '' as $$
  select case trim(coalesce(p, ''))
    when 'Βλάβη' then 'breakdown' when 'Μη Τήρηση Διαδικασίας' then 'procedure' when 'Ακατάλληλο Υλικό' then 'material'
    when 'Συμπεριφορά Προσωπικού' then 'staff_behaviour' when 'Διαπληκτισμός' then 'dispute' when 'Απώλεια Αντικειμένων' then 'loss'
    when 'Εξωτερική Επιθεώρηση' then 'external_audit' when 'Αξιολόγηση Κινδύνων' then 'risk_assessment'
    when 'Μέτρηση Ικανοποίησης' then 'satisfaction' when 'Επιθεώρηση / Έλεγχος' then 'inspection'
    when 'Ξενοδοχειακός Εξοπλισμός' then 'hotel_equipment' when 'Ποιοτικός Έλεγχος' then 'quality_control'
    when 'Αξιολόγηση Εκπαίδευσης' then 'training_evaluation' when '' then null else 'other' end
$$;

create or replace function private.fm_cause_categories(p text)
returns text[] language sql immutable set search_path to '' as $$
  select coalesce(array_agg(distinct key order by key), '{}'::text[]) from (
    select case trim(t)
      when 'Ανθρώπινο Λάθος' then 'human_error' when 'Μη τήρηση Διαδικασίας' then 'procedure' when 'Αστοχία Υλικού' then 'material'
      when 'Λάθος Μέθοδος' then 'method' when 'Αστοχία Εξοπλισμού' then 'equipment' when 'Λάθος Μέτρηση' then 'measurement'
      when 'Περιβαλλοντικές Συνθήκες' then 'environment' when 'Αστοχία Προμηθευτή' then 'supplier' else 'other' end as key
    from regexp_split_to_table(coalesce(p, ''), E'[\r\n]+') t where trim(t) <> ''
  ) keys
$$;

-- Each deviation of the earlier register (linked by fm_stage_links) fills what is still empty; a value set on the
-- platform is kept. Run once now, and every night by private.fm_sync_deviations().
create or replace function private.fm_fill_deviation_details()
returns integer language plpgsql security definer set search_path to '' as $fn$
declare v_count integer;
begin
  update public.quality_findings f set
    deviation_kind = coalesce(f.deviation_kind, private.fm_deviation_kind(r.data->>'Dev Origin Text')),
    cause_categories = case when f.cause_categories = '{}'::text[] then private.fm_cause_categories(r.data->>'Dev Cause Categories') else f.cause_categories end,
    root_cause = coalesce(f.root_cause, private.fm_text(r.data->>'Dev Cause Analysis')),
    recurring = coalesce(f.recurring, case when r.data->>'Dev repeat' ~ 'Ναι' then true when r.data->>'Dev repeat' ~ '[ΟΌ]χι' then false end),
    reported_by_label = coalesce(f.reported_by_label, private.fm_text(r.data->>'Dev Reported By')),
    owner_label = coalesce(nullif(f.owner_label, ''), coalesce(private.fm_text(r.data->>'Evaluator'), private.fm_text(r.data->>'Evaluator 2'), private.fm_text(r.data->>'Evaluator 3'))),
    owner_labels = case when coalesce(cardinality(f.owner_labels), 0) = 0
                          and coalesce(private.fm_text(r.data->>'Evaluator'), private.fm_text(r.data->>'Evaluator 2'), private.fm_text(r.data->>'Evaluator 3')) is not null
                        then array[coalesce(private.fm_text(r.data->>'Evaluator'), private.fm_text(r.data->>'Evaluator 2'), private.fm_text(r.data->>'Evaluator 3'))]
                        else f.owner_labels end
  from public.fm_stage_records r
  join public.fm_stage_links l on l.base_table = 'Deviations' and l.record_id = r.record_id and l.target_table = 'quality_findings'
  where r.base_table = 'Deviations' and f.id = l.target_id and f.organization_id = private.fm_org()
    and (f.deviation_kind is null or f.cause_categories = '{}'::text[] or f.root_cause is null or f.recurring is null
         or f.reported_by_label is null or coalesce(f.owner_label, '') = '');
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- private.fm_sync_deviations() calls private.fm_fill_deviation_details() before it returns (applied in place on
-- the function; see 20261231235000_fm_sync_deviations.sql for the rest of it).
-- Applied on 2026-11-06: private.fm_fill_deviation_details() filled 359 deviations of the earlier register, and
-- `perform private.fm_fill_deviation_details();` was added before the final `return v_count;` of
-- private.fm_sync_deviations().
