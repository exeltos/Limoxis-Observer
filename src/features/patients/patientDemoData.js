export const patientDemoData = [
  { id:'PT-260190', firstName:'Νεογέννητο', lastName:'Ιωαννίδη', patronymic:'', firstNameEn:'Neonate', lastNameEn:'Ioannidi', patronymicEn:'', name:'Νεογέννητο Ιωαννίδη', nameEn:'Neonate Ioannidi', dateOfBirth:'2026-08-20', birthWeightGrams:980, gestationalAgeWeeks:27, department:'Νεογνολογική / ΜΕΝΝ', departmentEn:'Neonatal / NICU', admissionDate:'2026-08-20', status:'active' },
  { id:'PT-260184', firstName:'Ελένη', lastName:'Παπαδοπούλου', patronymic:'', firstNameEn:'Eleni', lastNameEn:'Papadopoulou', patronymicEn:'', name:'Ελένη Παπαδοπούλου', nameEn:'Eleni Papadopoulou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-08-24', status:'active' },
  { id:'PT-260179', firstName:'Νικόλαος', lastName:'Γεωργίου', patronymic:'', firstNameEn:'Nikolaos', lastNameEn:'Georgiou', patronymicEn:'', name:'Νικόλαος Γεωργίου', nameEn:'Nikolaos Georgiou', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-08-21', status:'active' },
  { id:'PT-260161', firstName:'Μαρία', lastName:'Κωνσταντίνου', patronymic:'', firstNameEn:'Maria', lastNameEn:'Konstantinou', patronymicEn:'', name:'Μαρία Κωνσταντίνου', nameEn:'Maria Konstantinou', department:'Χειρουργική', departmentEn:'Surgery', admissionDate:'2026-08-18', dischargeDate:'2026-08-23', status:'discharged' },
  { id:'PT-260155', firstName:'Αλέξανδρος', lastName:'Δημητρίου', name:'Αλέξανδρος Δημητρίου', nameEn:'Alexandros Dimitriou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-08-20', status:'active' },
  { id:'PT-260148', firstName:'Ιωάννα', lastName:'Αντωνίου', name:'Ιωάννα Αντωνίου', nameEn:'Ioanna Antoniou', department:'Ορθοπαιδική', departmentEn:'Orthopedics', admissionDate:'2026-07-12', dischargeDate:'2026-07-19', status:'discharged' },
  { id:'PT-260137', firstName:'Σπυρίδων', lastName:'Μανώλης', name:'Σπυρίδων Μανώλης', nameEn:'Spyridon Manolis', department:'Καρδιολογική', departmentEn:'Cardiology', admissionDate:'2026-06-08', dischargeDate:'2026-06-15', status:'discharged' },
  { id:'PT-260126', firstName:'Άννα', lastName:'Νικολάου', name:'Άννα Νικολάου', nameEn:'Anna Nikolaou', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-05-16', dischargeDate:'2026-05-24', status:'discharged' },
  { id:'PT-260115', firstName:'Δημήτριος', lastName:'Οικονόμου', name:'Δημήτριος Οικονόμου', nameEn:'Dimitrios Oikonomou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-04-03', dischargeDate:'2026-04-18', status:'discharged' },
  { id:'PT-260104', firstName:'Κατερίνα', lastName:'Βασιλείου', name:'Κατερίνα Βασιλείου', nameEn:'Katerina Vasileiou', department:'Χειρουργική', departmentEn:'Surgery', admissionDate:'2026-03-11', dischargeDate:'2026-03-17', status:'discharged' },
  { id:'PT-260093', firstName:'Παναγιώτης', lastName:'Σταθόπουλος', name:'Παναγιώτης Σταθόπουλος', nameEn:'Panagiotis Stathopoulos', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-02-07', dischargeDate:'2026-02-14', status:'discharged' },
  { id:'PT-260082', firstName:'Ευαγγελία', lastName:'Μάρκου', name:'Ευαγγελία Μάρκου', nameEn:'Evangelia Markou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-01-18', dischargeDate:'2026-01-29', status:'discharged' }

]

export function demoAdmissionsForPatient(patient){
  if(!patient?.admissionDate)return []
  return [{
    id: patient.admissionId||`ADM-${patient.id}`,
    departmentId: patient.departmentId||null,
    department: patient.department||patient.departmentEn||'',
    admissionDate: patient.admissionDate,
    dischargeDate: patient.dischargeDate||null,
    status: patient.status||'active',
    notes: patient.notes||null,
  }]
}

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
