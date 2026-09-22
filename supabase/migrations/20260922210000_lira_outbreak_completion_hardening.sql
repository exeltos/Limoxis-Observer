drop policy if exists lira_outbreak_case_reviews_insert on public.lira_outbreak_case_reviews;
create policy lira_outbreak_case_reviews_insert on public.lira_outbreak_case_reviews for insert to authenticated
with check (
 (select auth.uid()) is not null
 and (public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role]))
 and exists(select 1 from public.lira_outbreak_investigations i where i.id=investigation_id and i.organization_id=organization_id and i.status='active')
 and (supersedes_review_id is null or exists(select 1 from public.lira_outbreak_case_reviews prior where prior.id=supersedes_review_id and prior.investigation_id=investigation_id and prior.record_key=record_key))
);
