import { ENVIRONMENTAL_SAMPLE_TYPES } from '../surveillance/environmentalSurveillanceData'
import { EMPLOYEE_SCREENING_TYPES as SURVEILLANCE_SCREENING_TYPES,OTHER_EMPLOYEE_SCREENING,SAMPLE_PRIORITIES } from '../surveillance/surveillanceOptions'
// Laboratory reference lists, one item shape everywhere: {id, el, en} (plus
// what a list needs, e.g. the i18n label key or the sources of a sample type).
export const sampleSourceCatalog={
  peripheral:{label:'peripheralBlood',el:'Περιφερική αιμοληψία',en:'Peripheral draw'},
  centralLine:{label:'centralLine',el:'Κεντρική φλεβική γραμμή',en:'Central line'},
  arterialLine:{label:'arterialLine',el:'Αρτηριακή γραμμή',en:'Arterial line'},
  midstream:{label:'midstreamUrine',el:'Μέσο ρεύμα ούρων',en:'Midstream urine'},
  urinaryCatheter:{label:'urinaryCatheter',el:'Ουροκαθετήρας',en:'Urinary catheter'},
  nephrostomy:{label:'nephrostomy',el:'Νεφροστομία',en:'Nephrostomy'},
  suprapubicCatheter:{label:'suprapubicCatheter',el:'Υπερηβικός καθετήρας',en:'Suprapubic catheter'},
  sputum:{label:'sputum',el:'Πτύελα',en:'Sputum'},
  trachealAspirate:{label:'trachealAspirate',el:'Τραχειακό αναρρόφημα',en:'Tracheal aspirate'},
  bal:{label:'bal',el:'BAL',en:'BAL'},
  woundSwab:{label:'woundSwab',el:'Επίχρισμα τραύματος',en:'Wound swab'},
  deepTissue:{label:'deepTissue',el:'Βαθύς ιστός',en:'Deep tissue'},
  drainage:{label:'drainage',el:'Παροχέτευση / έκκριμα',en:'Drainage'},
  other:{label:'other',el:'Άλλο',en:'Other'},
}

// `sample_type` remains the stable technical category used by indicators and
// analysis. `specimen_type_id` is the clinical specimen selected from the
// central Sample types library and is the value shown to users.
export const PATIENT_SAMPLE_TYPES=[
  {id:'bloodCulture',sources:['peripheral','centralLine','arterialLine','other'],library:{'Αίμα':'',Blood:''}},
  {id:'urineCulture',sources:['midstream','urinaryCatheter','nephrostomy','suprapubicCatheter','other'],library:{'Ούρα':'',Urine:''}},
  {id:'respiratorySample',sources:['sputum','trachealAspirate','bal','other'],library:{'Πτύελα':'sputum',Sputum:'sputum','Τραχειακό αναρρόφημα':'trachealAspirate','Tracheal aspirate':'trachealAspirate',BAL:'bal'}},
  {id:'woundCulture',sources:['woundSwab','deepTissue','drainage','other'],library:{'Τραύμα / επίχρισμα':'woundSwab','Wound / swab':'woundSwab','Βαθύς ιστός':'deepTissue','Deep tissue':'deepTissue'}},
  {id:'specimen',sources:[],library:{}},
  {id:'surveillanceSpecimen',sources:[],library:{}},
]
export const patientSampleSources=type=>PATIENT_SAMPLE_TYPES.find(item=>item.id===type)?.sources||[]

const ENVIRONMENTAL_LIBRARY_CODES=new Set(['SAMPLE-SURFACE','SAMPLE-WATER'])
const RESPIRATORY_LIBRARY_CODES=new Set(['SAMPLE-SPUTUM','SAMPLE-BAL','SAMPLE-BRONCHIAL-SECRETIONS','SAMPLE-NASAL-SWAB','SAMPLE-THROAT-SWAB','SAMPLE-NASOPHARYNGEAL','SAMPLE-RESPIRATORY'])
const WOUND_LIBRARY_CODES=new Set(['SAMPLE-WOUND','SAMPLE-WOUND-MATERIAL','SAMPLE-PUS','SAMPLE-DRAINAGE','SAMPLE-SUTURE'])

