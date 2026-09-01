import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
export const trainerFeedbackTemplate=[
 {id:'clarity',label:'Σαφήνεια παρουσίασης'},
 {id:'knowledge',label:'Γνώση και επάρκεια εκπαιδευτή'},
 {id:'usefulness',label:'Χρησιμότητα για την εργασία μου'},
 {id:'organization',label:'Οργάνωση της εκπαίδευσης'},
 {id:'materials',label:'Ποιότητα εκπαιδευτικού υλικού'},
]

export const trainingDemoState={
 programs:[
  {id:'TRN-001',title:'Υγιεινή Χεριών – WHO 5 Moments',category:'IPC',method:'Μικτή',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Δρ. Ελένη Κωνσταντίνου',audience:'Κλινικό προσωπικό',startDate:'2026-09-05',dueDate:'2026-09-30',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Ετήσια εκπαίδευση και επιβεβαίωση γνώσεων στην υγιεινή χεριών.',materials:[{id:'MAT-001',title:'WHO 5 Moments – συνοπτικός οδηγός',type:'PDF',url:''},{id:'MAT-002',title:'Παρουσίαση εκπαίδευσης',type:'Παρουσίαση',url:''}],assessmentQuestions:[{id:'Q-001',text:'Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;',type:'multiple',options:['Μόνο όταν υπάρχουν γάντια','Πριν από κάθε άσηπτη πράξη','Μόνο μετά την επαφή με τον ασθενή'],correctIndex:1,points:1},{id:'Q-002',text:'Τα γάντια αντικαθιστούν την υγιεινή χεριών.',type:'boolean',options:['Σωστό','Λάθος'],correctIndex:1,points:1}],feedbackResponses:[{employeeId:'EMP-002',scores:{clarity:5,knowledge:5,usefulness:4,organization:5,materials:4},comment:'Πολύ πρακτική παρουσίαση.'}]},
  {id:'TRN-002',title:'Ορθή χρήση ΜΑΠ & απομόνωση',category:'IPC',method:'Δια ζώσης',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Ν. Παπαδόπουλος',audience:'ΜΕΘ · Παθολογική · ΤΕΠ',startDate:'2026-08-20',dueDate:'2026-09-10',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Πρακτική εκπαίδευση σε επιλογή, εφαρμογή και αφαίρεση ΜΑΠ και isolation precautions.',materials:[],assessmentQuestions:[],feedbackResponses:[]},
  {id:'TRN-003',title:'Ασφαλής διαχείριση αιχμηρών',category:'Ασφάλεια',method:'e-learning',owner:'Ποιότητα & Ασφάλεια',trainer:'Τμήμα Ποιότητας',audience:'Όλο το προσωπικό',startDate:'2026-06-01',dueDate:'2026-06-30',validMonths:24,requiresAssessment:true,passScore:75,status:'completed',description:'Πρόληψη τραυματισμών και σωστή αναφορά έκθεσης.',materials:[],assessmentQuestions:[],feedbackResponses:[]},
 ],
 assignments:[
  {id:'TRA-001',programId:'TRN-001',employeeId:'EMP-001',employeeName:'Μαρία Παπαδοπούλου',department:'ΜΕΘ',email:'m.papadopoulou@example.org',accountLinked:true,assignedDate:'2026-08-25',dueDate:'2026-09-30',status:'assigned',invitationSentAt:null,attendanceResponse:'not_sent',attendance:null,attendanceConfirmedAt:null,completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null},
  {id:'TRA-002',programId:'TRN-001',employeeId:'EMP-002',employeeName:'Νικόλαος Δημητρίου',department:'Παθολογική',email:'n.dimitriou@example.org',accountLinked:true,assignedDate:'2026-08-25',dueDate:'2026-09-30',status:'completed',invitationSentAt:'2026-08-25T09:10:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-08-27T08:58:00Z',completionConfirmedAt:'2026-08-27T10:20:00Z',feedbackSubmittedAt:'2026-08-27T10:22:00Z',assessmentSubmittedAt:'2026-08-27T10:25:00Z',score:92,completedDate:'2026-08-27',competent:true,certificateId:'CERT-TR-002'},
  {id:'TRA-003',programId:'TRN-002',employeeId:'EMP-003',employeeName:'Ελένη Κωνσταντίνου',department:'Χειρουργική',email:'e.konstantinou@example.org',accountLinked:true,assignedDate:'2026-08-20',dueDate:'2026-09-10',status:'in_progress',invitationSentAt:'2026-08-20T11:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-08-27T09:02:00Z',completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null},
  {id:'TRA-004',programId:'TRN-003',employeeId:'EMP-001',employeeName:'Μαρία Παπαδοπούλου',department:'ΜΕΘ',email:'m.papadopoulou@example.org',accountLinked:true,assignedDate:'2026-06-01',dueDate:'2026-06-30',status:'completed',invitationSentAt:'2026-06-01T08:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-06-18T09:00:00Z',completionConfirmedAt:'2026-06-18T10:40:00Z',feedbackSubmittedAt:'2026-06-18T10:42:00Z',assessmentSubmittedAt:'2026-06-18T10:45:00Z',score:88,completedDate:'2026-06-18',competent:true,certificateId:'CERT-TR-004'},
 ],
 certificates:[
  {id:'CERT-TR-002',assignmentId:'TRA-002',employeeId:'EMP-002',title:'Υγιεινή Χεριών – WHO 5 Moments',issuedDate:'2026-08-27',validUntil:'2027-08-27',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-004',assignmentId:'TRA-004',employeeId:'EMP-001',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-18',validUntil:'2028-06-18',issuer:'Limoxis Observer · Demo Hospital'},
 ],
 emailOutbox:[],
 history:[{at:'2026-08-25T09:00:00Z',actor:'Demo Hospital Admin',action:'Δημιουργήθηκε ετήσιος κύκλος εκπαίδευσης Υγιεινής Χεριών'}]
}

