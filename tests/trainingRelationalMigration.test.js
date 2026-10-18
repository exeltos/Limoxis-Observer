import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261115100000_training_relational.sql')
const manifest=JSON.parse(read('supabase/security-definer-manifest.json')).functions
const fn=name=>{const start=migration.indexOf(`create or replace function ${name}(`);expect(start,name).toBeGreaterThan(-1);return migration.slice(start,migration.indexOf('$function$;',start))}
const TABLES=['training_programs','training_program_materials','training_assessment_questions','training_assessment_options','training_program_effectiveness','training_program_feedback_questions','training_assignments','training_assessment_answers','training_feedback_responses','training_feedback_scores','training_certificates','training_requirements','training_requirement_programs','training_requirement_targets','training_feedback_templates','training_feedback_template_questions','training_history_events']
const tableDefinition=name=>{const start=migration.indexOf(`create table public.${name} (`);return migration.slice(start,migration.indexOf('\n);',start))}

describe('training relational migration: tables',()=>{
 it('creates every table with its organization, audit stamps, trigger and row level security',()=>{
  for(const table of TABLES){
   const definition=tableDefinition(table)
   expect(definition,table).toContain('organization_id uuid not null references public.organizations(id) on delete cascade')
   for(const column of ['created_by uuid','updated_by uuid','created_at timestamptz not null default now()','updated_at timestamptz not null default now()'])expect(definition,table).toContain(column)
  }
  const loops=migration.match(/foreach v_table in array array\[([^\]]+)\]/g)
  for(const table of TABLES)for(const loop of loops.slice(0,2))expect(loop).toContain(`'${table}'`)
  expect(migration).toContain("execute format('create trigger trg_%s_audit before insert or update on public.%I for each row execute function public.set_repository_audit_fields()', v_table, v_table)")
  expect(migration).toContain("execute format('alter table public.%I enable row level security', v_table)")
  expect(migration).toContain("execute format('revoke all on table public.%I from public, anon, authenticated', v_table)")
 })

 it('keeps every value in a real column: no json/jsonb column in any training table',()=>{
  for(const table of TABLES)expect(tableDefinition(table),table).not.toMatch(/\bjsonb?\b/)
 })

 it('keys records as before and links assignments to employees and programmes',()=>{
  expect(tableDefinition('training_programs')).toContain('unique (organization_id, program_key)')
  const assignments=tableDefinition('training_assignments')
  for(const part of ['unique (organization_id, assignment_key)','employee_id uuid references public.employees(id) on delete set null','employee_code text','department_id uuid references public.departments(id) on delete set null','employee_user_id uuid references auth.users(id) on delete set null','foreign key (program_id, organization_id) references public.training_programs(id, organization_id)\n'])expect(assignments+'\n').toContain(part)
  expect(migration).toContain('create unique index training_assignments_access_token_key on public.training_assignments (access_token) where access_token is not null;')
  expect(tableDefinition('training_certificates')).toContain('assignment_id uuid not null unique')
  expect(tableDefinition('training_program_effectiveness')).toContain("result text check (result is null or result in ('effective','partial','not_effective'))")
  for(const column of ['evaluated_at date','evaluated_by text','notes text','comment text'])expect(tableDefinition('training_program_effectiveness')).toContain(column)
  expect(tableDefinition('training_assignments')).toContain("assessment_review_status in ('not_required','pending','reviewed')")
  expect(tableDefinition('training_assessment_answers')).toContain("answer_kind text not null check (answer_kind in ('text','boolean','number','options'))")
 })
})

