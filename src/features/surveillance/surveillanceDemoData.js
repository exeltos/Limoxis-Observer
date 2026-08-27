export const surveillanceDemoData = [
  { id:'SUR-260041', patientId:'PT-260184', patient:'Ελένη Παπαδοπούλου', patientEn:'Eleni Papadopoulou', department:'ΜΕΘ', departmentEn:'ICU', startedAt:'2026-08-24', organism:'Klebsiella pneumoniae', resistance:'MDR', isolation:true, reviewDue:'2026-08-27', state:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'active', isolation:'active', reassessment:'overdue' } },
  { id:'SUR-260039', patientId:'PT-260179', patient:'Νικόλαος Γεωργίου', patientEn:'Nikolaos Georgiou', department:'Παθολογική', departmentEn:'Internal Medicine', startedAt:'2026-08-25', organism:'Escherichia coli', resistance:null, isolation:false, reviewDue:'2026-08-29', state:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'notApplicable', isolation:'notApplicable', reassessment:'pending' } },
  { id:'SUR-260036', patientId:'PT-260155', patient:'Αλέξανδρος Δημητρίου', patientEn:'Alexandros Dimitriou', department:'ΜΕΘ', departmentEn:'ICU', startedAt:'2026-08-22', organism:'Acinetobacter baumannii', resistance:'XDR', isolation:true, reviewDue:'2026-08-28', state:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'active', isolation:'active', reassessment:'inProgress' } },
]

export function createDemoSurveillanceListItem(record){
  const item={
    id:record.id,
    patientId:record.patientId,
    patient:record.patient,
    patientEn:record.patientEn,
    department:record.department,
    departmentEn:record.departmentEn,
    startedAt:record.startedAt,
    organism:record.organism||'',
    resistance:record.resistance||null,
    isolation:Boolean(record.isolation),
    reviewDue:record.reviewDue,
    state:record.status||'active',
    domains:{
      assessment:record.assessment?'completed':'pending',
      microbiology:record.samples?.length?'active':'pending',
      therapy:record.therapy?.length?'active':'pending',
      isolation:record.isolation?'active':'pending',
      reassessment:record.reassessments?.length?'inProgress':'pending',
    },
  }
  surveillanceDemoData.unshift(item)
  return item
}

export function deleteDemoSurveillanceListItem(id){
  const index=surveillanceDemoData.findIndex(x=>x.id===id)
  if(index<0)return false
  surveillanceDemoData.splice(index,1)
  return true
}
