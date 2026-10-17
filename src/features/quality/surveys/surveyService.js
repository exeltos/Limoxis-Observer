import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { cleanAnswers, isSurveyOpen, nextSurveyCode, surveyFromTemplate } from './surveyModel'

// Satisfaction surveys (20261108100000_quality_satisfaction_surveys.sql): the
// survey row holds its questions, each response its answers. Respondents
// without an account answer through survey_public / survey_submit with the
// survey's public token; the demo keeps everything in the browser.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const localToken = () => Array.from({ length: 36 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const must = ({ data, error }) => { if (error) throw error; return data }
const SURVEYS_KEY = 'quality_local_surveys'
const RESPONSES_KEY = 'quality_local_survey_responses'

// --- Demo -------------------------------------------------------------------------

const DEMO_DEPARTMENTS = [
  { id: 'Παθολογική', name: 'Παθολογική', nameEn: 'Internal medicine' },
  { id: 'Χειρουργική', name: 'Χειρουργική', nameEn: 'Surgery' },
  { id: 'Μαιευτική', name: 'Μαιευτική', nameEn: 'Obstetrics' },
  { id: 'Παιδιατρική', name: 'Παιδιατρική', nameEn: 'Paediatrics' },
  { id: 'ΜΕΘ', name: 'ΜΕΘ', nameEn: 'ICU' },
]
const DEMO_COMMENTS = {
  best: ['Η ευγένεια των νοσηλευτριών', 'Η ενημέρωση από τον γιατρό κάθε πρωί', 'Η καθαριότητα', 'Ένιωσα ασφάλεια', 'Η γρήγορη ανταπόκριση τη νύχτα'],
  improve: ['Το φαγητό ήταν κρύο', 'Θόρυβος στον διάδρομο τη νύχτα', 'Μεγάλη αναμονή στην εισαγωγή', 'Περισσότερη ενημέρωση για τα φάρμακα στο σπίτι', 'Θέσεις στάθμευσης για συνοδούς', 'Το μπάνιο του θαλάμου χρειάζεται επισκευή'],
  comments: ['Χρειαζόμαστε περισσότερο προσωπικό στις νυχτερινές βάρδιες', 'Καλή συνεργασία στο τμήμα', 'Περισσότερη εκπαίδευση στον νέο εξοπλισμό'],
}

// A small seeded generator: the demo shows the same figures every time.
function seeded(seed) { let state = seed; return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296 } }
const addDays = (day, days) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }

function demoAnswers(questions, random, mood) {
  const answers = {}
  for (const question of questions) {
    // Food and quiet score lower in the demo, so a question falls below target.
    const bias = ['food', 'quiet', 'admission_wait', 'wait', 'workload'].includes(question.id) ? -0.8 : 0
    if (question.type === 'rating') answers[question.id] = Math.max(1, Math.min(5, Math.round(4.35 + mood + bias + (random() - 0.5) * 2)))
    else if (question.type === 'nps') answers[question.id] = Math.max(0, Math.min(10, Math.round(8 + mood * 2 + (random() - 0.5) * 4)))
    else if (question.type === 'yesno') answers[question.id] = random() < (question.id === 'hand_hygiene' ? 0.78 : 0.9)
    else if (question.type === 'multiple') { const picked = (question.options || []).filter(() => random() < 0.3).map(item => item.value); if (picked.length) answers[question.id] = picked }
    else if (question.type === 'text' && random() < 0.22) { const list = DEMO_COMMENTS[question.id] || DEMO_COMMENTS.improve; answers[question.id] = list[Math.floor(random() * list.length)] }
  }
  return answers
}

