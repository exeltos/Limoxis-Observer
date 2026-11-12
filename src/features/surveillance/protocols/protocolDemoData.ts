// Demo protocols and antimicrobial reviews, kept for the session like the other
// demo records. Times are relative to when the Demo is opened, so the Hour-1
// bundle is always running (recognised 72 minutes ago). The empty-hospital
// preview (?helpEmpty=1) starts without them.
import { emptyInPreview } from '../../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../../core/data/demoClock'
import { historyCases } from '../demoInfectionHistory'

const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString()
const atMinute = (zero, minute) => new Date(new Date(zero).getTime() + minute * 60000).toISOString()

function hourOneRun() {
  const zero = minutesAgo(72)
  const step = (key, minute, value, by = 'Μ. Κωνσταντίνου') => ({ key, status: 'done', doneAt: atMinute(zero, minute), value, notIndicatedReason: '', therapyId: null, recordedByName: by, recordedAt: atMinute(zero, minute + 2) })
  return {
    id: 'PRT-260041-1',
    caseId: 'SUR-260041',
    protocolKey: 'sepsis_hour1',
    recognizedAt: zero,
    recognitionSource: 'qsofa',
    weightKg: 72,
    status: 'open',
    startedByName: 'Δρ. Κ. Μαργαρίτης',
    startedAt: atMinute(zero, 1),
    completedAt: null,
    completedByName: '',
    closeReason: '',
    steps: [
      step('lactate', 13, '4.2'),
      step('blood_cultures', 20, 'LAB-260771 · 2 σετ'),
      step('fluids', 35, '1.500 / 2.160 ml'),
      step('antibiotic', 53, 'Μεροπενέμη 1 g IV', 'Δρ. Κ. Μαργαρίτης'),
    ],
    events: [
      { type: 'started', stepKey: null, detail: { source: 'qsofa' }, reason: '', actorName: 'Δρ. Κ. Μαργαρίτης', at: atMinute(zero, 1) },
      { type: 'step_recorded', stepKey: 'lactate', detail: {}, reason: '', actorName: 'Μ. Κωνσταντίνου', at: atMinute(zero, 15) },
      { type: 'step_recorded', stepKey: 'blood_cultures', detail: {}, reason: '', actorName: 'Μ. Κωνσταντίνου', at: atMinute(zero, 22) },
      { type: 'step_recorded', stepKey: 'fluids', detail: {}, reason: '', actorName: 'Μ. Κωνσταντίνου', at: atMinute(zero, 37) },
      { type: 'step_recorded', stepKey: 'antibiotic', detail: {}, reason: '', actorName: 'Δρ. Κ. Μαργαρίτης', at: atMinute(zero, 55) },
    ].reverse(),
  }
}

