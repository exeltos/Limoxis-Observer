// The event type of an incident and the details each type records
// (20261116100000_quality_relational.sql): an injury, fall or exposure has its
// fall / injury block (and a sharps block when a sharp object caused it), a blue
// code its interventions and outcome, an obstetric event its subcategory. Each
// block is a 1:1 row of its own table; the record carries it as fall, sharp,
// blueCode and obstetric.

const option = (value, el, en) => ({ value, label: [el, en] })

export const EVENT_TYPES = [
  option('death', 'Θάνατος', 'Death'),
  option('injury_fall_exposure', 'Τραυματισμός / πτώση / έκθεση', 'Injury / fall / exposure'),
  option('obstetric', 'Μαιευτικό συμβάν', 'Obstetric event'),
  option('blue_code', 'Μπλε κωδικός (ανακοπή)', 'Blue code (cardiac arrest)'),
  option('return_to_theatre', 'Επιστροφή στο χειρουργείο', 'Return to theatre'),
  option('readmission', 'Επανεισαγωγή', 'Readmission'),
  option('haemorrhage', 'Αιμορραγία', 'Haemorrhage'),
  option('other', 'Άλλο', 'Other'),
]

export const FALL_TYPES = [option('fall', 'Πτώση', 'Fall'), option('slip', 'Ολίσθηση', 'Slip'), option('faint', 'Λιποθυμία', 'Faint'), option('other', 'Άλλο', 'Other')]
export const FLOOR_CONDITIONS = [option('dry', 'Στεγνό', 'Dry'), option('wet', 'Βρεγμένο / ολισθηρό', 'Wet / slippery')]
export const BED_RAILS = [option('in_use', 'Σε χρήση', 'In use'), option('not_in_use', 'Όχι σε χρήση', 'Not in use'), option('not_applicable', 'Δεν εφαρμόζεται', 'Not applicable')]
export const INJURY_CATEGORIES = [option('injury', 'Τραυματισμός', 'Injury'), option('near_miss', 'Παρ’ ολίγον', 'Near miss'), option('hazard_exposure', 'Έκθεση σε κίνδυνο', 'Hazard exposure')]
export const INJURY_SUBCATEGORIES = [
  option('fall', 'Πτώση', 'Fall'),
  option('sharp_object', 'Αιχμηρό αντικείμενο', 'Sharp object'),
  option('blood_product_reaction', 'Αντίδραση σε παράγωγα αίματος', 'Blood product reaction'),
  option('chemical_bio_radio_exposure', 'Έκθεση σε χημικό / βιολογικό / ακτινοβολία', 'Chemical / biological / radiation exposure'),
  option('drug_allergy', 'Αλλεργία σε φάρμακο', 'Drug allergy'),
  option('procedure_injury', 'Τραυματισμός σε πράξη / επέμβαση', 'Procedure injury'),
  option('falling_object', 'Πτώση αντικειμένου', 'Falling object'),
  option('other', 'Άλλο', 'Other'),
]
export const INJURED_PERSON_TYPES = [option('patient', 'Ασθενής', 'Patient'), option('employee', 'Εργαζόμενος', 'Employee'), option('companion', 'Συνοδός', 'Companion'), option('visitor', 'Επισκέπτης', 'Visitor')]
export const SHARP_TOOLS = [
  option('disposable_needle', 'Βελόνα μιας χρήσης', 'Disposable needle'),
  option('needle', 'Βελόνα', 'Needle'),
  option('scalpel', 'Νυστέρι', 'Scalpel'),
  option('suture_needle', 'Βελόνα συρραφής', 'Suture needle'),
  option('butterfly', 'Πεταλούδα', 'Butterfly'),
  option('other', 'Άλλο', 'Other'),
]
export const TOOL_STATES = [option('used', 'Χρησιμοποιημένο', 'Used'), option('clean', 'Καθαρό', 'Clean')]
export const BODY_SITES = [option('hands', 'Χέρια', 'Hands'), option('other', 'Άλλο σημείο', 'Elsewhere')]
export const BLUE_CODE_INTERVENTIONS = [
  option('cpr', 'ΚΑΡΠΑ', 'CPR'),
  option('intubation', 'Διασωλήνωση', 'Intubation'),
  option('central_line', 'Κεντρική γραμμή', 'Central line'),
  option('oxygen', 'Οξυγόνο', 'Oxygen'),
  option('peripheral_line', 'Περιφερική γραμμή', 'Peripheral line'),
  option('other', 'Άλλο', 'Other'),
]
export const BLUE_CODE_OUTCOMES = [option('successful', 'Επιτυχής', 'Successful'), option('unsuccessful', 'Ανεπιτυχής', 'Unsuccessful')]
export const TRANSFER_TARGETS = [
  option('icu', 'ΜΕΘ', 'ICU'),
  option('ward', 'Θάλαμος / τμήμα', 'Ward'),
  option('ed', 'ΤΕΠ', 'ED'),
  option('theatre', 'Χειρουργείο', 'Theatre'),
  option('mortuary', 'Νεκροθάλαμος', 'Mortuary'),
  option('discharged', 'Εξιτήριο', 'Discharged'),
  option('other', 'Άλλο', 'Other'),
]
// FileMaker's 17 values, case and accents merged: «Αιμορραγία» and «Μαιευτική
// Αιμορραγία» are one, «Αιμάτωμα» and «ΑΙΜΑΤΩΜΑ» one.
export const OBSTETRIC_SUBCATEGORIES = [
  option('preeclampsia', 'Προεκλαμψία', 'Pre-eclampsia'),
  option('obstetric_haemorrhage', 'Μαιευτική αιμορραγία', 'Obstetric haemorrhage'),
  option('placental_abruption', 'Αποκόλληση πλακούντα (ΔΑΠ)', 'Placental abruption'),
  option('shoulder_dystocia', 'Δυστοκία ώμων', 'Shoulder dystocia'),
  option('uterine_atony', 'Ατονία μήτρας', 'Uterine atony'),
  option('fever', 'Εμπύρετο', 'Fever'),
  option('abdominal_pain', 'Κοιλιακό άλγος', 'Abdominal pain'),
  option('uterine_rupture', 'Ρήξη μήτρας', 'Uterine rupture'),
  option('dural_puncture', 'Τρώση μήνιγγας', 'Dural puncture'),
  option('intrauterine_death', 'Ενδομήτριος θάνατος', 'Intrauterine death'),
  option('wound_repair', 'Συρραφή τραύματος', 'Wound repair'),
  option('bowel_perforation', 'Διάτρηση εντέρου', 'Bowel perforation'),
  option('haematoma', 'Αιμάτωμα', 'Haematoma'),
  option('low_back_pain', 'Άλγος ΟΜΣΣ', 'Low back pain'),
  option('meckel_diverticulum_rupture', 'Ρήξη μεκελείου απόφυσης', 'Ruptured Meckel’s diverticulum'),
  option('other', 'Άλλο', 'Other'),
]

