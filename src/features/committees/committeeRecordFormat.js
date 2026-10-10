// Labels and small helpers shared by the committee record page, its tab sections and dialogs.
export const todayIso = () => new Date().toISOString().slice(0, 10)
export const fmtDate = value =>
  value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('el-GR') : '—'
export const statusLabel = (status, en) =>
  ({
    planned: en ? 'Planned' : 'Προγραμματισμένη',
    draft: en ? 'Draft' : 'Πρόχειρο',
    approval_pending: en ? 'Pending approval' : 'Σε έγκριση',
    finalized: en ? 'Finalized' : 'Οριστικοποιημένη',
    cancelled: en ? 'Cancelled' : 'Ακυρωμένη',
  })[status] || status
export const workflowStatusLabel = (status, en) =>
  ({
    open: en ? 'Open' : 'Ανοιχτός',
    in_progress: en ? 'In progress' : 'Σε εξέλιξη',
    completed: en ? 'Completed' : 'Ολοκληρωμένος',
    cancelled: en ? 'Removed' : 'Αφαιρέθηκε',
  })[status] ||
  status ||
  '—'
export const workflowStatusClass = status =>
  status === 'completed'
    ? 'active'
    : status === 'in_progress'
      ? 'temporary'
      : status === 'cancelled'
        ? 'danger'
        : ''
export const frequencyLabel = (value, en) =>
  ({
    monthly: en ? 'Monthly' : 'Μηνιαία',
    bimonthly: en ? 'Every two months' : 'Ανά δίμηνο',
    quarterly: en ? 'Quarterly' : 'Τριμηνιαία',
    semiannual: en ? 'Semiannual' : 'Εξαμηνιαία',
    annual: en ? 'Annual' : 'Ετήσια',
    as_needed: en ? 'As needed' : 'Όποτε απαιτείται',
  })[value] ||
  value ||
  '—'
export const quorumLabel = (value, en) =>
  ({
    simple_majority: en ? 'Simple majority' : 'Απλή πλειοψηφία ενεργών μελών',
    two_thirds: '2/3',
    custom: en ? 'According to regulations' : 'Σύμφωνα με τον κανονισμό',
  })[value] ||
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
