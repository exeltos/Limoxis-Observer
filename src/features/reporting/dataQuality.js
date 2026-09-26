// Data-quality checks over laboratory samples and patients: the gaps that make
// surveillance indicators or EARS-Net/ΕΟΔΥ reporting incomplete or wrong.
import { earsNetIsolates, firstIsolates } from './earsNet'

const VALIDATED = new Set(['validated', 'amended'])
const DAY = 86400000
const time = value => { const t = Date.parse(value || ''); return Number.isNaN(t) ? null : t }
const resultsOf = sample => (sample.microbiologyResults?.length ? sample.microbiologyResults : (sample.result || sample.resultStatus ? [sample] : []))
const sampleItem = (sample, note = '') => ({ id: sample.id, to: `/laboratory/${encodeURIComponent(sample.id)}`, label: sample.id, detail: [sample.patient || sample.subjectName, sample.department, note].filter(Boolean).join(' · ') })
const patientItem = (patient, note = '') => ({ id: patient.id, to: `/patients/${encodeURIComponent(patient.id)}`, label: patient.id, detail: [patient.name, patient.department, note].filter(Boolean).join(' · ') })

export function runDataQualityChecks({ samples = [], patients = [], now = new Date() } = {}) {
  const patientSamples = samples.filter(sample => (sample.subjectType || 'patient') === 'patient')
  const nowTime = now.getTime()
  const checks = []
  const add = (id, severity, el, en, items, hintEl, hintEn) => checks.push({ id, severity, el, en, hintEl, hintEn, items })

  add('positive_without_organism', 'high', 'Θετικό αποτέλεσμα χωρίς μικροοργανισμό', 'Positive result without an organism',
    patientSamples.filter(sample => resultsOf(sample).some(result => result.result === 'positive' && !String(result.organism || '').trim())).map(sample => sampleItem(sample)),
    'Χωρίς μικροοργανισμό το εύρημα δεν μετράει σε δείκτες, AMR και EARS-Net.', 'Without an organism the finding is missing from indicators, AMR and EARS-Net.')

  add('invasive_without_ast', 'high', 'Διεισδυτικό στέλεχος EARS-Net χωρίς αντιβιόγραμμα', 'Invasive EARS-Net isolate without susceptibility tests',
    firstIsolates(earsNetIsolates(patientSamples)).filter(isolate => !(isolate.result.ast || isolate.sample.ast || []).length).map(isolate => sampleItem(isolate.sample, isolate.result.organism)),
    'Το πρώτο στέλεχος ανά ασθενή χρειάζεται αντιβιόγραμμα για την αναφορά EARS-Net.', 'The first isolate per patient needs susceptibility results for EARS-Net.')

  add('ast_without_standard', 'medium', 'Αντιβιόγραμμα χωρίς πρότυπο ερμηνείας (EUCAST/CLSI)', 'Susceptibility test without an interpretation standard',
    patientSamples.filter(sample => resultsOf(sample).some(result => (result.ast || []).some(test => !test.standard))).map(sample => sampleItem(sample)),
    'Το EARS-Net ζητά το πρότυπο και την έκδοση των ορίων ευαισθησίας.', 'EARS-Net asks for the breakpoint standard and version.')

  add('missing_collection_date', 'high', 'Δείγμα χωρίς ημερομηνία λήψης', 'Sample without a collection date',
    patientSamples.filter(sample => !time(sample.collectedAt) && !['requested', 'cancelled'].includes(sample.status)).map(sample => sampleItem(sample)),
    'Η ημερομηνία λήψης ορίζει την περίοδο στατιστικής και το πρώτο στέλεχος.', 'The collection date sets the statistics period and the first isolate.')

  add('impossible_timeline', 'high', 'Αδύνατη χρονολογική σειρά (παραλαβή ή αποτέλεσμα πριν τη λήψη)', 'Impossible timeline (received or resulted before collection)',
    patientSamples.filter(sample => {
      const collected = time(sample.collectedAt); if (collected == null) return false
      const received = time(sample.receivedAt)
      return (received != null && received < collected) || resultsOf(sample).some(result => { const at = time(result.resultedAt); return at != null && at < collected })
    }).map(sample => sampleItem(sample)))

  add('missing_department', 'medium', 'Δείγμα ασθενή χωρίς τμήμα', 'Patient sample without a department',
    patientSamples.filter(sample => !String(sample.department || sample.departmentId || '').trim()).map(sample => sampleItem(sample)),
    'Χωρίς τμήμα το δείγμα λείπει από τους δείκτες ανά τμήμα και τον εντοπισμό συρροών.', 'Without a department the sample is missing from per-department indicators and cluster detection.')

  add('missing_patient', 'medium', 'Δείγμα ασθενή χωρίς σύνδεση με ασθενή', 'Patient sample not linked to a patient',
    patientSamples.filter(sample => !String(sample.subjectCode || sample.patientId || sample.subjectId || '').trim()).map(sample => sampleItem(sample)),
    'Χωρίς ασθενή δεν γίνεται αφαίρεση διπλοεγγραφών (πρώτο στέλεχος ανά ασθενή).', 'Without a patient, duplicate isolates cannot be removed (first isolate per patient).')

  add('stale_unvalidated', 'medium', 'Αποτέλεσμα χωρίς επικύρωση για πάνω από 7 ημέρες', 'Result not validated for more than 7 days',
    patientSamples.filter(sample => resultsOf(sample).some(result => result.result && !VALIDATED.has(result.resultStatus) && time(result.resultedAt) != null && nowTime - time(result.resultedAt) > 7 * DAY)).map(sample => sampleItem(sample)),
    'Μη επικυρωμένα αποτελέσματα δεν μετρούν στην Ανάλυση και στις δηλώσεις.', 'Unvalidated results are left out of Analytics and notifications.')

  const seen = new Map()
  for (const sample of patientSamples) {
    const patient = String(sample.subjectCode || sample.patientId || '').trim(); const day = String(sample.collectedAt || '').slice(0, 10)
    if (!patient || !day) continue
    const key = `${patient}|${sample.type}|${sample.source || ''}|${day}`
    seen.set(key, [...(seen.get(key) || []), sample])
  }
  add('possible_duplicate_sample', 'low', 'Πιθανό διπλό δείγμα (ίδιος ασθενής, τύπος, πηγή και ημέρα)', 'Possible duplicate sample (same patient, type, source and day)',
    [...seen.values()].filter(group => group.length > 1).flat().map(sample => sampleItem(sample)))

  const invasivePatients = new Set(earsNetIsolates(patientSamples).map(isolate => isolate.patient).filter(Boolean))
  add('reporting_demographics', 'medium', 'Ασθενής με διεισδυτικό στέλεχος χωρίς φύλο ή ημερομηνία γέννησης', 'Patient with an invasive isolate but no sex or date of birth',
    patients.filter(patient => invasivePatients.has(String(patient.id)) && (!patient.sex || !patient.dateOfBirth)).map(patient => patientItem(patient)),
    'Το EARS-Net ζητά φύλο και ηλικία για κάθε στέλεχος.', 'EARS-Net asks for sex and age for every isolate.')

  add('infant_without_birth_weight', 'medium', 'Βρέφος (≤1 έτους) χωρίς βάρος γέννησης', 'Infant (≤1 year) without a birth weight',
    patients.filter(patient => { const born = time(patient.dateOfBirth); return born != null && nowTime - born <= 366 * DAY && !patient.birthWeightGrams }).map(patient => patientItem(patient)),
    'Οι νεογνικοί δείκτες (NHSN) ομαδοποιούνται ανά κατηγορία βάρους γέννησης.', 'Neonatal indicators (NHSN) are grouped by birth-weight category.')

  return checks
}

export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }
