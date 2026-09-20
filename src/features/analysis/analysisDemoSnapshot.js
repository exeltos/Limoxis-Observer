// Analysis-page audit finding (P2): AnalysisPage used to render entirely
// hardcoded DEMO_KPI/DEMO_TRENDS/DEMO_MICROBIOLOGY constants in demo mode,
// disconnected from every other demo-mode feature in the app. This mirrors
// how src/features/indicators/indicatorEngine.js's collectIndicatorMetrics()
// already computes the real Indicators page from demo fixtures instead of
// hardcoding numbers: it reads the same seed data every other demo-mode
// screen reads and writes, so a change made in one demo screen (e.g. adding
// a laboratory sample) is reflected here too.
import { surveillanceDemoData } from '../surveillance/surveillanceDemoData'
import { clinicalCases } from '../surveillance/clinicalDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { preventionDepartments } from '../prevention/preventionDemoData'
import { loadHandHygieneLocal, loadWasteLocal, loadBundlesLocal, loadAntisepticLocal } from '../prevention/preventionStore'
import { loadQualityLocal } from '../quality/qualityStore'
import { loadControlExecutionsLocal, loadControlAssignmentsLocal } from '../controls/controlStore'
import { loadDocuments } from '../documents/documentStore'
import { loadCommittees } from '../committees/committeeData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'
import { employeeRows } from '../employees/employeeDemoData'
import { loadTrainingState } from '../training/trainingData'

// Same eight ΕΟΔΥ reference pathogens and reference antibiotics as
// indicatorEngine.js's REFERENCE_PATHOGEN_PATTERNS/AMR_REFERENCE_ANTIBIOTIC.
const ORGANISM_PATTERNS = {
  ecoli: 'escherichia coli', proteus: 'proteus', acinetobacter: 'acinetobacter', klebsiella: 'klebsiella',
  enterobacter: 'enterobacter', pseudomonas: 'pseudomonas', saureus: 'staphylococcus aureus', enterococcus: 'enterococcus',
}
const ORGANISM_LABELS = {
  ecoli: 'Escherichia coli', proteus: 'Proteus spp.', acinetobacter: 'Acinetobacter spp.', klebsiella: 'Klebsiella spp.',
  enterobacter: 'Enterobacter spp.', pseudomonas: 'Pseudomonas aeruginosa', saureus: 'Staphylococcus aureus', enterococcus: 'Enterococcus spp.',
}
const REFERENCE_ANTIBIOTIC = {
  ecoli: 'ceftriaxone', proteus: 'ceftriaxone', enterobacter: 'ceftriaxone',
  klebsiella: 'meropenem', acinetobacter: 'meropenem', pseudomonas: 'meropenem',
  saureus: 'oxacillin', enterococcus: 'vancomycin',
}

function countBy(rows, keyFn) {
  const out = {}
  for (const row of rows) { const key = keyFn(row); if (!key) continue; out[key] = (out[key] || 0) + 1 }
  return out
}
function sortedEntries(map, limit = 10) { return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, limit) }
function monthKey(value) { return String(value || '').slice(0, 7) }

// Same predicate as analysis_amr_susceptibility/indicator_metric_snapshot:
// validated/amended isolates of the eight reference pathogens, tested
// against their own reference drug.
function collectAmrSusceptibility() {
  const validated = laboratorySamples.filter(x => x.organism && ['validated', 'amended'].includes(x.resultStatus))
  return Object.entries(ORGANISM_PATTERNS)
    .map(([key, pattern]) => {
      const isolates = validated.filter(x => String(x.organism).toLowerCase().includes(pattern))
      const tested = isolates.flatMap(x => x.ast || []).filter(row => String(row.drug || '').toLowerCase().includes(REFERENCE_ANTIBIOTIC[key]))
      return [ORGANISM_LABELS[key], tested.length, tested.filter(row => row.sir === 'R').length]
    })
    .filter(([, tested]) => tested > 0)
    .sort((a, b) => b[1] - a[1])
}

