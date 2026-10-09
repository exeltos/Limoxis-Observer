-- Row-level security check: no user sees another hospital's records, and a
-- department user sees only their own department.
--
-- Everything runs inside one DO block that always ends by raising an exception,
-- so the test data is rolled back and nothing stays in the database. The
-- exception message carries the result:
--   RLS_PASS <json>  every check passed
--   RLS_FAIL <json>  the checks listed under "failed" did not pass
-- Run it against any copy of the database (or production: it leaves no trace):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f supabase/tests/rls_tenant_isolation.sql
do $rls$
declare
  org_a uuid := gen_random_uuid(); org_b uuid := gen_random_uuid();
  dep_a1 uuid := gen_random_uuid(); dep_a2 uuid := gen_random_uuid(); dep_b1 uuid := gen_random_uuid();
  u_admin_a uuid := gen_random_uuid(); u_ipc_a uuid := gen_random_uuid(); u_dept_a1 uuid := gen_random_uuid();
  u_admin_b uuid := gen_random_uuid(); u_outsider uuid := gen_random_uuid();
  m_dept uuid := gen_random_uuid();
  p_a1 uuid := gen_random_uuid(); p_a2 uuid := gen_random_uuid(); p_b1 uuid := gen_random_uuid();
  checks jsonb := '[]'::jsonb; failed jsonb := '[]'::jsonb;
  u record; t text; n bigint; foreign_rows bigint; wrong_dept bigint;
  tables text[] := array['patients','surveillance_cases','laboratory_samples','quality_incidents','departments'];
begin
  insert into public.organizations(id,name,code,is_demo) values (org_a,'RLS test A','RLS-A-'||left(org_a::text,8),false),(org_b,'RLS test B','RLS-B-'||left(org_b::text,8),false);
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','rls-'||id||'@example.test','{}','{}',now(),now()
  from unnest(array[u_admin_a,u_ipc_a,u_dept_a1,u_admin_b,u_outsider]) id;
  insert into public.organization_members(organization_id,user_id,role,status) values
    (org_a,u_admin_a,'hospital_admin','active'),(org_a,u_ipc_a,'infection_control_lead','active'),(org_b,u_admin_b,'hospital_admin','active');
  -- Audit triggers require an acting member of the organization for each insert.
  perform set_config('request.jwt.claims', json_build_object('sub',u_admin_a,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin_a::text, true);
  insert into public.departments(id,organization_id,name) values (dep_a1,org_a,'A1'),(dep_a2,org_a,'A2');
  insert into public.organization_members(id,organization_id,user_id,role,status) values (m_dept,org_a,u_dept_a1,'department_user','active');
  insert into public.organization_member_scopes(membership_id,department_id) values (m_dept,dep_a1);
  insert into public.patients(id,organization_id,patient_code,department_id,created_by) values
    (p_a1,org_a,'RLS-PA1',dep_a1,u_admin_a),(p_a2,org_a,'RLS-PA2',dep_a2,u_admin_a);
  insert into public.surveillance_cases(organization_id,patient_id,department_id,created_by) values
    (org_a,p_a1,dep_a1,u_admin_a),(org_a,p_a2,dep_a2,u_admin_a);
  insert into public.laboratory_samples(organization_id,patient_id,department_id,sample_code,sample_type,created_by,requested_at,collected_at) values
    (org_a,p_a1,dep_a1,'RLS-SA1','blood',u_admin_a,now(),now()),(org_a,p_a2,dep_a2,'RLS-SA2','blood',u_admin_a,now(),now());
  insert into public.quality_incidents(organization_id,code,title,department_id,occurred_at,severity) values
    (org_a,'RLS-QA1','RLS A1',dep_a1,now(),'low'),(org_a,'RLS-QA2','RLS A2',dep_a2,now(),'low');
  perform set_config('request.jwt.claims', json_build_object('sub',u_admin_b,'role','authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin_b::text, true);
  insert into public.departments(id,organization_id,name) values (dep_b1,org_b,'B1');
  insert into public.patients(id,organization_id,patient_code,department_id,created_by) values (p_b1,org_b,'RLS-PB1',dep_b1,u_admin_b);
  insert into public.surveillance_cases(organization_id,patient_id,department_id,created_by) values (org_b,p_b1,dep_b1,u_admin_b);
  insert into public.laboratory_samples(organization_id,patient_id,department_id,sample_code,sample_type,created_by,requested_at,collected_at) values (org_b,p_b1,dep_b1,'RLS-SB1','blood',u_admin_b,now(),now());
  insert into public.quality_incidents(organization_id,code,title,department_id,occurred_at,severity) values (org_b,'RLS-QB1','RLS B1',dep_b1,now(),'low');

  for u in select * from (values
      ('hospital_admin A',u_admin_a,org_a,false),('infection_control_lead A',u_ipc_a,org_a,false),
      ('department_user A1',u_dept_a1,org_a,true),('hospital_admin B',u_admin_b,org_b,false),
      ('no membership',u_outsider,null::uuid,false)) v(label,id,org,dept_only)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub',u.id,'role','authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    execute 'set local role authenticated';
    foreach t in array tables loop
      -- Only the test organizations are counted, so real data never affects the result.
      execute format('select count(*) filter (where organization_id in ($1,$2) and organization_id is distinct from $3),
                             count(*) filter (where organization_id = $3 and %s)
                      from public.%I', case when t='departments' then 'id <> $4' else 'department_id <> $4' end, t)
        into foreign_rows, wrong_dept using org_a, org_b, u.org, dep_a1;
      checks := checks || jsonb_build_object('user',u.label,'table',t,'other_hospital_rows',foreign_rows,'other_department_rows',case when u.dept_only then wrong_dept end);
      if foreign_rows > 0 or (u.dept_only and t <> 'departments' and wrong_dept > 0) then
        failed := failed || jsonb_build_object('user',u.label,'table',t,'other_hospital_rows',foreign_rows,'other_department_rows',wrong_dept);
      end if;
    end loop;
    -- Positive control: a hospital administrator must still see their own hospital's patients.
    if u.label like 'hospital_admin%' then
      execute 'select count(*) from public.patients where organization_id = $1' into n using u.org;
      if n = 0 then failed := failed || jsonb_build_object('user',u.label,'table','patients','sees_own_hospital',false); end if;
    end if;
    execute 'reset role';
  end loop;

  -- Anonymous visitors see nothing.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  foreach t in array tables loop
    begin
      execute format('select count(*) from public.%I where organization_id in ($1,$2)', t) into n using org_a, org_b;
    exception when insufficient_privilege then n := 0;
    end;
    if n > 0 then failed := failed || jsonb_build_object('user','anon','table',t,'rows',n); end if;
  end loop;
  execute 'reset role';

  if jsonb_array_length(failed) = 0 then
    raise exception 'RLS_PASS %', jsonb_build_object('checks',jsonb_array_length(checks)+5);
  else
    raise exception 'RLS_FAIL %', jsonb_build_object('failed',failed);
  end if;
end
$rls$;
