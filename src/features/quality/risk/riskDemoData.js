// Demo risk register: the same risks assessed in two consecutive years, so the
// analysis and the period comparison have something to show. Dates follow the
// current year (the previous assessment one year ago, the current one last week).
const RISKS=[
 // key, section, process, processEn, scope, scopeEn, hazard, hazardEn, jci, [inherent L,C], previous residual [L,C], current residual [L,C], target [L,C], measures, measuresEn, owner, ownerEn
 ['R001','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','ΜΕΘ ενηλίκων','Adult ICU','Ενδονοσοκομειακή λοίμωξη / έξαρση λόγω μη τήρησης των πρωτοκόλλων πρόληψης λοιμώξεων','Healthcare-associated infection / outbreak from non-adherence to infection prevention protocols','IPSG.5',[4,5],[4,5],[3,5],[2,5],'Εβδομαδιαίοι έλεγχοι συμμόρφωσης στα bundles, επανεκπαίδευση προσωπικού','Weekly bundle compliance audits, staff retraining','Προϊστάμενος Λοιμώξεων','Infection control nurse lead'],
 ['R002','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','Όλα τα νοσηλευτικά τμήματα','All wards','Διασπορά πολυανθεκτικού μικροοργανισμού λόγω καθυστέρησης στην απομόνωση','Spread of a multidrug-resistant organism from delayed isolation','PCI',[4,4],[3,4],[2,4],[2,3],'Αυτόματη ειδοποίηση απομόνωσης από το εργαστήριο','Automatic isolation alert from the laboratory','Επιτροπή Λοιμώξεων','Infection Control Committee'],
 ['R003','clinical','ΝΟΣΗΛΕΥΤΙΚΗ ΠΡΑΞΗ','Nursing practice','ΜΕΘ, Χειρουργικά τμήματα','ICU, surgical wards','Λοίμωξη αίματος από κεντρικό φλεβικό καθετήρα (CLABSI)','Central line–associated bloodstream infection (CLABSI)','PCI',[4,4],[3,4],[3,4],[2,4],'Bundle εισαγωγής και συντήρησης, καθημερινή αξιολόγηση αναγκαιότητας','Insertion and maintenance bundle, daily necessity review','Διευθυντής ΜΕΘ','ICU director'],
 ['R004','clinical','ΤΑΥΤΟΠΟΙΗΣΗ ΑΣΘΕΝΩΝ','Patient identification','Χειρουργείο','Operating theatre','Ανεπιθύμητο συμβάν λόγω μη ορθής ταυτοποίησης ασθενή','Adverse event from incorrect patient identification','IPSG.1',[4,5],[2,5],[2,5],[1,5],'Λίστα ελέγχου χειρουργικής ασφάλειας σε κάθε επέμβαση','Surgical safety checklist for every procedure','Προϊστάμενος Χειρουργείου','Theatre nurse manager'],
 ['R005','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','Όλα τα νοσηλευτικά τμήματα','All wards','Πτώση ασθενή με τραυματισμό','Patient fall with injury','IPSG.6',[3,3],[3,3],[2,3],[2,2],'Αξιολόγηση κινδύνου πτώσης κατά την εισαγωγή, σήμανση κλίνης','Fall risk assessment on admission, bed signage','Νοσηλευτική Διεύθυνση','Nursing directorate'],
 ['R006','clinical','ΔΙΑΧΕΙΡΙΣΗ ΦΑΡΜΑΚΩΝ','Medication management','Όλα τα νοσηλευτικά τμήματα','All wards','Ανεπιθύμητη ενέργεια από λάθος φαρμακευτικής αγωγής (δόση, οδός, φάρμακο)','Adverse drug event from a medication error (dose, route, drug)','MMU',[4,4],[3,4],[2,4],[2,3],'Διπλός έλεγχος φαρμάκων υψηλού κινδύνου','Double check of high-alert medications','Φαρμακείο','Pharmacy'],
 ['R007','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','Όλα τα νοσηλευτικά τμήματα','All wards','Έλκη πίεσης σε ασθενείς υψηλού κινδύνου','Pressure ulcers in high-risk patients','COP',[3,3],[2,3],[2,3],[1,3],'','','',''],
 ['R008','clinical','ΕΣΩΤΕΡΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ','Internal communication','Εργαστήρια, κλινικές','Laboratories, wards','Μη έγκαιρη ενημέρωση για κρίσιμα αποτελέσματα','Delayed communication of critical results','IPSG.2',[3,4],[3,4],[2,4],[1,4],'Καταγραφή κλειστού κύκλου επικοινωνίας κρίσιμων αποτελεσμάτων','Closed-loop record of critical result communication','Διευθυντής Εργαστηρίου','Laboratory director'],
 ['R009','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','Χειρουργεία','Operating theatres','Λοίμωξη χειρουργικού πεδίου','Surgical site infection','IPSG.5',[3,4],[2,4],[3,4],[2,4],'Έλεγχος χρόνου προφυλακτικής αντιβίωσης σε κάθε επέμβαση','Check of antibiotic prophylaxis timing in every procedure','Επιτροπή Λοιμώξεων','Infection Control Committee'],
 ['R010','general','ΑΣΦΑΛΕΙΑ ΕΓΚΑΤΑΣΤΑΣΕΩΝ','Facility safety','Όλα τα τμήματα','All departments','Πυρκαγιά σε χώρους με ασθενείς και προσωπικό','Fire in areas with patients and staff','FMS',[2,5],[1,5],[1,5],[1,5],'','','',''],
 ['R011','general','ΑΣΦΑΛΕΙΑ ΕΡΓΑΖΟΜΕΝΩΝ','Staff safety','Όλα τα τμήματα','All departments','Τραυματισμός από αιχμηρό αντικείμενο','Sharps injury','SQE',[3,3],[3,3],[2,3],[1,3],'Ασφαλή αιχμηρά (safety devices) σε όλα τα τμήματα','Safety-engineered sharps in all departments','Ιατρός Εργασίας','Occupational physician'],
 ['R012','general','ΔΙΑΧΕΙΡΙΣΗ ΕΞΟΠΛΙΣΜΟΥ','Equipment management','Εργαστήρια','Laboratories','Μη δυνατότητα διεξαγωγής εξέτασης λόγω βλάβης εξοπλισμού','Test not possible because of equipment failure','AOP',[3,3],[2,3],[2,3],[2,2],'','','',''],
 ['R013','general','ΑΣΦΑΛΕΙΑ ΙΑΤΡΙΚΟΥ ΦΑΚΕΛΟΥ','Medical record safety','Ιατρικό αρχείο','Medical records','Διαρροή προσωπικών δεδομένων ασθενή','Leak of patient personal data','MOI',[2,5],[2,5],[2,4],[1,4],'Έλεγχος δικαιωμάτων πρόσβασης ανά εξάμηνο','Six-monthly review of access rights','Υπεύθυνος Προστασίας Δεδομένων','Data protection officer'],
 ['R014','clinical','ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ','Patient safety','ΤΕΠ','Emergency department','Καθυστέρηση στην αναγνώριση σήψης','Delayed recognition of sepsis','COP',[4,5],[3,5],[3,4],[2,4],'Εργαλείο NEWS2 και πρωτόκολλο σήψης μέσα σε 1 ώρα','NEWS2 tool and one-hour sepsis protocol','Διευθυντής ΤΕΠ','ED director'],
]

