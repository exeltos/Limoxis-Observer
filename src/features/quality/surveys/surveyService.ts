import { supabase as configuredClient, type Cloud } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { cleanAnswers, isSurveyOpen, nextSurveyCode, surveyFromTemplate, type Survey, type SurveyQuestion, type SurveyResponse } from './surveyModel'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { Tables } from '../../../core/supabase/database.types'
import type { PublicSurvey, SurveyAnswers, SurveyDepartment, SurveyListItem, SurveySection } from './surveyTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// Satisfaction surveys (20261108100000_quality_satisfaction_surveys.sql): the
// survey row holds its questions, each response its answers. Respondents
// without an account answer through survey_public / survey_submit with the
// survey's public token; the demo keeps everything in the browser.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const localToken = () => Array.from({ length: 36 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const must = <T,>({ data, error }: { data: T, error: unknown }) => { if (error) throw error; return data }
const SURVEYS_KEY = 'quality_local_surveys'
const RESPONSES_KEY = 'quality_local_survey_responses'

// --- Demo -------------------------------------------------------------------------

const DEMO_DEPARTMENTS: SurveyDepartment[] = [
  { id: 'Παθολογική', name: 'Παθολογική', nameEn: 'Internal medicine' },
  { id: 'Χειρουργική', name: 'Χειρουργική', nameEn: 'Surgery' },
  { id: 'Μαιευτική', name: 'Μαιευτική', nameEn: 'Obstetrics' },
  { id: 'Παιδιατρική', name: 'Παιδιατρική', nameEn: 'Paediatrics' },
  { id: 'ΜΕΘ', name: 'ΜΕΘ', nameEn: 'ICU' },
]
const DEMO_COMMENTS: Record<string, string[]> = {
  missing: ['Θέσεις στάθμευσης για συνοδούς', 'Ασύρματο δίκτυο στους θαλάμους', 'Περισσότερες τηλεοράσεις'],
  best: ['Η ευγένεια των νοσηλευτριών', 'Η ενημέρωση από τον γιατρό κάθε πρωί', 'Η καθαριότητα', 'Ένιωσα ασφάλεια', 'Η γρήγορη ανταπόκριση τη νύχτα'],
  improve: ['Το φαγητό ήταν κρύο', 'Θόρυβος στον διάδρομο τη νύχτα', 'Μεγάλη αναμονή στην εισαγωγή', 'Περισσότερη ενημέρωση για τα φάρμακα στο σπίτι', 'Θέσεις στάθμευσης για συνοδούς', 'Το μπάνιο του θαλάμου χρειάζεται επισκευή'],
  comments: ['Ευχαριστώ όλο το νοσηλευτικό προσωπικό για τη φροντίδα', 'Άριστη συνεργασία με τους ιατρούς', 'Το φαγητό θα μπορούσε να είναι πιο ζεστό', 'Πολύ καθαρό δωμάτιο'],
}

// A small seeded generator: the demo shows the same figures every time.
function seeded(seed: number) { let state = seed; return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296 } }
const addDays = (day: string, days: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }

function demoAnswers(questions: SurveyQuestion[], random: () => number, mood: number) {
  const answers: SurveyAnswers = {}
  for (const question of questions) {
    // Food and quiet score lower in the demo, so a question falls below target.
    const bias = ['food', 'quiet', 'admission_wait', 'wait', 'workload', 'food_quality', 'visiting_hours'].includes(question.id) ? -0.8 : 0
    if (question.type === 'rating') answers[question.id] = Math.max(1, Math.min(5, Math.round(4.35 + mood + bias + (random() - 0.5) * 2)))
    else if (question.type === 'nps') answers[question.id] = Math.max(0, Math.min(10, Math.round(8 + mood * 2 + (random() - 0.5) * 4)))
    else if (question.type === 'yesno') answers[question.id] = random() < (question.id === 'hand_hygiene' ? 0.78 : question.id === 'technical' ? 0.18 : 0.9)
    else if (question.type === 'single' && random() < 0.85) answers[question.id] = question.options![Math.floor(random() * question.options!.length)].value
    else if (question.type === 'multiple') { const picked = (question.options || []).filter(() => random() < 0.3).map(item => item.value); if (picked.length) answers[question.id] = picked }
    else if (question.type === 'text' && random() < 0.22) { const list = DEMO_COMMENTS[question.id] || DEMO_COMMENTS.improve; answers[question.id] = list[Math.floor(random() * list.length)] }
  }
  if (answers.technical === false) delete answers.technical_fix
  return answers
}

