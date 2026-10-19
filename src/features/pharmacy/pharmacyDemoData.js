import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { DEMO_HISTORY_MONTHS, lastDayOfMonth, pad2, seededRandom } from '../../core/data/demoSeed'
export const pharmacyDepartments=[
  {id:'dep-icu',el:'ΜΕΘ',en:'ICU'},
  {id:'dep-internal',el:'Παθολογική',en:'Internal Medicine'},
  {id:'dep-surgery',el:'Χειρουργική',en:'Surgery'},
  {id:'dep-ed',el:'ΤΕΠ',en:'ED'},
  {id:'dep-cardio',el:'Καρδιολογική',en:'Cardiology'},
]

export const antibioticLibrary=[
  {id:'abx-cro',code:'ABX-CRO',el:'Κεφτριαξόνη',en:'Ceftriaxone'},
  {id:'abx-mem',code:'ABX-MEM',el:'Μεροπενέμη',en:'Meropenem'},
  {id:'abx-van',code:'ABX-VAN',el:'Βανκομυκίνη',en:'Vancomycin'},
  {id:'abx-oxa',code:'ABX-OXA',el:'Οξακιλλίνη',en:'Oxacillin'},
  {id:'abx-tzp',code:'ABX-TZP',el:'Πιπερακιλλίνη/Ταζομπακτάμη',en:'Piperacillin/tazobactam'},
  {id:'abx-cfz',code:'ABX-CFZ',el:'Κεφαζολίνη',en:'Cefazolin'},
  {id:'abx-amc',code:'ABX-AMC',el:'Αμοξικιλλίνη/Κλαβουλανικό',en:'Amoxicillin/clavulanic acid'},
]

// Ενδεικτικές τιμές DDD (WHO ATC/DDD Index) — μόνο για επίδειξη στο demo
// περιβάλλον. Σε πραγματικό οργανισμό οι τιμές καταχωρούνται και
// επαληθεύονται από το φαρμακείο έναντι του τρέχοντος επίσημου δείκτη.
export const dddReferenceLibrary={'ABX-CRO':2,'ABX-MEM':3,'ABX-VAN':2,'ABX-OXA':2,'ABX-TZP':14,'ABX-CFZ':3,'ABX-AMC':3}

function dispensingRow({id,periodStart,periodEnd,department,product,quantityGrams,method,referenceNumber,responsible}){
  return {
    id,period:periodStart.slice(0,7),periodStart,periodEnd,
    departmentScope:department?'department':'hospital',departmentEl:department?.el||'Όλο το νοσοκομείο',departmentEn:department?.en||'Whole hospital',
    product:product.el,productEn:product.en,antibioticItemId:product.id,productCode:product.code,
    quantityGrams,method,referenceNumber,responsible,notes:'',
    createdAt:`${periodEnd}T08:00:00`,createdById:'demo-user',updatedAt:`${periodEnd}T08:00:00`,updatedById:'demo-user',
  }
}

export const antibioticDispensingRows=[
  dispensingRow({id:'ABXD-2603',periodStart:'2026-07-01',periodEnd:'2026-07-31',department:pharmacyDepartments[0],product:antibioticLibrary[1],quantityGrams:760,method:'manual',referenceNumber:'ΦΑ-207',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2604',periodStart:'2026-06-01',periodEnd:'2026-06-30',department:pharmacyDepartments[1],product:antibioticLibrary[0],quantityGrams:980,method:'manual',referenceNumber:'ΦΑ-196',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2605',periodStart:'2026-05-01',periodEnd:'2026-05-31',department:null,product:antibioticLibrary[2],quantityGrams:540,method:'manual',referenceNumber:'ΦΑ-181',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2606',periodStart:'2026-04-01',periodEnd:'2026-04-30',department:pharmacyDepartments[0],product:antibioticLibrary[1],quantityGrams:920,method:'manual',referenceNumber:'ΦΑ-170',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2607',periodStart:'2026-03-01',periodEnd:'2026-03-31',department:pharmacyDepartments[2],product:antibioticLibrary[0],quantityGrams:830,method:'manual',referenceNumber:'ΦΑ-158',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2601',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:pharmacyDepartments[0],product:antibioticLibrary[1],quantityGrams:840,method:'manual',referenceNumber:'ΦΑ-220',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2602',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:null,product:antibioticLibrary[0],quantityGrams:1200,method:'manual',referenceNumber:'ΦΑ-221',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2608',periodStart:'2026-07-01',periodEnd:'2026-07-31',department:pharmacyDepartments[2],product:antibioticLibrary[3],quantityGrams:400,method:'manual',referenceNumber:'ΦΑ-210',responsible:'Φαρμακείο'}),
]

// A year of monthly dispensing behind the rows above (authored 2025-09 … 2026-08):
// each ward's main agents, with ICU carbapenem use slowly falling as the
// Antimicrobial Stewardship Committee tightens its restriction.
const [CRO,MEM,VAN,,TZP,CFZ,AMC]=antibioticLibrary
const [ICU,IM,SURG,ED,CARDIO]=pharmacyDepartments
const DISPENSING_PLAN=[[ICU,MEM,900,-9],[ICU,TZP,2100,0],[IM,CRO,1000,0],[SURG,CFZ,690,0],[ED,AMC,600,0],[CARDIO,VAN,380,0]]
let dispensingReference=300
DEMO_HISTORY_MONTHS.forEach((month,monthIndex)=>{
  const periodStart=`${month}-01`,periodEnd=`${month}-${pad2(lastDayOfMonth(month))}`
  DISPENSING_PLAN.forEach(([department,product,grams,trend],index)=>{
    if(product===VAN&&monthIndex%2)return
    if(antibioticDispensingRows.some(row=>row.departmentEl===department.el&&row.productCode===product.code&&row.period===month))return
    const rand=seededRandom(`dispensing|${month}|${department.id}|${product.id}`)
    dispensingReference+=1
    antibioticDispensingRows.push(dispensingRow({id:`ABXD-${month.replace('-','').slice(2)}-${index+1}`,periodStart,periodEnd,department,product,quantityGrams:Math.round((grams+trend*monthIndex)*(0.9+rand()*0.2)/10)*10,method:'manual',referenceNumber:`ΦΑ-${dispensingReference}`,responsible:'Φαρμακείο'}))
  })
})

// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([antibioticDispensingRows])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(antibioticDispensingRows)
