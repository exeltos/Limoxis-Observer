export const surveillanceDemoData = [
  { id:'SUR-260041', patientId:'PT-260184', patient:'Ελένη Παπαδοπούλου', patientEn:'Eleni Papadopoulou', department:'ΜΕΘ', departmentEn:'ICU', startedAt:'2026-08-24', organism:'Klebsiella pneumoniae', resistance:'MDR', isolation:true, reviewDue:'2026-08-27', status:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'active', isolation:'active', reassessment:'overdue' } },
  { id:'SUR-260039', patientId:'PT-260179', patient:'Νικόλαος Γεωργίου', patientEn:'Nikolaos Georgiou', department:'Παθολογική', departmentEn:'Internal Medicine', startedAt:'2026-08-25', organism:'Escherichia coli', resistance:null, isolation:false, reviewDue:'2026-08-29', status:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'notApplicable', isolation:'notApplicable', reassessment:'pending' } },
  { id:'SUR-260036', patientId:'PT-260155', patient:'Αλέξανδρος Δημητρίου', patientEn:'Alexandros Dimitriou', department:'ΜΕΘ', departmentEn:'ICU', startedAt:'2026-08-22', organism:'Acinetobacter baumannii', resistance:'XDR', isolation:true, reviewDue:'2026-08-28', status:'active', domains:{ assessment:'completed', microbiology:'active', therapy:'active', isolation:'active', reassessment:'inProgress' } },
  { id:'SUR-260032', patientId:'PT-260148', patient:'Ιωάννα Αντωνίου', patientEn:'Ioanna Antoniou', department:'Ορθοπαιδική', departmentEn:'Orthopedics', startedAt:'2026-07-14', organism:'Staphylococcus aureus', resistance:'MRSA', isolation:true, reviewDue:'2026-07-17', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'completed',reassessment:'completed'} },
  { id:'SUR-260028', patientId:'PT-260137', patient:'Σπυρίδων Μανώλης', patientEn:'Spyridon Manolis', department:'Καρδιολογική', departmentEn:'Cardiology', startedAt:'2026-06-10', organism:'Enterococcus faecium', resistance:'VRE', isolation:true, reviewDue:'2026-06-13', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'completed',reassessment:'completed'} },
  { id:'SUR-260023', patientId:'PT-260126', patient:'Άννα Νικολάου', patientEn:'Anna Nikolaou', department:'Παθολογική', departmentEn:'Internal Medicine', startedAt:'2026-05-18', organism:'Escherichia coli', resistance:'ESBL', isolation:true, reviewDue:'2026-05-21', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'completed',reassessment:'completed'} },
  { id:'SUR-260018', patientId:'PT-260115', patient:'Δημήτριος Οικονόμου', patientEn:'Dimitrios Oikonomou', department:'ΜΕΘ', departmentEn:'ICU', startedAt:'2026-04-06', organism:'Acinetobacter baumannii', resistance:'XDR', isolation:true, reviewDue:'2026-04-09', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'completed',reassessment:'completed'} },
  { id:'SUR-260013', patientId:'PT-260104', patient:'Κατερίνα Βασιλείου', patientEn:'Katerina Vasileiou', department:'Χειρουργική', departmentEn:'Surgery', startedAt:'2026-03-13', organism:'Pseudomonas aeruginosa', resistance:'MDR', isolation:true, reviewDue:'2026-03-16', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'completed',reassessment:'completed'} },
  { id:'SUR-260008', patientId:'PT-260093', patient:'Παναγιώτης Σταθόπουλος', patientEn:'Panagiotis Stathopoulos', department:'Παθολογική', departmentEn:'Internal Medicine', startedAt:'2026-02-09', organism:'Escherichia coli', resistance:null, isolation:false, reviewDue:'2026-02-12', status:'completed', domains:{assessment:'completed',microbiology:'completed',therapy:'completed',isolation:'notApplicable',reassessment:'completed'} }

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
    status:record.status||'active',
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

export function syncDemoSurveillanceListItem(record){
  const item=surveillanceDemoData.find(x=>x.id===record.id)
  if(!item)return createDemoSurveillanceListItem(record)
  Object.assign(item,{
    patientId:record.patientId,
    patient:record.patient,
    patientEn:record.patientEn,
    department:record.department,
    departmentEn:record.departmentEn,
    startedAt:record.startedAt,
    organism:record.organism||'',
    resistance:record.resistance||null,
    isolation:Boolean(record.isolation),
    reviewDue:record.reviewDue||null,
    status:record.status||'active',
    domains:{
      assessment:record.assessment?'completed':'pending',
      microbiology:record.samples?.length?'active':'pending',
      therapy:record.therapy?.length?'active':'pending',
      isolation:(record.isolation||record.isolationDecision?.required===false)?'active':'pending',
      reassessment:record.reassessments?.length?'inProgress':'pending',
    },
  })
  return item
}
