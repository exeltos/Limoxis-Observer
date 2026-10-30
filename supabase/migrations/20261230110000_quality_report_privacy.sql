-- Ιδιωτικότητα αναφορών προσωπικού (quality_incidents).
--   privacy    : 'named' (επώνυμη, προεπιλογή) | 'confidential' (εμπιστευτική: ο αναφέρων αποθηκεύεται αλλά κρύβεται) | 'anonymous' (χωρίς αναφέροντα)
--   visibility : για μη επώνυμες — 'admin' (μόνο διαχειριστής νοσοκομείου) | 'quality' (διαχειριστής και Ποιότητα) | 'person' (διαχειριστής και συγκεκριμένο πρόσωπο)
--   visible_to : ο χρήστης που βλέπει την αναφορά όταν visibility = 'person'
-- Οι περιοριστικές (restrictive) πολιτικές στενεύουν τις υπάρχουσες για τις μη επώνυμες γραμμές· οι επώνυμες δεν επηρεάζονται.
-- Εκτελείται από τον ιδιοκτήτη στο SQL Editor (δεν εφαρμόζεται από τον agent).

alter table public.quality_incidents add column if not exists privacy text not null default 'named';
alter table public.quality_incidents add column if not exists visibility text;
alter table public.quality_incidents add column if not exists visible_to uuid;

alter table public.quality_incidents add constraint quality_incidents_privacy_check
  check (privacy in ('named', 'confidential', 'anonymous'));
alter table public.quality_incidents add constraint quality_incidents_visibility_check
  check (visibility is null or visibility in ('admin', 'quality', 'person'));

create or replace function private.quality_incident_private_visible(
  target_org uuid, target_privacy text, target_visibility text, target_visible_to uuid, target_reporter uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select target_privacy = 'named'
    or public.current_user_is_platform_owner()
    or public.current_user_has_org_role(target_org, array['hospital_admin']::public.app_role[])
    or (target_privacy = 'confidential' and target_reporter = (select auth.uid()))
    or (target_visibility = 'quality' and public.current_user_has_org_role(target_org, array['quality_manager']::public.app_role[]))
    or (target_visibility = 'person' and target_visible_to = (select auth.uid()))
$$;

create policy quality_incident_private_read on public.quality_incidents
  as restrictive for select to authenticated
  using (private.quality_incident_private_visible(organization_id, privacy, visibility, visible_to, reported_by));

create policy quality_incident_private_update on public.quality_incidents
  as restrictive for update to authenticated
  using (private.quality_incident_private_visible(organization_id, privacy, visibility, visible_to, reported_by))
  with check (private.quality_incident_private_visible(organization_id, privacy, visibility, visible_to, reported_by));

create policy quality_incident_private_delete on public.quality_incidents
  as restrictive for delete to authenticated
  using (private.quality_incident_private_visible(organization_id, privacy, visibility, visible_to, reported_by));
