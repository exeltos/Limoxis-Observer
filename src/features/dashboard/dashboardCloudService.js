import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'

const countOf=async query=>{
  const {count,error}=await query
  if(error)return null
  return Number(count||0)
}

const startOfToday=()=>`${new Date().toISOString().slice(0,10)}T00:00:00.000Z`
const endOfToday=()=>`${new Date().toISOString().slice(0,10)}T23:59:59.999Z`
const addDays=(days)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}

export async function loadDashboardMetrics(organizationId){
  if(!hasSupabaseConfig||!supabase||!organizationId)return {}
  const now=new Date().toISOString(),today=new Date().toISOString().slice(0,10),monthAgo=addDays(-30),soon=addDays(30)
  const q=(table)=>supabase.from(table).select('id',{count:'exact',head:true}).eq('organization_id',organizationId)
  const entries=await Promise.all([
    ['activeUsers',countOf(q('organization_members').eq('status','active'))],
    ['activeDepartments',countOf(q('departments').eq('is_active',true))],
    ['inpatients',countOf(q('patients').is('discharge_date',null))],
    ['activeSurveillance',countOf(q('surveillance_cases').eq('status','active'))],
    ['isolationReviewsDue',countOf(q('isolation_episodes').eq('status','active').lte('review_due_at',now))],
    ['overdueControls',countOf(q('control_assignments').lt('next_due_at',now).not('status','in','("completed","cancelled")'))],
    ['pendingSamples',countOf(q('laboratory_samples').not('status','in','("completed","validated","cancelled","rejected")'))],
    ['newSamplesToday',countOf(q('laboratory_samples').gte('created_at',startOfToday()).lte('created_at',endOfToday()))],
    ['positiveLab',countOf(q('microbiology_results').eq('result_status','positive'))],
    ['criticalUncommunicated',countOf(q('microbiology_results').eq('is_critical',true).is('critical_communicated_at',null))],
    ['recentMdro',countOf(q('microbiology_results').in('resistance_class',['MDR','XDR','PDR']).gte('resulted_at',`${monthAgo}T00:00:00.000Z`))],
    ['activeEmployees',countOf(q('employees').eq('employment_status','active'))],
    ['newEmployees30d',countOf(q('employees').gte('created_at',`${monthAgo}T00:00:00.000Z`))],
    ['ohVisitsToday',countOf(q('occupational_health_visits').eq('visit_date',today))],
    ['ohFollowupsDue',countOf(q('occupational_health_visits').not('follow_up_date','is',null).lte('follow_up_date',today).not('status','in','("completed","closed","cancelled")'))],
    ['vaccinationsDue',countOf(q('employee_vaccinations').not('valid_until','is',null).gte('valid_until',today).lte('valid_until',soon))],
    ['openIncidents',countOf(q('quality_incidents').not('status','in','("closed","completed","cancelled")'))],
    ['severeOpenIncidents',countOf(q('quality_incidents').eq('severity','high').not('status','in','("closed","completed","cancelled")'))],
    ['overdueCapa',countOf(q('quality_capa_actions').lt('due_date',today).not('status','in','("completed","closed","cancelled")'))],
    ['upcomingMeetings',countOf(q('committee_meetings').gte('scheduled_at',now).neq('status','cancelled'))],
    ['pendingMinutes',countOf(q('committee_meetings').lte('scheduled_at',now).is('finalized_at',null).neq('status','cancelled'))],
    ['openDecisions',countOf(q('committee_decisions').not('status','in','("completed","closed","cancelled")'))],
  ])
  return Object.fromEntries(entries.filter(([,value])=>value!==null))
}
