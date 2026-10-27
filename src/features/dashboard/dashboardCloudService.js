import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { periodBounds } from '../controls/controlDueRules'

const countOf=async query=>{
  const {count,error}=await query
  if(error)return null
  return Number(count||0)
}

const startOfToday=()=>`${new Date().toISOString().slice(0,10)}T00:00:00.000Z`
const endOfToday=()=>`${new Date().toISOString().slice(0,10)}T23:59:59.999Z`
const addDays=(days)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

// The home page and the bell ask for the same counts when the home page
// opens: one read serves both for a short while.
const SHARE_MS=30*1000
const shared=new Map()
export function forgetDashboardMetrics(){shared.clear()}

// `departmentIds` narrows the department-level counts to a department role's own departments.
export function loadDashboardMetrics(organizationId,{departmentIds=null}={}){
  if(!hasSupabaseConfig||!supabase||!organizationId)return Promise.resolve({})
  const key=`${organizationId}|${departmentIds?.length?[...departmentIds].sort().join(','):'*'}`
  const now=Date.now(),hit=shared.get(key)
  if(hit&&now-hit.at<SHARE_MS)return hit.promise
  const promise=readDashboardMetrics(organizationId,departmentIds)
  shared.set(key,{at:now,promise})
  promise.catch(()=>{if(shared.get(key)?.promise===promise)shared.delete(key)})
  return promise
}

// One call (dashboard_metrics, 20261127100000) returns every count; the
// separate counts below are kept for a database without it yet.
async function readDashboardMetrics(organizationId,departmentIds){
  const [metrics,dueToday]=await Promise.all([readAllMetrics(organizationId,departmentIds),departmentIds?.length?countControlsDueToday(organizationId,departmentIds):null])
  return dueToday===null?metrics:{...metrics,controlsDueToday:dueToday}
}
async function readAllMetrics(organizationId,departmentIds){
  if(typeof supabase.rpc==='function'){
    const {data,error}=await supabase.rpc('dashboard_metrics',{p_organization_id:organizationId,p_department_ids:departmentIds?.length?departmentIds:null})
    if(!error&&data&&typeof data==='object')return Object.fromEntries(Object.entries(data).map(([key,value])=>[key,Number(value||0)]))
  }
  return readDashboardCounts(organizationId,departmentIds)
}
// A department's controls to record today: due by the end of today (Athens), overdue ones included, paused ones not.
function countControlsDueToday(organizationId,departmentIds){
  const end=periodBounds({kind:'daily'},new Date()).end.toISOString()
  return countOf(supabase.from('control_assignments').select('id',{count:'exact',head:true}).eq('organization_id',organizationId).in('department_id',departmentIds).eq('status','scheduled').lt('next_due_at',end))
}

async function readDashboardCounts(organizationId,departmentIds){
  const now=new Date().toISOString(),today=new Date().toISOString().slice(0,10),monthAgo=addDays(-30),soon=addDays(30)
  const q=(table)=>supabase.from(table).select('id',{count:'exact',head:true}).eq('organization_id',organizationId)
  const departmental=departmentIds?.length?(table)=>q(table).in('department_id',departmentIds):q
  const pending=[
    ['activeUsers',countOf(q('organization_members').eq('status','active'))],
    ['activeDepartments',countOf(q('departments').eq('is_active',true))],
    ['patientDayPeriods',countOf(q('patient_day_periods'))],
    ['inpatients',countOf(departmental('patients').is('discharge_date',null))],
    ['activeSurveillance',countOf(departmental('surveillance_cases').eq('status','active'))],
    ['isolationReviewsDue',countOf(departmental('isolation_episodes').eq('status','active').lte('review_due_at',now))],
    ['overdueControls',countOf(departmental('control_assignments').lt('next_due_at',now).not('status','in','("completed","cancelled")'))],
    ['pendingSamples',countOf(departmental('laboratory_samples').not('status','in','("completed","validated","cancelled","rejected")'))],
    ['newSamplesToday',countOf(q('laboratory_samples').gte('created_at',startOfToday()).lte('created_at',endOfToday()))],
    ['positiveLab',countOf(q('microbiology_results').eq('result_status','positive'))],
    ['criticalUncommunicated',countOf(q('microbiology_results').eq('is_critical',true).is('critical_communicated_at',null))],
    ['recentMdro',countOf(q('microbiology_results').in('resistance_class',['MDR','XDR','PDR']).gte('resulted_at',`${monthAgo}T00:00:00.000Z`))],
    ['employeesWithoutDepartment',countOf(q('employees').eq('employment_status','active').is('department_id',null))],
    ['activeEmployees',countOf(q('employees').eq('employment_status','active'))],
    ['newEmployees30d',countOf(q('employees').gte('created_at',`${monthAgo}T00:00:00.000Z`))],
    ['ohVisitsToday',countOf(q('occupational_health_visits').eq('visit_date',today))],
    ['ohFollowupsDue',countOf(q('occupational_health_visits').not('follow_up_date','is',null).lte('follow_up_date',today).not('status','in','("completed","closed","cancelled")'))],
    ['vaccinationsDue',countOf(q('employee_vaccinations').not('valid_until','is',null).gte('valid_until',today).lte('valid_until',soon))],
    ['openIncidents',countOf(q('quality_incidents').not('status','in','("closed","completed","cancelled")'))],
    ['severeOpenIncidents',countOf(q('quality_incidents').eq('severity','high').not('status','in','("closed","completed","cancelled")'))],
    ['overdueCapa',countOf(q('quality_capa_actions').lt('due_date',today).not('status','in','("completed","closed","cancelled")'))],
    ['pendingApprovals',countOf(q('antimicrobial_therapies').eq('approval_status','pending'))],
    ['antimicrobialTherapies',countOf(q('antimicrobial_therapies'))],
    ['administrations',countOf(q('antimicrobial_therapy_administrations').eq('status','administered'))],
    ['upcomingMeetings',countOf(q('committee_meetings').gte('scheduled_at',now).neq('status','cancelled'))],
    ['pendingMinutes',countOf(q('committee_meetings').lte('scheduled_at',now).is('finalized_at',null).neq('status','cancelled'))],
    ['openDecisions',countOf(q('committee_decisions').not('status','in','("completed","closed","cancelled")'))],
  ]
  // Each pair holds a promise; await the counts themselves, not the pairs.
  const entries=await Promise.all(pending.map(async([key,count])=>[key,await count]))
  return Object.fromEntries(entries.filter(([,value])=>value!==null))
}
