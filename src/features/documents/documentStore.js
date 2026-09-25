import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const seed=[
  {
    id:'DOC-001',title:'Πολιτική Υγιεινής Χεριών',type:'policy',department:'Όλο το νοσοκομείο',
    audience:'all',status:'published',version:'1.0',owner:'Επιτροπή Νοσοκομειακών Λοιμώξεων',
    effectiveDate:'2026-01-15',reviewDate:'2027-01-15',description:'Βασική πολιτική εφαρμογής υγιεινής χεριών.',
    attachments:[],createdAt:'2026-01-10T09:00:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-01-15T09:00:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[{at:'2026-01-15T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'Δημοσίευση εγγράφου',reason:'Έκδοση 1.0'}]
  },
  {
    id:'DOC-002',title:'Οδηγία Διαχείρισης Αποβλήτων',type:'instruction',department:'Νοσηλευτική Υπηρεσία',
    audience:'department',status:'draft',version:'0.1',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'',reviewDate:'',description:'Πρόχειρη έκδοση οδηγίας για εσωτερική επεξεργασία.',
    attachments:[],createdAt:'2026-08-10T10:30:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-08-10T10:30:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[{at:'2026-08-10T10:30:00.000Z',actor:'Διαχειριστής Demo',action:'Δημιουργία εγγράφου',reason:'Αρχική έκδοση'}]
  },
  {
    id:'DOC-003',title:'Πρωτόκολλο Απομόνωσης Πολυανθεκτικών Παθογόνων',type:'protocol',department:'Όλο το νοσοκομείο',
    audience:'all',status:'review',version:'1.0',owner:'Επιτροπή Νοσοκομειακών Λοιμώξεων',
    effectiveDate:'',reviewDate:'',description:'Κριτήρια και μέτρα προφύλαξης για ασθενείς με MDR/XDR παθογόνα.',
    attachments:[],createdAt:'2026-08-20T08:15:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-08-28T11:00:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[
      {at:'2026-08-20T08:15:00.000Z',actor:'Διαχειριστής Demo',action:'Δημιουργία εγγράφου',reason:'Αρχική έκδοση'},
      {at:'2026-08-28T11:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:draft->review',reason:'DOC-003 · 1.0'}
    ]
  },
  {
    id:'DOC-004',title:'Οδηγία Φροντίδας Κεντρικού Φλεβικού Καθετήρα',type:'instruction',department:'ΜΕΘ',
    audience:'department',status:'approved',version:'1.0',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'2026-09-15',reviewDate:'2027-09-15',description:'Δέσμη μέτρων εισαγωγής και συντήρησης για πρόληψη CLABSI.',
    attachments:[],approvedAt:'2026-09-05T13:45:00.000Z',approvedBy:'Διαχειριστής Demo',
    createdAt:'2026-08-25T09:00:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-09-05T13:45:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[
      {at:'2026-08-25T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'Δημιουργία εγγράφου',reason:'Αρχική έκδοση'},
      {at:'2026-08-29T10:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:draft->review',reason:'DOC-004 · 1.0'},
      {at:'2026-09-05T13:45:00.000Z',actor:'Διαχειριστής Demo',action:'status:review->approved',reason:'DOC-004 · 1.0'}
    ]
  },
  {
    id:'DOC-005',title:'Πολιτική Διαχείρισης Βιολογικών Αποβλήτων',type:'policy',department:'Όλο το νοσοκομείο',
    audience:'all',status:'superseded',version:'1.0',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'2025-03-01',reviewDate:'2026-03-01',description:'Αρχική πολιτική διαχείρισης βιολογικών/μολυσματικών αποβλήτων.',
    attachments:[],publishedAt:'2025-03-01T09:00:00.000Z',publishedBy:'Διαχειριστής Demo',supersededById:'DOC-006',
    createdAt:'2025-02-10T09:00:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-03-10T09:00:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[
      {at:'2025-02-10T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'Δημιουργία εγγράφου',reason:'Αρχική έκδοση'},
      {at:'2025-03-01T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:approved->published',reason:'DOC-005 · 1.0'},
      {at:'2026-03-10T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:published->superseded',reason:'Αντικαταστάθηκε από DOC-006 · 1.1'}
    ]
  },
  {
    id:'DOC-006',title:'Πολιτική Διαχείρισης Βιολογικών Αποβλήτων',type:'policy',department:'Όλο το νοσοκομείο',
    audience:'all',status:'published',version:'1.1',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'2026-03-10',reviewDate:'2027-03-10',description:'Ενημερωμένη πολιτική με νέες κατηγορίες διαχωρισμού αποβλήτων.',
    attachments:[],revisionOfId:'DOC-005',supersedesId:'DOC-005',revisionReason:'Ευθυγράμμιση με νέο ΕΟΔΥ πρωτόκολλο διαχωρισμού αποβλήτων.',
    approvedAt:'2026-03-08T10:00:00.000Z',approvedBy:'Διαχειριστής Demo',publishedAt:'2026-03-10T09:00:00.000Z',publishedBy:'Διαχειριστής Demo',
    createdAt:'2026-02-20T09:00:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-03-10T09:00:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[
      {at:'2026-02-20T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'Δημιουργία νέας έκδοσης',reason:'Από DOC-005 · 1.0 → 1.1'},
      {at:'2026-03-08T10:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:review->approved',reason:'DOC-006 · 1.1'},
      {at:'2026-03-10T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:approved->published',reason:'DOC-006 · 1.1'}
    ]
  },
  {
    id:'DOC-007',title:'Οδηγία Χρήσης Προσωπικού Προστατευτικού Εξοπλισμού (παλαιά έκδοση)',type:'instruction',department:'Όλο το νοσοκομείο',
    audience:'all',status:'archived',version:'1.0',owner:'Τμήμα Πρόληψης & Ελέγχου Λοιμώξεων',
    effectiveDate:'2024-05-01',reviewDate:'2025-05-01',description:'Αποσυρμένη οδηγία ΜΑΠ, διατηρείται για ιστορικούς/ελεγκτικούς λόγους.',
    attachments:[],publishedAt:'2024-05-01T09:00:00.000Z',publishedBy:'Διαχειριστής Demo',
    createdAt:'2024-04-10T09:00:00.000Z',createdBy:'Διαχειριστής Demo',updatedAt:'2026-05-01T09:00:00.000Z',updatedBy:'Διαχειριστής Demo',
    history:[
      {at:'2024-05-01T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:approved->published',reason:'DOC-007 · 1.0'},
      {at:'2026-05-01T09:00:00.000Z',actor:'Διαχειριστής Demo',action:'status:published->archived',reason:'Αντικαταστάθηκε από νεότερες οδηγίες ΕΟΔΥ'}
    ]
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
