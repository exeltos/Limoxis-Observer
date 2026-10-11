// A year of the Demo hospital's infections (authored 2025-09 … 2026-08), shared by
// Surveillance (episodes), Laboratory (the cultures behind them) and Patients, so
// every screen tells the same story. Each module builds its own records from these
// definitions and moves their dates forward itself (src/core/data/demoClock.js).
import { addDays } from '../../core/data/demoSeed'

export const WARD_EN = {
  ΜΕΘ: 'ICU',
  Παθολογική: 'Internal Medicine',
  Χειρουργική: 'Surgery',
  ΤΕΠ: 'ED',
  Καρδιολογική: 'Cardiology',
  'Νεογνολογική / ΜΕΝΝ': 'Neonatal / NICU',
  Ορθοπαιδική: 'Orthopedics',
}
const ROOM_PREFIX = {
  ΜΕΘ: 'ICU',
  Παθολογική: 'IM',
  Χειρουργική: 'SU',
  ΤΕΠ: 'ED',
  Καρδιολογική: 'CA',
  'Νεογνολογική / ΜΕΝΝ': 'ΜΕΝΝ',
  Ορθοπαιδική: 'OR',
}

// Where each culture comes from: sample type, the laboratory source and the
// clinical site shown on the surveillance episode.
export const SAMPLE_SITES = {
  centralLine: ['bloodCulture', 'Κεντρική φλεβική γραμμή', 'Central line', 'Αίμα', 'Blood'],
  peripheral: ['bloodCulture', 'Περιφερική αιμοληψία', 'Peripheral draw', 'Αίμα', 'Blood'],
  urinaryCatheter: ['urineCulture', 'Ουροκαθετήρας', 'Urinary catheter', 'Ούρα', 'Urine'],
  midstream: ['urineCulture', 'Μέσο ρεύμα ούρων', 'Midstream urine', 'Ούρα', 'Urine'],
  trachealAspirate: [
    'respiratorySample',
    'Τραχειακό αναρρόφημα',
    'Tracheal aspirate',
    'Αναπνευστικό',
    'Respiratory',
  ],
  bal: ['respiratorySample', 'BAL', 'BAL', 'Αναπνευστικό', 'Respiratory'],
  sputum: ['respiratorySample', 'Πτύελα', 'Sputum', 'Αναπνευστικό', 'Respiratory'],
  woundSwab: [
    'woundCulture',
    'Επίχρισμα τραύματος',
    'Wound swab',
    'Χειρουργικό τραύμα',
    'Surgical wound',
  ],
  deepTissue: [
    'woundCulture',
    'Βαθύς ιστός',
    'Deep tissue',
    'Χειρουργικό τραύμα',
    'Surgical wound',
  ],
  drainage: [
    'woundCulture',
    'Παροχέτευση / έκκριμα',
    'Drainage',
    'Χειρουργικό τραύμα',
    'Surgical wound',
  ],
  stool: ['other', 'Κόπρανα (τοξίνη)', 'Stool (toxin)', 'Κόπρανα', 'Stool'],
}

