// The Demo hospital's outbreak investigations, as the Analysis "LIRA & AI" tab
// counts them (production reads lira_outbreak_investigations). Written in the
// Demo's authored frame and shifted to today like the other Demo fixtures.
import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { addDays } from '../../core/data/demoSeed'
import type { OutbreakLineRow } from './liraOutbreakInvestigation'

// Όσα διαβάζονται από μια demo διερεύνηση για τις αξιολογήσεις περιστατικών.
type DemoInvestigationRef = { id?: string, created_at?: string | null, closed_at?: string | null, demoEvents?: unknown, status?: string | null, department?: string | null }

const rows: [string, string, string, string, string | null][] = [
  ['LIRA-INV-01', 'Klebsiella pneumoniae (KPC)', 'active', '2026-08-18T09:20:00Z', null],
  ['LIRA-INV-02', 'Acinetobacter baumannii', 'closed', '2026-06-30T10:05:00Z', '2026-07-21T15:40:00Z'],
  ['LIRA-INV-03', 'Clostridioides difficile', 'closed', '2026-05-12T08:45:00Z', '2026-05-29T12:10:00Z'],
  ['LIRA-INV-04', 'Pseudomonas aeruginosa', 'closed', '2026-03-03T11:30:00Z', '2026-03-24T09:00:00Z'],
  ['LIRA-INV-05', 'MRSA', 'closed', '2026-01-19T13:15:00Z', '2026-02-06T10:30:00Z'],
  ['LIRA-INV-06', 'Norovirus', 'closed', '2025-12-08T07:50:00Z', '2025-12-19T16:20:00Z'],
  ['LIRA-INV-07', 'Enterococcus faecium (VRE)', 'closed', '2025-10-27T09:40:00Z', '2025-11-20T14:00:00Z'],
  ['LIRA-INV-08', 'Klebsiella pneumoniae (KPC)', 'draft', '2026-08-26T16:10:00Z', null],
  // The earlier months (the Demo shows the whole of 2025).
  ['LIRA-INV-09', 'Acinetobacter baumannii (XDR)', 'closed', '2025-08-04T08:30:00Z', '2025-08-27T13:00:00Z'],
  ['LIRA-INV-10', 'MRSA', 'closed', '2025-06-16T10:10:00Z', '2025-07-08T12:40:00Z'],
  ['LIRA-INV-11', 'Escherichia coli (ESBL)', 'closed', '2025-05-12T09:00:00Z', '2025-06-02T11:30:00Z'],
  ['LIRA-INV-12', 'Pseudomonas aeruginosa', 'closed', '2025-04-07T08:50:00Z', '2025-04-25T14:15:00Z'],
  ['LIRA-INV-13', 'Klebsiella pneumoniae (KPC)', 'closed', '2025-03-03T09:15:00Z', '2025-03-31T15:00:00Z'],
  ['LIRA-INV-14', 'Clostridioides difficile', 'closed', '2025-01-27T08:40:00Z', '2025-02-14T12:20:00Z'],
  ['LIRA-INV-15', 'Klebsiella pneumoniae (ESBL)', 'closed', '2024-11-18T09:30:00Z', '2024-12-09T13:45:00Z'],
]