export const detailOptions = (list, language = 'el') => list.map(item => ({ value: item.value, label: item.label[language === 'en' ? 1 : 0] }))
export const detailLabel = (list, value, language = 'el') => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''

export const emptyFall = () => ({ fallType: '', floorCondition: '', bedRails: '', location: '', examinedByDoctor: null, doctorInstructions: '', injuryCategory: '', injurySubcategory: '', injuredPersonType: '', injuredEmployeeId: '', injuryDescription: '' })
export const emptySharp = () => ({ tool: '', toolState: '', bodySite: '', bodySiteOther: '', firstUser: '', contactDuration: '', exposedBodyPart: '', substance: '' })
export const emptyBlueCode = () => ({ interventions: [], outcome: '', patientStatus: '', transferTo: '', doctor: '', nurse: '', staffInvolved: '', gloves: null })
export const emptyObstetric = () => ({ subcategory: '' })
const EMPTY = { fall: emptyFall, sharp: emptySharp, blueCode: emptyBlueCode, obstetric: emptyObstetric }

// The blocks an event type records; the sharps block follows a sharp-object injury.
export function detailBlocks(record = {}) {
  if (record.eventType === 'injury_fall_exposure') return record.fall?.injurySubcategory === 'sharp_object' ? ['fall', 'sharp'] : ['fall']
  if (record.eventType === 'blue_code') return ['blueCode']
  if (record.eventType === 'obstetric') return ['obstetric']
  return []
}

// The record's block, or an empty one to fill.
export const detailBlock = (record, key) => ({ ...EMPTY[key](), ...(record?.[key] || {}) })

const filled = value => (Array.isArray(value) ? value.length > 0 : value !== '' && value !== null && value !== undefined)
export const hasDetail = block => Boolean(block) && Object.values(block).some(filled)

// --- Database rows ----------------------------------------------------------------------

const text = value => { const kept = String(value ?? '').trim(); return kept || null }
const bool = value => (value === true || value === false ? value : null)
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
// An embedded 1:1 row comes back as an object (or, from an older PostgREST, a one-row array).
const single = value => (Array.isArray(value) ? value[0] || null : value || null)

