import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { historyCases } from '../surveillance/demoInfectionHistory'
export const patientDemoData = [
  { id:'PT-260190', firstName:'Νεογέννητο', lastName:'Ιωαννίδη', sex:'female', patronymic:'', firstNameEn:'Neonate', lastNameEn:'Ioannidi', patronymicEn:'', name:'Νεογέννητο Ιωαννίδη', nameEn:'Neonate Ioannidi', dateOfBirth:'2026-08-20', birthWeightGrams:980, gestationalAgeWeeks:27, department:'Νεογνολογική / ΜΕΝΝ', departmentEn:'Neonatal / NICU', admissionDate:'2026-08-20', status:'active' },
  { id:'PT-260184', firstName:'Ελένη', lastName:'Παπαδοπούλου', dateOfBirth:'1958-04-11', sex:'female', patronymic:'', firstNameEn:'Eleni', lastNameEn:'Papadopoulou', patronymicEn:'', name:'Ελένη Παπαδοπούλου', nameEn:'Eleni Papadopoulou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-08-24', status:'active' },
  { id:'PT-260179', firstName:'Νικόλαος', lastName:'Γεωργίου', dateOfBirth:'1949-09-02', sex:'male', patronymic:'', firstNameEn:'Nikolaos', lastNameEn:'Georgiou', patronymicEn:'', name:'Νικόλαος Γεωργίου', nameEn:'Nikolaos Georgiou', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-08-21', status:'active' },
  { id:'PT-260161', firstName:'Μαρία', lastName:'Κωνσταντίνου', dateOfBirth:'1962-01-17', sex:'female', patronymic:'', firstNameEn:'Maria', lastNameEn:'Konstantinou', patronymicEn:'', name:'Μαρία Κωνσταντίνου', nameEn:'Maria Konstantinou', department:'Χειρουργική', departmentEn:'Surgery', admissionDate:'2026-08-18', dischargeDate:'2026-08-23', status:'discharged' },
  { id:'PT-260155', firstName:'Αλέξανδρος', lastName:'Δημητρίου', dateOfBirth:'1966-01-23', sex:'male', name:'Αλέξανδρος Δημητρίου', nameEn:'Alexandros Dimitriou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-08-20', status:'active' },
  { id:'PT-260148', firstName:'Ιωάννα', lastName:'Αντωνίου', dateOfBirth:'1983-11-05', sex:'female', name:'Ιωάννα Αντωνίου', nameEn:'Ioanna Antoniou', department:'Ορθοπαιδική', departmentEn:'Orthopedics', admissionDate:'2026-07-12', dischargeDate:'2026-07-19', status:'discharged' },
  { id:'PT-260137', firstName:'Σπυρίδων', lastName:'Μανώλης', dateOfBirth:'1938-02-14', sex:'male', name:'Σπυρίδων Μανώλης', nameEn:'Spyridon Manolis', department:'Καρδιολογική', departmentEn:'Cardiology', admissionDate:'2026-06-08', dischargeDate:'2026-06-15', status:'discharged' },
  { id:'PT-260126', firstName:'Άννα', lastName:'Νικολάου', dateOfBirth:'1957-08-09', sex:'female', name:'Άννα Νικολάου', nameEn:'Anna Nikolaou', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-05-16', dischargeDate:'2026-05-24', status:'discharged' },
  { id:'PT-260115', firstName:'Δημήτριος', lastName:'Οικονόμου', dateOfBirth:'1969-12-21', sex:'male', name:'Δημήτριος Οικονόμου', nameEn:'Dimitrios Oikonomou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-04-03', dischargeDate:'2026-04-18', status:'discharged' },
  { id:'PT-260104', firstName:'Κατερίνα', lastName:'Βασιλείου', dateOfBirth:'1951-05-28', sex:'female', name:'Κατερίνα Βασιλείου', nameEn:'Katerina Vasileiou', department:'Χειρουργική', departmentEn:'Surgery', admissionDate:'2026-03-11', dischargeDate:'2026-03-17', status:'discharged' },
  { id:'PT-260093', firstName:'Παναγιώτης', lastName:'Σταθόπουλος', dateOfBirth:'1947-10-03', sex:'male', name:'Παναγιώτης Σταθόπουλος', nameEn:'Panagiotis Stathopoulos', department:'Παθολογική', departmentEn:'Internal Medicine', admissionDate:'2026-02-07', dischargeDate:'2026-02-14', status:'discharged' },
  { id:'PT-260082', firstName:'Ευαγγελία', lastName:'Μάρκου', dateOfBirth:'1958-04-11', sex:'female', name:'Ευαγγελία Μάρκου', nameEn:'Evangelia Markou', department:'ΜΕΘ', departmentEn:'ICU', admissionDate:'2026-01-18', dischargeDate:'2026-01-29', status:'discharged' },

  // A patient with no admission: only a notifiable disease report is on record (the case the patient page must not leave empty).
  { id:'PT-260231', hospitalRecordNumber:'FMP-1464', firstName:'Γεώργιος', lastName:'Αλεξίου', sex:'male', name:'Γεώργιος Αλεξίου', nameEn:'Georgios Alexiou', dateOfBirth:'1971-03-02', department:'Παθολογική', departmentEn:'Internal Medicine', status:'active' },
]

// The patients of the year's other surveillance episodes (demoInfectionHistory.js).
for(const item of historyCases){
  const [firstName,...rest]=item.patient.split(' '),[firstNameEn,...restEn]=item.patientEn.split(' ')
  patientDemoData.push({id:item.patientId,firstName,lastName:rest.join(' '),sex:item.sex,patronymic:'',firstNameEn,lastNameEn:restEn.join(' '),patronymicEn:'',name:item.patient,nameEn:item.patientEn,dateOfBirth:item.dateOfBirth,...(item.birthWeightGrams?{birthWeightGrams:item.birthWeightGrams,gestationalAgeWeeks:item.gestationalAgeWeeks}:{}),department:item.department,departmentEn:item.departmentEn,admissionDate:item.admissionDate,...(item.completedAt?{dischargeDate:item.completedAt,status:item.outcome==='transferred'?'transferred':'discharged'}:{status:'active'})})
}

// A patient registered for a sample before any admission: the record without an admission is shown in the demo too.
patientDemoData.push({ id:'PT-260232', firstName:'Γεώργιος', lastName:'Ραφαηλίδης', dateOfBirth:'1971-03-09', sex:'male', patronymic:'', firstNameEn:'Georgios', lastNameEn:'Rafailidis', patronymicEn:'', name:'Γεώργιος Ραφαηλίδης', nameEn:'Georgios Rafailidis', department:'Παθολογική', departmentEn:'Internal Medicine', status:'active' })

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
    caseNumber: patient.hospitalRecordNumber||'',
  }]
}

// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([patientDemoData])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(patientDemoData)
