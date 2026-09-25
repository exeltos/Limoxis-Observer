import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
export const trainerFeedbackTemplate=[
 {id:'clarity',label:'Σαφήνεια παρουσίασης'},
 {id:'knowledge',label:'Γνώση και επάρκεια εκπαιδευτή'},
 {id:'usefulness',label:'Χρησιμότητα για την εργασία μου'},
 {id:'organization',label:'Οργάνωση της εκπαίδευσης'},
 {id:'materials',label:'Ποιότητα εκπαιδευτικού υλικού'},
]


// Demo knowledge-assessment questions (same schema as the question editor).
const opts=(id,texts,correct)=>texts.map((text,i)=>({id:`${id}-O${i+1}`,text,correct:[].concat(correct).includes(i)}))
const sc=(id,text,texts,correct,points)=>({id,type:'single_choice',text,points,required:true,options:opts(id,texts,correct),correctBoolean:true,modelAnswer:'',manualReview:false})
const mc=(id,text,texts,correct,points)=>({...sc(id,text,texts,correct,points),type:'multiple_choice'})
const tf=(id,text,correctBoolean,points)=>({id,type:'true_false',text,points,required:true,options:[],correctBoolean,modelAnswer:'',manualReview:false})
const ft=(id,text,modelAnswer)=>({id,type:'free_text',text,points:0,required:false,options:[],correctBoolean:true,modelAnswer,manualReview:false})
const DEMO_QUESTIONS={
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
  mc('Q-202','Ποια στοιχεία περιλαμβάνει το bundle τοποθέτησης CVC;',['Υγιεινή χεριών','Πλήρη μέτρα άσηπτης τεχνικής (maximal barrier)','Αποφυγή μηριαίας φλέβας σε ενήλικες','Προφυλακτική χορήγηση αντιβιοτικού'],[0,1,2],3),
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
const answer=q=>q.type==='single_choice'?q.options.find(o=>o.correct).id:q.type==='multiple_choice'?q.options.filter(o=>o.correct).map(o=>o.id):q.type==='true_false'?q.correctBoolean:q.modelAnswer
const wrong=q=>q.type==='single_choice'?q.options.find(o=>!o.correct).id:q.type==='true_false'?!q.correctBoolean:[q.options[0].id]
const demoAnswers=(programId,wrongIds=[])=>Object.fromEntries(DEMO_QUESTIONS[programId].map(q=>[q.id,wrongIds.includes(q.id)?wrong(q):answer(q)]))
// A completed demo attempt whose score follows from its answers.
function completedAttempt(programId,wrongIds,passScore){const questions=DEMO_QUESTIONS[programId];const max=questions.reduce((n,q)=>n+(q.type==='free_text'?0:q.points),0);const lost=questions.filter(q=>wrongIds.includes(q.id)).reduce((n,q)=>n+q.points,0);const score=Math.round(100*(max-lost)/max);return {assessmentAnswers:demoAnswers(programId,wrongIds),score,competent:score>=passScore}}
const done=(id,programId,employeeId,employeeName,department,email,day,wrongIds,passScore,feedbackScores,feedbackComment,certificateId)=>{const attempt=completedAttempt(programId,wrongIds,passScore);return {id,programId,employeeId,employeeName,department,email,accountLinked:true,assignedDate:'2026-06-01',dueDate:'2026-06-30',status:'completed',invitationSentAt:'2026-06-01T08:00:00Z',attendanceResponse:'confirmed',attendance:true,attendanceConfirmedAt:`${day}T09:00:00Z`,completionConfirmedAt:`${day}T10:40:00Z`,feedbackSubmittedAt:`${day}T10:42:00Z`,assessmentSubmittedAt:`${day}T10:45:00Z`,...attempt,feedbackScores,feedbackComment,assessmentReviewedAt:null,completedDate:day,certificateId:attempt.competent?certificateId:null}}

export const trainingDemoState={
 programs:[
  {id:'TRN-001',title:'Υγιεινή Χεριών – WHO 5 Moments',category:'IPC',method:'Μικτή',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Δρ. Ελένη Κωνσταντίνου',audience:'Κλινικό προσωπικό',startDate:'2026-09-05',dueDate:'2026-09-30',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Ετήσια εκπαίδευση και επιβεβαίωση γνώσεων στην υγιεινή χεριών.',materials:[{id:'MAT-001',title:'WHO 5 Moments – συνοπτικός οδηγός',type:'PDF',url:''},{id:'MAT-002',title:'Παρουσίαση εκπαίδευσης',type:'Παρουσίαση',url:''}],assessmentQuestions:DEMO_QUESTIONS['TRN-001'],feedbackResponses:[{employeeId:'EMP-002',scores:{clarity:5,knowledge:5,usefulness:4,organization:5,materials:4},comment:'Πολύ πρακτική παρουσίαση.'}]},
  {id:'TRN-002',title:'Ορθή χρήση ΜΑΠ & απομόνωση',category:'IPC',method:'Δια ζώσης',owner:'Ομάδα Πρόληψης Λοιμώξεων',trainer:'Ν. Παπαδόπουλος',audience:'ΜΕΘ · Παθολογική · ΤΕΠ',startDate:'2026-08-20',dueDate:'2026-09-10',validMonths:12,requiresAssessment:true,passScore:80,status:'active',description:'Πρακτική εκπαίδευση σε επιλογή, εφαρμογή και αφαίρεση ΜΑΠ και μέτρων απομόνωσης.',materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-002'],feedbackResponses:[]},
  {id:'TRN-004',title:'Πρόληψη CLABSI και φροντίδα κεντρικών γραμμών',category:'IPC',method:'Δια ζώσης',owner:'ΕΝΛ',trainer:'Ομάδα IPC',audience:'ΜΕΘ · Χειρουργική',startDate:'2026-04-10',dueDate:'2026-04-30',validMonths:12,requiresAssessment:true,passScore:80,status:'completed',description:'Εφαρμογή bundle πρόληψης CLABSI και ασφαλής διαχείριση κεντρικών γραμμών.',materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-004'],feedbackResponses:[]},
  {id:'TRN-003',title:'Ασφαλής διαχείριση αιχμηρών',category:'Ασφάλεια',method:'e-learning',owner:'Ποιότητα & Ασφάλεια',trainer:'Τμήμα Ποιότητας',audience:'Όλο το προσωπικό',startDate:'2026-06-01',dueDate:'2026-06-30',validMonths:24,requiresAssessment:true,passScore:75,status:'completed',description:'Πρόληψη τραυματισμών και σωστή αναφορά έκθεσης.',materials:[],assessmentQuestions:DEMO_QUESTIONS['TRN-003'],feedbackResponses:[]},
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
  {id:'CERT-TR-002',assignmentId:'TRA-002',employeeId:'EMP-002',title:'Υγιεινή Χεριών – WHO 5 Moments',issuedDate:'2026-08-27',validUntil:'2027-08-27',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-005',assignmentId:'TRA-005',employeeId:'EMP-005',title:'Πρόληψη CLABSI και φροντίδα κεντρικών γραμμών',issuedDate:'2026-04-22',validUntil:'2027-04-22',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-004',assignmentId:'TRA-004',employeeId:'EMP-001',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-18',validUntil:'2028-06-18',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-007',assignmentId:'TRA-007',employeeId:'EMP-002',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-12',validUntil:'2028-06-12',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-010',assignmentId:'TRA-010',employeeId:'EMP-006',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-16',validUntil:'2028-06-16',issuer:'Limoxis Observer · Demo Hospital'},
  {id:'CERT-TR-009',assignmentId:'TRA-009',employeeId:'EMP-008',title:'Ασφαλής διαχείριση αιχμηρών',issuedDate:'2026-06-09',validUntil:'2028-06-09',issuer:'Limoxis Observer · Demo Hospital'},
 ],
 emailOutbox:[],
 history:[{at:'2026-08-25T09:00:00Z',actor:'Demo Hospital Admin',action:'Δημιουργήθηκε ετήσιος κύκλος εκπαίδευσης Υγιεινής Χεριών'}]
}

// Older demo attempts have already been reviewed by the training owner.
for(const a of trainingDemoState.assignments)if(['TRA-004','TRA-005','TRA-007','TRA-009'].includes(a.id)){a.assessmentReviewedAt=`${a.completedDate}T14:00:00Z`;a.assessmentReviewedBy='Ελένη Κωνσταντίνου';a.assessmentReviewAcknowledged=true}

function withoutKeys(value,keys){const clean={...value};for(const key of keys)delete clean[key];return clean}
function normalize(state){
 const source=state&&typeof state==='object'?state:structuredClone(trainingDemoState)
 return {...source,programs:(source.programs||[]).map(p=>{const clean=withoutKeys(p,['checkInToken','completionToken']);return {...clean,trainer:clean.trainer||clean.owner||'',materials:clean.materials||[],assessmentQuestions:clean.assessmentQuestions||[],feedbackResponses:clean.feedbackResponses||[]}}),assignments:(source.assignments||[]).map(a=>{const clean=withoutKeys(a,['checkInAt']);return {...clean,email:clean.email||'',accountLinked:clean.accountLinked!==false,invitationSentAt:clean.invitationSentAt||null,attendanceResponse:clean.attendanceResponse||(clean.attendance?'confirmed':'not_sent'),attendanceConfirmedAt:clean.attendanceConfirmedAt||null,completionConfirmedAt:clean.completionConfirmedAt||null,feedbackSubmittedAt:clean.feedbackSubmittedAt||null,assessmentSubmittedAt:clean.assessmentSubmittedAt||null}}),certificates:source.certificates||[],emailOutbox:source.emailOutbox||[],history:source.history||[]}
}
export function loadTrainingState(){return normalize(loadSnapshot('training_records',structuredClone(trainingDemoState)))}
export function saveTrainingState(state){const normalized=normalize(state);saveSnapshot('training_records',normalized);return normalized}
export function resetTrainingState(){const next=structuredClone(trainingDemoState);saveSnapshot('training_records',next);return next}
export function findTrainingAccess(state,token){
 const normalized=normalize(state);const key=String(token||'').trim();if(!key)return null
 const assignment=normalized.assignments.find(x=>x.id===key||x.accessToken===key)
 const program=assignment?normalized.programs.find(x=>x.id===assignment.programId):normalized.programs.find(x=>x.id===key)
 return program?{program,assignment:assignment||null}:null
}
export function computedAssignmentStatus(row,today=new Date()){if(row.status==='completed')return 'completed';if(row.status==='cancelled')return 'cancelled';if(row.dueDate&&new Date(`${row.dueDate}T23:59:59`)<today)return 'overdue';return row.status||'assigned'}
export function validityUntil(completedDate,months){if(!completedDate||!months)return '';const d=new Date(`${completedDate}T12:00:00`);d.setMonth(d.getMonth()+Number(months));return d.toISOString().slice(0,10)}
