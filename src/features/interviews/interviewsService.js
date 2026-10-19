// Συνεντεύξεις: reading and writing the hr_* tables (20261128300000_hr_interviews.sql).
// An application's languages and previous employers are rows of their own; the
// interviews too. Only view_interviews reads and manage_interviews writes (RLS); the
// demo keeps everything in the browser.
import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { interviewsDemoState } from './interviewsDemoData'
import { overallRating, statusAfterDecision, statusAfterEvaluation, statusAfterSchedule } from './interviewsModel'

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const LOCAL_KEY = 'interviews_local_state'
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }

// camelCase field → [column, kind]; kind: t text, n number, b boolean, d date / timestamp, u uuid, j json.
const COLUMNS = {
  hr_candidates: { code: ['code', 't'], fullName: ['full_name', 't'], gender: ['gender', 't'], fatherName: ['father_name', 't'], motherName: ['mother_name', 't'], birthDate: ['birth_date', 'd'], birthPlace: ['birth_place', 't'], nationality: ['nationality', 't'], citizenship: ['citizenship', 't'],
    idNumber: ['id_number', 't'], idAuthority: ['id_authority', 't'], idIssuedOn: ['id_issued_on', 'd'], address: ['address', 't'], area: ['area', 't'], postcode: ['postcode', 't'], phoneLandline: ['phone_landline', 't'], phoneMobile: ['phone_mobile', 't'], email: ['email', 't'],
    requestedPosition: ['requested_position', 't'], employmentType: ['employment_type', 't'], militaryService: ['military_service', 't'], workPermit: ['work_permit', 'b'], practiceLicence: ['practice_licence', 'b'], smoker: ['smoker', 'b'], maritalStatus: ['marital_status', 't'], children: ['children', 'n'],
    educationLevel: ['education_level', 't'], education: ['education', 'j'], itSkills: ['it_skills', 't'], activities: ['activities', 't'], whyUs: ['why_us', 't'], applicationReason: ['application_reason', 't'], appliedOn: ['applied_on', 'd'],
    consentGiven: ['consent_given', 'b'], consentAt: ['consent_at', 'd'], consentText: ['consent_text', 't'], status: ['status', 't'], decision: ['decision', 't'], decisionOn: ['decision_on', 'd'], decisionByName: ['decision_by_name', 't'], decisionNotes: ['decision_notes', 't'],
    employeeId: ['employee_id', 'u'], source: ['source', 't'], notes: ['notes', 't'],
    consentFuture: ['consent_future', 'b'], consentReferences: ['consent_references', 'b'], declarationTruth: ['declaration_truth', 'b'], consentVersion: ['consent_version', 't'], consentTexts: ['consent_texts', 'j'], signedAt: ['signed_at', 'd'] },
  hr_candidate_languages: { position: ['position', 'n'], language: ['language', 't'], reading: ['reading', 't'], writing: ['writing', 't'], speaking: ['speaking', 't'], certificate: ['certificate', 'b'], certificateName: ['certificate_name', 't'] },
  hr_candidate_employers: { position: ['position', 'n'], employer: ['employer', 't'], fromOn: ['from_on', 'd'], toOn: ['to_on', 'd'], jobTitle: ['job_title', 't'], salary: ['salary', 'n'], leavingReason: ['leaving_reason', 't'] },
  hr_interviews: { scheduledAt: ['scheduled_at', 'd'], location: ['location', 't'], status: ['status', 't'], interviewers: ['interviewers', 'j'], scores: ['scores', 'j'], overallRating: ['overall_rating', 'n'], outcome: ['outcome', 't'], recommendation: ['recommendation', 't'],
    strengths: ['strengths', 't'], weaknesses: ['weaknesses', 't'], salaryExpectation: ['salary_expectation', 'n'], offeredSalary: ['offered_salary', 'n'], benefits: ['benefits', 't'], availableFrom: ['available_from', 'd'], evaluatedAt: ['evaluated_at', 'd'], evaluatedByName: ['evaluated_by_name', 't'], notes: ['notes', 't'], source: ['source', 't'] },
}
const JSON_DEFAULTS = { education: [], interviewers: [], scores: {}, consentTexts: {} }

