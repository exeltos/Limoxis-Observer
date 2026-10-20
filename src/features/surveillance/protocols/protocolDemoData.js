// Demo protocols and antimicrobial reviews, kept for the session like the other
// demo records. Times are relative to when the Demo is opened, so the Hour-1
// bundle is always running (recognised 72 minutes ago). The empty-hospital
// preview (?helpEmpty=1) starts without them.
import { emptyInPreview } from '../../../core/preview/emptyPreview'

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

export const demoProtocolRuns = emptyInPreview([hourOneRun()])

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
])
