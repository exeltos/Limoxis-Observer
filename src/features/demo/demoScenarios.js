// The evaluation guide: six scenarios, each opening the screen where it starts.
export const DEMO_SCENARIOS = Object.freeze([
  { key: 'patient_admission', to: '/patients',
    titleEl: 'Εισαγωγή ασθενούς', titleEn: 'Admit a patient',
    textEl: 'Από το Μητρώο ασθενών πατήστε «Νέος ασθενής», συμπληρώστε τα στοιχεία και το τμήμα εισαγωγής και ανοίξτε την ενιαία κλινική καρτέλα του.',
    textEn: 'In the patient registry press "New patient", fill in the details and the admitting department, then open the patient\'s clinical record.' },
  { key: 'clabsi_classification', to: '/surveillance',
    titleEl: 'CLABSI με κριτήρια ECDC', titleEn: 'CLABSI with ECDC criteria',
    textEl: 'Ανοίξτε ένα περιστατικό επιτήρησης στη ΜΕΘ, δείτε την ταξινόμηση της λοίμωξης με τα κριτήρια ECDC και την πορεία με τις επανεκτιμήσεις.',
    textEn: 'Open a surveillance case in the ICU and review the infection classification against the ECDC criteria and its reassessments.' },
  { key: 'microbiology_mdro', to: '/laboratory',
    titleEl: 'Μικροβιολογικό → αντιβιόγραμμα → MDRO', titleEn: 'Microbiology → susceptibility → MDRO',
    textEl: 'Στο Εργαστήριο ανοίξτε μια θετική καλλιέργεια: δείτε το αντιβιόγραμμα, την κατηγοριοποίηση MDR/XDR και τη σύνδεση με την απομόνωση του ασθενούς.',
    textEn: 'In the Laboratory open a positive culture: review the susceptibility test, the MDR/XDR category and the link to the patient\'s isolation.' },
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

export const demoScenarioDoneCount = (progress = {}) => DEMO_SCENARIOS.filter((scenario) => progress[scenario.key]).length
