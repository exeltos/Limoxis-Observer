-- Supplier evaluation templates by supplier category, contact persons, and the
-- details a migrated supplier brings (FileMaker «Contacts»).
--
-- quality_supplier_eval_templates            a template: which supplier categories it
--                                            applies to, the approval thresholds (%),
--                                            how often (months) and on which scale
--                                            (1–5, or 0–10 as FileMaker kept it).
-- quality_supplier_eval_template_criteria    its criteria in order, each with a weight.
-- quality_supplier_evaluations               + the template it used and a snapshot of
--                                            it (name, version, thresholds, scale), the
--                                            weighted result (%) and its verdict, and
--                                            whether the per-criterion scores exist.
-- quality_supplier_evaluation_scores         rebuilt (it holds no rows): a score row
--                                            points at its template criterion and keeps
--                                            the criterion's label and weight as they
--                                            were, so a later edit of the template does
--                                            not rewrite the evaluation. The six fixed
--                                            criteria of the earlier evaluations stay
--                                            valid (criterion in the old list, or none).
-- quality_supplier_contacts                  a supplier's contact persons.
-- quality_supplier_certifications            + title, kind of document and its file.
-- quality_suppliers                          + legal name, city, country, the recorded
--                                            approval decision, the evaluation frequency.
--
-- Reading: Quality (quality_read_orgs). Writing, templates included: Quality managers
-- (hospital administrator, quality manager, manage_quality: quality_manage_orgs),
-- as on the other supplier tables (20261116100000).

-- A. Templates -----------------------------------------------------------------------

create table if not exists public.quality_supplier_eval_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 1),
  description text,
  categories text[] not null default '{}',
  pass_threshold numeric(5,2) not null default 80 check (pass_threshold between 0 and 100),
  conditional_threshold numeric(5,2) not null default 60 check (conditional_threshold between 0 and 100),
  frequency_months smallint not null default 12 check (frequency_months between 1 and 60),
  score_scale smallint not null default 5 check (score_scale in (5, 10)),
  active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  source text not null default 'app' check (source in ('app', 'seed', 'filemaker')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint quality_supplier_eval_templates_thresholds check (conditional_threshold <= pass_threshold),
  unique (organization_id, name),
  unique (id, organization_id)
);
create index if not exists quality_supplier_eval_templates_org_idx on public.quality_supplier_eval_templates (organization_id, active);

