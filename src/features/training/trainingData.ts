import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { DEMO_HISTORY_MONTHS, addDays, dayInMonth, seededRandom } from '../../core/data/demoSeed'
import { employeeRows } from '../employees/employeeDemoData'
import type { AssessmentQuestion, TrainingAssignment, TrainingCertificate, TrainingHistoryEntry, TrainingProgram, TrainingRequirement } from './trainingTypes'

// The training module's records: programmes, assignments (one per person), certificates,
// role requirements, the demo e-mail outbox and the history. Each record is an untyped row.
// The whole Training state: the register's records, and the Demo's sent e-mails (empty in production).
export interface TrainingState { programs: TrainingProgram[], assignments: TrainingAssignment[], certificates: TrainingCertificate[], requirements: TrainingRequirement[], emailOutbox: Record<string, unknown>[], history: TrainingHistoryEntry[], [key: string]: unknown }
type Question = AssessmentQuestion
// A state as the browser stored it (perhaps by an older version): loose records, normalized below.
type StoredRecord = Record<string, unknown>
type StoredState = { [key: string]: unknown, programs?: StoredRecord[], assignments?: StoredRecord[], certificates?: unknown[], emailOutbox?: unknown[], history?: unknown[] }
export const trainerFeedbackTemplate=[
 {id:'clarity',label:'Σαφήνεια παρουσίασης'},
 {id:'knowledge',label:'Γνώση και επάρκεια εκπαιδευτή'},
 {id:'usefulness',label:'Χρησιμότητα για την εργασία μου'},
 {id:'organization',label:'Οργάνωση της εκπαίδευσης'},
 {id:'materials',label:'Ποιότητα εκπαιδευτικού υλικού'},
]