const toValue = (kind, value, field) => {
  if (kind === 'j') return value == null || value === '' ? JSON_DEFAULTS[field] : value
  if (kind === 'b') return value === '' || value == null ? null : Boolean(value)
  if (value === '' || value == null) return null
  if (kind === 'n') { const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) ? n : null }
  if (kind === 'u') return isUuid(value) ? value : null
  if (kind === 't') { const text = String(value).trim(); return text || null }
  return value
}
export function toRow(table, entry) {
  const row = {}
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) if (field in entry) row[column] = toValue(kind, entry[field], field)
  return row
}
export function fromRow(table, row) {
  const entry = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) {
    const value = row[column]
    entry[field] = kind === 'j' ? (value ?? JSON_DEFAULTS[field]) : kind === 'b' ? (value == null ? null : Boolean(value)) : value == null ? '' : value
  }
  return entry
}

async function selectAll(build) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const page = must(await build().range(from, from + 999)) || []
    all.push(...page)
    if (page.length < 1000) return all
  }
}
const byOrg = (table, organizationId, order = 'created_at') => selectAll(() => supabase.from(table).select('*').eq('organization_id', organizationId).order(order).order('id'))
const group = (rows, key) => { const map = new Map(); for (const row of rows) { const list = map.get(row[key]) || []; list.push(row); map.set(row[key], list) } return map }

// --- Local (demo) ---------------------------------------------------------------------------
function local() {
  const saved = loadSnapshot(LOCAL_KEY, null)
  if (saved && Array.isArray(saved.candidates)) return saved
  const state = interviewsDemoState()
  saveSnapshot(LOCAL_KEY, state)
  return state
}
const saveLocal = state => saveSnapshot(LOCAL_KEY, state)
const updateLocalCandidate = (candidateId, change) => {
  const state = local()
  state.candidates = state.candidates.map(item => (item.id === candidateId ? { ...item, ...change(item), updatedAt: new Date().toISOString() } : item))
  saveLocal(state)
}

// --- API -----------------------------------------------------------------------------------

// Every application with its languages, employers and interviews.
export async function loadInterviews(organizationId) {
  if (isLocal()) return local()
  if (!organizationId) return { candidates: [] }
  const [candidates, languages, employers, interviews] = await Promise.all([
    byOrg('hr_candidates', organizationId, 'applied_on'), byOrg('hr_candidate_languages', organizationId, 'position'), byOrg('hr_candidate_employers', organizationId, 'position'), byOrg('hr_interviews', organizationId, 'created_at'),
  ])
  const languagesBy = group(languages.map(row => ({ ...fromRow('hr_candidate_languages', row), candidateId: row.candidate_id })), 'candidateId')
  const employersBy = group(employers.map(row => ({ ...fromRow('hr_candidate_employers', row), candidateId: row.candidate_id })), 'candidateId')
  const interviewsBy = group(interviews.map(row => ({ ...fromRow('hr_interviews', row), candidateId: row.candidate_id })), 'candidateId')
  return { candidates: candidates.map(row => ({ ...fromRow('hr_candidates', row), languages: languagesBy.get(row.id) || [], employers: employersBy.get(row.id) || [], interviews: interviewsBy.get(row.id) || [] })) }
}

