// Demo dates are written relative to now, so they never need the Demo clock.
import { emptyInPreview } from '../../core/preview/emptyPreview'
import { seededRandom } from '../../core/data/demoSeed'
import { nextDueAfterExecution,periodBounds } from './controlDueRules'
const iso=offsetHours=>{
 const d=new Date()
 d.setTime(d.getTime()+offsetHours*60*60*1000)
 return d.toISOString()
}

const departmentRow=name=>({id:name,name})

const definition1={
 id:'ctrl-def-fridge',
 organization_id:'demo-hospital',
 code:'CTRL-DEMO-0001',
 title:'Έλεγχος θερμοκρασίας ψυγείου φαρμάκων',
 category:'Θερμοκρασίες',
 description:'Καταγραφή θερμοκρασίας ψυγείου φαρμάκων στην αρχή κάθε βάρδιας.',
 owner_id:null,
 response_config:{mode:'numeric',unit:'°C',min:2,max:8,label:'Θερμοκρασία',criticality:'high',requiresEvidence:true,deviationActions:'1. Μεταφορά φαρμάκων και εμβολίων στο εφεδρικό ψυγείο.\n2. Ενημέρωση φαρμακείου και προϊσταμένου βάρδιας.\n3. Νέα μέτρηση σε 30 λεπτά και καταγραφή συμβάντος.',__meta:{titleEn:'Pharmacy fridge temperature check',ownerLabel:'Υπεύθυνος βάρδιας',equipment:'Ψυγείο φαρμάκων',location:'Σταθμός νοσηλευτών',createdByScope:'infection_control',createdForDepartment:null,createdByName:'',updatedByName:''}},
 frequency_config:{kind:'daily',timesPerDay:1,times:['09:00'],interval:1},
 status:'active',
 created_by:'',
 updated_by:'',
 created_at:iso(-24*30),
 updated_at:iso(-24*10),
}

const definition2={
 id:'ctrl-def-disinfect',
 organization_id:'demo-hospital',
 code:'CTRL-DEMO-0002',
 title:'Έλεγχος συμμόρφωσης απολύμανσης επιφανειών',
 category:'Καθαριότητα / Απολύμανση',
 description:'Οπτικός έλεγχος συμμόρφωσης απολύμανσης επιφανειών υψηλής επαφής.',
 owner_id:null,
 response_config:{mode:'choice',options:['Συμμορφώνεται','Μη συμμόρφωση'],label:'Κατάσταση',__meta:{titleEn:'Surface disinfection compliance check',ownerLabel:'Προϊστάμενος τμήματος',createdByScope:'infection_control',createdForDepartment:null,createdByName:'',updatedByName:''}},
 frequency_config:{kind:'weekly',interval:1,timesPerDay:1,times:['09:00']},
 status:'active',
 created_by:'',
 updated_by:'',
 created_at:iso(-24*20),
 updated_at:iso(-24*6),
}

