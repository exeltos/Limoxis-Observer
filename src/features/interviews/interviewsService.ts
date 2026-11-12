// Συνεντεύξεις: reading and writing the hr_* tables (20261128300000_hr_interviews.sql).
// An application's languages and previous employers are rows of their own; the
// interviews too. Only view_interviews reads and manage_interviews writes (RLS); the
// demo keeps everything in the browser.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../core/supabase/client'
import { cloudClient } from '../../core/supabase/cloudContext'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { isEmptyPreview } from '../../core/preview/emptyPreview'
import { interviewsDemoState } from './interviewsDemoData'
import { overallRating, statusAfterDecision, statusAfterEvaluation, statusAfterSchedule } from './interviewsModel'
import { DIVISION_CANDIDATE_FIELDS } from './divisionsModel'
import { hospitalToday } from '../../core/dates/hospitalDate'
import type { AnyRecord } from '../../types/featureTypes'
import type { TablesUpdate } from '../../core/supabase/database.types'

// The demo state in the browser.
interface LocalState { candidates: AnyRecord[], divisions?: AnyRecord[], opinions?: AnyRecord }
type HrTable = keyof typeof COLUMNS
// The screens pass the selected hospital (null before one is chosen).
type OrgId = string | null | undefined
// The hr_* tables are read and written by name (COLUMNS): a client without types for those.
const db = () => supabase as unknown as SupabaseClient

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const LOCAL_KEY = 'interviews_local_state'
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
// The data of a call that succeeded (the callers read only rows that exist, or guard with ?.).
const must = <T,>({ data, error }: { data: T, error: unknown }): NonNullable<T> => { if (error) throw error; return data as NonNullable<T> }

// camelCase field → [column, kind]; kind: t text, n number, b boolean, d date / timestamp, u uuid, j json.
const COLUMNS: Record<'hr_candidates' | 'hr_candidate_languages' | 'hr_candidate_employers' | 'hr_interviews', Record<string, [string, string]>> = {
  hr_candidates: { code: ['code', 't'], fullName: ['full_name', 't'], gender: ['gender', 't'], fatherName: ['father_name', 't'], motherName: ['mother_name', 't'], birthDate: ['birth_date', 'd'], birthPlace: ['birth_place', 't'], nationality: ['nationality', 't'], citizenship: ['citizenship', 't'],
    idNumber: ['id_number', 't'], idAuthority: ['id_authority', 't'], idIssuedOn: ['id_issued_on', 'd'], address: ['address', 't'], area: ['area', 't'], postcode: ['postcode', 't'], phoneLandline: ['phone_landline', 't'], phoneMobile: ['phone_mobile', 't'], email: ['email', 't'],
    requestedPosition: ['requested_position', 't'], professionalCategory: ['professional_category', 't'], employmentType: ['employment_type', 't'], militaryService: ['military_service', 't'], workPermit: ['work_permit', 'b'], practiceLicence: ['practice_licence', 'b'], smoker: ['smoker', 'b'], maritalStatus: ['marital_status', 't'], children: ['children', 'n'],
    educationLevel: ['education_level', 't'], education: ['education', 'j'], itSkills: ['it_skills', 't'], activities: ['activities', 't'], whyUs: ['why_us', 't'], applicationReason: ['application_reason', 't'], appliedOn: ['applied_on', 'd'],
    consentGiven: ['consent_given', 'b'], consentAt: ['consent_at', 'd'], consentText: ['consent_text', 't'], status: ['status', 't'], decision: ['decision', 't'], decisionOn: ['decision_on', 'd'], decisionByName: ['decision_by_name', 't'], decisionNotes: ['decision_notes', 't'],
    employeeId: ['employee_id', 'u'], source: ['source', 't'], notes: ['notes', 't'],
    consentFuture: ['consent_future', 'b'], consentReferences: ['consent_references', 'b'], declarationTruth: ['declaration_truth', 'b'], consentVersion: ['consent_version', 't'], consentTexts: ['consent_texts', 'j'], signedAt: ['signed_at', 'd'] },
  hr_candidate_languages: { position: ['position', 'n'], language: ['language', 't'], reading: ['reading', 't'], writing: ['writing', 't'], speaking: ['speaking', 't'], certificate: ['certificate', 'b'], certificateName: ['certificate_name', 't'] },
  hr_candidate_employers: { position: ['position', 'n'], employer: ['employer', 't'], fromOn: ['from_on', 'd'], toOn: ['to_on', 'd'], jobTitle: ['job_title', 't'], salary: ['salary', 'n'], leavingReason: ['leaving_reason', 't'] },
  hr_interviews: { scheduledAt: ['scheduled_at', 'd'], location: ['location', 't'], status: ['status', 't'], interviewers: ['interviewers', 'j'], scores: ['scores', 'j'], overallRating: ['overall_rating', 'n'], outcome: ['outcome', 't'], recommendation: ['recommendation', 't'],
    strengths: ['strengths', 't'], weaknesses: ['weaknesses', 't'], salaryExpectation: ['salary_expectation', 'n'], offeredSalary: ['offered_salary', 'n'], benefits: ['benefits', 't'], availableFrom: ['available_from', 'd'], evaluatedAt: ['evaluated_at', 'd'], evaluatedByName: ['evaluated_by_name', 't'], notes: ['notes', 't'], source: ['source', 't'] },
}
const JSON_DEFAULTS: AnyRecord = { education: [], interviewers: [], scores: {}, consentTexts: {} }

