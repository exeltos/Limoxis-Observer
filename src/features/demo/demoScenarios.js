// The evaluation guide: six scenarios, each opening the screen where it starts.
// A scenario may list steps, each checked off by its screen (see
// demoScenarioSignals.js); one step can be the scenario's record opening.
// A step with `target` is outlined on screen (DemoStepSpotlight) where the
// screen marks it with data-demo-step="scenario:step".
export const DEMO_SCENARIOS = Object.freeze([
  { key: 'patient_admission', to: '/patients',
    titleEl: 'Εισαγωγή ασθενούς', titleEn: 'Admit a patient',
    textEl: 'Από το Μητρώο ασθενών πατήστε «Νέος ασθενής», συμπληρώστε τα στοιχεία και το τμήμα εισαγωγής και ανοίξτε την ενιαία κλινική καρτέλα του.',
    textEn: 'In the patient registry press "New patient", fill in the details and the admitting department, then open the patient\'s clinical record.' },
  { key: 'clabsi_classification', to: '/surveillance',
    titleEl: 'CLABSI με κριτήρια ECDC', titleEn: 'CLABSI with ECDC criteria',
    textEl: 'Ανοίξτε ένα περιστατικό επιτήρησης στη ΜΕΘ, δείτε την ταξινόμηση της λοίμωξης με τα κριτήρια ECDC και την πορεία με τις επανεκτιμήσεις.',
    textEn: 'Open a surveillance case in the ICU and review the infection classification against the ECDC criteria and its reassessments.',
    steps: [
      { id: 'open', route: true, labelEl: 'Ανοίξτε ένα περιστατικό επιτήρησης', labelEn: 'Open a surveillance case' },
      { id: 'hai', target: true, labelEl: 'Δείτε την ταξινόμηση HAI / AMR', labelEn: 'Review the HAI / AMR classification' },
      { id: 'reassessment', target: true, labelEl: 'Δείτε την πορεία με τις επανεκτιμήσεις', labelEn: 'Review the reassessments' },
    ] },
  { key: 'microbiology_mdro', to: '/laboratory',
    titleEl: 'Μικροβιολογικό → αντιβιόγραμμα → MDRO', titleEn: 'Microbiology → susceptibility → MDRO',
    textEl: 'Στο Εργαστήριο ανοίξτε μια θετική καλλιέργεια: δείτε το αντιβιόγραμμα, την κατηγοριοποίηση MDR/XDR και τη σύνδεση με την απομόνωση του ασθενούς.',
    textEn: 'In the Laboratory open a positive culture: review the susceptibility test, the MDR/XDR category and the link to the patient\'s isolation.',
    steps: [
      { id: 'open', route: true, labelEl: 'Ανοίξτε μια θετική καλλιέργεια', labelEn: 'Open a positive culture' },
      { id: 'ast', target: true, labelEl: 'Καταχωρίστε αντιβιόγραμμα', labelEn: 'Record a susceptibility test' },
      { id: 'amr', target: true, labelEl: 'Ταξινομήστε το AMR (MDR/XDR/PDR)', labelEn: 'Classify the AMR (MDR/XDR/PDR)' },
      { id: 'communication', target: true, labelEl: 'Καταγράψτε την επικοινωνία του κρίσιμου αποτελέσματος', labelEn: 'Record the critical-result communication' },
    ] },
  { key: 'hand_hygiene', to: '/prevention/handHygiene/new?fromTab=handHygiene',
    titleEl: 'Υγιεινή χεριών (WHO)', titleEn: 'Hand hygiene (WHO)',
    textEl: 'Καταγράψτε μια παρατήρηση με τις 5 στιγμές του ΠΟΥ και δείτε πώς ενημερώνεται η συμμόρφωση ανά τμήμα στην Πρόληψη.',
    textEn: 'Record an observation with the WHO 5 moments and see how compliance per department updates in Prevention.' },
  { key: 'incident_capa', to: '/quality/incidents/new',
    titleEl: 'Συμβάν → CAPA', titleEn: 'Incident → CAPA',
    textEl: 'Καταχωρίστε ένα συμβάν στο Κέντρο Ποιότητας και δημιουργήστε από αυτό διορθωτική ενέργεια (CAPA) με υπεύθυνο και προθεσμία.',
    textEn: 'Report an incident in the Quality Center and create a corrective action (CAPA) from it with an owner and a deadline.' },
  { key: 'analysis_export', to: '/analysis',
    titleEl: 'Ανάλυση και εξαγωγή', titleEn: 'Analysis and export',
    textEl: 'Στην Ανάλυση επιλέξτε περίοδο και τμήματα, δείτε τους δείκτες και κατεβάστε την αναφορά σε PDF ή CSV.',
    textEn: 'In Analysis choose a period and departments, review the indicators and download the report as PDF or CSV.' },
])