// Demo knowledge-assessment questions (same schema as the question editor).
const opts=(id: string,texts: string[],correct: number|number[])=>texts.map((text,i)=>({id:`${id}-O${i+1}`,text,correct:([] as number[]).concat(correct).includes(i)}))
const sc=(id: string,text: string,texts: string[],correct: number|number[],points: number)=>({id,type:'single_choice',text,points,required:true,options:opts(id,texts,correct),correctBoolean:true,modelAnswer:'',manualReview:false})
const mc=(id: string,text: string,texts: string[],correct: number|number[],points: number)=>({...sc(id,text,texts,correct,points),type:'multiple_choice'})
const tf=(id: string,text: string,correctBoolean: boolean,points: number)=>({id,type:'true_false',text,points,required:true,options:[],correctBoolean,modelAnswer:'',manualReview:false})
const ft=(id: string,text: string,modelAnswer: string)=>({id,type:'free_text',text,points:0,required:false,options:[],correctBoolean:true,modelAnswer,manualReview:false})
const DEMO_QUESTIONS: Record<string, Question[]>={
 'TRN-001':[
  sc('Q-001','Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;',['Μόνο όταν δεν φοράμε γάντια','Αμέσως πριν από κάθε άσηπτη πράξη','Μόνο μετά την επαφή με τον ασθενή','Μία φορά στην αρχή της βάρδιας'],1,5),
  tf('Q-002','Τα γάντια αντικαθιστούν την υγιεινή χεριών.',false,5),
  mc('Q-003','Ποιες από τις παρακάτω είναι «στιγμές» του WHO για την υγιεινή χεριών;',['Πριν από την επαφή με τον ασθενή','Μετά από έκθεση σε βιολογικά υγρά','Πριν από την είσοδο στο γραφείο προσωπικού','Μετά την επαφή με το περιβάλλον του ασθενούς'],[0,1,3],5),
  sc('Q-004','Πόσο διαρκεί η σωστή εντριβή με αλκοολούχο αντισηπτικό;',['5–10 δευτερόλεπτα','20–30 δευτερόλεπτα','40–60 δευτερόλεπτα','2 λεπτά'],1,5),
  tf('Q-005','Σε λοίμωξη από Clostridioides difficile προτιμάται πλύσιμο με νερό και σαπούνι.',true,3),
  sc('Q-006','Πόσο διαρκεί το πλύσιμο χεριών με νερό και σαπούνι;',['10–15 δευτερόλεπτα','20–30 δευτερόλεπτα','40–60 δευτερόλεπτα','3 λεπτά'],2,2),
  ft('Q-007','Περιγράψτε σε μία πρόταση πότε αλλάζετε γάντια στον ίδιο ασθενή.','Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς.'),
 ],
 'TRN-002':[
  sc('Q-101','Ποια είναι η σωστή σειρά ένδυσης ΜΑΠ;',['Γάντια → ποδιά → μάσκα → γυαλιά','Ποδιά → μάσκα → γυαλιά → γάντια','Μάσκα → γάντια → ποδιά → γυαλιά','Γυαλιά → γάντια → μάσκα → ποδιά'],1,3),
  tf('Q-102','Η μάσκα FFP2 απαιτείται σε διαδικασίες που παράγουν αερολύματα.',true,2),
  mc('Q-103','Ποιοι μικροοργανισμοί απαιτούν προφυλάξεις επαφής;',['CPE / KPC','MRSA','Mycobacterium tuberculosis','Clostridioides difficile'],[0,1,3],3),
  tf('Q-104','Τα γάντια αφαιρούνται τελευταία, μετά τη μάσκα.',false,2),
  ft('Q-105','Αναφέρετε ένα σημείο προσοχής κατά την αφαίρεση της ποδιάς.','Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή.'),
 ],
 'TRN-004':[
  sc('Q-201','Ποιο αντισηπτικό προτιμάται για την προετοιμασία του δέρματος πριν από τοποθέτηση CVC;',['Ποβιδόνη ιωδίνη 10%','Χλωρεξιδίνη > 0,5% σε αλκοόλη','Αλκοόλη 70% μόνη','Φυσιολογικός ορός'],1,2),
  mc('Q-202','Ποια στοιχεία περιλαμβάνει η δέσμη τοποθέτησης CVC;',['Υγιεινή χεριών','Πλήρη μέτρα άσηπτης τεχνικής (maximal barrier)','Αποφυγή μηριαίας φλέβας σε ενήλικες','Προφυλακτική χορήγηση αντιβιοτικού'],[0,1,2],3),
  tf('Q-203','Η ανάγκη διατήρησης της κεντρικής γραμμής επανεκτιμάται καθημερινά.',true,1),
  sc('Q-204','Κάθε πότε αλλάζει ένα διαφανές επίθεμα CVC, εφόσον είναι ακέραιο;',['Κάθε 24 ώρες','Κάθε 48 ώρες','Κάθε 7 ημέρες','Μόνο κατά την αφαίρεση'],2,2),
  tf('Q-205','Τα σημεία πρόσβασης (hubs) δεν χρειάζονται απολύμανση όταν χρησιμοποιούνται συχνά.',false,1),
  sc('Q-206','Ποιος δείκτης μετρά τη συχνότητα CLABSI;',['Επεισόδια ανά 100 εισαγωγές','Επεισόδια ανά 1.000 ημέρες κεντρικής γραμμής','Επεισόδια ανά κλίνη','Επεισόδια ανά μήνα'],1,1),
  ft('Q-207','Τι κάνετε αν το επίθεμα είναι υγρό ή αποκολλημένο;','Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή.'),
 ],
 'TRN-003':[
  sc('Q-301','Τι κάνετε αμέσως μετά από τρύπημα με χρησιμοποιημένη βελόνα;',['Πιέζω για να σταματήσει η αιμορραγία','Πλένω με νερό και σαπούνι και ενημερώνω αμέσως','Εφαρμόζω χλωρίνη στο τραύμα','Συνεχίζω και το αναφέρω στο τέλος της βάρδιας'],1,5),
  tf('Q-302','Η επανατοποθέτηση του καλύμματος στη βελόνα με δύο χέρια επιτρέπεται.',false,5),
  sc('Q-303','Μέχρι πού γεμίζει ο περιέκτης αιχμηρών;',['Μέχρι επάνω','Έως τα 3/4 ή τη γραμμή πλήρωσης','Μέχρι τη μέση','Δεν υπάρχει όριο'],1,5),
  mc('Q-304','Ποια μέτρα μειώνουν τους τραυματισμούς από αιχμηρά;',['Συσκευές ασφαλείας','Περιέκτης στο σημείο χρήσης','Μεταφορά βελονών στο χέρι','Εκπαίδευση προσωπικού'],[0,1,3],5),
  tf('Q-305','Κάθε έκθεση σε αίμα καταγράφεται ως περιστατικό έκθεσης στο Ιατρείο Εργασίας.',true,2),
  sc('Q-306','Εντός πόσου χρόνου ξεκινά ιδανικά η προφύλαξη μετά από έκθεση στον HIV;',['Εντός 2 ωρών','Εντός 72 ωρών — ιδανικά στις 2 πρώτες ώρες','Εντός 1 εβδομάδας','Δεν απαιτείται προφύλαξη'],1,3),
  ft('Q-307','Ποιον ενημερώνετε μετά από έκθεση;','Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού.'),
 ],
}
// Answers matching each demo score: every question correct except the listed ones.
const answer=(q: Question)=>q.type==='single_choice'?q.options.find(o=>o.correct)!.id:q.type==='multiple_choice'?q.options.filter(o=>o.correct).map(o=>o.id):q.type==='true_false'?q.correctBoolean:q.modelAnswer
const wrong=(q: Question)=>q.type==='single_choice'?q.options.find(o=>!o.correct)!.id:q.type==='true_false'?!q.correctBoolean:[q.options[0].id]
const demoAnswers=(programId: string,wrongIds: string[]=[])=>Object.fromEntries(DEMO_QUESTIONS[programId].map(q=>[q.id,wrongIds.includes(q.id)?wrong(q):answer(q)]))
// A completed demo attempt whose score follows from its answers.
function completedAttempt(programId: string,wrongIds: string[],passScore: number){const questions=DEMO_QUESTIONS[programId];const max=questions.reduce((n,q)=>n+(q.type==='free_text'?0:q.points),0);const lost=questions.filter(q=>wrongIds.includes(q.id)).reduce((n,q)=>n+q.points,0);const score=Math.round(100*(max-lost)/max);return {assessmentAnswers:demoAnswers(programId,wrongIds),score,competent:score>=passScore}}
const done=(id: string,programId: string,employeeId: string,employeeName: string,department: string,email: string,day: string,wrongIds: string[],passScore: number,feedbackScores: Record<string, number>,feedbackComment: string,certificateId: string): TrainingAssignment=>{const attempt=completedAttempt(programId,wrongIds,passScore);return {id,programId,employeeId,employeeName,department,email,accountLinked:true,assignedDate:'2026-06-01',dueDate:'2026-06-30',status:'completed',invitationSentAt:'2026-06-01T08:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:`${day}T09:00:00Z`,completionConfirmedAt:`${day}T10:40:00Z`,feedbackSubmittedAt:`${day}T10:42:00Z`,assessmentSubmittedAt:`${day}T10:45:00Z`,...attempt,feedbackScores,feedbackComment,assessmentReviewedAt:null,completedDate:day,certificateId:attempt.competent?certificateId:null}}

export const trainingDemoState: TrainingState={
 programs:[
  {id:'TRN-001',title:'Υγιεινή Χεριών – 5 Στιγμές του ΠΟΥ',category:'ipc',method:'hybrid',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Δρ. Ελένη Κωνσταντίνου',audience:'Κλινικό προσωπικό',startDate:'2026-09-05',dueDate:'2026-09-30',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Ετήσια εκπαίδευση και επιβεβαίωση γνώσεων στην υγιεινή χεριών.',materials:[{id:'MAT-001',title:'5 Στιγμές του ΠΟΥ – συνοπτικός οδηγός',type:'PDF',url:''},{id:'MAT-002',title:'Παρουσίαση εκπαίδευσης',type:'Παρουσίαση',url:''}],assessmentQuestions:DEMO_QUESTIONS['TRN-001'],feedbackResponses:[{employeeId:'EMP-002',scores:{clarity:5,knowledge:5,usefulness:4,organization:5,materials:4},comment:'Πολύ πρακτική παρουσίαση.'}]},
  {id:'TRN-002',title:'Ορθή χρήση ΜΑΠ & απομόνωση',category:'ipc',method:'in_person',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Ν. Παπαδόπουλος',audience:'ΜΕΘ · Παθολογική · ΤΕΠ',startDate:'2026-08-20',dueDate:'2026-09-10',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Πρακτική εκπαίδευση σε επιλογή, εφαρμογή και αφαίρεση ΜΑΠ και μέτρων απομόνωσης.',materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-002'],feedbackResponses:[]},
  {id:'TRN-004',title:'Πρόληψη CLABSI και φροντίδα κεντρικών γραμμών',category:'ipc',method:'in_person',owner:'ΕΝΛ',trainer:'Ομάδα IPC',audience:'ΜΕΘ · Χειρουργική',startDate:'2026-04-10',dueDate:'2026-04-30',validMonths:12,requiresAssessment:true,passScore:80,status:'completed',description:'Εφαρμογή δέσμης πρόληψης CLABSI και ασφαλής διαχείριση κεντρικών γραμμών.',effectiveness:{plannedDate:'2026-07-30',method:'audit',criterion:'Συμμόρφωση στη δέσμη CLABSI ≥ 90% στη ΜΕΘ',result:'partial',evaluatedAt:'2026-08-05',evaluatedBy:'Ομάδα IPC',notes:'Συμμόρφωση 78%· ελλιπής τεκμηρίωση της ημερήσιας αναγκαιότητας της γραμμής.'},materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-004'],feedbackResponses:[]},
  {id:'TRN-003',title:'Ασφαλής διαχείριση αιχμηρών',category:'occupational_health',method:'online',owner:'Ποιότητα & Ασφάλεια',trainer:'Τμήμα Ποιότητας',audience:'Όλο το προσωπικό',startDate:'2026-06-01',dueDate:'2026-06-30',validMonths:24,requiresAssessment:true,passScore:75,status:'completed',description:'Πρόληψη τραυματισμών και σωστή αναφορά έκθεσης.',effectiveness:{plannedDate:'2026-09-30',method:'indicator',criterion:'Καμία μη αναφερθείσα έκθεση σε αιχμηρά στο τρίμηνο',result:'',evaluatedAt:'',evaluatedBy:'',notes:''},materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-003'],feedbackResponses:[]},
 ],
 assignments:[
  {id:'TRA-001',programId:'TRN-001',employeeId:'EMP-001',employeeName:'Μαρία Παπαδοπούλου',department:'ΜΕΘ',email:'m.papadopoulou@example.org',accountLinked:true,assignedDate:'2026-08-25',dueDate:'2026-09-30',status:'assigned',invitationSentAt:null,attendanceResponse:'not_sent',attendance:null,attendanceConfirmedAt:null,completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null},
  {id:'TRA-002',programId:'TRN-001',employeeId:'EMP-002',employeeName:'Νικόλαος Δημητρίου',department:'Παθολογική',email:'n.dimitriou@example.org',accountLinked:true,assignedDate:'2026-08-25',dueDate:'2026-09-30',status:'completed',invitationSentAt:'2026-08-25T09:10:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-08-27T08:58:00Z',completionConfirmedAt:'2026-08-27T10:20:00Z',feedbackSubmittedAt:'2026-08-27T10:22:00Z',assessmentSubmittedAt:'2026-08-27T10:25:00Z',score:92,completedDate:'2026-08-27',competent:true,assessmentAnswers:demoAnswers('TRN-001',['Q-006']),feedbackScores:{clarity:5,knowledge:5,usefulness:4,organization:5,materials:4},feedbackComment:'Πολύ πρακτική παρουσίαση.',assessmentReviewedAt:null,certificateId:'CERT-TR-002'},
  {id:'TRA-003',programId:'TRN-002',employeeId:'EMP-003',employeeName:'Ελένη Κωνσταντίνου',department:'Χειρουργική',email:'e.konstantinou@example.org',accountLinked:true,assignedDate:'2026-08-20',dueDate:'2026-09-10',status:'in_progress',invitationSentAt:'2026-08-20T11:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-08-27T09:02:00Z',completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null},
  {id:'TRA-005',programId:'TRN-004',employeeId:'EMP-005',employeeName:'Ανδρέας Μάρκου',department:'ΤΕΠ',email:'a.markou@example.org',accountLinked:true,assignedDate:'2026-04-10',dueDate:'2026-04-30',status:'completed',invitationSentAt:'2026-04-10T08:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-04-22T09:00:00Z',completionConfirmedAt:'2026-04-22T11:00:00Z',feedbackSubmittedAt:'2026-04-22T11:05:00Z',assessmentSubmittedAt:'2026-04-22T11:10:00Z',score:90,completedDate:'2026-04-22',competent:true,assessmentAnswers:demoAnswers('TRN-004',['Q-205']),feedbackScores:{clarity:4,knowledge:5,usefulness:5,organization:4,materials:4},feedbackComment:'Χρήσιμη η πρακτική άσκηση στο ομοίωμα.',assessmentReviewedAt:null,certificateId:'CERT-TR-005'},
  {id:'TRA-006',programId:'TRN-001',employeeId:'EMP-006',employeeName:'Σοφία Οικονόμου',department:'Καρδιολογική',email:'s.oikonomou@example.org',accountLinked:true,assignedDate:'2026-08-25',dueDate:'2026-09-30',status:'assigned',invitationSentAt:'2026-08-25T09:20:00Z',attendanceResponse:'not_sent',attendance:null,attendanceConfirmedAt:null,completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null},
  {id:'TRA-004',programId:'TRN-003',employeeId:'EMP-001',employeeName:'Μαρία Παπαδοπούλου',department:'ΜΕΘ',email:'m.papadopoulou@example.org',accountLinked:true,assignedDate:'2026-06-01',dueDate:'2026-06-30',status:'completed',invitationSentAt:'2026-06-01T08:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:'2026-06-18T09:00:00Z',completionConfirmedAt:'2026-06-18T10:40:00Z',feedbackSubmittedAt:'2026-06-18T10:42:00Z',assessmentSubmittedAt:'2026-06-18T10:45:00Z',score:88,completedDate:'2026-06-18',competent:true,assessmentAnswers:demoAnswers('TRN-003',['Q-306']),feedbackScores:{clarity:4,knowledge:4,usefulness:5,organization:4,materials:3},feedbackComment:'Θα βοηθούσε ένα σύντομο βίντεο για την αναφορά έκθεσης.',assessmentReviewedAt:null,certificateId:'CERT-TR-004'},
  done('TRA-007','TRN-003','EMP-002','Νικόλαος Δημητρίου','Παθολογική','n.dimitriou@example.org','2026-06-12',[],75,{clarity:5,knowledge:5,usefulness:5,organization:4,materials:4},'Σαφείς οδηγίες για την αναφορά έκθεσης.','CERT-TR-007'),
  done('TRA-008','TRN-003','EMP-007','Χρήστος Βασιλείου','Αποστείρωση','c.vasileiou@example.org','2026-06-20',['Q-301','Q-304','Q-306'],75,{clarity:3,knowledge:4,usefulness:4,organization:3,materials:3},'Χρειάζομαι περισσότερη εξάσκηση στη διαδικασία μετά από έκθεση.','CERT-TR-008'),
  done('TRA-009','TRN-003','EMP-008','Δήμητρα Σταθάτου','Ποιότητα','d.stathatou@example.org','2026-06-09',['Q-305'],75,{clarity:5,knowledge:5,usefulness:4,organization:5,materials:5},'Πολύ καλά οργανωμένο e-learning.','CERT-TR-009'),
  done('TRA-010','TRN-003','EMP-006','Σοφία Οικονόμου','Καρδιολογική','s.oikonomou@example.org','2026-06-16',['Q-302'],75,{clarity:4,knowledge:4,usefulness:5,organization:4,materials:4},'','CERT-TR-010'),
 ],
 certificates:[
  {id:'CERT-TR-002',assignmentId:'TRA-002',employeeId:'EMP-002',title:'Υγιεινή Χεριών – 5 Στιγμές του ΠΟΥ',issuedDate:'2026-08-27',validUntil:'2027-08-27',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-005',assignmentId:'TRA-005',employeeId:'EMP-005',title:'Πρόληψη CLABSI και φροντίδα κεντρικών γραμμών',issuedDate:'2026-04-22',validUntil:'2027-04-22',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-004',assignmentId:'TRA-004',employeeId:'EMP-001',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-18',validUntil:'2028-06-18',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-007',assignmentId:'TRA-007',employeeId:'EMP-002',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-12',validUntil:'2028-06-12',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-010',assignmentId:'TRA-010',employeeId:'EMP-006',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-16',validUntil:'2028-06-16',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-009',assignmentId:'TRA-009',employeeId:'EMP-008',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-09',validUntil:'2028-06-09',issuer:'Limoxis Observer · Demo Hospital'},
 ],
 requirements:[
  {id:'REQ-HH',title:'Υγιεινή Χεριών – 5 Στιγμές του ΠΟΥ',programIds:['TRN-001'],professions:['Ιατρικό προσωπικό','Νοσηλευτικό προσωπικό'],departments:[],renewalMonths:12,active:true},
  {id:'REQ-SHARPS',title:'Ασφαλής διαχείριση αιχμηρών',programIds:['TRN-003'],professions:[],departments:[],renewalMonths:24,active:true},
  {id:'REQ-PPE',title:'Ορθή χρήση ΜΑΠ & απομόνωση',programIds:['TRN-002'],professions:[],positions:['Νοσηλευτής/τρια ΜΕΘ','Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων (ΝΕΛ)'],departments:[],renewalMonths:12,active:true},
  {id:'REQ-CLABSI',title:'Πρόληψη CLABSI',programIds:['TRN-004'],professions:['Νοσηλευτικό προσωπικό'],departments:['ΜΕΘ','Χειρουργική'],renewalMonths:12,active:true},
 ],
 emailOutbox:[],
 history:[{at:'2026-08-25T09:00:00Z',actor:'Demo Hospital Admin',action:'Δημιουργήθηκε ετήσιος κύκλος εκπαίδευσης Υγιεινής Χεριών'}]
}

// Older demo attempts have already been reviewed by the training owner.
for(const a of trainingDemoState.assignments)if(['TRA-004','TRA-005','TRA-007','TRA-009'].includes(a.id)){a.assessmentReviewedAt=`${a.completedDate}T14:00:00Z`;a.assessmentReviewedBy='Ελένη Κωνσταντίνου';a.assessmentReviewAcknowledged=true}

// The past year's programmes (authored 2025-09 … 2026-02), assigned to the
// clinical staff of the wards they target: mostly completed, a few failed
// assessments and a few still overdue.
DEMO_QUESTIONS['TRN-005']=DEMO_QUESTIONS['TRN-001']
DEMO_QUESTIONS['TRN-006']=DEMO_QUESTIONS['TRN-002']
DEMO_QUESTIONS['TRN-007']=[
 sc('Q-401','Ποια είναι ένδειξη για τοποθέτηση ουροκαθετήρα;',['Ακράτεια χωρίς άλλη ένδειξη','Οξεία κατακράτηση ούρων ή απόφραξη','Διευκόλυνση της νοσηλείας','Λήψη δείγματος ούρων'],1,3),
 tf('Q-402','Ο ουροσυλλέκτης τοποθετείται πάντα κάτω από το επίπεδο της κύστης.',true,2),
 mc('Q-403','Ποια μέτρα μειώνουν τον κίνδυνο CAUTI;',['Καθημερινή επανεκτίμηση ανάγκης','Κλειστό σύστημα παροχέτευσης','Τακτικές πλύσεις κύστης','Άσηπτη τεχνική τοποθέτησης'],[0,1,3],3),
 tf('Q-404','Η τακτική αλλαγή ουροκαθετήρα κάθε 3 ημέρες προλαμβάνει τη CAUTI.',false,2),
 sc('Q-405','Ποιος δείκτης μετρά τη συχνότητα CAUTI;',['Επεισόδια ανά 100 εισαγωγές','Επεισόδια ανά 1.000 ημέρες ουροκαθετήρα','Επεισόδια ανά κλίνη','Επεισόδια ανά μήνα'],1,2),
 ft('Q-406','Πότε αφαιρείτε τον ουροκαθετήρα;','Μόλις δεν υπάρχει πλέον ένδειξη, μετά την καθημερινή επανεκτίμηση.'),
]
const pastProgram=(id: string,title: string,audience: string,startDate: string,dueDate: string,method: string,trainer: string,description: string)=>({id,title,category:'ipc',method,owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer,audience,startDate,dueDate,validMonths:12,requiresAssessment:true,passScore:80,status:'completed',description,materials:[],assessmentQuestions:DEMO_QUESTIONS[id],feedbackResponses:[]})
trainingDemoState.programs.push(
 pastProgram('TRN-005','Υγιεινή Χεριών – ετήσιος κύκλος 2025','Κλινικό προσωπικό','2025-09-08','2025-10-31','hybrid','Δρ. Ελένη Κωνσταντίνου','Ετήσια εκπαίδευση υγιεινής χεριών του προηγούμενου κύκλου.'),
 pastProgram('TRN-006','Προφυλάξεις επαφής για πολυανθεκτικούς μικροοργανισμούς','ΜΕΘ · Παθολογική · ΤΕΠ · Καρδιολογική','2025-11-10','2025-12-15','in_person','Ν. Παπαδόπουλος','Μέτρα απομόνωσης για KPC, MRSA, VRE και C. difficile.'),
 pastProgram('TRN-007','Πρόληψη CAUTI','Νοσηλευτικό προσωπικό ΜΕΘ · Παθολογικής · Χειρουργικής · Ορθοπαιδικής','2026-01-12','2026-02-20','in_person','Ομάδα IPC','Ένδειξη, τοποθέτηση, φροντίδα και έγκαιρη αφαίρεση ουροκαθετήρα.'),
)
const PAST_PLAN: [string,string[]|null,string|null,string,string,string,number][]=[
 ['TRN-005',['ΜΕΘ','Παθολογική','Χειρουργική','ΤΕΠ','Καρδιολογική','Νεογνολογική / ΜΕΝΝ','Ορθοπαιδική'],null,'2025-09-08','2025-10-31','2025-09-15',40],
 ['TRN-006',['ΜΕΘ','Παθολογική','ΤΕΠ','Καρδιολογική'],null,'2025-11-10','2025-12-15','2025-11-17',30],
 ['TRN-007',['ΜΕΘ','Παθολογική','Χειρουργική','Ορθοπαιδική'],'Νοσηλευτικό προσωπικό','2026-01-12','2026-02-20','2026-01-19',35],
]
// The whole of 2025 and 2026 (owner, 9/11/2026): earlier programmes from January 2025 on,
// placed by the authored history months so that they keep their month as the Demo moves on.
DEMO_QUESTIONS['TRN-008']=DEMO_QUESTIONS['TRN-004']
DEMO_QUESTIONS['TRN-010']=DEMO_QUESTIONS['TRN-003']
DEMO_QUESTIONS['TRN-014']=DEMO_QUESTIONS['TRN-002']
DEMO_QUESTIONS['TRN-009']=[
 sc('Q-501','Πότε επανεκτιμάται η εμπειρική αντιμικροβιακή αγωγή;',['Στο τέλος της θεραπείας','Στις 48–72 ώρες, με τα αποτελέσματα των καλλιεργειών','Μόνο αν ο ασθενής χειροτερεύσει','Κάθε 7 ημέρες'],1,3),
 tf('Q-502','Η περιοχική χειρουργική προφύλαξη συνεχίζεται συνήθως πέραν των 24 ωρών.',false,2),
 mc('Q-503','Ποια μέτρα ανήκουν στο πρόγραμμα ορθολογικής χρήσης αντιμικροβιακών;',['Αποκλιμάκωση με βάση το αντιβιόγραμμα','Καθορισμένη διάρκεια αγωγής','Ευρύ φάσμα σε κάθε πυρετό','Μετάβαση από ενδοφλέβια σε από του στόματος χορήγηση'],[0,1,3],3),
 tf('Q-504','Οι καλλιέργειες λαμβάνονται, όπου είναι δυνατό, πριν από την πρώτη δόση αντιβιοτικού.',true,2),
 sc('Q-505','Ποιος δείκτης μετρά την κατανάλωση αντιβιοτικών;',['Συνταγές ανά μήνα','DDD ανά 100 ημέρες νοσηλείας','Κουτιά ανά κλινική','Κόστος ανά κλίνη'],1,2),
 ft('Q-506','Τι κάνετε όταν το αντιβιόγραμμα δείχνει ευαισθησία σε στενότερου φάσματος αντιβιοτικό;','Αποκλιμακώνω στο στενότερου φάσματος σκεύασμα και καταγράφω την αιτιολόγηση.'),
]
DEMO_QUESTIONS['TRN-011']=[
 sc('Q-601','Πότε χορηγείται η χειρουργική προφύλαξη;',['Την προηγούμενη ημέρα','Εντός 60 λεπτών πριν από την τομή','Μετά τη συρραφή','Μόνο αν υπάρξει πυρετός'],1,3),
 tf('Q-602','Η αφαίρεση τριχών γίνεται με ξυράφι το πρωί της επέμβασης.',false,2),
 mc('Q-603','Ποια μέτρα μειώνουν τον κίνδυνο λοίμωξης χειρουργικού πεδίου;',['Αντισηψία δέρματος με αλκοολούχο χλωρεξιδίνη','Διατήρηση νορμοθερμίας','Συχνό άνοιγμα των θυρών της αίθουσας','Γλυκαιμικός έλεγχος'],[0,1,3],3),
 tf('Q-604','Το τραύμα καλύπτεται με αποστειρωμένο επίθεμα για 24–48 ώρες μετά την επέμβαση.',true,2),
 sc('Q-605','Πόσο διάστημα παρακολουθείται μια επέμβαση με εμφύτευμα για λοίμωξη;',['7 ημέρες','30 ημέρες','90 ημέρες','Όσο νοσηλεύεται ο ασθενής'],2,2),
 ft('Q-606','Τι καταγράφετε όταν ένα τραύμα έχει πυώδες έκκριμα;','Λαμβάνω καλλιέργεια, ενημερώνω τον θεράποντα και την Ομάδα Πρόληψης Λοιμώξεων και καταγράφω το εύρημα.'),
]
DEMO_QUESTIONS['TRN-012']=[
 sc('Q-701','Με ποια σειρά καθαρίζεται ο θάλαμος;',['Από τα πιο βρόμικα προς τα πιο καθαρά','Από τα πιο καθαρά προς τα πιο βρόμικα, από πάνω προς τα κάτω','Με τυχαία σειρά','Πρώτα το δάπεδο'],1,3),
 tf('Q-702','Ο ίδιος σφουγγαρόπανος μπορεί να χρησιμοποιηθεί σε περισσότερους θαλάμους την ίδια βάρδια.',false,2),
 mc('Q-703','Ποιες επιφάνειες θεωρούνται επιφάνειες συχνής επαφής;',['Κάγκελα κρεβατιού','Κουδούνι κλήσης','Οροφή διαδρόμου','Πόμολα θυρών'],[0,1,3],3),
 tf('Q-704','Για τον C. difficile χρησιμοποιείται σποροκτόνο απολυμαντικό.',true,2),
 sc('Q-705','Τι γίνεται κατά τον τελικό καθαρισμό μετά την έξοδο ασθενούς με πολυανθεκτικό;',['Απλό σφουγγάρισμα','Πλήρης καθαρισμός και απολύμανση όλων των επιφανειών και αλλαγή κουρτινών','Μόνο αερισμός','Καθαρισμός μόνο του κρεβατιού'],1,2),
 ft('Q-706','Πώς ελέγχεται η ποιότητα του καθαρισμού;','Με λίστα ελέγχου, οπτικό έλεγχο και μέτρηση ATP ή φθορίζοντες δείκτες.'),
]
DEMO_QUESTIONS['TRN-013']=[
 sc('Q-801','Με πόσα στοιχεία ταυτοποιείται ο ασθενής πριν από κάθε πράξη;',['Ένα (αριθμός θαλάμου)','Τουλάχιστον δύο (ονοματεπώνυμο και ημερομηνία γέννησης)','Μόνο με το βραχιόλι χωρίς ερώτηση','Δεν χρειάζεται για γνωστούς ασθενείς'],1,3),
 tf('Q-802','Ο αριθμός κρεβατιού είναι αποδεκτό στοιχείο ταυτοποίησης.',false,2),
 mc('Q-803','Ποια μέτρα προλαμβάνουν τις πτώσεις;',['Εκτίμηση κινδύνου πτώσης κατά την εισαγωγή','Κουδούνι κλήσης σε απόσταση χεριού','Χαμηλό κρεβάτι με φρένα','Περιορισμός υγρών τη νύχτα'],[0,1,2],3),
 tf('Q-804','Κάθε πτώση ασθενούς δηλώνεται ως ανεπιθύμητο συμβάν, ακόμη και χωρίς βλάβη.',true,2),
 sc('Q-805','Πότε επανεκτιμάται ο κίνδυνος πτώσης;',['Μόνο στην εισαγωγή','Σε κάθε αλλαγή της κατάστασης ή της αγωγής και μετά από πτώση','Μία φορά τον μήνα','Στο εξιτήριο'],1,2),
 ft('Q-806','Τι κάνετε αμέσως μετά από πτώση ασθενούς;','Εκτιμώ τον ασθενή, ενημερώνω τον ιατρό, καταγράφω και δηλώνω το συμβάν.'),
]
const HISTORY_WARDS=['ΜΕΘ','Παθολογική','Χειρουργική','ΤΕΠ','Καρδιολογική','Νεογνολογική / ΜΕΝΝ','Ορθοπαιδική']
const historyStart=(monthIndex: number)=>dayInMonth(DEMO_HISTORY_MONTHS[monthIndex],3)
const HISTORY_PROGRAMS: [string,string,string,string,number,string,string,string,string[]|null,string|null,{validMonths?: number,passScore?: number}][]=[
 ['TRN-008','Πρόληψη CLABSI – κύκλος 2025','ipc','Νοσηλευτικό προσωπικό ΜΕΘ · Χειρουργικής',0,'in_person','Ομάδα IPC','Δέσμη πρόληψης CLABSI και φροντίδα κεντρικών γραμμών, ετήσια επανάληψη.',['ΜΕΘ','Χειρουργική'],'Νοσηλευτικό προσωπικό',{}],
 ['TRN-009','Ορθολογική χρήση αντιμικροβιακών','clinical','Ιατρικό προσωπικό',2,'online','Δρ. Παναγιώτης Ρήγας','Εμπειρική αγωγή, επανεκτίμηση στις 48–72 ώρες, αποκλιμάκωση και διάρκεια θεραπείας.',HISTORY_WARDS,'Ιατρικό προσωπικό',{}],
 ['TRN-010','Ασφαλής διαχείριση αιχμηρών – κύκλος 2025','occupational_health','Όλο το προσωπικό',3,'online','Τμήμα Ποιότητας','Πρόληψη τραυματισμών και σωστή αναφορά έκθεσης.',null,'all',{validMonths:24,passScore:75}],
 ['TRN-011','Πρόληψη λοιμώξεων χειρουργικού πεδίου','ipc','Χειρουργική · Ορθοπαιδική',5,'in_person','Δρ. Στέφανος Καλλέργης','Προεγχειρητική προετοιμασία, χειρουργική προφύλαξη και φροντίδα του τραύματος.',['Χειρουργική','Ορθοπαιδική'],null,{}],
 ['TRN-012','Καθαρισμός και απολύμανση περιβάλλοντος ασθενούς','ipc','Νοσηλευτικό προσωπικό όλων των κλινικών',7,'hybrid','Ν. Παπαδόπουλος','Σειρά καθαρισμού, επιφάνειες συχνής επαφής, τελικός καθαρισμός και έλεγχος ποιότητας.',HISTORY_WARDS,'Νοσηλευτικό προσωπικό',{}],
 ['TRN-014','Ορθή χρήση ΜΑΠ & απομόνωση – κύκλος 2025','ipc','ΜΕΘ · Παθολογική · ΤΕΠ',9,'in_person','Ν. Παπαδόπουλος','Επιλογή, εφαρμογή και αφαίρεση ΜΑΠ και μέτρα απομόνωσης.',['ΜΕΘ','Παθολογική','ΤΕΠ'],null,{}],
 ['TRN-013','Ασφάλεια ασθενών: ταυτοποίηση και πρόληψη πτώσεων','quality','Νοσηλευτικό προσωπικό όλων των κλινικών',DEMO_HISTORY_MONTHS.length-5,'hybrid','Τμήμα Ποιότητας','Ταυτοποίηση με δύο στοιχεία, εκτίμηση κινδύνου πτώσης και δήλωση συμβάντων.',HISTORY_WARDS,'Νοσηλευτικό προσωπικό',{}],
]
for(const [id,title,category,audience,monthIndex,method,trainer,description,departments,profession,{validMonths=12,passScore=80}] of HISTORY_PROGRAMS){
 const startDate=historyStart(monthIndex),dueDate=addDays(startDate,40)
 trainingDemoState.programs.push({...pastProgram(id,title,audience,startDate,dueDate,method,trainer,description),category,owner:category==='ipc'?'Ομάδα Πρόληψης Λοιμώξεων':'Ποιότητα & Ασφάλεια',validMonths,passScore})
 PAST_PLAN.push([id,departments,profession,startDate,dueDate,addDays(startDate,5),30])
}
let pastIndex=0
for(const [programId,departments,profession,assignedDate,dueDate,firstDay,spreadDays] of PAST_PLAN){
 const program=trainingDemoState.programs.find(p=>p.id===programId) as TrainingProgram
 const staff=employeeRows.filter(e=>e.employmentStatus==='active'&&(!departments||departments.includes(e.department))&&(profession==='all'||(profession?e.profession===profession:['Νοσηλευτικό προσωπικό','Ιατρικό προσωπικό'].includes(e.profession)))&&e.hireDate<=assignedDate)
 staff.forEach((e,i)=>{
  pastIndex+=1
  const id=`TRA-${String(100+pastIndex)}`,rand=seededRandom(`training|${id}`),name=`${e.firstName} ${e.lastName}`
  // Two people in the CAUTI programme never finished it.
  if(programId==='TRN-007'&&i%7===3){trainingDemoState.assignments.push({id,programId,employeeId:e.id,employeeName:name,department:e.department,email:e.email,accountLinked:true,assignedDate,dueDate,status:i%2?'in_progress':'assigned',invitationSentAt:`${assignedDate}T08:00:00Z`,attendanceResponse:i%2?'confirmed':'not_sent',attendance:i%2?true:null,attendanceConfirmedAt:null,completionConfirmedAt:null,feedbackSubmittedAt:null,assessmentSubmittedAt:null,score:null,completedDate:null,competent:null,certificateId:null});return}
  const wrongIds=program.assessmentQuestions!.filter(q=>q.type!=='free_text'&&rand()<(i%9===4?0.45:0.12)).map(q=>q.id)
  const day=addDays(firstDay,Math.floor(rand()*spreadDays)),row=done(id,programId,e.id,name,e.department,e.email,day,wrongIds,program.passScore as number,{clarity:4+(i%2),knowledge:5,usefulness:4+((i+1)%2),organization:4,materials:4},'',`CERT-${id}`)
  trainingDemoState.assignments.push({...row,assignedDate,dueDate,invitationSentAt:`${assignedDate}T08:00:00Z`,assessmentReviewedAt:`${day}T14:00:00Z`,assessmentReviewedBy:'Ελένη Κωνσταντίνου',assessmentReviewAcknowledged:true})
  if(row.certificateId)trainingDemoState.certificates.push({id:row.certificateId,assignmentId:id,employeeId:e.id,title:program.title,issuedDate:day,validUntil:addDays(day,Math.round((program.validMonths as number)*30.4375)),issuer:'Limoxis Observer · Demo Hospital'})
 })
}

function withoutKeys(value: StoredRecord,keys: string[]){const clean={...value};for(const key of keys)delete clean[key];return clean}
function normalize(state: unknown): TrainingState{
 const source=(state&&typeof state==='object'?state:structuredClone(trainingDemoState)) as StoredState
 return {...source,programs:(source.programs||[]).map(p=>{const clean=withoutKeys(p,['checkInToken','completionToken']);return {...clean,trainer:clean.trainer||clean.owner||'',materials:clean.materials||[],assessmentQuestions:clean.assessmentQuestions||[],feedbackResponses:clean.feedbackResponses||[]}}),assignments:(source.assignments||[]).map(a=>{const clean=withoutKeys(a,['checkInAt']);return {...clean,email:clean.email||'',accountLinked:clean.accountLinked!==false,invitationSentAt:clean.invitationSentAt||null,attendanceResponse:clean.attendanceResponse||(clean.attendance?'confirmed':'not_sent'),attendanceConfirmedAt:clean.attendanceConfirmedAt||null,completionConfirmedAt:clean.completionConfirmedAt||null,feedbackSubmittedAt:clean.feedbackSubmittedAt||null,assessmentSubmittedAt:clean.assessmentSubmittedAt||null}}),certificates:source.certificates||[],emailOutbox:source.emailOutbox||[],history:source.history||[]} as TrainingState
}
// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([trainingDemoState])
export function loadTrainingState(){return normalize(loadSnapshot('training_local_state',structuredClone(trainingDemoState)))}
export function saveTrainingState(state: unknown){const normalized=normalize(state);saveSnapshot('training_local_state',normalized);return normalized}
export function findTrainingAccess(state: unknown,token: unknown){
 const normalized=normalize(state);const key=String(token||'').trim();if(!key)return null
 const assignment=normalized.assignments.find(x=>x.id===key||x.accessToken===key)
 const program=assignment?normalized.programs.find(x=>x.id===assignment.programId):normalized.programs.find(x=>x.id===key)
 return program?{program,assignment:assignment||null}:null
}
export function computedAssignmentStatus(row: Pick<TrainingAssignment,'status'|'dueDate'>,today=new Date()){if(row.status==='completed')return 'completed';if(row.status==='cancelled')return 'cancelled';if(row.dueDate&&new Date(`${row.dueDate}T23:59:59`)<today)return 'overdue';return row.status||'assigned'}
export function validityUntil(completedDate: string|null|undefined,months: unknown){if(!completedDate||!months)return '';const d=new Date(`${completedDate}T12:00:00`);d.setMonth(d.getMonth()+Number(months));return d.toISOString().slice(0,10)}