create table if not exists public.quality_supplier_eval_template_criteria (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null,
  position smallint not null default 0 check (position >= 0),
  label text not null check (length(btrim(label)) > 0),
  description text,
  weight numeric(6,3) not null default 1 check (weight > 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (template_id, organization_id) references public.quality_supplier_eval_templates(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_eval_template_criteria_parent_idx on public.quality_supplier_eval_template_criteria (template_id, organization_id, position);
create index if not exists quality_supplier_eval_template_criteria_org_idx on public.quality_supplier_eval_template_criteria (organization_id);

-- B. Evaluations: the template and its snapshot ---------------------------------------

alter table public.quality_supplier_evaluations
  add column if not exists template_id uuid,
  add column if not exists template_name text,
  add column if not exists template_version integer,
  add column if not exists pass_threshold numeric(5,2) check (pass_threshold is null or pass_threshold between 0 and 100),
  add column if not exists conditional_threshold numeric(5,2) check (conditional_threshold is null or conditional_threshold between 0 and 100),
  add column if not exists score_scale smallint not null default 5 check (score_scale in (5, 10)),
  add column if not exists total_score numeric(5,2) check (total_score is null or total_score between 0 and 100),
  add column if not exists result text check (result is null or result in ('approved', 'conditional', 'rejected')),
  add column if not exists criteria_scores text not null default 'complete' check (criteria_scores in ('complete', 'partial', 'not_recorded')),
  add column if not exists period_year smallint check (period_year is null or period_year between 1990 and 2100),
  add column if not exists source text not null default 'app' check (source in ('app', 'filemaker'));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_supplier_evaluations_template_fkey') then
    alter table public.quality_supplier_evaluations add constraint quality_supplier_evaluations_template_fkey
      foreign key (template_id, organization_id) references public.quality_supplier_eval_templates(id, organization_id) on delete set null (template_id);
  end if;
end
$$;
create index if not exists quality_supplier_evaluations_template_idx on public.quality_supplier_evaluations (template_id, organization_id);

-- C. Scores, rebuilt --------------------------------------------------------------------
-- The table holds no rows anywhere (checked when this was written; the copy below
-- carries any that exist). The earlier table is kept, emptied of grants, as
-- quality_supplier_evaluation_scores_legacy; it is removed by hand later.

do $$
begin
  if to_regclass('public.quality_supplier_evaluation_scores') is not null
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quality_supplier_evaluation_scores' and column_name = 'criterion_id') then
    alter table public.quality_supplier_evaluation_scores rename to quality_supplier_evaluation_scores_legacy;
    alter table public.quality_supplier_evaluation_scores_legacy rename constraint quality_supplier_evaluation_scores_pkey to quality_supplier_evaluation_scores_legacy_pkey;
    alter table public.quality_supplier_evaluation_scores_legacy rename constraint quality_supplier_evaluation_scores_evaluation_id_criterion_key to quality_supplier_evaluation_scores_legacy_criterion_key;
    alter index if exists public.quality_supplier_evaluation_scores_parent_idx rename to quality_supplier_evaluation_scores_legacy_parent_idx;
    alter index if exists public.quality_supplier_evaluation_scores_org_idx rename to quality_supplier_evaluation_scores_legacy_org_idx;
    revoke all on public.quality_supplier_evaluation_scores_legacy from anon, authenticated;
  end if;
end
$$;

create table if not exists public.quality_supplier_evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evaluation_id uuid not null,
  -- One of the six fixed criteria of the earlier evaluations, or none for a template criterion.
  criterion text check (criterion is null or criterion in ('quality', 'delivery', 'specs', 'documents', 'support', 'price')),
  criterion_id uuid,
  criterion_label text,
  position smallint not null default 0 check (position >= 0),
  weight numeric(6,3) not null default 1 check (weight > 0),
  score_scale smallint not null default 5 check (score_scale in (5, 10)),
  score smallint not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint quality_supplier_evaluation_scores_score_check check ((score_scale = 5 and score between 1 and 5) or (score_scale = 10 and score between 0 and 10)),
  constraint quality_supplier_evaluation_scores_what check (criterion is not null or criterion_id is not null or length(btrim(coalesce(criterion_label, ''))) > 0),
  unique (evaluation_id, criterion),
  unique (evaluation_id, criterion_id),
  foreign key (evaluation_id, organization_id) references public.quality_supplier_evaluations(id, organization_id) on delete cascade,
  constraint quality_supplier_evaluation_scores_criterion_fkey foreign key (criterion_id, organization_id) references public.quality_supplier_eval_template_criteria(id, organization_id) on delete set null (criterion_id)
);
create index if not exists quality_supplier_evaluation_scores_parent_idx on public.quality_supplier_evaluation_scores (evaluation_id, organization_id);
create index if not exists quality_supplier_evaluation_scores_org_idx on public.quality_supplier_evaluation_scores (organization_id);
create index if not exists quality_supplier_evaluation_scores_criterion_idx on public.quality_supplier_evaluation_scores (criterion_id, organization_id);

do $$
begin
  if to_regclass('public.quality_supplier_evaluation_scores_legacy') is not null then
    insert into public.quality_supplier_evaluation_scores (id, organization_id, evaluation_id, criterion, weight, score_scale, score, created_by, created_at, updated_by, updated_at)
    select l.id, l.organization_id, l.evaluation_id, l.criterion, l.weight, 5, l.score, l.created_by, l.created_at, l.updated_by, l.updated_at
    from public.quality_supplier_evaluation_scores_legacy l
    on conflict (id) do nothing;
  end if;
end
$$;

-- D. Contacts, documents and the supplier's own details -----------------------------------

create table if not exists public.quality_supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null,
  position smallint not null default 0 check (position >= 0),
  full_name text not null check (length(btrim(full_name)) > 0),
  job_title text,
  phone text,
  email text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  foreign key (supplier_id, organization_id) references public.quality_suppliers(id, organization_id) on delete cascade
);
create index if not exists quality_supplier_contacts_supplier_idx on public.quality_supplier_contacts (supplier_id, organization_id, position);
create index if not exists quality_supplier_contacts_org_idx on public.quality_supplier_contacts (organization_id);

alter table public.quality_supplier_certifications
  add column if not exists title text,
  add column if not exists document_kind text not null default 'certificate' check (document_kind in ('certificate', 'licence', 'contract', 'declaration', 'specification', 'other')),
  add column if not exists attachment_id uuid references public.attachments(id) on delete set null;
create index if not exists quality_supplier_certifications_attachment_idx on public.quality_supplier_certifications (attachment_id);

alter table public.quality_suppliers
  add column if not exists legal_name text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists approval_status text check (approval_status is null or approval_status in ('approved', 'conditional', 'rejected')),
  add column if not exists evaluation_months smallint check (evaluation_months is null or evaluation_months between 1 and 60);

-- E. Row-level security, grants and audit fields ---------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['quality_supplier_eval_templates', 'quality_supplier_eval_template_criteria', 'quality_supplier_evaluation_scores', 'quality_supplier_contacts'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policy where polrelid = format('public.%I', t)::regclass and polname = t || '_read') then
      execute format($p$create policy %I on public.%I for select to authenticated using (
        (select public.current_user_is_platform_owner())
        or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[]))$p$, t || '_read', t);
      execute format($p$create policy %I on public.%I for insert to authenticated
        with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_insert', t);
      execute format($p$create policy %I on public.%I for update to authenticated
        using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
        with check ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_update', t);
      execute format($p$create policy %I on public.%I for delete to authenticated
        using ((select public.current_user_is_platform_owner()) or organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))$p$, t || '_delete', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_trigger where tgrelid = format('public.%I', t)::regclass and tgname = 'trg_' || t || '_audit_fields') then
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_repository_audit_fields()', 'trg_' || t || '_audit_fields', t);
    end if;
  end loop;
end
$$;

comment on table public.quality_supplier_eval_templates is 'Supplier evaluation templates: the categories each applies to, thresholds (%), frequency (months) and scale.';
comment on table public.quality_supplier_eval_template_criteria is 'The weighted criteria of a supplier evaluation template, in order.';
comment on table public.quality_supplier_evaluation_scores is 'One score per criterion of a supplier evaluation: a template criterion (label and weight kept as scored) or one of the six earlier fixed criteria.';
comment on table public.quality_supplier_contacts is 'A supplier''s contact persons.';
comment on column public.quality_supplier_evaluations.criteria_scores is 'complete: every criterion scored; partial: only some were recorded (FileMaker kept the first); not_recorded: only the total exists.';
comment on column public.quality_supplier_evaluations.total_score is 'The weighted result as % of the scale; stored for every evaluation (the only figure FileMaker kept for most criteria).';