// EUCAST-style susceptibility of each organism/resistance profile; the first
// row is the reference agent the AMR indicators read.
const AST_PROFILES = {
  'Klebsiella pneumoniae|MDR': [
    ['Meropenem', 'R', '≥16'],
    ['Ceftazidime/avibactam', 'S', '2'],
    ['Colistin', 'S', '≤0.5'],
    ['Amikacin', 'I', '16'],
  ],
  'Klebsiella pneumoniae|ESBL': [
    ['Meropenem', 'S', '≤0.25'],
    ['Ceftriaxone', 'R', '>4'],
    ['Piperacillin/tazobactam', 'I', '16'],
  ],
  'Acinetobacter baumannii|XDR': [
    ['Meropenem', 'R', '>16'],
    ['Amikacin', 'R', '>32'],
    ['Colistin', 'S', '≤0.5'],
  ],
  'Pseudomonas aeruginosa|MDR': [
    ['Meropenem', 'R', '>8'],
    ['Piperacillin/tazobactam', 'R', '>16'],
    ['Ceftolozane/tazobactam', 'S', '2'],
  ],
  'Pseudomonas aeruginosa|': [
    ['Meropenem', 'S', '1'],
    ['Piperacillin/tazobactam', 'S', '8'],
    ['Ceftazidime', 'S', '4'],
  ],
  'Escherichia coli|ESBL': [
    ['Ceftriaxone', 'R', '>4'],
    ['Meropenem', 'S', '≤0.125'],
    ['Ciprofloxacin', 'R', '>1'],
  ],
  'Escherichia coli|': [
    ['Ceftriaxone', 'S', '≤1'],
    ['Amoxicillin/clavulanic acid', 'S', '4'],
    ['Ciprofloxacin', 'S', '≤0.25'],
  ],
  'Staphylococcus aureus|MRSA': [
    ['Oxacillin', 'R', '>2'],
    ['Vancomycin', 'S', '1'],
    ['Linezolid', 'S', '2'],
  ],
  'Staphylococcus aureus|': [
    ['Oxacillin', 'S', '0.5'],
    ['Vancomycin', 'S', '1'],
    ['Clindamycin', 'S', '≤0.25'],
  ],
  'Enterococcus faecium|VRE': [
    ['Vancomycin', 'R', '>32'],
    ['Linezolid', 'S', '2'],
    ['Ampicillin', 'R', '>8'],
  ],
  'Enterococcus faecalis|': [
    ['Vancomycin', 'S', '2'],
    ['Ampicillin', 'S', '2'],
  ],
  'Proteus mirabilis|': [
    ['Ceftriaxone', 'S', '≤1'],
    ['Amoxicillin/clavulanic acid', 'S', '4'],
  ],
}
export function astFor(organism, resistance) {
  const rows = AST_PROFILES[`${organism}|${resistance || ''}`] || []
  return rows.map(([drug, sir, mic]) => ({
    drug,
    sir,
    mic,
    method: 'MIC',
    standard: 'EUCAST',
    version: '16.0',
  }))
}
export const susceptibilitySummary = (organism, resistance) =>
  astFor(organism, resistance)
    .map(row => `${row.drug} ${row.sir}`)
    .join(' · ') || null

const DEVICES = {
  cvc: ['Κεντρικός φλεβικός καθετήρας', 'Central venous catheter', 'clabsi'],
  umbilical: [
    'Κεντρικός φλεβικός καθετήρας (ομφαλικός)',
    'Central venous catheter (umbilical)',
    'clabsi',
  ],
  foley: ['Ουροκαθετήρας', 'Urinary catheter', 'cauti'],
  ett: ['Ενδοτραχειακός σωλήνας', 'Endotracheal tube', 'vap'],
  pvc: ['Περιφερικός φλεβικός καθετήρας', 'Peripheral venous catheter', null],
}

const HAI_TEXT = {
  bloodstreamInfection: [
    'Πυρετός με θετική αιμοκαλλιέργεια.',
    'Fever with a positive blood culture.',
    ['Πυρετός >38°C', 'Ρίγος'],
    ['Fever >38°C', 'Rigors'],
  ],
  urinaryTractInfection: [
    'Συμπτωματική λοίμωξη ουροποιητικού.',
    'Symptomatic urinary tract infection.',
    ['Πυρετός', 'Ευαισθησία υπερηβικής χώρας'],
    ['Fever', 'Suprapubic tenderness'],
  ],
  ventilatorAssociatedPneumonia: [
    'Νέα διηθήματα και πυώδεις εκκρίσεις σε μηχανικό αερισμό.',
    'New infiltrates and purulent secretions on mechanical ventilation.',
    ['Πυρετός', 'Πυώδεις εκκρίσεις'],
    ['Fever', 'Purulent secretions'],
  ],
  surgicalSiteInfection: [
    'Λοίμωξη χειρουργικού πεδίου.',
    'Surgical site infection.',
    ['Ερυθρότητα', 'Πυώδης έκκριση'],
    ['Redness', 'Purulent discharge'],
  ],
  cdi: [
    'Διάρροια με θετική τοξίνη C. difficile μετά από αντιβιοτική αγωγή.',
    'Diarrhoea with a positive C. difficile toxin after antibiotic treatment.',
    ['Διάρροια ≥3 κενώσεις/24ω', 'Πυρετός'],
    ['Diarrhoea ≥3 stools/24h', 'Fever'],
  ],
}

