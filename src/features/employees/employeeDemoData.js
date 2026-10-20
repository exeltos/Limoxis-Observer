import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { DEMO_HISTORY_MONTHS, addDays, dayInMonth } from '../../core/data/demoSeed'
export const employeeRows = [
  {id:'EMP-001',position:'Νοσηλευτής/τρια ΜΕΘ',positionEn:'ICU Nurse',firstName:'Μαρία',firstNameEn:'Maria',lastName:'Παπαδοπούλου',lastNameEn:'Papadopoulou',fatherName:'Ιωάννης',fatherNameEn:'Ioannis',department:'ΜΕΘ',departmentEn:'ICU',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'m.papadopoulou@example.org',phone:'210 555 0101',hireDate:'2019-03-18',birthDate:'1990-08-29'},
  {id:'EMP-002',position:'Επιμελητής Ιατρός',positionEn:'Consultant Physician',firstName:'Νικόλαος',firstNameEn:'Nikolaos',lastName:'Δημητρίου',lastNameEn:'Dimitriou',fatherName:'Αλέξανδρος',fatherNameEn:'Alexandros',department:'Παθολογική',departmentEn:'Internal Medicine',profession:'Ιατρικό προσωπικό',professionEn:'Medical staff',employmentStatus:'active',email:'n.dimitriou@example.org',phone:'210 555 0102',hireDate:'2021-09-01'},
  {id:'EMP-003',position:'Προϊστάμενος/η Τμήματος',positionEn:'Head of Department (Nursing)',firstName:'Ελένη',firstNameEn:'Eleni',lastName:'Κωνσταντίνου',lastNameEn:'Konstantinou',fatherName:'Δημήτριος',fatherNameEn:'Dimitrios',department:'Χειρουργική',departmentEn:'Surgery',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'e.konstantinou@example.org',phone:'210 555 0103',hireDate:'2017-01-12'},
  {id:'EMP-004',position:'Τεχνολόγος Εργαστηρίου',positionEn:'Laboratory Technologist',firstName:'Γεώργιος',firstNameEn:'Georgios',lastName:'Αντωνίου',lastNameEn:'Antoniou',fatherName:'Νικόλαος',fatherNameEn:'Nikolaos',department:'Εργαστήριο',departmentEn:'Laboratory',profession:'Εργαστηριακό προσωπικό',professionEn:'Laboratory staff',employmentStatus:'inactive',email:'g.antoniou@example.org',phone:'210 555 0104',hireDate:'2015-06-15'},
]

