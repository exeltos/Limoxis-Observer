// Labels and grouping of the microbiology line list (Δείκτες › Μικροβιολογία & AMR,
// Analysis › Μικροβιολογία & AMR). The rows come from the demo fixtures or from
// analysis_microbiology_findings, whose `source` is the sample's source_site, or its
// sample_type when no source was recorded: a stored code (centralLine, handSwab,
// surface, urineCulture …) or free text typed in the laboratory. Codes are shown
// with their laboratory label; free text is kept as written.
import { sampleSourceLabel } from '../laboratory/laboratoryReferenceData'
import { SITE_LABELS } from './analysisPageModel'

// A positive finding without an identified organism: in the cloud data these are
// environmental contact plates, staff hand/nasal swabs and a few patient cultures
// marked positive with no organism (and so no antibiogram).
export const NOT_IDENTIFIED = ['Χωρίς ταυτοποίηση', 'Not identified']
const blank = value => { const text = String(value ?? '').trim(); return !text || text === '—' }
export const isIdentified = organism => !blank(organism)
export function organismLabel(organism, tx) { return blank(organism) ? tx(NOT_IDENTIFIED[0], NOT_IDENTIFIED[1]) : String(organism).trim() }
// No resistance class: without an isolate there is no antibiogram («Δεν ελέγχθηκε»);
// an identified isolate without a class keeps «—».
export function resistanceLabel(resistanceClass, organism, tx) {
  if (!blank(resistanceClass)) return String(resistanceClass).trim()
  return isIdentified(organism) ? '—' : tx('Δεν ελέγχθηκε', 'Not tested')
}

// Specimen detail: a source code (sampleSourceLabel knows the patient, staff and
// environmental sources), else a sample-type code, else the free text itself.
export function specimenLabel(value, tx) {
  if (blank(value)) return '—'
  const raw = String(value).trim()
  const language = tx('el', 'en')
  const label = sampleSourceLabel(raw, language)
  if (label !== raw) return label
  const site = SITE_LABELS[raw]
  return site ? tx(site[0], site[1]) : raw
}
// The «Specimen detail» chart: labels translated, rows that now read the same merged.
export function specimenRows(rows, tx) {
  const merged = new Map()
  for (const [value, count] of rows || []) { const label = specimenLabel(value, tx); merged.set(label, (merged.get(label) || 0) + (Number(count) || 0)) }
  return [...merged.entries()].sort((a, b) => b[1] - a[1])
}

// Which picture a finding belongs to, from its sample_type: environmental
// samples, staff screening, or clinical (patient) specimens.
const ENVIRONMENTAL_TYPES = new Set(['environmental', 'surface', 'equipment', 'water', 'air', 'room'])
export function findingCategory(sampleType) {
  const type = String(sampleType ?? '').trim()
  if (ENVIRONMENTAL_TYPES.has(type)) return 'environment'
  if (type === 'surveillance') return 'staff'
  return 'clinical'
}
export const FINDING_CATEGORIES = [['clinical', 'Κλινικά', 'Clinical'], ['environment', 'Περιβάλλον', 'Environment'], ['staff', 'Προσωπικό', 'Staff']]
// Positive findings per category (the counts on the filter chips).
export function categoryCounts(rows) {
  const counts = { clinical: 0, environment: 0, staff: 0 }
  for (const row of rows || []) counts[findingCategory(row[6])] += Number(row[4]) || 0
  return counts
}
// The line list keeps its first `limit` rows of each category, so a large set of
// environmental plates never pushes the clinical rows out of the list.
export function keepPerCategory(limit = 80) {
  const kept = { clinical: 0, environment: 0, staff: 0 }
  return row => { const category = findingCategory(row[6]); kept[category] += 1; return kept[category] <= limit }
}
