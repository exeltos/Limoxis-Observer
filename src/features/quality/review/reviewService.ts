import { supabase as configuredClient, type Cloud } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { REVIEW_SECTIONS, addDays, nextCode, toNumber } from './reviewTemplate'
import { hospitalToday } from '../../../core/dates/hospitalDate'
import type { Tables } from '../../../core/supabase/database.types'
import type { Objective, ObjectiveDraft, ObjectiveValue, Review, ReviewAction, ReviewParticipant, ReviewSection } from './reviewTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// Quality objectives and management reviews
// (20261106100000_quality_objectives_management_review.sql): one row per
// objective, per review, per section, per decision and per participant.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = (value: unknown): value is string => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = <T,>({ data, error }: { data: T, error: unknown }): NonNullable<T> => { if (error) throw error; return data as NonNullable<T> }

// --- Demo -------------------------------------------------------------------------

function demoReviews(): Review[] {
  const reviewDate = addDays(hospitalToday(), -50)
  const text: Record<string, string> = {
    previous_actions: 'Ολοκληρώθηκαν οι ενέργειες της προηγούμενης συνεδρίασης.',
    objectives: 'Παρουσιάστηκαν οι στόχοι του έτους και τα αποτελέσματα των δεικτών.',
    conclusions: 'Το Σύστημα Διαχείρισης Ποιότητας παραμένει κατάλληλο, επαρκές και αποτελεσματικό.',
  }
  const latest = {
    id: 'mr-demo-1', code: `MR-${reviewDate.slice(0, 4)}-01`, title: 'Ανασκόπηση Διοίκησης', reviewDate, periodFrom: addDays(reviewDate, -90), periodTo: reviewDate, frequencyDays: 90, nextReviewDate: addDays(reviewDate, 90), status: 'approved', summary: 'Το σύστημα λειτουργεί αποτελεσματικά· προτεραιότητα η εκπαίδευση του προσωπικού.', approvedAt: `${reviewDate}T12:00:00Z`, approvedByLabel: 'Διευθυντής Κλινικής',
    sections: REVIEW_SECTIONS.map((section, position) => ({ key: section.key, position, title: section.title, body: text[section.key] || '' })),
    actions: [{ id: 'mra-1', position: 0, sectionKey: 'resources', title: 'Πρόγραμμα εκπαίδευσης νέου νοσηλευτικού προσωπικού', ownerLabel: 'Διεύθυνση Νοσηλευτικής', dueDate: addDays(reviewDate, 60), status: 'open' }, { id: 'mra-2', position: 1, sectionKey: 'improvements', title: 'Μετάβαση των μητρώων τμημάτων στην πλατφόρμα', ownerLabel: 'Ομάδα Ποιότητας', dueDate: addDays(reviewDate, 30), status: 'done' }],
    participants: ['Διευθυντής Κλινικής', 'Υπεύθυνος Ποιότητας', 'Διευθύντρια Νοσηλευτικής', 'Ιατρός Λοιμώξεων'].map((role, position) => ({ id: `mrp-${position}`, position, name: role, role, attended: true, signedAt: `${reviewDate}T12:00:00Z` })),
  }
  // The reviews before it, every three months since March 2025 (owner, 9/11/2026: the Demo shows the whole of 2025),
  // each approved with its decisions; codes numbered within the year, oldest first.
  const earlier: Review[] = []
  for (let index = 0; ; index += 1) {
    const date = new Date(Date.UTC(2025, 2 + index * 3, 20)).toISOString().slice(0, 10)
    if (date > addDays(reviewDate, -45)) break
    const [focus, action, owner] = EARLIER_REVIEW_FOCUS[index % EARLIER_REVIEW_FOCUS.length]
    const body: Record<string, string> = { ...text, objectives: date.slice(5, 7) === '12' ? `Απολογισμός των στόχων ${date.slice(0, 4)}: οι περισσότεροι επιτεύχθηκαν· η ικανοποίηση ασθενών κοντά στον στόχο.` : text.objectives, improvements: focus }
    earlier.push({
      id: `mr-demo-${date.slice(0, 7)}`, code: '', title: 'Ανασκόπηση Διοίκησης', reviewDate: date, periodFrom: addDays(date, -90), periodTo: date, frequencyDays: 90, nextReviewDate: addDays(date, 90), status: 'approved', summary: `Το σύστημα λειτουργεί αποτελεσματικά· προτεραιότητα: ${focus.charAt(0).toLowerCase()}${focus.slice(1)}`, approvedAt: `${date}T12:00:00Z`, approvedByLabel: 'Διευθυντής Κλινικής',
      sections: REVIEW_SECTIONS.map((section, position) => ({ key: section.key, position, title: section.title, body: body[section.key] || '' })),
      actions: [{ id: `mra-${date.slice(0, 7)}-1`, position: 0, sectionKey: 'improvements', title: action, ownerLabel: owner, dueDate: addDays(date, 60), status: 'done' }, { id: `mra-${date.slice(0, 7)}-2`, position: 1, sectionKey: 'resources', title: 'Ενημέρωση του προγράμματος εκπαίδευσης', ownerLabel: 'Υπεύθυνος Εκπαίδευσης', dueDate: addDays(date, 45), status: 'done' }],
      participants: ['Διευθυντής Κλινικής', 'Υπεύθυνος Ποιότητας', 'Διευθύντρια Νοσηλευτικής', 'Ιατρός Λοιμώξεων'].map((role, position) => ({ id: `mrp-${date.slice(0, 7)}-${position}`, position, name: role, role, attended: position !== 3 || index % 2 === 0, signedAt: `${date}T12:00:00Z` })),
    })
  }
  const codes: string[] = []
  for (const review of [...earlier, latest]) { review.code = nextCode('MR', codes, Number(review.reviewDate.slice(0, 4))); codes.push(review.code) }
  return [latest, ...earlier.reverse()]
}
const EARLIER_REVIEW_FOCUS = [
  ['Η εκπαίδευση του νέου προσωπικού στην υγιεινή χεριών.', 'Εισαγωγική εκπαίδευση υγιεινής χεριών για κάθε νέο συνάδελφο', 'Νοσηλευτική Διεύθυνση'],
  ['Η μείωση των πτώσεων ασθενών στην Παθολογική.', 'Αξιολόγηση κινδύνου πτώσης σε κάθε εισαγωγή', 'Προϊστάμενος Παθολογικής'],
  ['Η ψηφιακή καταγραφή των ελέγχων των τμημάτων.', 'Μετάβαση των ελέγχων των τμημάτων στην πλατφόρμα', 'Ομάδα Ποιότητας'],
  ['Η προετοιμασία της επιθεώρησης πιστοποίησης.', 'Πρόγραμμα εσωτερικών επιθεωρήσεων του έτους', 'Υπεύθυνος Ποιότητας'],
]
const demoObjectives = (): Objective[] => [...currentObjectives(), ...pastObjectives()]
const currentObjectives = () => [
  { id: 'qo-demo-1', code: `QO-${new Date().getFullYear()}-01`, year: new Date().getFullYear(), title: 'Μέση διάρκεια νοσηλείας ΜΕΝΝ έως 12 ημέρες', titleEn: 'Mean NICU length of stay up to 12 days', registerId: 'reg-demo-nicu', indicatorKey: 'mean_los', target: 12, direction: 'lower', unit: 'ημέρες', ownerLabel: 'Διευθυντής ΜΕΝΝ', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-2', code: `QO-${new Date().getFullYear()}-02`, year: new Date().getFullYear(), title: 'Αποκλειστικός μητρικός θηλασμός ≥ 50%', titleEn: 'Exclusive breastfeeding ≥ 50%', registerId: 'reg-demo-nicu', indicatorKey: 'breast_milk', target: 50, direction: 'higher', unit: '%', ownerLabel: 'Προϊσταμένη ΜΕΝΝ', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-3', code: `QO-${new Date().getFullYear()}-03`, year: new Date().getFullYear(), level: 'hospital', title: 'Ικανοποίηση ασθενών ≥ 90%', titleEn: 'Patient satisfaction ≥ 90%', target: 90, direction: 'higher', unit: '%', ownerLabel: 'Υπεύθυνος Ποιότητας', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  // The targets of the hospital's picture («Εικόνα νοσοκομείου»): objectives on the platform's indicators.
  { id: 'qo-demo-4', code: `QO-${new Date().getFullYear()}-04`, year: new Date().getFullYear(), level: 'hospital', title: 'Συμμόρφωση υγιεινής χεριών ≥ 80%', titleEn: 'Hand hygiene compliance ≥ 80%', platformIndicatorKey: 'who-hh', target: 80, direction: 'higher', unit: '%', ownerLabel: 'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-5', code: `QO-${new Date().getFullYear()}-05`, year: new Date().getFullYear(), level: 'hospital', title: 'Πλήρης συμμόρφωση σε δέσμες μέτρων ≥ 90%', titleEn: 'Full bundle compliance ≥ 90%', platformIndicatorKey: 'bundle-all-or-none', target: 90, direction: 'higher', unit: '%', ownerLabel: 'Επιτροπή Λοιμώξεων', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-6', code: `QO-${new Date().getFullYear()}-06`, year: new Date().getFullYear(), level: 'hospital', title: 'Ολοκλήρωση εκπαίδευσης ≥ 90%', titleEn: 'Training completion ≥ 90%', platformIndicatorKey: 'training', target: 90, direction: 'higher', unit: '%', ownerLabel: 'Υπεύθυνος Εκπαίδευσης', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
]
// The same objectives in every earlier year since 2025 (owner, 9/11/2026: the Demo shows the whole of 2025), so
// the year's file for the auditor has its objectives and their months.
const PAST_TARGETS: Record<string, number> = { 'qo-demo-1': 13, 'qo-demo-2': 45, 'qo-demo-4': 75, 'qo-demo-5': 85, 'qo-demo-6': 85 }
const pastObjectives = () => {
  const rows = []
  for (let year = 2025; year < new Date().getFullYear(); year += 1) {
    for (const objective of currentObjectives()) {
      const target = PAST_TARGETS[objective.id] ?? objective.target
      const n = objective.code.slice(-2)
      const title = objective.title.replace(String(objective.target), String(target)), titleEn = objective.titleEn.replace(String(objective.target), String(target))
      rows.push({ ...objective, id: `${objective.id}-${year}`, code: `QO-${year}-${n}`, year, title, titleEn, target, dueDate: `${year}-12-31` })
    }
  }
  return rows
}
// A few months of the patient satisfaction objective, entered by its owner (every month of the earlier years).
const demoObjectiveValues = (): ObjectiveValue[] => {
  const year = new Date().getFullYear(), last = new Date().getMonth()
  const rows = [91, 93, 90, 88, 92, 94, 91, 89, 93, 92, 90, 91].slice(0, Math.max(1, last)).map((value, index) => ({ id: `qov-demo-${index + 1}`, objectiveId: 'qo-demo-3', month: `${year}-${String(index + 1).padStart(2, '0')}-01`, value }))
  for (let past = 2025; past < year; past += 1) {
    rows.push(...[87, 89, 86, 88, 90, 91, 88, 85, 89, 90, 92, 91].map((value, index) => ({ id: `qov-demo-${past}-${index + 1}`, objectiveId: `qo-demo-3-${past}`, month: `${past}-${String(index + 1).padStart(2, '0')}-01`, value })))
  }
  return rows
}
function local<T>(key: string, seed: () => T[]): T[] {
  const rows = loadSnapshot(key, null)
  if (Array.isArray(rows)) return rows as T[]
  const initial = seed()
  saveSnapshot(key, initial)
  return initial
}

// --- Objectives -------------------------------------------------------------------

// The demo objectives (repository.js keeps them under a new storage key since the levels, 2026-11).
const OBJECTIVES_KEY = 'quality_local_objectives'
const toObjective = (row: Tables<'quality_objectives'>): Objective => ({ id: row.id, code: row.code, year: row.year, level: row.level || '', committeeId: row.committee_id || '', platformIndicatorKey: row.platform_indicator_key || '', title: row.title, titleEn: row.title_en || '', description: row.description || '', departmentId: row.department_id || '', registerId: row.register_id || '', indicatorKey: row.indicator_key || '', target: row.target == null ? '' : Number(row.target), direction: row.direction, unit: row.unit || '', reportedValue: row.reported_value == null ? '' : Number(row.reported_value), ownerLabel: row.owner_label || '', dueDate: row.due_date || '', status: row.status })
const objectiveRow = (objective: ObjectiveDraft, organizationId: string | null | undefined) => ({ organization_id: organizationId as string, code: objective.code as string, level: objective.level || null, committee_id: isUuid(objective.committeeId) ? objective.committeeId : null, platform_indicator_key: objective.platformIndicatorKey || null, year: Number(objective.year) || new Date().getFullYear(), title: objective.title.trim(), title_en: objective.titleEn?.trim() || null, description: objective.description || null, department_id: isUuid(objective.departmentId) ? objective.departmentId : null, register_id: isUuid(objective.registerId) ? objective.registerId : null, indicator_key: objective.indicatorKey || null, target: toNumber(objective.target), direction: objective.direction || 'higher', unit: objective.unit || null, reported_value: toNumber(objective.reportedValue), owner_label: objective.ownerLabel || null, due_date: objective.dueDate || null, status: objective.status || 'active' })

export async function loadObjectives(organizationId: string | null | undefined) {
  if (isLocal()) return local(OBJECTIVES_KEY, demoObjectives)
  const rows = must(await supabase.from('quality_objectives').select('*').eq('organization_id', organizationId as string).order('year', { ascending: false }).order('code'))
  return (rows || []).map(toObjective)
}

export async function saveObjective(organizationId: string | null | undefined, objective: ObjectiveDraft) {
  if (isLocal()) {
    const rows = local(OBJECTIVES_KEY, demoObjectives)
    const next = { ...objective, code: objective.code || nextCode('QO', rows.map(row => row.code), objective.year), id: objective.id || localId('qo') }
    saveSnapshot(OBJECTIVES_KEY, objective.id ? rows.map(row => (row.id === objective.id ? next : row)) : [...rows, next])
    return next
  }
  if (isUuid(objective.id)) return toObjective(must(await supabase.from('quality_objectives').update(objectiveRow(objective, organizationId)).eq('id', objective.id).select('*').single()))
  const codes = must(await supabase.from('quality_objectives').select('code').eq('organization_id', organizationId as string)) || []
  return toObjective(must(await supabase.from('quality_objectives').insert(objectiveRow({ ...objective, code: nextCode('QO', codes.map(row => row.code), objective.year) }, organizationId)).select('*').single()))
}

// --- Monthly values (quality_objective_values) -----------------------------------

const toValue = (row: Pick<Tables<'quality_objective_values'>, 'id' | 'objective_id' | 'month' | 'value'>): ObjectiveValue => ({ id: row.id, objectiveId: row.objective_id, month: row.month, value: Number(row.value) })

export async function loadObjectiveValues(organizationId: string | null | undefined) {
  if (isLocal()) return local('quality_local_objective_values', demoObjectiveValues)
  const rows = must(await supabase.from('quality_objective_values').select('id,objective_id,month,value').eq('organization_id', organizationId as string).order('month'))
  return (rows || []).map(toValue)
}

// Saves one month's value of an objective (an empty value removes it).
export async function saveObjectiveValue(organizationId: string | null | undefined, objectiveId: string, month: string, value: unknown) {
  const number = toNumber(value)
  if (isLocal()) {
    const rows = local('quality_local_objective_values', demoObjectiveValues).filter(row => !(row.objectiveId === objectiveId && row.month === month))
    saveSnapshot('quality_local_objective_values', number == null ? rows : [...rows, { id: localId('qov'), objectiveId, month, value: number }])
    return
  }
  if (number == null) { must(await supabase.from('quality_objective_values').delete().eq('organization_id', organizationId as string).eq('objective_id', objectiveId).eq('month', month)); return }
  must(await supabase.from('quality_objective_values').upsert({ organization_id: organizationId as string, objective_id: objectiveId, month, value: number }, { onConflict: 'objective_id,month' }))
}

// --- Reviews ------------------------------------------------------------------------

const toReview = (row: Tables<'quality_management_reviews'>, sections: Tables<'quality_management_review_sections'>[] = [], actions: Tables<'quality_management_review_actions'>[] = [], participants: Tables<'quality_management_review_participants'>[] = []): Review => ({
  id: row.id, code: row.code, title: row.title, reviewDate: row.review_date, periodFrom: row.period_from || '', periodTo: row.period_to || '', frequencyDays: row.frequency_days, nextReviewDate: row.next_review_date || '', status: row.status, summary: row.summary || '', approvedAt: row.approved_at, approvedByLabel: row.approved_by_label || '',
  sections: sections.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, key: item.key, position: item.position, title: item.title, body: item.body || '' })),
  actions: actions.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, sectionKey: item.section_key || '', title: item.title, ownerLabel: item.owner_label || '', dueDate: item.due_date || '', status: item.status, capaId: item.capa_id || '' })),
  participants: participants.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, name: item.name, role: item.role || '', attended: item.attended, signedAt: item.signed_at })),
})