export const occupationalVisits = [
  {id:'OHV-001',employeeId:'EMP-001',date:'2026-08-27',type:'periodic',status:'completed',followUpDate:'2027-08-27',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση χωρίς ευρήματα. Επαρκής ανοσία για ηπατίτιδα Β.'},
  {id:'OHV-001B',employeeId:'EMP-001',date:'2026-06-15',type:'followUp',status:'completed',followUpDate:'2026-12-14',fitStatus:'fit',clinicalNotes:'Παρακολούθηση μετά από τρύπημα βελόνας (14/06). Αρχικός ορολογικός έλεγχος αρνητικός.'},
  {id:'OHV-002',employeeId:'EMP-002',date:'2026-09-28',type:'followUp',status:'scheduled',followUpDate:null,fitStatus:'pending',clinicalNotes:''},
  {id:'OHV-002B',employeeId:'EMP-002',date:'2025-09-30',type:'periodic',status:'completed',followUpDate:'2026-09-30',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση χωρίς ευρήματα.'},
  {id:'OHV-003',employeeId:'EMP-003',date:'2026-09-30',type:'vaccinationReview',status:'scheduled',followUpDate:null,fitStatus:'pending',clinicalNotes:''},
  {id:'OHV-003B',employeeId:'EMP-003',date:'2026-03-12',type:'periodic',status:'completed',followUpDate:'2027-03-12',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση. Συστάθηκε αντιγριπικός εμβολιασμός.'},
  {id:'OHV-004',employeeId:'EMP-005',date:'2026-07-12',type:'periodic',status:'completed',followUpDate:'2027-07-12',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση χωρίς ευρήματα.'},
  {id:'OHV-004B',employeeId:'EMP-005',date:'2026-05-06',type:'followUp',status:'completed',followUpDate:'2026-08-06',fitStatus:'fit',clinicalNotes:'Παρακολούθηση μετά από έκθεση (PEP 28 ημερών ολοκληρώθηκε). Ορολογικός έλεγχος 6 εβδομάδων αρνητικός.'},
  {id:'OHV-005',employeeId:'EMP-006',date:'2026-10-02',type:'periodic',status:'scheduled',followUpDate:null,fitStatus:'pending',clinicalNotes:''},
  {id:'OHV-005B',employeeId:'EMP-006',date:'2025-10-02',type:'periodic',status:'completed',followUpDate:'2026-10-02',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση χωρίς ευρήματα.'},
  {id:'OHV-006',employeeId:'EMP-004',date:'2025-04-21',type:'periodic',status:'completed',followUpDate:'2026-04-21',fitStatus:'fit',clinicalNotes:'Εργαστηριακός επαγγελματίας: επιβεβαιώθηκε ανοσία ηπατίτιδας Β.'},
  {id:'OHV-007',employeeId:'EMP-007',date:'2026-02-18',type:'vaccinationReview',status:'completed',followUpDate:'2026-08-18',fitStatus:'fit',clinicalNotes:'Έλεγχος εμβολιαστικής κάλυψης. Ολοκληρώθηκε σχήμα ηπατίτιδας Β.'},
  {id:'OHV-007B',employeeId:'EMP-007',date:'2026-08-18',type:'followUp',status:'completed',followUpDate:null,fitStatus:'fit',clinicalNotes:'Anti-HBs > 10 IU/L — επαρκής ανοσία.'},
  {id:'OHV-008',employeeId:'EMP-008',date:'2026-01-26',type:'periodic',status:'completed',followUpDate:'2027-01-26',fitStatus:'fit',clinicalNotes:'Περιοδική εξέταση διοικητικού προσωπικού χωρίς ευρήματα.'},
]

export const employeeVaccinations = [
  {id:'VAC-001',employeeId:'EMP-001',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2025-10-12',validUntil:null,status:'complete'},
  {id:'VAC-001B',employeeId:'EMP-001',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-10-15',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-001C',employeeId:'EMP-001',vaccine:'Ιλαρά-παρωτίτιδα-ερυθρά (MMR)',dose:'2η δόση',date:'2019-03-04',validUntil:null,status:'complete'},
  {id:'VAC-002',employeeId:'EMP-002',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-10-20',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-002B',employeeId:'EMP-002',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2012-06-11',validUntil:null,status:'complete'},
  {id:'VAC-003',employeeId:'EMP-003',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-11-03',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-003B',employeeId:'EMP-003',vaccine:'Τέτανος-διφθερίτιδα-κοκκύτης (Tdap)',dose:'Αναμνηστική',date:'2021-05-17',validUntil:'2031-05-17',status:'complete'},
  {id:'VAC-003C',employeeId:'EMP-003',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2015-09-02',validUntil:null,status:'complete'},
  {id:'VAC-004',employeeId:'EMP-005',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2024-05-20',validUntil:null,status:'complete'},
  {id:'VAC-004B',employeeId:'EMP-005',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-10-09',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-005',employeeId:'EMP-006',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-10-28',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-005B',employeeId:'EMP-006',vaccine:'Ανεμευλογιά',dose:'2η δόση',date:'2017-02-13',validUntil:null,status:'complete'},
  {id:'VAC-006',employeeId:'EMP-007',vaccine:'Τέτανος-διφθερίτιδα-κοκκύτης (Tdap)',dose:'Αναμνηστική',date:'2022-03-11',validUntil:'2032-03-11',status:'complete'},
  {id:'VAC-006B',employeeId:'EMP-007',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2026-02-18',validUntil:null,status:'complete'},
  {id:'VAC-007',employeeId:'EMP-004',vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:'2015-07-22',validUntil:null,status:'complete'},
  {id:'VAC-008',employeeId:'EMP-008',vaccine:'Γρίπη εποχική',dose:'2025/26',date:'2025-11-12',validUntil:'2026-10-01',status:'renewSoon'},
]

// Legacy training summary rows (before the Training module). Current
// assignments come from the Training programmes (trainingData.js).
export const employeeTraining = [
  {id:'TR-01', employeeId:'EMP-001', titleEl:'Υγιεινή Χεριών', titleEn:'Hand Hygiene', date:'2026-05-12', status:'completed'},
  {id:'TR-02', employeeId:'EMP-001', titleEl:'Πρόληψη Λοιμώξεων', titleEn:'Infection Prevention', date:'2026-07-04', status:'completed'},
  {id:'TR-03', employeeId:'EMP-002', titleEl:'Ασφάλεια ασθενών', titleEn:'Patient Safety', date:'2026-06-18', status:'completed'},
  {id:'TR-04',employeeId:'EMP-005',titleEl:'Ορθή χρήση ΜΑΠ',titleEn:'Correct PPE use',date:'2026-04-22',status:'completed'},
  {id:'TR-05',employeeId:'EMP-006',titleEl:'Υγιεινή Χεριών',titleEn:'Hand Hygiene',date:'2026-05-12',status:'completed'},
  {id:'TR-06',employeeId:'EMP-007',titleEl:'Πρόληψη λοιμώξεων',titleEn:'Infection Prevention',date:'2026-03-09',status:'completed'},
  {id:'TR-07',employeeId:'EMP-003',titleEl:'Ασφάλεια ασθενών',titleEn:'Patient Safety',date:'2026-02-11',status:'completed'},
  {id:'TR-08',employeeId:'EMP-004',titleEl:'Βιοασφάλεια εργαστηρίου',titleEn:'Laboratory biosafety',date:'2026-03-24',status:'completed'},
  {id:'TR-09',employeeId:'EMP-008',titleEl:'Διαχείριση ανεπιθύμητων συμβάντων',titleEn:'Adverse event management',date:'2026-04-08',status:'completed'},
]

// Performance evaluations: one completed cycle for everyone, current cycle in progress.
const CRITERIA=[['professional-competence','Επαγγελματική επάρκεια'],['quality-accuracy','Ποιότητα & ακρίβεια εργασίας'],['procedures-protocols','Τήρηση διαδικασιών / πρωτοκόλλων'],['patient-safety-ipc','Ασφάλεια ασθενών & πρόληψη λοιμώξεων'],['teamwork','Συνεργασία / ομαδικότητα'],['communication','Επικοινωνία'],['responsibility','Υπευθυνότητα / συνέπεια'],['professional-development','Επαγγελματική ανάπτυξη']]
function evaluation(id,employeeId,period,date,evaluatorName,scores,status,notes){
  const criteria=CRITERIA.map(([cid,name],i)=>({id:cid,name,score:scores[i],weight:1}))
  const overallScore=Number((scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2))
  const done=['employee_acknowledged','hr_approved','finalized'].includes(status)
  return {id,employeeId,titleEl:'Αξιολόγηση απόδοσης',titleEn:'Performance evaluation',date,period,status,evaluatorUserId:null,evaluatorName,criteria,overallScore,notes,resultEl:`${overallScore} / 5`,resultEn:`${overallScore} / 5`,employeeComment:done?'Συμφωνώ με την αξιολόγηση.':'',employeeAgreement:done?'agree':'',employeeAcknowledgedAt:done?`${date}T12:00:00Z`:null,hrApprovedAt:['hr_approved','finalized'].includes(status)?`${date}T15:00:00Z`:null,adminApprovedAt:status==='finalized'?`${date}T17:00:00Z`:null,finalizedAt:status==='finalized'?`${date}T17:00:00Z`:null,source:'employee_evaluations'}
}
export const employeeEvaluations = [
  evaluation('EV-01','EMP-001','2025','2026-02-20','Αικατερίνη Λάμπρου',[5,4,5,5,4,4,5,4],'finalized','Υποδειγματική εφαρμογή των δεσμών μέτρων στη ΜΕΘ.'),
  evaluation('EV-02','EMP-002','2025','2026-03-05','Δρ. Παναγιώτης Ρήγας',[4,4,4,4,5,4,4,3],'finalized','Καλή συνεργασία με την Ομάδα Πρόληψης Λοιμώξεων.'),
  evaluation('EV-03','EMP-003','2025','2026-01-18','Ιωάννα Σπυροπούλου',[4,4,5,4,4,5,4,4],'finalized','Άριστη επικοινωνία με ασθενείς και συνοδούς.'),
  evaluation('EV-04','EMP-004','2025','2025-11-30','Δρ. Μαρίνα Κουτσού',[5,5,5,4,4,4,5,4],'finalized','Ακρίβεια στην αναφορά αποτελεσμάτων και στην επικοινωνία κρίσιμων τιμών.'),
  evaluation('EV-05','EMP-005','2025','2026-04-14','Δρ. Στέφανος Καλλέργης',[4,4,3,4,4,4,4,4],'hr_approved','Χρειάζεται μεγαλύτερη συνέπεια στην τεκμηρίωση ΜΑΠ.'),
  evaluation('EV-06','EMP-006','2025','2026-02-27','Γεωργία Φωτίου',[4,5,4,5,5,4,5,4],'finalized','Ενεργή συμμετοχή ως link nurse της κλινικής.'),
  evaluation('EV-07','EMP-007','2025','2026-05-09','Θεόδωρος Αλεξίου',[3,3,3,4,4,3,3,3],'employee_acknowledged','Απαιτείται επανεκπαίδευση στον έλεγχο βιολογικών δεικτών.'),
  evaluation('EV-08','EMP-008','2025','2026-03-21','Διονύσης Μαυρίδης',[5,4,5,4,5,5,5,5],'finalized','Άριστος συντονισμός των εσωτερικών επιθεωρήσεων.'),
  evaluation('EV-09','EMP-001','2026 · Α΄ εξάμηνο','2026-08-25','Αικατερίνη Λάμπρου',[5,5,5,5,4,4,5,5],'submitted','Ενδιάμεση αξιολόγηση εξαμήνου.'),
  evaluation('EV-10','EMP-003','2026 · Α΄ εξάμηνο','2026-08-27','Ιωάννα Σπυροπούλου',[4,4,4,5,4,5,4,4],'draft','Πρόχειρη ενδιάμεση αξιολόγηση.'),
]

export const employeeCertificates = [
  {id:'CERT-01', employeeId:'EMP-001', titleEl:'BLS', titleEn:'BLS', issuer:'ERC', issueDate:'2025-04-01', validUntil:'2027-03-31', certificateNumber:'BLS-2025-001', attachments:[]},
  {id:'CERT-02',employeeId:'EMP-005',titleEl:'ALS',titleEn:'ALS',issuer:'ERC',issueDate:'2025-09-01',validUntil:'2027-08-31',certificateNumber:'ALS-2025-018',attachments:[]},
  {id:'CERT-03',employeeId:'EMP-007',titleEl:'Εκπαίδευση Αποστείρωσης',titleEn:'Sterilization Training',issuer:'Demo Hospital',issueDate:'2026-02-15',validUntil:'2028-02-14',certificateNumber:'CSSD-2026-007',attachments:[]},
  {id:'CERT-04',employeeId:'EMP-002',titleEl:'ALS',titleEn:'ALS',issuer:'ERC',issueDate:'2024-11-09',validUntil:'2026-11-08',certificateNumber:'ALS-2024-044',attachments:[]},
  {id:'CERT-05',employeeId:'EMP-003',titleEl:'BLS',titleEn:'BLS',issuer:'ERC',issueDate:'2024-10-02',validUntil:'2026-10-01',certificateNumber:'BLS-2024-117',attachments:[]},
  {id:'CERT-06',employeeId:'EMP-004',titleEl:'Βιοασφάλεια επιπέδου 2 (BSL-2)',titleEn:'Biosafety level 2 (BSL-2)',issuer:'ΕΟΔΥ',issueDate:'2025-06-20',validUntil:'2028-06-19',certificateNumber:'BSL2-2025-031',attachments:[]},
  {id:'CERT-07',employeeId:'EMP-006',titleEl:'Link nurse πρόληψης λοιμώξεων',titleEn:'Infection prevention link nurse',issuer:'Demo Hospital',issueDate:'2025-12-05',validUntil:'2027-12-04',certificateNumber:'IPC-LN-2025-006',attachments:[]},
  {id:'CERT-08',employeeId:'EMP-008',titleEl:'Εσωτερικός επιθεωρητής ISO 9001',titleEn:'ISO 9001 internal auditor',issuer:'TÜV Hellas',issueDate:'2025-03-14',validUntil:'2028-03-13',certificateNumber:'ISO-IA-2025-212',attachments:[]},
]

export const employeeExposureIncidents = [
  {id:'EXP-01', employeeSurveillanceRecordId:'ESUR-260801', sourceCaseId:'SUR-260041', employeeId:'EMP-001', incidentDate:'2026-06-14', exposureType:'needlestick', deviceOrSource:'Βελόνα ενδοφλέβιας γραμμής', bodySite:'Αριστερός δείκτης', sourcePatientStatus:'negative', reportedAt:'2026-06-14T09:20:00', pepAdministered:false, pepDetails:'', followUpStatus:'completed', followUpDueAt:'2026-12-14', notes:'Πηγή ασθενής αρνητική σε ορολογικό έλεγχο.', status:'closed'},
  {id:'EXP-02', employeeId:'EMP-005', incidentDate:'2026-04-08', exposureType:'needlestick', deviceOrSource:'Βελόνα αιμοληψίας (κοίλη)', bodySite:'Δεξιός αντίχειρας', sourcePatientStatus:'unknown', reportedAt:'2026-04-08T23:40:00', pepAdministered:true, pepDetails:'PEP HIV εντός 2 ωρών, 28 ημέρες. Ολοκληρώθηκε χωρίς ανεπιθύμητες ενέργειες.', followUpStatus:'scheduled', followUpDueAt:'2026-10-08', notes:'Άγνωστη πηγή στο ΤΕΠ. Ορολογικός έλεγχος 6 εβδομάδων αρνητικός· εκκρεμεί ο έλεγχος 6 μηνών.', status:'open'},
  {id:'EXP-03', employeeSurveillanceRecordId:'ESUR-260602', sourceCaseId:'SUR-260041', employeeId:'EMP-003', incidentDate:'2026-07-22', exposureType:'mucocutaneous', deviceOrSource:'Εκτίναξη αίματος κατά την αφαίρεση παροχέτευσης', bodySite:'Επιπεφυκότας δεξιού οφθαλμού', sourcePatientStatus:'negative', reportedAt:'2026-07-22T11:05:00', pepAdministered:false, pepDetails:'', followUpStatus:'completed', followUpDueAt:'2026-08-22', notes:'Άμεση πλύση με φυσιολογικό ορό. Πηγή αρνητική για HBV, HCV, HIV.', status:'closed'},
  {id:'EXP-05', employeeId:'EMP-002', incidentDate:'2026-02-17', exposureType:'non_intact_skin', deviceOrSource:'Αίμα ασθενούς σε δερματίτιδα χεριού', bodySite:'Ραχιαία επιφάνεια δεξιού χεριού', sourcePatientStatus:'negative', reportedAt:'2026-02-17T12:30:00', pepAdministered:false, pepDetails:'', followUpStatus:'completed', followUpDueAt:'2026-03-17', notes:'Πλύση με νερό και σαπούνι. Πηγή αρνητική· δεν απαιτήθηκε περαιτέρω παρακολούθηση.', status:'closed'},
  {id:'EXP-06', employeeId:'EMP-006', incidentDate:'2026-08-11', exposureType:'needlestick', deviceOrSource:'Βελόνα ινσουλίνης μετά την ένεση', bodySite:'Δεξιός μέσος δάκτυλος', sourcePatientStatus:'positive', reportedAt:'2026-08-11T18:10:00', pepAdministered:false, pepDetails:'Πηγή HCV θετική· δεν υπάρχει PEP. Προγραμματισμένος έλεγχος HCV RNA.', followUpStatus:'scheduled', followUpDueAt:'2026-11-11', notes:'HCV RNA 3 εβδομάδων αρνητικό. Εκκρεμεί αντι-HCV στους 3 μήνες.', status:'open'},
  {id:'EXP-07', employeeId:'EMP-008', incidentDate:'2026-05-28', exposureType:'other', deviceOrSource:'Επαφή με διαρροή περιέκτη βιολογικών αποβλήτων κατά την επιθεώρηση', bodySite:'Ακέραιο δέρμα αντιβραχίου', sourcePatientStatus:'unknown', reportedAt:'2026-05-28T13:00:00', pepAdministered:false, pepDetails:'', followUpStatus:'closed', followUpDueAt:null, notes:'Ακέραιο δέρμα — χωρίς κίνδυνο μετάδοσης. Καταγράφηκε για διορθωτική ενέργεια στη διαχείριση αποβλήτων.', status:'closed'},
  {id:'EXP-04', employeeId:'EMP-007', incidentDate:'2026-08-26', exposureType:'sharps_object', deviceOrSource:'Νυστέρι σε δίσκο εργαλείων προς αποστείρωση', bodySite:'Αριστερή παλάμη', sourcePatientStatus:'unknown', reportedAt:'2026-09-03T10:15:00', pepAdministered:false, pepDetails:'', followUpStatus:'pending', followUpDueAt:'2026-10-15', notes:'Εργαλείο χωρίς προστασία στο σετ. Ενημερώθηκε το χειρουργείο για διορθωτική ενέργεια.', status:'open'},
]

// Administrative lifecycle of each demo employee record (History tab).
export const employeeHistoryDemo = [
  ['EMP-001','2019-03-18T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-001','2024-01-10T10:30:00Z','update',['department_name'],'Γραφείο Προσωπικού'],['EMP-001','2026-02-20T13:00:00Z','update',['email','phone'],'Γραφείο Προσωπικού'],
  ['EMP-002','2021-09-01T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-002','2025-05-12T11:00:00Z','update',['profession_name'],'Γραφείο Προσωπικού'],
  ['EMP-003','2017-01-12T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-003','2026-01-18T12:00:00Z','update',['user_id'],'Διαχειριστής Demo'],
  ['EMP-004','2015-06-15T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-004','2025-12-19T09:40:00Z','update',['employment_status'],'Γραφείο Προσωπικού'],
  ['EMP-005','2020-02-10T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-005','2026-04-14T14:00:00Z','update',['department_name','employment_status'],'Γραφείο Προσωπικού'],
  ['EMP-006','2018-11-05T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-006','2025-12-05T10:00:00Z','update',['profession_name'],'Γραφείο Προσωπικού'],
  ['EMP-007','2016-04-14T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-007','2026-02-18T08:30:00Z','update',['email'],'Γραφείο Προσωπικού'],
  ['EMP-008','2022-01-17T09:00:00Z','insert',[],'Διαχειριστής Demo'],['EMP-008','2025-03-14T12:15:00Z','update',['hire_date'],'Γραφείο Προσωπικού'],
].map(([employeeId,at,action,changedFields,actorName],i)=>({id:`EH-${i+1}`,employeeId,at,action,changedFields,actorName,actorRole:''}))


// Full-demo enrichment: broad role and department coverage.
employeeRows.push(
 {id:'EMP-005',position:'Ειδικευόμενος Ιατρός',positionEn:'Resident Physician',firstName:'Ανδρέας',firstNameEn:'Andreas',lastName:'Μάρκου',lastNameEn:'Markou',department:'ΤΕΠ',departmentEn:'ED',profession:'Ιατρικό προσωπικό',professionEn:'Medical staff',employmentStatus:'active',email:'a.markou@example.org',hireDate:'2020-02-10'},
 {id:'EMP-006',position:'Νοσηλευτής/τρια Θαλάμου',positionEn:'Ward Nurse',firstName:'Σοφία',firstNameEn:'Sofia',lastName:'Οικονόμου',lastNameEn:'Oikonomou',department:'Καρδιολογική',departmentEn:'Cardiology',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'s.oikonomou@example.org',hireDate:'2018-11-05'},
 {id:'EMP-007',position:'Νοσηλευτής/τρια Θαλάμου',positionEn:'Ward Nurse',firstName:'Χρήστος',firstNameEn:'Christos',lastName:'Βασιλείου',lastNameEn:'Vasileiou',department:'Αποστείρωση',departmentEn:'CSSD',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'c.vasileiou@example.org',hireDate:'2016-04-14'},
 {id:'EMP-008',position:'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων (ΝΕΛ)',positionEn:'Infection Control Nurse',firstName:'Δήμητρα',firstNameEn:'Dimitra',lastName:'Σταθάτου',lastNameEn:'Stathatou',department:'Ποιότητα',departmentEn:'Quality',profession:'Διοικητικό προσωπικό',professionEn:'Administrative staff',employmentStatus:'active',email:'d.stathatou@example.org',hireDate:'2022-01-17'}
)

// The rest of the hospital's staff (about thirty people across the wards), each
// with a year of occupational-health history: a visit, vaccinations, an exposure
// report, an evaluation and an administrative trail.
const NURSE=['Νοσηλευτικό προσωπικό','Nursing staff'],DOCTOR=['Ιατρικό προσωπικό','Medical staff'],LAB=['Εργαστηριακό προσωπικό','Laboratory staff']
const POSITION={head:['Προϊστάμενος/η Τμήματος','Head of Department (Nursing)',NURSE],icuNurse:['Νοσηλευτής/τρια ΜΕΘ','ICU Nurse',NURSE],nurse:['Νοσηλευτής/τρια Θαλάμου','Ward Nurse',NURSE],assistant:['Βοηθός Θαλάμου','Ward Assistant',NURSE],consultant:['Επιμελητής Ιατρός','Consultant Physician',DOCTOR],resident:['Ειδικευόμενος Ιατρός','Resident Physician',DOCTOR],lab:['Τεχνολόγος Εργαστηρίου','Laboratory Technologist',LAB]}
const WARD_EN={ΜΕΘ:'ICU',Παθολογική:'Internal Medicine',Χειρουργική:'Surgery',ΤΕΠ:'ED',Καρδιολογική:'Cardiology','Νεογνολογική / ΜΕΝΝ':'Neonatal / NICU',Ορθοπαιδική:'Orthopedics',Εργαστήριο:'Laboratory'}
const STAFF=[
 ['Αικατερίνη','Aikaterini','Λάμπρου','Lamprou','ΜΕΘ','head','2012-05-02'],
 ['Γεώργιος','Georgios','Παππάς','Pappas','ΜΕΘ','consultant','2014-09-15'],
 ['Ευαγγελία','Evangelia','Τσιρίγου','Tsirigou','ΜΕΘ','icuNurse','2020-01-20'],
 ['Κωνσταντίνος','Konstantinos','Ραφαηλίδης','Rafailidis','ΜΕΘ','icuNurse','2023-03-06'],
 ['Βασιλική','Vasiliki','Μανωλάκη','Manolaki','ΜΕΘ','assistant','2018-06-11'],
 ['Παναγιώτης','Panagiotis','Ρήγας','Rigas','Παθολογική','consultant','2010-02-01'],
 ['Αναστασία','Anastasia','Χατζή','Chatzi','Παθολογική','nurse','2016-10-03'],
 ['Μιχαήλ','Michail','Ζερβός','Zervos','Παθολογική','resident','2024-11-04'],
 ['Ελπίδα','Elpida','Καραγιάννη','Karagianni','Παθολογική','nurse','2021-04-19'],
 ['Στέφανος','Stefanos','Καλλέργης','Kallergis','Χειρουργική','consultant','2011-07-01'],
 ['Χαρίκλεια','Chariklia','Μπακάλη','Bakali','Χειρουργική','nurse','2019-02-25'],
 ['Δημήτριος','Dimitrios','Λιάπης','Liapis','Χειρουργική','resident','2025-03-03'],
 ['Ευτυχία','Eftychia','Αθανασίου','Athanasiou','ΤΕΠ','nurse','2017-09-18'],
 ['Άγγελος','Angelos','Σωτηρόπουλος','Sotiropoulos','ΤΕΠ','consultant','2013-01-14'],
 ['Ηλίας','Ilias','Παπαγεωργίου','Papageorgiou','Καρδιολογική','consultant','2015-05-11'],
 ['Ζωή','Zoi','Δούκα','Douka','Καρδιολογική','nurse','2022-08-29'],
 ['Γεωργία','Georgia','Φωτίου','Fotiou','Νεογνολογική / ΜΕΝΝ','head','2009-11-02'],
 ['Ραλλού','Rallou','Νικολαΐδου','Nikolaidou','Νεογνολογική / ΜΕΝΝ','nurse','2020-07-06'],
 ['Πέτρος','Petros','Ιωαννίδης','Ioannidis','Νεογνολογική / ΜΕΝΝ','consultant','2016-03-21'],
 ['Ιωάννα','Ioanna','Σπυροπούλου','Spyropoulou','Ορθοπαιδική','head','2008-04-07'],
 ['Νικόλαος','Nikolaos','Αργυρίου','Argyriou','Ορθοπαιδική','resident','2026-08-17'],
 ['Μαρίνα','Marina','Κουτσού','Koutsou','Εργαστήριο','lab','2012-10-01'],
]
const EXPOSURES=[
 ['needlestick','Βελόνα ενδοφλέβιου καθετήρα','Δεξιός δείκτης','negative'],
 ['mucocutaneous','Εκτίναξη βιολογικού υγρού κατά την αναρρόφηση','Επιπεφυκότας','negative'],
 ['sharps_object','Λεπίδα νυστεριού κατά την απόρριψη','Αριστερός αντίχειρας','unknown'],
 ['non_intact_skin','Αίμα σε δερματίτιδα χεριού','Ράχη δεξιού χεριού','negative'],
 ['other','Διαρροή ούρων σε ακέραιο δέρμα','Αντιβράχιο','negative'],
]
const VISIT_NOTES=['Περιοδική εξέταση χωρίς ευρήματα.','Περιοδική εξέταση. Συστάθηκε αντιγριπικός εμβολιασμός.','Περιοδική εξέταση. Ορολογικός έλεγχος anti-HBs επαρκής.']
STAFF.forEach(([firstName,firstNameEn,lastName,lastNameEn,department,role,hireDate],index)=>{
 const id=`EMP-${String(index+9).padStart(3,'0')}`,n=index+1,[position,positionEn,[profession,professionEn]]=POSITION[role]
 // Nothing happens before the employee joined (a recent hire has an onboarding visit).
 const afterHire=(date,days)=>(date>addDays(hireDate,days)?date:addDays(hireDate,days)),recentHire=hireDate>='2026-01-01'
 const visitDate=afterHire(dayInMonth(DEMO_HISTORY_MONTHS[index%12],4+(index*7)%22),5)
 employeeRows.push({id,position,positionEn,firstName,firstNameEn,lastName,lastNameEn,department,departmentEn:WARD_EN[department],profession,professionEn,employmentStatus:'active',email:`${firstNameEn[0].toLowerCase()}.${lastNameEn.toLowerCase()}@example.org`,phone:`210 555 0${String(110+index)}`,hireDate})
 occupationalVisits.push({id:`OHV-${String(index+9).padStart(3,'0')}`,employeeId:id,date:visitDate,type:recentHire?'vaccinationReview':'periodic',status:'completed',followUpDate:addDays(visitDate,365),fitStatus:index%9===4?'fit_with_restrictions':'fit',clinicalNotes:VISIT_NOTES[index%3]})
 if(index%3===0)occupationalVisits.push({id:`OHV-${String(index+9).padStart(3,'0')}B`,employeeId:id,date:dayInMonth('2026-09',2+index),type:'followUp',status:'scheduled',followUpDate:null,fitStatus:'pending',clinicalNotes:''})
 if(index%5===2)occupationalVisits.push({id:`OHV-${String(index+9).padStart(3,'0')}C`,employeeId:id,date:addDays(visitDate,-120),type:'vaccinationReview',status:'completed',followUpDate:null,fitStatus:'fit',clinicalNotes:'Έλεγχος εμβολιαστικής κάλυψης.'})
 if(index%7!==3)employeeVaccinations.push({id:`VAC-${String(index+9).padStart(3,'0')}`,employeeId:id,vaccine:'Γρίπη εποχική',dose:'2025/26',date:dayInMonth(index%2?'2025-10':'2025-11',5+index),validUntil:'2026-10-01',status:'renewSoon'})
 employeeVaccinations.push({id:`VAC-${String(index+9).padStart(3,'0')}B`,employeeId:id,vaccine:'Ηπατίτιδα Β',dose:'3η δόση',date:recentHire?visitDate:addDays(hireDate,60),validUntil:null,status:'complete'})
 if(index%4===1)employeeVaccinations.push({id:`VAC-${String(index+9).padStart(3,'0')}C`,employeeId:id,vaccine:'Τέτανος-διφθερίτιδα-κοκκύτης (Tdap)',dose:'Αναμνηστική',date:'2023-04-12',validUntil:'2033-04-12',status:'complete'})
 if(index%4===3)employeeVaccinations.push({id:`VAC-${String(index+9).padStart(3,'0')}C`,employeeId:id,vaccine:'Ιλαρά-παρωτίτιδα-ερυθρά (MMR)',dose:'2η δόση',date:addDays(hireDate,30),validUntil:null,status:'complete'})
 const [exposureType,deviceOrSource,bodySite,sourcePatientStatus]=EXPOSURES[index%EXPOSURES.length],incidentDate=afterHire(dayInMonth(DEMO_HISTORY_MONTHS[(index*5)%12],3+(index*11)%24),7),open=incidentDate>='2026-07-01'
 employeeExposureIncidents.push({id:`EXP-${String(index+8).padStart(2,'0')}`,employeeId:id,incidentDate,exposureType,deviceOrSource,bodySite,sourcePatientStatus,reportedAt:`${incidentDate}T${String(8+index%10).padStart(2,'0')}:30:00`,pepAdministered:false,pepDetails:'',followUpStatus:open?'scheduled':'completed',followUpDueAt:addDays(incidentDate,open?90:30),notes:sourcePatientStatus==='negative'?'Πηγή αρνητική για HBV, HCV, HIV.':'Άγνωστη πηγή· ορολογικός έλεγχος στις 6 εβδομάδες και στους 6 μήνες.',status:open?'open':'closed'})
 employeeHistoryDemo.push({id:`EH-${employeeHistoryDemo.length+1}`,employeeId:id,at:`${hireDate}T09:00:00Z`,action:'insert',changedFields:[],actorName:'Γραφείο Προσωπικού',actorRole:''})
 const scores=CRITERIA.map((_,i)=>3+((n*7+i*3)%5>1?1:0)+((n+i)%6===0?1:0))
 employeeEvaluations.push(recentHire
  ?evaluation(`EV-${String(index+11).padStart(2,'0')}`,id,'Δοκιμαστική περίοδος',addDays(hireDate,10),'Γραφείο Ιατρικής Υπηρεσίας',scores,'draft','Αξιολόγηση λήξης δοκιμαστικής περιόδου.')
  :evaluation(`EV-${String(index+11).padStart(2,'0')}`,id,'2025',dayInMonth(DEMO_HISTORY_MONTHS[4+index%5],5+index),'Γραφείο Νοσηλευτικής / Ιατρικής Υπηρεσίας',scores,index%6===5?'hr_approved':'finalized','Ετήσια αξιολόγηση απόδοσης.'))
})

// Documents tab (demo): certifications, licences and training certificates.
const LICENCE={'Νοσηλευτικό προσωπικό':['Άδεια άσκησης νοσηλευτικού επαγγέλματος','Nursing practice licence'],'Ιατρικό προσωπικό':['Άδεια άσκησης ιατρικού επαγγέλματος','Medical practice licence'],'Εργαστηριακό προσωπικό':['Άδεια άσκησης επαγγέλματος τεχνολόγου εργαστηρίων','Laboratory technologist licence'],'Διοικητικό προσωπικό':['Βεβαίωση προϋπηρεσίας','Employment certificate']}
const fmtDay=value=>value?value.split('-').reverse().join('/'):''
export function demoEmployeeDocuments(employee,trainingCertificates=[],en=false){
  if(!employee)return []
  const certs=employeeCertificates.filter(x=>x.employeeId===employee.id).map(c=>({id:`DOC-${c.id}`,name:`${en?c.titleEn:c.titleEl} — ${c.certificateNumber}.pdf`,category:'certification',description:`${c.issuer} · ${en?'valid until':'ισχύει έως'} ${fmtDay(c.validUntil)}`}))
  const training=trainingCertificates.filter(x=>x.employeeId===employee.id).map(c=>({id:`DOC-${c.id}`,name:`${c.title} — ${c.id}.pdf`,category:'trainingCertificate',description:`${en?'Issued':'Έκδοση'} ${fmtDay(c.issuedDate)} · ${en?'valid until':'ισχύει έως'} ${fmtDay(c.validUntil)}`}))
  const licence=LICENCE[employee.profession]
  const licenceDoc=licence?[{id:`DOC-LIC-${employee.id}`,name:`${en?licence[1]:licence[0]}.pdf`,category:employee.profession==='Διοικητικό προσωπικό'?'employmentCertificate':'professionalLicense',description:`${en?'On file since':'Στο αρχείο από'} ${fmtDay(employee.hireDate)}`}]:[]
  return [...licenceDoc,...certs,...training]
}

// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([employeeRows,occupationalVisits,employeeVaccinations,employeeTraining,employeeEvaluations,employeeCertificates,employeeExposureIncidents,employeeHistoryDemo])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(employeeRows)
emptyInPreview(occupationalVisits)
emptyInPreview(employeeVaccinations)
emptyInPreview(employeeTraining)
emptyInPreview(employeeEvaluations)
emptyInPreview(employeeCertificates)
emptyInPreview(employeeExposureIncidents)
emptyInPreview(employeeHistoryDemo)
