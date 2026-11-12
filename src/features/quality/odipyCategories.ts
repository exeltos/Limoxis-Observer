// The incident categories of the ΟΔΙΠΥ incident report form («Αναφορά Συμβάντος»): six groups, each with its
// items and an «Άλλο». Clinical outcome records (deaths, cardiac arrests, …) are not on the form; they keep a
// group of their own so they do not mix with the reports. A record stores the item's key (e.g. «odipy-fall»).
const item = (key: string, el: string, en: string) => ({ key: `odipy-${key}`, el, en })

export const ODIPY_GROUPS = [
  { key: 'care', el: 'Φροντίδα ασθενούς', en: 'Patient care', items: [
    item('patient-id', 'Λάθος ταυτοποίηση ασθενούς', 'Wrong patient identification'),
    item('sample-id', 'Λάθος ταυτοποίηση δείγματος', 'Wrong sample identification'),
    item('medication', 'Φαρμακευτικό λάθος', 'Medication error'),
    item('ulcer', 'Έλκη που αναπτύσσονται κατά τη νοσηλεία', 'Pressure ulcers acquired in hospital'),
    item('transfusion', 'Λάθη κατά τη διαδικασία της μετάγγισης αίματος', 'Blood transfusion errors'),
    item('hai', 'Ενδονοσοκομειακή λοίμωξη', 'Healthcare-associated infection'),
    item('allergy', 'Αλλεργική αντίδραση', 'Allergic reaction'),
    item('care-other', 'Άλλο (φροντίδα ασθενούς)', 'Other (patient care)'),
  ] },
  { key: 'safety', el: 'Ασφάλεια ασθενούς', en: 'Patient safety', items: [
    item('injury', 'Τραυματισμός που δεν σχετίζεται με πτώση', 'Injury not related to a fall'),
    item('fall', 'Πτώση', 'Fall'),
    item('feeding', 'Σίτιση', 'Feeding'),
    item('surgery', 'Λάθη που σχετίζονται με τη χειρουργική επέμβαση', 'Surgery-related errors'),
    item('absconding', 'Αποχώρηση άνευ άδειας', 'Leaving without permission'),
    item('refused-admission', 'Άρνηση νοσηλείας', 'Refused admission'),
    item('refused-treatment', 'Άρνηση θεραπείας', 'Refused treatment'),
    item('verbal', 'Λεκτική επίθεση', 'Verbal assault'),
    item('aggression', 'Επιθετική συμπεριφορά', 'Aggressive behaviour'),
    item('abuse', 'Κακοποίηση ευάλωτου ασθενούς', 'Abuse of a vulnerable patient'),
    item('safety-other', 'Άλλο (ασφάλεια ασθενούς)', 'Other (patient safety)'),
  ] },
  { key: 'equipment', el: 'Εξοπλισμός / Υλικά', en: 'Equipment / supplies', items: [
    item('mishandling', 'Κακός χειρισμός', 'Mishandling'),
    item('unavailable', 'Μη διαθέσιμο υλικό', 'Supplies not available'),
    item('out-of-order', 'Εκτός λειτουργίας εξοπλισμός', 'Equipment out of order'),
    item('maintenance', 'Ελλιπής συντήρηση', 'Poor maintenance'),
    item('malfunction', 'Αστοχία / δυσλειτουργία', 'Failure / malfunction'),
    item('expired', 'Ληγμένο υλικό', 'Expired supplies'),
    item('it', 'Υπολογιστικά συστήματα', 'Computer systems'),
    item('infrastructure', 'Υποδομή', 'Infrastructure'),
    item('equipment-other', 'Άλλο (εξοπλισμός / υλικά)', 'Other (equipment / supplies)'),
  ] },
  { key: 'security', el: 'Πυρκαγιά / Φύλαξη κτιρίων', en: 'Fire / building security', items: [
    item('fire', 'Καπνός / πυρκαγιά', 'Smoke / fire'),
    item('belongings', 'Απώλεια προσωπικών ειδών', 'Loss of personal belongings'),
    item('unauthorized', 'Μη εξουσιοδοτημένη πρόσβαση', 'Unauthorised access'),
    item('false-alarm', 'Ψευδές σήμα συναγερμού', 'False alarm'),
    item('theft', 'Κλοπή', 'Theft'),
    item('security-other', 'Άλλο (πυρκαγιά / φύλαξη)', 'Other (fire / security)'),
  ] },
  { key: 'staff', el: 'Προσωπικό', en: 'Staff', items: [
    item('body-fluids', 'Έκθεση σε σωματικά υγρά', 'Exposure to body fluids'),
    item('sharps', 'Τρύπημα από αιχμηρό αντικείμενο', 'Sharps injury'),
    item('work-exposure', 'Έκθεση σχετιζόμενη με εργασία', 'Work-related exposure'),
    item('accident', 'Ατύχημα', 'Accident'),
    item('resources', 'Ανεπαρκείς πόροι', 'Insufficient resources'),
    item('ethics', 'Ηθικά ζητήματα', 'Ethical issues'),
    item('staff-other', 'Άλλο (προσωπικό)', 'Other (staff)'),
  ] },
  { key: 'process', el: 'Διαδικασίες', en: 'Procedures', items: [
    item('documentation', 'Ελλιπής τεκμηρίωση', 'Incomplete documentation'),
    item('records-lost', 'Απώλεια αρχείων', 'Lost records'),
    item('file-unavailable', 'Μη διαθέσιμος ατομικός φάκελος ασθενή', 'Patient file not available'),
    item('procedure', 'Μη τήρηση διαδικασίας', 'Procedure not followed'),
    item('illegible', 'Μη αναγνωρίσιμες καταχωρήσεις', 'Illegible entries'),
    item('admin', 'Διοικητικά θέματα', 'Administrative issues'),
    item('process-other', 'Άλλο (διαδικασίες)', 'Other (procedures)'),
  ] },
  { key: 'outcome', el: 'Κλινικά συμβάντα έκβασης', en: 'Clinical outcome events', outsideForm: true, items: [
    item('death', 'Θάνατος', 'Death'),
    item('blue-code', 'Μπλε κωδικός (ανακοπή)', 'Code blue (cardiac arrest)'),
    item('obstetric', 'Μαιευτικό συμβάν', 'Obstetric event'),
    item('readmission', 'Επανεισαγωγή', 'Readmission'),
    item('haemorrhage', 'Αιμορραγία', 'Haemorrhage'),
    item('outcome-other', 'Άλλο (κλινική έκβαση)', 'Other (clinical outcome)'),
  ] },
]

