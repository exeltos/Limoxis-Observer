-- The infection-control roles may not update laboratory_samples (RLS: laboratory roles,
-- the requester of an unreceived sample, hospital admin). They decide on a sample
-- through this one function, which can write ONLY the surveillance review columns and
-- (for «episode_opened») the link to the episode. SECURITY DEFINER because the table's
-- update policy would refuse them; it therefore checks everything itself: signed in,
-- one of the four roles of the organization, the Surveillance module not locked
-- (current_user_has_capability), the sample inside that organization, and for an
-- episode that the episode belongs to the same organization and patient. The
-- audit_laboratory_samples trigger records the UPDATE with the caller as actor.
create or replace function public.review_laboratory_sample(
  p_organization_id uuid,
  p_sample_id uuid,
  p_status text,
  p_reason text default null,
  p_note text default null,
  p_case_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_sample public.laboratory_samples%rowtype;
  v_case_patient uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if p_organization_id is null or p_sample_id is null then
    raise exception 'Sample and organization are required.' using errcode = '22023';
  end if;
  if not public.current_user_has_org_role(p_organization_id,
       array['hospital_admin', 'infection_control_lead', 'infection_control_member', 'doctor_reviewer']::public.app_role[])
     or not public.current_user_has_capability(p_organization_id, 'view_surveillance') then
    raise exception 'Not allowed to review laboratory samples.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('episode_opened', 'no_surveillance_needed') then
    raise exception 'Unknown review status.' using errcode = '22023';
  end if;
  if p_status = 'no_surveillance_needed'
     and (p_reason is null or p_reason not in ('contamination', 'colonization', 'known_case', 'other')) then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;

  select * into v_sample
  from public.laboratory_samples
  where id = p_sample_id and organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Sample not found.' using errcode = 'P0002';
  end if;
  if v_sample.patient_id is null then
    raise exception 'Only a patient sample can be reviewed.' using errcode = '22023';
  end if;

  if p_status = 'episode_opened' then
    if p_case_id is null then
      raise exception 'The episode is required.' using errcode = '22023';
    end if;
    select c.patient_id into v_case_patient
    from public.surveillance_cases c
    where c.id = p_case_id and c.organization_id = p_organization_id;
    if not found or v_case_patient is distinct from v_sample.patient_id then
      raise exception 'The episode does not belong to the sample''s patient.' using errcode = '22023';
    end if;
    if v_sample.surveillance_case_id is not null and v_sample.surveillance_case_id <> p_case_id then
      raise exception 'The sample already belongs to another episode.' using errcode = '22023';
    end if;
    update public.laboratory_samples
       set surveillance_case_id = p_case_id,
           surveillance_review_status = 'episode_opened',
           surveillance_review_reason = null,
           surveillance_review_note = null,
           surveillance_reviewed_by = v_actor,
           surveillance_reviewed_at = now(),
           updated_by = v_actor,
           updated_at = now()
     where id = p_sample_id and organization_id = p_organization_id;
  else
    if v_sample.surveillance_case_id is not null or v_sample.surveillance_review_status = 'episode_opened' then
      raise exception 'The sample already has an episode.' using errcode = '22023';
    end if;
    update public.laboratory_samples
       set surveillance_review_status = 'no_surveillance_needed',
           surveillance_review_reason = p_reason,
           surveillance_review_note = nullif(btrim(coalesce(p_note, '')), ''),
           surveillance_reviewed_by = v_actor,
           surveillance_reviewed_at = now(),
           updated_by = v_actor,
           updated_at = now()
     where id = p_sample_id and organization_id = p_organization_id;
  end if;

  return json_build_object('sample_id', p_sample_id, 'status', p_status);
end;
$$;

grant execute on function public.review_laboratory_sample(uuid, uuid, text, text, text, uuid) to authenticated;