export const DETAIL_TABLES = { fall: 'quality_incident_falls', sharp: 'quality_incident_sharps', blueCode: 'quality_incident_blue_codes', obstetric: 'quality_incident_obstetric' }
// What the incident select embeds: each block under its own name.
export const INCIDENT_DETAIL_SELECT = 'fall:quality_incident_falls(*),sharp:quality_incident_sharps(*),blue_code:quality_incident_blue_codes(*),obstetric:quality_incident_obstetric(*)'

const FROM_ROW = {
  fall: row => ({ fallType: row.fall_type || '', floorCondition: row.floor_condition || '', bedRails: row.bed_rails || '', location: row.location || '', examinedByDoctor: bool(row.examined_by_doctor), doctorInstructions: row.doctor_instructions || '', injuryCategory: row.injury_category || '', injurySubcategory: row.injury_subcategory || '', injuredPersonType: row.injured_person_type || '', injuredEmployeeId: row.injured_employee_id || '', injuryDescription: row.injury_description || '' }),
  sharp: row => ({ tool: row.tool || '', toolState: row.tool_state || '', bodySite: row.body_site || '', bodySiteOther: row.body_site_other || '', firstUser: row.first_user || '', contactDuration: row.contact_duration || '', exposedBodyPart: row.exposed_body_part || '', substance: row.substance || '' }),
  blueCode: row => ({ interventions: Array.isArray(row.interventions) ? row.interventions : [], outcome: row.outcome || '', patientStatus: row.patient_status || '', transferTo: row.transfer_to || '', doctor: row.doctor_label || '', nurse: row.nurse_label || '', staffInvolved: row.staff_involved || '', gloves: bool(row.gloves) }),
  obstetric: row => ({ subcategory: row.subcategory || '' }),
}
const TO_ROW = {
  fall: block => ({ fall_type: text(block.fallType), floor_condition: text(block.floorCondition), bed_rails: text(block.bedRails), location: text(block.location), examined_by_doctor: bool(block.examinedByDoctor), doctor_instructions: text(block.doctorInstructions), injury_category: text(block.injuryCategory), injury_subcategory: text(block.injurySubcategory), injured_person_type: text(block.injuredPersonType), injured_employee_id: block.injuredPersonType === 'employee' && isUuid(block.injuredEmployeeId) ? block.injuredEmployeeId : null, injury_description: text(block.injuryDescription) }),
  sharp: block => ({ tool: text(block.tool), tool_state: text(block.toolState), body_site: text(block.bodySite), body_site_other: block.bodySite === 'other' ? text(block.bodySiteOther) : null, first_user: text(block.firstUser), contact_duration: text(block.contactDuration), exposed_body_part: text(block.exposedBodyPart), substance: text(block.substance) }),
  blueCode: block => ({ interventions: (block.interventions || []).filter(value => BLUE_CODE_INTERVENTIONS.some(item => item.value === value)), outcome: text(block.outcome), patient_status: text(block.patientStatus), transfer_to: text(block.transferTo), doctor_label: text(block.doctor), nurse_label: text(block.nurse), staff_involved: text(block.staffInvolved), gloves: bool(block.gloves) }),
  obstetric: block => ({ subcategory: text(block.subcategory) }),
}
const ROW_KEY = { fall: 'fall', sharp: 'sharp', blueCode: 'blue_code', obstetric: 'obstetric' }

// The record's blocks from an incident row with its embedded detail rows.
export function incidentDetailsFromRow(row = {}) {
  return Object.fromEntries(Object.keys(DETAIL_TABLES).map(key => { const detail = single(row[ROW_KEY[key]]); return [key, detail ? FROM_ROW[key](detail) : null] }))
}

// What each detail table holds for the record: a row for each block its event
// type records and that has something filled in; null where the table has
// nothing for it (a row there is removed). An obstetric row needs its subcategory.
export function incidentDetailRows(record = {}) {
  const blocks = detailBlocks(record)
  return Object.fromEntries(Object.entries(DETAIL_TABLES).map(([key, table]) => {
    if (!blocks.includes(key) || !hasDetail(record[key])) return [table, null]
    const row = TO_ROW[key](detailBlock(record, key))
    if (key === 'obstetric' && !row.subcategory) return [table, null]
    return [table, row]
  }))
}

// The record as saved: only the blocks its event type records, and only if
// something is filled in (the form keeps the others while one changes its mind).
export function keptDetails(record = {}) {
  const blocks = detailBlocks(record)
  const next = { ...record, eventType: record.eventType || '' }
  for (const key of Object.keys(DETAIL_TABLES)) next[key] = blocks.includes(key) && hasDetail(record[key]) ? detailBlock(record, key) : null
  if (next.obstetric && !next.obstetric.subcategory) next.obstetric = null
  return next
}