const ITEMS = new Map(ODIPY_GROUPS.flatMap(group => group.items.map(entry => [entry.key, { ...entry, group }])))

// The earlier built-in categories, read as the nearest item of the form (records before the form keep their key).
const LEGACY: Record<string, string> = {
  clinical: 'odipy-care-other', medication: 'odipy-medication', fall: 'odipy-fall', pressureinjury: 'odipy-ulcer',
  infection: 'odipy-hai', identification: 'odipy-patient-id', surgery: 'odipy-surgery', transfusion: 'odipy-transfusion',
  diagnosis: 'odipy-sample-id', equipment: 'odipy-equipment-other', supplier: 'odipy-unavailable', it: 'odipy-it',
  facility: 'odipy-infrastructure', security: 'odipy-security-other', staff: 'odipy-staff-other', process: 'odipy-procedure',
  other: 'odipy-process-other',
}

export const isOdipyCategory = (key: string) => ITEMS.has(String(key || ''))
// The item of the form a category stands for (its own, or the one an earlier category reads as).
export const odipyItem = (key: string) => ITEMS.get(String(key || '')) || ITEMS.get(LEGACY[String(key || '').toLowerCase()]) || null
export const odipyGroupOf = (key: string) => odipyItem(key)?.group || null
export const odipyLabel = (key: string, language = 'el', withGroup = true) => {
  const found = ITEMS.get(String(key || ''))
  if (!found) return ''
  const en = language === 'en'
  const name = en ? found.en : found.el
  return withGroup ? `${en ? found.group.en : found.group.el} · ${name}` : name
}
export const odipyGroupOptions = (language: string) => ODIPY_GROUPS.map(group => ({ value: group.key, label: language === 'en' ? group.en : group.el }))
export const odipyItemOptions = (groupKey: string, language: string) => (ODIPY_GROUPS.find(group => group.key === groupKey)?.items || []).map(entry => ({ value: entry.key, label: language === 'en' ? entry.en : entry.el }))

// «Αφορά σε» of the form.
export const AFFECTS = [
  { value: 'patient', label: ['Ασθενής', 'Patient'] },
  { value: 'employee', label: ['Εργαζόμενος', 'Employee'] },
  { value: 'visitor', label: ['Συνοδός / επισκέπτης', 'Companion / visitor'] },
  { value: 'other', label: ['Άλλο', 'Other'] },
]
