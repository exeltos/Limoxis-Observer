export function calculatePatientDaysFromRegistry(patients, censusDate){
  const counts=new Map()
  for(const patient of patients){
    if(!patient.admissionDate||patient.admissionDate>censusDate) continue
    if(patient.dischargeDate&&patient.dischargeDate<censusDate) continue
    if(!patient.department) continue
    const key=`${patient.department}|${patient.departmentEn??patient.department}`
    counts.set(key,(counts.get(key)??0)+1)
  }
  return [...counts.entries()].map(([key,value])=>{const [departmentEl,departmentEn]=key.split('|');return {date:censusDate,departmentEl,departmentEn,value,source:'calculated',status:'locked'}})
}
