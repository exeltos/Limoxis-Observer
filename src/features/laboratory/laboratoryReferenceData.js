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

// Screening / environmental source codes stored as raw keys (e.g. "nasalSwab, handSwab").
const sampleSourceAliases={nasalSwab:{el:'Ρινικό επίχρισμα',en:'Nasal swab'},handSwab:{el:'Επίχρισμα χεριών',en:'Hand swab'},throatSwab:{el:'Φαρυγγικό επίχρισμα',en:'Throat swab'},otherEmployeeScreening:{el:'Άλλος προληπτικός έλεγχος εργαζομένου',en:'Other employee screening'},surface:{el:'Επιφάνεια',en:'Surface'},equipment:{el:'Εξοπλισμός',en:'Equipment'},water:{el:'Νερό',en:'Water'},air:{el:'Αέρας',en:'Air'}}
export function sampleSourceLabel(value,language='el'){const lang=language==='en'?'en':'el';const parts=String(value||'').split(',').map(item=>item.trim()).filter(Boolean);return parts.length?parts.map(item=>{const row=sampleSourceAliases[item]||sampleSourceCatalog[item];return row?.[lang]||row?.el||item}).join(', '):''}
