import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { shiftDemoDatesInPlace, shiftDemoMonthsInPlace } from '../../core/data/demoClock'
import { DEMO_HISTORY_MONTHS, addDays } from '../../core/data/demoSeed'
const seed=[
 {id:'COM-001',decisionNumber:'Απόφαση Δ.Σ. 31/18.12.2024',meetingFrequency:'monthly',quorumRule:'simple_majority',templateId:'enl',name:'Επιτροπή Νοσοκομειακών Λοιμώξεων',shortName:'ΕΝΛ',type:'infection_control',status:'active',chair:'Δρ. Ελένη Παπαδοπούλου',secretary:'Μαρία Κωνσταντίνου',termStart:'2025-01-01',termEnd:'2026-12-31',committeeRole:'Κεντρικό θεσμικό όργανο του νοσοκομείου για την επιτήρηση, πρόληψη και τον έλεγχο των λοιμώξεων που συνδέονται με τη φροντίδα υγείας.',legalBasis:'ΥΑ Υ1.Γ.Π.114971/2014 · ισχύουσα πράξη συγκρότησης φορέα · WHO IPC Core Components',mandate:'Επιτήρηση, πρόληψη και έλεγχος λοιμώξεων, εφαρμογή μέτρων IPC και παρακολούθηση σχετικών δεικτών.',members:['Δρ. Ελένη Παπαδοπούλου','Μαρία Κωνσταντίνου','Γ. Νικολάου','Α. Δημητρίου'],memberRefs:[
  {id:'CM-SEED-1',inControlTeam:true,employeeId:'',name:'Δρ. Ελένη Παπαδοπούλου',department:'Ιατρική Υπηρεσία',profession:'Ιατρός',committeeTitle:'Πρόεδρος',responsibilities:'Συντονισμός της ΕΝΛ, έγκριση ημερήσιας διάταξης και εποπτεία εφαρμογής αποφάσεων.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'},
  {id:'CM-SEED-2',inControlTeam:true,employeeId:'',name:'Μαρία Κωνσταντίνου',department:'Επιτήρηση Λοιμώξεων',profession:'Νοσηλευτής/τρια',committeeTitle:'ΝΕΛ / Γραμματέας',responsibilities:'Επιτήρηση ΛΣΦΥ, συλλογή και ανατροφοδότηση δεικτών, πρακτικά και παρακολούθηση ενεργειών.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'},
  {id:'CM-SEED-3',inControlTeam:true,employeeId:'',name:'Γ. Νικολάου',department:'Μικροβιολογικό',profession:'Μικροβιολόγος',committeeTitle:'Μικροβιολογία / Εργαστήριο',responsibilities:'Παρουσίαση μικροβιολογικών δεδομένων και μικροβιακής αντοχής.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'},
  {id:'CM-SEED-4',employeeId:'',name:'Α. Δημητρίου',department:'Ποιότητα',profession:'Στέλεχος Ποιότητας',committeeTitle:'Ποιότητα & Ασφάλεια',responsibilities:'Παρακολούθηση διορθωτικών ενεργειών και τεκμηρίωση βελτίωσης.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'}
 ],meetings:[
  {id:'MTG-2026-08',date:'2026-08-18',title:'Τακτική συνεδρίαση Αυγούστου',status:'finalized',attendance:4,quorum:true,minutesNo:'ΠΡ-08/2026',agenda:['Δείκτες λοιμώξεων','Κατανάλωση αντιμικροβιακών','Εκκρεμείς διορθωτικές ενέργειες'],notes:'Εγκρίθηκαν τα πρακτικά και οι σχετικές ενέργειες.',finalizedAt:'2026-08-19T09:20:00Z'},
  {id:'MTG-2026-09',date:'2026-09-15',title:'Τακτική συνεδρίαση Σεπτεμβρίου',status:'planned',attendance:0,quorum:null,minutesNo:'',agenda:['Ανασκόπηση CLABSI/CAUTI','Εκπαίδευση προσωπικού'],notes:''}
 ],decisions:[
  {id:'DEC-024',meetingId:'MTG-2026-08',title:'Ενίσχυση συμμόρφωσης υγιεινής χεριών στη ΜΕΘ',owner:'Προϊσταμένη ΜΕΘ',dueDate:'2026-09-10',priority:'high',status:'in_progress',action:'Επαναληπτική εκπαίδευση και στοχευμένες παρατηρήσεις των 5 Στιγμών του ΠΟΥ.'},
  {id:'DEC-025',meetingId:'MTG-2026-08',title:'Ανασκόπηση δέσμης κεντρικών γραμμών',owner:'Υπεύθυνος Λοιμώξεων',dueDate:'2026-09-05',priority:'medium',status:'open',action:'Έλεγχος συμμόρφωσης και παρουσίαση αποτελεσμάτων στην επόμενη συνεδρίαση.'}
 ],annualPlan:[
  {id:'OBJ-001',title:'Βελτίωση συμμόρφωσης υγιεινής χεριών',indicator:'Συμμόρφωση στις 5 Στιγμές του ΠΟΥ',baseline:'78%',target:'≥ 90%',owner:'Ομάδα IPC / Κλινικοί Σύνδεσμοι',dueDate:'2026-12-31',status:'in_progress'},
  {id:'OBJ-002',title:'Μείωση CLABSI στη ΜΕΘ',indicator:'CLABSI / 1.000 device-days',baseline:'2,4',target:'< 1,5',owner:'ΕΝΛ / ΜΕΘ',dueDate:'2026-12-31',status:'in_progress'},
  {id:'OBJ-003',title:'Ετήσια εκπαίδευση IPC προσωπικού',indicator:'Κάλυψη ενεργού προσωπικού',baseline:'62%',target:'≥ 95%',owner:'Ομάδα Εκπαίδευσης IPC',dueDate:'2026-11-30',status:'open'}
 ],history:[{at:'2026-08-19T09:20:00Z',actor:'Demo seed',action:'Πρακτικά οριστικοποιήθηκαν',reason:'Εγκεκριμένα από τη συνεδρίαση'}]},
 {id:'COM-002',decisionNumber:'Απόφαση Δ.Σ. 32/18.12.2024',meetingFrequency:'monthly',quorumRule:'simple_majority',templateId:'oekocha',name:'Επιτροπή Αντιμικροβιακής Επιτήρησης',shortName:'ΕΑΕ',type:'antimicrobial',status:'active',chair:'Δρ. Ν. Γεωργίου',secretary:'Ι. Σταύρου',termStart:'2025-01-01',termEnd:'2026-12-31',committeeRole:'Παρακολουθεί την ορθολογική χρήση αντιμικροβιακών, την κατανάλωση (DDD) και τις τάσεις αντοχής, σε συνεργασία με την ΕΝΛ, το Μικροβιολογικό και το Φαρμακείο.',legalBasis:'ΕΟΔΥ Εθνικό Πρόγραμμα Antimicrobial Stewardship · WHO AWaRe Framework',mandate:'Παρακολούθηση ορθολογικής χρήσης αντιμικροβιακών, κατανάλωσης και αντοχής.',members:['Δρ. Ν. Γεωργίου','Ι. Σταύρου','Κλινικός Φαρμακοποιός','Γ. Νικολάου'],memberRefs:[
  {id:'CM-SEED-5',employeeId:'',name:'Δρ. Ν. Γεωργίου',department:'Παθολογική Κλινική',profession:'Ιατρός Λοιμωξιολόγος',committeeTitle:'Πρόεδρος',responsibilities:'Συντονισμός ΕΑΕ, κλινική έγκριση περιοριστικών πρωτοκόλλων συνταγογράφησης.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'},
  {id:'CM-SEED-6',employeeId:'',name:'Ι. Σταύρου',department:'Φαρμακείο',profession:'Κλινικός Φαρμακοποιός',committeeTitle:'Γραμματέας',responsibilities:'Ανάλυση κατανάλωσης (DDD/100 ημέρες νοσηλείας), κατηγοριοποίηση AWaRe, πρακτικά.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'},
  {id:'CM-SEED-7',employeeId:'',name:'Γ. Νικολάου',department:'Μικροβιολογικό',profession:'Μικροβιολόγος',committeeTitle:'Μικροβιολογία / Αντοχή',responsibilities:'Παρουσίαση τάσεων MDR/XDR και δεδομένων ευαισθησίας.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'}
 ],meetings:[
  {id:'MTG-2026-07-AMS',date:'2026-07-21',title:'Τακτική συνεδρίαση Ιουλίου',status:'finalized',attendance:3,quorum:true,minutesNo:'ΠΡ-ΕΑΕ-07/2026',agenda:['Κατανάλωση αντιμικροβιακών (DDD/100 ημέρες νοσηλείας)','Κατηγοριοποίηση WHO AWaRe','Περιοριστική συνταγογράφηση καρβαπενεμών'],notes:'Εγκρίθηκε περιοριστικό πρωτόκολλο για καρβαπενέμες με υποχρεωτική γνωμάτευση λοιμωξιολόγου.',finalizedAt:'2026-07-22T10:00:00Z'},
  {id:'MTG-2026-10-AMS',date:'2026-10-06',title:'Τακτική συνεδρίαση Οκτωβρίου',status:'planned',attendance:0,quorum:null,minutesNo:'',agenda:['Ανασκόπηση συμμόρφωσης περιοριστικού πρωτοκόλλου','Τάσεις αντοχής 3ου τριμήνου'],notes:''}
 ],decisions:[
  {id:'DEC-AMS-001',meetingId:'MTG-2026-07-AMS',title:'Περιοριστική συνταγογράφηση καρβαπενεμών',owner:'Δρ. Ν. Γεωργίου',dueDate:'2026-08-15',priority:'high',status:'in_progress',action:'Υποχρεωτική γνωμάτευση λοιμωξιολόγου πριν την έναρξη καρβαπενέμης πλην επειγόντων.'},
  {id:'DEC-AMS-002',meetingId:'MTG-2026-07-AMS',title:'Έλεγχος δοσολογίας βανκομυκίνης',owner:'Ι. Σταύρου',dueDate:'2026-09-01',priority:'medium',status:'open',action:'Οπτικός έλεγχος επιπέδων και προσαρμογή δοσολογικού σχήματος σε νεφρική δυσλειτουργία.'}
 ],annualPlan:[
  {id:'OBJ-AMS-001',title:'Αύξηση ποσοστού αντιμικροβιακών κατηγορίας Access (WHO AWaRe)',indicator:'% κατανάλωσης Access',baseline:'52%',target:'≥ 60%',owner:'Ομάδα Antimicrobial Stewardship',dueDate:'2026-12-31',status:'in_progress'},
  {id:'OBJ-AMS-002',title:'Μείωση κατανάλωσης καρβαπενεμών',indicator:'DDD καρβαπενεμών / 100 ημέρες νοσηλείας',baseline:'3,1',target:'< 2,0',owner:'ΕΑΕ / Φαρμακείο',dueDate:'2026-12-31',status:'in_progress'}
 ],history:[{at:'2026-07-22T10:00:00Z',actor:'Demo seed',action:'Πρακτικά οριστικοποιήθηκαν',reason:'Εγκεκριμένα από τη συνεδρίαση'}]}
]
// The year behind the latest meetings (authored 2025-09 … 2026-07): monthly ΕΝΛ
// and bimonthly ΕΑΕ meetings with finalized minutes and the decisions they took.
const MONTH_GENITIVE=['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου']
const pastMeeting=(prefix,minutesPrefix,month,day,attendance,agenda,notes)=>{const [year,value]=month.split('-');return {id:`MTG-${month}${prefix}`,date:`${month}-${day}`,title:`Τακτική συνεδρίαση ${MONTH_GENITIVE[Number(value)-1]}`,status:'finalized',attendance,quorum:true,minutesNo:`${minutesPrefix}-${value}/${year}`,agenda,notes,finalizedAt:`${month}-${String(Number(day)+1).padStart(2,'0')}T09:00:00Z`}}
const ENL_HISTORY=[
 ['2025-09','16',['Ετήσια ανασκόπηση δεικτών ΛΣΦΥ 2024–25','Πρόγραμμα παρατηρήσεων υγιεινής χεριών'],'Εγκρίθηκε το ετήσιο πρόγραμμα παρατηρήσεων.'],
 ['2025-10','21',['Αποτελέσματα επιθεώρησης δέσμης CLABSI','Εποχική γρίπη: εμβολιασμός προσωπικού'],'Ανατέθηκε διορθωτική ενέργεια για την τεκμηρίωση CVC.'],
 ['2025-11','18',['Μελέτη επιπολασμού Νοεμβρίου','Κρούσματα KPC στη ΜΕΘ'],'Εντατικοποίηση ενεργητικής επιτήρησης KPC.'],
 ['2025-12','16',['Ανάλυση αιτίων CLABSI στη ΜΕΝΝ','Προγραμματισμός εκπαιδεύσεων 2026'],'Εγκρίθηκε η εκπαίδευση απολύμανσης hub.'],
 ['2026-01','20',['Ετήσιος απολογισμός ΕΝΛ 2025','Στόχοι 2026'],'Εγκρίθηκε το ετήσιο πρόγραμμα δράσης.'],
 ['2026-02','17',['Κατανάλωση αλκοολούχου αντισηπτικού','Πρόληψη CAUTI: αποτελέσματα εκπαίδευσης'],'Αύξηση σημείων αντισηπτικού στην Παθολογική.'],
 ['2026-03','17',['Δέσμη SSI: ευρήματα επιθεώρησης','Επιτήρηση Legionella στο δίκτυο νερού'],'Απόσυρση ξυραφιών από τα χειρουργεία.'],
 ['2026-04','21',['Συρροή Acinetobacter baumannii','Καθαρισμός θαλάμων απομόνωσης'],'Ενισχυμένος καθαρισμός και έλεγχος με φθορίζουσα σήμανση.'],
 ['2026-05','19',['Μελέτη επιπολασμού Μαΐου','Δείκτες υγιεινής χεριών Α΄ τριμήνου'],'Η συμμόρφωση ξεπέρασε το 80% για πρώτη φορά.'],
 ['2026-06','16',['Ουρολοιμώξεις στη Χειρουργική','Ανασκόπηση δεσμών μέτρων ΜΕΘ'],'Πρωτόκολλο αφαίρεσης ουροκαθετήρα από νοσηλευτή.'],
 ['2026-07','21',['Θερινή κάλυψη προσωπικού IPC','Επιτήρηση MDRO Α΄ εξαμήνου'],'Εγκρίθηκε η έκθεση εξαμήνου.'],
]
const AMS_HISTORY=[
 ['2025-09','23',['Κατανάλωση αντιμικροβιακών 2024–25','Δείκτες AWaRe'],'Στόχος Access ≥ 60% για το 2026.'],
 ['2025-11','25',['Γνωμάτευση λοιμωξιολόγου για καρβαπενέμες','Τάσεις KPC'],'Πιλοτική εφαρμογή στη ΜΕΘ.'],
 ['2026-01','27',['Ετήσιος απολογισμός ΕΑΕ 2025','Περιεγχειρητική προφύλαξη'],'Ενιαίο πρωτόκολλο προφύλαξης με κεφαζολίνη.'],
 ['2026-03','24',['Αποκλιμάκωση αγωγής στις 72 ώρες','Δεδομένα ευαισθησίας Pseudomonas'],'Υπενθύμιση αποκλιμάκωσης στο σύστημα συνταγογράφησης.'],
 ['2026-05','26',['Κατανάλωση Α΄ τριμήνου','Επεισόδια C. difficile'],'Περιορισμός κινολονών στην Παθολογική.'],
]
seed[0].meetings.push(...ENL_HISTORY.map(([month,day,agenda,notes],i)=>pastMeeting('','ΠΡ',month,day,i%4===2?3:4,agenda,notes)))
seed[1].meetings.push(...AMS_HISTORY.map(([month,day,agenda,notes])=>pastMeeting('-AMS','ΠΡ-ΕΑΕ',month,day,3,agenda,notes)))
seed[0].decisions.push(
 {id:'DEC-014',meetingId:'MTG-2025-10',title:'Υποχρεωτική καταγραφή ημερομηνίας τοποθέτησης CVC',owner:'Προϊσταμένη ΜΕΘ',dueDate:'2025-11-15',priority:'high',status:'completed',action:'Πεδίο στο φύλλο νοσηλείας και έλεγχος σε 4 εβδομάδες.'},
 {id:'DEC-016',meetingId:'MTG-2025-11',title:'Ενεργητική επιτήρηση KPC στις εισαγωγές ΜΕΘ',owner:'Υπεύθυνος Λοιμώξεων',dueDate:'2025-12-01',priority:'high',status:'completed',action:'Ορθικό επίχρισμα σε κάθε εισαγωγή και εβδομαδιαία.'},
 {id:'DEC-018',meetingId:'MTG-2025-12',title:'Εκπαίδευση απολύμανσης hub στη ΜΕΝΝ',owner:'Υπεύθυνος ΜΕΝΝ',dueDate:'2026-01-31',priority:'high',status:'completed',action:'Πρακτική εκπαίδευση όλου του νοσηλευτικού προσωπικού.'},
 {id:'DEC-020',meetingId:'MTG-2026-02',title:'Νέα σημεία αλκοολούχου αντισηπτικού',owner:'Προϊστάμενος Παθολογικής',dueDate:'2026-03-15',priority:'medium',status:'completed',action:'Βάση αντισηπτικού σε κάθε κλίνη.'},
 {id:'DEC-021',meetingId:'MTG-2026-04',title:'Ενισχυμένος καθαρισμός θαλάμων απομόνωσης',owner:'Υπεύθυνος Καθαριότητας',dueDate:'2026-05-10',priority:'high',status:'completed',action:'Διπλός καθαρισμός και έλεγχος με φθορίζουσα σήμανση.'},
 {id:'DEC-023',meetingId:'MTG-2026-06',title:'Πρωτόκολλο αφαίρεσης ουροκαθετήρα από νοσηλευτή',owner:'Προϊστάμενος Χειρουργικής',dueDate:'2026-07-20',priority:'high',status:'in_progress',action:'Καθημερινή λίστα ελέγχου ανάγκης ουροκαθετήρα.'},
)
seed[1].decisions.push(
 {id:'DEC-AMS-P01',meetingId:'MTG-2025-11-AMS',title:'Γνωμάτευση λοιμωξιολόγου για καρβαπενέμες στη ΜΕΘ',owner:'Δρ. Ν. Γεωργίου',dueDate:'2025-12-15',priority:'high',status:'completed',action:'Πιλοτική εφαρμογή τριών μηνών.'},
 {id:'DEC-AMS-P02',meetingId:'MTG-2026-01-AMS',title:'Ενιαίο πρωτόκολλο περιεγχειρητικής προφύλαξης',owner:'Ι. Σταύρου',dueDate:'2026-02-28',priority:'medium',status:'completed',action:'Κεφαζολίνη εντός 60 λεπτών, μία δόση.'},
 {id:'DEC-AMS-P03',meetingId:'MTG-2026-05-AMS',title:'Περιορισμός κινολονών στην Παθολογική',owner:'Δρ. Ν. Γεωργίου',dueDate:'2026-07-31',priority:'medium',status:'in_progress',action:'Έγκριση λοιμωξιολόγου για κινολόνες πέραν των 48 ωρών.'},
)
// The months before (owner, 9/11/2026: the Demo shows the whole of 2025): the ΕΝΛ every month and the ΕΑΕ every
// other month from January 2025 as shown (DEMO_HISTORY_MONTHS), with a decision at every other meeting.
const ENL_EARLY_TOPICS=[
 [['Ετήσιος απολογισμός ΕΝΛ','Πρόγραμμα δράσης του έτους'],'Εγκρίθηκε το πρόγραμμα δράσης του έτους.','Ενημέρωση των τμημάτων για το πρόγραμμα δράσης','Υπεύθυνος Λοιμώξεων'],
 [['Επιτήρηση MDRO στη ΜΕΘ','Δείκτες υγιεινής χεριών'],'Ενεργητική επιτήρηση στις εισαγωγές της ΜΕΘ.','Επιχρίσματα επιτήρησης σε κάθε εισαγωγή ΜΕΘ','Προϊσταμένη ΜΕΘ'],
 [['Κατανάλωση αλκοολούχου αντισηπτικού','Εκπαίδευση νέου προσωπικού'],'Εισαγωγική εκπαίδευση IPC για κάθε νέο συνάδελφο.','Εισαγωγική εκπαίδευση IPC νέου προσωπικού','Ομάδα Εκπαίδευσης IPC'],
 [['Μελέτη επιπολασμού','Καθαριότητα θαλάμων απομόνωσης'],'Η μελέτη επιπολασμού ολοκληρώθηκε χωρίς αποκλίσεις.','Έλεγχος καθαριότητας με φθορίζουσα σήμανση','Υπεύθυνος Καθαριότητας'],
 [['Δέσμη CAUTI','Επιτήρηση Legionella στο δίκτυο νερού'],'Καθημερινή αξιολόγηση της ανάγκης ουροκαθετήρα.','Λίστα ελέγχου ανάγκης ουροκαθετήρα','Νοσηλευτική Διεύθυνση'],
 [['Θερινή κάλυψη προσωπικού IPC','Δείκτες Α΄ εξαμήνου'],'Εγκρίθηκε η έκθεση του εξαμήνου.','Έκθεση εξαμήνου προς τη Διοίκηση','Υπεύθυνος Λοιμώξεων'],
]
const AMS_EARLY_TOPICS=[
 [['Κατανάλωση αντιμικροβιακών (DDD/100 ημέρες νοσηλείας)','Τάσεις αντοχής'],'Μηνιαία αναφορά κατανάλωσης στα τμήματα.','Μηνιαία αναφορά DDD ανά τμήμα','Ι. Σταύρου'],
 [['Αποκλιμάκωση αγωγής','Δεδομένα ευαισθησίας Klebsiella'],'Υπενθύμιση επανεκτίμησης αγωγής στις 72 ώρες.','Επανεκτίμηση αντιβιοτικής αγωγής στις 72 ώρες','Δρ. Ν. Γεωργίου'],
 [['Περιεγχειρητική προφύλαξη','Κατηγοριοποίηση WHO AWaRe'],'Έλεγχος διάρκειας προφύλαξης στα χειρουργεία.','Προφύλαξη έως 24 ώρες μετά την επέμβαση','Ι. Σταύρου'],
]
const earlyMonths=DEMO_HISTORY_MONTHS.filter(month=>month<'2025-09')
earlyMonths.forEach((month,i)=>{
 const [agenda,notes,decision,owner]=ENL_EARLY_TOPICS[i%ENL_EARLY_TOPICS.length]
 seed[0].meetings.push(pastMeeting('','ΠΡ',month,String(14+i%4*2),i%5===3?3:4,agenda,notes))
 if(i%2===0)seed[0].decisions.push({id:`DEC-${month}-H`,meetingId:`MTG-${month}`,title:decision,owner,dueDate:addDays(`${month}-20`,35),priority:i%4===0?'high':'medium',status:'completed',action:notes})
})
earlyMonths.filter(month=>Number(month.slice(5,7))%2===1).forEach((month,i)=>{
 const [agenda,notes,decision,owner]=AMS_EARLY_TOPICS[i%AMS_EARLY_TOPICS.length]
 seed[1].meetings.push(pastMeeting('-AMS','ΠΡ-ΕΑΕ',month,'23',3,agenda,notes))
 if(i%2===0)seed[1].decisions.push({id:`DEC-AMS-${month}-H`,meetingId:`MTG-${month}-AMS`,title:decision,owner,dueDate:addDays(`${month}-23`,40),priority:'medium',status:'completed',action:notes})
})
// Three more committees with their meetings over the whole history, a planned next meeting and their annual plan.
const member=(id,name,department,profession,committeeTitle,responsibilities)=>({id,employeeId:'',name,department,profession,committeeTitle,responsibilities,voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2025-01-01T00:00:00Z'})
const MORE_COMMITTEES=[
 {id:'COM-003',decisionNumber:'Απόφαση Δ.Σ. 33/18.12.2024',meetingFrequency:'bimonthly',quorumRule:'simple_majority',templateId:'custom',name:'Επιτροπή Ποιότητας και Ασφάλειας Ασθενών',shortName:'ΕΠΑΑ',type:'custom',status:'active',chair:'Δρ. Κ. Αναστασίου',secretary:'Α. Δημητρίου',termStart:'2025-01-01',termEnd:'2026-12-31',
  committeeRole:'Εποπτεύει το σύστημα διαχείρισης ποιότητας, τα ανεπιθύμητα συμβάντα και την ασφάλεια των ασθενών.',legalBasis:'Ν. 4600/2019 · ISO 9001:2015 · ISO 15224:2016',mandate:'Ανασκόπηση συμβάντων, επιθεωρήσεων και δεικτών ποιότητας· έγκριση διορθωτικών ενεργειών.',
  people:[['CM-SEED-8','Δρ. Κ. Αναστασίου','Ιατρική Υπηρεσία','Ιατρός','Πρόεδρος','Συντονισμός της επιτροπής και εισήγηση προς τη Διοίκηση.'],['CM-SEED-9','Α. Δημητρίου','Ποιότητα','Στέλεχος Ποιότητας','Γραμματέας','Ημερήσια διάταξη, πρακτικά και παρακολούθηση ενεργειών.'],['CM-SEED-10','Ε. Μιχαηλίδου','Νοσηλευτική Υπηρεσία','Νοσηλευτής/τρια','Μέλος','Εκπροσώπηση της Νοσηλευτικής Υπηρεσίας.'],['CM-SEED-11','Π. Ραφαηλίδης','Διοικητική Υπηρεσία','Διοικητικός','Μέλος','Πόροι και προμήθειες.']],
  every:2,offset:0,day:'12',
  topics:[[['Ανεπιθύμητα συμβάντα του διμήνου','Πορεία διορθωτικών ενεργειών'],'Ανασκοπήθηκαν τα συμβάντα και οι ανοιχτές ενέργειες.','Ανάλυση αιτίων για τα σοβαρά συμβάντα','Α. Δημητρίου'],[['Αποτελέσματα εσωτερικών επιθεωρήσεων','Ικανοποίηση ασθενών'],'Τα ευρήματα των επιθεωρήσεων κλείνουν εντός προθεσμίας.','Επαναληπτική επιθεώρηση στα τμήματα με ευρήματα','Υπεύθυνος Ποιότητας'],[['Δείκτες ποιότητας','Στόχοι ποιότητας του έτους'],'Οι περισσότεροι δείκτες είναι εντός στόχου.','Σχέδιο βελτίωσης για τους δείκτες εκτός στόχου','Δρ. Κ. Αναστασίου']],
  plan:[['Μείωση πτώσεων ασθενών με κάκωση','Πτώσεις με κάκωση / 1.000 ημέρες νοσηλείας','0,9','< 0,5'],['Κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας','% ενεργειών που κλείνουν εμπρόθεσμα','68%','≥ 85%']]},
 {id:'COM-004',decisionNumber:'Απόφαση Δ.Σ. 34/18.12.2024',meetingFrequency:'quarterly',quorumRule:'simple_majority',templateId:'custom',name:'Επιτροπή Φαρμάκων και Θεραπευτικής',shortName:'ΕΦΘ',type:'custom',status:'active',chair:'Δρ. Σ. Παππάς',secretary:'Ι. Σταύρου',termStart:'2025-01-01',termEnd:'2026-12-31',
  committeeRole:'Διαμορφώνει το συνταγολόγιο του νοσοκομείου και παρακολουθεί την ασφαλή χρήση των φαρμάκων.',legalBasis:'Ν. 3918/2011 · Οδηγίες ΕΟΦ',mandate:'Συνταγολόγιο, φάρμακα υψηλού κινδύνου, λάθη φαρμακευτικής αγωγής και φαρμακοεπαγρύπνηση.',
  people:[['CM-SEED-12','Δρ. Σ. Παππάς','Παθολογική Κλινική','Ιατρός','Πρόεδρος','Συντονισμός της επιτροπής.'],['CM-SEED-13','Ι. Σταύρου','Φαρμακείο','Κλινικός Φαρμακοποιός','Γραμματέας','Συνταγολόγιο, αναφορές λαθών και πρακτικά.'],['CM-SEED-14','Δρ. Μ. Καραγιάννη','Αναισθησιολογικό','Ιατρός','Μέλος','Φάρμακα αναισθησίας και αναλγησίας.']],
  every:3,offset:0,day:'09',
  topics:[[['Λάθη φαρμακευτικής αγωγής του τριμήνου','Φάρμακα υψηλού κινδύνου'],'Τα περισσότερα λάθη εντοπίστηκαν πριν τη χορήγηση.','Διπλός έλεγχος σε ινσουλίνη και ηπαρίνη','Ι. Σταύρου'],[['Αιτήματα ένταξης στο συνταγολόγιο','Ελλείψεις φαρμάκων'],'Εγκρίθηκαν δύο νέα σκευάσματα.','Ενημέρωση του συνταγολογίου στο σύστημα','Φαρμακείο'],[['Φαρμακοεπαγρύπνηση','Συμφιλίωση φαρμάκων στην έξοδο'],'Τρεις αναφορές κίτρινης κάρτας προς τον ΕΟΦ.','Συμφιλίωση φαρμάκων σε κάθε έξοδο','Δρ. Σ. Παππάς']],
  plan:[['Συμφιλίωση φαρμάκων σε κάθε έξοδο','% εξόδων με συμφιλίωση','64%','≥ 90%'],['Διπλός έλεγχος φαρμάκων υψηλού κινδύνου','% χορηγήσεων με διπλό έλεγχο','81%','≥ 95%']]},
 {id:'COM-005',decisionNumber:'Απόφαση Δ.Σ. 35/18.12.2024',meetingFrequency:'quarterly',quorumRule:'simple_majority',templateId:'custom',name:'Επιτροπή Υγιεινής και Ασφάλειας της Εργασίας',shortName:'ΕΥΑΕ',type:'custom',status:'active',chair:'Δρ. Θ. Λαμπράκης',secretary:'Ν. Χατζή',termStart:'2025-01-01',termEnd:'2026-12-31',
  committeeRole:'Παρακολουθεί την υγεία και την ασφάλεια των εργαζομένων του νοσοκομείου.',legalBasis:'Ν. 3850/2010 (ΚΝΥΑΕ)',mandate:'Εργατικά ατυχήματα, εκθέσεις σε αιχμηρά, εμβολιασμοί προσωπικού και εκτίμηση επαγγελματικού κινδύνου.',
  people:[['CM-SEED-15','Δρ. Θ. Λαμπράκης','Ιατρείο Εργασίας','Ιατρός Εργασίας','Πρόεδρος','Συντονισμός και εισηγήσεις μέτρων.'],['CM-SEED-16','Ν. Χατζή','Τεχνική Υπηρεσία','Τεχνικός Ασφαλείας','Γραμματέας','Αυτοψίες χώρων και πρακτικά.'],['CM-SEED-17','Γ. Αλεξίου','Νοσηλευτική Υπηρεσία','Νοσηλευτής/τρια','Εκπρόσωπος εργαζομένων','Εκπροσώπηση του προσωπικού.']],
  every:3,offset:1,day:'19',
  topics:[[['Εκθέσεις σε αιχμηρά του τριμήνου','Συσκευές ασφαλείας'],'Οι εκθέσεις μειώθηκαν μετά τις συσκευές ασφαλείας.','Συσκευές ασφαλείας και στο ΤΕΠ','Ν. Χατζή'],[['Εμβολιασμοί προσωπικού','Εποχική γρίπη'],'Η κάλυψη του αντιγριπικού εμβολιασμού είναι χαμηλή.','Εμβολιασμός στα τμήματα με κινητό συνεργείο','Δρ. Θ. Λαμπράκης'],[['Αυτοψία χώρων εργασίας','Μετακινήσεις ασθενών'],'Εντοπίστηκαν κίνδυνοι στις μετακινήσεις βαριών ασθενών.','Βοηθήματα μετακίνησης ασθενών','Γ. Αλεξίου']],
  plan:[['Μείωση εκθέσεων σε αιχμηρά','Εκθέσεις / 100 εργαζόμενους','3,2','< 2,0'],['Αντιγριπικός εμβολιασμός προσωπικού','% εμβολιασμένου προσωπικού','42%','≥ 60%']]},
]
for(const {people,every,offset,day,topics,plan,...committee} of MORE_COMMITTEES){
 const short=committee.shortName
 const months=DEMO_HISTORY_MONTHS.filter(month=>(Number(month.slice(5,7))-1-offset+12)%every===0)
 const meetings=months.map((month,i)=>{const [agenda,notes]=topics[i%topics.length];return pastMeeting(`-${committee.id}`,`ΠΡ-${short}`,month,day,people.length-(i%4===1?1:0),agenda,notes)})
 const decisions=months.map((month,i)=>{const [,notes,title,owner]=topics[i%topics.length],recent=i>=months.length-2;return {id:`DEC-${committee.id}-${month}`,meetingId:`MTG-${month}-${committee.id}`,title,owner,dueDate:addDays(`${month}-${day}`,45),priority:i%3===0?'high':'medium',status:recent?(i===months.length-1?'open':'in_progress'):'completed',action:notes}})
 const last=months[months.length-1],[year,month]=last.split('-').map(Number),next=new Date(Date.UTC(year,month-1+every,1)).toISOString().slice(0,7)
 meetings.push({id:`MTG-${next}-${committee.id}`,date:`${next}-${day}`,title:`Τακτική συνεδρίαση ${MONTH_GENITIVE[Number(next.slice(5,7))-1]}`,status:'planned',attendance:0,quorum:null,minutesNo:'',agenda:topics[months.length%topics.length][0],notes:''})
 seed.push({...committee,members:people.map(person=>person[1]),memberRefs:people.map(person=>member(...person)),meetings:meetings.reverse(),decisions:decisions.reverse(),
  annualPlan:plan.map(([title,indicator,baseline,target],i)=>({id:`OBJ-${short}-00${i+1}`,title,indicator,baseline,target,owner:committee.chair,dueDate:'2026-12-31',status:'in_progress'})),
  history:[{at:`${last}-${String(Number(day)+1).padStart(2,'0')}T09:00:00Z`,actor:'Demo seed',action:'Πρακτικά οριστικοποιήθηκαν',reason:'Εγκεκριμένα από τη συνεδρίαση'}]})
}
// Demo dates follow today (src/core/data/demoClock.js): meetings by whole months,
// decision deadlines by days.
shiftDemoMonthsInPlace(seed.map(committee=>committee.meetings))
shiftDemoDatesInPlace(seed.map(committee=>committee.decisions))
export function inferTemplate(r){if(r.templateId)return r.templateId;const n=`${r.shortName||''} ${r.name||''}`.toLowerCase();if(n.includes('ενλ')||n.includes('νοσοκομειακών λοιμ'))return'enl';if(n.includes('αντιμικροβ')||n.includes('αντιβιο'))return'oekocha';return'custom'}
function normalizeMeeting(meeting){
 const topics=Array.isArray(meeting.topics)&&meeting.topics.length?meeting.topics:(meeting.agenda||[]).map((subject,i)=>({id:`LEG-${meeting.id}-${i}`,subject,decision:i===0?(meeting.notes||''):'',followUp:false,action:'',owner:'',dueDate:'',priority:'medium'}))
 return {...meeting,topics,attendanceRecords:Array.isArray(meeting.attendanceRecords)?meeting.attendanceRecords:[],generalNotes:meeting.generalNotes??'',approvalState:meeting.approvalState??(meeting.status==='finalized'?'completed':'not_started')}
}
function normalizeRecord(r){
 const memberRefs=Array.isArray(r.memberRefs)&&r.memberRefs.length?r.memberRefs:(r.members||[]).map((name,i)=>({id:`LEGACY-${r.id}-${i}`,employeeId:'',name,department:'',profession:'',committeeTitle:name===r.chair?'Πρόεδρος':name===r.secretary?'Γραμματέας':'Μέλος',responsibilities:'',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:r.termStart?`${r.termStart}T00:00:00Z`:null}))
 return {...r,templateId:inferTemplate(r),memberRefs,meetings:(Array.isArray(r.meetings)?r.meetings:[]).map(normalizeMeeting),decisions:Array.isArray(r.decisions)?r.decisions:[],annualPlan:Array.isArray(r.annualPlan)?r.annualPlan:[],history:Array.isArray(r.history)?r.history:[]}
}
export function loadCommittees(){const v=loadSnapshot('committees',structuredClone(seed));return (Array.isArray(v)?v:structuredClone(seed)).map(normalizeRecord)}
export function saveCommittees(rows){return saveSnapshot('committees',rows)}
export function nextCommitteeId(rows){return `COM-${String(rows.length+1).padStart(3,'0')}`}
