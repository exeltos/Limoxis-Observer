-- Supplier evaluation templates: a criterion may be optional («Άλλο»): it counts only when it is scored, and an
-- evaluation can be saved without it.
alter table public.quality_supplier_eval_template_criteria
  add column if not exists optional boolean not null default false;

comment on column public.quality_supplier_eval_template_criteria.optional is 'Counts only when scored (e.g. «Άλλο»); not required to save an evaluation.';

-- Applied on 2026-11-06 for ΙΑΣΩ Θεσσαλίας (data, not schema): the four templates follow the hospital's form
-- Ε.Δ.FS.130.Θ-01 «Αξιολόγηση εξωτερικών παρόχων»: nine criteria of equal weight (the ninth, «Άλλο», optional),
-- scale 1–5, approved from 3,5 (70%), no «conditional» band (conditional threshold = approval threshold);
-- the second criterion per kind of supplier. Each template's version went up by one.
