import { hospitalToday } from '../../core/dates/hospitalDate'
// Labels and small helpers shared by the committee record page, its tab sections and dialogs.
export const todayIso = () => hospitalToday()
export const fmtDate = (value: unknown) =>
  value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('el-GR') : '—'
// A term without an end reads «from 28/3/2022», never «28/3/2022 – —».
export const termText = (start: unknown, end: unknown, en: boolean, format: (value: unknown) => string = fmtDate) =>
  start && end ? `${format(start)} – ${format(end)}` : start ? `${en ? 'from' : 'από'} ${format(start)}` : end ? `${en ? 'until' : 'έως'} ${format(end)}` : '—'
export const statusLabel = (status: string, en: boolean) =>
  ({
    planned: en ? 'Planned' : 'Προγραμματισμένη',
    draft: en ? 'Draft' : 'Πρόχειρο',
    approval_pending: en ? 'Pending approval' : 'Σε έγκριση',
    finalized: en ? 'Finalized' : 'Οριστικοποιημένη',
    cancelled: en ? 'Cancelled' : 'Ακυρωμένη',
  } as Record<string, string>)[status] || status
export const workflowStatusLabel = (status: string, en: boolean) =>
  ({
    open: en ? 'Open' : 'Ανοιχτός',
    in_progress: en ? 'In progress' : 'Σε εξέλιξη',
    completed: en ? 'Completed' : 'Ολοκληρωμένος',
    cancelled: en ? 'Removed' : 'Αφαιρέθηκε',
  } as Record<string, string>)[status] ||
  status ||
  '—'
export const workflowStatusClass = (status: string) =>
  status === 'completed'
    ? 'active'
    : status === 'in_progress'
      ? 'temporary'
      : status === 'cancelled'
        ? 'danger'
        : ''
export const frequencyLabel = (value: string | undefined, en: boolean) =>
  ({
    monthly: en ? 'Monthly' : 'Μηνιαία',
    bimonthly: en ? 'Every two months' : 'Ανά δίμηνο',
    quarterly: en ? 'Quarterly' : 'Τριμηνιαία',
    semiannual: en ? 'Semiannual' : 'Εξαμηνιαία',
    annual: en ? 'Annual' : 'Ετήσια',
    as_needed: en ? 'As needed' : 'Όποτε απαιτείται',
  } as Record<string, string>)[value ?? ''] ||
  value ||
  '—'
export const quorumLabel = (value: string | undefined, en: boolean) =>
  ({
    simple_majority: en ? 'Simple majority' : 'Απλή πλειοψηφία ενεργών μελών',
    two_thirds: '2/3',
    custom: en ? 'According to regulations' : 'Σύμφωνα με τον κανονισμό',
  } as Record<string, string>)[value ?? ''] ||
  value ||
  '—'
export const createTopic = () => ({
  id: `TOP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  subject: '',
  decision: '',
  followUp: false,
  action: '',
  owner: '',
  dueDate: '',
  priority: 'medium',
})
export const COMMITTEE_ROLE_OPTIONS = [
  ['Πρόεδρος', 'Chair'],
  ['Αντιπρόεδρος', 'Vice chair'],
  ['Γραμματέας', 'Secretary'],
  ['Συντονιστής', 'Coordinator'],
  ['Μέλος', 'Member'],
  ['Αναπληρωματικό μέλος', 'Alternate member'],
  ['Εισηγητής', 'Rapporteur'],
  ['Σύμβουλος', 'Advisor'],
  ['Παρατηρητής', 'Observer'],
]

// The working team of a committee (its members marked so): in the infection committee the law's «Ομάδα Εργασίας και
// Επέμβασης (ΟΕΕ)»; elsewhere a working team.
const isInfectionCommittee = (name: unknown) => /λοιμ|infection/i.test(String(name || ''))
export const controlTeamName = (committeeName: unknown, en: boolean) =>
  isInfectionCommittee(committeeName)
    ? (en ? 'Working and Intervention Team (WIT)' : 'Ομάδα Εργασίας και Επέμβασης (ΟΕΕ)')
    : (en ? 'Working team' : 'Ομάδα εργασίας')
export const controlTeamShort = (committeeName: unknown, en: boolean) =>
  isInfectionCommittee(committeeName) ? (en ? 'WIT' : 'ΟΕΕ') : (en ? 'Working team' : 'Ομάδα εργασίας')
// Who met: the whole committee or its working team.
export const compositionLabel = (composition: string, teamName: string, en: boolean) =>
  composition === 'control_team' ? teamName : (en ? 'Whole committee' : 'Ολομέλεια επιτροπής')
