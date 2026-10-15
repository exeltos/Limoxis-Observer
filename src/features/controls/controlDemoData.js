// Demo dates are written relative to now, so they never need the Demo clock.
import { seededRandom } from '../../core/data/demoSeed'
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
 response_config:{mode:'numeric',unit:'°C',min:2,max:8,label:'Θερμοκρασία',criticality:'high',requiresEvidence:true,deviationActions:'1. Μεταφορά φαρμάκων και εμβολίων στο εφεδρικό ψυγείο.\n2. Ενημέρωση φαρμακείου και προϊσταμένου βάρδιας.\n3. Νέα μέτρηση σε 30 λεπτά και καταγραφή συμβάντος.',__meta:{titleEn:'Pharmacy fridge temperature check',ownerLabel:'Υπεύθυνος βάρδιας',createdByScope:'infection_control',createdForDepartment:null,createdByName:'',updatedByName:''}},
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

const definition3={...definition2,id:'ctrl-def-expiry',code:'CTRL-DEMO-0003',title:'Έλεγχος λήξεων φαρμάκων και υλικών',category:'Λήξεις',description:'Περιοδικός έλεγχος λήξεων φαρμάκων και αναλωσίμων.',response_config:{mode:'list',template:'medication_expiry',label:'Ευρήματα',expiryBeforeDays:30,expiryAfterDays:7,expiryCatalogue:[['Adrenaline 1mg/ml','φύσιγγα'],['Atropine 0.5mg/ml','φύσιγγα'],['Amiodarone 150mg/3ml','φύσιγγα'],['Φυσιολογικός ορός 0,9% 500ml','φιάλη'],['Ηπαρίνη 5.000 IU/ml','φιαλίδιο'],['Midazolam 5mg/ml','φύσιγγα'],['Σύριγγες 10ml','τεμάχιο'],['Ουροκαθετήρας Foley 14Fr','τεμάχιο'],['Χλωρεξιδίνη 2% διάλυμα','φιάλη'],['Naloxone 0.4mg/ml','φύσιγγα']].map(([item,unit],index)=>({id:`cat-demo-${index+1}`,item,unit,departments:[]})),__meta:{titleEn:'Medication and supply expiry check',ownerLabel:'Προϊστάμενος τμήματος',createdByScope:'infection_control'}},frequency_config:{kind:'monthly',interval:1,timesPerDay:1,times:['10:00']}}
export const controlDefinitionRows=[definition1,definition2,definition3]

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
export const controlAssignmentRows=[assignment1,assignment2,assignment3,assignment4,assignment5]

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

export const controlDraftRows=[{id:'ctrl-draft-expiry-1',assignment_id:assignment4.id,control_id:definition3.id,organization_id:'demo-hospital',department_id:'Παθολογική',status:'draft',value_text:'Κοντόληκτο',response_data:{structuredData:{rows:[{item:'Adrenaline 1mg/ml',quantity:'6',lot:'AD2291',expiry:'2026-10-15',finding:'Κοντόληκτο',findingOther:''}]},actorName:'Demo User'},notes:'Σε εξέλιξη ο έλεγχος ραφιού.',has_finding:true,performed_at:null}]