// [id, sampleId, patientId, name, nameEn, birthDate, ward, bed, admitted (days
//  before start), started, organism, resistance, site, hai [status, type] or null,
//  device, therapy [agent, dose, route, days, approval], outcome, critical]
// prettier-ignore
const CASES = [
  ['SUR-250121', 'LAB-250908-021', 'PT-252001', 'Γεώργιος Μπέλλος', 'Georgios Bellos', '1951-03-14', 'ΜΕΘ', 4, 6, '2025-09-08', 'Klebsiella pneumoniae', 'MDR', 'centralLine', ['confirmed', 'bloodstreamInfection'], 'cvc', ['Ceftazidime/avibactam', '2.5 g', 'IV', 10, 'approved'], 'resolved', true],
  ['SUR-250124', 'LAB-250922-007', 'PT-252002', 'Σταυρούλα Καρρά', 'Stavroula Karra', '1962-07-30', 'Χειρουργική', 12, 5, '2025-09-22', 'Escherichia coli', 'ESBL', 'woundSwab', ['confirmed', 'surgicalSiteInfection'], null, ['Ertapenem', '1 g', 'IV', 7, 'not_required'], 'resolved', false],
  ['SUR-250127', 'LAB-251006-014', 'PT-252003', 'Χαράλαμπος Βλάχος', 'Charalampos Vlachos', '1947-11-02', 'ΜΕΘ', 2, 9, '2025-10-06', 'Acinetobacter baumannii', 'XDR', 'trachealAspirate', ['confirmed', 'ventilatorAssociatedPneumonia'], 'ett', ['Colistin', '9 MU', 'IV', 9, 'approved'], 'deceased', false],
  ['SUR-250130', 'LAB-251020-009', 'PT-252004', 'Αγγελική Σαββίδου', 'Angeliki Savvidou', '1939-05-21', 'Παθολογική', 8, 12, '2025-10-20', 'Clostridioides difficile', null, 'stool', null, null, ['Vancomycin', '125 mg', 'PO', 10, 'not_required'], 'resolved', false],
  ['SUR-250133', 'LAB-251103-016', 'PT-252005', 'Ιωάννης Τσακίρης', 'Ioannis Tsakiris', '1958-01-17', 'ΜΕΘ', 6, 8, '2025-11-03', 'Klebsiella pneumoniae', 'MDR', 'urinaryCatheter', ['confirmed', 'urinaryTractInfection'], 'foley', ['Ceftazidime/avibactam', '2.5 g', 'IV', 7, 'approved'], 'resolved', false],
  ['SUR-250136', 'LAB-251117-004', 'PT-252006', 'Ευάγγελος Ρούσσος', 'Evangelos Roussos', '1955-09-08', 'Καρδιολογική', 7, 6, '2025-11-17', 'Staphylococcus aureus', 'MRSA', 'peripheral', ['confirmed', 'bloodstreamInfection'], 'pvc', ['Vancomycin', '1 g', 'IV', 14, 'approved'], 'resolved', false],
  ['SUR-250139', 'LAB-251216-003', 'PT-252007', 'Νεογέννητο Παπαδάκη', 'Neonate Papadaki', '2025-11-28', 'Νεογνολογική / ΜΕΝΝ', 3, 18, '2025-12-16', 'Klebsiella pneumoniae', 'ESBL', 'centralLine', ['confirmed', 'bloodstreamInfection'], 'umbilical', ['Meropenem', '20 mg/kg', 'IV', 10, 'approved'], 'resolved', false],
  ['SUR-250142', 'LAB-251229-011', 'PT-252008', 'Δέσποινα Κυριακίδου', 'Despoina Kyriakidou', '1944-12-05', 'Παθολογική', 15, 4, '2025-12-29', 'Escherichia coli', null, 'midstream', ['probable', 'urinaryTractInfection'], null, ['Ceftriaxone', '2 g', 'IV', 5, 'not_required'], 'discharged', false],
  ['SUR-260002', 'LAB-260108-006', 'PT-252009', 'Αντώνιος Λαζαρίδης', 'Antonios Lazaridis', '1960-04-26', 'ΜΕΘ', 5, 11, '2026-01-08', 'Pseudomonas aeruginosa', 'MDR', 'bal', ['confirmed', 'ventilatorAssociatedPneumonia'], 'ett', ['Ceftolozane/tazobactam', '3 g', 'IV', 8, 'approved'], 'transferred', false],
  ['SUR-260004', 'LAB-260122-012', 'PT-252010', 'Ελένη Χριστοδούλου', 'Eleni Christodoulou', '1949-08-13', 'Ορθοπαιδική', 9, 10, '2026-01-22', 'Staphylococcus aureus', null, 'deepTissue', ['confirmed', 'surgicalSiteInfection'], null, ['Cefazolin', '2 g', 'IV', 14, 'not_required'], 'resolved', false],
  ['SUR-260006', 'LAB-260205-008', 'PT-252011', 'Σωκράτης Μηλιώτης', 'Sokratis Miliotis', '1953-02-19', 'Χειρουργική', 6, 7, '2026-02-05', 'Enterococcus faecalis', null, 'urinaryCatheter', ['confirmed', 'urinaryTractInfection'], 'foley', ['Ampicillin', '2 g', 'IV', 7, 'not_required'], 'resolved', false],
  ['SUR-260010', 'LAB-260219-015', 'PT-252012', 'Φωτεινή Γιαννακοπούλου', 'Foteini Giannakopoulou', '1936-10-30', 'Παθολογική', 11, 9, '2026-02-19', 'Clostridioides difficile', null, 'stool', null, null, ['Fidaxomicin', '200 mg', 'PO', 10, 'approved'], 'resolved', false],
  ['SUR-260011', 'LAB-260302-002', 'PT-252013', 'Παύλος Δεληγιάννης', 'Pavlos Deligiannis', '1945-06-11', 'ΜΕΘ', 8, 14, '2026-03-02', 'Klebsiella pneumoniae', 'MDR', 'centralLine', ['confirmed', 'bloodstreamInfection'], 'cvc', ['Ceftazidime/avibactam', '2.5 g', 'IV', 6, 'approved'], 'deceased', true],
  ['SUR-260015', 'LAB-260326-010', 'PT-252014', 'Ολυμπία Σιμιτζή', 'Olympia Simitzi', '1950-03-03', 'Καρδιολογική', 4, 8, '2026-03-26', 'Escherichia coli', 'ESBL', 'urinaryCatheter', ['confirmed', 'urinaryTractInfection'], 'foley', ['Ertapenem', '1 g', 'IV', 7, 'not_required'], 'resolved', false],
  ['SUR-260016', 'LAB-260414-005', 'PT-252015', 'Κυριάκος Αλεξανδρόπουλος', 'Kyriakos Alexandropoulos', '1957-12-22', 'ΜΕΘ', 1, 10, '2026-04-14', 'Acinetobacter baumannii', 'XDR', 'centralLine', ['confirmed', 'bloodstreamInfection'], 'cvc', ['Colistin', '9 MU', 'IV', 12, 'approved'], 'resolved', false],
  ['SUR-260020', 'LAB-260504-013', 'PT-252016', 'Μαρίνα Πετροπούλου', 'Marina Petropoulou', '1968-05-09', 'Χειρουργική', 14, 6, '2026-05-04', 'Pseudomonas aeruginosa', null, 'drainage', ['probable', 'surgicalSiteInfection'], null, ['Piperacillin/tazobactam', '4.5 g', 'IV', 8, 'not_required'], 'resolved', false],
  ['SUR-260021', 'LAB-260527-001', 'PT-252017', 'Νεογέννητο Ζαφειρίου', 'Neonate Zafeiriou', '2026-05-09', 'Νεογνολογική / ΜΕΝΝ', 5, 18, '2026-05-27', 'Staphylococcus aureus', null, 'centralLine', ['confirmed', 'bloodstreamInfection'], 'umbilical', ['Oxacillin', '50 mg/kg', 'IV', 10, 'not_required'], 'resolved', false],
  ['SUR-260025', 'LAB-260616-007', 'PT-252018', 'Θεοφάνης Κουκουλάκης', 'Theofanis Koukoulakis', '1959-09-25', 'Χειρουργική', 3, 7, '2026-06-16', 'Escherichia coli', 'ESBL', 'urinaryCatheter', ['confirmed', 'urinaryTractInfection'], 'foley', ['Ertapenem', '1 g', 'IV', 7, 'not_required'], 'resolved', false],
  ['SUR-260026', 'LAB-260701-004', 'PT-252019', 'Βασιλεία Ντόκου', 'Vasileia Ntokou', '1941-04-02', 'Παθολογική', 6, 1, '2026-07-01', 'Klebsiella pneumoniae', 'ESBL', 'midstream', ['notHai', 'urinaryTractInfection'], null, ['Meropenem', '1 g', 'IV', 7, 'approved'], 'discharged', false],
  ['SUR-260030', 'LAB-260727-009', 'PT-252020', 'Λεωνίδας Φραγκιαδάκης', 'Leonidas Fragkiadakis', '1956-11-15', 'Ορθοπαιδική', 2, 8, '2026-07-27', 'Proteus mirabilis', null, 'woundSwab', ['probable', 'surgicalSiteInfection'], null, ['Ceftriaxone', '2 g', 'IV', 7, 'not_required'], 'resolved', false],
  ['SUR-260034', 'LAB-260819-012', 'PT-252021', 'Χρυσάνθη Μανουσάκη', 'Chrysanthi Manousaki', '1948-07-07', 'Καρδιολογική', 10, 5, '2026-08-19', 'Staphylococcus aureus', 'MRSA', 'peripheral', ['confirmed', 'bloodstreamInfection'], 'pvc', ['Vancomycin', '1 g', 'IV', 14, 'approved'], null, true],
]