function withoutKeys(value,keys){
 const clean={...value}
 for(const key of keys)delete clean[key]
 return clean
}
function normalize(state){
 const source=state&&typeof state==='object'?state:structuredClone(trainingDemoState)
 return {
  ...source,
  programs:(source.programs||[]).map(p=>{const clean=withoutKeys(p,['checkInToken','completionToken']);return {...clean,trainer:clean.trainer||clean.owner||'',materials:clean.materials||[],assessmentQuestions:clean.assessmentQuestions||[],feedbackResponses:clean.feedbackResponses||[]}}),
  assignments:(source.assignments||[]).map(a=>{const clean=withoutKeys(a,['checkInAt']);return {...clean,email:clean.email||'',accountLinked:clean.accountLinked!==false,invitationSentAt:clean.invitationSentAt||null,attendanceResponse:clean.attendanceResponse||(clean.attendance?'confirmed':'not_sent'),attendanceConfirmedAt:clean.attendanceConfirmedAt||null,completionConfirmedAt:clean.completionConfirmedAt||null,feedbackSubmittedAt:clean.feedbackSubmittedAt||null,assessmentSubmittedAt:clean.assessmentSubmittedAt||null}}),
  certificates:source.certificates||[],emailOutbox:source.emailOutbox||[],history:source.history||[]
 }
}
export function loadTrainingState(){return normalize(loadSnapshot('training_records',structuredClone(trainingDemoState)))}
export function saveTrainingState(state){const normalized=normalize(state);saveSnapshot('training_records',normalized);return normalized}
export function resetTrainingState(){const next=structuredClone(trainingDemoState);saveSnapshot('training_records',next);return next}
export function computedAssignmentStatus(row,today=new Date()){
 if(row.status==='completed')return 'completed'
 if(row.status==='cancelled')return 'cancelled'
 if(row.dueDate&&new Date(`${row.dueDate}T23:59:59`)<today)return 'overdue'
 return row.status||'assigned'
}
export function validityUntil(completedDate,months){
 if(!completedDate||!months)return ''
 const d=new Date(`${completedDate}T12:00:00`);d.setMonth(d.getMonth()+Number(months));return d.toISOString().slice(0,10)
}
