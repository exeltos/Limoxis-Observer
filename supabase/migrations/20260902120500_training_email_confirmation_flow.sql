create or replace function public.training_email_access(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_records%rowtype;
 v_program public.training_records%rowtype;
 v_program_payload jsonb;
begin
 if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and employee_user_id=auth.uid() and payload->>'accessToken'=p_token and is_org_member(organization_id) limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 v_program_payload := (v_program.payload - 'feedbackResponses') || jsonb_build_object('id',v_program.record_key);
 if jsonb_typeof(v_program_payload->'assessmentQuestions')='array' then
  v_program_payload := jsonb_set(v_program_payload,'{assessmentQuestions}',coalesce((select jsonb_agg(q - 'correctIndex') from jsonb_array_elements(v_program_payload->'assessmentQuestions') q),'[]'::jsonb),true);
 end if;
 return jsonb_build_object('program',v_program_payload,'assignment',(v_assignment.payload-'accessToken')||jsonb_build_object('id',v_assignment.record_key,'dbId',v_assignment.id,'userId',v_assignment.employee_user_id,'departmentId',v_assignment.department_id));
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

create or replace function public.training_submit_evaluation(p_token text,p_answers jsonb default '{}'::jsonb,p_feedback_scores jsonb default '{}'::jsonb,p_feedback_comment text default null)
returns jsonb language plpgsql security definer set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_records%rowtype;
 v_program public.training_records%rowtype;
 v_now timestamptz:=now();
 v_questions jsonb;
 v_question jsonb;
 v_total numeric:=0;
 v_earned numeric:=0;
 v_score integer:=null;
 v_requires boolean:=false;
 v_pass integer:=0;
 v_competent boolean:=true;
 v_payload jsonb;
 v_certificate_key text;
 v_feedback jsonb;
 v_feedback_list jsonb;
begin
 if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and employee_user_id=auth.uid() and payload->>'accessToken'=p_token and is_org_member(organization_id) limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 if nullif(v_assignment.payload->>'completionConfirmedAt','') is not null then raise exception 'TRAINING_ALREADY_COMPLETED'; end if;
 if coalesce((v_assignment.payload->>'attendance')::boolean,false) is not true then raise exception 'TRAINING_ATTENDANCE_REQUIRED'; end if;
 v_requires:=coalesce((v_program.payload->>'requiresAssessment')::boolean,false);
 v_pass:=coalesce((v_program.payload->>'passScore')::integer,0);
 v_questions:=coalesce(v_program.payload->'assessmentQuestions','[]'::jsonb);
 if v_requires then
  if jsonb_array_length(v_questions)=0 then raise exception 'TRAINING_ASSESSMENT_NOT_CONFIGURED'; end if;
  for v_question in select value from jsonb_array_elements(v_questions) loop
   if not (p_answers ? (v_question->>'id')) then raise exception 'TRAINING_ASSESSMENT_INCOMPLETE'; end if;
   v_total:=v_total+coalesce((v_question->>'points')::numeric,1);
   if (p_answers->>(v_question->>'id'))::integer=coalesce((v_question->>'correctIndex')::integer,-1) then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1); end if;
  end loop;
  v_score:=case when v_total>0 then round(v_earned/v_total*100)::integer else 0 end;
  v_competent:=v_score>=v_pass;
 end if;
 v_certificate_key:=case when v_competent then 'CERT-'||v_assignment.record_key else null end;
 v_payload:=v_assignment.payload||jsonb_build_object('completionConfirmedAt',v_now::text,'feedbackSubmittedAt',v_now::text,'assessmentSubmittedAt',case when v_requires then v_now::text else null end,'status','completed','completedDate',v_now::date::text,'score',v_score,'competent',v_competent,'certificateId',v_certificate_key,'feedbackScores',coalesce(p_feedback_scores,'{}'::jsonb),'feedbackComment',nullif(btrim(coalesce(p_feedback_comment,'')),''),'updatedAt',v_now::text,'updatedById',auth.uid()::text);
 update public.training_records set payload=v_payload,updated_by=auth.uid(),updated_at=v_now where id=v_assignment.id;
 v_feedback:=jsonb_build_object('employeeId',v_assignment.payload->>'employeeId','userId',auth.uid()::text,'submittedAt',v_now::text,'scores',coalesce(p_feedback_scores,'{}'::jsonb),'comment',nullif(btrim(coalesce(p_feedback_comment,'')),''));
 select coalesce(jsonb_agg(item),'[]'::jsonb) into v_feedback_list from jsonb_array_elements(coalesce(v_program.payload->'feedbackResponses','[]'::jsonb)) item where coalesce(item->>'userId','')<>auth.uid()::text;
 update public.training_records set payload=jsonb_set(v_program.payload,'{feedbackResponses}',coalesce(v_feedback_list,'[]'::jsonb)||jsonb_build_array(v_feedback),true),updated_by=auth.uid(),updated_at=v_now where id=v_program.id;
 if v_competent then
  insert into public.training_records(organization_id,record_key,record_type,department_id,employee_user_id,payload,created_by,updated_by)
  values(v_program.organization_id,v_certificate_key,'certificate',v_assignment.department_id,auth.uid(),jsonb_build_object('id',v_certificate_key,'assignmentId',v_assignment.record_key,'employeeId',v_assignment.payload->>'employeeId','title',v_program.payload->>'title','issuedDate',v_now::date::text,'validUntil',case when nullif(v_program.payload->>'validMonths','') is null then null else (v_now::date+make_interval(months=>(v_program.payload->>'validMonths')::integer))::date::text end,'issuer','Limoxis Observer','issuedAt',v_now::text,'issuedById',auth.uid()::text),auth.uid(),auth.uid())
  on conflict (organization_id,record_key) do nothing;
 end if;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'programId',v_program.record_key,'score',v_score,'competent',v_competent,'certificateId',v_certificate_key,'completedAt',v_now);
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
 v_email:=nullif(btrim(coalesce(v_assignment.payload->>'email','')),'');
 if v_email is null then raise exception 'TRAINING_PARTICIPANT_EMAIL_REQUIRED'; end if;
 if v_assignment.employee_user_id is null then raise exception 'TRAINING_PARTICIPANT_ACCOUNT_REQUIRED'; end if;
 v_token:=coalesce(nullif(v_assignment.payload->>'accessToken',''),'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-',''));
 v_payload:=v_assignment.payload||jsonb_build_object('accessToken',v_token,'invitationSentAt',v_now::text,'attendanceResponse',case when coalesce(v_assignment.payload->>'attendanceResponse','not_sent')='confirmed' then 'confirmed' else 'sent' end,'updatedAt',v_now::text,'updatedById',auth.uid()::text);
 update public.training_records set payload=v_payload,updated_by=auth.uid(),updated_at=v_now where id=v_assignment.id;
 insert into public.notification_outbox(organization_id,recipient_user_id,recipient_email,notification_type,entity_type,entity_id,subject,payload,status,attempts,available_at) values(v_assignment.organization_id,v_assignment.employee_user_id,v_email,'training_invitation','training_assignment',v_assignment.id,case when lower(coalesce(p_language,'el'))='en' then 'Training invitation: '||coalesce(v_program.payload->>'title','') else 'Πρόσκληση εκπαίδευσης: '||coalesce(v_program.payload->>'title','') end,jsonb_build_object('path','/training-access/'||v_token,'programTitle',v_program.payload->>'title','employeeName',v_assignment.payload->>'employeeName','dueDate',v_assignment.payload->>'dueDate','requiresAssessment',coalesce((v_program.payload->>'requiresAssessment')::boolean,false),'language',case when lower(coalesce(p_language,'el'))='en' then 'en' else 'el' end),'pending',0,v_now) returning id into v_outbox_id;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'outboxId',v_outbox_id,'queuedAt',v_now);
end;$function$;

revoke execute on function public.training_email_access(text) from public,anon;
revoke execute on function public.training_confirm_attendance(text) from public,anon;
revoke execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) from public,anon;
revoke execute on function public.queue_training_invitation(text,text) from public,anon;
grant execute on function public.training_email_access(text) to authenticated;
grant execute on function public.training_confirm_attendance(text) to authenticated;
grant execute on function public.training_submit_evaluation(text,jsonb,jsonb,text) to authenticated;
grant execute on function public.queue_training_invitation(text,text) to authenticated;
