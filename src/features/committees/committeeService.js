import { supabase } from '../../core/supabase/client'
import { hasSupabaseConfig } from '../../core/config/env'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadCommittees as loadCommitteesLocal, saveCommittees as saveCommitteesLocal, inferTemplate, nextCommitteeId } from './committeeData'

const MEMBER_COLUMNS = 'id,employee_id,member_name,title,responsibilities,member_type,has_vote,approval_status,started_at,ended_at,employee:employees(employee_code)'
const COMMITTEE_COLUMNS = `id,organization_id,code,name,short_name,committee_type,status,mandate,legal_basis,decision_number,term_start,term_end,meeting_frequency,quorum_rule,notes,created_at,updated_at,committee_members!committee_members_tenant_fk(${MEMBER_COLUMNS})`

function requireProduction(organizationId,operation){
  if(isDemoDataEnvironment())return false
  if(!hasSupabaseConfig||!supabase)throw new Error(`PRODUCTION_COMMITTEES_SUPABASE_REQUIRED:${operation}`)
  if(!organizationId)throw new Error(`PRODUCTION_COMMITTEES_ORGANIZATION_REQUIRED:${operation}`)
  return true
}

function deriveOfficer(memberRefs, pattern) {
  return memberRefs.find(x => pattern.test(x.committeeTitle))?.name || ''
}

function fromMemberRow(row) {
  return {
    id: row.id,
    employeeId: row.employee?.employee_code || '',
    employeeDbId: row.employee_id || null,
    name: row.member_name,
    department: '',
    profession: '',
    committeeTitle: row.title,
    responsibilities: row.responsibilities || '',
    voting: row.has_vote,
    memberType: row.member_type,
    approvalRequired: row.approval_status !== 'not_required',
    approvalStatus: row.approval_status,
    active: !row.ended_at,
    startedAt: row.started_at,
    endedAt: row.ended_at || null,
  }
}

function fromRow(row) {
  const memberRefs = (row.committee_members || []).map(fromMemberRow)
  const base = { name: row.name, shortName: row.short_name || '' }
  return {
    id: row.code,
    dbId: row.id,
    organizationId: row.organization_id,
    templateId: inferTemplate(base),
    name: row.name,
    shortName: row.short_name || '',
    type: row.committee_type,
    status: row.status,
    chair: deriveOfficer(memberRefs, /πρόεδ|συντον/i),
    secretary: deriveOfficer(memberRefs, /γραμματ/i),
    termStart: row.term_start || '',
    termEnd: row.term_end || '',
    committeeRole: '',
    legalBasis: row.legal_basis || '',
    mandate: row.mandate || '',
    decisionNumber: row.decision_number || '',
    meetingFrequency: row.meeting_frequency || 'quarterly',
    quorumRule: row.quorum_rule || 'simple_majority',
    notes: row.notes || '',
    members: memberRefs.map(x => x.name),
    memberRefs,
    meetings: [],
    decisions: [],
    annualPlan: [],
    history: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function committeesCloudEnabled() {
  return hasSupabaseConfig && Boolean(supabase) && !isDemoDataEnvironment()
}

export async function loadCommitteesAsync(organizationId) {
  if(!requireProduction(organizationId,'load'))return loadCommitteesLocal()
  const { data, error } = await supabase.from('committees').select(COMMITTEE_COLUMNS).eq('organization_id', organizationId).order('name')
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function getNextCommitteeCodeAsync(organizationId) {
  if(!requireProduction(organizationId,'next_code'))return nextCommitteeId(loadCommitteesLocal())
  const { data, error } = await supabase.from('committees').select('code').eq('organization_id', organizationId)
  if (error) throw error
  const used = new Set((data || []).map(r => r.code))
  let n = 1
  while (used.has(`COM-${String(n).padStart(3, '0')}`)) n++
  return `COM-${String(n).padStart(3, '0')}`
}

export async function createCommitteeAsync(organizationId, draft) {
  if(!requireProduction(organizationId,'create')){
    const rows=loadCommitteesLocal()
    const now=new Date().toISOString()
    const row={...draft,id:draft.id||nextCommitteeId(rows),status:'active',createdAt:now,updatedAt:now,meetings:draft.meetings||[],decisions:draft.decisions||[],annualPlan:draft.annualPlan||[],history:draft.history||[]}
    saveCommitteesLocal([row,...rows])
    return row
  }
  const { data: committee, error: committeeError } = await supabase.from('committees').insert({
      organization_id: organizationId,
      code: draft.id,
      name: draft.name,
      short_name: draft.shortName || null,
      committee_type: draft.type || 'custom',
      status: 'active',
      mandate: draft.mandate || null,
      legal_basis: draft.legalBasis || null,
      decision_number: draft.decisionNumber || null,
      term_start: draft.termStart || null,
      term_end: draft.termEnd || null,
      meeting_frequency: draft.meetingFrequency || null,
      quorum_rule: draft.quorumRule || null,
      notes: draft.notes || null,
    }).select('id,organization_id,code,name,short_name,committee_type,status,mandate,legal_basis,decision_number,term_start,term_end,meeting_frequency,quorum_rule,notes,created_at,updated_at').single()
  if (committeeError) {
    if (committeeError.code === '23505') throw new Error('DUPLICATE_COMMITTEE_CODE')
    throw committeeError
  }
  const memberRefs = draft.memberRefs || []
  if (memberRefs.length) {
    const { error: membersError } = await supabase.from('committee_members').insert(memberRefs.map(m => ({
        committee_id: committee.id,
        organization_id: organizationId,
        employee_id: m.employeeDbId || null,
        member_name: m.name,
        title: m.committeeTitle,
        responsibilities: m.responsibilities || null,
        member_type: m.memberType || 'regular',
        has_vote: m.voting !== false,
        approval_status: m.approvalRequired ? 'pending' : 'not_required',
      })))
    if (membersError) {
      try { await supabase.from('committees').delete().eq('id', committee.id) } catch { /* best-effort cleanup */ }
      throw membersError
    }
  }
  return fromRow({ ...committee, committee_members: memberRefs.map((m, i) => ({ id: `pending-${i}`, employee_id: m.employeeDbId, employee: { employee_code: m.employeeId }, member_name: m.name, title: m.committeeTitle, responsibilities: m.responsibilities, member_type: m.memberType, has_vote: m.voting !== false, approval_status: m.approvalRequired ? 'pending' : 'not_required', started_at: null, ended_at: null })) })
}
