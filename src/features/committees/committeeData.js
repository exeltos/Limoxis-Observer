import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
const seed=[
 {id:'COM-001',templateId:'enl',name:'Επιτροπή Νοσοκομειακών Λοιμώξεων',shortName:'ΕΝΛ',type:'infection_control',status:'active',chair:'Δρ. Ελένη Παπαδοπούλου',secretary:'Μαρία Κωνσταντίνου',termStart:'2026-01-01',termEnd:'2027-12-31',committeeRole:'Κεντρικό θεσμικό όργανο του νοσοκομείου για την επιτήρηση, πρόληψη και τον έλεγχο των λοιμώξεων που συνδέονται με τη φροντίδα υγείας.',legalBasis:'ΥΑ Υ1.Γ.Π.114971/2014 · ισχύουσα πράξη συγκρότησης φορέα · WHO IPC Core Components',mandate:'Επιτήρηση, πρόληψη και έλεγχος λοιμώξεων, εφαρμογή μέτρων IPC και παρακολούθηση σχετικών δεικτών.',members:['Δρ. Ελένη Παπαδοπούλου','Μαρία Κωνσταντίνου','Γ. Νικολάου','Α. Δημητρίου'],memberRefs:[
  {id:'CM-SEED-1',employeeId:'',name:'Δρ. Ελένη Παπαδοπούλου',department:'Ιατρική Υπηρεσία',profession:'Ιατρός',committeeTitle:'Πρόεδρος',responsibilities:'Συντονισμός της ΕΝΛ, έγκριση ημερήσιας διάταξης και εποπτεία εφαρμογής αποφάσεων.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2026-01-01T00:00:00Z'},
  {id:'CM-SEED-2',employeeId:'',name:'Μαρία Κωνσταντίνου',department:'Επιτήρηση Λοιμώξεων',profession:'Νοσηλεύτρια',committeeTitle:'ΝΕΛ / Γραμματέας',responsibilities:'Επιτήρηση HAI, συλλογή και ανατροφοδότηση δεικτών, πρακτικά και παρακολούθηση ενεργειών.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2026-01-01T00:00:00Z'},
  {id:'CM-SEED-3',employeeId:'',name:'Γ. Νικολάου',department:'Μικροβιολογικό',profession:'Μικροβιολόγος',committeeTitle:'Μικροβιολογία / Εργαστήριο',responsibilities:'Παρουσίαση μικροβιολογικών δεδομένων και μικροβιακής αντοχής.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2026-01-01T00:00:00Z'},
  {id:'CM-SEED-4',employeeId:'',name:'Α. Δημητρίου',department:'Ποιότητα',profession:'Στέλεχος Ποιότητας',committeeTitle:'Ποιότητα & Ασφάλεια',responsibilities:'Παρακολούθηση διορθωτικών ενεργειών και τεκμηρίωση βελτίωσης.',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:'2026-01-01T00:00:00Z'}
 ],meetings:[
  {id:'MTG-2026-08',date:'2026-08-18',title:'Τακτική συνεδρίαση Αυγούστου',status:'finalized',attendance:4,quorum:true,minutesNo:'ΠΡ-08/2026',agenda:['Δείκτες λοιμώξεων','Κατανάλωση αντιμικροβιακών','Εκκρεμείς διορθωτικές ενέργειες'],notes:'Εγκρίθηκαν τα πρακτικά και οι σχετικές ενέργειες.',finalizedAt:'2026-08-19T09:20:00Z'},
  {id:'MTG-2026-09',date:'2026-09-15',title:'Τακτική συνεδρίαση Σεπτεμβρίου',status:'planned',attendance:0,quorum:null,minutesNo:'',agenda:['Ανασκόπηση CLABSI/CAUTI','Εκπαίδευση προσωπικού'],notes:''}
 ],decisions:[
  {id:'DEC-024',meetingId:'MTG-2026-08',title:'Ενίσχυση συμμόρφωσης υγιεινής χεριών στη ΜΕΘ',owner:'Προϊσταμένη ΜΕΘ',dueDate:'2026-09-10',priority:'high',status:'in_progress',action:'Επαναληπτική εκπαίδευση και στοχευμένες παρατηρήσεις WHO 5 Moments.'},
  {id:'DEC-025',meetingId:'MTG-2026-08',title:'Ανασκόπηση bundle κεντρικών γραμμών',owner:'Υπεύθυνος Λοιμώξεων',dueDate:'2026-09-05',priority:'medium',status:'open',action:'Έλεγχος συμμόρφωσης και παρουσίαση αποτελεσμάτων στην επόμενη συνεδρίαση.'}
 ],annualPlan:[
  {id:'OBJ-001',title:'Βελτίωση συμμόρφωσης υγιεινής χεριών',indicator:'Συμμόρφωση WHO 5 Moments',baseline:'78%',target:'≥ 90%',owner:'Ομάδα IPC / Κλινικοί Σύνδεσμοι',dueDate:'2026-12-31',status:'in_progress'},
  {id:'OBJ-002',title:'Μείωση CLABSI στη ΜΕΘ',indicator:'CLABSI / 1.000 device-days',baseline:'2,4',target:'< 1,5',owner:'ΕΝΛ / ΜΕΘ',dueDate:'2026-12-31',status:'in_progress'},
  {id:'OBJ-003',title:'Ετήσια εκπαίδευση IPC προσωπικού',indicator:'Κάλυψη ενεργού προσωπικού',baseline:'62%',target:'≥ 95%',owner:'Ομάδα Εκπαίδευσης IPC',dueDate:'2026-11-30',status:'open'}
 ],history:[{at:'2026-08-19T09:20:00Z',actor:'Demo seed',action:'Πρακτικά οριστικοποιήθηκαν',reason:'Εγκεκριμένα από τη συνεδρίαση'}]},
 {id:'COM-002',templateId:'oekocha',name:'Επιτροπή Αντιμικροβιακής Επιτήρησης',shortName:'ΕΑΕ',type:'antimicrobial',status:'active',chair:'Δρ. Ν. Γεωργίου',secretary:'Ι. Σταύρου',termStart:'2026-01-01',termEnd:'2027-12-31',mandate:'Παρακολούθηση ορθολογικής χρήσης αντιμικροβιακών, κατανάλωσης και αντοχής.',members:['Δρ. Ν. Γεωργίου','Ι. Σταύρου','Κλινικός Φαρμακοποιός'],meetings:[],decisions:[],annualPlan:[],history:[]}
]
function inferTemplate(r){if(r.templateId)return r.templateId;const n=`${r.shortName||''} ${r.name||''}`.toLowerCase();if(n.includes('ενλ')||n.includes('νοσοκομειακών λοιμ'))return'enl';if(n.includes('αντιμικροβ')||n.includes('αντιβιο'))return'oekocha';return'custom'}
function normalizeMeeting(meeting){
 const topics=Array.isArray(meeting.topics)&&meeting.topics.length?meeting.topics:(meeting.agenda||[]).map((subject,i)=>({id:`LEG-${meeting.id}-${i}`,subject,decision:i===0?(meeting.notes||''):'',followUp:false,action:'',owner:'',dueDate:'',priority:'medium'}))
 return {...meeting,topics,attendanceRecords:Array.isArray(meeting.attendanceRecords)?meeting.attendanceRecords:[],generalNotes:meeting.generalNotes??'',approvalState:meeting.approvalState??(meeting.status==='finalized'?'completed':'not_started')}
}
function normalizeRecord(r){
 const memberRefs=Array.isArray(r.memberRefs)&&r.memberRefs.length?r.memberRefs:(r.members||[]).map((name,i)=>({id:`LEGACY-${r.id}-${i}`,employeeId:'',name,department:'',profession:'',committeeTitle:name===r.chair?'Πρόεδρος':name===r.secretary?'Γραμματέας':'Μέλος',responsibilities:'',voting:true,memberType:'regular',approvalRequired:false,approvalStatus:'not_required',active:true,startedAt:r.termStart?`${r.termStart}T00:00:00Z`:null}))
 return {...r,templateId:inferTemplate(r),memberRefs,meetings:(Array.isArray(r.meetings)?r.meetings:[]).map(normalizeMeeting),decisions:Array.isArray(r.decisions)?r.decisions:[],annualPlan:Array.isArray(r.annualPlan)?r.annualPlan:[],history:Array.isArray(r.history)?r.history:[]}
}
export function loadCommittees(){const v=loadSnapshot('committees',structuredClone(seed));return (Array.isArray(v)&&v.length?v:structuredClone(seed)).map(normalizeRecord)}
export function saveCommittees(rows){return saveSnapshot('committees',rows)}
export function nextCommitteeId(rows){return `COM-${String(rows.length+1).padStart(3,'0')}`}
