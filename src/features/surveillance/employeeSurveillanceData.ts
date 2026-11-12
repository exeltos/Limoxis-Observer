import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'
import { EMPLOYEE_SCREENING_TYPES, OTHER_EMPLOYEE_SCREENING } from './surveillanceOptions'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import { DEMO_HISTORY_MONTHS, addDays, between, dayInMonth, pick, seededRandom } from '../../core/data/demoSeed'
import { emptyInPreview } from '../../core/preview/emptyPreview'

export const employeeSurveillanceRecords=[
  {
    id:'ESUR-260801',
    subjectType:'employee',
    employeeId:'EMP-001',
    employeeName:'Παπαδοπούλου Μαρία',
    employeeNameEn:'Maria Papadopoulou',
    department:'ΜΕΘ',
    departmentEn:'ICU',
    startedAt:'2026-08-20',
    screeningTypes:['nasalSwab'],
    batchId:null,
    // Awaiting the laboratory result (LAB-EMP-001 has none yet), so still active.
    status:'active',
    sampleIds:['LAB-EMP-001'],
    timeline:[],
  },
  {id:'ESUR-260602',subjectType:'employee',employeeId:'EMP-003',employeeName:'Κωνσταντίνου Ελένη',employeeNameEn:'Eleni Konstantinou',department:'Χειρουργική',departmentEn:'Surgery',startedAt:'2026-06-02',screeningTypes:['nasalSwab','throatSwab'],batchId:null,status:'completed',sampleIds:['LAB-EMP-002','LAB-EMP-003'],timeline:[]},
  {id:'ESUR-260710',subjectType:'employee',employeeId:'EMP-005',employeeName:'Μάρκου Ανδρέας',employeeNameEn:'Andreas Markou',department:'ΤΕΠ',departmentEn:'ED',startedAt:'2026-07-10',screeningTypes:['nasalSwab'],batchId:null,status:'completed',sampleIds:['LAB-EMP-004'],timeline:[]},
  {id:'ESUR-260905',subjectType:'employee',employeeId:'EMP-006',employeeName:'Οικονόμου Σοφία',employeeNameEn:'Sofia Oikonomou',department:'Καρδιολογική',departmentEn:'Cardiology',startedAt:'2026-08-28',screeningTypes:['handSwab'],batchId:null,status:'active',sampleIds:['LAB-EMP-005'],timeline:[]},
  {id:'ESUR-260414',subjectType:'employee',employeeId:'EMP-002',employeeName:'Δημητρίου Νικόλαος',employeeNameEn:'Nikolaos Dimitriou',department:'Παθολογική',departmentEn:'Internal Medicine',startedAt:'2026-04-14',screeningTypes:['nasalSwab'],batchId:null,status:'completed',sampleIds:['LAB-EMP-006'],timeline:[]},
  {id:'ESUR-260521',subjectType:'employee',employeeId:'EMP-007',employeeName:'Βασιλείου Χρήστος',employeeNameEn:'Christos Vasileiou',department:'Αποστείρωση',departmentEn:'CSSD',startedAt:'2026-05-21',screeningTypes:['handSwab'],batchId:null,status:'completed',sampleIds:['LAB-EMP-007'],timeline:[]},
]

export const employeeSurveillanceBatches=[]

