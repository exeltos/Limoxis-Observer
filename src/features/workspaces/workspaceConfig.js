import { ROLES } from '../../core/permissions/roles'

const configsEl = {
  [ROLES.PLATFORM_OWNER]: {
    title: 'Κέντρο Πλατφόρμας',
    subtitle: 'Νοσοκομεία, ενεργοποιήσεις, demo environments, ασφάλεια και κατάσταση πλατφόρμας.',
    kpis: [['Νοσοκομεία', '—'], ['Ενεργά', '—'], ['Εκκρεμή activation', '—'], ['Demo environments', '—']],
    tasks: ['Έλεγχος εκκρεμών ενεργοποιήσεων', 'Audit & ασφάλεια πλατφόρμας', 'Κατάσταση υπηρεσιών'],
  },
  [ROLES.HOSPITAL_ADMIN]: {
    title: 'Διοίκηση Νοσοκομείου',
    subtitle: 'Χρήστες, λειτουργικές ενότητες, εκκρεμότητες διαχείρισης και alerts συστήματος.',
    kpis: [['Ενεργοί χρήστες', '—'], ['Τμήματα', '—'], ['Εκκρεμότητες', '—'], ['Alerts', '—']],
    tasks: ['Έλεγχος χρηστών και δικαιωμάτων', 'Εκκρεμείς ρυθμίσεις οργανισμού', 'Έλεγχος audit συμβάντων'],
  },
  [ROLES.INFECTION_CONTROL_LEAD]: {
    title: 'Infection Control Command Center',
    subtitle: 'Τι χρειάζεται την προσοχή μου σήμερα;',
    kpis: [['Νέα MDR/XDR', '2'], ['Isolation reviews', '4'], ['Εκπρόθεσμοι έλεγχοι', '3'], ['Εκκρεμείς εγκρίσεις', '5']],
    tasks: ['Ασθενής χωρίς επανέλεγχο', 'Isolation review εκπρόθεσμο', 'Τμήμα με χαμηλή συμμόρφωση WHO'],
  },
  [ROLES.INFECTION_CONTROL_MEMBER]: {
    title: 'Επιτήρηση Λοιμώξεων',
    subtitle: 'Επιτηρήσεις, εργαστηριακά ευρήματα και ενέργειες πρόληψης που απαιτούν παρακολούθηση.',
    kpis: [['Ενεργές επιτηρήσεις', '—'], ['Θετικά εργαστηρίου', '—'], ['Επανέλεγχοι', '—'], ['Εκκρεμείς ενέργειες', '—']],
    tasks: ['Επανέλεγχοι επιτήρησης', 'Απομονώσεις προς αξιολόγηση', 'Ενέργειες πρόληψης'],
  },
  [ROLES.DEPARTMENT_MANAGER]: {
    title: 'Το τμήμα μου',
    subtitle: 'Συνοπτική λειτουργική εικόνα του τμήματος και εργασίες που απαιτούν ενέργεια.',
    kpis: [['Νοσηλευόμενοι', '—'], ['Ενεργές επιτηρήσεις', '—'], ['Εκκρεμή δείγματα', '—'], ['Ενεργοί έλεγχοι', '—']],
    tasks: ['Έλεγχος isolation bundle - λήγει αύριο', 'Επανεκτίμηση απομόνωσης', 'Εκπαίδευση προσωπικού σε εκκρεμότητα'],
  },
  [ROLES.DEPARTMENT_USER]: {
    title: 'Το τμήμα μου',
    subtitle: 'Μόνο οι δικές σας εκκρεμότητες και οι εργασίες του τμήματος που χρειάζεται να γνωρίζετε.',
    kpis: [],
    tasks: ['Έλεγχος PPE', 'Ανατεθειμένη εκπαίδευση', 'Επανέλεγχος bundle'],
  },
  [ROLES.LABORATORY]: {
    title: 'Εργαστήριο',
    subtitle: 'Queue δειγμάτων και αποτελεσμάτων που χρειάζονται διαχείριση.',
    kpis: [['Νέα δείγματα', '—'], ['Εκκρεμή', '—'], ['Θετικά', '—'], ['Κρίσιμα', '—']],
    tasks: ['Εκκρεμή αποτελέσματα', 'Κρίσιμα αποτελέσματα προς επικοινωνία', 'Έλεγχοι εργαστηρίου'],
  },
  [ROLES.COMMITTEE_SECRETARIAT]: {
    title: 'Επιτροπές', subtitle: 'Συνεδριάσεις, πρακτικά και αποφάσεις προς παρακολούθηση.',
    kpis: [['Επόμενες συνεδριάσεις', '—'], ['Πρακτικά εκκρεμή', '—'], ['Αποφάσεις ανοικτές', '—']], tasks: ['Οριστικοποίηση πρακτικών', 'Παρακολούθηση αποφάσεων'],
  },
  [ROLES.HR_OFFICE]: {
    title: 'Προσωπικό', subtitle: 'Διοικητικό μητρώο εργαζομένων χωρίς πρόσβαση σε ευαίσθητα ιατρικά δεδομένα.',
    kpis: [['Ενεργοί εργαζόμενοι', '—'], ['Νέες εγγραφές', '—'], ['Εκκρεμή στοιχεία', '—']], tasks: ['Έλεγχος διοικητικών στοιχείων', 'Ενημέρωση τμημάτων/ιδιοτήτων'],
  },
  [ROLES.OCCUPATIONAL_PHYSICIAN]: {
    title: 'Ιατρός Εργασίας', subtitle: 'Επισκέψεις, επανέλεγχοι και εμβολιασμοί εργαζομένων.',
    kpis: [['Επισκέψεις σήμερα', '—'], ['Επανέλεγχοι', '—'], ['Εμβολιασμοί προς ανανέωση', '—']], tasks: ['Follow-up εργαζομένων', 'Επανέλεγχοι υγείας'],
  },
  [ROLES.PHARMACY]: {
    title: 'Φαρμακείο', subtitle: 'Antimicrobial stewardship, εγκρίσεις και κατανάλωση.',
    kpis: [['Εγκρίσεις εκκρεμείς', '—'], ['Προωθημένα αντιβιοτικά', '—'], ['DDD', '—']], tasks: ['Εκκρεμείς εγκρίσεις', 'Έλεγχος κατανάλωσης'],
  },
  [ROLES.DOCTOR_REVIEWER]: {
    title: 'Ιατρικές εγκρίσεις', subtitle: 'Μόνο τα στοιχεία που απαιτούνται για την ιατρική απόφαση.',
    kpis: [['Εκκρεμείς', '—'], ['Εγκεκριμένες', '—'], ['Απορριφθείσες', '—']], tasks: ['Ιατρικές εγκρίσεις προς αξιολόγηση'],
  },
  [ROLES.QUALITY_MANAGER]: {
    title: 'Κέντρο Ποιότητας', subtitle: 'Συμβάντα, CAPA, audits, έλεγχοι και δείκτες.',
    kpis: [['Ανοιχτά συμβάντα', '—'], ['Σοβαρά', '—'], ['CAPA εκπρόθεσμα', '—'], ['Δείκτες εκτός στόχου', '—']], tasks: ['CAPA εκπρόθεσμα', 'Audits σε εξέλιξη', 'Συμβάντα προς διερεύνηση'],
  },
}