// --- What the record shows ------------------------------------------------------------

const yesNo = (value, en) => (value === true ? (en ? 'Yes' : 'Ναι') : value === false ? (en ? 'No' : 'Όχι') : '')
export const employeeName = (employee, language = 'el') => (employee ? (language === 'en' ? [employee.firstNameEn || employee.firstName, employee.lastNameEn || employee.lastName] : [employee.lastName, employee.firstName]).filter(Boolean).join(' ') : '')

// The event type and its details as [label, value] pairs, the empty ones left out.
export function incidentDetailFacts(record = {}, language = 'el', employees = []) {
  const en = language === 'en'
  const L = (el, english) => (en ? english : el)
  const facts = [[L('Είδος συμβάντος', 'Event type'), detailLabel(EVENT_TYPES, record.eventType, language)]]
  const blocks = detailBlocks(record)
  if (blocks.includes('fall')) {
    const fall = detailBlock(record, 'fall')
    const employee = employees.find(item => item.id === fall.injuredEmployeeId)
    facts.push(
      [L('Κατηγορία τραυματισμού', 'Injury category'), detailLabel(INJURY_CATEGORIES, fall.injuryCategory, language)],
      [L('Υποκατηγορία', 'Subcategory'), detailLabel(INJURY_SUBCATEGORIES, fall.injurySubcategory, language)],
      [L('Ποιος τραυματίστηκε', 'Who was injured'), [detailLabel(INJURED_PERSON_TYPES, fall.injuredPersonType, language), employeeName(employee, language)].filter(Boolean).join(' · ')],
      [L('Είδος πτώσης', 'Type of fall'), detailLabel(FALL_TYPES, fall.fallType, language)],
      [L('Δάπεδο', 'Floor'), detailLabel(FLOOR_CONDITIONS, fall.floorCondition, language)],
      [L('Προστατευτικά κλίνης', 'Bed rails'), detailLabel(BED_RAILS, fall.bedRails, language)],
      [L('Σημείο', 'Location'), fall.location],
      [L('Εξετάστηκε από ιατρό', 'Examined by a doctor'), yesNo(fall.examinedByDoctor, en)],
      [L('Οδηγίες ιατρού', 'Doctor’s instructions'), fall.doctorInstructions],
      [L('Περιγραφή τραυματισμού', 'Injury'), fall.injuryDescription],
    )
  }
  if (blocks.includes('sharp')) {
    const sharp = detailBlock(record, 'sharp')
    facts.push(
      [L('Αιχμηρό', 'Sharp'), [detailLabel(SHARP_TOOLS, sharp.tool, language), detailLabel(TOOL_STATES, sharp.toolState, language)].filter(Boolean).join(' · ')],
      [L('Σημείο τραυματισμού', 'Injury site'), sharp.bodySite === 'other' ? sharp.bodySiteOther || detailLabel(BODY_SITES, 'other', language) : detailLabel(BODY_SITES, sharp.bodySite, language)],
      [L('Πρώτος χρήστης', 'First user'), sharp.firstUser],
      [L('Διάρκεια επαφής', 'Contact duration'), sharp.contactDuration],
      [L('Εκτεθειμένο μέρος', 'Exposed part'), sharp.exposedBodyPart],
      [L('Ουσία', 'Substance'), sharp.substance],
    )
  }
  if (blocks.includes('blueCode')) {
    const blue = detailBlock(record, 'blueCode')
    facts.push(
      [L('Παρεμβάσεις', 'Interventions'), blue.interventions.map(value => detailLabel(BLUE_CODE_INTERVENTIONS, value, language)).join(', ')],
      [L('Έκβαση', 'Outcome'), detailLabel(BLUE_CODE_OUTCOMES, blue.outcome, language)],
      [L('Κατάσταση ασθενούς', 'Patient status'), blue.patientStatus],
      [L('Μεταφορά', 'Transfer to'), detailLabel(TRANSFER_TARGETS, blue.transferTo, language)],
      [L('Ιατρός', 'Doctor'), blue.doctor],
      [L('Νοσηλευτής/τρια', 'Nurse'), blue.nurse],
      [L('Εμπλεκόμενο προσωπικό', 'Staff involved'), blue.staffInvolved],
      [L('Γάντια', 'Gloves'), yesNo(blue.gloves, en)],
    )
  }
  if (blocks.includes('obstetric')) facts.push([L('Υποκατηγορία μαιευτικού', 'Obstetric subcategory'), detailLabel(OBSTETRIC_SUBCATEGORIES, record.obstetric?.subcategory, language)])
  return facts.filter(([, value]) => value)
}