// For the investigation screen: the species the line list searches for, the ward, and
// the actions taken (Greek, English). Closed investigations closed their actions.
const DETAILS: Record<string, [string, string, string, string]> = {
  'LIRA-INV-01': ['Klebsiella pneumoniae', 'ΜΕΘ', 'ICU', 'contact'],
  'LIRA-INV-02': ['Acinetobacter baumannii', 'ΜΕΘ', 'ICU', 'environment'],
  'LIRA-INV-03': ['Clostridioides difficile', 'Παθολογική', 'Internal Medicine', 'cdi'],
  'LIRA-INV-04': ['Pseudomonas aeruginosa', 'ΜΕΘ', 'ICU', 'water'],
  'LIRA-INV-05': ['Staphylococcus aureus', 'Καρδιολογική', 'Cardiology', 'contact'],
  'LIRA-INV-06': ['Norovirus', 'Παθολογική', 'Internal Medicine', 'cdi'],
  'LIRA-INV-07': ['Enterococcus faecium', 'ΜΕΘ', 'ICU', 'contact'],
  'LIRA-INV-08': ['Klebsiella pneumoniae', 'Χειρουργική', 'Surgery', 'contact'],
  'LIRA-INV-09': ['Acinetobacter baumannii', 'ΜΕΘ', 'ICU', 'environment'],
  'LIRA-INV-10': ['Staphylococcus aureus', 'Ορθοπαιδική', 'Orthopedics', 'contact'],
  'LIRA-INV-11': ['Escherichia coli', 'Χειρουργική', 'Surgery', 'contact'],
  'LIRA-INV-12': ['Pseudomonas aeruginosa', 'ΜΕΘ', 'ICU', 'water'],
  'LIRA-INV-13': ['Klebsiella pneumoniae', 'ΜΕΘ', 'ICU', 'contact'],
  'LIRA-INV-14': ['Clostridioides difficile', 'Παθολογική', 'Internal Medicine', 'cdi'],
  'LIRA-INV-15': ['Klebsiella pneumoniae', 'Παθολογική', 'Internal Medicine', 'contact'],
}
// [title, title (English), description, description (English), owner, owner (English), type, priority, days after the start]
// prettier-ignore
const ACTIONS: Record<string, [string, string, string, string, string, string, string, string, number][]> = {
  contact: [
    ['Ενίσχυση προφυλάξεων επαφής και ομαδοποίηση νοσηλευτών', 'Reinforced contact precautions and nurse cohorting', 'Αποκλειστικό προσωπικό για τους αποικισμένους ασθενείς και έλεγχος συμμόρφωσης ανά βάρδια.', 'Dedicated staff for colonised patients and compliance checks every shift.', 'Προϊσταμένη τμήματος', 'Head nurse of the ward', 'corrective', 'high', 3],
    ['Εβδομαδιαίος προληπτικός έλεγχος (screening) ασθενών', 'Weekly patient screening', 'Ορθοπρωκτικά επιχρίσματα κατά την εισαγωγή και κάθε εβδομάδα για όσο διαρκεί η διερεύνηση.', 'Rectal swabs on admission and weekly while the investigation lasts.', 'Νοσηλεύτρια επιτήρησης', 'Infection control nurse', 'preventive', 'medium', 7],
    ['Επανεκπαίδευση στην υγιεινή των χεριών', 'Hand hygiene refresher training', 'Σύντομη εκπαίδευση στο τμήμα και παρατήρηση των 5 στιγμών.', 'Short training on the ward and observation of the 5 moments.', 'Ομάδα ελέγχου λοιμώξεων', 'Infection control team', 'preventive', 'medium', 10],
  ],
  environment: [
    ['Εντατικός καθαρισμός και απολύμανση του τμήματος', 'Terminal cleaning and disinfection of the ward', 'Καθαρισμός με χλώριο και έλεγχος με δείκτες φθορισμού.', 'Chlorine cleaning, checked with fluorescent markers.', 'Υπεύθυνος καθαριότητας', 'Housekeeping supervisor', 'corrective', 'high', 2],
    ['Περιβαλλοντικές καλλιέργειες σε επιφάνειες υψηλής επαφής', 'Environmental cultures of high-touch surfaces', 'Δειγματοληψία σε κλίνες, αντλίες και αναπνευστήρες.', 'Sampling of beds, pumps and ventilators.', 'Ομάδα ελέγχου λοιμώξεων', 'Infection control team', 'corrective', 'high', 5],
    ['Αποκλειστικός εξοπλισμός ανά ασθενή', 'Dedicated equipment for each patient', 'Στηθοσκόπια και περιχειρίδες πίεσης μόνο για τον ασθενή.', 'Stethoscopes and blood pressure cuffs for the patient only.', 'Προϊσταμένη τμήματος', 'Head nurse of the ward', 'preventive', 'medium', 9],
  ],
  water: [
    ['Καλλιέργειες νερού στις βρύσες και τις αποχετεύσεις', 'Water cultures of taps and drains', 'Δειγματοληψία νερού και σιφωνίων στους θαλάμους του τμήματος.', 'Sampling of water and sink traps in the ward rooms.', 'Τεχνική υπηρεσία', 'Technical services', 'corrective', 'high', 3],
    ['Φίλτρα σημείου χρήσης στις βρύσες', 'Point-of-use filters on taps', 'Τοποθέτηση φίλτρων μέχρι τα αρνητικά αποτελέσματα.', 'Filters until the results are negative.', 'Τεχνική υπηρεσία', 'Technical services', 'corrective', 'medium', 6],
  ],
  cdi: [
    ['Απομόνωση σε μονόκλινο με αποκλειστική τουαλέτα', 'Single room with its own toilet', 'Προφυλάξεις επαφής και πλύσιμο χεριών με νερό και σαπούνι.', 'Contact precautions and hand washing with soap and water.', 'Προϊσταμένη τμήματος', 'Head nurse of the ward', 'corrective', 'high', 1],
    ['Καθαρισμός με σποροκτόνο απολυμαντικό', 'Cleaning with a sporicidal disinfectant', 'Καθημερινός καθαρισμός με χλώριο 1.000 ppm.', 'Daily cleaning with 1,000 ppm chlorine.', 'Υπεύθυνος καθαριότητας', 'Housekeeping supervisor', 'corrective', 'high', 2],
    ['Επανεξέταση της αντιμικροβιακής αγωγής στο τμήμα', 'Review of the ward antimicrobial use', 'Περιορισμός κεφαλοσπορινών και κινολονών με την ομάδα επιτήρησης αντιβιοτικών.', 'Restricted cephalosporins and quinolones with the antimicrobial stewardship team.', 'Ομάδα επιτήρησης αντιβιοτικών', 'Antimicrobial stewardship team', 'preventive', 'medium', 8],
  ],
}
const HYPOTHESIS: Record<string, [string, string]> = {
  contact: ['Μετάδοση με τα χέρια του προσωπικού μεταξύ γειτονικών κλινών.', 'Transmission on staff hands between neighbouring beds.'],
  environment: ['Περιβαλλοντική δεξαμενή σε επιφάνειες και εξοπλισμό.', 'An environmental reservoir on surfaces and equipment.'],
  water: ['Μόλυνση των σιφωνίων και του δικτύου νερού.', 'Contamination of sink traps and the water network.'],
  cdi: ['Συρροή μετά από αυξημένη χρήση κεφαλοσπορινών, με μετάδοση από το περιβάλλον.', 'A cluster after increased cephalosporin use, spread through the environment.'],
}
const DECISION = [
  'Η υπόθεση επιβεβαιώθηκε· τα μέτρα εφαρμόστηκαν και δεν υπήρξαν νέα περιστατικά για δύο χρόνους επώασης.',
  'The hypothesis was confirmed; the measures were applied and there were no new cases for two incubation periods.',
]
const iso = (date: string, time: string) => `${date}T${time}:00Z`