const toValue = (kind: string, value: unknown, field: string) => {
  if (kind === 'j') return value == null || value === '' ? JSON_DEFAULTS[field] : value
  if (kind === 'b') return value === '' || value == null ? null : Boolean(value)
  if (value === '' || value == null) return null
  if (kind === 'n') { const n = Number(String(value).replace(',', '.')); return Number.isFinite(n) ? n : null }
  if (kind === 'u') return isUuid(value) ? value : null
  if (kind === 't') { const text = String(value).trim(); return text || null }
  return value
}
export function toRow(table: HrTable, entry: AnyRecord) {
  const row: AnyRecord = {}
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) if (field in entry) row[column] = toValue(kind, entry[field], field)
  return row
}
export function fromRow(table: HrTable, row: AnyRecord) {
  const entry: AnyRecord = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at }
  for (const [field, [column, kind]] of Object.entries(COLUMNS[table])) {
    const value = row[column]
    entry[field] = kind === 'j' ? (value ?? JSON_DEFAULTS[field]) : kind === 'b' ? (value == null ? null : Boolean(value)) : value == null ? '' : value
  }
  return entry
}

async function selectAll(build: () => { range: (from: number, to: number) => PromiseLike<{ data: AnyRecord[] | null, error: unknown }> }) {
  const all: AnyRecord[] = []
  for (let from = 0; ; from += 1000) {
    const page = must(await build().range(from, from + 999)) || []
    all.push(...page)
    if (page.length < 1000) return all
  }
}
const byOrg = (table: string, organizationId: OrgId, order = 'created_at') => selectAll(() => db().from(table).select('*').eq('organization_id', organizationId).order(order).order('id'))
const group = (rows: AnyRecord[], key: string) => { const map = new Map<unknown, AnyRecord[]>(); for (const row of rows) { const list = map.get(row[key]) || []; list.push(row); map.set(row[key], list) } return map }

// --- Local (demo) ---------------------------------------------------------------------------
function local(): LocalState {
  const saved = loadSnapshot(LOCAL_KEY, null)
  if (saved && Array.isArray(saved.candidates)) return saved
  // Empty-hospital preview: no candidates (the hospital's own records start empty).
  const seed: LocalState = interviewsDemoState()
  const state = isEmptyPreview() ? Object.fromEntries(Object.entries(seed).map(([key, value]) => [key, Array.isArray(value) ? [] : value])) as unknown as LocalState : seed
  saveSnapshot(LOCAL_KEY, state)
  return state
}
const saveLocal = (state: LocalState) => saveSnapshot(LOCAL_KEY, state)
const updateLocalCandidate = (candidateId: string, change: (item: AnyRecord) => AnyRecord) => {
  const state = local()
  state.candidates = state.candidates.map(item => (item.id === candidateId ? { ...item, ...change(item), updatedAt: new Date().toISOString() } : item))
  saveLocal(state)
}