function demoState() {
  const today = hospitalToday()
  const year = today.slice(0, 4)
  // Open since the start of the year (owner, 9/11/2026: the Demo shows the whole of 2025 and this year).
  const opensOn = `${year}-01-08`, openDays = Math.max(30, Math.round((Date.parse(today) - Date.parse(opensOn)) / 86400000))
  const inpatient: Survey = { ...surveyFromTemplate('wards', { hospital: 'Demo Hospital' }), id: 'srv-demo-inpatient', code: `SRV-${year}-01`, status: 'open', opensOn, closesOn: addDays(today, 30), targetResponses: 300, departmentIds: DEMO_DEPARTMENTS.map(item => item.id), publicToken: 'demo-inpatient-survey' }
  const staff: Survey = { ...surveyFromTemplate('staff'), id: 'srv-demo-staff', code: `SRV-${year}-02`, status: 'closed', opensOn: addDays(today, -120), closesOn: addDays(today, -90), targetResponses: 80, departmentIds: DEMO_DEPARTMENTS.map(item => item.id), publicToken: 'demo-staff-survey' }
  const random = seeded(20261108)
  const responses: SurveyResponse[] = []
  for (let index = 0; index < 214; index += 1) {
    const department = DEMO_DEPARTMENTS[Math.floor(random() * DEMO_DEPARTMENTS.length)]
    const mood = department.id === 'Χειρουργική' ? -0.35 : department.id === 'Μαιευτική' ? 0.3 : 0
    responses.push({ id: `srvr-demo-${index}`, surveyId: inpatient.id, departmentId: department.id, channel: random() < 0.6 ? 'link' : random() < 0.5 ? 'tablet' : 'paper', submittedAt: `${addDays(today, -Math.floor(random() * (openDays - 5)))}T10:00:00Z`, answers: demoAnswers(inpatient.questions, random, mood) })
  }
  for (let index = 0; index < 63; index += 1) {
    const department = DEMO_DEPARTMENTS[Math.floor(random() * DEMO_DEPARTMENTS.length)]
    responses.push({ id: `srvr-demo-staff-${index}`, surveyId: staff.id, departmentId: department.id, channel: 'link', submittedAt: `${addDays(staff.opensOn, Math.floor(random() * 30))}T09:00:00Z`, answers: demoAnswers(staff.questions, random, -0.2) })
  }
  const history = demoHistory(Number(year), today, random)
  return { surveys: [inpatient, staff, ...history.surveys], responses: [...responses, ...history.responses] }
}

