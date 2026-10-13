-- Effectiveness of an opportunity's action plan as a fixed status; the
-- effectiveness column keeps the free-text note. A row without a status is
-- read from the start of its note («Προς αξιολόγηση…», «Αποτελεσματικό…»).
alter table public.quality_risk_opportunities add column if not exists effectiveness_status text
  check (effectiveness_status in ('effective','partial','ineffective','pending'));
