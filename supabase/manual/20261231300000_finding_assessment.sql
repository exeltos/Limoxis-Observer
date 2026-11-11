-- Αποκλίσεις: απόφαση αξιολόγησης («Χρειάζεται διορθωτική ενέργεια;»).
-- Τρέξτε ΟΛΟ το αρχείο στο Supabase SQL Editor. Είναι μόνο προσθήκες· τίποτα από τα υπάρχοντα δεν αλλάζει
-- και μπορεί να τρέξει και δεύτερη φορά χωρίς πρόβλημα.

alter table public.quality_findings
  add column if not exists corrective_action_needed boolean,
  add column if not exists no_action_reason text,
  add column if not exists assessed_at timestamptz,
  add column if not exists assessed_by_label text;

comment on column public.quality_findings.corrective_action_needed is 'Assessment decision: true = a corrective action is needed, false = none is needed, null = not decided.';
comment on column public.quality_findings.no_action_reason is 'Why no corrective action is needed (required when corrective_action_needed is false).';
comment on column public.quality_findings.assessed_at is 'When the deviation was assessed.';
comment on column public.quality_findings.assessed_by_label is 'Who assessed the deviation.';

-- «Όχι» χρειάζεται αιτιολόγηση. Ισχύει μόνο για νέες εγγραφές/αλλαγές (not valid): οι παλιές δεν ελέγχονται.
alter table public.quality_findings
  drop constraint if exists quality_findings_no_action_reason_check;
alter table public.quality_findings
  add constraint quality_findings_no_action_reason_check
  check (corrective_action_needed is distinct from false or length(btrim(coalesce(no_action_reason, ''))) > 0) not valid;

-- Έλεγχος (μόνο ανάγνωση): πρέπει να δείξει 4 γραμμές και ότι όλες οι υπάρχουσες αποκλίσεις έχουν null απόφαση.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'quality_findings'
  and column_name in ('corrective_action_needed', 'no_action_reason', 'assessed_at', 'assessed_by_label')
order by column_name;

select count(*) as aποκλίσεις, count(corrective_action_needed) as με_απόφαση
from public.quality_findings;
