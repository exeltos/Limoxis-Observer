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
 response_config:{mode:'numeric',unit:'°C',min:2,max:8,label:'Θερμοκρασία',__meta:{titleEn:'Pharmacy fridge temperature check',ownerLabel:'Υπεύθυνος βάρδιας',createdByScope:'infection_control',createdForDepartment:null,createdByName:'',updatedByName:''}},
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

const definition3={...definition2,id:'ctrl-def-expiry',code:'CTRL-DEMO-0003',title:'Έλεγχος λήξεων φαρμάκων και υλικών',category:'Λήξεις',description:'Περιοδικός έλεγχος λήξεων φαρμάκων και αναλωσίμων.',response_config:{mode:'choice',options:['Χωρίς εύρημα','Κοντόληκτο','Ληγμένο'],label:'Εύρημα',__meta:{titleEn:'Medication and supply expiry check',ownerLabel:'Προϊστάμενος τμήματος',createdByScope:'infection_control'}},frequency_config:{kind:'monthly',interval:1,timesPerDay:1,times:['10:00']}}
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

export const controlDraftRows=[{id:'ctrl-draft-expiry-1',assignment_id:assignment4.id,control_id:definition3.id,organization_id:'demo-hospital',department_id:'Παθολογική',status:'draft',value_text:'Κοντόληκτο',response_data:{structuredData:{items:[{name:'Adrenaline 1mg/ml',quantity:6,expiry:'2026-10-15',finding:'Κοντόληκτο'}]},actorName:'Demo User'},notes:'Σε εξέλιξη ο έλεγχος ραφιού.',has_finding:true,performed_at:null}]
