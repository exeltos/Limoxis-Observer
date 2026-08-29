const KEY='limoxis.documents.v1'

const seed=[
  {
    id:'DOC-001',title:'Πολιτική Υγιεινής Χεριών',type:'policy',department:'Όλο το νοσοκομείο',
    audience:'all',status:'published',version:'1.0',owner:'Επιτροπή Νοσοκομειακών Λοιμώξεων',
    effectiveDate:'2026-01-15',reviewDate:'2027-01-15',description:'Βασική πολιτική εφαρμογής υγιεινής χεριών.',
    attachments:[],createdAt:'2026-01-10T09:00:00.000Z',createdBy:'Demo seed',updatedAt:'2026-01-15T09:00:00.000Z',updatedBy:'Demo seed',
    history:[{at:'2026-01-15T09:00:00.000Z',actor:'Demo seed',action:'Δημοσίευση εγγράφου',reason:'Έκδοση 1.0'}]
  },
  {
    id:'DOC-002',title:'Οδηγία Διαχείρισης Αποβλήτων',type:'instruction',department:'Νοσηλευτική Υπηρεσία',
    audience:'department',status:'draft',version:'0.1',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'',reviewDate:'',description:'Πρόχειρη έκδοση οδηγίας για εσωτερική επεξεργασία.',
    attachments:[],createdAt:'2026-08-10T10:30:00.000Z',createdBy:'Demo seed',updatedAt:'2026-08-10T10:30:00.000Z',updatedBy:'Demo seed',
    history:[{at:'2026-08-10T10:30:00.000Z',actor:'Demo seed',action:'Δημιουργία εγγράφου',reason:'Αρχική έκδοση'}]
  }
]

export function loadDocuments(){
  try{const raw=localStorage.getItem(KEY);if(raw){const rows=JSON.parse(raw);if(Array.isArray(rows))return rows}}catch{/* ignore: best-effort, falls back to defaults */}
  return structuredClone(seed)
}
export function saveDocuments(rows){try{localStorage.setItem(KEY,JSON.stringify(rows))}catch{/* ignore: best-effort, falls back to defaults */}return rows}
export function nextDocumentId(rows){
  const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/DOC-(\d+)/)?.[1]||0)),0)
  return `DOC-${String(max+1).padStart(3,'0')}`
}
