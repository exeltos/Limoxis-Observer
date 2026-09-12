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
begin
  if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;

  select * into v_assignment
  from public.training_records
  where record_type='assignment'
    and employee_user_id=auth.uid()
    and payload->>'accessToken'=p_token
    and is_org_member(organization_id)
  limit 1;
  if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;

  select * into v_program
  from public.training_records
  where organization_id=v_assignment.organization_id
    and record_type='program'
    and record_key=v_assignment.payload->>'programId'
  limit 1;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;

  v_program_payload := (v_program.payload - 'feedbackResponses') || jsonb_build_object('id',v_program.record_key);
  if jsonb_typeof(v_program_payload->'assessmentQuestions')='array' then
    v_program_payload := jsonb_set(
      v_program_payload,
      '{assessmentQuestions}',
      coalesce((select jsonb_agg(q - 'correctIndex') from jsonb_array_elements(v_program_payload->'assessmentQuestions') q),'[]'::jsonb),
      true
    );
  end if;

  return jsonb_build_object(
    'program', v_program_payload,
    'assignment', (v_assignment.payload - 'accessToken') || jsonb_build_object('id',v_assignment.record_key,'dbId',v_assignment.id,'userId',v_assignment.employee_user_id,'departmentId',v_assignment.department_id)
  );
end;
$function$;

revoke all on function public.training_email_access(text) from public, anon;
grant execute on function public.training_email_access(text) to authenticated;
