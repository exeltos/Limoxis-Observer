export const pharmacyDepartments=[
  {id:'dep-icu',el:'ΜΕΘ',en:'ICU'},
  {id:'dep-internal',el:'Παθολογική',en:'Internal Medicine'},
  {id:'dep-surgery',el:'Χειρουργική',en:'Surgery'},
]

export const antibioticLibrary=[
  {id:'abx-cro',code:'ABX-CRO',el:'Κεφτριαξόνη',en:'Ceftriaxone'},
  {id:'abx-mem',code:'ABX-MEM',el:'Μεροπενέμη',en:'Meropenem'},
  {id:'abx-van',code:'ABX-VAN',el:'Βανκομυκίνη',en:'Vancomycin'},
  {id:'abx-oxa',code:'ABX-OXA',el:'Οξακιλλίνη',en:'Oxacillin'},
]

// Ενδεικτικές τιμές DDD (WHO ATC/DDD Index) — μόνο για επίδειξη στο demo
// περιβάλλον. Σε πραγματικό οργανισμό οι τιμές καταχωρούνται και
// επαληθεύονται από το φαρμακείο έναντι του τρέχοντος επίσημου δείκτη.
export const dddReferenceLibrary={'ABX-CRO':2,'ABX-MEM':3,'ABX-VAN':2,'ABX-OXA':2}

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
  dispensingRow({id:'ABXD-2601',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:pharmacyDepartments[0],product:antibioticLibrary[1],quantityGrams:840,method:'manual',referenceNumber:'ΦΑ-220',responsible:'Φαρμακείο'}),
  dispensingRow({id:'ABXD-2602',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:null,product:antibioticLibrary[0],quantityGrams:1200,method:'manual',referenceNumber:'ΦΑ-221',responsible:'Φαρμακείο'}),
]
