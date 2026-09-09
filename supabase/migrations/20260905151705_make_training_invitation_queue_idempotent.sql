create or replace function public.queue_training_invitation(p_assignment_key text, p_language text default 'el'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_assignment public.training_records%rowtype;
  v_program public.training_records%rowtype;
  v_email text;
  v_token text;
  v_now timestamptz:=now();
  v_payload jsonb;
  v_outbox_id uuid;
  v_question_count integer:=0;
  v_subject text;
  v_outbox_payload jsonb;
begin
  if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;

  select * into v_assignment
  from public.training_records
  where record_type='assignment'
    and record_key=p_assignment_key
    and is_org_member(organization_id)
  limit 1;
  if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;

  if not (
    current_user_has_capability(v_assignment.organization_id,'manage_training')
    or current_user_has_org_role(
      v_assignment.organization_id,
      array['platform_owner','hospital_admin','infection_control_lead','quality_manager']::app_role[]
    )
  ) then raise exception 'TRAINING_MANAGE_REQUIRED'; end if;

  select * into v_program
  from public.training_records
  where organization_id=v_assignment.organization_id
    and record_type='program'
    and record_key=v_assignment.payload->>'programId'
  limit 1;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;

  v_email:=nullif(btrim(coalesce(v_assignment.payload->>'email','')),'');
  if v_email is null then raise exception 'TRAINING_PARTICIPANT_EMAIL_REQUIRED'; end if;

  v_token:=coalesce(
    nullif(v_assignment.payload->>'accessToken',''),
    'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-','')
  );

  if jsonb_typeof(v_program.payload->'assessmentQuestions')='array' then
    v_question_count:=jsonb_array_length(v_program.payload->'assessmentQuestions');
  end if;

  v_payload:=v_assignment.payload||jsonb_build_object(
    'accessToken',v_token,
    'invitationSentAt',v_now::text,
    'attendanceResponse',case
      when coalesce(v_assignment.payload->>'attendanceResponse','not_sent')='confirmed' then 'confirmed'
      else 'sent'
    end,
    'updatedAt',v_now::text,
    'updatedById',auth.uid()::text
  );

  update public.training_records
  set payload=v_payload,updated_by=auth.uid(),updated_at=v_now
  where id=v_assignment.id;

  v_subject:=case
    when lower(coalesce(p_language,'el'))='en'
      then 'Training confirmation & evaluation: '||coalesce(v_program.payload->>'title','')
    else 'Επιβεβαίωση συμμετοχής & αξιολόγηση: '||coalesce(v_program.payload->>'title','')
  end;

  v_outbox_payload:=jsonb_build_object(
    'path','/training-access/'||v_token,
    'programTitle',v_program.payload->>'title',
    'employeeName',v_assignment.payload->>'employeeName',
    'dueDate',v_assignment.payload->>'dueDate',
    'requiresAssessment',coalesce((v_program.payload->>'requiresAssessment')::boolean,false),
    'questionCount',v_question_count,
    'externalAccess',v_assignment.employee_user_id is null,
    'language',case when lower(coalesce(p_language,'el'))='en' then 'en' else 'el' end
  );

  select id into v_outbox_id
  from public.notification_outbox
  where notification_type='training_invitation'
    and entity_type='training_assignment'
    and entity_id=v_assignment.id
  order by created_at desc
  limit 1;

  if v_outbox_id is null then
    insert into public.notification_outbox(
      organization_id,recipient_user_id,recipient_email,notification_type,
      entity_type,entity_id,subject,payload,status,attempts,available_at
    ) values(
      v_assignment.organization_id,v_assignment.employee_user_id,v_email,'training_invitation',
      'training_assignment',v_assignment.id,v_subject,v_outbox_payload,'pending',0,v_now
    ) returning id into v_outbox_id;
  else
    update public.notification_outbox
    set organization_id=v_assignment.organization_id,
        recipient_user_id=v_assignment.employee_user_id,
        recipient_email=v_email,
        subject=v_subject,
        payload=v_outbox_payload,
        status='pending',
        attempts=0,
        available_at=v_now,
        sent_at=null,
        last_error=null,
        updated_at=v_now
    where id=v_outbox_id;
  end if;

  return jsonb_build_object(
    'assignmentId',v_assignment.record_key,
    'outboxId',v_outbox_id,
    'queuedAt',v_now,
    'questionCount',v_question_count
  );
end;$function$;