// The ten items the demo expiry check goes through, with expiry dates around
// today so the list shows items that expire soon and a couple already expired.
function demoExpiryCatalogue(){
 const on=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
 return [['Adrenaline 1mg/ml',10,'ampoule',-6,''],['Atropine 0.5mg/ml',6,'ampoule',12,''],['Amiodarone 150mg/3ml',4,'ampoule',75,''],['Φυσιολογικός ορός 0,9% 500ml',24,'bottle',160,''],['Ηπαρίνη 5.000 IU/ml',8,'vial',25,'Στο ψυγείο'],['Midazolam 5mg/ml',5,'ampoule',-2,'Ελεγχόμενο'],['Παρακεταμόλη 500mg',40,'tablet',210,''],['Σύριγγες 10ml',120,'piece',400,''],['Χλωρεξιδίνη 2% διάλυμα',12,'flacon',48,''],['Naloxone 0.4mg/ml',3,'ampoule',19,'Τροχήλατο ανάνηψης']]
  .map(([item,quantity,form,days,note],index)=>({id:`cat-demo-${index+1}`,item,quantity:String(quantity),form,expiry:on(days),note,departments:[]}))
}
const definition3={...definition2,id:'ctrl-def-expiry',code:'CTRL-DEMO-0003',title:'Έλεγχος λήξεων φαρμάκων και υλικών',category:'Λήξεις',description:'Περιοδικός έλεγχος λήξεων φαρμάκων και αναλωσίμων.',response_config:{mode:'list',template:'medication_expiry',label:'Ευρήματα',expiryBeforeDays:30,expiryAfterDays:7,expiryCatalogue:demoExpiryCatalogue(),__meta:{titleEn:'Medication and supply expiry check',ownerLabel:'Προϊστάμενος τμήματος',createdByScope:'infection_control'}},frequency_config:{kind:'monthly',interval:1,timesPerDay:1,times:['10:00']}}
// A weekly checklist audit: every item is answered Yes / No / N/A and the
// entry carries its compliance.
const AUDIT_ITEMS=[
 ['Διαθέσιμο αλκοολούχο αντισηπτικό στο σημείο φροντίδας','Alcohol-based hand rub at the point of care'],
 ['Καθαρές επιφάνειες υψηλής επαφής (κομοδίνο, κλίνη, πόμολα)','High-touch surfaces clean (bedside table, bed rail, handles)'],
 ['Σωστός διαχωρισμός αποβλήτων και αιχμηρών','Waste and sharps segregated correctly'],
 ['Περιέκτες αιχμηρών κάτω από τα 3/4','Sharps containers below the 3/4 line'],
 ['Σήμανση απομόνωσης όπου χρειάζεται','Isolation signage where needed'],
 ['Διαθέσιμα ΜΑΠ (γάντια, ποδιές, μάσκες)','PPE available (gloves, aprons, masks)'],
 ['Καθαρά και καλυμμένα αποθηκευμένα υλικά','Stored supplies clean and covered'],
 ['Ενημερωμένο φύλλο καθαριότητας θαλάμου','Room cleaning log up to date'],
]
const definition4={...definition2,created_at:iso(-24*58),id:'ctrl-def-audit',code:'CTRL-DEMO-0004',title:'Εβδομαδιαία επιθεώρηση θαλάμων',category:'Επιθεώρηση με λίστα ελέγχου',description:'Επιθεώρηση θαλάμων με τη λίστα ελέγχου υγιεινής και καθαριότητας. Σε κάθε «Όχι» σημειώστε τι βρέθηκε.',response_config:{mode:'checklist',label:'Λίστα ελέγχου',criticality:'medium',checklist:AUDIT_ITEMS.map(([el,en],index)=>({id:`audit-${index+1}`,el,en,required:true})),deviationActions:'Άμεση διόρθωση όπου είναι δυνατό και ενημέρωση της Προϊσταμένης τμήματος.',__meta:{titleEn:'Weekly ward audit',ownerLabel:'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων (ΝΕΛ)',ownerPerson:{employeeId:'demo-nel',name:'Παπαδοπούλου Ελένη',nameEn:'Eleni Papadopoulou',userId:null},location:'Θάλαμος',createdByScope:'infection_control'}},frequency_config:{kind:'weekly',interval:1,timesPerDay:1,times:['10:00']}}
// Four times a day: the ICU has done today's four, the internal ward three, so
// the list shows «4/4 σήμερα» / «3/4 σήμερα» and the entry screen the guard.
const definition5={...definition1,id:'ctrl-def-hand-rub',code:'CTRL-DEMO-0005',title:'Έλεγχος διαθεσιμότητας αλκοολούχου αντισηπτικού',category:'Υγιεινή χεριών',description:'Έλεγχος ότι κάθε σημείο φροντίδας έχει αντισηπτικό σε επάρκεια, σε κάθε βάρδια.',response_config:{mode:'choice',options:['Συμμορφώνεται','Μη συμμόρφωση'],label:'Κατάσταση',criticality:'medium',__meta:{titleEn:'Alcohol hand rub availability check',ownerLabel:'Προϊστάμενος τμήματος',createdByScope:'infection_control',createdForDepartment:null,createdByName:'',updatedByName:''}},frequency_config:{kind:'daily',timesPerDay:4,times:['07:00','11:00','15:00','19:00'],interval:1},created_at:iso(-24*41)}
export const controlDefinitionRows=[definition1,definition2,definition3,definition4,definition5]

const assignment1={
 id:'ctrl-asg-fridge-icu',
 control_id:definition1.id,
 organization_id:'demo-hospital',
 department_id:'ΜΕΘ',
 department:departmentRow('ΜΕΘ'),
 status:'scheduled',
 last_completed_at:iso(-24-3),
 next_due_at:iso(-3),
}