async function writeRow(table, organizationId, entry, extra = {}) {
  const row = { ...toRow(table, entry), ...extra }
  if (isUuid(entry.id)) return must(await supabase.from(table).update(row).eq('id', entry.id).eq('organization_id', organizationId).select('*').single())
  return must(await supabase.from(table).insert({ ...row, organization_id: organizationId }).select('*').single())
}
async function syncChildren(table, organizationId, candidateId, rows) {
  const existing = must(await supabase.from(table).select('id').eq('organization_id', organizationId).eq('candidate_id', candidateId)) || []
  const keep = new Set(rows.filter(row => isUuid(row.id)).map(row => row.id))
  const remove = existing.map(row => row.id).filter(id => !keep.has(id))
  if (remove.length) must(await supabase.from(table).delete().eq('organization_id', organizationId).in('id', remove))
  for (const [index, row] of rows.entries()) await writeRow(table, organizationId, { ...row, position: index }, { candidate_id: candidateId })
}
const cleanLanguages = rows => (rows || []).filter(row => String(row.language || '').trim())
const cleanEmployers = rows => (rows || []).filter(row => String(row.employer || '').trim())
const cleanEducation = rows => (rows || []).filter(row => String(row.school || row.title || row.level || '').trim())

// An application with its languages and previous employers. Returns its id.
export async function saveCandidate(organizationId, candidate) {
  const draft = { ...candidate, education: cleanEducation(candidate.education), languages: cleanLanguages(candidate.languages), employers: cleanEmployers(candidate.employers) }
  if (draft.consentGiven && !draft.consentAt) draft.consentAt = new Date().toISOString()
  if (isLocal()) {
    const state = local()
    const code = draft.code || `ΥΠ-${String(Math.max(0, ...state.candidates.map(item => Number(String(item.code).replace(/\D/g, '')) || 0)) + 1).padStart(4, '0')}`
    const before = state.candidates.find(item => item.id === draft.id)
    const next = { ...before, ...draft, id: draft.id || localId('cand'), code, interviews: before?.interviews || [], languages: draft.languages.map(row => ({ ...row, id: row.id || localId('lang') })), employers: draft.employers.map(row => ({ ...row, id: row.id || localId('emp') })), source: draft.source || 'app', updatedAt: new Date().toISOString(), createdAt: before?.createdAt || new Date().toISOString() }
    state.candidates = before ? state.candidates.map(item => (item.id === next.id ? next : item)) : [...state.candidates, next]
    saveLocal(state)
    return next.id
  }
  const saved = await writeRow('hr_candidates', organizationId, { ...draft, code: draft.code || '' })
  await syncChildren('hr_candidate_languages', organizationId, saved.id, draft.languages)
  await syncChildren('hr_candidate_employers', organizationId, saved.id, draft.employers)
  return saved.id
}

// An interview: scheduling it moves the application to «interview scheduled», an
// evaluation (completed, with scores) to «interviewed».
export async function saveInterview(organizationId, candidate, interview, { actor } = {}) {
  const completed = interview.status === 'completed'
  const entry = { ...interview, overallRating: overallRating(interview.scores), ...(completed && !interview.evaluatedAt ? { evaluatedAt: new Date().toISOString(), evaluatedByName: interview.evaluatedByName || actor?.name || '' } : {}) }
  const status = completed ? statusAfterEvaluation(candidate.status) : interview.status === 'scheduled' ? statusAfterSchedule(candidate.status) : candidate.status
  if (isLocal()) {
    const next = { ...entry, id: entry.id || localId('int'), candidateId: candidate.id, source: entry.source || 'app' }
    updateLocalCandidate(candidate.id, item => ({ status, interviews: (item.interviews || []).some(row => row.id === next.id) ? item.interviews.map(row => (row.id === next.id ? next : row)) : [...(item.interviews || []), next] }))
    return next.id
  }
  const saved = await writeRow('hr_interviews', organizationId, entry, isUuid(entry.id) ? {} : { candidate_id: candidate.id })
  if (status !== candidate.status) must(await supabase.from('hr_candidates').update({ status }).eq('id', candidate.id).eq('organization_id', organizationId))
  return saved.id
}

