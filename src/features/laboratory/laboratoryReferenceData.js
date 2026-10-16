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

// Patient specimen types: a sample stores the id (sample_type), its label is
// t(id), and the collection sources depend on it. `library` lists the names of
// the central «Sample types» library (Management > Libraries) that mean this
// type, with the source a library name already implies.
export const PATIENT_SAMPLE_TYPES=[
  {id:'bloodCulture',sources:['peripheral','centralLine','arterialLine','other'],library:{'Αίμα':'',Blood:''}},
  {id:'urineCulture',sources:['midstream','urinaryCatheter','nephrostomy','suprapubicCatheter','other'],library:{'Ούρα':'',Urine:''}},
  {id:'respiratorySample',sources:['sputum','trachealAspirate','bal','other'],library:{'Πτύελα':'sputum',Sputum:'sputum','Τραχειακό αναρρόφημα':'trachealAspirate','Tracheal aspirate':'trachealAspirate',BAL:'bal'}},
  {id:'woundCulture',sources:['woundSwab','deepTissue','drainage','other'],library:{'Τραύμα / επίχρισμα':'woundSwab','Wound / swab':'woundSwab','Βαθύς ιστός':'deepTissue','Deep tissue':'deepTissue'}},
]
export const patientSampleSources=type=>PATIENT_SAMPLE_TYPES.find(item=>item.id===type)?.sources||[]

// The sample-type choices of a new patient sample: the library's names that map
// onto a stored type (choosing one may also fill the source), or, while the
// library has none of them, the four stored types themselves.
export function patientSampleTypeOptions(items=[],language='el',t=key=>key){
  const mapped=items.flatMap(item=>{const type=PATIENT_SAMPLE_TYPES.find(row=>[item.el,item.en,item.value].some(name=>name in row.library));if(!type)return [];const source=type.library[item.el]??type.library[item.en]??'';const label=language==='en'?item.en||item.el:item.el;return [{value:item.value,label,description:t(type.id)!==label?t(type.id):undefined,keywords:`${item.el} ${item.en} ${t(type.id)}`,type:type.id,source}]})
  return mapped.length?mapped:PATIENT_SAMPLE_TYPES.map(type=>({value:type.id,label:t(type.id),type:type.id,source:''}))
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
