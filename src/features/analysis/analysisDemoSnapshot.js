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
import { handHygieneRows, bundleRows, wasteRows } from '../prevention/preventionDemoData'
import { qualityIncidents, qualityFindings, qualityCapas } from '../quality/qualityDemoData'
import { controlExecutionRows } from '../controls/controlDemoData'
import { loadDocuments } from '../documents/documentStore'
import { loadCommittees } from '../committees/committeeData'
import { occupationalVisits } from '../employees/employeeDemoData'
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
function collectMicrobiology() {
  const positive = laboratorySamples.filter(x => x.result === 'positive' && ['validated', 'amended'].includes(x.resultStatus))
  const departments = [...new Set(positive.map(x => x.department).filter(Boolean))].map(name => ({ id: name, name }))
  return {
    microorganisms: sortedEntries(countBy(positive, x => x.organism?.trim()), 12),
    resistance: sortedEntries(countBy(positive, x => x.resistance), 5),
    monthly: Object.entries(countBy(positive, x => monthKey(x.resultedAt))).sort((a, b) => a[0].localeCompare(b[0])).slice(-12),
    byDepartment: sortedEntries(countBy(positive, x => x.department), 12),
    bySource: sortedEntries(countBy(positive, x => x.source), 12),
    byOrganization: [],
    nationalRows: [],
    totalPositive: positive.length,
    totalCritical: positive.filter(x => x.critical).length,
    departmentCount: departments.length,
    departments,
  }
}

// clinicalCases (the demo Surveillance & Samples fixture) is the only demo
// data modelling antimicrobial therapy at all — one therapy "plan" per case,
// with an `approved` boolean rather than platform_report_summary's
// approval_status text. There is no demo fixture for per-dose
// administrations, so that count is honestly 0 rather than invented.
function collectAntimicrobialSummary() {
  const therapies = Object.values(clinicalCases).flatMap(record => record.therapy || [])
  return { total: therapies.length, pending: therapies.filter(x => x.approved === false).length, administrations: 0 }
}

export function collectAnalysisDemoSnapshot() {
  const training = loadTrainingState()
  const summary = {
    surveillance: surveillanceDemoData.length,
    laboratory: laboratorySamples.length,
    prevention: handHygieneRows.length + wasteRows.length + bundleRows.length,
    controls: controlExecutionRows.length,
    quality: qualityIncidents.length + qualityFindings.length + qualityCapas.length,
    training: (training.assignments || []).length,
    documents: loadDocuments().length,
    committees: loadCommittees().length,
    handHygiene: handHygieneRows.length,
    waste: wasteRows.length,
    antimicrobial: collectAntimicrobialSummary(),
    occupationalHealth: occupationalVisits.length,
  }
  return { source: 'demo', summary, microbiology: collectMicrobiology(), amrSusceptibility: collectAmrSusceptibility() }
}