// The scenarios of the other roles (phase 2). demo_evaluation_progress accepts
// their keys only after 20261028120000_demo_role_guidance.sql.
const RECORD = (base) => new RegExp(`^/${base}/(?!new(?:/|$))[^/]+/?$`)
export const DEMO_ROLE_EXTRA_SCENARIOS = Object.freeze([
  { key: 'employee_record', to: '/employees',
    titleEl: 'Καρτέλα εργαζομένου', titleEn: 'Employee record',
    textEl: 'Από το Μητρώο προσωπικού ανοίξτε έναν εργαζόμενο και δείτε την εκπαίδευση και τα έγγραφά του.',
    textEn: 'In the staff registry open an employee and review their training and documents.',
    steps: [
      { id: 'open', route: RECORD('employees'), labelEl: 'Ανοίξτε την καρτέλα ενός εργαζομένου', labelEn: 'Open an employee record' },
      { id: 'training', labelEl: 'Δείτε την καρτέλα «Εκπαίδευση»', labelEn: 'Open the Training tab' },
      { id: 'documents', labelEl: 'Δείτε τα πιστοποιητικά και τα έγγραφα', labelEn: 'Open the certificates and documents' },
    ] },
  { key: 'performance_evaluation', to: '/employees',
    titleEl: 'Αξιολόγηση απόδοσης', titleEn: 'Performance evaluation',
    textEl: 'Ανοίξτε έναν εργαζόμενο και καταχωρίστε μια αξιολόγηση απόδοσης από την καρτέλα «Αξιολογήσεις».',
    textEn: 'Open an employee and record a performance evaluation from the Evaluations tab.',
    steps: [
      { id: 'open', route: RECORD('employees'), labelEl: 'Ανοίξτε την καρτέλα ενός εργαζομένου', labelEn: 'Open an employee record' },
      { id: 'evaluations', labelEl: 'Ανοίξτε την καρτέλα «Αξιολογήσεις»', labelEn: 'Open the Evaluations tab' },
      { id: 'create', labelEl: 'Καταχωρίστε μια αξιολόγηση', labelEn: 'Record an evaluation' },
    ] },
  { key: 'occupational_visit', to: '/occupational-health',
    titleEl: 'Επίσκεψη ιατρού εργασίας', titleEn: 'Occupational health visit',
    textEl: 'Στην Ιατρική της εργασίας καταχωρίστε μια επίσκεψη εργαζομένου με το είδος και το συμπέρασμά της.',
    textEn: 'In Occupational health record an employee visit with its type and outcome.',
    steps: [{ id: 'visit', labelEl: 'Καταχωρίστε μια επίσκεψη', labelEn: 'Record a visit' }] },
  { key: 'occupational_exposure', to: '/occupational-health',
    titleEl: 'Επαγγελματική έκθεση', titleEn: 'Occupational exposure',
    textEl: 'Καταγράψτε ένα συμβάν έκθεσης (π.χ. τρύπημα από βελόνα) με την παρακολούθηση που χρειάζεται.',
    textEn: 'Record an exposure incident (e.g. a needlestick injury) with the follow-up it needs.',
    steps: [{ id: 'record', labelEl: 'Καταγράψτε ένα συμβάν έκθεσης', labelEn: 'Record an exposure incident' }] },
  { key: 'quality_audit', to: '/quality/audits/new',
    titleEl: 'Επιθεώρηση ποιότητας', titleEn: 'Quality audit',
    textEl: 'Στο Κέντρο Ποιότητας καταχωρίστε μια επιθεώρηση με το τμήμα, τα ευρήματα και το αποτέλεσμά της.',
    textEn: 'In the Quality Center record an audit with its department, findings and result.',
    steps: [{ id: 'create', labelEl: 'Αποθηκεύστε την επιθεώρηση', labelEn: 'Save the audit' }] },
  { key: 'antimicrobial_consumption', to: '/pharmacy',
    titleEl: 'Κατανάλωση αντιμικροβιακών', titleEn: 'Antimicrobial consumption',
    textEl: 'Στο Φαρμακείο καταχωρίστε μια χορήγηση αντιβιοτικού και δείτε πώς ενημερώνεται η κατανάλωση ανά τμήμα.',
    textEn: 'In Pharmacy record an antibiotic dispensing and see how consumption per department updates.',
    steps: [{ id: 'save', labelEl: 'Καταχωρίστε μια χορήγηση', labelEn: 'Record a dispensing' }] },
  { key: 'committee_minutes', to: '/committees',
    titleEl: 'Συνεδρίαση και πρακτικά', titleEn: 'Meeting and minutes',
    textEl: 'Ανοίξτε μια επιτροπή, προγραμματίστε συνεδρίαση και καταχωρίστε τα πρακτικά της.',
    textEn: 'Open a committee, schedule a meeting and record its minutes.',
    steps: [
      { id: 'open', route: RECORD('committees'), labelEl: 'Ανοίξτε μια επιτροπή', labelEn: 'Open a committee' },
      { id: 'meeting', labelEl: 'Προγραμματίστε μια συνεδρίαση', labelEn: 'Schedule a meeting' },
      { id: 'minutes', labelEl: 'Αποθηκεύστε τα πρακτικά', labelEn: 'Save the minutes' },
    ] },
  { key: 'users_roles', to: '/management?tab=users',
    titleEl: 'Χρήστες και πρόσβαση', titleEn: 'Users and access',
    textEl: 'Στο Κέντρο Διαχείρισης δημιουργήστε έναν χρήστη και αλλάξτε τον ρόλο του.',
    textEn: 'In the Management Center create a user and change their role.',
    steps: [
      { id: 'create', labelEl: 'Δημιουργήστε έναν χρήστη', labelEn: 'Create a user' },
      { id: 'role', labelEl: 'Αλλάξτε τον ρόλο ενός χρήστη', labelEn: 'Change a user\'s role' },
    ] },
  { key: 'custom_roles', to: '/management?tab=roles',
    titleEl: 'Προσαρμοσμένοι ρόλοι', titleEn: 'Custom roles',
    textEl: 'Στο Κέντρο Διαχείρισης, καρτέλα «Ρόλοι», δημιουργήστε έναν ρόλο με τις δικές σας άδειες.',
    textEn: 'In the Management Center, Roles tab, create a role with your own permissions.',
    steps: [{ id: 'save', labelEl: 'Αποθηκεύστε τον ρόλο', labelEn: 'Save the role' }] },
  { key: 'department_overview', to: '/my-department',
    titleEl: 'Το τμήμα μου', titleEn: 'My department',
    textEl: 'Δείτε την εικόνα του τμήματός σας και ανοίξτε έναν έλεγχο που το αφορά.',
    textEn: 'Review your department\'s overview and open an inspection that concerns it.',
    steps: [
      { id: 'open', route: /^\/my-department\/?$/, labelEl: 'Ανοίξτε «Το τμήμα μου»', labelEn: 'Open My department' },
      { id: 'control', route: RECORD('controls'), labelEl: 'Ανοίξτε έναν έλεγχο', labelEn: 'Open an inspection' },
    ] },
  { key: 'staff_training', to: '/training',
    titleEl: 'Εκπαίδευση προσωπικού', titleEn: 'Staff training',
    textEl: 'Στην Εκπαίδευση ανοίξτε ένα πρόγραμμα και δείτε τους συμμετέχοντες και την πρόοδό τους.',
    textEn: 'In Training open a programme and review its participants and their progress.',
    steps: [{ id: 'open', route: RECORD('training'), labelEl: 'Ανοίξτε ένα εκπαιδευτικό πρόγραμμα', labelEn: 'Open a training programme' }] },
])

