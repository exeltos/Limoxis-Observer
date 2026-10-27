// The priority work of each role, counted from the same dashboard metrics as
// its tiles (a real hospital's from dashboardCloudService.js, the Demo's from
// demoDashboardMetrics.js), so a tile and the task under it never disagree.
// Work with nothing pending is left out.

// Roles whose home counts only their own department.
export const DEPARTMENT_ROLES = new Set(['department_manager', 'department_user'])

// The hospital administrator's "Pending actions" tile is the sum of these.
export const PENDING_ACTION_KEYS = [
  'overdueControls',
  'pendingSamples',
  'openIncidents',
  'overdueCapa',
]
export const pendingActionsOf = metrics =>
  PENDING_ACTION_KEYS.reduce((sum, key) => sum + (Number(metrics?.[key]) || 0), 0)

// [metric key, Greek title, English title, screen]
const TASKS = {
  hospital_admin: [
    ['overdueControls', 'Εκπρόθεσμοι έλεγχοι', 'Overdue controls', '/controls'],
    ['pendingSamples', 'Εκκρεμή δείγματα', 'Pending samples', '/laboratory'],
    ['openIncidents', 'Ανοιχτά συμβάντα', 'Open incidents', '/quality'],
    ['overdueCapa', 'Εκπρόθεσμες διορθωτικές ενέργειες', 'Overdue CAPA', '/quality'],
  ],
  infection_control_lead: [
    [
      'isolationReviewsDue',
      'Επανεκτιμήσεις απομόνωσης',
      'Isolation reassessments',
      '/surveillance',
    ],
    ['overdueControls', 'Εκπρόθεσμοι έλεγχοι', 'Overdue controls', '/controls'],
    [
      'criticalUncommunicated',
      'Κρίσιμα εργαστηριακά αποτελέσματα',
      'Critical laboratory results',
      '/laboratory',
    ],
  ],
  laboratory: [
    ['pendingSamples', 'Εκκρεμή δείγματα', 'Pending samples', '/laboratory'],
    [
      'criticalUncommunicated',
      'Κρίσιμα αποτελέσματα χωρίς επικοινωνία',
      'Critical results not communicated',
      '/laboratory',
    ],
  ],
  department_manager: [
    ['controlsDueToday', 'Έλεγχοι για σήμερα', 'Controls due today', '/controls?due=today'],
    ['overdueControls', 'Εκπρόθεσμοι έλεγχοι τμήματος', 'Overdue department controls', '/controls'],
    ['pendingSamples', 'Εκκρεμή δείγματα τμήματος', 'Pending department samples', '/laboratory'],
  ],
  occupational_physician: [
    ['ohFollowupsDue', 'Επανέλεγχοι εργαζομένων', 'Employee follow-ups', '/occupational-health'],
    ['vaccinationsDue', 'Εμβολιασμοί προς ανανέωση', 'Vaccinations due', '/occupational-health'],
  ],
  quality_manager: [
    ['overdueCapa', 'Εκπρόθεσμες διορθωτικές ενέργειες', 'Overdue CAPA', '/quality'],
    ['severeOpenIncidents', 'Σοβαρά ανοικτά συμβάντα', 'Severe open incidents', '/quality'],
  ],
  committee_secretariat: [
    [
      'pendingMinutes',
      'Πρακτικά προς οριστικοποίηση',
      'Minutes awaiting finalization',
      '/meetings',
    ],
    ['openDecisions', 'Ανοικτές αποφάσεις', 'Open decisions', '/meetings'],
  ],
  pharmacy: [
    [
      'pendingApprovals',
      'Εγκρίσεις αντιβιοτικών σε αναμονή',
      'Antimicrobial approvals pending',
      '/pharmacy',
    ],
  ],
  doctor_reviewer: [
    [
      'pendingApprovals',
      'Ιατρικές εγκρίσεις σε αναμονή',
      'Clinical approvals pending',
      '/surveillance',
    ],
  ],
  hr_office: [
    [
      'employeesWithoutDepartment',
      'Εργαζόμενοι χωρίς τμήμα',
      'Employees without a department',
      '/employees',
    ],
  ],
}
TASKS.infection_control_member = TASKS.infection_control_lead
TASKS.department_user = TASKS.department_manager

export function dashboardTasks(role, metrics = {}, language = 'el') {
  const en = language === 'en'
  return (TASKS[role] || [])
    .filter(([key]) => Number(metrics[key]) > 0)
    .map(([key, el, enText, to]) => ({
      id: `LIVE-${role}-${key}`,
      title: en ? enText : el,
      count: Number(metrics[key]),
      to,
      type: 'task',
      source: 'dashboard',
    }))
}