function demoState() {
  const today = new Date().toISOString().slice(0, 10)
  const year = today.slice(0, 4)
  const inpatient = { ...surveyFromTemplate('inpatient'), id: 'srv-demo-inpatient', code: `SRV-${year}-01`, status: 'open', opensOn: addDays(today, -180), closesOn: addDays(today, 30), targetResponses: 300, departmentIds: DEMO_DEPARTMENTS.map(item => item.id), publicToken: 'demo-inpatient-survey' }
  const staff = { ...surveyFromTemplate('staff'), id: 'srv-demo-staff', code: `SRV-${year}-02`, status: 'closed', opensOn: addDays(today, -120), closesOn: addDays(today, -90), targetResponses: 80, publicToken: 'demo-staff-survey' }
  const random = seeded(20261108)
  const responses = []
  for (let index = 0; index < 214; index += 1) {
    const department = DEMO_DEPARTMENTS[Math.floor(random() * DEMO_DEPARTMENTS.length)]
    const mood = department.id === 'Χειρουργική' ? -0.35 : department.id === 'Μαιευτική' ? 0.3 : 0
    responses.push({ id: `srvr-demo-${index}`, surveyId: inpatient.id, departmentId: department.id, channel: random() < 0.6 ? 'link' : random() < 0.5 ? 'tablet' : 'paper', submittedAt: `${addDays(today, -Math.floor(random() * 175))}T10:00:00Z`, answers: demoAnswers(inpatient.questions, random, mood) })
  }
  for (let index = 0; index < 63; index += 1) {
    const department = DEMO_DEPARTMENTS[Math.floor(random() * DEMO_DEPARTMENTS.length)]
    responses.push({ id: `srvr-demo-staff-${index}`, surveyId: staff.id, departmentId: department.id, channel: 'link', submittedAt: `${addDays(staff.opensOn, Math.floor(random() * 30))}T09:00:00Z`, answers: demoAnswers(staff.questions, random, -0.2) })
  }
  return { surveys: [inpatient, staff], responses }
}

function local() {
  const surveys = loadSnapshot(SURVEYS_KEY, null)
  if (Array.isArray(surveys)) return { surveys, responses: loadSnapshot(RESPONSES_KEY, []) }
  const state = demoState()
  saveLocal(state)
  return state
}
function saveLocal(state) {
  saveSnapshot(SURVEYS_KEY, state.surveys)
  saveSnapshot(RESPONSES_KEY, state.responses)
}
const named = response => { const department = DEMO_DEPARTMENTS.find(item => item.id === response.departmentId); return { ...response, department: department?.name || response.departmentId || '', departmentEn: department?.nameEn || department?.name || response.departmentId || '' } }

// --- Cloud --------------------------------------------------------------------------

const toSurvey = row => ({
  id: row.id, code: row.code, title: row.title, titleEn: row.title_en || '', description: row.description || '', descriptionEn: row.description_en || '',
  audience: row.audience, templateKey: row.template_key || '', departmentIds: row.department_ids || [], questions: Array.isArray(row.questions) ? row.questions : [],
  status: row.status, opensOn: row.opens_on || '', closesOn: row.closes_on || '', targetResponses: row.target_responses || '', satisfiedTarget: Number(row.satisfied_target ?? 80),
  publicToken: row.public_token || '', createdAt: row.created_at, updatedAt: row.updated_at,
})
const toRow = (organizationId, survey) => ({
  organization_id: organizationId, title: survey.title.trim(), title_en: survey.titleEn || null, description: survey.description || null, description_en: survey.descriptionEn || null,
  audience: survey.audience, template_key: survey.templateKey || null, department_ids: (survey.departmentIds || []).filter(isUuid), questions: survey.questions || [],
  status: survey.status || 'draft', opens_on: survey.opensOn || null, closes_on: survey.closesOn || null, target_responses: Number(survey.targetResponses) || null, satisfied_target: Number(survey.satisfiedTarget) || 80,
})

async function departmentNames(organizationId) {
  const rows = must(await supabase.from('departments').select('id,name').eq('organization_id', organizationId)) || []
  return new Map(rows.map(row => [row.id, row.name]))
}

// --- API ----------------------------------------------------------------------------

// The surveys the user may see, with how many responses each has (all, and in the last 30 days).
export async function loadSurveys(organizationId) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  if (isLocal()) {
    const state = local()
    return state.surveys.map(survey => { const own = state.responses.filter(response => response.surveyId === survey.id); return { ...survey, responseCount: own.length, recentCount: own.filter(response => response.submittedAt >= since).length } })
  }
  const rows = must(await supabase.from('quality_surveys').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false })) || []
  return Promise.all(rows.map(async row => {
    const [all, recent] = await Promise.all([
      supabase.from('quality_survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', row.id),
      supabase.from('quality_survey_responses').select('id', { count: 'exact', head: true }).eq('survey_id', row.id).gte('submitted_at', since),
    ])
    return { ...toSurvey(row), responseCount: all.count || 0, recentCount: recent.count || 0 }
  }))
}

export async function loadSurvey(organizationId, id) {
  if (isLocal()) return local().surveys.find(survey => survey.id === id) || null
  if (!isUuid(id)) return null
  const row = must(await supabase.from('quality_surveys').select('*').eq('id', id).eq('organization_id', organizationId).maybeSingle())
  return row ? toSurvey(row) : null
}

