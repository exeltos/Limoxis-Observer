import { HOSPITAL_TEMPLATES } from './registerTemplatesHospital'

// Ready-made registers from the FileMaker review (docs/quality/
// DEPARTMENT_REGISTERS_FILEMAKER.md), with its corrections: weight in grams,
// gestation as weeks+days, length of stay computed, outcome as a list, one
// unit per duration. The value lists marked `provisional` follow what the
// screenshots show and are completed from FileMaker's value lists.

// An option of a list; `match` are the beginnings of the FileMaker values it
// takes on import (ΔΙΑΚΟΜΙΔΗ ΣΤΟ ΠΓΝΛ → transfer to another hospital).
const o = (value, label, labelEn, match) => (match ? { value, label, labelEn, match } : { value, label, labelEn })

const NICU_FIELDS = [
  // Admission
  { key: 'admission_date', section: 'admission', type: 'date', aliases: ['ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ'], label: 'Ημερομηνία εισαγωγής', labelEn: 'Admission date', required: true },
  { key: 'birth_date', section: 'admission', type: 'date', aliases: ['ΗΜΕΡΟΜΗΝΙΑ ΓΕΝΝΗΣΗΣ'], label: 'Ημερομηνία γέννησης', labelEn: 'Date of birth', required: true },
  { key: 'age_on_admission', section: 'admission', type: 'computed', computed: 'ageDays', from: 'birth_date', to: 'admission_date', unit: 'ημέρες', unitEn: 'days', label: 'Ηλικία κατά την εισαγωγή', labelEn: 'Age on admission', help: 'Διακρίνει τα νεογνά του μαιευτηρίου από όσα έρχονται αργότερα.', helpEn: 'Separates neonates born here from later admissions.' },
  { key: 'readmission', section: 'admission', type: 'yesNo', aliases: ['ΕΠΑΝΕΙΣΑΓΩΓΗ'], label: 'Επανεισαγωγή', labelEn: 'Readmission' },
  { key: 'admission_reason', section: 'admission', type: 'choice', provisional: true, label: 'Αιτία εισαγωγής', labelEn: 'Reason for admission', aliases: ['ΑΙΤΙΑ ΕΙΣΑΓΩΓΗΣ'], help: 'Με πολλές αιτίες στο FileMaker κρατιέται η πρώτη.', helpEn: 'With several reasons in FileMaker, the first one is kept.', options: [o('observation', 'Παρακολούθηση - διερεύνηση', 'Observation - investigation', ['ΠΑΡΑΚΟΛΟΥΘΗΣΗ']), o('prematurity', 'Προωρότητα', 'Prematurity', ['ΠΡΟΩΡΟΤΗΤΑ', 'ΠΡΟΩΡ']), o('respiratory', 'Αναπνευστική δυσχέρεια', 'Respiratory distress', ['ΑΝΑΠΝΕΥΣΤΙΚΗ', 'ΓΟΓΓΥΣΜ', 'ΗΠΙΟΥ ΓΟΓΓΥΣΜ', 'ΚΥΑΝΩ']), o('jaundice', 'Ίκτερος', 'Jaundice', ['ΥΠΕΡΧΟΛΕΡΥΘΡ', 'ΙΚΤΕΡ', 'ΝΕΟΓΝΙΚΟΣ ΙΚΤΕΡ']), o('infection', 'Λοίμωξη / σήψη', 'Infection / sepsis', ['ΛΟΙΜΩΞ', 'ΠΙΘΑΝΗ ΠΕΡΙΓΕΝΝΗΤΙΚΗ', 'ΠΕΡΙΓΕΝΝΗΤΙΚΗ ΛΟΙΜ', 'ΠΡΩΙΜΗ ΝΕΟΓΝΙΚΗ', 'ΠΙΘΑΝΗ ΠΡΩΙΜΗ', 'ΠΡΩΙΜΗΣ ΝΕΟΓΝΙΚΗΣ', 'ΣΗΨΗ']), o('low_weight', 'Χαμηλό βάρος γέννησης / IUGR', 'Low birth weight / IUGR', ['ΧΑΜΗΛΟ Β', 'ΧΑΜΗΛΟ ΒΑΡΟΣ', 'ΧΒΓ', 'IUGR']), o('congenital', 'Συγγενής ανωμαλία', 'Congenital anomaly', ['ΣΥΓΓΕΝ', 'ΑΤΡΗΣΙΑ', 'ΣΤΕΝΩΣΗ', 'ΤΡΙΣΩΜΙΑ']), o('boarding', 'Φιλοξενία', 'Boarding', ['ΦΙΛΟΞΕΝΙΑ']), o('other', 'Άλλο', 'Other', ['ΑΛΛΟ'])] },
  { key: 'admission_origin', section: 'admission', type: 'choice', provisional: true, label: 'Προέλευση εισαγωγής', labelEn: 'Admitted from', aliases: ['ΠΡΟΕΛΕΥΣΗ ΕΙΣΑΓΩΓΗΣ'], options: [o('delivery_room', 'Αίθουσα Τοκετών', 'Delivery room', ['Α.Τ', 'ΑΤ', 'ΑΙΘΟΥΣΑ ΤΟΚΕΤ']), o('maternity', 'Μαιευτική κλινική', 'Maternity ward', ['ΜΑΙΕΥΤΙΚ']), o('other_hospital', 'Άλλο νοσοκομείο', 'Other hospital', ['ΑΛΛΟ ΙΔΡΥΜΑ', 'ΑΛΛΟ ΝΟΣΟΚ']), o('home', 'Από το σπίτι', 'From home', ['ΣΠΙΤΙ', 'ΟΙΚΙΑ'])] },
  // Pregnancy and birth
  { key: 'gestation', list: true, section: 'birth', type: 'gestation', aliases: ['ΔΙΑΡΚΕΙΑ ΚΥΗΣΗΣ'], label: 'Διάρκεια κύησης', labelEn: 'Gestational age', min: 154, max: 308, help: 'Εβδομάδες + ημέρες, π.χ. 37+4.', helpEn: 'Weeks + days, e.g. 37+4.' },
  { key: 'pregnancy_type', section: 'birth', type: 'choice', provisional: true, label: 'Τύπος κύησης', labelEn: 'Pregnancy', aliases: ['ΤΥΠΟΣ ΚΥΗΣΗΣ'], options: [o('single', 'Μονήρης', 'Singleton', ['ΜΟΝΗΡ']), o('twin', 'Δίδυμη', 'Twin', ['ΔΙΔΥΜ']), o('multiple', 'Πολύδυμη', 'Higher order', ['ΠΟΛΥΔΥΜ', 'ΠΟΛΥΔΙΜ'])] },
  { key: 'delivery', list: true, section: 'birth', type: 'choice', required: true, label: 'Είδος τοκετού', labelEn: 'Mode of delivery', aliases: ['ΕΙΔΟΣ ΤΟΚΕΤΟΥ'], help: 'Σικυουλκία, εμβρυουλκία και τοκετός εκτός νοσοκομείου μετρούν ως φυσιολογικός.', helpEn: 'Vacuum, forceps and births before arrival count as vaginal.', options: [o('vaginal', 'Φυσιολογικός τοκετός (Φ/Τ)', 'Vaginal delivery', ['Φ/Τ', 'ΦΤ', 'Φ.Τ', 'ΔΙΑ ΣΙΚΥΟΥΛΚ', 'ΔΙΑ ΕΜΒΡΥΟΥΛΚ', 'ΤΟΚΕΤΟΣ ΕΝ ΤΗ ΠΟΛΕΙ']), o('cs', 'Καισαρική τομή (Κ/Τ)', 'Caesarean section', ['Κ/Τ', 'ΚΤ', 'Κ.Τ', 'ΚΑΙΣΑΡ'])] },
  { key: 'ivf', section: 'birth', type: 'yesNo', aliases: ['IVF'], label: 'Εξωσωματική (IVF)', labelEn: 'IVF' },
  { key: 'prom_24h', section: 'birth', type: 'yesNo', aliases: ['ΡΗΞΗ ΘΥΛΑΚΙΟΥ >24h', 'ΡΗΞΗ ΘΥΛΑΚΙΟΥ'], label: 'Ρήξη θυλακίου > 24 ώρες', labelEn: 'Rupture of membranes > 24 h' },
  { key: 'birth_weight', list: true, section: 'birth', type: 'number', aliases: ['ΒΑΡΟΣ ΕΙΣΟΔΟΥ', 'ΒΑΡΟΣ ΓΕΝΝΗΣΗΣ'], unit: 'g', unitEn: 'g', min: 300, max: 6000, usualMin: 500, usualMax: 5000, label: 'Βάρος εισόδου', labelEn: 'Admission weight', required: true },
  { key: 'apgar_1', section: 'birth', type: 'number', aliases: ['APGAR ΣΤΟ 1ΜΙΝ'], min: 0, max: 10, label: 'APGAR 1′', labelEn: 'APGAR 1 min' },
  { key: 'apgar_5', section: 'birth', type: 'number', aliases: ['APGAR ΣΤΑ 5ΜΙΝ'], min: 0, max: 10, label: 'APGAR 5′', labelEn: 'APGAR 5 min' },
  { key: 'resuscitation', section: 'birth', type: 'choice', provisional: true, label: 'Ανάνηψη', labelEn: 'Resuscitation', aliases: ['ΑΝΑΝΗΨΗ'], options: [o('none', 'Καμία', 'None', ['ΟΧΙ', 'ΚΑΜΙΑ']), o('oxygen', 'Οξυγόνο', 'Oxygen', ['ΟΞΥΓΟΝ']), o('bag_mask', 'Μάσκα - ασκός', 'Bag and mask', ['ΜΑΣΚΑ', 'ΑΣΚΟΣ', 'NEOPUFF']), o('intubation', 'Διασωλήνωση', 'Intubation', ['ΔΙΑΣΩΛΗΝ', 'ΑΜΕΣΗ ΔΙΑΣΩΛΗΝ']), o('cpr', 'ΚΑΡΠΑ', 'CPR', ['ΚΑΡΠΑ']), o('unspecified', 'Ναι, χωρίς είδος', 'Yes, type not recorded', ['ΝΑΙ'])] },
  { key: 'congenital_anomalies', section: 'birth', type: 'yesNo', aliases: ['ΣΥΓΓΕΝΕΙΣ ΑΝΩΜΑΛΙΕΣ'], label: 'Συγγενείς ανωμαλίες', labelEn: 'Congenital anomalies' },
  // Stay
  { key: 'ventilator_days', section: 'stay', type: 'number', aliases: ['ΗΜΕΡΕΣ ΠΑΡΑΜΟΝΗΣ ΣΤΟΝ ΑΝΑΠΝΕΥΣΤΗΡΑ'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες στον αναπνευστήρα', labelEn: 'Ventilator days' },
  { key: 'hfov', section: 'stay', type: 'yesNo', label: 'HFOV', labelEn: 'HFOV', showWhen: { field: 'ventilator_days' } },
  { key: 'cpap_days', section: 'stay', type: 'number', aliases: ['ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες σε CPAP', labelEn: 'CPAP days' },
  { key: 'oxygen_days', section: 'stay', type: 'number', aliases: ['ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ', 'ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗΣ ΟΞΥΓΟΝΟΥ'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες χορήγησης οξυγόνου', labelEn: 'Oxygen days' },
  { key: 'oxygen_after_36w', section: 'stay', type: 'yesNo', aliases: ['ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ ΜΕΤΑ ΤΙΣ 36W', 'ΧΟΡΗΓΗΣΗΣ Ο2 ΜΕΤΑ ΤΙΣ 36W'], help: 'Από το FileMaker: ημέρες πάνω από 0 σημαίνουν Ναι.', helpEn: 'From FileMaker: days above 0 mean Yes.', label: 'Οξυγόνο μετά τις 36 εβδ.', labelEn: 'Oxygen after 36 weeks' },
  { key: 'umbilical_catheter', section: 'stay', type: 'choice', provisional: true, label: 'Ομφαλικός καθετήρας', labelEn: 'Umbilical catheter', aliases: ['ΤΟΠΟΘΕΤΗΣΗ ΟΜΦΑΛΙΚΟΥ ΚΑΘΕΤΗΡΑ'], options: [o('none', 'Όχι', 'None', ['ΟΧΙ']), o('venous', 'Φλεβικός', 'Venous', ['ΦΛΕΒΙΚ']), o('arterial', 'Αρτηριακός', 'Arterial', ['ΑΡΤΗΡΙΑΚ']), o('both', 'Φλεβικός και αρτηριακός', 'Venous and arterial', ['ΚΑΙ ΤΑ ΔΥΟ', 'ΦΛΕΒΙΚΟΣ ΚΑΙ']), o('unspecified', 'Ναι, χωρίς είδος', 'Yes, type not recorded', ['ΝΑΙ'])] },
  { key: 'central_line_days', section: 'stay', type: 'number', aliases: ['ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες φλεβικού καθετήρα', labelEn: 'Central line days' },
  { key: 'arterial_line_days', section: 'stay', type: 'number', aliases: ['ΔΙΑΡΚΕΙΑ ΑΡΤΗΡΙΑΚΟΥ ΚΑΘΕΤΗΡΑ'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες αρτηριακού καθετήρα', labelEn: 'Arterial line days' },
  { key: 'tpn_days', section: 'stay', type: 'number', aliases: ['ΔΙΑΡΚΕΙΑ TPN'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες TPN', labelEn: 'TPN days' },
  { key: 'picc_days', section: 'stay', type: 'number', aliases: ['ΦΕΡΕΙ PICC _ LINE', 'ΦΕΡΕΙ PICC LINE', 'PICC LINE', 'PICC'], unit: 'ημέρες', unitEn: 'days', min: 0, max: 365, label: 'Ημέρες PICC line', labelEn: 'PICC line days' },
  { key: 'nasogastric', section: 'stay', type: 'yesNo', aliases: ['ΣΙΤΙΣΗ ΜΕ ΡΙΝΟΓΑΣΤΡΙΚΟ'], label: 'Σίτιση με ρινογαστρικό', labelEn: 'Nasogastric feeding' },
  { key: 'bottle_feeding', section: 'stay', type: 'yesNo', aliases: ['ΑΠΟΚΛΕΙΣΤΙΚΗ ΣΙΤΙΣΗ ΜΕ BIBERON', 'ΣΙΤΙΣΗ ΜΕ BIBERON'], label: 'Αποκλειστική σίτιση με μπιμπερό', labelEn: 'Exclusive bottle feeding', help: 'Από το FileMaker: μια ημερομηνία σημαίνει Ναι.', helpEn: 'From FileMaker: a date means Yes.' },
  { key: 'breast_milk', section: 'stay', type: 'choice', provisional: true, label: 'Διατήρηση μητρικού γάλακτος', labelEn: 'Breast milk', aliases: ['ΔΙΑΤΗΡΗΣΗ ΜΗΤΡΙΚΟΥ ΓΑΛΑΚΤΟΣ'], options: [o('exclusive', 'Αποκλειστικά μητρικό', 'Exclusive', ['ΑΠΟΚΛΕΙΣΤ']), o('mixed', 'Μικτή σίτιση', 'Mixed', ['ΜΙΚΤ', 'ΜΕΙΚΤ']), o('none', 'Όχι', 'None', ['ΟΧΙ']), o('unspecified', 'Ναι, χωρίς είδος', 'Yes, type not recorded', ['ΝΑΙ'])] },
  { key: 'early_infection', section: 'stay', type: 'yesNo', aliases: ['ΕΠΙΒΕΒΑΙΩΜ. ΠΕΡΙΓ. ΛΟΙΜΩΞΗ', 'ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΠΕΡΙΓΕΝΝΗΤΙΚΗ ΛΟΙΜΩΞΗ'], label: 'Επιβεβαιωμένη πρώιμη λοίμωξη', labelEn: 'Confirmed early-onset infection', help: 'Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.', helpEn: 'To be linked with the Surveillance episode.' },
  { key: 'late_infection', section: 'stay', type: 'yesNo', aliases: ['ΕΠΙΒΕΒΑΙΩΜ. ΕΝΔΟΝΟΣ. ΛΟΙΜΩΞΗ', 'ΕΠΙΒΕΒΑΙΩΜΕΝΗ ΕΝΔΟΝΟΣΟΚΟΜΕΙΑΚΗ ΛΟΙΜΩΞΗ'], label: 'Επιβεβαιωμένη όψιμη λοίμωξη', labelEn: 'Confirmed late-onset infection', help: 'Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.', helpEn: 'To be linked with the Surveillance episode.' },
  // Discharge
  { key: 'discharge_date', list: true, section: 'discharge', type: 'date', aliases: ['ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ ΜΕΝΝ'], notBefore: 'admission_date', label: 'Ημερομηνία εξόδου', labelEn: 'Discharge date' },
  { key: 'length_of_stay', section: 'discharge', type: 'computed', computed: 'days', from: 'admission_date', to: 'discharge_date', unit: 'ημέρες', unitEn: 'days', label: 'Διάρκεια νοσηλείας', labelEn: 'Length of stay', help: 'Υπολογίζεται από την εισαγωγή και την έξοδο.', helpEn: 'From admission and discharge.' },
  { key: 'discharge_weight', section: 'discharge', type: 'number', aliases: ['ΒΑΡΟΣ ΕΞΟΔΟΥ'], unit: 'g', unitEn: 'g', min: 300, max: 8000, label: 'Βάρος εξόδου', labelEn: 'Discharge weight', showWhen: { field: 'discharge_date' } },
  { key: 'outcome', list: true, section: 'discharge', type: 'choice', label: 'Έκβαση', labelEn: 'Outcome', aliases: ['ΕΚΒΑΣΗ'], showWhen: { field: 'discharge_date' }, options: [o('home', 'Εξιτήριο', 'Discharged home', ['ΕΞΟΔΟΣ', 'ΕΞΔΟΟΣ', 'ΕΞΙΤΗΡΙΟ', 'ΑΡΝΗΣΗ ΝΟΣΗΛΕΙΑΣ']), o('transfer_hospital', 'Διακομιδή σε άλλο νοσοκομείο', 'Transfer to another hospital', ['ΔΙΑΚΟΜΙΔΗ']), o('transfer_ward', 'Μεταφορά σε άλλη κλινική', 'Transfer to another ward', ['ΜΕΤΑΦΟΡΑ']), o('death', 'Θάνατος', 'Death', ['ΘΑΝΑΤΟΣ'])] },
]

const NICU_SECTIONS = [
  { key: 'admission', label: 'Εισαγωγή', labelEn: 'Admission' },
  { key: 'birth', label: 'Κύηση και τοκετός', labelEn: 'Pregnancy and birth' },
  { key: 'stay', label: 'Νοσηλεία', labelEn: 'Stay' },
  { key: 'discharge', label: 'Έξοδος', labelEn: 'Discharge' },
]

const discharged = [{ field: 'discharge_date', op: 'filled' }]

const NICU_INDICATORS = [
  { id: 'admissions', title: 'Εισαγωγές νεογνών', titleEn: 'Neonatal admissions', aggregation: 'count', filters: [], direction: 'context' },
  { id: 'cs_rate', title: '% με καισαρική τομή', titleEn: '% caesarean section', aggregation: 'percent', filters: [{ field: 'delivery', op: 'eq', value: 'cs' }], denominatorFilters: [{ field: 'delivery', op: 'filled' }], unit: '%', direction: 'context' },
  { id: 'vaginal_rate', title: '% με φυσιολογικό τοκετό', titleEn: '% vaginal delivery', aggregation: 'percent', filters: [{ field: 'delivery', op: 'eq', value: 'vaginal' }], denominatorFilters: [{ field: 'delivery', op: 'filled' }], unit: '%', direction: 'context' },
  { id: 'mean_los', title: 'Μέση διάρκεια νοσηλείας', titleEn: 'Mean length of stay', aggregation: 'mean', field: 'length_of_stay', filters: discharged, dateField: 'discharge_date', unit: 'ημέρες', unitEn: 'days', direction: 'lower', note: 'Μόνο όσα νεογνά βγήκαν, στον μήνα εξόδου.', noteEn: 'Discharged neonates only, in the month of discharge.' },
  { id: 'median_los', title: 'Διάμεση διάρκεια νοσηλείας', titleEn: 'Median length of stay', aggregation: 'median', field: 'length_of_stay', filters: discharged, dateField: 'discharge_date', unit: 'ημέρες', unitEn: 'days', direction: 'context' },
  { id: 'mean_ventilator', title: 'Μέσες ημέρες στον αναπνευστήρα', titleEn: 'Mean ventilator days', aggregation: 'mean', field: 'ventilator_days', filters: [{ field: 'ventilator_days', op: 'gt', value: 0 }], dateField: 'discharge_date', unit: 'ημέρες', unitEn: 'days', direction: 'lower', note: 'Μόνο όσα νεογνά χρειάστηκαν αναπνευστήρα.', noteEn: 'Neonates who were ventilated only.' },
  { id: 'mean_cpap', title: 'Μέσες ημέρες σε CPAP', titleEn: 'Mean CPAP days', aggregation: 'mean', field: 'cpap_days', filters: [{ field: 'cpap_days', op: 'gt', value: 0 }], dateField: 'discharge_date', unit: 'ημέρες', unitEn: 'days', direction: 'lower' },
  { id: 'mortality', title: 'Θνησιμότητα', titleEn: 'Mortality', aggregation: 'percent', filters: [{ field: 'outcome', op: 'eq', value: 'death' }], denominatorFilters: [{ field: 'outcome', op: 'filled' }], dateField: 'discharge_date', unit: '%', direction: 'lower' },
  { id: 'readmissions', title: '% επανεισαγωγών', titleEn: '% readmissions', aggregation: 'percent', filters: [{ field: 'readmission', op: 'yes' }], denominatorFilters: [], unit: '%', direction: 'lower' },
  { id: 'apgar_1', title: 'Μέσο APGAR 1′', titleEn: 'Mean APGAR 1 min', aggregation: 'mean', field: 'apgar_1', filters: [], direction: 'context' },
  { id: 'apgar_5', title: 'Μέσο APGAR 5′', titleEn: 'Mean APGAR 5 min', aggregation: 'mean', field: 'apgar_5', filters: [], direction: 'context' },
  { id: 'late_infection_rate', title: 'Όψιμες λοιμώξεις ανά 1.000 ημέρες καθετήρα', titleEn: 'Late-onset infections per 1,000 line days', aggregation: 'rate', filters: [{ field: 'late_infection', op: 'yes' }], denominatorFilters: [], denominatorField: 'central_line_days', multiplier: 1000, dateField: 'discharge_date', unit: '/1.000 ημέρες καθετήρα', unitEn: '/1,000 line days', direction: 'lower' },
  { id: 'breast_milk', title: '% με αποκλειστικά μητρικό γάλα', titleEn: '% exclusive breast milk', aggregation: 'percent', filters: [{ field: 'breast_milk', op: 'eq', value: 'exclusive' }], denominatorFilters: [{ field: 'breast_milk', op: 'filled' }], dateField: 'discharge_date', unit: '%', direction: 'higher' },
  { id: 'no_breast_milk', title: '% χωρίς μητρικό γάλα', titleEn: '% without breast milk', aggregation: 'percent', filters: [{ field: 'breast_milk', op: 'eq', value: 'none' }], denominatorFilters: [{ field: 'breast_milk', op: 'filled' }], dateField: 'discharge_date', unit: '%', direction: 'lower' },
]

const row = (key, label, labelEn, help = '', helpEn = '', aliases) => ({ key, label, labelEn, ...(help ? { help, helpEn } : {}), ...(aliases ? { aliases } : {}) })

export const REGISTER_TEMPLATES = [
  {
    key: 'nicu',
    kind: 'case',
    name: 'Μητρώο νεογνών ΜΕΝΝ',
    nameEn: 'NICU neonatal register',
    description: 'Μία καρτέλα ανά νεογνό: εισαγωγή, τοκετός, νοσηλεία, έξοδος. Δείκτες: καισαρικές, διάρκεια νοσηλείας, αναπνευστήρας, θνησιμότητα, λοιμώξεις.',
    descriptionEn: 'One card per neonate: admission, birth, stay, discharge. Indicators: caesareans, length of stay, ventilation, mortality, infections.',
    identity: { caseNumber: true, patientName: true, caseNumberAliases: ['ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ'], patientNameAliases: ['ΟΝΟΜΑΤΕΠΩΝΥΜΟ ΝΕΟΓΝΟΥ'] },
    entryDateField: 'admission_date',
    // FileMaker cases without an admission date are counted on their birth or discharge date.
    entryDateFallbacks: ['birth_date', 'discharge_date'],
    // A FileMaker column no field reads (it stays out of the import).
    retiredAliases: ['ΤΥΠΟΣ ΜΗΧΑΝΙΚΟΥ ΑΕΡΙΣΜΟΥ'],
    sections: NICU_SECTIONS,
    fields: NICU_FIELDS,
    breakdowns: ['admission_reason', 'admission_origin', 'outcome'],
    indicators: NICU_INDICATORS,
  },
  {
    key: 'ophthalmology',
    kind: 'sheet',
    name: 'Πράξεις Οφθαλμολογικού',
    nameEn: 'Ophthalmology procedures',
    description: 'Ένα φύλλο ανά μήνα με το πλήθος κάθε πράξης. Δείκτες: σύνολο πράξεων και μερίδιο κάθε πράξης.',
    descriptionEn: 'One sheet per month with the number of each procedure. Indicators: total procedures and the share of each.',
    sheet: {
      period: 'month',
      rows: [
        row('cataract', 'Καταρράκτες', 'Cataracts', '', '', ['Καταράκτες']),
        row('vitrectomy', 'Βιτρεκτομές', 'Vitrectomies'),
        row('intravitreal', 'Ενδοϋαλοειδικές εγχύσεις', 'Intravitreal injections', '', '', ['Ενδοϋαλικές εγχύσεις']),
        row('other_local', 'Λοιπές πράξεις με τοπική αναισθησία', 'Other procedures under local anaesthesia', 'Το «Διάφορα με τοπική» του FileMaker.', 'FileMaker «Διάφορα με τοπική».', ['Διάφορα με τοπική']),
      ],
      measures: [{ key: 'count', label: 'Αριθμός', labelEn: 'Number' }],
    },
    indicators: [
      { id: 'total', title: 'Σύνολο πράξεων', titleEn: 'Total procedures', aggregation: 'sum', rows: [], direction: 'context' },
      { id: 'cataract_share', title: '% καταρρακτών', titleEn: '% cataracts', aggregation: 'percent', rows: ['cataract'], unit: '%', direction: 'context' },
      { id: 'vitrectomy_share', title: '% βιτρεκτομών', titleEn: '% vitrectomies', aggregation: 'percent', rows: ['vitrectomy'], unit: '%', direction: 'context' },
      { id: 'intravitreal_share', title: '% ενδοϋαλοειδικών εγχύσεων', titleEn: '% intravitreal injections', aggregation: 'percent', rows: ['intravitreal'], unit: '%', direction: 'context' },
      { id: 'monthly_mean', title: 'Μέσος όρος πράξεων ανά μήνα', titleEn: 'Mean procedures per month', aggregation: 'mean', rows: [], direction: 'context' },
    ],
  },
  {
    key: 'endoscopy',
    kind: 'sheet',
    name: 'Πράξεις Ενδοσκοπικού',
    nameEn: 'Endoscopy procedures',
    description: 'Ένα φύλλο ανά μήνα με το πλήθος κάθε πράξης. Δείκτες: σύνολο, μερίδιο γαστροσκοπήσεων και κολονοσκοπήσεων.',
    descriptionEn: 'One sheet per month with the number of each procedure. Indicators: total, share of gastroscopies and colonoscopies.',
    sheet: {
      period: 'month',
      rows: [
        row('gastroscopy', 'Γαστροσκοπήσεις', 'Gastroscopies'),
        row('colonoscopy', 'Κολονοσκοπήσεις', 'Colonoscopies'),
        row('gastrostomy', 'Γαστροστομίες', 'Gastrostomies'),
        row('cystoscopy', 'Κυστεοσκοπήσεις', 'Cystoscopies'),
        row('bronchoscopy', 'Βρογχοσκοπήσεις', 'Bronchoscopies'),
        row('ercp', 'ERCP', 'ERCP'),
        row('eus', 'EUS', 'EUS'),
        row('ebus', 'EBUS', 'EBUS'),
      ],
      measures: [{ key: 'count', label: 'Αριθμός', labelEn: 'Number' }],
    },
    indicators: [
      { id: 'total', title: 'Σύνολο πράξεων', titleEn: 'Total procedures', aggregation: 'sum', rows: [], direction: 'context' },
      { id: 'gastroscopy_share', title: '% γαστροσκοπήσεων', titleEn: '% gastroscopies', aggregation: 'percent', rows: ['gastroscopy'], unit: '%', direction: 'context' },
      { id: 'colonoscopy_share', title: '% κολονοσκοπήσεων', titleEn: '% colonoscopies', aggregation: 'percent', rows: ['colonoscopy'], unit: '%', direction: 'context' },
    ],
  },
  ...HOSPITAL_TEMPLATES,
  {
    key: 'blankCase',
    kind: 'case',
    name: 'Νέο μητρώο ανά περιστατικό',
    nameEn: 'New register per case',
    description: 'Κενό μητρώο: προσθέτετε τα πεδία και τους δείκτες που χρειάζεται το τμήμα.',
    descriptionEn: 'An empty register: add the fields and indicators the department needs.',
    identity: { caseNumber: true, patientName: true },
    entryDateField: 'entry_date',
    sections: [{ key: 'main', label: 'Στοιχεία', labelEn: 'Details' }],
    fields: [{ key: 'entry_date', section: 'main', type: 'date', label: 'Ημερομηνία', labelEn: 'Date', required: true }],
    indicators: [{ id: 'count', title: 'Πλήθος περιστατικών', titleEn: 'Number of cases', aggregation: 'count', filters: [], direction: 'context' }],
  },
  {
    key: 'blankSheet',
    kind: 'sheet',
    name: 'Νέο μηνιαίο φύλλο',
    nameEn: 'New monthly sheet',
    description: 'Κενό φύλλο: προσθέτετε γραμμές (πράξεις, κατηγορίες) και στήλες (μέτρα).',
    descriptionEn: 'An empty sheet: add rows (procedures, categories) and columns (measures).',
    sheet: { period: 'month', rows: [], measures: [{ key: 'count', label: 'Αριθμός', labelEn: 'Number' }] },
    indicators: [{ id: 'total', title: 'Σύνολο', titleEn: 'Total', aggregation: 'sum', rows: [], direction: 'context' }],
  },
]

export const templateByKey = key => REGISTER_TEMPLATES.find(template => template.key === key)

// A new register from a template: a deep copy so editing it never touches the template.
export function registerFromTemplate(key, { department = '', departmentId = '', departmentEn = '' } = {}) {
  const template = templateByKey(key) || templateByKey('blankCase')
  const copy = structuredClone(template)
  return {
    code: '',
    name: copy.name,
    nameEn: copy.nameEn,
    kind: copy.kind,
    status: 'active',
    version: 1,
    templateKey: copy.key,
    departmentId,
    department,
    departmentEn: departmentEn || department,
    fields: copy.fields || [],
    sheet: copy.kind === 'sheet' ? copy.sheet : {},
    indicators: copy.indicators || [],
    settings: { sections: copy.sections || [], identity: copy.identity || null, entryDateField: copy.entryDateField || '', breakdowns: copy.breakdowns || [], description: copy.description, descriptionEn: copy.descriptionEn },
  }
}