// --- API -----------------------------------------------------------------------------------

// Every application with its languages, employers and interviews.
export async function loadInterviews(organizationId: OrgId): Promise<LocalState> {
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

async function writeRow(table: HrTable, organizationId: OrgId, entry: AnyRecord, extra: AnyRecord = {}): Promise<AnyRecord> {
  const row = { ...toRow(table, entry), ...extra }
  if (isUuid(entry.id)) return must(await db().from(table).update(row).eq('id', entry.id).eq('organization_id', organizationId).select('*').single())
  return must(await db().from(table).insert({ ...row, organization_id: organizationId }).select('*').single())
}
async function syncChildren(table: HrTable, organizationId: OrgId, candidateId: string, rows: AnyRecord[]) {
  const existing: AnyRecord[] = must(await db().from(table).select('id').eq('organization_id', organizationId).eq('candidate_id', candidateId)) || []
  const keep = new Set(rows.filter(row => isUuid(row.id)).map(row => row.id))
  const remove = existing.map(row => row.id).filter(id => !keep.has(id))
  if (remove.length) must(await db().from(table).delete().eq('organization_id', organizationId).in('id', remove))
  for (const [index, row] of rows.entries()) await writeRow(table, organizationId, { ...row, position: index }, { candidate_id: candidateId })
}
const cleanLanguages = (rows: AnyRecord[] | null | undefined) => (rows || []).filter(row => String(row.language || '').trim())
const cleanEmployers = (rows: AnyRecord[] | null | undefined) => (rows || []).filter(row => String(row.employer || '').trim())
const cleanEducation = (rows: AnyRecord[] | null | undefined) => (rows || []).filter(row => String(row.school || row.title || row.level || '').trim())

// An application with its languages and previous employers. Returns its id.
export async function saveCandidate(organizationId: OrgId, candidate: AnyRecord) {
  const draft: AnyRecord = { ...candidate, education: cleanEducation(candidate.education), languages: cleanLanguages(candidate.languages), employers: cleanEmployers(candidate.employers) }
  if (draft.consentGiven && !draft.consentAt) draft.consentAt = new Date().toISOString()
  if (isLocal()) {
    const state = local()
    const code = draft.code || `ΥΠ-${String(Math.max(0, ...state.candidates.map(item => Number(String(item.code).replace(/\D/g, '')) || 0)) + 1).padStart(4, '0')}`
    const before = state.candidates.find(item => item.id === draft.id)
    const next = { ...before, ...draft, id: draft.id || localId('cand'), code, interviews: before?.interviews || [], languages: draft.languages.map((row: AnyRecord) => ({ ...row, id: row.id || localId('lang') })), employers: draft.employers.map((row: AnyRecord) => ({ ...row, id: row.id || localId('emp') })), source: draft.source || 'app', updatedAt: new Date().toISOString(), createdAt: before?.createdAt || new Date().toISOString() }
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
export async function saveInterview(organizationId: OrgId, candidate: AnyRecord, interview: AnyRecord, { actor }: { actor?: { name?: string } | null } = {}) {
  const completed = interview.status === 'completed'
  const entry: AnyRecord = { ...interview, overallRating: overallRating(interview.scores), ...(completed && !interview.evaluatedAt ? { evaluatedAt: new Date().toISOString(), evaluatedByName: interview.evaluatedByName || actor?.name || '' } : {}) }
  const status = completed ? statusAfterEvaluation(candidate.status) : interview.status === 'scheduled' ? statusAfterSchedule(candidate.status) : candidate.status
  if (isLocal()) {
    const next = { ...entry, id: entry.id || localId('int'), candidateId: candidate.id, source: entry.source || 'app' }
    updateLocalCandidate(candidate.id, item => ({ status, interviews: (item.interviews || []).some((row: AnyRecord) => row.id === next.id) ? item.interviews.map((row: AnyRecord) => (row.id === next.id ? next : row)) : [...(item.interviews || []), next] }))
    return next.id
  }
  const saved = await writeRow('hr_interviews', organizationId, entry, isUuid(entry.id) ? {} : { candidate_id: candidate.id })
  if (status !== candidate.status) must(await cloudClient().from('hr_candidates').update({ status }).eq('id', candidate.id).eq('organization_id', organizationId!))
  return saved.id
}

// The decision on an application: hire (an offer until the employee is created),
// reserve list or reject, with the date, who decided and the reason.
export async function decide(organizationId: OrgId, candidate: AnyRecord, { decision, decisionOn, decisionByName, decisionNotes, status: forced }: AnyRecord) {
  const change = { decision, decisionOn, decisionByName, decisionNotes, status: forced || statusAfterDecision(decision, candidate.status) }
  if (isLocal()) { updateLocalCandidate(candidate.id, () => change); return }
  must(await cloudClient().from('hr_candidates').update(toRow('hr_candidates', change) as TablesUpdate<'hr_candidates'>).eq('id', candidate.id).eq('organization_id', organizationId!))
}

// «Πρόσληψη»: the candidate is linked to the employee (created or found) and marked hired.
export async function markHired(organizationId: OrgId, candidate: AnyRecord, employee: AnyRecord) {
  const employeeId = isLocal() ? employee.id : employee.dbId
  const change = { status: 'hired', decision: 'hire', decisionOn: candidate.decisionOn || hospitalToday(), employeeId }
  if (isLocal()) { updateLocalCandidate(candidate.id, () => ({ ...change, employeeCode: employee.id })); return }
  must(await cloudClient().from('hr_candidates').update(toRow('hr_candidates', change) as TablesUpdate<'hr_candidates'>).eq('id', candidate.id).eq('organization_id', organizationId!))
}

// The signature under the consents of a tablet application (kept apart from the list).
export async function loadCandidateSignature(organizationId: OrgId, candidate: AnyRecord | null | undefined) {
  if (isLocal()) return candidate?.signature || ''
  if (!organizationId || !isUuid(candidate?.id)) return ''
  const row = must(await cloudClient().from('hr_candidate_signatures').select('image, signed_at').eq('organization_id', organizationId!).eq('candidate_id', candidate?.id).maybeSingle())
  return row?.image || ''
}

// «Αίτηση από tablet»: a single-use link for one candidate (24 hours). The code comes back
// once; the database keeps only its SHA-256. The demo gets the sample form («demo»).
export async function createApplicationLink(organizationId: OrgId, position: unknown = '', { category = '', employment = '' } = {}) {
  if (isLocal()) return { id: '', token: 'demo', position: String(position || '').trim(), professionalCategory: category, employmentType: employment, expiresAt: new Date(Date.now() + 864e5).toISOString() }
  const link = must(await db().rpc('hr_application_link_create', { p_organization_id: organizationId, p_position: String(position || '').trim() || null }))
  // The area and the type of employment are chosen here, before the tablet is handed over; the candidate does not fill them in.
  if (category || employment) must(await db().rpc('hr_application_link_set', { p_link_id: link.id, p_category: category || null, p_employment: employment || null }))
  return { ...link, professionalCategory: category, employmentType: employment }
}
export async function cancelApplicationLink(linkId: string) {
  if (isLocal() || !isUuid(linkId)) return
  must(await cloudClient().rpc('hr_application_link_cancel', { p_link_id: linkId }))
}

export async function removeCandidate(organizationId: OrgId, candidateId: string) {
  if (isLocal()) { const state = local(); state.candidates = state.candidates.filter(item => item.id !== candidateId); saveLocal(state); return }
  must(await cloudClient().from('hr_candidates').delete().eq('id', candidateId).eq('organization_id', organizationId!))
}
export async function removeInterview(organizationId: OrgId, candidate: AnyRecord, interviewId: string) {
  if (isLocal()) { updateLocalCandidate(candidate.id, item => ({ interviews: (item.interviews || []).filter((row: AnyRecord) => row.id !== interviewId) })); return }
  must(await cloudClient().from('hr_interviews').delete().eq('id', interviewId).eq('organization_id', organizationId!))
}

// --- Divisions and opinions (20261231190100_interview_divisions_opinions.sql) -------------------

// The hospital's divisions with the professional categories that belong to each and the
// users who direct it and the departments it covers: { divisions: [{ id, name, categories: [], members: [userId], departments: [departmentId] }] }.
export async function loadDivisions(organizationId: OrgId): Promise<{ divisions: AnyRecord[] }> {
  if (isLocal()) return { divisions: local().divisions || [] }
  if (!organizationId) return { divisions: [] }
  const [divisions, categories, members, departments] = await Promise.all([byOrg('hr_divisions', organizationId, 'name'), byOrg('hr_division_categories', organizationId, 'professional_category'), byOrg('hr_division_members', organizationId), byOrg('hr_division_departments', organizationId)])
  return { divisions: divisions.map(row => ({ id: row.id, name: row.name, categories: categories.filter(item => item.division_id === row.id).map(item => item.professional_category), members: members.filter(item => item.division_id === row.id).map(item => item.user_id), departments: departments.filter(item => item.division_id === row.id).map(item => item.department_id) })) }
}
export async function saveDivision(organizationId: OrgId, division: AnyRecord) {
  const name = String(division.name || '').trim()
  if (isLocal()) {
    const state = local(), id = division.id || localId('div')
    const next = { id, name, categories: division.categories || [], members: division.members || [], departments: division.departments || [] }
    state.divisions = (state.divisions || []).some(item => item.id === id) ? (state.divisions || []).map(item => (item.id === id ? next : item)) : [...(state.divisions || []), next]
    saveLocal(state); return id
  }
  const row = isUuid(division.id)
    ? must(await cloudClient().from('hr_divisions').update({ name }).eq('id', division.id).eq('organization_id', organizationId!).select('id').single())
    : must(await cloudClient().from('hr_divisions').insert({ organization_id: organizationId!, name }).select('id').single())
  const existing = must(await cloudClient().from('hr_division_categories').select('id, professional_category').eq('organization_id', organizationId!).eq('division_id', row.id)) || []
  const wanted: string[] = [...new Set<string>((division.categories || []).map((item: unknown) => String(item).trim()).filter(Boolean))]
  const remove = existing.filter(item => !wanted.includes(item.professional_category)).map(item => item.id)
  if (remove.length) must(await cloudClient().from('hr_division_categories').delete().eq('organization_id', organizationId!).in('id', remove))
  const add = wanted.filter(category => !existing.some(item => item.professional_category === category))
  // A category belongs to one division only: moving it takes it from the previous one.
  if (add.length) {
    must(await cloudClient().from('hr_division_categories').delete().eq('organization_id', organizationId!).in('professional_category', add))
    must(await cloudClient().from('hr_division_categories').insert(add.map(category => ({ organization_id: organizationId!, division_id: row.id, professional_category: category }))))
  }
  const currentMembers = must(await cloudClient().from('hr_division_members').select('id, user_id').eq('organization_id', organizationId!).eq('division_id', row.id)) || []
  const wantedMembers: string[] = division.members || []
  const dropMembers = currentMembers.filter(item => !wantedMembers.includes(item.user_id)).map(item => item.id)
  if (dropMembers.length) must(await cloudClient().from('hr_division_members').delete().eq('organization_id', organizationId!).in('id', dropMembers))
  const addMembers = wantedMembers.filter(userId => !currentMembers.some(item => item.user_id === userId))
  if (addMembers.length) must(await cloudClient().from('hr_division_members').insert(addMembers.map(userId => ({ organization_id: organizationId!, division_id: row.id, user_id: userId }))))
  // The departments of the division: its directors get access to exactly these (the database keeps their scopes in step).
  const currentDepartments = must(await cloudClient().from('hr_division_departments').select('id, department_id').eq('organization_id', organizationId!).eq('division_id', row.id)) || []
  const wantedDepartments = [...new Set<string>(division.departments || [])]
  const dropDepartments = currentDepartments.filter(item => !wantedDepartments.includes(item.department_id)).map(item => item.id)
  if (dropDepartments.length) must(await cloudClient().from('hr_division_departments').delete().eq('organization_id', organizationId!).in('id', dropDepartments))
  const addDepartments = wantedDepartments.filter(departmentId => !currentDepartments.some(item => item.department_id === departmentId))
  if (addDepartments.length) must(await cloudClient().from('hr_division_departments').insert(addDepartments.map(departmentId => ({ organization_id: organizationId!, division_id: row.id, department_id: departmentId }))))
  return row.id
}
export async function removeDivision(organizationId: OrgId, divisionId: string) {
  if (isLocal()) { const state = local(); state.divisions = (state.divisions || []).filter(item => item.id !== divisionId); saveLocal(state); return }
  must(await cloudClient().from('hr_divisions').delete().eq('id', divisionId).eq('organization_id', organizationId!))
}

// The users who can be given a division: active «Division Director» members of the hospital.
export async function loadDivisionDirectors(organizationId: OrgId) {
  if (isLocal()) return [{ userId: 'demo-user-1', name: 'Μαρία Παπαδοπούλου (παράδειγμα)' }, { userId: 'demo-user-2', name: 'Νίκος Αλεξίου (παράδειγμα)' }]
  if (!organizationId) return []
  const members = must(await cloudClient().from('organization_members').select('user_id, status').eq('organization_id', organizationId!).eq('role', 'division_director')) || []
  if (!members.length) return []
  const profiles = must(await cloudClient().from('profiles').select('id, full_name, contact_email').in('id', members.map(item => item.user_id))) || []
  return members.map(item => { const profile = profiles.find(row => row.id === item.user_id); return { userId: item.user_id, name: profile?.full_name || profile?.contact_email || item.user_id } })
}

// What a Division Director reads: the candidates of the own division, professional data and CV only.
export async function loadDivisionCandidates(organizationId: OrgId): Promise<AnyRecord[]> {
  if (isLocal()) {
    const state = local(), mapped = new Set((state.divisions || []).flatMap(item => item.categories || []))
    return state.candidates.filter(item => mapped.has(item.professionalCategory)).map(item => Object.fromEntries(DIVISION_CANDIDATE_FIELDS.map(key => [key, item[key] ?? ''])))
  }
  if (!organizationId) return []
  return must(await db().rpc('hr_division_candidates', { p_organization_id: organizationId })) || []
}

// The notes written while the application is discussed with the candidate.
export async function saveCandidateNotes(organizationId: OrgId, candidate: AnyRecord, notes: unknown) {
  const value = String(notes || '').trim() || null
  if (isLocal()) { updateLocalCandidate(candidate.id, () => ({ notes: value || '' })); return }
  must(await cloudClient().from('hr_candidates').update({ notes: value }).eq('id', candidate.id).eq('organization_id', organizationId!))
}

export function interviewsErrorMessage(error: unknown, language = 'el') {
  const en = language === 'en'
  const err = error as { code?: string, message?: string } | null | undefined
  const text = `${err?.code || ''} ${err?.message || ''}`
  if (text.includes('HR_EMPLOYEE_OTHER_ORGANIZATION')) return en ? 'The employee belongs to another organization.' : 'Ο εργαζόμενος ανήκει σε άλλο οργανισμό.'
  if (text.includes('HR_APPLICATION_LINKS_BUSY')) return en ? 'Too many tablet links in the last hour; try again later.' : 'Δημιουργήθηκαν πολλοί σύνδεσμοι tablet την τελευταία ώρα· δοκιμάστε αργότερα.'
  if (text.includes('DUPLICATE_EMPLOYEE_CODE')) return en ? 'An employee with this code already exists.' : 'Υπάρχει ήδη εργαζόμενος με αυτόν τον κωδικό.'
  if (text.includes('42501') || /row-level security/i.test(text)) return en ? 'You do not have permission for this action.' : 'Δεν έχετε δικαίωμα για αυτή την ενέργεια.'
  return en ? 'The change could not be saved.' : 'Δεν ήταν δυνατή η αποθήκευση.'
}