export async function loadReviews(organizationId: string | null | undefined) {
  if (isLocal()) return local('quality_local_reviews', demoReviews)
  // The reviews with their sections, decisions and participants embedded: one round trip.
  const rows = must(await supabase.from('quality_management_reviews').select('*,sections:quality_management_review_sections(*),actions:quality_management_review_actions(*),participants:quality_management_review_participants(*)').eq('organization_id', organizationId as string).order('review_date', { ascending: false })) || []
  return rows.map(({ sections, actions, participants, ...row }) => toReview(row, sections || [], actions || [], participants || []))
}

// Saves the review and replaces its sections, decisions and participants.
export async function saveReview(organizationId: string | null | undefined, review: Review) {
  if (isLocal()) {
    const rows = local('quality_local_reviews', demoReviews)
    const next = { ...review, code: review.code || nextCode('MR', rows.map(row => row.code), Number(review.reviewDate.slice(0, 4))), id: review.id || localId('mr'), actions: review.actions.map((action: ReviewAction, position: number) => ({ ...action, id: action.id || localId('mra'), position })), participants: review.participants.map((person: ReviewParticipant, position: number) => ({ ...person, id: person.id || localId('mrp'), position })) }
    saveSnapshot('quality_local_reviews', review.id ? rows.map(row => (row.id === review.id ? next : row)) : [next, ...rows])
    return next
  }
  const head = { organization_id: organizationId as string, title: review.title, review_date: review.reviewDate, period_from: review.periodFrom || null, period_to: review.periodTo || null, frequency_days: Number(review.frequencyDays) || 90, next_review_date: review.nextReviewDate || null, status: review.status, summary: review.summary || null, approved_at: review.approvedAt || null, approved_by_label: review.approvedByLabel || null }
  let id: string | null = isUuid(review.id) ? review.id : null
  if (id) must(await supabase.from('quality_management_reviews').update(head).eq('id', id))
  else {
    const codes = must(await supabase.from('quality_management_reviews').select('code').eq('organization_id', organizationId as string)) || []
    id = must(await supabase.from('quality_management_reviews').insert({ ...head, code: nextCode('MR', codes.map(row => row.code), Number(review.reviewDate.slice(0, 4))) }).select('id').single()).id
  }
  const base = { organization_id: organizationId as string, review_id: id as string }
  for (const table of ['quality_management_review_sections', 'quality_management_review_actions', 'quality_management_review_participants'] as const) must(await supabase.from(table as 'quality_management_review_sections').delete().eq('review_id', id as string))
  if (review.sections.length) must(await supabase.from('quality_management_review_sections').insert(review.sections.map((section: ReviewSection, position: number) => ({ ...base, key: section.key, position, title: section.title, body: section.body || null }))))
  if (review.actions.length) must(await supabase.from('quality_management_review_actions').insert(review.actions.map((action: ReviewAction, position: number) => ({ ...base, ...(isUuid(action.id) ? { id: action.id } : {}), position, section_key: action.sectionKey || null, title: action.title, owner_label: action.ownerLabel || null, due_date: action.dueDate || null, status: action.status || 'open', capa_id: isUuid(action.capaId) ? action.capaId : null }))))
  if (review.participants.length) must(await supabase.from('quality_management_review_participants').insert(review.participants.map((person: ReviewParticipant, position: number) => ({ ...base, position, name: person.name, role: person.role || null, attended: person.attended !== false, signed_at: person.signedAt || null }))))
  return (await loadReviews(organizationId)).find(row => row.id === id) as Review
}