export const liraDemoInvestigations = shiftDemoDatesInPlace(
  rows.map(([id, organism, status, created_at, closed_at]) => {
    const [species, department, departmentEn, kind] = DETAILS[id]
    const start = created_at.slice(0, 10), end = closed_at?.slice(0, 10) || null
    const actions = status === 'draft' ? [] : ACTIONS[kind].map(([title, titleEn, description, descriptionEn, owner, ownerEn, type, priority, after], index) => {
      const open = status === 'active'
      return {
        id: `${id}-CAPA-${index + 1}`, code: `CAPA-${id.slice(-2)}${index + 1}`, title, titleEn, description, descriptionEn,
        action_type: type, priority, owner_label: owner, owner_labelEn: ownerEn, due_date: addDays(start, after + 7),
        status: open ? (index === 0 ? 'in_progress' : 'open') : 'closed',
        effectiveness_status: open ? null : 'effective', created_at: iso(addDays(start, Math.max(0, after - 2)), '10:00'), updated_at: iso(end || start, '11:00'),
      }
    })
    const events = [
      { id: `${id}-EV-1`, event_type: 'status', payload: { status: 'draft', action: 'created' }, created_at: created_at },
      ...(status === 'draft' ? [] : [
        { id: `${id}-EV-2`, event_type: 'status', payload: { from: 'draft', to: 'active' }, created_at: iso(start, '12:00') },
        { id: `${id}-EV-3`, event_type: 'hypothesis', payload: { text: HYPOTHESIS[kind][0], textEn: HYPOTHESIS[kind][1] }, created_at: iso(addDays(start, 2), '09:30') },
      ]),
      ...(status === 'closed' ? [
        { id: `${id}-EV-4`, event_type: 'decision', payload: { text: DECISION[0], textEn: DECISION[1] }, created_at: iso(addDays(end!, -1), '10:00') },
        { id: `${id}-EV-5`, event_type: 'status', payload: { from: 'active', to: 'closed' }, created_at: closed_at },
      ] : []),
    ]
    return {
      id, organism, status, created_at, closed_at,
      // The investigation screen: what the line list reads and the record's own history.
      title: `${organism} — ${department}`, titleEn: `${organism} — ${departmentEn}`, species, department, departmentEn,
      scope_from: addDays(start, -21), scope_to: end || null, updated_at: closed_at || created_at,
      demoEvents: events, demoActions: actions,
    }
  }),
)
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(liraDemoInvestigations)

// The human case reviews of a Demo investigation, made from the cases its line list
// finds: the ward's cases confirmed, the others excluded. An active investigation has
// reviewed only its first half, so its closure still waits on the rest.
const reviewDay = (investigation: DemoInvestigationRef, index: number) => {
  const day = addDays(String(investigation.created_at).slice(0, 10), 1 + (index % 4))
  const last = investigation.closed_at && addDays(String(investigation.closed_at).slice(0, 10), -1)
  return last && day > last ? last : day
}
export function demoOutbreakCaseReviews(investigation: DemoInvestigationRef | null | undefined, lineList: { rows?: OutbreakLineRow[] } | null | undefined) {
  if (!investigation?.demoEvents || investigation.status === 'draft') return []
  const rows = lineList?.rows || []
  const reviewed = investigation.status === 'active' ? rows.slice(0, Math.ceil(rows.length / 2)) : rows
  return reviewed.map((row: OutbreakLineRow, index: number) => {
    const ward = row.department === investigation.department
    return {
      id: `${investigation.id}-REV-${index + 1}`,
      record_key: row.recordKey,
      patient_id: row.patientKey,
      classification: ward ? (row.resistanceClass || index % 3 ? 'confirmed' : 'probable') : 'excluded',
      rationale: ward
        ? 'Ίδιο τμήμα και ίδιος μικροοργανισμός μέσα στο παράθυρο της διερεύνησης.'
        : 'Άλλο τμήμα χωρίς κοινή έκθεση· εκτός ορισμού περιστατικού.',
      reviewed_at: `${reviewDay(investigation, index)}T10:00:00Z`,
    }
  })
}