const iso=date=>date.toISOString().slice(0,10)
const shift=(date,days)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d}

function risks(assessmentId,stage,now){
 return RISKS.map(([key,section,process,processEn,scope,scopeEn,hazard,hazardEn,jci,inherent,previous,current,target,measures,measuresEn,owner,ownerEn],position)=>{
  const residual=stage==='previous'?previous:current
  return {id:`${assessmentId}-${key}`,assessmentId,lineageKey:key,position,section,process,processEn,scope,scopeEn,hazard,hazardEn,
   inherentL:inherent[0],inherentC:inherent[1],existingControls:'Τήρηση διαδικασιών και πρωτοκόλλων, εκπαίδευση προσωπικού, παρακολούθηση συμβάντων',existingControlsEn:'Procedures and protocols, staff training, incident monitoring',
   residualL:residual[0],residualC:residual[1],additionalMeasures:measures,additionalMeasuresEn:measuresEn,owner,ownerEn,dueDate:measures?iso(shift(now,stage==='previous'?-180:120)):null,
   reviewFrequency:'Μηνιαίος έλεγχος',reviewFrequencyEn:'Monthly review',indicator:'',targetL:stage==='previous'?null:target[0],targetC:stage==='previous'?null:target[1],jci,jciReference:'',prioritized:stage==='current'&&key==='R001',notes:'',consequenceRationale:residual[1]!==inherent[1]?'Τα υφιστάμενα μέτρα περιορίζουν τη σοβαρότητα του συμβάντος.':'',updatedAt:now.toISOString()}
 })
}

export function riskDemoAssessments(today=new Date()){
 const current=shift(today,-7),previous=shift(today,-372)
 const make=(id,date,stage,status)=>({id,code:`RSA-DEMO-${date.getFullYear()}`,title:`Εκτίμηση επικινδυνότητας ${date.getFullYear()}`,titleEn:`Risk assessment ${date.getFullYear()}`,periodLabel:String(date.getFullYear()),periodKind:'annual',assessedOn:iso(date),nextReviewOn:iso(shift(date,365)),assessorLabel:'Διεύθυνση Ποιότητας',formCode:'Ε.Δ.ΔΙΑΧ.090',scopeNote:'',status,approvedByLabel:status==='approved'?'Επιτροπή Ποιότητας':'',approvedOn:status==='approved'?iso(shift(date,14)):null,sourceAssessmentId:stage==='current'?'demo-risk-previous':null,history:[],updatedAt:today.toISOString(),
  risks:risks(id,stage,today),
  opportunities:[{id:`${id}-O1`,assessmentId:id,position:0,activity:'Πιστοποίηση κατά ISO 9001 / ISO 15224',opportunity:'Συμμόρφωση με τη νομοθεσία και φήμη του οργανισμού',rating:'Υψηλή απόδοση',actionPlan:'Ετήσια επιθεώρηση επιτήρησης από τον φορέα πιστοποίησης',timeframe:'Ετησίως',owner:'Διεύθυνση Ποιότητας',effectiveness:'Αποτελεσματικό',updatedAt:today.toISOString()}]})
 return [make('demo-risk-current',current,'current','under_review'),make('demo-risk-previous',previous,'previous','approved')]
}