const FEMALE = new Set([
  'PT-252002',
  'PT-252004',
  'PT-252007',
  'PT-252008',
  'PT-252010',
  'PT-252012',
  'PT-252014',
  'PT-252016',
  'PT-252019',
  'PT-252021',
])

export const historyCases = CASES.map(
  ([
    id,
    sampleId,
    patientId,
    patient,
    patientEn,
    dateOfBirth,
    department,
    bed,
    admittedBefore,
    startedAt,
    organism,
    resistance,
    site,
    hai,
    device,
    therapy,
    outcome,
    critical,
  ]) => {
    const neonate = department === 'Νεογνολογική / ΜΕΝΝ'
    const days = therapy[3]
    const completedAt = outcome ? addDays(startedAt, days + 1) : null
    return {
      id,
      sampleId,
      patientId,
      patient,
      patientEn,
      sex: FEMALE.has(patientId) ? 'female' : 'male',
      dateOfBirth,
      ...(neonate
        ? { birthWeightGrams: bed % 2 ? 1180 : 1420, gestationalAgeWeeks: bed % 2 ? 29 : 31 }
        : {}),
      department,
      departmentEn: WARD_EN[department],
      room: `${ROOM_PREFIX[department]}-${String(bed).padStart(2, '0')}`,
      admissionDate: addDays(startedAt, -admittedBefore),
      startedAt,
      organism,
      resistance,
      site,
      hai,
      device,
      therapy,
      outcome,
      completedAt,
      critical,
      status: outcome ? 'completed' : 'active',
    }
  },
)

// Contact precautions for multidrug-resistant organisms and C. difficile.
export const needsIsolation = item =>
  ['MDR', 'XDR', 'PDR', 'ESBL', 'MRSA', 'VRE'].includes(item.resistance) ||
  /difficile/.test(item.organism)

export const deviceFor = key => DEVICES[key] || null
export const haiTextFor = (hai, organism) =>
  HAI_TEXT[hai?.[1] || (/difficile/.test(organism) ? 'cdi' : 'bloodstreamInfection')]