// Same validated/amended + positive predicate as analysis_microbiology_findings.
// The department filter's option list comes from the department catalogue
// (preventionDepartments, the same fixture Prevention/Controls use), not
// from which departments happen to have a positive culture — production's
// analysis_microbiology_findings similarly draws its department list from
// the departments table, never from the findings themselves.
// One line per distinct (organism, resistance, department, source)
// combination — the same grouping platformService.js's loadMicrobiologyAnalytics
// computes for production's nationalRows, which is the actual "which microbe,
// in which department, from which specimen" line list the National
// surveillance tab is meant to show.
function collectNationalRows(positive) {
  const grouped = new Map()
  for (const row of positive) {
    const key = [row.organism?.trim() || '—', row.resistance || '—', row.department, row.source].join('|||')
    const current = grouped.get(key) || { organism: row.organism?.trim() || '—', resistanceClass: row.resistance || '—', department: row.department, source: row.source, count: 0, lastDate: '' }
    current.count += 1
    const eventDate = String(row.resultedAt || '').slice(0, 10)
    if (eventDate > current.lastDate) current.lastDate = eventDate
    grouped.set(key, current)
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate)).slice(0, 80).map(row => [row.organism, row.resistanceClass, row.department, row.source, row.count, row.lastDate])
}

function collectMicrobiology() {
  const positive = laboratorySamples.filter(x => x.result === 'positive' && ['validated', 'amended'].includes(x.resultStatus))
  const departments = preventionDepartments.map(d => ({ id: d.id, name: d.el }))
  return {
    microorganisms: sortedEntries(countBy(positive, x => x.organism?.trim()), 12),
    resistance: sortedEntries(countBy(positive, x => x.resistance), 5),
    monthly: Object.entries(countBy(positive, x => monthKey(x.resultedAt))).sort((a, b) => a[0].localeCompare(b[0])).slice(-12),
    byDepartment: sortedEntries(countBy(positive, x => x.department), 12),
    bySource: sortedEntries(countBy(positive, x => x.source), 12),
    byOrganization: [],
    nationalRows: collectNationalRows(positive),
    totalPositive: positive.length,
    totalCritical: positive.filter(x => x.critical).length,
    departmentCount: departments.length,
    departments,
  }
}

// clinicalCases is the same live demo record store clinicalRepository.js's
// addTherapy/recordAdministration mutate in place (demoRecord() returns the
// same reference, never a clone), so reading it here already reflects
// anything added through the Surveillance UI — as long as the right fields
// are read: addTherapy sets `approvalStatus` ('pending'/'not_required'/
// 'approved'/'rejected'), and the original seed's few rows instead use a
// legacy `approved` boolean. recordAdministration appends into each
// therapy's own `administrations` array with a `status`, matching
// platform_report_summary's own `status='administered'` filter.
function collectAntimicrobialSummary() {
  const therapies = Object.values(clinicalCases).flatMap(record => record.therapy || [])
  const pending = therapies.filter(x => x.approvalStatus === 'pending' || x.approved === false).length
  const administrations = therapies.flatMap(x => x.administrations || []).filter(a => a.status === 'administered').length
  return { total: therapies.length, pending, administrations }
}

export function collectAnalysisDemoSnapshot() {
  const training = loadTrainingState()
  const handHygieneRows = loadHandHygieneLocal()
  const wasteRows = loadWasteLocal()
  const summary = {
    surveillance: surveillanceDemoData.length,
    laboratory: laboratorySamples.length,
    prevention: handHygieneRows.length + wasteRows.length + loadBundlesLocal().length + loadAntisepticLocal().length,
    controls: loadControlExecutionsLocal().length + loadControlAssignmentsLocal().length,
    quality: loadQualityLocal('incidents').length + loadQualityLocal('findings').length + loadQualityLocal('capas').length,
    training: (training.assignments || []).length,
    documents: loadDocuments().length,
    committees: loadCommittees().length,
    handHygiene: handHygieneRows.length,
    waste: wasteRows.length,
    antimicrobial: collectAntimicrobialSummary(),
    occupationalHealth: loadOccupationalVisits().length,
    employees: employeeRows.length,
    antiseptic: loadAntisepticLocal().length,
    bundles: loadBundlesLocal().length,
  }
  return { source: 'demo', summary, microbiology: collectMicrobiology(), amrSusceptibility: collectAmrSusceptibility() }
}