export function technicalPatientSampleType(item={}){
  const code=String(item.code||'').toUpperCase()
  if(code==='SAMPLE-BLOOD')return 'bloodCulture'
  if(code==='SAMPLE-URINE')return 'urineCulture'
  if(RESPIRATORY_LIBRARY_CODES.has(code))return 'respiratorySample'
  if(WOUND_LIBRARY_CODES.has(code))return 'woundCulture'
  if(code==='SAMPLE-SURVEILLANCE')return 'surveillanceSpecimen'
  return 'specimen'
}

function defaultSourceForSpecimen(item,type){
  const code=String(item.code||'').toUpperCase()
  if(code==='SAMPLE-SPUTUM')return 'sputum'
  if(code==='SAMPLE-BAL')return 'bal'
  if(code==='SAMPLE-WOUND')return 'woundSwab'
  if(code==='SAMPLE-DRAINAGE')return 'drainage'
  if(type==='bloodCulture'||type==='urineCulture')return ''
  // For the remaining library specimens the specimen name is itself the most
  // precise source; NewSampleCard can still add an anatomical site separately.
  return item.el||item.value||''
}

// Patient choices come directly from Management > Libraries > Sample types.
// Surface/water stay in environmental surveillance; no synthetic «Other» item
// is offered for patient samples. The technical type remains separate so
// existing indicators continue to work.
export function patientSampleTypeOptions(items=[],language='el',t=key=>key){
  const clinical=items.filter(item=>!ENVIRONMENTAL_LIBRARY_CODES.has(String(item.code||'').toUpperCase()))
  const mapped=clinical.map(item=>{
    const type=technicalPatientSampleType(item)
    const label=language==='en'?item.en||item.el:item.el
    return {
      value:item.id||item.meta?.id||item.value,
      label,
      description:t(type)!==label?t(type):undefined,
      keywords:`${item.el} ${item.en} ${item.code||''} ${t(type)}`,
      type,
      source:defaultSourceForSpecimen(item,type),
      specimenTypeId:item.id||item.meta?.id||null,
      specimenCode:item.code||null,
      specimenEl:item.el,
      specimenEn:item.en||item.el,
    }
  })
  return mapped.length?mapped:PATIENT_SAMPLE_TYPES.filter(type=>!['specimen','surveillanceSpecimen'].includes(type.id)).map(type=>({value:type.id,label:t(type.id),type:type.id,source:'',specimenTypeId:null}))
}

// Employee screening swabs (stored as sourceCode with type 'surveillance').
// Surveillance keeps the same ids in employeeScreeningCatalog.
// Employee screening types: the surveillance list (one source) plus «other».
export const EMPLOYEE_SCREENING_TYPES=[...SURVEILLANCE_SCREENING_TYPES,OTHER_EMPLOYEE_SCREENING]

// Environmental sample types of a new laboratory sample (stored as
// environmentType; the label is stored as the source).
export { ENVIRONMENTAL_SAMPLE_TYPES }

// Sample priority (stored as priority; label t(id)).
export const LAB_PRIORITIES=SAMPLE_PRIORITIES.map(item=>item.value)

// Screening / environmental source codes stored as raw keys (e.g. "nasalSwab, handSwab").
const sampleSourceAliases=Object.fromEntries([...EMPLOYEE_SCREENING_TYPES,...ENVIRONMENTAL_SAMPLE_TYPES].filter(item=>!(item.id in sampleSourceCatalog)).map(item=>[item.id,item]))
export function sampleSourceLabel(value,language='el'){const lang=language==='en'?'en':'el';const parts=String(value||'').split(',').map(item=>item.trim()).filter(Boolean);return parts.length?parts.map(item=>{const row=sampleSourceAliases[item]||sampleSourceCatalog[item];return row?.[lang]||row?.el||item}).join(', '):''}

// {id, el, en} items as SearchableSelect options.
export const referenceOptions=(items,language='el')=>items.map(item=>({value:item.id,label:language==='en'?item.en:item.el,keywords:`${item.el} ${item.en}`}))
export const referenceLabel=(items,id,language='el')=>{const item=items.find(row=>row.id===id);return item?(language==='en'?item.en:item.el):id||'—'}