const assignment2={
 id:'ctrl-asg-fridge-surgery',
 control_id:definition1.id,
 organization_id:'demo-hospital',
 department_id:'Χειρουργική',
 department:departmentRow('Χειρουργική'),
 status:'scheduled',
 last_completed_at:iso(-9),
 next_due_at:iso(6),
}

const assignment3={
 id:'ctrl-asg-disinfect-surgery',
 control_id:definition2.id,
 organization_id:'demo-hospital',
 department_id:'Χειρουργική',
 department:departmentRow('Χειρουργική'),
 status:'scheduled',
 last_completed_at:iso(-24*3),
 next_due_at:iso(24*4),
}

const assignment4={id:'ctrl-asg-expiry-internal',control_id:definition3.id,organization_id:'demo-hospital',department_id:'Παθολογική',department:departmentRow('Παθολογική'),status:'scheduled',last_completed_at:iso(-24*25),next_due_at:iso(24*5)}
const assignment5={id:'ctrl-asg-disinfect-ed',control_id:definition2.id,organization_id:'demo-hospital',department_id:'ΤΕΠ',department:departmentRow('ΤΕΠ'),status:'scheduled',last_completed_at:iso(-24*9),next_due_at:iso(-24*2)}
const assignment6={id:'ctrl-asg-audit-icu',control_id:definition4.id,organization_id:'demo-hospital',department_id:'ΜΕΘ',department:departmentRow('ΜΕΘ'),status:'scheduled',last_completed_at:iso(-24*6-2),next_due_at:iso(-2)}
const assignment7={id:'ctrl-asg-audit-internal',control_id:definition4.id,organization_id:'demo-hospital',department_id:'Παθολογική',department:departmentRow('Παθολογική'),status:'scheduled',last_completed_at:iso(-24*3),next_due_at:iso(24*4)}
export const controlAssignmentRows=[assignment1,assignment2,assignment3,assignment4,assignment5,assignment6,assignment7]

export const controlExecutionRows=[
 {
  id:'ctrl-exec-fridge-icu-1',
  assignment_id:assignment1.id,
  control_id:definition1.id,
  organization_id:'demo-hospital',
  department_id:'ΜΕΘ',
  status:'completed',
  value_text:'4.2',
  response_data:{structuredData:null,actorName:'Ελένη Παπαδοπούλου',actorEmail:'infection@demo.hospital',previousLastCompletedAt:iso(-48-3),previousNextDueAt:iso(-24-3)},
  notes:'',
  has_finding:false,
  performed_at:iso(-24-3),
  performed_by:'',
  edited_at:null,
  edited_by:null,
  cancelled_at:null,
  cancelled_by:null,
  cancellation_reason:'',
 },
 {
  id:'ctrl-exec-fridge-icu-2',
  assignment_id:assignment1.id,
  control_id:definition1.id,
  organization_id:'demo-hospital',
  department_id:'ΜΕΘ',
  status:'completed',
  value_text:'9.1',
  response_data:{structuredData:null,actorName:'Ελένη Παπαδοπούλου',actorEmail:'infection@demo.hospital',previousLastCompletedAt:iso(-72-3),previousNextDueAt:iso(-48-3)},
  notes:'Υπέρβαση ανώτατου ορίου, ενημερώθηκε ο τεχνικός.',
  has_finding:true,
  performed_at:iso(-48-3),
  performed_by:'',
  edited_at:null,
  edited_by:null,
  cancelled_at:null,
  cancelled_by:null,
  cancellation_reason:'',
 },
 {
  id:'ctrl-exec-fridge-surgery-1',
  assignment_id:assignment2.id,
  control_id:definition1.id,
  organization_id:'demo-hospital',
  department_id:'Χειρουργική',
  status:'completed',
  value_text:'5.0',
  response_data:{structuredData:null,actorName:'Νίκος Δημητρίου',actorEmail:'laboratory@demo.hospital',previousLastCompletedAt:iso(-33),previousNextDueAt:iso(-9)},
  notes:'',
  has_finding:false,
  performed_at:iso(-9),
  performed_by:'',
  edited_at:null,
  edited_by:null,
  cancelled_at:null,
  cancelled_by:null,
  cancellation_reason:'',
 },
 {
  id:'ctrl-exec-disinfect-surgery-1',
  assignment_id:assignment3.id,
  control_id:definition2.id,
  organization_id:'demo-hospital',
  department_id:'Χειρουργική',
  status:'completed',
  value_text:'Συμμορφώνεται',
  response_data:{structuredData:null,actorName:'Ελένη Παπαδοπούλου',actorEmail:'infection@demo.hospital',previousLastCompletedAt:iso(-24*10),previousNextDueAt:iso(-24*3)},
  notes:'',
  has_finding:false,
  performed_at:iso(-24*3),
  performed_by:'',
  edited_at:null,
  edited_by:null,
  cancelled_at:null,
  cancelled_by:null,
  cancellation_reason:'',
 },
]

