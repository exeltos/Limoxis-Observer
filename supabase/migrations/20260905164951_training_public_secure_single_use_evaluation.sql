create or replace function public.training_email_access(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_records%rowtype;
 v_program public.training_records%rowtype;
 v_program_payload jsonb;
 v_questions jsonb;
 v_question jsonb;
 v_safe_questions jsonb:='[]'::jsonb;
 v_safe_question jsonb;
 v_safe_options jsonb;
begin
 if nullif(btrim(coalesce(p_token,'')),'') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and payload->>'accessToken'=p_token limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 v_program_payload := (v_program.payload - 'feedbackResponses') || jsonb_build_object('id',v_program.record_key);
 v_questions:=coalesce(v_program_payload->'assessmentQuestions','[]'::jsonb);
 if jsonb_typeof(v_questions)='array' then
  for v_question in select value from jsonb_array_elements(v_questions) loop
   v_safe_question:=v_question-'correctIndex'-'correctBoolean'-'modelAnswer';
   if jsonb_typeof(v_question->'options')='array' then
    select coalesce(jsonb_agg(opt-'correct'),'[]'::jsonb) into v_safe_options from jsonb_array_elements(v_question->'options') opt;
    v_safe_question:=jsonb_set(v_safe_question,'{options}',v_safe_options,true);
   end if;
   v_safe_questions:=v_safe_questions||jsonb_build_array(v_safe_question);
  end loop;
  v_program_payload:=jsonb_set(v_program_payload,'{assessmentQuestions}',v_safe_questions,true);
 end if;
 return jsonb_build_object('program',v_program_payload,'assignment',(v_assignment.payload-'accessToken')||jsonb_build_object('id',v_assignment.record_key,'dbId',v_assignment.id,'userId',v_assignment.employee_user_id,'departmentId',v_assignment.department_id,'externalAccess',true,'tokenOnlyAccess',true));
end;$function$;

drop function if exists public.training_submit_evaluation(text,jsonb,jsonb,text);
create function public.training_submit_evaluation(p_token text,p_answers jsonb default '{}'::jsonb,p_feedback_scores jsonb default '{}'::jsonb,p_feedback_comment text default null,p_attendance_attested boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_records%rowtype;
 v_program public.training_records%rowtype;
 v_now timestamptz:=now();
 v_questions jsonb;
 v_question jsonb;
 v_answer jsonb;
 v_type text;
 v_required boolean;
 v_total numeric:=0;
 v_earned numeric:=0;
 v_score integer:=null;
 v_requires boolean:=false;
 v_pass integer:=0;
 v_competent boolean:=true;
 v_manual_review boolean:=false;
 v_payload jsonb;
 v_certificate_key text;
 v_feedback jsonb;
 v_feedback_list jsonb;
 v_expected_count integer;
 v_selected_count integer;
 v_match_count integer;
 v_correct_index integer;
 v_answer_index integer;
 v_correct_boolean boolean;
 v_answer_boolean boolean;
 v_correct_id text;
begin
 if nullif(btrim(coalesce(p_token,'')),'') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_assignment from public.training_records where record_type='assignment' and payload->>'accessToken'=p_token limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 if nullif(v_assignment.payload->>'feedbackSubmittedAt','') is not null then raise exception 'TRAINING_ALREADY_SUBMITTED'; end if;
 if not coalesce(p_attendance_attested,false) then raise exception 'TRAINING_ATTENDANCE_ATTESTATION_REQUIRED'; end if;
 select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 v_requires:=coalesce((v_program.payload->>'requiresAssessment')::boolean,false);
 v_pass:=coalesce((v_program.payload->>'passScore')::integer,0);
 v_questions:=coalesce(v_program.payload->'assessmentQuestions','[]'::jsonb);
 if v_requires then
  if jsonb_array_length(v_questions)=0 then raise exception 'TRAINING_ASSESSMENT_NOT_CONFIGURED'; end if;
  for v_question in select value from jsonb_array_elements(v_questions) loop
   v_type:=coalesce(nullif(v_question->>'type',''),'single_choice');
   if v_type='multiple' then v_type:='single_choice'; end if;
   if v_type='boolean' then v_type:='true_false'; end if;
   v_required:=coalesce((v_question->>'required')::boolean,true);
   v_answer:=p_answers->(v_question->>'id');
   if v_required and (v_answer is null or v_answer='null'::jsonb or (jsonb_typeof(v_answer)='string' and btrim(v_answer#>>'{}')='')) then raise exception 'TRAINING_ASSESSMENT_INCOMPLETE'; end if;
   if v_type='free_text' then v_manual_review:=true; continue; end if;
   v_total:=v_total+coalesce((v_question->>'points')::numeric,1);
   if v_type='single_choice' then
    v_correct_id:=null;
    if jsonb_typeof(v_question->'options')='array' then select opt->>'id' into v_correct_id from jsonb_array_elements(v_question->'options') opt where coalesce((opt->>'correct')::boolean,false)=true limit 1; end if;
    if v_correct_id is not null and trim(both '"' from coalesce(v_answer::text,''))=v_correct_id then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1);
    elsif v_question ? 'correctIndex' then
     begin v_answer_index:=(v_answer#>>'{}')::integer; exception when others then v_answer_index:=-999; end;
     v_correct_index:=coalesce((v_question->>'correctIndex')::integer,-1);
     if v_answer_index=v_correct_index then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1); end if;
    end if;
   elsif v_type='multiple_choice' then
    if jsonb_typeof(v_answer)='array' then
     select count(*) into v_expected_count from jsonb_array_elements(v_question->'options') opt where coalesce((opt->>'correct')::boolean,false)=true;
     select jsonb_array_length(v_answer) into v_selected_count;
     select count(*) into v_match_count from jsonb_array_elements(v_answer) selected join jsonb_array_elements(v_question->'options') opt on trim(both '"' from selected::text)=opt->>'id' where coalesce((opt->>'correct')::boolean,false)=true;
     if v_expected_count=v_selected_count and v_match_count=v_expected_count then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1); end if;
    end if;
   elsif v_type='true_false' then
    if v_question ? 'correctBoolean' then
     begin v_answer_boolean:=(v_answer#>>'{}')::boolean; exception when others then v_answer_boolean:=null; end;
     v_correct_boolean:=coalesce((v_question->>'correctBoolean')::boolean,false);
     if v_answer_boolean is not distinct from v_correct_boolean then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1); end if;
    elsif v_question ? 'correctIndex' then
     begin v_answer_index:=(v_answer#>>'{}')::integer; exception when others then v_answer_index:=-999; end;
     if v_answer_index=coalesce((v_question->>'correctIndex')::integer,-1) then v_earned:=v_earned+coalesce((v_question->>'points')::numeric,1); end if;
    end if;
   end if;
  end loop;
  v_score:=case when v_total>0 then round(v_earned/v_total*100)::integer else null end;
  v_competent:=case when v_score is null then true else v_score>=v_pass end;
 end if;
 v_certificate_key:=case when v_competent and not v_manual_review then 'CERT-'||v_assignment.record_key else null end;
 v_payload:=v_assignment.payload||jsonb_build_object('attendance',true,'attendanceResponse','confirmed','attendanceConfirmedAt',coalesce(v_assignment.payload->>'attendanceConfirmedAt',v_now::text),'attendanceAttested',true,'attendanceAttestedAt',v_now::text,'attendanceAttestationMethod','personal_email_token','attendanceAttestationVersion','1.0','feedbackSubmittedAt',v_now::text,'assessmentSubmittedAt',case when v_requires then v_now::text else null end,'assessmentAnswers',coalesce(p_answers,'{}'::jsonb),'assessmentReviewStatus',case when v_manual_review then 'pending' else 'not_required' end,'completionConfirmedAt',case when v_manual_review then null else v_now::text end,'status',case when v_manual_review then 'in_progress' else 'completed' end,'completedDate',case when v_manual_review then null else v_now::date::text end,'score',v_score,'competent',case when v_manual_review then null else v_competent end,'certificateId',v_certificate_key,'feedbackScores',coalesce(p_feedback_scores,'{}'::jsonb),'feedbackComment',nullif(btrim(coalesce(p_feedback_comment,'')),''),'updatedAt',v_now::text,'updatedById',case when auth.uid() is null then null else auth.uid()::text end);
 update public.training_records set payload=v_payload,updated_by=coalesce(auth.uid(),updated_by),updated_at=v_now where id=v_assignment.id;
 v_feedback:=jsonb_build_object('employeeId',v_assignment.payload->>'employeeId','userId',case when auth.uid() is null then null else auth.uid()::text end,'assignmentId',v_assignment.record_key,'submittedAt',v_now::text,'scores',coalesce(p_feedback_scores,'{}'::jsonb),'comment',nullif(btrim(coalesce(p_feedback_comment,'')),''));
 select coalesce(jsonb_agg(item),'[]'::jsonb) into v_feedback_list from jsonb_array_elements(coalesce(v_program.payload->'feedbackResponses','[]'::jsonb)) item where coalesce(item->>'assignmentId','')<>v_assignment.record_key;
 update public.training_records set payload=jsonb_set(v_program.payload,'{feedbackResponses}',coalesce(v_feedback_list,'[]'::jsonb)||jsonb_build_array(v_feedback),true),updated_by=coalesce(auth.uid(),v_program.updated_by),updated_at=v_now where id=v_program.id;
 if v_certificate_key is not null then
  insert into public.training_records(organization_id,record_key,record_type,department_id,employee_user_id,payload,created_by,updated_by) values(v_program.organization_id,v_certificate_key,'certificate',v_assignment.department_id,v_assignment.employee_user_id,jsonb_build_object('id',v_certificate_key,'assignmentId',v_assignment.record_key,'employeeId',v_assignment.payload->>'employeeId','title',v_program.payload->>'title','issuedDate',v_now::date::text,'validUntil',case when nullif(v_program.payload->>'validMonths','') is null then null else (v_now::date+make_interval(months=>(v_program.payload->>'validMonths')::integer))::date::text end,'issuer','Limoxis Observer','issuedAt',v_now::text,'issuedById',case when auth.uid() is null then null else auth.uid()::text end),coalesce(auth.uid(),v_assignment.created_by),coalesce(auth.uid(),v_assignment.updated_by)) on conflict (organization_id,record_key) do nothing;
 end if;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'programId',v_program.record_key,'score',v_score,'competent',case when v_manual_review then null else v_competent end,'manualReviewRequired',v_manual_review,'certificateId',v_certificate_key,'attendanceConfirmedAt',v_payload->>'attendanceConfirmedAt','completedAt',v_payload->>'completionConfirmedAt','submittedAt',v_now);
end;$function$;

create or replace function public.training_confirm_attendance(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare v_assignment public.training_records%rowtype; v_now timestamptz:=now(); v_payload jsonb;
begin
 select * into v_assignment from public.training_records where record_type='assignment' and payload->>'accessToken'=p_token limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 if nullif(v_assignment.payload->>'feedbackSubmittedAt','') is not null then raise exception 'TRAINING_ALREADY_SUBMITTED'; end if;
 v_payload:=v_assignment.payload||jsonb_build_object('attendance',true,'attendanceResponse','confirmed','attendanceConfirmedAt',coalesce(v_assignment.payload->>'attendanceConfirmedAt',v_now::text),'status',case when coalesce(v_assignment.payload->>'status','assigned')='assigned' then 'in_progress' else coalesce(v_assignment.payload->>'status','assigned') end,'updatedAt',v_now::text,'updatedById',case when auth.uid() is null then null else auth.uid()::text end);
 update public.training_records set payload=v_payload,updated_by=coalesce(auth.uid(),updated_by),updated_at=v_now where id=v_assignment.id;
 return jsonb_build_object('assignmentId',v_assignment.record_key,'status',v_payload->>'status','attendanceConfirmedAt',v_payload->>'attendanceConfirmedAt');
end;$function$;

create or replace function public.queue_training_invitation(p_assignment_key text,p_language text default 'el')
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
  select * into v_assignment from public.training_records where record_type='assignment' and record_key=p_assignment_key and is_org_member(organization_id) limit 1;
  if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;
  if not (current_user_has_capability(v_assignment.organization_id,'manage_training') or current_user_has_org_role(v_assignment.organization_id,array['platform_owner','hospital_admin','infection_control_lead','quality_manager']::app_role[])) then raise exception 'TRAINING_MANAGE_REQUIRED'; end if;
  if nullif(v_assignment.payload->>'feedbackSubmittedAt','') is not null then raise exception 'TRAINING_ALREADY_SUBMITTED'; end if;
  select * into v_program from public.training_records where organization_id=v_assignment.organization_id and record_type='program' and record_key=v_assignment.payload->>'programId' limit 1;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
  v_email:=nullif(btrim(coalesce(v_assignment.payload->>'email','')),'');
  if v_email is null then raise exception 'TRAINING_PARTICIPANT_EMAIL_REQUIRED'; end if;
  v_token:=coalesce(nullif(v_assignment.payload->>'accessToken',''),'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-',''));
  if jsonb_typeof(v_program.payload->'assessmentQuestions')='array' then v_question_count:=jsonb_array_length(v_program.payload->'assessmentQuestions'); end if;
  v_payload:=v_assignment.payload||jsonb_build_object('accessToken',v_token,'invitationSentAt',v_now::text,'attendanceResponse',case when coalesce(v_assignment.payload->>'attendanceResponse','not_sent')='confirmed' then 'confirmed' else 'sent' end,'updatedAt',v_now::text,'updatedById',auth.uid()::text);
  update public.training_records set payload=v_payload,updated_by=auth.uid(),updated_at=v_now where id=v_assignment.id;
  v_subject:=case when lower(coalesce(p_language,'el'))='en' then 'Training confirmation & evaluation: '||coalesce(v_program.payload->>'title','') else 'Επιβεβαίωση συμμετοχής & αξιολόγηση: '||coalesce(v_program.payload->>'title','') end;
  v_outbox_payload:=jsonb_build_object('path','/training-access/'||v_token,'programTitle',v_program.payload->>'title','employeeName',v_assignment.payload->>'employeeName','dueDate',v_assignment.payload->>'dueDate','requiresAssessment',coalesce((v_program.payload->>'requiresAssessment')::boolean,false),'questionCount',v_question_count,'externalAccess',true,'language',case when lower(coalesce(p_language,'el'))='en' then 'en' else 'el' end);
  select id into v_outbox_id from public.notification_outbox where notification_type='training_invitation' and entity_type='training_assignment' and entity_id=v_assignment.id order by created_at desc limit 1;
  if v_outbox_id is null then
    insert into public.notification_outbox(organization_id,recipient_user_id,recipient_email,notification_type,entity_type,entity_id,subject,payload,status,attempts,available_at) values(v_assignment.organization_id,v_assignment.employee_user_id,v_email,'training_invitation','training_assignment',v_assignment.id,v_subject,v_outbox_payload,'pending',0,v_now) returning id into v_outbox_id;
  else
    update public.notification_outbox set organization_id=v_assignment.organization_id,recipient_user_id=v_assignment.employee_user_id,recipient_email=v_email,subject=v_subject,payload=v_outbox_payload,status='pending',attempts=0,available_at=v_now,sent_at=null,last_error=null,updated_at=v_now where id=v_outbox_id;
  end if;
  return jsonb_build_object('assignmentId',v_assignment.record_key,'outboxId',v_outbox_id,'queuedAt',v_now,'questionCount',v_question_count);
end;$function$;
