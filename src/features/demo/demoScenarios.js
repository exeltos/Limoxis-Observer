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

// Phase 1 of the per-role guide (docs/ROLE_MENU_AND_DEMO_GUIDANCE_DESIGN.md):
// each role sees the scenarios of its own daily work, drawn from the six
// above (their keys are what demo_evaluation_progress accepts). Roles not
// listed see all six.
export const DEMO_ROLE_SCENARIOS = Object.freeze({
  infection_control_lead: ['clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'analysis_export'],
  infection_control_member: ['clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'analysis_export'],
  link_nurse: ['hand_hygiene', 'patient_admission', 'clabsi_classification', 'incident_capa'],
  laboratory: ['microbiology_mdro'],
})

export function demoScenariosForRole(role) {
  const keys = DEMO_ROLE_SCENARIOS[role]
  return keys ? keys.map((key) => DEMO_SCENARIOS.find((scenario) => scenario.key === key)) : DEMO_SCENARIOS
}

export const demoScenarioDoneCount = (progress = {}, scenarios = DEMO_SCENARIOS) => scenarios.filter((scenario) => progress[scenario.key]).length

// The steps of a scenario done so far: { stepId: true }.
export const demoStepsComplete = (scenario, done = {}) => Boolean(scenario?.steps?.length) && scenario.steps.every((step) => done[step.id])