// Demo history: a month of routine executions behind the recent ones above, with
// a few missed and one late slot, so programme adherence has something to show.
const historyRun=(assignment,definition,department,actorName,days,{missed=[],late={}}={})=>days.filter(day=>!missed.includes(day)).map(day=>{
 const at=iso(-24*day-3),lateHours=late[day]||0
 return {id:`ctrl-exec-${assignment.id}-d${day}`,assignment_id:assignment.id,control_id:definition.id,organization_id:'demo-hospital',department_id:department,status:'completed',value_text:definition.response_config?.mode==='numeric'?'4.6':'',response_data:{structuredData:null,actorName,actorEmail:'',previousLastCompletedAt:null,previousNextDueAt:iso(-24*day-3-lateHours)},notes:'',has_finding:false,performed_at:at,performed_by:'',edited_at:null,edited_by:null,cancelled_at:null,cancelled_by:null,cancellation_reason:''}
})
const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i)
controlExecutionRows.push(
 ...historyRun(assignment1,definition1,'ΜΕΘ','Ελένη Παπαδοπούλου',range(3,29),{missed:[8,17],late:{12:5}}),
 ...historyRun(assignment2,definition1,'Χειρουργική','Νίκος Δημητρίου',range(1,29),{missed:[5,6,14,22,26]}),
 ...historyRun(assignment3,definition2,'Χειρουργική','Νίκος Δημητρίου',[10]),
)

