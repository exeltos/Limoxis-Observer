import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

function requireProduction(organizationId,committee,operation){
  if(isDemoDataEnvironment())throw new Error(`DEMO_COMMITTEE_WORKFLOW_LOCAL_ONLY:${operation}`)
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_COMMITTEES_ORGANIZATION_REQUIRED:${operation}`)
  if(!committee?.dbId)throw new Error(`PRODUCTION_COMMITTEE_DB_ID_REQUIRED:${operation}`)
}
function scheduledAt(meeting){if(meeting?.scheduledAt)return meeting.scheduledAt;const date=meeting?.date||new Date().toISOString().slice(0,10);const time=meeting?.time||'09:00';return `${date}T${time}:00`}
function normalizePriority(value){return ['low','medium','high','critical'].includes(value)?value:'medium'}
function normalizeWorkflowStatus(value){return ['open','in_progress','completed','cancelled'].includes(value)?value:'open'}
function normalizeAttendance(value){return ['not_recorded','present','absent','excused'].includes(value)?value:'not_recorded'}
async function appendHistory(organizationId,committee,action,reason,eventData={}){const {error}=await supabase.from('committee_history').insert({organization_id:organizationId,committee_id:committee.dbId,action,reason:reason||null,event_data:eventData||{}});if(error)throw error}

export async function createCommitteeMemberAsync(organizationId,committee,draft){
  requireProduction(organizationId,committee,'member.create')
  const clientKey=draft.id||`CM-${Date.now()}`
  const {data,error}=await supabase.from('committee_members').insert({organization_id:organizationId,committee_id:committee.dbId,client_key:clientKey,employee_id:draft.employeeDbId||null,user_id:draft.userId||null,member_name:draft.name,title:draft.committeeTitle||'Μέλος',responsibilities:draft.responsibilities||null,member_type:draft.memberType||'regular',has_vote:draft.voting!==false,approval_status:draft.approvalRequired?'pending':'not_required',started_at:(draft.startedAt||new Date().toISOString()).slice(0,10)}).select('id,client_key,employee_id,user_id,member_name,title,responsibilities,member_type,has_vote,approval_status,started_at,ended_at').single()
  if(error)throw error
  await appendHistory(organizationId,committee,'Προσθήκη μέλους',`${data.member_name} — ${data.title}`,{member_id:data.id,client_key:clientKey})
  return {...draft,id:clientKey,dbId:data.id,userId:data.user_id||null,employeeDbId:data.employee_id||null,name:data.member_name,committeeTitle:data.title,responsibilities:data.responsibilities||'',memberType:data.member_type,voting:data.has_vote,approvalStatus:data.approval_status,active:true,startedAt:data.started_at,endedAt:null}
}
export async function updateCommitteeMemberAsync(organizationId,committee,member,patch={}){
  requireProduction(organizationId,committee,'member.update');if(!member?.dbId)throw new Error('PRODUCTION_COMMITTEE_MEMBER_DB_ID_REQUIRED')
  const next={...member,...patch}
  const {data,error}=await supabase.from('committee_members').update({user_id:next.userId||null,title:next.committeeTitle||'Μέλος',responsibilities:next.responsibilities||null,member_type:next.memberType||'regular',has_vote:next.voting!==false}).eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('id',member.dbId).select('id,client_key,employee_id,user_id,member_name,title,responsibilities,member_type,has_vote,approval_status,started_at,ended_at').single()
  if(error)throw error
  await appendHistory(organizationId,committee,'Επεξεργασία στοιχείων μέλους',`${data.member_name} — ${data.title}`,{member_id:data.id})
  return {...next,dbId:data.id,userId:data.user_id||null,committeeTitle:data.title,responsibilities:data.responsibilities||'',memberType:data.member_type,voting:data.has_vote,approvalStatus:data.approval_status}
}
export async function endCommitteeMemberAsync(organizationId,committee,member,reason){
  requireProduction(organizationId,committee,'member.end');if(!member?.dbId)throw new Error('PRODUCTION_COMMITTEE_MEMBER_DB_ID_REQUIRED')
  const endedAt=new Date().toISOString().slice(0,10)
  const {data,error}=await supabase.from('committee_members').update({ended_at:endedAt}).eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('id',member.dbId).select('id,ended_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Λήξη συμμετοχής μέλους',`${member.name} — ${reason||''}`,{member_id:data.id,reason:reason||null})
  return {...member,active:false,endedAt:data.ended_at,endReason:reason||''}
}
export async function updateCommitteeFrameworkAsync(organizationId,committee,patch={}){
  requireProduction(organizationId,committee,'framework.update')
  const {data,error}=await supabase.from('committees').update({legal_basis:patch.legalBasis||null,committee_role:patch.committeeRole||null,decision_number:patch.decisionNumber||null,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',committee.dbId).select('legal_basis,committee_role,decision_number,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Ενημέρωση θεσμικού πλαισίου',data.decision_number||data.legal_basis||'—')
  return {...committee,legalBasis:data.legal_basis||'',committeeRole:data.committee_role||'',decisionNumber:data.decision_number||'',updatedAt:data.updated_at}
}

export async function createCommitteeMeetingAsync(organizationId,committee,draft){
  requireProduction(organizationId,committee,'meeting.create');const clientKey=draft.id||`MTG-${Date.now()}`
  const {data,error}=await supabase.from('committee_meetings').insert({organization_id:organizationId,committee_id:committee.dbId,client_key:clientKey,title:draft.title,scheduled_at:scheduledAt(draft),meeting_type:draft.meetingType==='extraordinary'?'extraordinary':'regular',location:draft.location||null,status:'planned',agenda:Array.isArray(draft.topics)?draft.topics:[],minutes:null}).select('id,client_key,title,scheduled_at,meeting_type,location,status,agenda,minutes_number,quorum_met,minutes,finalized_at,finalized_by,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Δημιουργία συνεδρίασης',draft.title,{meeting_id:data.id,client_key:clientKey})
  return {...draft,id:clientKey,dbId:data.id,scheduledAt:data.scheduled_at,status:data.status,meetingType:data.meeting_type,location:data.location||'',topics:Array.isArray(data.agenda)?data.agenda:[],attendanceRecords:[],quorum:null,minutesNo:'',generalNotes:'',approvalState:'not_started'}
}
async function syncAttendance(organizationId,committee,meeting,attendanceRecords=[]){
  if(!meeting?.dbId)throw new Error('PRODUCTION_COMMITTEE_MEETING_DB_ID_REQUIRED:attendance');const rows=[]
  for(const item of attendanceRecords){let memberDbId=item.memberDbId||null;if(!memberDbId&&item.memberId){const {data:member,error:memberError}=await supabase.from('committee_members').select('id').eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('client_key',String(item.memberId)).maybeSingle();if(memberError)throw memberError;memberDbId=member?.id||null}
    const payload={organization_id:organizationId,committee_id:committee.dbId,meeting_id:meeting.dbId,client_key:item.id||String(item.memberId||item.employeeDbId||item.name),member_id:memberDbId,employee_id:item.employeeDbId||null,attendee_name:item.name||'—',attendance_status:normalizeAttendance(item.status),has_vote:item.voting!==false,updated_at:new Date().toISOString()}
    const {data:existing,error:lookupError}=await supabase.from('committee_meeting_attendance').select('id').eq('organization_id',organizationId).eq('meeting_id',meeting.dbId).eq('client_key',payload.client_key).maybeSingle();if(lookupError)throw lookupError
    if(existing?.id){const {data,error}=await supabase.from('committee_meeting_attendance').update(payload).eq('id',existing.id).select('id,client_key,member_id,employee_id,attendee_name,attendance_status,has_vote').single();if(error)throw error;rows.push(data)}else{const {data,error}=await supabase.from('committee_meeting_attendance').insert(payload).select('id,client_key,member_id,employee_id,attendee_name,attendance_status,has_vote').single();if(error)throw error;rows.push(data)}}return rows
}
export async function saveCommitteeMeetingAsync(organizationId,committee,meeting,{finalize=false}={}){
  requireProduction(organizationId,committee,finalize?'meeting.finalize':'meeting.save');if(!meeting?.dbId)throw new Error('PRODUCTION_COMMITTEE_MEETING_DB_ID_REQUIRED:meeting.save');await syncAttendance(organizationId,committee,meeting,meeting.attendanceRecords||[])
  const status=finalize?'finalized':(meeting.status==='draft'?'draft':'planned');const payload={title:meeting.title,scheduled_at:scheduledAt(meeting),meeting_type:meeting.meetingType==='extraordinary'?'extraordinary':'regular',location:meeting.location||null,minutes_number:meeting.minutesNo||null,quorum_met:meeting.quorum??null,agenda:Array.isArray(meeting.topics)?meeting.topics:[],minutes:meeting.generalNotes||meeting.notes||null,status,updated_at:new Date().toISOString()};if(finalize)payload.finalized_at=new Date().toISOString()
  const {data,error}=await supabase.from('committee_meetings').update(payload).eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('id',meeting.dbId).select('id,client_key,title,scheduled_at,meeting_type,location,status,minutes_number,quorum_met,agenda,minutes,finalized_at,finalized_by,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,finalize?'Οριστικοποίηση πρακτικών':'Ενημέρωση συνεδρίασης',meeting.title,{meeting_id:meeting.dbId,status:data.status});return {...meeting,dbId:data.id,scheduledAt:data.scheduled_at,meetingType:data.meeting_type,location:data.location||'',status:data.status,minutesNo:data.minutes_number||'',quorum:data.quorum_met,topics:Array.isArray(data.agenda)?data.agenda:[],generalNotes:data.minutes||'',finalizedAt:data.finalized_at||null}
}
export async function createCommitteeDecisionAsync(organizationId,committee,draft){
  requireProduction(organizationId,committee,'decision.create');let meetingDbId=draft.meetingDbId||null;if(!meetingDbId&&draft.meetingId){const {data,error}=await supabase.from('committee_meetings').select('id').eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('client_key',String(draft.meetingId)).maybeSingle();if(error)throw error;meetingDbId=data?.id||null}
  const clientKey=draft.id||`DEC-${Date.now()}`;const {data,error}=await supabase.from('committee_decisions').insert({organization_id:organizationId,committee_id:committee.dbId,meeting_id:meetingDbId,client_key:clientKey,topic_key:draft.topicId||null,title:draft.title,action:draft.action||null,owner_label:draft.owner||null,due_date:draft.dueDate||null,priority:normalizePriority(draft.priority),status:normalizeWorkflowStatus(draft.status)}).select('id,client_key,meeting_id,topic_key,title,action,owner_label,due_date,priority,status,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Καταχώρηση απόφασης',draft.title,{decision_id:data.id,client_key:clientKey});return {...draft,id:clientKey,dbId:data.id,meetingDbId:data.meeting_id||null,topicId:data.topic_key||draft.topicId||null,owner:data.owner_label||'',dueDate:data.due_date||'',priority:data.priority,status:data.status}
}
export async function updateCommitteeDecisionAsync(organizationId,committee,decision,patch={}){
  requireProduction(organizationId,committee,'decision.update');if(!decision?.dbId)throw new Error('PRODUCTION_COMMITTEE_DECISION_DB_ID_REQUIRED');const next={...decision,...patch}
  const {data,error}=await supabase.from('committee_decisions').update({title:next.title,action:next.action||null,owner_label:next.owner||null,due_date:next.dueDate||null,priority:normalizePriority(next.priority),status:normalizeWorkflowStatus(next.status),updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('id',decision.dbId).select('id,client_key,meeting_id,topic_key,title,action,owner_label,due_date,priority,status,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Ενημέρωση απόφασης / ενέργειας',next.title,{decision_id:data.id,status:data.status});return {...next,dbId:data.id,owner:data.owner_label||'',dueDate:data.due_date||'',priority:data.priority,status:data.status}
}
export async function createCommitteePlanItemAsync(organizationId,committee,draft){
  requireProduction(organizationId,committee,'plan.create');const clientKey=draft.id||`OBJ-${Date.now()}`;const {data,error}=await supabase.from('committee_plan_items').insert({organization_id:organizationId,committee_id:committee.dbId,client_key:clientKey,title:draft.title,indicator:draft.indicator||null,baseline:draft.baseline||null,target:draft.target||null,owner_label:draft.owner||null,due_date:draft.dueDate||null,status:normalizeWorkflowStatus(draft.status)}).select('id,client_key,title,indicator,baseline,target,owner_label,due_date,status,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Προσθήκη στόχου ετήσιου σχεδίου',draft.title,{plan_item_id:data.id,client_key:clientKey});return {...draft,id:clientKey,dbId:data.id,owner:data.owner_label||'',dueDate:data.due_date||'',status:data.status}
}
export async function updateCommitteePlanItemAsync(organizationId,committee,item,patch={}){
  requireProduction(organizationId,committee,'plan.update');if(!item?.dbId)throw new Error('PRODUCTION_COMMITTEE_PLAN_DB_ID_REQUIRED');const next={...item,...patch}
  const {data,error}=await supabase.from('committee_plan_items').update({title:next.title,indicator:next.indicator||null,baseline:next.baseline||null,target:next.target||null,owner_label:next.owner||null,due_date:next.dueDate||null,status:normalizeWorkflowStatus(next.status),updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('committee_id',committee.dbId).eq('id',item.dbId).select('id,client_key,title,indicator,baseline,target,owner_label,due_date,status,created_at,updated_at').single();if(error)throw error
  await appendHistory(organizationId,committee,'Ενημέρωση στόχου ετήσιου σχεδίου',next.title,{plan_item_id:data.id,status:data.status});return {...next,dbId:data.id,owner:data.owner_label||'',dueDate:data.due_date||'',status:data.status}
}
