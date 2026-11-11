-- Αποκλίσεις: οι κλειστές αποκλίσεις που δεν έχουν διορθωτική ενέργεια παίρνουν την απόφαση
-- «Δεν χρειάζεται διορθωτική ενέργεια», ώστε να μη φαίνονται «Προς αξιολόγηση».
-- Τρέξτε ΟΛΟ το αρχείο στο Supabase SQL Editor (project Limoxis-Observer), ΑΦΟΥ έχει τρέξει το
-- 20261231300000_finding_assessment.sql. Αγγίζει μόνο όσες αποκλίσεις είναι κλειστές, δεν έχουν
-- (μη ακυρωμένη) διορθωτική ενέργεια και δεν έχουν ήδη απόφαση. Οι ανοιχτές δεν αλλάζουν.
-- Αναμενόμενο: 45 γραμμές. Ασφαλές να ξανατρέξει (δεύτερη φορά αλλάζει 0).

-- 1) Έλεγχος πριν (μόνο ανάγνωση): πόσες θα αλλάξουν.
select count(*) as θα_αλλάξουν
from public.quality_findings q
where q.status = 'closed'
  and q.corrective_action_needed is null
  and not exists (
    select 1 from public.quality_capa_actions c
    where c.source_type = 'finding' and c.lifecycle_status <> 'voided' and c.source_id = q.code);

-- 2) Η αλλαγή.
update public.quality_findings q
set corrective_action_needed = false,
    no_action_reason = 'Έκλεισε χωρίς διορθωτική ενέργεια',
    assessed_at = coalesce(q.assessed_at, now()),
    assessed_by_label = coalesce(nullif(q.assessed_by_label, ''), 'Μεταφορά δεδομένων')
where q.status = 'closed'
  and q.corrective_action_needed is null
  and not exists (
    select 1 from public.quality_capa_actions c
    where c.source_type = 'finding' and c.lifecycle_status <> 'voided' and c.source_id = q.code);

-- 3) Έλεγχος μετά (μόνο ανάγνωση): πρέπει να δείξει 45 με απόφαση «Όχι» και 0 κλειστές χωρίς απόφαση και χωρίς ενέργεια.
select
  count(*) filter (where corrective_action_needed = false) as με_απόφαση_όχι,
  count(*) filter (where status = 'closed' and corrective_action_needed is null
    and not exists (select 1 from public.quality_capa_actions c
      where c.source_type = 'finding' and c.lifecycle_status <> 'voided' and c.source_id = quality_findings.code)) as κλειστές_χωρίς_απόφαση_και_ενέργεια
from public.quality_findings;
