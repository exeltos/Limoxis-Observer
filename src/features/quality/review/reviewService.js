import { supabase } from '../../../core/supabase/client'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { REVIEW_SECTIONS, addDays, nextCode, toNumber } from './reviewTemplate'

// Quality objectives and management reviews
// (20261106100000_quality_objectives_management_review.sql): one row per
// objective, per review, per section, per decision and per participant.

const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const must = ({ data, error }) => { if (error) throw error; return data }

// --- Demo -------------------------------------------------------------------------

function demoReviews() {
  const reviewDate = addDays(new Date().toISOString().slice(0, 10), -50)
  const text = {
    previous_actions: 'Ολοκληρώθηκαν οι ενέργειες της προηγούμενης συνεδρίασης.',
    objectives: 'Παρουσιάστηκαν οι στόχοι του έτους και τα αποτελέσματα των δεικτών.',
    conclusions: 'Το Σύστημα Διαχείρισης Ποιότητας παραμένει κατάλληλο, επαρκές και αποτελεσματικό.',
  }
  return [{
    id: 'mr-demo-1', code: `MR-${reviewDate.slice(0, 4)}-01`, title: 'Ανασκόπηση Διοίκησης', reviewDate, periodFrom: addDays(reviewDate, -90), periodTo: reviewDate, frequencyDays: 90, nextReviewDate: addDays(reviewDate, 90), status: 'approved', summary: 'Το σύστημα λειτουργεί αποτελεσματικά· προτεραιότητα η εκπαίδευση του προσωπικού.', approvedAt: `${reviewDate}T12:00:00Z`, approvedByLabel: 'Διευθυντής Κλινικής',
    sections: REVIEW_SECTIONS.map((section, position) => ({ key: section.key, position, title: section.title, body: text[section.key] || '' })),
    actions: [{ id: 'mra-1', position: 0, sectionKey: 'resources', title: 'Πρόγραμμα εκπαίδευσης νέου νοσηλευτικού προσωπικού', ownerLabel: 'Διεύθυνση Νοσηλευτικής', dueDate: addDays(reviewDate, 60), status: 'open' }, { id: 'mra-2', position: 1, sectionKey: 'improvements', title: 'Μετάβαση των μητρώων τμημάτων από το FileMaker', ownerLabel: 'Ομάδα Ποιότητας', dueDate: addDays(reviewDate, 30), status: 'done' }],
    participants: ['Διευθυντής Κλινικής', 'Υπεύθυνος Ποιότητας', 'Διευθύντρια Νοσηλευτικής', 'Ιατρός Λοιμώξεων'].map((role, position) => ({ id: `mrp-${position}`, position, name: role, role, attended: true, signedAt: `${reviewDate}T12:00:00Z` })),
  }]
}
const demoObjectives = () => [
  { id: 'qo-demo-1', code: `QO-${new Date().getFullYear()}-01`, year: new Date().getFullYear(), title: 'Μέση διάρκεια νοσηλείας ΜΕΝΝ έως 12 ημέρες', registerId: 'reg-demo-nicu', indicatorKey: 'mean_los', target: 12, direction: 'lower', unit: 'ημέρες', ownerLabel: 'Διευθυντής ΜΕΝΝ', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-2', code: `QO-${new Date().getFullYear()}-02`, year: new Date().getFullYear(), title: 'Αποκλειστικός μητρικός θηλασμός ≥ 50%', registerId: 'reg-demo-nicu', indicatorKey: 'breast_milk', target: 50, direction: 'higher', unit: '%', ownerLabel: 'Προϊσταμένη ΜΕΝΝ', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
  { id: 'qo-demo-3', code: `QO-${new Date().getFullYear()}-03`, year: new Date().getFullYear(), title: 'Ικανοποίηση ασθενών ≥ 90%', target: 90, direction: 'higher', unit: '%', reportedValue: 92, ownerLabel: 'Υπεύθυνος Ποιότητας', dueDate: `${new Date().getFullYear()}-12-31`, status: 'active' },
]
function local(key, seed) {
  const rows = loadSnapshot(key, null)
  if (Array.isArray(rows)) return rows
  const initial = seed()
  saveSnapshot(key, initial)
  return initial
}

// --- Objectives -------------------------------------------------------------------

const toObjective = row => ({ id: row.id, code: row.code, year: row.year, title: row.title, description: row.description || '', departmentId: row.department_id || '', registerId: row.register_id || '', indicatorKey: row.indicator_key || '', target: row.target == null ? '' : Number(row.target), direction: row.direction, unit: row.unit || '', reportedValue: row.reported_value == null ? '' : Number(row.reported_value), ownerLabel: row.owner_label || '', dueDate: row.due_date || '', status: row.status })
const objectiveRow = (objective, organizationId) => ({ organization_id: organizationId, code: objective.code, year: Number(objective.year) || new Date().getFullYear(), title: objective.title.trim(), description: objective.description || null, department_id: isUuid(objective.departmentId) ? objective.departmentId : null, register_id: isUuid(objective.registerId) ? objective.registerId : null, indicator_key: objective.indicatorKey || null, target: toNumber(objective.target), direction: objective.direction || 'higher', unit: objective.unit || null, reported_value: toNumber(objective.reportedValue), owner_label: objective.ownerLabel || null, due_date: objective.dueDate || null, status: objective.status || 'active' })

export async function loadObjectives(organizationId) {
  if (isLocal()) return local('quality_local_objectives', demoObjectives)
  const rows = must(await supabase.from('quality_objectives').select('*').eq('organization_id', organizationId).order('year', { ascending: false }).order('code'))
  return (rows || []).map(toObjective)
}

export async function saveObjective(organizationId, objective) {
  if (isLocal()) {
    const rows = local('quality_local_objectives', demoObjectives)
    const next = { ...objective, code: objective.code || nextCode('QO', rows.map(row => row.code), objective.year), id: objective.id || localId('qo') }
    saveSnapshot('quality_local_objectives', objective.id ? rows.map(row => (row.id === objective.id ? next : row)) : [...rows, next])
    return next
  }
  if (isUuid(objective.id)) return toObjective(must(await supabase.from('quality_objectives').update(objectiveRow(objective, organizationId)).eq('id', objective.id).select('*').single()))
  const codes = must(await supabase.from('quality_objectives').select('code').eq('organization_id', organizationId)) || []
  return toObjective(must(await supabase.from('quality_objectives').insert(objectiveRow({ ...objective, code: nextCode('QO', codes.map(row => row.code), objective.year) }, organizationId)).select('*').single()))
}

// --- Reviews ------------------------------------------------------------------------

const toReview = (row, sections = [], actions = [], participants = []) => ({
  id: row.id, code: row.code, title: row.title, reviewDate: row.review_date, periodFrom: row.period_from || '', periodTo: row.period_to || '', frequencyDays: row.frequency_days, nextReviewDate: row.next_review_date || '', status: row.status, summary: row.summary || '', approvedAt: row.approved_at, approvedByLabel: row.approved_by_label || '',
  sections: sections.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, key: item.key, position: item.position, title: item.title, body: item.body || '' })),
  actions: actions.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, sectionKey: item.section_key || '', title: item.title, ownerLabel: item.owner_label || '', dueDate: item.due_date || '', status: item.status, capaId: item.capa_id || '' })),
  participants: participants.sort((a, b) => a.position - b.position).map(item => ({ id: item.id, position: item.position, name: item.name, role: item.role || '', attended: item.attended, signedAt: item.signed_at })),
})

