import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

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

export function loadDocuments(){const rows=loadSnapshot('documents',structuredClone(seed));return Array.isArray(rows)?rows:structuredClone(seed)}
export function saveDocuments(rows){return saveSnapshot('documents',rows)}
export function nextDocumentId(rows){
  const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/DOC-(\d+)/)?.[1]||0)),0)
  return `DOC-${String(max+1).padStart(3,'0')}`
}

export function nextRevisionVersion(version='1.0'){
 const parts=String(version||'1.0').split('.')
 const major=Number(parts[0])||1
 const minor=Number(parts[1])||0
 return `${major}.${minor+1}`
}

export function createDocumentRevision(source,{actor,version}={}){
 const now=new Date().toISOString()
 const nextVersion=version||nextRevisionVersion(source.version)
 return {
  ...source,
  id:nextDocumentId(),
  status:'draft',
  version:nextVersion,
  revisionOfId:source.id,
  supersedesId:source.id,
  supersededById:null,
  publishedAt:null,publishedBy:null,publishedById:null,
  archivedAt:null,archivedBy:null,archivedById:null,
  createdAt:now,createdBy:actor?.name||'Άγνωστος χρήστης',createdById:actor?.id||'unknown',
  updatedAt:now,updatedBy:actor?.name||'Άγνωστος χρήστης',updatedById:actor?.id||'unknown',
  history:[{at:now,actor:actor?.name||'Άγνωστος χρήστης',actorId:actor?.id||'unknown',action:'Δημιουργία νέας έκδοσης',reason:`Από ${source.id} · ${source.version||'—'} → ${nextVersion}`}],
 }
}
