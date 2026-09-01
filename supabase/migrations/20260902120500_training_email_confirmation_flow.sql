create or replace function public.training_email_access(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','auth','pg_temp'
as $function$
declare v_assignment public.training_records%rowtype; v_program public.training_records%rowtype;
begin
 if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and employee_user_id=auth.uid() and payload->>'accessToken'=p_token and is_org_member(organization_id) limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 return jsonb_build_object('program',v_program.payload||jsonb_build_object('id',v_program.record_key),'assignment',v_assignment.payload||jsonb_build_object('id',v_assignment.record_key,'dbId',v_assignment.id,'userId',v_assignment.employee_user_id,'departmentId',v_assignment.department_id));
end;$function$;

create or replace function public.training_confirm_attendance(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','auth','pg_temp'
as $function$
declare v_assignment public.training_records%rowtype; v_now timestamptz:=now(); v_payload jsonb;
begin
 if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and employee_user_id=auth.uid() and payload->>'accessToken'=p_token and is_org_member(organization_id) limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 v_payload:=v_assignment.payload||jsonb_build_object('attendance',true,'attendanceResponse','confirmed','attendanceConfirmedAt',coalesce(v_assignment.payload->>'attendanceConfirmedAt',v_now::text),'status',case when coalesce(v_assignment.payload->>'status','assigned')='assigned' then 'in_progress' else coalesce(v_assignment.payload->>'status','assigned') end,'updatedAt',v_now::text,'updatedById',auth.uid()::text);
 update public.training_records set payload=v_payload,updated_by=auth.uid(),updated_at=v_now where id=v_assignment.id;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'status',v_payload->>'status','attendanceConfirmedAt',v_payload->>'attendanceConfirmedAt');
end;$function$;

create or replace function public.queue_training_invitation(p_assignment_key text,p_language text default 'el')
returns jsonb language plpgsql security definer set search_path to 'public','auth','pg_temp'
as $function$
declare v_assignment public.training_records%rowtype; v_program public.training_records%rowtype; v_email text; v_token text; v_now timestamptz:=now(); v_payload jsonb; v_outbox_id uuid;
begin
 if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and record_key=p_assignment_key and is_org_member(organization_id) limit 1;
 if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;
 if not (current_user_has_capability(v_assignment.organization_id,'manage_training') or current_user_has_org_role(v_assignment.organization_id,array['platform_owner','hospital_admin','infection_control_lead','quality_manager']::app_role[])) then raise exception 'TRAINING_MANAGE_REQUIRED'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 v_email:=nullif(btrim(coalesce(v_assignment.payload->>'email','')),''); if v_email is null then raise exception 'TRAINING_PARTICIPANT_EMAIL_REQUIRED'; end if; if v_assignment.employee_user_id is null then raise exception 'TRAINING_PARTICIPANT_ACCOUNT_REQUIRED'; end if;
 v_token:=coalesce(nullif(v_assignment.payload->>'accessToken',''),'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-',''));
 v_payload:=v_assignment.payload||jsonb_build_object('accessToken',v_token,'invitationSentAt',v_now::text,'attendanceResponse',case when coalesce(v_assignment.payload->>'attendanceResponse','not_sent')='confirmed' then 'confirmed' else 'sent' end,'updatedAt',v_now::text,'updatedById',auth.uid()::text);
 update public.training_records set payload=v_payload,updated_by=auth.uid(),updated_at=v_now where id=v_assignment.id;
 insert into public.notification_outbox(organization_id,recipient_user_id,recipient_email,notification_type,entity_type,entity_id,subject,payload,status,attempts,available_at) values(v_assignment.organization_id,v_assignment.employee_user_id,v_email,'training_invitation','training_assignment',v_assignment.id,case when lower(coalesce(p_language,'el'))='en' then 'Training invitation: '||coalesce(v_program.payload->>'title','') else 'Πρόσκληση εκπαίδευσης: '||coalesce(v_program.payload->>'title','') end,jsonb_build_object('path','/training-access/'||v_token,'programTitle',v_program.payload->>'title','employeeName',v_assignment.payload->>'employeeName','dueDate',v_assignment.payload->>'dueDate','requiresAssessment',coalesce((v_program.payload->>'requiresAssessment')::boolean,false),'language',case when lower(coalesce(p_language,'el'))='en' then 'en' else 'el' end),'pending',0,v_now) returning id into v_outbox_id;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'outboxId',v_outbox_id,'queuedAt',v_now);
end;$function$;

revoke execute on function public.training_email_access(text) from public,anon;
revoke execute on function public.training_confirm_attendance(text) from public,anon;
revoke execute on function public.queue_training_invitation(text,text) from public,anon;
grant execute on function public.training_email_access(text) to authenticated;
grant execute on function public.training_confirm_attendance(text) to authenticated;
grant execute on function public.queue_training_invitation(text,text) to authenticated;
-- training_submit_evaluation is deployed in the live migration and follows the same authenticated-only access pattern.
