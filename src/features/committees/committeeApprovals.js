import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'

const TABLES={approvals:'committee_approvals',minutes:'committee_minutes_approvals',outbox:'committee_mail_outbox'}
function demoOnly(operation){if(!isDemoDataEnvironment())throw new Error(`PRODUCTION_COMMITTEE_LOCAL_APPROVAL_FORBIDDEN:${operation}`)}
function safeLoad(table){if(!isDemoDataEnvironment())return [];const v=loadSnapshot(table,[]);return Array.isArray(v)?v:[]}
function safeSave(table,value){demoOnly(`save.${table}`);return saveSnapshot(table,value)}

export function loadCommitteeApprovals(){return safeLoad(TABLES.approvals)}
export function saveCommitteeApprovals(v){return safeSave(TABLES.approvals,v)}
export function requestCommitteeApproval(data){
  // Production membership approval is represented by committee_members.approval_status
  // and answered through the governed server workflow. This legacy store exists only
  // for the isolated demo sandbox.
  if(!isDemoDataEnvironment())return null
  const rows=loadCommitteeApprovals();const old=rows.find(x=>x.committeeId===data.committeeId&&x.employeeId===data.employeeId&&x.status==='pending');if(old)return old
  const row={id:`APR-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,...data,status:'pending',requestedAt:new Date().toISOString()};saveCommitteeApprovals([row,...rows]);return row
}
export function approvalsForEmployee(employeeId){return loadCommitteeApprovals().filter(x=>x.employeeId===employeeId)}
export function approvalStatusFor(committeeId,employeeId){return loadCommitteeApprovals().find(x=>x.committeeId===committeeId&&x.employeeId===employeeId)?.status||null}
export function answerCommitteeApproval(id,status,actor){demoOnly('membership.answer');const now=new Date().toISOString();const rows=loadCommitteeApprovals().map(x=>x.id===id?{...x,status,answeredAt:now,answeredBy:actor.name,answeredById:actor.id}:x);saveCommitteeApprovals(rows);return rows.find(x=>x.id===id)}

export function loadMinutesApprovals(){return safeLoad(TABLES.minutes)}
export function minutesApprovalsForMeeting(committeeId,meetingId){return loadMinutesApprovals().filter(x=>x.committeeId===committeeId&&x.meetingId===meetingId)}
export function minutesApprovalSummary(committeeId,meetingId){
  const rows=minutesApprovalsForMeeting(committeeId,meetingId)
  return {total:rows.length,approved:rows.filter(x=>x.status==='approved').length,pending:rows.filter(x=>x.status==='pending').length,changes:rows.filter(x=>x.status==='changes_requested').length}
}

export function requestMinutesApprovals({committee,meeting,presentMembers,requestedBy,requestedById}){
  demoOnly('minutes.request')
  const now=new Date().toISOString()
  const existing=loadMinutesApprovals().filter(x=>!(x.committeeId===committee.id&&x.meetingId===meeting.id))
  const requests=presentMembers.map((member,index)=>({
    id:`MINAPR-${Date.now()}-${index}`,
    committeeId:committee.id,
    committeeName:committee.name,
    meetingId:meeting.id,
    meetingTitle:meeting.title,
    meetingDate:meeting.date,
    minutesNo:meeting.minutesNo||'',
    employeeId:member.employeeId||'',
    memberName:member.name,
    email:member.email||'',
    status:'pending',
    requestedAt:now,
    requestedBy,
    requestedById,
  }))
  safeSave(TABLES.minutes,[...requests,...existing])

  const outbox=safeLoad(TABLES.outbox)
  const queued=requests.filter(x=>x.email).map((request,index)=>({
    id:`MAIL-${Date.now()}-${index}`,
    kind:'committee_minutes_approval',
    status:'queued',
    queuedAt:now,
    to:request.email,
    recipientName:request.memberName,
    subject:`Έγκριση πρακτικών — ${committee.shortName||committee.name}`,
    summary:{
      committee:committee.name,
      meeting:meeting.title,
      date:meeting.date,
      minutesNo:meeting.minutesNo||'—',
      topics:(meeting.topics||[]).map(x=>({subject:x.subject,decision:x.decision})),
    },
    approvalId:request.id,
  }))
  safeSave(TABLES.outbox,[...queued,...outbox])
  return {requests,queued}
}

export function loadCommitteeMailOutbox(){return safeLoad(TABLES.outbox)}