// The screenings of the earlier months (authored from the first history month, so the Demo shows the whole of
// 2025): one a month, seeded by month, and two department batches — the ICU after its MRSA cases (one nurse a
// carrier: decolonisation and a negative recheck) and the Surgery department. Their samples go to the Laboratory.
const DEMO_STAFF=[
  ['EMP-001','Παπαδοπούλου Μαρία','Maria Papadopoulou','ΜΕΘ','ICU'],['EMP-002','Δημητρίου Νικόλαος','Nikolaos Dimitriou','Παθολογική','Internal Medicine'],
  ['EMP-003','Κωνσταντίνου Ελένη','Eleni Konstantinou','Χειρουργική','Surgery'],['EMP-004','Αντωνίου Γεώργιος','Georgios Antoniou','Εργαστήριο','Laboratory'],
  ['EMP-005','Μάρκου Ανδρέας','Andreas Markou','ΤΕΠ','ED'],['EMP-006','Οικονόμου Σοφία','Sofia Oikonomou','Καρδιολογική','Cardiology'],
  ['EMP-007','Βασιλείου Χρήστος','Christos Vasileiou','Αποστείρωση','CSSD'],['EMP-008','Σταθάτου Δήμητρα','Dimitra Stathatou','Ποιότητα','Quality'],
]
const historyScreeningSamples=[]
function historyScreeningSample(id,[employeeId,name,nameEn,department,departmentEn],typeId,date,caseId,extra={}){
  const type=EMPLOYEE_SCREENING_TYPES.find(item=>item.id===typeId),positive=Boolean(extra.organism),resultDay=positive?addDays(date,2):date
  historyScreeningSamples.push({id,subjectType:'employee',patient:name,patientEn:nameEn,patientId:employeeId,department,departmentEn,type:'employeeScreening',source:type.el,sourceEn:type.en,collectedAt:`${date}T08:45:00+03:00`,receivedAt:`${date}T09:30:00+03:00`,status:'completed',priority:'routine',organism:null,result:positive?'positive':'negative',resultStatus:'validated',resultedAt:`${resultDay}T15:00:00+03:00`,validatedAt:`${resultDay}T15:20:00+03:00`,validatedBy:'Demo Microbiology',resistance:null,critical:false,employeeSurveillanceCase:caseId,ast:[],communications:[],attachments:[],timeline:[{at:`${date}T09:30:00+03:00`,type:'sampleReceived',actor:'Εργαστήριο'},{at:`${resultDay}T15:20:00+03:00`,type:'resultValidated',actor:'Demo Microbiology'}],...extra})
  return id
}
function historyScreening(id,staff,typeIds,date,batchId=null,extra={}){
  const [employeeId,employeeName,employeeNameEn,department,departmentEn]=staff
  const sampleIds=typeIds.map((typeId,index)=>historyScreeningSample(`LAB-EMP-${id.slice(5)}-${index+1}`,staff,typeId,date,id))
  const record={id,subjectType:'employee',employeeId,employeeName,employeeNameEn,department,departmentEn,startedAt:date,screeningTypes:[...typeIds],batchId,status:'completed',sampleIds,timeline:[],...extra}
  employeeSurveillanceRecords.push(record)
  return record
}
DEMO_HISTORY_MONTHS.filter(month=>month<'2026-04').forEach(month=>{
  const rand=seededRandom(`employee-screening|${month}`),staff=pick(rand,DEMO_STAFF),date=dayInMonth(month,between(rand,3,26))
  historyScreening(`ESUR-${date.slice(2).replaceAll('-','')}`,staff,pick(rand,[['nasalSwab'],['nasalSwab','throatSwab'],['handSwab']]),date)
})
const DEMO_BATCHES=[
  ['EBAT-250318','2025-03-18','ΜΕΘ','ICU',['EMP-001','EMP-002','EMP-008'],['nasalSwab']],
  ['EBAT-251014','2025-10-14','Χειρουργική','Surgery',['EMP-003','EMP-005','EMP-006'],['nasalSwab','throatSwab']],
]
for(const [batchId,date,department,departmentEn,employeeIds,typeIds] of DEMO_BATCHES){
  const records=employeeIds.map((employeeId,index)=>historyScreening(`ESUR-${date.slice(2).replaceAll('-','')}-${index+1}`,DEMO_STAFF.find(staff=>staff[0]===employeeId),typeIds,date,batchId))
  employeeSurveillanceBatches.push({id:batchId,subjectType:'employee_batch',department,departmentEn,startedAt:date,screeningTypes:[...typeIds],employeeIds:[...employeeIds],surveillanceIds:records.map(record=>record.id),status:'completed',createdBy:'Ομάδα ελέγχου λοιμώξεων',createdById:'demo',createdAt:`${date}T08:30:00+03:00`,updatedBy:'Ομάδα ελέγχου λοιμώξεων',updatedById:'demo',updatedAt:`${addDays(date,14)}T12:00:00+03:00`})
}
// The ICU nurse carrying MRSA: nasal mupirocin and chlorhexidine for five days, negative recheck a week later.
{
  const carrier=employeeSurveillanceRecords.find(record=>record.id==='ESUR-250318-1'),sample=historyScreeningSamples.find(item=>item.id===carrier.sampleIds[0])
  const intervention={interventionType:'Αποαποικισμός MRSA',interventionDetails:'Ρινική αλοιφή μουπιροσίνης 2%, 3 φορές την ημέρα, και λουτρό χλωρεξιδίνης για 5 ημέρες.',interventionStart:'2025-03-21',interventionEnd:'2025-03-25'}
  Object.assign(sample,{result:'positive',resultedAt:'2025-03-20T15:00:00+03:00',validatedAt:'2025-03-20T15:20:00+03:00',timeline:[sample.timeline[0],{at:'2025-03-20T15:20:00+03:00',type:'resultValidated',actor:'Demo Microbiology'}],organism:'Staphylococcus aureus',resistance:'MRSA',ast:[{drug:'Oxacillin',sir:'R',mic:'>2',method:'MIC',standard:'EUCAST',version:'16.0'},{drug:'Mupirocin',sir:'S',mic:'≤1',method:'MIC',standard:'EUCAST',version:'16.0'}],...intervention})
  const recheckId=historyScreeningSample('LAB-EMP-250318-1R',DEMO_STAFF[0],'nasalSwab','2025-04-01',carrier.id,{isRecheck:true})
  Object.assign(carrier,{intervention:intervention.interventionDetails,interventionType:intervention.interventionType,interventionStart:intervention.interventionStart,interventionEnd:intervention.interventionEnd,recheckDate:'2025-04-01',recheckSampleIds:[recheckId],sampleIds:[...carrier.sampleIds,recheckId]})
}
employeeSurveillanceRecords.sort((a,b)=>b.startedAt.localeCompare(a.startedAt))
// Dates follow today (src/core/data/demoClock.js); the Laboratory's own samples have already moved.
shiftDemoDatesInPlace([employeeSurveillanceRecords,employeeSurveillanceBatches,historyScreeningSamples])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(employeeSurveillanceRecords)
emptyInPreview(employeeSurveillanceBatches)
emptyInPreview(historyScreeningSamples)
laboratorySamples.push(...historyScreeningSamples)