// The surveys of the earlier years since 2025 (the ward survey of the whole year, the yearly staff survey, the
// kitchen and maternity surveys) and this year's kitchen and outpatient surveys, still open.
function demoHistory(year: number, today: string, random: () => number) {
  const surveys: Survey[] = [], responses: SurveyResponse[] = []
  const all = DEMO_DEPARTMENTS.map(item => item.id)
  const add = (template: string, id: string, code: string, status: string, opensOn: string, closesOn: string, count: number, departmentIds: string[], mood = 0, target = count) => {
    const survey: Survey = { ...surveyFromTemplate(template, { hospital: 'Demo Hospital' }), id, code, status, opensOn, closesOn, targetResponses: target, departmentIds, publicToken: `demo-${id.slice(9)}` }
    const last = closesOn < today ? closesOn : today
    const span = Math.max(1, Math.round((Date.parse(last) - Date.parse(opensOn)) / 86400000))
    surveys.push(survey)
    for (let index = 0; index < count; index += 1) {
      const departmentId = departmentIds[Math.floor(random() * departmentIds.length)]
      responses.push({ id: `srvr-${id.slice(4)}-${index}`, surveyId: id, departmentId, channel: template === 'staff' ? 'link' : random() < 0.6 ? 'link' : random() < 0.5 ? 'tablet' : 'paper', submittedAt: `${addDays(opensOn, Math.floor(random() * span))}T10:00:00Z`, answers: demoAnswers(survey.questions, random, mood + (departmentId === 'Χειρουργική' ? -0.3 : 0)) })
    }
  }
  for (let past = 2025; past < year; past += 1) {
    add('wards', `srv-demo-wards-${past}`, `SRV-${past}-01`, 'closed', `${past}-01-08`, `${past}-12-31`, 260, all, -0.1, 300)
    add('maternity', `srv-demo-maternity-${past}`, `SRV-${past}-02`, 'closed', `${past}-03-01`, `${past}-12-31`, 96, ['Μαιευτική'], 0.25, 100)
    add('kitchen', `srv-demo-kitchen-${past}`, `SRV-${past}-03`, 'closed', `${past}-05-05`, `${past}-06-30`, 72, all, -0.3, 80)
    add('staff', `srv-demo-staff-${past}`, `SRV-${past}-04`, 'closed', `${past}-10-01`, `${past}-10-31`, 58, all, -0.3, 80)
  }
  if (`${year}-02-02` < today) add('kitchen', `srv-demo-kitchen-${year}`, `SRV-${year}-03`, 'open', `${year}-02-02`, `${year}-12-31`, 88, all, -0.2, 120)
  if (`${year}-03-02` < today) add('outpatient', `srv-demo-outpatient-${year}`, `SRV-${year}-04`, 'open', `${year}-03-02`, `${year}-12-31`, 124, ['Παθολογική', 'Χειρουργική', 'Παιδιατρική'], 0, 200)
  return { surveys, responses }
}

// The demo's surveys and responses.
type SurveyState = { surveys: Survey[], responses: SurveyResponse[] }
function local(): SurveyState {
  const surveys = loadSnapshot(SURVEYS_KEY, null)
  if (Array.isArray(surveys)) return { surveys, responses: loadSnapshot(RESPONSES_KEY, []) }
  const state = demoState()
  saveLocal(state)
  return state
}
// The demo surveys and responses as they are in this browser (the Analysis demo reads them).
export const loadSurveysLocal = () => local()
function saveLocal(state: SurveyState) {
  saveSnapshot(SURVEYS_KEY, state.surveys)
  saveSnapshot(RESPONSES_KEY, state.responses)
}
const named = (response: SurveyResponse): SurveyResponse => { const department = DEMO_DEPARTMENTS.find(item => item.id === response.departmentId); return { ...response, department: department?.name || response.departmentId || '', departmentEn: department?.nameEn || department?.name || response.departmentId || '' } }

// --- Cloud --------------------------------------------------------------------------

const toSurvey = (row: Tables<'quality_surveys'>): Survey => ({
  id: row.id, code: row.code, title: row.title, titleEn: row.title_en || '', description: row.description || '', descriptionEn: row.description_en || '',
  audience: row.audience, templateKey: row.template_key || '', departmentIds: row.department_ids || [], sections: Array.isArray(row.sections) ? row.sections as SurveySection[] : [], questions: Array.isArray(row.questions) ? row.questions as SurveyQuestion[] : [],
  status: row.status, opensOn: row.opens_on || '', closesOn: row.closes_on || '', targetResponses: row.target_responses || '', satisfiedTarget: Number(row.satisfied_target ?? 80),
  publicToken: row.public_token || '', createdAt: row.created_at, updatedAt: row.updated_at,
})
const toRow = (organizationId: string | null | undefined, survey: Survey) => ({
  organization_id: organizationId as string, title: survey.title.trim(), title_en: survey.titleEn || null, description: survey.description || null, description_en: survey.descriptionEn || null,
  audience: survey.audience, template_key: survey.templateKey || null, department_ids: (survey.departmentIds || []).filter(isUuid), sections: survey.sections || [], questions: survey.questions || [],
  status: survey.status || 'draft', opens_on: survey.opensOn || null, closes_on: survey.closesOn || null, target_responses: Number(survey.targetResponses) || null, satisfied_target: Number(survey.satisfiedTarget) || 80,
})