// The responses the user may read (Quality all, a department its own).
export async function loadResponses(organizationId, surveyId) {
  if (isLocal()) return local().responses.filter(response => response.surveyId === surveyId).map(named).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
  const [rows, names] = await Promise.all([(async () => {
    const all = []
    for (let from = 0; ; from += 1000) {
      const page = must(await supabase.from('quality_survey_responses').select('id,survey_id,department_id,channel,answers,submitted_at').eq('survey_id', surveyId).order('submitted_at', { ascending: false }).order('id').range(from, from + 999)) || []
      all.push(...page)
      if (page.length < 1000) return all
    }
  })(), departmentNames(organizationId)])
  return rows.map(row => ({ id: row.id, surveyId: row.survey_id, departmentId: row.department_id || '', department: names.get(row.department_id) || '', departmentEn: names.get(row.department_id) || '', channel: row.channel, answers: row.answers || {}, submittedAt: row.submitted_at }))
}

export async function saveSurvey(organizationId, survey) {
  const year = Number(String(survey.opensOn || new Date().toISOString()).slice(0, 4)) || new Date().getFullYear()
  if (isLocal()) {
    const state = local()
    const next = { ...survey, id: survey.id || localId('srv'), code: survey.code || nextSurveyCode(state.surveys.map(item => item.code), year), publicToken: survey.publicToken || localToken() }
    state.surveys = survey.id ? state.surveys.map(item => (item.id === survey.id ? next : item)) : [next, ...state.surveys]
    saveLocal(state)
    return next
  }
  if (isUuid(survey.id)) {
    must(await supabase.from('quality_surveys').update(toRow(organizationId, survey)).eq('id', survey.id).eq('organization_id', organizationId))
    return loadSurvey(organizationId, survey.id)
  }
  const codes = must(await supabase.from('quality_surveys').select('code').eq('organization_id', organizationId)) || []
  const row = must(await supabase.from('quality_surveys').insert({ ...toRow(organizationId, survey), code: nextSurveyCode(codes.map(item => item.code), year) }).select('*').single())
  return toSurvey(row)
}

export async function deleteSurvey(organizationId, id) {
  if (isLocal()) {
    const state = local()
    state.surveys = state.surveys.filter(survey => survey.id !== id)
    state.responses = state.responses.filter(response => response.surveyId !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_surveys').delete().eq('id', id).eq('organization_id', organizationId))
}

// A response entered in the app: on a tablet at the ward, or typed in from paper.
export async function addResponse(organizationId, survey, { departmentId = '', channel = 'tablet', answers = {} }) {
  const kept = cleanAnswers(survey.questions, answers)
  if (!kept) throw new Error('SURVEY_ANSWERS_INVALID')
  if (isLocal()) {
    const state = local()
    const response = { id: localId('srvr'), surveyId: survey.id, departmentId, channel, answers: kept, submittedAt: new Date().toISOString() }
    state.responses = [response, ...state.responses]
    saveLocal(state)
    return named(response)
  }
  must(await supabase.from('quality_survey_responses').insert({ organization_id: organizationId, survey_id: survey.id, department_id: isUuid(departmentId) ? departmentId : null, channel, answers: kept }))
}

export async function deleteResponse(organizationId, id) {
  if (isLocal()) {
    const state = local()
    state.responses = state.responses.filter(response => response.id !== id)
    saveLocal(state)
    return
  }
  must(await supabase.from('quality_survey_responses').delete().eq('id', id).eq('organization_id', organizationId))
}

// --- Public link (no account) -----------------------------------------------------

export async function loadPublicSurvey(token) {
  if (isLocal()) {
    const survey = local().surveys.find(item => item.publicToken === token && item.status !== 'draft')
    if (!survey) throw new Error('SURVEY_NOT_AVAILABLE')
    const open = isSurveyOpen(survey)
    return { open, title: survey.title, titleEn: survey.titleEn, description: survey.description, descriptionEn: survey.descriptionEn, audience: survey.audience, organizationName: 'Demo Hospital', questions: open ? survey.questions : [], departments: open ? DEMO_DEPARTMENTS.filter(item => !survey.departmentIds?.length || survey.departmentIds.includes(item.id)) : [] }
  }
  if (!supabase) throw new Error('SURVEY_NOT_AVAILABLE')
  return must(await supabase.rpc('survey_public', { p_token: token }))
}

export async function submitPublicSurvey(token, departmentId, answers) {
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
  return must(await supabase.rpc('survey_submit', { p_token: token, p_department_id: isUuid(departmentId) ? departmentId : null, p_answers: answers }))
}

export const SURVEY_DEMO_DEPARTMENTS = DEMO_DEPARTMENTS