describe('training relational migration: copy',()=>{
 it('keeps the old row ids and record keys',()=>{
  for(const [table,key] of [['training_programs','r.record_key, coalesce'],['training_assignments','r.record_key, p.id'],['training_certificates','r.record_key, a.id'],['training_requirements','r.record_key, coalesce']]){
   const start=migration.indexOf(`insert into public.${table}(id,`)
   expect(start,table).toBeGreaterThan(-1)
   expect(migration.slice(start,start+2400)).toContain(`select r.id, r.organization_id, ${key}`)
  }
 })

 it('splits answers by their JSON type and keeps array order',()=>{
  expect(migration).toContain("case jsonb_typeof(a.value) when 'string' then 'text' when 'boolean' then 'boolean' when 'number' then 'number' else 'options' end")
  expect(migration).toContain("jsonb_array_elements(case when jsonb_typeof(r.payload->'assessmentQuestions') = 'array' then r.payload->'assessmentQuestions' else '[]'::jsonb end) with ordinality q(value, ord)")
 })

 it('verifies the copy against training_records and aborts on any difference',()=>{
  const verify=migration.slice(migration.indexOf('do $verify$'),migration.indexOf('$verify$;'))
  for(const label of ['programs','materials','questions','options','effectiveness','assignments','answers','feedback responses','feedback scores','certificates','requirements','requirement programs','requirement targets','feedback templates','history events'])expect(verify).toContain(`('${label}',`)
  expect(verify).toContain("raise exception 'TRAINING_RELATIONAL_COPY_MISMATCH: %'")
  expect(verify).toContain('c.certificate_key is distinct from nullif(r.payload->>\'certificateId\', \'\')')
 })

 it('creates the audit triggers only after the copy, so the copied stamps stay',()=>{
  expect(migration.indexOf("create trigger trg_%s_audit")).toBeGreaterThan(migration.indexOf('$verify$;'))
 })
})