// The screening types (one list, surveillanceOptions.js) as laboratory requests.
export const employeeScreeningCatalog=[...EMPLOYEE_SCREENING_TYPES,OTHER_EMPLOYEE_SCREENING].map(item=>({id:item.id,label:item.id,sampleType:'employeeScreening',sourceEl:item.el,sourceEn:item.en}))

function nextSurveillanceId(){
  return `ESUR-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(employeeSurveillanceRecords.length+1).padStart(3,'0')}`
}
function nextBatchId(){
  return `EBAT-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(employeeSurveillanceBatches.length+1).padStart(3,'0')}`
}
function nextLabId(){
  return `LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(laboratorySamples.length+1).padStart(3,'0')}`
}
export function getEmployeeSurveillanceForEmployee(employeeId){
  return employeeSurveillanceRecords.filter(x=>x.employeeId===employeeId)
}
export function createEmployeeSurveillance({employee,screeningTypes,startedAt,notes='',batchId=null,createdBy='Unknown actor',createdById='unknown'}){
  const id=nextSurveillanceId()
  const sampleIds=[]
  screeningTypes.forEach(typeId=>{
    const cfg=employeeScreeningCatalog.find(x=>x.id===typeId)||employeeScreeningCatalog.at(-1)
    const sampleId=nextLabId()
    createDemoLabSample({
      id:sampleId,
      workflowType:'employee_screening',
      subjectType:'employee',
      employeeId:employee.id,
      patientId:employee.id,
      patient:`${employee.lastName} ${employee.firstName}`,
      patientEn:`${employee.firstNameEn||employee.firstName} ${employee.lastNameEn||employee.lastName}`,
      department:employee.department,
      departmentEn:employee.departmentEn,
      type:cfg.sampleType,
      source:cfg.sourceEl,
      sourceEn:cfg.sourceEn,
      sourceCode:cfg.id,
      anatomicalSite:cfg.sourceEl,
      collectedAt:`${startedAt}T12:00:00`,
      receivedAt:null,
      status:'requested',
      priority:'routine',
      result:null,
      resultStatus:'draft',
      organism:null,
      organisms:[],
      resistance:null,
      critical:false,
      employeeSurveillanceCase:id,
      surveillanceCase:null,
      batchId,
      ast:[],
      communications:[],
      attachments:[],
      timeline:[{at:new Date().toISOString(),type:'employeeScreeningRequested',actor:createdBy}],
      notes,
    })
    sampleIds.push(sampleId)
  })
  const record={
    id,
    subjectType:'employee',
    employeeId:employee.id,
    employeeName:`${employee.lastName} ${employee.firstName}`,
    employeeNameEn:`${employee.firstNameEn||employee.firstName} ${employee.lastNameEn||employee.lastName}`,
    department:employee.department,
    departmentEn:employee.departmentEn,
    startedAt,
    screeningTypes:[...screeningTypes],
    batchId,
    status:'active',
    resultStatus:'pending',
    positiveSampleIds:[],
    intervention:null,
    interventionType:null,
    interventionStatus:'optional',
    interventionStartedAt:null,
    interventionCompletedAt:null,
    interventionStart:null,
    interventionEnd:null,
    noIntervention:false,
    recheckRequired:false,
    recheckDate:null,
    noRecheck:false,
    recheckSampleIds:[],
    sampleIds,
    notes,
    createdAt:new Date().toISOString(),createdBy,createdById,updatedAt:new Date().toISOString(),updatedBy:createdBy,updatedById:createdById,
    timeline:[{at:new Date().toISOString(),type:'employeeSurveillanceStarted',actor:createdBy,actorId:createdById}],
  }
  employeeSurveillanceRecords.unshift(record)
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated',{detail:{type:'created',recordId:record.id}}))
  return record
}
export function createEmployeeSurveillanceBatch({employees,screeningTypes,startedAt,department,departmentEn,notes='',createdBy='Unknown actor',createdById='unknown'}){
  const id=nextBatchId()
  const records=employees.map(employee=>createEmployeeSurveillance({employee,screeningTypes,startedAt,notes,batchId:id,createdBy,createdById}))
  const batch={
    id,
    subjectType:'employee_batch',
    department,
    departmentEn,
    startedAt,
    screeningTypes:[...screeningTypes],
    employeeIds:employees.map(x=>x.id),
    surveillanceIds:records.map(x=>x.id),
    status:'active',
    createdBy,
    createdById,
    createdAt:new Date().toISOString(),
    updatedBy:createdBy,
    updatedById:createdById,
    updatedAt:new Date().toISOString(),
  }
  employeeSurveillanceBatches.unshift(batch)
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated',{detail:{type:'batch-created',batchId:batch.id,count:records.length}}))
  return batch
}
function getEmployeeSurveillanceRecord(id){
  return employeeSurveillanceRecords.find(x=>x.id===id)||null
}
// Demo: the bin takes a screening out of the session list and puts it back on restore.
export function removeDemoEmployeeSurveillance(id){
  const index=employeeSurveillanceRecords.findIndex(item=>item.id===id)
  return index<0?null:employeeSurveillanceRecords.splice(index,1)[0]
}
export function restoreDemoEmployeeSurveillance(row){
  if(row&&!employeeSurveillanceRecords.some(item=>item.id===row.id))employeeSurveillanceRecords.unshift(row)
}
export function updateEmployeeSurveillanceRecord(id,patch){
  const record=getEmployeeSurveillanceRecord(id)
  if(!record)return null
  Object.assign(record,typeof patch==='function'?patch({...record}):patch)
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated'))
  return record
}
function syncEmployeeSurveillanceFromLab(){
  employeeSurveillanceRecords.forEach(record=>{
    const samples=laboratorySamples.filter(x=>x.employeeSurveillanceCase===record.id)
    const validated=samples.filter(x=>x.finalizedAt||x.resultStatus==='validated')
    const positive=validated.filter(x=>x.result==='positive')
    const rechecks=validated.filter(x=>x.isRecheck)
    const positiveRecheck=rechecks.some(x=>x.result==='positive')
    const negativeRecheck=rechecks.some(x=>x.result==='negative')

    record.positiveSampleIds=positive.map(x=>x.id)
    const interventionSample=[...validated].reverse().find(x=>x.interventionType||x.interventionDetails||x.interventionStart||x.interventionEnd)
    if(interventionSample){
      record.interventionType=interventionSample.interventionType||record.interventionType||null
      record.intervention=interventionSample.interventionDetails||record.intervention||null
      record.interventionStart=interventionSample.interventionStart||record.interventionStart||null
      record.interventionEnd=interventionSample.interventionEnd||record.interventionEnd||null
      record.interventionStatus='recorded'
    }
    if(positive.length){
      record.resultStatus='positive'
      record.interventionStatus=record.interventionStatus==='not_required'?'optional':record.interventionStatus
      record.recheckRequired=false
    }else if(validated.length&&validated.length===samples.length){
      record.resultStatus='negative'
      record.interventionStatus='not_required'
      record.recheckRequired=false
    }else record.resultStatus='pending'

    if(record.recheckSampleIds?.length){
      if(negativeRecheck){
        record.resultStatus='cleared'
        record.recheckRequired=false
        record.status='completed'
      }else if(positiveRecheck){
        record.resultStatus='positive_recheck'
        record.recheckRequired=true
        record.status='active'
      }
    }else if(samples.length&&samples.every(x=>x.finalizedAt||x.resultStatus==='validated')){
      record.status=positive.length?'active':'completed'
    }
  })
}
export function getEmployeeSurveillanceKpis(){
  syncEmployeeSurveillanceFromLab()
  return {
    active:employeeSurveillanceRecords.filter(x=>x.status==='active').length,
    positive:employeeSurveillanceRecords.filter(x=>['positive','positive_recheck'].includes(x.resultStatus)).length,
    needsIntervention:employeeSurveillanceRecords.filter(x=>['positive','positive_recheck'].includes(x.resultStatus)&&!x.intervention&&!x.noIntervention).length,
    needsRecheck:employeeSurveillanceRecords.filter(x=>['positive','positive_recheck'].includes(x.resultStatus)&&!x.recheckDate&&!x.noRecheck).length,
  }
}
