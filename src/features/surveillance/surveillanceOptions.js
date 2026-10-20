// The option lists of the surveillance and patient screens, in one place.
// Records keep storing the same codes as before; only the labels and the way
// the lists are offered (SearchableSelect / ModeSwitch / ChoiceChips) are shared.

// Employee screening: the swabs offered on a new screening and on a laboratory
// request correction. Stored as these ids (screeningTypes, request source codes).
// The Laboratory module can import this list instead of keeping its own copy.
export const EMPLOYEE_SCREENING_TYPES=[
  {id:'handSwab',el:'Επίχρισμα χεριών',en:'Hand swab'},
  {id:'nasalSwab',el:'Ρινικό επίχρισμα',en:'Nasal swab'},
  {id:'throatSwab',el:'Φαρυγγικό επίχρισμα',en:'Throat swab'},
]
export const OTHER_EMPLOYEE_SCREENING={id:'otherEmployeeScreening',el:'Άλλος προληπτικός έλεγχος εργαζομένου',en:'Other employee screening'}
export const employeeScreeningOptions=(language='el')=>EMPLOYEE_SCREENING_TYPES.map(item=>({value:item.id,label:language==='en'?item.en:item.el}))
export function employeeScreeningLabel(id,language='el'){
  const item=[...EMPLOYEE_SCREENING_TYPES,OTHER_EMPLOYEE_SCREENING].find(row=>row.id===id)
  return item?(language==='en'?item.en:item.el):id
}

// Laboratory request priority, one list for patient samples and employee requests.
export const SAMPLE_PRIORITIES=[
  {value:'routine',el:'Ρουτίνα',en:'Routine'},
  {value:'urgent',el:'Επείγον',en:'Urgent'},
  {value:'critical',el:'Κρίσιμο',en:'Critical'},
]
export const priorityOptions=(language='el')=>SAMPLE_PRIORITIES.map(item=>({value:item.value,label:language==='en'?item.en:item.el}))

// Patient sample types stay the five codes the indicators and analysis read
// (bloodCulture, urineCulture, …). The central «sampleTypes» library adds its
// specimens to the matching code, so typing «BAL» or «Πτύελα» finds
// «Respiratory sample»; with an empty library the five codes are offered alone.
export const PATIENT_SAMPLE_TYPES=['bloodCulture','urineCulture','respiratorySample','woundCulture','other']
const SPECIMEN_CODES=[
  ['bloodCulture',/(^|\s)(αίμα|αιμα|blood)|αιμοκαλλ/i],
  ['urineCulture',/ούρ|ουρ|urine/i],
  ['respiratorySample',/πτύελ|πτυελ|sputum|τραχει|trache|bal\b|βρογχ|bronch|αναπνευ|respir/i],
  ['woundCulture',/τραύμ|τραυμ|wound|πύον|pus/i],
]
const ENVIRONMENTAL_SPECIMEN=/επιφάν|επιφαν|surface|αέρα|αερα|\bair\b|νερό|νερο|water|περιβάλλ|περιβαλλ|environment/i
export function specimenCode(item){
  const text=`${item?.el||''} ${item?.en||''} ${item?.code||''}`
  return SPECIMEN_CODES.find(([,pattern])=>pattern.test(text))?.[0]||'other'
}
export function patientSampleTypeOptions(items=[],language='el',t=key=>key){
  const specimens=items.filter(item=>!ENVIRONMENTAL_SPECIMEN.test(`${item.el} ${item.en}`)&&!/environment/i.test(String(item.meta?.source||'')))
  return PATIENT_SAMPLE_TYPES.map(code=>{
    const names=specimens.filter(item=>specimenCode(item)===code).map(item=>language==='en'?item.en||item.el:item.el)
    return {value:code,label:t(code),description:names.length?names.join(' · '):undefined,keywords:specimens.filter(item=>specimenCode(item)===code).map(item=>`${item.el} ${item.en}`).join(' ')}
  })
}

// Suspected source of a new surveillance episode ('' = under assessment).
export const SUSPECTED_SOURCES=['bloodstream','urinary','respiratory','surgicalSite','other']
export const suspectedSourceOptions=t=>SUSPECTED_SOURCES.map(value=>({value,label:value==='other'?t('other'):t(`clinicalRecords.${value}`)}))

// Departments from useDepartments(), as SearchableSelect options.
export const departmentLabel=(department,language='el')=>department?(language==='en'?department.nameEn||department.name:department.name):''
export function departmentOptions(departments=[],language='el'){
  return departments.map(department=>{const label=departmentLabel(department,language),other=language==='en'?department.name:department.nameEn;return {value:department.id,label,description:other&&other!==label?other:undefined,keywords:`${department.name} ${department.nameEn||''}`}})
}

// The status-badge tone of a surveillance, sample, therapy or screening status.
const STATUS_TONES={
  active:'success',negative:'success',administered:'success',completed:'neutral',
  positive:'danger',positive_recheck:'danger',critical:'danger',rejected:'danger',
  withheld:'warning',pending:'warning',pending_lab:'warning',received:'warning',processing:'warning',needsFollowup:'warning',
}
export const statusTone=status=>STATUS_TONES[status]||'neutral'

// The texts of the shared list fields in the screen's language.
export function listTexts(language='el'){
  const en=language==='en'
  return {
    emptyLabel:en?'No match':'Καμία αντιστοιχία',
    clearLabel:en?'Clear':'Καθαρισμός',
    searchPlaceholder:en?'Search…':'Αναζήτηση…',
    selectAllLabel:en?'Select all':'Επιλογή όλων',
    clearAllLabel:en?'Clear all':'Αποεπιλογή όλων',
    countLabel:count=>en?`${count} selected`:`${count} επιλεγμένα`,
    customLabel:text=>en?`Use «${text}»`:`Χρήση «${text}»`,
  }
}

// The period filter of the lists: the record started within the last N days («all» keeps everything).
export const PERIOD_DAYS = [7, 30, 90, 365]
export function inPeriod(value, period) {
  if (!period || period === 'all') return true
  const time = value ? new Date(String(value).length <= 10 ? `${value}T12:00:00` : value).getTime() : NaN
  return !Number.isNaN(time) && Date.now() - time <= Number(period) * 86400000
}
