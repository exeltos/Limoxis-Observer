export const patientDemoData = [
  { id:'PT-260184', firstName:'Ελένη', lastName:'Παπαδοπούλου', patronymic:'', firstNameEn:'Eleni', lastNameEn:'Papadopoulou', patronymicEn:'', name:'Ελένη Παπαδοπούλου', nameEn:'Eleni Papadopoulou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-08-24', status:'active' },
  { id:'PT-260179', firstName:'Νικόλαος', lastName:'Γεωργίου', patronymic:'', firstNameEn:'Nikolaos', lastNameEn:'Georgiou', patronymicEn:'', name:'Νικόλαος Γεωργίου', nameEn:'Nikolaos Georgiou', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-08-21', status:'active' },
  { id:'PT-260161', firstName:'Μαρία', lastName:'Κωνσταντίνου', patronymic:'', firstNameEn:'Maria', lastNameEn:'Konstantinou', patronymicEn:'', name:'Μαρία Κωνσταντίνου', nameEn:'Maria Konstantinou', department:'Χειρουργική', departmentEn:'Surgery', admissionDate:'2026-08-18', dischargeDate:'2026-08-23', status:'discharged' },
]

export function createDemoPatient(data){
  const maxNumber=patientDemoData.reduce((max,item)=>{
    const number=Number(String(item.id||'').replace(/\D/g,''))
    return Number.isFinite(number)?Math.max(max,number):max
  },260000)
  const id=`PT-${String(maxNumber+1).slice(-6)}`
  const record={id,status:'active',...data}
  patientDemoData.unshift(record)
  return record
}