// The decision on an application: hire (an offer until the employee is created),
// reserve list or reject, with the date, who decided and the reason.
export async function decide(organizationId, candidate, { decision, decisionOn, decisionByName, decisionNotes, status: forced }) {
  const change = { decision, decisionOn, decisionByName, decisionNotes, status: forced || statusAfterDecision(decision, candidate.status) }
  if (isLocal()) { updateLocalCandidate(candidate.id, () => change); return }
  must(await supabase.from('hr_candidates').update(toRow('hr_candidates', change)).eq('id', candidate.id).eq('organization_id', organizationId))
}

// «Πρόσληψη»: the candidate is linked to the employee (created or found) and marked hired.
export async function markHired(organizationId, candidate, employee) {
  const employeeId = isLocal() ? employee.id : employee.dbId
  const change = { status: 'hired', decision: 'hire', decisionOn: candidate.decisionOn || new Date().toISOString().slice(0, 10), employeeId }
  if (isLocal()) { updateLocalCandidate(candidate.id, () => ({ ...change, employeeCode: employee.id })); return }
  must(await supabase.from('hr_candidates').update(toRow('hr_candidates', change)).eq('id', candidate.id).eq('organization_id', organizationId))
}

// The signature under the consents of a tablet application (kept apart from the list).
export async function loadCandidateSignature(organizationId, candidate) {
  if (isLocal()) return candidate?.signature || ''
  if (!organizationId || !isUuid(candidate?.id)) return ''
  const row = must(await supabase.from('hr_candidate_signatures').select('image, signed_at').eq('organization_id', organizationId).eq('candidate_id', candidate.id).maybeSingle())
  return row?.image || ''
}

// «Αίτηση από tablet»: a single-use link for one candidate (24 hours). The code comes back
// once; the database keeps only its SHA-256. The demo gets the sample form («demo»).
export async function createApplicationLink(organizationId, position = '') {
  if (isLocal()) return { id: '', token: 'demo', position: String(position || '').trim(), expiresAt: new Date(Date.now() + 864e5).toISOString() }
  return must(await supabase.rpc('hr_application_link_create', { p_organization_id: organizationId, p_position: String(position || '').trim() || null }))
}
export async function cancelApplicationLink(linkId) {
  if (isLocal() || !isUuid(linkId)) return
  must(await supabase.rpc('hr_application_link_cancel', { p_link_id: linkId }))
}

export async function removeCandidate(organizationId, candidateId) {
  if (isLocal()) { const state = local(); state.candidates = state.candidates.filter(item => item.id !== candidateId); saveLocal(state); return }
  must(await supabase.from('hr_candidates').delete().eq('id', candidateId).eq('organization_id', organizationId))
}
export async function removeInterview(organizationId, candidate, interviewId) {
  if (isLocal()) { updateLocalCandidate(candidate.id, item => ({ interviews: (item.interviews || []).filter(row => row.id !== interviewId) })); return }
  must(await supabase.from('hr_interviews').delete().eq('id', interviewId).eq('organization_id', organizationId))
}

export function interviewsErrorMessage(error, language = 'el') {
  const en = language === 'en'
  const text = `${error?.code || ''} ${error?.message || ''}`
  if (text.includes('HR_EMPLOYEE_OTHER_ORGANIZATION')) return en ? 'The employee belongs to another organization.' : 'Ο εργαζόμενος ανήκει σε άλλο οργανισμό.'
  if (text.includes('HR_APPLICATION_LINKS_BUSY')) return en ? 'Too many tablet links in the last hour; try again later.' : 'Δημιουργήθηκαν πολλοί σύνδεσμοι tablet την τελευταία ώρα· δοκιμάστε αργότερα.'
  if (text.includes('DUPLICATE_EMPLOYEE_CODE')) return en ? 'An employee with this code already exists.' : 'Υπάρχει ήδη εργαζόμενος με αυτόν τον κωδικό.'
  if (text.includes('42501') || /row-level security/i.test(text)) return en ? 'You do not have permission for this action.' : 'Δεν έχετε δικαίωμα για αυτή την ενέργεια.'
  return en ? 'The change could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.'
}