async function departmentNames(organizationId: string | null | undefined) {
  const rows = must(await supabase.from('departments').select('id,name').eq('organization_id', organizationId as string)) || []
  return new Map<string | null, string>(rows.map(row => [row.id, row.name]))
}

// --- API ----------------------------------------------------------------------------

// The surveys the user may see, with how many responses each has (all, and in the last 30 days).
export async function loadSurveys(organizationId: string | null | undefined): Promise<SurveyListItem[]> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  if (isLocal()) {
    const state = local()
    return state.surveys.map(survey => { const own = state.responses.filter(response => response.surveyId === survey.id); return { ...survey, responseCount: own.length, recentCount: own.filter(response => response.submittedAt >= since).length } })
  }
  // The surveys and every survey's counts in two reads side by side
  // (quality_survey_response_counts, 20261201110000), not two counts per survey.
  const [surveyRows, counted] = await Promise.all([
    supabase.from('quality_surveys').select('*').eq('organization_id', organizationId as string).order('created_at', { ascending: false }),
    supabase.rpc('quality_survey_response_counts', { p_organization_id: organizationId as string, p_since: since }),
  ])
  const rows = must(surveyRows) || []
  if (!counted?.error && Array.isArray(counted?.data)) {
    const counts = new Map(counted.data.map(item => [item.survey_id, item]))
    return rows.map(row => ({ ...toSurvey(row), responseCount: Number(counts.get(row.id)?.total || 0), recentCount: Number(counts.get(row.id)?.recent || 0) }))
  }
  return Promise.all(rows.map(async row => {
    const [all, recent] = await Promise.all([
      supabase.from('quality_survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', row.id),
      supabase.from('quality_survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', row.id).gte('submitted_at', since),
    ])
    return { ...toSurvey(row), responseCount: all.count || 0, recentCount: recent.count || 0 }
  }))
}

export async function loadSurvey(organizationId: string | null | undefined, id: string): Promise<Survey | null> {
  if (isLocal()) return local().surveys.find(survey => survey.id === id || survey.code === id) || null
  // By id, or by its code (a corrective action keeps the survey's code).
  const row = must(await supabase.from('quality_surveys').select('*').eq(isUuid(id) ? 'id' : 'code', id).eq('organization_id', organizationId as string).maybeSingle())
  return row ? toSurvey(row) : null
}

// The responses the user may read (Quality all, a department its own).
export async function loadResponses(organizationId: string | null | undefined, surveyId: string): Promise<SurveyResponse[]> {
  if (isLocal()) return local().responses.filter(response => response.surveyId === surveyId).map(named).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
  const [rows, names] = await Promise.all([(async () => {
    const all = []
    for (let from = 0; ; from += 1000) {
      const page = must(await supabase.from('quality_survey_responses').select('id,survey_id,department_id,channel,answers,submitted_at').eq('survey_id', surveyId).order('submitted_at', { ascending: false }).order('id').range(from, from + 999)) || []
      all.push(...page)
      if (page.length < 1000) return all
    }
  })(), departmentNames(organizationId)])
  return rows.map(row => ({ id: row.id, surveyId: row.survey_id, departmentId: row.department_id || '', department: names.get(row.department_id) || '', departmentEn: names.get(row.department_id) || '', channel: row.channel, answers: (row.answers || {}) as SurveyAnswers, submittedAt: row.submitted_at }))
}

export async function saveSurvey(organizationId: string | null | undefined, survey: Survey): Promise<Survey | null> {
  const year = Number(String(survey.opensOn || new Date().toISOString()).slice(0, 4)) || new Date().getFullYear()
  if (isLocal()) {
    const state = local()
    const next = { ...survey, id: survey.id || localId('srv'), code: survey.code || nextSurveyCode(state.surveys.map(item => item.code), year), publicToken: survey.publicToken || localToken() }
    state.surveys = survey.id ? state.surveys.map(item => (item.id === survey.id ? next : item)) : [next, ...state.surveys]
    saveLocal(state)
    return next
  }
  if (isUuid(survey.id)) {
    must(await supabase.from('quality_surveys').update(toRow(organizationId, survey)).eq('id', survey.id).eq('organization_id', organizationId as string))
    return loadSurvey(organizationId, survey.id)
  }
  const codes = must(await supabase.from('quality_surveys').select('code').eq('organization_id', organizationId as string)) || []
  const row = must(await supabase.from('quality_surveys').insert({ ...toRow(organizationId, survey), code: nextSurveyCode(codes.map(item => item.code), year) }).select('*').single())
  return toSurvey(row!)
}

