-- LIRA Phase 5K: human-reviewed outbreak case classification.
create table if not exists public.lira_outbreak_case_reviews (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 investigation_id uuid not null references public.lira_outbreak_investigations(id) on delete cascade,
 record_key text not null,
 patient_id uuid references public.patients(id) on delete set null,
 classification text not null check(classification in ('suspected','probable','confirmed','excluded')),
 rationale text not null check(length(btrim(rationale))>0),
 reviewer_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
 reviewed_at timestamptz not null default now(),
 supersedes_review_id uuid references public.lira_outbreak_case_reviews(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index if not exists lira_outbreak_case_reviews_investigation_idx on public.lira_outbreak_case_reviews(investigation_id,record_key,reviewed_at desc);
create unique index if not exists lira_outbreak_case_reviews_supersedes_uidx on public.lira_outbreak_case_reviews(supersedes_review_id) where supersedes_review_id is not null;
alter table public.lira_outbreak_case_reviews enable row level security;
revoke all on table public.lira_outbreak_case_reviews from public,anon;
grant select,insert on table public.lira_outbreak_case_reviews to authenticated;
create policy lira_outbreak_case_reviews_select on public.lira_outbreak_case_reviews for select to authenticated using (
 public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','quality_manager']::public.app_role[])
);
create policy lira_outbreak_case_reviews_insert on public.lira_outbreak_case_reviews for insert to authenticated with check (
 (select auth.uid()) is not null and
 (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin','infection_control_lead']::public.app_role[])) and
 exists(select 1 from public.lira_outbreak_investigations i where i.id=investigation_id and i.organization_id=lira_outbreak_case_reviews.organization_id) and
 (supersedes_review_id is null or exists(select 1 from public.lira_outbreak_case_reviews prior where prior.id=supersedes_review_id and prior.investigation_id=lira_outbreak_case_reviews.investigation_id and prior.record_key=lira_outbreak_case_reviews.record_key))
);