// The completed Hour-1 bundles of the year's bloodstream infections (demoInfectionHistory.js): septic shock
// for the patients who died, the plain bundle for the others. Written in the Demo's authored frame and
// moved to today like the episodes themselves.
const RUN_STAFF = [['Δρ. Κ. Μαργαρίτης', 'Μ. Κωνσταντίνου'], ['Δρ. Ε. Λαμπράκη', 'Α. Νικολάου'], ['Δρ. Σ. Καλλέργης', 'Δ. Παπαδάκη']]
function historyRun(item, index) {
  const shock = item.outcome === 'deceased' || item.critical
  const zero = `${item.startedAt}T05:${String(10 + (index % 5) * 8).padStart(2, '0')}:00.000Z`
  const [doctor, nurse] = RUN_STAFF[index % RUN_STAFF.length]
  const lactate = shock ? '5.1' : index % 2 ? '1.6' : '2.8'
  const done = (key, minute, value, by = nurse) => ({ key, status: 'done', doneAt: atMinute(zero, minute), value, notIndicatedReason: '', therapyId: null, recordedByName: by, recordedAt: atMinute(zero, minute + 2) })
  const steps = [
    done('lactate', 12 + (index % 3), lactate),
    done('blood_cultures', 18 + (index % 4), `${item.sampleId} · 2 σετ`),
    done('antibiotic', 38 + (index % 15), `${item.therapy[0]} ${item.therapy[1]} ${item.therapy[2]}`, doctor),
    done('fluids', 44 + (index % 10), shock ? '2.100 / 2.100 ml' : '1.000 / 2.100 ml'),
    shock
      ? done('vasopressor', 56, 'Νοραδρεναλίνη 0,1 mcg/kg/min', doctor)
      : { key: 'vasopressor', status: 'not_indicated', doneAt: null, value: '', notIndicatedReason: 'ΜΑΠ ≥ 65 mmHg μετά τα υγρά', therapyId: null, recordedByName: doctor, recordedAt: atMinute(zero, 58) },
    ...(Number(lactate) > 2 ? [done('lactate_repeat', 150 + (index % 3) * 20, shock ? '3.4' : '1.7')] : []),
  ]
  const finished = atMinute(zero, Number(lactate) > 2 ? 175 + (index % 3) * 20 : 70)
  return {
    id: `PRT-${item.id.slice(4)}-1`,
    caseId: item.id,
    protocolKey: shock ? 'septic_shock' : 'sepsis_hour1',
    recognizedAt: zero,
    recognitionSource: shock ? 'clinical' : 'qsofa',
    weightKg: 62 + (index * 7) % 30,
    status: 'completed',
    startedByName: doctor,
    startedAt: atMinute(zero, 1),
    completedAt: finished,
    completedByName: doctor,
    closeReason: '',
    steps,
    events: [
      { type: 'started', stepKey: null, detail: { source: shock ? 'clinical' : 'qsofa' }, reason: '', actorName: doctor, at: atMinute(zero, 1) },
      ...steps.map(step => ({ type: 'step_recorded', stepKey: step.key, detail: { status: step.status }, reason: step.notIndicatedReason, actorName: step.recordedByName, at: step.recordedAt })),
      { type: 'completed', stepKey: null, detail: {}, reason: '', actorName: doctor, at: finished },
    ].reverse(),
  }
}
const historyRuns = shiftDemoDatesInPlace(historyCases.filter(item => item.hai?.[1] === 'bloodstreamInfection' && !item.birthWeightGrams).map(historyRun))

export const demoProtocolRuns = emptyInPreview([hourOneRun(), ...historyRuns])

// A review already recorded for the colistin of SUR-260036 (60 hours after its start).
export const demoTherapyReviews = emptyInPreview([
  {
    id: 'REVW-260172-1',
    therapyId: 'TX-260172',
    caseId: 'SUR-260036',
    decision: 'continue',
    reasons: ['susceptibility', 'no_improvement'],
    note: 'Συνέχιση κατά αντιβιόγραμμα· επανεκτίμηση σε 48 ώρες.',
    newRegimen: '',
    reviewedAt: null,
    reviewerName: 'Δρ. Ε. Λαμπράκη',
    reviewerJobTitle: 'Λοιμωξιολόγος',
    hoursAfterStart: 60,
  },
  // The 48–72 hour reviews of the year's other episodes (demoInfectionHistory.js): resistant organisms stay on
  // their targeted drug, susceptible ones are narrowed or moved to the oral route. Times follow each therapy's start.
  ...historyCases.map((item, index) => {
    const [drug, , route] = item.therapy
    const resistant = Boolean(item.resistance)
    const decision = resistant || route === 'PO' || item.birthWeightGrams ? 'continue' : index % 2 ? 'iv_to_oral' : 'deescalate'
    const note = {
      continue: resistant ? `Συνέχιση ${drug} κατά αντιβιόγραμμα.` : `Συνέχιση ${drug}· καλή κλινική πορεία.`,
      iv_to_oral: 'Απύρετος 48 ώρες, σιτίζεται: μετάβαση σε από του στόματος αγωγή.',
      deescalate: 'Αποκλιμάκωση σε στενότερου φάσματος κατά αντιβιόγραμμα.',
    }[decision]
    return {
      id: `REVW-${item.id.slice(4)}-1`,
      therapyId: `TX-${item.id.slice(-3)}H`,
      caseId: item.id,
      decision,
      reasons: decision === 'continue' ? (resistant ? ['susceptibility'] : ['clinical_improvement']) : decision === 'iv_to_oral' ? ['clinical_improvement', 'oral_route_possible'] : ['susceptibility', 'clinical_improvement'],
      note,
      newRegimen: decision === 'iv_to_oral' ? 'Amoxicillin/clavulanic acid 1 g PO x2' : decision === 'deescalate' ? 'Cefuroxime 1.5 g IV x3' : '',
      reviewedAt: null,
      reviewerName: index % 2 ? 'Δρ. Ε. Λαμπράκη' : 'Δρ. Σ. Καλλέργης',
      reviewerJobTitle: 'Λοιμωξιολόγος',
      hoursAfterStart: 50 + (index % 5) * 4,
    }
  }),
])