// Every scenario the guide knows: the six above and the other roles'.
export const DEMO_ALL_SCENARIOS = Object.freeze([...DEMO_SCENARIOS, ...DEMO_ROLE_EXTRA_SCENARIOS])

// The per-role guide (docs/ROLE_MENU_AND_DEMO_GUIDANCE_DESIGN.md): each role
// sees the scenarios of its own daily work. Roles not listed see all six.
export const DEMO_ROLE_SCENARIOS = Object.freeze({
  infection_control_lead: ['clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'analysis_export'],
  infection_control_member: ['clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'analysis_export'],
  link_nurse: ['hand_hygiene', 'patient_admission', 'clabsi_classification', 'incident_capa'],
  laboratory: ['microbiology_mdro'],
  doctor_reviewer: ['clabsi_classification', 'microbiology_mdro'],
  hr_office: ['employee_record', 'performance_evaluation'],
  occupational_physician: ['occupational_visit', 'occupational_exposure'],
  quality_manager: ['incident_capa', 'quality_audit'],
  pharmacy: ['antimicrobial_consumption'],
  committee_secretariat: ['committee_minutes'],
  hospital_admin: ['users_roles', 'custom_roles', 'analysis_export'],
  department_manager: ['department_overview', 'staff_training'],
  department_user: ['department_overview'],
})

// The six scenarios demo_evaluation_progress has always accepted; the others
// need 20261028120000_demo_role_guidance.sql (`extended`). Without it a role
// keeps only its original scenarios, or all six when it has none.
export const ORIGINAL_SCENARIO_KEYS = new Set(['patient_admission', 'clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'incident_capa', 'analysis_export'])

export function demoScenariosForRole(role, { extended = false } = {}) {
  const keys = (DEMO_ROLE_SCENARIOS[role] || []).filter((key) => extended || ORIGINAL_SCENARIO_KEYS.has(key))
  const all = extended ? DEMO_ALL_SCENARIOS : DEMO_SCENARIOS
  return keys.length ? keys.map((key) => all.find((scenario) => scenario.key === key)).filter(Boolean) : DEMO_SCENARIOS
}

// The scenarios to list for an evaluator in the Platform Owner's panel, from
// the keys they touched: the first role set that holds them all, else the six
// plus the others they touched.
export function demoScenariosForEvaluator(touchedKeys = []) {
  const touched = [...new Set(touchedKeys)].filter((key) => DEMO_ALL_SCENARIOS.some((scenario) => scenario.key === key))
  if (touched.every((key) => ORIGINAL_SCENARIO_KEYS.has(key))) return DEMO_SCENARIOS
  const roleKeys = Object.values(DEMO_ROLE_SCENARIOS).find((keys) => touched.every((key) => keys.includes(key)))
  const keys = roleKeys || [...ORIGINAL_SCENARIO_KEYS, ...touched.filter((key) => !ORIGINAL_SCENARIO_KEYS.has(key))]
  return keys.map((key) => DEMO_ALL_SCENARIOS.find((scenario) => scenario.key === key))
}

export const demoScenarioDoneCount = (progress = {}, scenarios = DEMO_SCENARIOS) => scenarios.filter((scenario) => progress[scenario.key]).length

// The steps of a scenario done so far: { stepId: true }.
export const demoStepsComplete = (scenario, done = {}) => Boolean(scenario?.steps?.length) && scenario.steps.every((step) => done[step.id])
