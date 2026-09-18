-- Patient lifecycle hardening: preserve clinical history and use governed archival.
-- patient_admissions is the canonical chronological admission history.
-- patients admission fields remain a current-admission compatibility snapshot.

alter table public.patients
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

create index if not exists patients_org_active_idx
  on public.patients(organization_id, admission_date desc)
  where archived_at is null;

create or replace function public.archive_patient(
  p_organization_id uuid,
  p_patient_id uuid,
  p_reason text
)
returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_patient public.patients%rowtype;
  v_department uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'archive reason is required'; end if;

  select department_id into v_department
  from public.patients
  where id=p_patient_id and organization_id=p_organization_id and archived_at is null;

  if not found then raise exception 'patient not found or already archived'; end if;

  if not public.current_user_can_patient_capability(
    p_organization_id, v_department, 'delete_patient'
  ) then
    raise exception 'not authorized to archive patient';
  end if;

  update public.patients
     set archived_at=now(), archived_by=v_actor, archive_reason=trim(p_reason), updated_at=now()
   where id=p_patient_id and organization_id=p_organization_id and archived_at is null
  returning * into v_patient;

  insert into public.system_audit_log(actor_user_id,event_type,entity_type,entity_id,metadata)
  values (
    v_actor,'patient.archived','patient',p_patient_id::text,
    jsonb_build_object('organization_id',p_organization_id,'patient_code',v_patient.patient_code,'reason',trim(p_reason))
  );

  return v_patient;
end;
$$;

revoke all on function public.archive_patient(uuid,uuid,text) from public;
grant execute on function public.archive_patient(uuid,uuid,text) to authenticated;

comment on column public.patients.archived_at is
  'Governed lifecycle marker. Archived patients are hidden from the active registry; clinical history is preserved.';
comment on column public.patients.admission_date is
  'Compatibility/current-admission snapshot. Canonical chronological admission history is public.patient_admissions.';