describe('training relational migration: access',()=>{
 it('mirrors training_records_read',()=>{
  expect(migration).toContain('create policy training_programs_read on public.training_programs for select to authenticated\n  using (public.is_org_member(organization_id)')
  const assignments=migration.slice(migration.indexOf('create policy training_assignments_read'),migration.indexOf('create policy training_certificates_read'))
  for(const part of ["array['hospital_admin','infection_control_lead','infection_control_member','hr_office']","public.current_user_has_department_scope(organization_id, department_id)",'employee_user_id = (select auth.uid())',"public.current_user_has_capability(organization_id, 'manage_training')"])expect(assignments).toContain(part)
  for(const child of ['training_program_materials','training_assessment_questions','training_assessment_answers','training_feedback_responses','training_feedback_scores','training_requirement_targets'])expect(migration).toMatch(new RegExp(`create policy ${child}_read on public\\.${child} for select to authenticated\\n {2}using \\(exists \\(select 1 from public\\.training_`))
 })

 it('lets only manage_training write what managers edit; the learner tables only through the RPCs',()=>{
  const writable=migration.match(/foreach v_table in array array\[([^\]]+)\]\n {2}loop\n {4}execute format\('grant insert, update, delete/)[1]
  for(const table of ['training_assessment_answers','training_feedback_responses','training_feedback_scores','training_certificates','training_history_events'])expect(writable).not.toContain(`'${table}'`)
  expect(migration).toContain("with check (public.current_user_has_capability(organization_id, ''manage_training''))")
 })
})

describe('training relational migration: RPCs',()=>{
 it('keeps the token RPCs, their names, arguments and checks',()=>{
  const access=fn('public.training_email_access')
  expect(access).toContain('security definer')
  expect(access).toContain('a.access_token=p_token')
  expect(access).toContain("(private.training_assignment_json(v_assignment.id)-'accessToken')||jsonb_build_object('externalAccess',true,'tokenOnlyAccess',true)")
  expect(access).toContain('private.training_program_json(v_assignment.program_id,true)')
  const submit=fn('public.training_submit_evaluation')
  expect(submit).toContain('public.training_submit_evaluation(p_token text, p_answers jsonb default \'{}\'::jsonb, p_feedback_scores jsonb default \'{}\'::jsonb, p_feedback_comment text default null::text, p_attendance_attested boolean default false)')
  for(const part of ["raise exception 'TRAINING_ALREADY_SUBMITTED'","raise exception 'TRAINING_ATTENDANCE_ATTESTATION_REQUIRED'","raise exception 'TRAINING_ASSESSMENT_INCOMPLETE'","if v_question.manual_review then v_manual_review:=true; end if;","assessment_review_status=case when v_manual_review then 'pending' else 'not_required' end","private.training_issue_certificate(v_assignment.id,v_now)","'manualReviewRequired',v_manual_review"])expect(submit).toContain(part)
  const queue=fn('public.queue_training_invitation')
  for(const part of ["raise exception 'TRAINING_MANAGE_REQUIRED'","'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-','')","'training_invitation','training_assignment',v_assignment.id","'path','/training-access/'||v_token"])expect(queue).toContain(part)
 })

 it('builds the public programme without correct answers or collected evaluations',()=>{
  const program=fn('private.training_program_json')
  expect(program).toContain("case when p_public then jsonb_build_object('id', o.option_key, 'text', o.text)")
  expect(program).toContain("case when p_public then '{}'::jsonb else jsonb_build_object('correctBoolean'")
  expect(program).toContain("case when p_public then '{}'::jsonb else jsonb_build_object('feedbackResponses'")
 })

 it('finishes a pending manual review: score, competence, completion, certificate',()=>{
  const review=fn('public.training_finalize_review')
  for(const part of ['security definer',"current_user_has_capability(p_organization_id,'manage_training')","raise exception 'TRAINING_REVIEW_NOT_PENDING'",'v_awarded:=least(v_question.points,greatest(0,v_given));',"assessment_review_status='reviewed'","status='completed'",'assessment_review_note=','private.training_issue_certificate(v_assignment.id,v_now)'])expect(review).toContain(part)
  expect(migration).toContain('grant execute on function public.training_finalize_review(uuid,text,jsonb,boolean,text) to authenticated, service_role;')
  expect(manifest.training_finalize_review).toMatchObject({category:'rpc',authenticated:true})
 })

 it('saves programmes, assignments and requirements through SECURITY INVOKER RPCs',()=>{
  for(const name of ['public.training_save_program','public.training_save_assignment','public.training_save_state','public.training_save_requirement','public.training_delete_record']){
   const body=fn(name)
   expect(body,name).toContain('security invoker')
   expect(body,name).toContain("public.current_user_has_capability(p_organization_id, 'manage_training')")
  }
  expect(fn('public.training_save_program')).toContain("if p_program ? 'effectiveness' then")
  for(const name of ['training_save_program','training_save_assignment','training_save_state','training_save_requirement','training_delete_record'])expect(manifest[name],name).toBeUndefined()
 })
})

describe('training relational migration: readers, Demo and the old table',()=>{
 it('re-creates the readers of training on the new tables',()=>{
  expect(fn('private.indicator_metric_snapshot')).toContain("from public.training_assignments t where t.organization_id=p_organization_id and coalesce(t.assigned_date,t.created_at::date) between p_from and p_to")
  expect(fn('public.platform_report_summary')).toContain("'training',(select count(*) from public.training_assignments t where")
  expect(migration).toContain("'trainingAssignments', (select count(*) from public.training_assignments x where x.organization_id = v_org)")
  const tail=migration.slice(migration.indexOf('-- 10. Database objects that read training'))
  expect(tail.slice(0,tail.indexOf('-- 12. Freeze training_records'))).not.toContain('training_records')
 })

 it('seeds the Demo into the new tables without SELECT ... INTO',()=>{
  const seeds=migration.slice(migration.indexOf('-- 11. Demo seeds'),migration.indexOf('-- 12. Freeze training_records')).replace(/--[^\n]*/g,'')
  for(const table of ['training_programs','training_requirements','training_requirement_programs','training_requirement_targets','training_assignments','training_certificates','training_feedback_templates','training_assessment_answers','training_feedback_responses','training_feedback_scores','training_program_materials','training_assessment_questions','training_assessment_options','training_program_effectiveness','training_history_events'])expect(seeds).toContain(`insert into public.${table}(`)
  expect(seeds).not.toMatch(/\bselect\b[^;]*\binto\b(?!\s+public\.)/i)
 })

 it('freezes training_records instead of dropping it',()=>{
  expect(migration).not.toMatch(/drop table[^;]*training_records/i)
  expect(migration).toContain('drop trigger if exists trg_project_training_assignment_identity on public.training_records;')
  expect(migration).toContain('revoke insert, update, delete, truncate on table public.training_records from public, anon, authenticated;')
  expect(migration).toContain("raise exception 'TRAINING_RECORDS_FROZEN'")
  expect(migration).toContain("if tg_op = 'DELETE' and coalesce(current_setting('limoxis.test_reset', true), '') = 'on' then return old; end if;")
 })
})
