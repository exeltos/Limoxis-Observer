import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { trainingAssessmentIsValid,normalizeTrainingQuestion } from '../src/features/training/trainingAssessment'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const migration=read('supabase/migrations/20261118100000_demo_training_richer.sql')
const fn=name=>{const start=migration.indexOf(`create or replace function ${name}(`);expect(start,name).toBeGreaterThan(-1);return migration.slice(start,migration.indexOf('$function$;',start))}
const sqlJson=text=>JSON.parse(text.replace(/''/g,"'"))
// The compact question rows of private.demo_training_questions(), with the defaults the seed applies.
const questionRows=()=>[...fn('private.demo_training_questions').matchAll(/\('(TRN-DEMO-\d{3})', '(.*?)'::jsonb, '(.*?)'::jsonb\)/g)].map(([,key,questions,patterns])=>({
 key,
 questions:sqlJson(questions).map(q=>({...q,required:q.required??q.type!=='free_text',correctBoolean:q.correctBoolean??true,modelAnswer:q.modelAnswer||'',manualReview:!!q.manualReview,options:(q.options||[]).map(o=>({...o,correct:!!o.correct}))})),
 patterns:sqlJson(patterns),
}))
const programRows=()=>[...fn('private.demo_seed_training').matchAll(/\('(TRN-DEMO-\d{3})', '[^']*', '[^']*', '(\w+)', '(\w+)', '(\w+)', '(\w+)',\s+'[^']*', '[^']*', '[^']*', '[^']*',\s+(-?\d+), (\d+), '([\d:]+)', ([\d.]+), '[^']+', (\d+), (\d+), (true|false), (\d+|null)\)/g)]
 .map(([,key,category,method,delivery,status,start,len,,hours,cost,valid,assess,pass])=>({key,category,method,delivery,status,start:Number(start),len:Number(len),hours:Number(hours),cost:Number(cost),valid:Number(valid),assess:assess==='true',pass:pass==='null'?null:Number(pass)}))

describe('richer Demo training seed (20261118100000)',()=>{
 it('only replaces the two seed functions (and a private helper): no removals, no e-mail, no notifications, no tokens',()=>{
  expect(migration).not.toMatch(/\b(delete|drop|truncate)\b/i)
  expect(migration).not.toMatch(/notification_outbox|queue_training_invitation|gen_random_uuid/)
  expect(migration.match(/access_token[^,\n]*/g)).toEqual(['access_token','access_token = null'])
  expect([...migration.matchAll(/create or replace function ([\w.]+)\(([^)]*)\)/g)].map(m=>`${m[1]}(${m[2]})`)).toEqual([
   'private.demo_training_questions()','private.demo_seed_training(p_organization_id uuid, p_actor uuid)','private.demo_seed_people_training(p_organization_id uuid, p_actor uuid)'])
  for(const signature of ['private.demo_training_questions()','private.demo_seed_training(uuid, uuid)','private.demo_seed_people_training(uuid, uuid)'])
   expect(migration).toContain(`revoke all on function ${signature} from public, anon, authenticated;`)
  for(const name of ['private.demo_seed_training','private.demo_seed_people_training'])expect(fn(name)).toContain("raise exception 'Only Demo organizations can be filled with Demo data'")
 })

 it('keeps the keys other Demo data and earlier runs use, and writes every row as an upsert on them',()=>{
  const seed=fn('private.demo_seed_training')
  for(const key of ['TRN-DEMO-001','TRN-DEMO-002','TRN-DEMO-003','TRN-DEMO-004','TRN-DEMO-005','REQ-DEMO-001','REQ-DEMO-002','TRAINER-FEEDBACK-DEFAULT'])expect(seed).toContain(`'${key}'`)
  expect(seed).toContain("'TRA-DEMO-' || x.n || '-' || lpad(x.g::text, 3, '0')")
  for(const target of ['(organization_id, program_key)','(program_id, material_key)','(program_id, question_key)','(program_id)','(question_id, option_key)','(organization_id, requirement_key)','(organization_id, assignment_key)','(assignment_id, question_key)','(assignment_id)'])
   expect(seed).toContain(`on conflict ${target} do update set`)
  expect(seed.match(/insert into public\./g).length).toBe(seed.match(/on conflict \(/g).length)
  // Certificates as the app issues them (private.training_issue_certificate).
  expect(seed).toContain("'CERT-' || a.assignment_key")
  expect(seed).toContain("'Limoxis Observer'")
  expect(fn('private.demo_seed_people_training')).toContain('where e.organization_id = v_org and e.position = n.pos')
 })

 it('has 22 moderate programmes with every detail filled, three of them planned in the next three months',()=>{
  const rows=programRows()
  expect(rows.map(r=>r.key)).toEqual(Array.from({length:22},(_,i)=>`TRN-DEMO-${String(i+1).padStart(3,'0')}`))
  for(const r of rows){
   expect(['ipc','clinical','quality','occupational_health','mandatory'],r.key).toContain(r.category)
   expect(['in_person','online','hybrid','on_the_job'],r.key).toContain(r.method)
   expect(['internal','external','intra_department'],r.key).toContain(r.delivery)
   expect(r.hours,r.key).toBeGreaterThan(0)
   expect(r.start,r.key).toBeGreaterThanOrEqual(-540)
   if(r.status==='planned')expect(r.start,r.key).toBeGreaterThan(0)
   if(r.status==='planned')expect(r.start,r.key).toBeLessThanOrEqual(92)
   if(r.status==='completed')expect(r.start+r.len,r.key).toBeLessThan(0)
   if(r.status==='active')expect(r.start+r.len,r.key).toBeGreaterThan(0)
   if(r.delivery==='external')expect(r.cost,r.key).toBeGreaterThan(0)
  }
  expect(rows.filter(r=>r.status==='planned').length).toBe(3)
 })

 it('gives the programmes with an assessment valid questions and answer patterns that pass, mostly at 85–95',()=>{
  const rows=questionRows(),programs=new Map(programRows().map(r=>[r.key,r])),scores=[]
  expect(rows.map(r=>r.key).sort()).toEqual(programRows().filter(r=>r.assess).map(r=>r.key).sort())
  for(const {key,questions,patterns} of rows){
   expect(trainingAssessmentIsValid(questions.map(normalizeTrainingQuestion)),key).toBe(true)
   const points=new Map(questions.map(q=>[q.id,q.points])),scored=questions.filter(q=>q.type!=='free_text'||q.manualReview)
   const total=scored.reduce((sum,q)=>sum+q.points,0)
   for(const pattern of patterns){
    for(const id of pattern)expect(points.has(id),`${key} ${id}`).toBe(true)
    const score=Math.round(100*(total-pattern.reduce((sum,id)=>sum+points.get(id),0))/total)
    expect(score,`${key} ${pattern}`).toBeGreaterThanOrEqual(programs.get(key).pass)
    expect(score).toBeGreaterThanOrEqual(75)
    scores.push(score)
   }
  }
  expect(scores.filter(s=>s>=85&&s<=95).length/scores.length).toBeGreaterThan(0.6)
 })

 it('records effectiveness mostly as effective, with two partial, by a fictional quality officer',()=>{
  const seed=fn('private.demo_seed_training')
  expect(seed.match(/'(effective|partial)', '/g).filter(x=>x.includes('partial')).length).toBe(2)
  expect(seed.match(/'effective', '/g).length).toBeGreaterThanOrEqual(12)
  expect(seed).toContain("v_quality constant text := 'Ε. Σταματίου, Υπεύθυνη Ποιότητας'")
  expect(seed).not.toMatch(/'not_effective'/)
 })
})