export async function deleteSurvey(organizationId: string | null | undefined, id: string) {
  if (isLocal()) {
    const state = local()
    state.surveys = state.surveys.filter(survey => survey.id !== id)
    state.responses = state.responses.filter(response => response.surveyId !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_surveys').delete().eq('id', id).eq('organization_id', organizationId as string))
}

// A response entered in the app: on a tablet at the ward, or typed in from paper.
export async function addResponse(organizationId: string | null | undefined, survey: Survey, { departmentId = '', channel = 'tablet', answers = {} }: { departmentId?: string, channel?: string, answers?: SurveyAnswers }) {
  const kept = cleanAnswers(survey.questions, answers)
  if (!kept) throw new Error('SURVEY_ANSWERS_INVALID')
  if (isLocal()) {
    const state = local()
    const response: SurveyResponse = { id: localId('srvr'), surveyId: survey.id, departmentId, channel, answers: kept, submittedAt: new Date().toISOString() }
    state.responses = [response, ...state.responses]
    saveLocal(state)
    return named(response)
  }
  must(await supabase.from('quality_survey_responses').insert({ organization_id: organizationId as string, survey_id: survey.id, department_id: isUuid(departmentId) ? departmentId : null, channel, answers: kept }))
}

export async function deleteResponse(organizationId: string | null | undefined, id: string) {
  if (isLocal()) {
    const state = local()
    state.responses = state.responses.filter(response => response.id !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_survey_responses').delete().eq('id', id).eq('organization_id', organizationId as string))
}

// --- Public link (no account) -----------------------------------------------------

export async function loadPublicSurvey(token: string): Promise<PublicSurvey> {
  if (isLocal()) {
    const survey = local().surveys.find(item => item.publicToken === token && item.status !== 'draft')
    if (!survey) throw new Error('SURVEY_NOT_AVAILABLE')
    const open = isSurveyOpen(survey)
    return { open, title: survey.title, titleEn: survey.titleEn, description: survey.description, descriptionEn: survey.descriptionEn, audience: survey.audience, organizationName: 'Demo Hospital', sections: survey.sections || [], questions: open ? survey.questions : [], departments: open ? DEMO_DEPARTMENTS.filter(item => survey.departmentIds?.includes(item.id)) : [] }
  }
  if (!supabase) throw new Error('SURVEY_NOT_AVAILABLE')
  return must(await supabase.rpc('survey_public', { p_token: token })) as unknown as PublicSurvey
}

export async function submitPublicSurvey(token: string, departmentId: string, answers: SurveyAnswers) {
  if (isLocal()) {
    const state = local()
    const survey = state.surveys.find(item => item.publicToken === token)
    if (!survey || !isSurveyOpen(survey)) throw new Error('SURVEY_NOT_AVAILABLE')
    const kept = cleanAnswers(survey.questions, answers)
    if (!kept) throw new Error('SURVEY_ANSWERS_INVALID')
    state.responses = [{ id: localId('srvr'), surveyId: survey.id, departmentId: departmentId || (survey.departmentIds?.length === 1 ? survey.departmentIds[0] : ''), channel: 'link', answers: kept, submittedAt: new Date().toISOString() }, ...state.responses]
    saveLocal(state)
    return { ok: true }
  }
  if (!supabase) throw new Error('SURVEY_NOT_AVAILABLE')
  return must(await supabase.rpc('survey_submit', { p_token: token, p_department_id: (isUuid(departmentId) ? departmentId : null) as string, p_answers: answers }))
}

export const SURVEY_DEMO_DEPARTMENTS = DEMO_DEPARTMENTS