export async function loadReviews(organizationId) {
  if (isLocal()) return local('quality_local_reviews', demoReviews)
  // The reviews with their sections, decisions and participants embedded: one round trip.
  const rows = must(await supabase.from('quality_management_reviews').select('*,sections:quality_management_review_sections(*),actions:quality_management_review_actions(*),participants:quality_management_review_participants(*)').eq('organization_id', organizationId).order('review_date', { ascending: false })) || []
  return rows.map(({ sections, actions, participants, ...row }) => toReview(row, sections || [], actions || [], participants || []))
}

// Saves the review and replaces its sections, decisions and participants.
export async function saveReview(organizationId, review) {
  if (isLocal()) {
    const rows = local('quality_local_reviews', demoReviews)
    const next = { ...review, code: review.code || nextCode('MR', rows.map(row => row.code), Number(review.reviewDate.slice(0, 4))), id: review.id || localId('mr'), actions: review.actions.map((action, position) => ({ ...action, id: action.id || localId('mra'), position })), participants: review.participants.map((person, position) => ({ ...person, id: person.id || localId('mrp'), position })) }
    saveSnapshot('quality_local_reviews', review.id ? rows.map(row => (row.id === review.id ? next : row)) : [next, ...rows])
    return next
  }
  const head = { organization_id: organizationId, title: review.title, review_date: review.reviewDate, period_from: review.periodFrom || null, period_to: review.periodTo || null, frequency_days: Number(review.frequencyDays) || 90, next_review_date: review.nextReviewDate || null, status: review.status, summary: review.summary || null, approved_at: review.approvedAt || null, approved_by_label: review.approvedByLabel || null }
  let id = isUuid(review.id) ? review.id : null
  if (id) must(await supabase.from('quality_management_reviews').update(head).eq('id', id))
  else {
    const codes = must(await supabase.from('quality_management_reviews').select('code').eq('organization_id', organizationId)) || []
    id = must(await supabase.from('quality_management_reviews').insert({ ...head, code: nextCode('MR', codes.map(row => row.code), Number(review.reviewDate.slice(0, 4))) }).select('id').single()).id
  }
  const base = { organization_id: organizationId, review_id: id }
  for (const table of ['quality_management_review_sections', 'quality_management_review_actions', 'quality_management_review_participants']) must(await supabase.from(table).delete().eq('review_id', id))
  if (review.sections.length) must(await supabase.from('quality_management_review_sections').insert(review.sections.map((section, position) => ({ ...base, key: section.key, position, title: section.title, body: section.body || null }))))
  if (review.actions.length) must(await supabase.from('quality_management_review_actions').insert(review.actions.map((action, position) => ({ ...base, position, section_key: action.sectionKey || null, title: action.title, owner_label: action.ownerLabel || null, due_date: action.dueDate || null, status: action.status || 'open', capa_id: isUuid(action.capaId) ? action.capaId : null }))))
  if (review.participants.length) must(await supabase.from('quality_management_review_participants').insert(review.participants.map((person, position) => ({ ...base, position, name: person.name, role: person.role || null, attended: person.attended !== false, signed_at: person.signedAt || null }))))
  return (await loadReviews(organizationId)).find(row => row.id === id)
}