// A year of the weekly disinfection and monthly expiry programmes in six wards,
// with the occasional finding, so the Controls and Analysis screens show trends.
const newAssignment=(id,definition,department,lastDays,intervalDays)=>({id,control_id:definition.id,organization_id:'demo-hospital',department_id:department,department:departmentRow(department),status:'scheduled',last_completed_at:iso(-24*lastDays-3),next_due_at:iso(24*(intervalDays-lastDays)+6)})
const programmeAssignments=[
 [newAssignment('ctrl-asg-disinfect-icu',definition2,'ΜΕΘ',2,7),definition2,'ΜΕΘ','Ελένη Παπαδοπούλου',7],
 [newAssignment('ctrl-asg-disinfect-internal',definition2,'Παθολογική',4,7),definition2,'Παθολογική','Νίκος Δημητρίου',7],
 [newAssignment('ctrl-asg-disinfect-cardio',definition2,'Καρδιολογική',1,7),definition2,'Καρδιολογική','Σοφία Οικονόμου',7],
 [newAssignment('ctrl-asg-disinfect-nicu',definition2,'Νεογνολογική / ΜΕΝΝ',5,7),definition2,'Νεογνολογική / ΜΕΝΝ','Γεωργία Φωτίου',7],
 [newAssignment('ctrl-asg-expiry-icu',definition3,'ΜΕΘ',12,30),definition3,'ΜΕΘ','Ελένη Παπαδοπούλου',30],
 [newAssignment('ctrl-asg-expiry-surgery',definition3,'Χειρουργική',8,30),definition3,'Χειρουργική','Νίκος Δημητρίου',30],
 [newAssignment('ctrl-asg-expiry-ed',definition3,'ΤΕΠ',16,30),definition3,'ΤΕΠ','Ανδρέας Μάρκου',30],
 [newAssignment('ctrl-asg-expiry-cardio',definition3,'Καρδιολογική',20,30),definition3,'Καρδιολογική','Σοφία Οικονόμου',30],
 [newAssignment('ctrl-asg-expiry-nicu',definition3,'Νεογνολογική / ΜΕΝΝ',6,30),definition3,'Νεογνολογική / ΜΕΝΝ','Γεωργία Φωτίου',30],
]
controlAssignmentRows.push(...programmeAssignments.map(([assignment])=>assignment))
// Existing assignments get the rest of their year too.
programmeAssignments.push([assignment3,definition2,'Χειρουργική','Νίκος Δημητρίου',7,17],[assignment5,definition2,'ΤΕΠ','Ανδρέας Μάρκου',7,9],[assignment4,definition3,'Παθολογική','Νίκος Δημητρίου',30,25])
const FINDING_VALUE={[definition2.id]:['Μη συμμόρφωση','Υπολείμματα σε επιφάνειες υψηλής επαφής.'],[definition3.id]:['Κοντόληκτο','Κοντόληκτα υλικά αποσύρθηκαν και ενημερώθηκε το φαρμακείο.']}
const OK_VALUE={[definition2.id]:'Συμμορφώνεται',[definition3.id]:'Χωρίς εύρημα'}
// The medicines and supplies each ward listed at its latest expiry check:
// dates relative to today, so some expire soon and a few have already expired.
const dayFromNow=days=>{const d=new Date();d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const EXPIRY_STOCK=[['Adrenaline 1mg/ml',10,'AD2291'],['Atropine 0.5mg/ml',6,'AT1170'],['Amiodarone 150mg/3ml',4,'AM8812'],['Φυσιολογικός ορός 0,9% 500ml',24,'NS4410'],['Ηπαρίνη 5.000 IU/ml',8,'HP3307'],['Midazolam 5mg/ml',5,'MZ6620'],['Σύριγγες 10ml',120,'SY0912'],['Ουροκαθετήρας Foley 14Fr',15,'FL1402'],['Χλωρεξιδίνη 2% διάλυμα',12,'CH2205'],['Naloxone 0.4mg/ml',3,'NX0418']]
const expiryRows=seed=>{
 const rand=seededRandom(`expiry|${seed}`)
 const offsets=[-12,-3,5,11,19,26,48,95,160,240]
 return EXPIRY_STOCK.map(([item,quantity,lot],index)=>({item,quantity:String(quantity),lot,expiry:dayFromNow(offsets[(index+Math.floor(rand()*offsets.length))%offsets.length]),finding:'',findingOther:''}))
  .slice(0,5+Math.floor(rand()*4))
}
for(const [assignment,definition,department,actorName,interval,firstDay] of programmeAssignments){
 const rand=seededRandom(`controls|${assignment.id}`)
 const lastDay=Math.round((Date.now()-new Date(assignment.last_completed_at).getTime())/86_400_000)
 for(let day=firstDay??lastDay;day<=364;day+=interval){
  const finding=rand()<(definition.id===definition3.id?0.16:0.09)
  const stock=definition.id===definition3.id&&day===(firstDay??lastDay)?{rows:expiryRows(assignment.id)}:null
  controlExecutionRows.push({id:`ctrl-exec-${assignment.id}-y${day}`,assignment_id:assignment.id,control_id:definition.id,organization_id:'demo-hospital',department_id:department,status:'completed',value_text:finding?FINDING_VALUE[definition.id][0]:OK_VALUE[definition.id],response_data:{structuredData:stock,actorName,actorEmail:'',previousLastCompletedAt:iso(-24*(day+interval)-3),previousNextDueAt:iso(-24*day-3)},notes:finding?FINDING_VALUE[definition.id][1]:'',has_finding:finding,performed_at:iso(-24*day-3),performed_by:'',edited_at:null,edited_by:null,cancelled_at:null,cancelled_by:null,cancellation_reason:''})
 }
}

// Eight weeks of ward audits: most items pass, now and then one does not.
for(const [assignment,department,actorName,lastDay] of [[assignment6,'ΜΕΘ','Ελένη Παπαδοπούλου',6],[assignment7,'Παθολογική','Νίκος Δημητρίου',3]]){
 const rand=seededRandom(`audit|${assignment.id}`)
 for(let week=0;week<8;week++){
  const day=lastDay+week*7
  const rows=AUDIT_ITEMS.map(([item,itemEn],index)=>{const no=rand()<0.1;return {id:`audit-${index+1}`,item,itemEn,required:true,answer:index===4&&rand()<0.5?'na':no?'no':'yes',note:no?'Διορθώθηκε επί τόπου.':''}})
  const answered=rows.filter(r=>r.answer!=='na'),yes=answered.filter(r=>r.answer==='yes').length
  controlExecutionRows.push({id:`ctrl-exec-${assignment.id}-w${week}`,assignment_id:assignment.id,control_id:definition4.id,organization_id:'demo-hospital',department_id:department,status:'completed',value_text:`${yes}/${answered.length} συμμόρφωση (${Math.round(yes*100/answered.length)}%)`,response_data:{structuredData:{template:'checklist',rows},actorName,actorEmail:''},notes:'',has_finding:rows.some(r=>r.answer==='no'),performed_at:iso(-24*day-2),performed_by:'',edited_at:null,edited_by:null,cancelled_at:null,cancelled_by:null,cancellation_reason:''})
 }
}

// The four-a-day control: 30 days of four entries, and today's entries spread
// between the start of the day and now.
{
 const dayStart=periodBounds(definition5.frequency_config,new Date()).start.getTime()
 const todayAt=(i,count)=>new Date(dayStart+((Date.now()-dayStart)*(i+1))/(count+1)).toISOString()
 for(const [id,department,actorName,todayCount] of [['ctrl-asg-hand-rub-icu','ΜΕΘ','Ελένη Παπαδοπούλου',4],['ctrl-asg-hand-rub-internal','Παθολογική','Νίκος Δημητρίου',3]]){
  const entries=[]
  for(let day=40;day>=1;day-=1)for(const hour of [7,11,15,19])entries.push(new Date(dayStart-day*86_400_000+(hour-1)*3_600_000+15*60_000).toISOString())
  for(let i=0;i<todayCount;i+=1)entries.push(todayAt(i,todayCount))
  entries.forEach((at,index)=>controlExecutionRows.push({id:`ctrl-exec-${id}-${index}`,assignment_id:id,control_id:definition5.id,organization_id:'demo-hospital',department_id:department,status:'completed',value_text:'Συμμορφώνεται',response_data:{structuredData:null,actorName,actorEmail:''},notes:'',has_finding:false,performed_at:at,performed_by:'',edited_at:null,edited_by:null,cancelled_at:null,cancelled_by:null,cancellation_reason:''}))
  const last=entries[entries.length-1]
  controlAssignmentRows.push({id,control_id:definition5.id,organization_id:'demo-hospital',department_id:department,department:departmentRow(department),status:'scheduled',last_completed_at:last,next_due_at:nextDueAfterExecution(definition5.frequency_config,new Date(last),todayCount)})
 }
}

export const controlDraftRows=[{id:'ctrl-draft-expiry-1',assignment_id:assignment4.id,control_id:definition3.id,organization_id:'demo-hospital',department_id:'Παθολογική',status:'draft',value_text:'Κοντόληκτο',response_data:{structuredData:{rows:[{item:'Adrenaline 1mg/ml',quantity:'6',lot:'AD2291',expiry:'2026-10-15',finding:'Κοντόληκτο',findingOther:''}]},actorName:'Demo User'},notes:'Σε εξέλιξη ο έλεγχος ραφιού.',has_finding:true,performed_at:null}]


// Every demo assignment's last entry and next due date follow from its entries
// with the due rules (controlDueRules), as the database trigger keeps them.
for(const assignment of controlAssignmentRows){
 const definition=controlDefinitionRows.find(row=>row.id===assignment.control_id)
 const entries=controlExecutionRows.filter(row=>row.assignment_id===assignment.id&&row.status!=='cancelled'&&!row.is_extra&&row.performed_at).map(row=>row.performed_at).sort()
 if(!definition||!entries.length)continue
 const last=entries[entries.length-1]
 const {start,end}=periodBounds(definition.frequency_config,new Date(last))
 assignment.last_completed_at=last
 assignment.next_due_at=nextDueAfterExecution(definition.frequency_config,new Date(last),entries.filter(at=>new Date(at)>=start&&new Date(at)<end).length)
}
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(controlDefinitionRows)
emptyInPreview(controlAssignmentRows)
emptyInPreview(controlExecutionRows)
emptyInPreview(controlDraftRows)
