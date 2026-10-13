-- Risk assessment (Ε.Δ.ΔΙΑΧ.090, NHS NPSA 5×5 matrix) in the Quality Center.
--
-- An assessment is one period (a year, a semester, …) with its register of
-- risks and of opportunities. Each risk is scored three times — inherent,
-- residual (with the existing controls) and target (after the additional
-- measures) — as likelihood (L) × consequence (C), 1–5 each. The scores are
-- generated columns so that the database and the screen never disagree; the
-- level (1–3 / 4–6 / 8–12 / 15–25) is derived from the score where it is shown.
-- A risk keeps its lineage key when an assessment is carried forward, which is
-- how one risk is followed from period to period.
--
-- Access mirrors the CAPA register: hospital administrators, quality managers
-- and infection control leads read; hospital administrators and quality
-- managers write. Custom roles and the quality-access add-on go through
-- current_user_has_capability (20261013074528_quality_risk_assessments_access.sql).
--
-- A CAPA opened from a risk uses the existing source type 'other' with
-- source_id 'RISK:<risk id>', so the CAPA table is not altered.

create table if not exists public.quality_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  period_label text not null,
  period_kind text not null default 'annual' check (period_kind in ('annual','semester','quarter','other')),
  assessed_on date not null,
  next_review_on date,
  assessor_label text,
  form_code text,
  scope_note text,
  status text not null default 'draft' check (status in ('draft','under_review','approved','archived')),
  approved_by_label text,
  approved_on date,
  source_assessment_id uuid references public.quality_risk_assessments(id) on delete set null,
  history jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists quality_risk_assessments_org_date_idx on public.quality_risk_assessments (organization_id, assessed_on desc);

create table if not exists public.quality_risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assessment_id uuid not null,
  lineage_key text not null,
  position integer not null default 0,
  section text not null default 'clinical' check (section in ('clinical','general')),
  process text,
  scope text,
  hazard text not null,
  inherent_l smallint check (inherent_l between 1 and 5),
  inherent_c smallint check (inherent_c between 1 and 5),
  inherent_score smallint generated always as (inherent_l * inherent_c) stored,
  existing_controls text,
  residual_l smallint check (residual_l between 1 and 5),
  residual_c smallint check (residual_c between 1 and 5),
  residual_score smallint generated always as (residual_l * residual_c) stored,
  consequence_rationale text,
  additional_measures text,
  owner_label text,
  due_date date,
  review_frequency text,
  indicator text,
  target_l smallint check (target_l between 1 and 5),
  target_c smallint check (target_c between 1 and 5),
  target_score smallint generated always as (target_l * target_c) stored,
  jci_chapter text,
  jci_reference text,
  prioritized boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A risk always belongs to an assessment of its own organization.
  foreign key (assessment_id, organization_id) references public.quality_risk_assessments(id, organization_id) on delete cascade,
  unique (assessment_id, lineage_key)
);
create index if not exists quality_risks_assessment_idx on public.quality_risks (assessment_id, position);
create index if not exists quality_risks_org_lineage_idx on public.quality_risks (organization_id, lineage_key);

create table if not exists public.quality_risk_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  assessment_id uuid not null,
  position integer not null default 0,
  activity text not null,
  opportunity text,
  rating text,
  action_plan text,
  timeframe text,
  owner_label text,
  effectiveness text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assessment_id, organization_id) references public.quality_risk_assessments(id, organization_id) on delete cascade
);
create index if not exists quality_risk_opportunities_assessment_idx on public.quality_risk_opportunities (assessment_id, position);

create or replace trigger trg_quality_risk_assessments_touch_updated_at before update on public.quality_risk_assessments for each row execute function public.touch_updated_at();
create or replace trigger trg_quality_risks_touch_updated_at before update on public.quality_risks for each row execute function public.touch_updated_at();
create or replace trigger trg_quality_risk_opportunities_touch_updated_at before update on public.quality_risk_opportunities for each row execute function public.touch_updated_at();

alter table public.quality_risk_assessments enable row level security;
alter table public.quality_risks enable row level security;
alter table public.quality_risk_opportunities enable row level security;
