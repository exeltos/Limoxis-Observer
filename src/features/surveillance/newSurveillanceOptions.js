// Choices and library helpers of the new-surveillance flow.
export const screeningQuestions = [
  { id: 'recentSurgery', label: 'qRecentSurgery' },
  { id: 'currentAntibiotics', label: 'qCurrentAntibiotics' },
  { id: 'recentHospitalization', label: 'qRecentHospitalization' },
  { id: 'transferFromFacility', label: 'qTransferFromFacility' },
  { id: 'invasiveDevice', label: 'qInvasiveDevice' },
  { id: 'knownMdro', label: 'qKnownMdro' },
  { id: 'immunosuppression', label: 'qImmunosuppression' },
  { id: 'recentProcedure', label: 'qRecentProcedure' },
]

export const fallbackSymptoms = [
  ['Πυρετός', 'Fever', { code: 'FEVER' }],
  ['Ρίγος', 'Chills', { code: 'CHILLS' }],
  ['Υπόταση', 'Hypotension', { code: 'HYPOTENSION' }],
  ['Βήχας', 'Cough', { code: 'COUGH' }],
  ['Δύσπνοια', 'Dyspnea', { code: 'DYSPNEA' }],
  ['Απόχρεμψη', 'Sputum production', { code: 'SPUTUM' }],
  ['Δυσουρία', 'Dysuria', { code: 'DYSURIA' }],
  ['Συχνουρία', 'Urinary frequency', { code: 'URINARY_FREQUENCY' }],
  ['Κοιλιακό άλγος', 'Abdominal pain', { code: 'ABDOMINAL_PAIN' }],
  ['Ερύθημα τραύματος', 'Wound erythema', { code: 'WOUND_ERYTHEMA' }],
  ['Πυώδης έκκριση', 'Purulent drainage', { code: 'PURULENT_DRAINAGE' }],
  ['Διάρροια', 'Diarrhea', { code: 'DIARRHEA' }],
]
export const fallbackRisks = [
  ['Ουροκαθετήρας', 'Urinary catheter', { code: 'URINARY_CATHETER' }],
  ['Κεντρικός φλεβικός καθετήρας', 'Central venous catheter', { code: 'CVC' }],
  ['Μηχανικός αερισμός', 'Mechanical ventilation', { code: 'MECHANICAL_VENTILATION' }],
  ['Πρόσφατη χειρουργική επέμβαση', 'Recent surgery', { code: 'RECENT_SURGERY' }],
  ['Πρόσφατη λήψη αντιβιοτικών', 'Recent antibiotics', { code: 'RECENT_ANTIBIOTICS' }],
  ['Ανοσοκαταστολή', 'Immunosuppression', { code: 'IMMUNOSUPPRESSION' }],
  ['Νοσηλεία σε ΜΕΘ', 'ICU stay', { code: 'ICU_STAY' }],
  ['Παρατεταμένη νοσηλεία', 'Prolonged hospitalization', { code: 'PROLONGED_STAY' }],
  ['Σακχαρώδης διαβήτης', 'Diabetes', { code: 'DIABETES' }],
]

export const sampleSourceNames = {
  peripheral: { el: 'Περιφερική αιμοληψία', en: 'Peripheral draw' },
  centralLine: { el: 'Κεντρική φλεβική γραμμή', en: 'Central line' },
  arterialLine: { el: 'Αρτηριακή γραμμή', en: 'Arterial line' },
  midstream: { el: 'Μέσο ρεύμα ούρων', en: 'Midstream urine' },
  urinaryCatheter: { el: 'Ουροκαθετήρας', en: 'Urinary catheter' },
  nephrostomy: { el: 'Νεφροστομία', en: 'Nephrostomy' },
  suprapubicCatheter: { el: 'Υπερηβικός καθετήρας', en: 'Suprapubic catheter' },
  sputum: { el: 'Πτύελα', en: 'Sputum' },
  trachealAspirate: { el: 'Τραχειακό αναρρόφημα', en: 'Tracheal aspirate' },
  bal: { el: 'BAL', en: 'BAL' },
  woundSwab: { el: 'Επίχρισμα τραύματος', en: 'Wound swab' },
  deepTissue: { el: 'Βαθύς ιστός', en: 'Deep tissue' },
  drainage: { el: 'Παροχέτευση / έκκριμα', en: 'Drainage' },
  other: { el: 'Άλλο', en: 'Other' },
}
export const sampleSourceOptions = {
  bloodCulture: [
    ['peripheral', 'peripheralBlood'],
    ['centralLine', 'centralLine'],
    ['arterialLine', 'arterialLine'],
    ['other', 'other'],
  ],
  urineCulture: [
    ['midstream', 'midstreamUrine'],
    ['urinaryCatheter', 'urinaryCatheter'],
    ['nephrostomy', 'nephrostomy'],
    ['suprapubicCatheter', 'suprapubicCatheter'],
    ['other', 'other'],
  ],
  respiratorySample: [
    ['sputum', 'sputum'],
    ['trachealAspirate', 'trachealAspirate'],
    ['bal', 'bal'],
    ['other', 'other'],
  ],
  woundCulture: [
    ['woundSwab', 'woundSwab'],
    ['deepTissue', 'deepTissue'],
    ['drainage', 'drainage'],
    ['other', 'other'],
  ],
}

export function libraryValue(row) {
  return String(row?.[2]?.code || row?.[2]?.id || row?.[0] || '')
}
export function normalizeLibrary(rows = []) {
  const seen = new Set()
  return rows.filter(row => {
    const key = libraryValue(row)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
