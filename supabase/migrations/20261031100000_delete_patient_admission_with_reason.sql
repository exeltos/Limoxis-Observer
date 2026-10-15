-- Governed deletion of one admission, with a written reason kept in the audit log.
-- Each patient keeps at least one admission (a new patient always gets one), so the
-- last admission cannot be deleted: archive the patient instead. An admission that
-- still holds surveillance episodes cannot be deleted either: void them first.
-- When the deleted admission was the patient's current one, the patient snapshot
-- (department, dates, status) moves to the latest remaining admission.

create or replace function public.delete_patient_admission(
  p_organization_id uuid,
  p_patient_id uuid,
  p_admission_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_admission public.patient_admissions%rowtype;
  v_latest public.patient_admissions%rowtype;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'delete reason is required'; end if;

  select * into v_admission
  from public.patient_admissions
  where id = p_admission_id and organization_id = p_organization_id and patient_id = p_patient_id;
  if not found then raise exception 'admission not found in organization'; end if;

  if not public.current_user_can_patient_capability(p_organization_id, v_admission.department_id, 'delete_patient') then
    raise exception 'not authorized to delete admission';
  end if;

  if not exists (
    select 1 from public.patient_admissions
    where organization_id = p_organization_id and patient_id = p_patient_id and id <> p_admission_id
  ) then
    raise exception 'the only admission of a patient cannot be deleted; archive the patient instead';
  end if;

  if exists (
    select 1 from public.surveillance_cases
    where organization_id = p_organization_id and admission_id = p_admission_id and voided_at is null
  ) then
    raise exception 'admission has surveillance episodes; void them first';
  end if;

  delete from public.patient_admissions where id = p_admission_id;

  select * into v_latest
  from public.patient_admissions
  where organization_id = p_organization_id and patient_id = p_patient_id
  order by (status = 'active') desc, admission_date desc
  limit 1;

  update public.patients
  set department_id = v_latest.department_id,
      admission_date = v_latest.admission_date,
      discharge_date = v_latest.discharge_date,
      status = v_latest.status,
      updated_at = now()
  where id = p_patient_id and organization_id = p_organization_id;

  insert into public.system_audit_log(actor_user_id, event_type, entity_type, entity_id, metadata)
  values (
    v_actor, 'patient.admission_deleted', 'patient_admission', p_admission_id::text,
    jsonb_build_object(
      'organization_id', p_organization_id,
      'patient_id', p_patient_id,
      'reason', trim(p_reason),
      'admission', to_jsonb(v_admission)
    )
  );
end $$;

revoke all on function public.delete_patient_admission(uuid,uuid,uuid,text) from public;
grant execute on function public.delete_patient_admission(uuid,uuid,uuid,text) to authenticated;