const fallbackEl = { title: 'Limoxis Observer', subtitle: 'Οι εργασίες και οι πληροφορίες που αντιστοιχούν στον ρόλο σας.', kpis: [], tasks: [] }

const configsEn = {
  [ROLES.PLATFORM_OWNER]: {
    title: 'Platform Center',
    subtitle: 'Hospitals, activations, demo environments, security and platform status.',
    kpis: [['Hospitals','—'],['Active','—'],['Pending activation','—'],['Demo environments','—']],
    tasks: ['Review pending activations','Platform audit & security','Service status'],
  },
  [ROLES.HOSPITAL_ADMIN]: {
    title: 'Hospital Administration',
    subtitle: 'Users, operational modules, management pending work and system alerts.',
    kpis: [['Active users','—'],['Departments','—'],['Pending items','—'],['Alerts','—']],
    tasks: ['Review users and permissions','Pending organization settings','Review audit events'],
  },
  [ROLES.INFECTION_CONTROL_LEAD]: {
    title: 'Infection Control Command Center',
    subtitle: 'What needs my attention today?',
    kpis: [['New MDR/XDR','2'],['Isolation reviews','4'],['Overdue controls','3'],['Pending approvals','5']],
    tasks: ['Patient without follow-up','Overdue isolation review','Department with low WHO compliance'],
  },
  [ROLES.INFECTION_CONTROL_MEMBER]: {
    title: 'Infection Surveillance',
    subtitle: 'Surveillance episodes, laboratory findings and prevention actions that require follow-up.',
    kpis: [['Active surveillance','—'],['Positive laboratory results','—'],['Follow-ups','—'],['Pending actions','—']],
    tasks: ['Surveillance follow-up','Isolation assessments','Prevention actions'],
  },
  [ROLES.DEPARTMENT_MANAGER]: {
    title: 'My department',
    subtitle: 'Operational overview of the department and tasks requiring action.',
    kpis: [['Inpatients','—'],['Active surveillance','—'],['Pending samples','—'],['Active controls','—']],
    tasks: ['Isolation bundle review - due tomorrow','Isolation reassessment','Staff training pending'],
  },
  [ROLES.DEPARTMENT_USER]: {
    title: 'My department',
    subtitle: 'Only your own pending work and the department information you need to know.',
    kpis: [],
    tasks: ['PPE control','Assigned training','Bundle follow-up'],
  },
  [ROLES.LABORATORY]: {
    title: 'Laboratory',
    subtitle: 'Queue of samples and results requiring laboratory action.',
    kpis: [['New samples','—'],['Pending','—'],['Positive','—'],['Critical','—']],
    tasks: ['Pending results','Critical results requiring communication','Laboratory controls'],
  },
  [ROLES.COMMITTEE_SECRETARIAT]: {
    title: 'Committees', subtitle: 'Meetings, minutes and decisions requiring follow-up.',
    kpis: [['Upcoming meetings','—'],['Minutes pending','—'],['Open decisions','—']], tasks: ['Finalize minutes','Follow up decisions'],
  },
  [ROLES.HR_OFFICE]: {
    title: 'Staff', subtitle: 'Administrative employee registry without access to sensitive medical information.',
    kpis: [['Active employees','—'],['New records','—'],['Pending information','—']], tasks: ['Review administrative information','Update departments/positions'],
  },
  [ROLES.OCCUPATIONAL_PHYSICIAN]: {
    title: 'Occupational Health', subtitle: 'Employee visits, follow-up and vaccinations.',
    kpis: [['Visits today','—'],['Follow-ups','—'],['Vaccinations due','—']], tasks: ['Employee follow-up','Health reassessments'],
  },
  [ROLES.PHARMACY]: {
    title: 'Pharmacy', subtitle: 'Antimicrobial stewardship, approvals and consumption.',
    kpis: [['Pending approvals','—'],['Restricted antimicrobials','—'],['DDD','—']], tasks: ['Pending approvals','Consumption review'],
  },
  [ROLES.DOCTOR_REVIEWER]: {
    title: 'Clinical approvals', subtitle: 'Only the information required for the clinical review decision.',
    kpis: [['Pending','—'],['Approved','—'],['Rejected','—']], tasks: ['Clinical approvals awaiting review'],
  },
  [ROLES.QUALITY_MANAGER]: {
    title: 'Quality Center', subtitle: 'Incidents, CAPA, audits, controls and indicators.',
    kpis: [['Open incidents','—'],['Serious','—'],['Overdue CAPA','—'],['Indicators off target','—']], tasks: ['Overdue CAPA','Audits in progress','Incidents under investigation'],
  },
}

const fallbackEn = { title: 'Limoxis Observer', subtitle: 'Tasks and information available to your role.', kpis: [], tasks: [] }

export const workspaceFor = (role, language='el') => language==='en' ? (configsEn[role] ?? fallbackEn) : (configsEl[role] ?? fallbackEl)
