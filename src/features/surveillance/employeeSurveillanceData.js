import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'

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
    status:'completed',
    sampleIds:['LAB-EMP-001'],
    timeline:[],
  },
]

export const employeeSurveillanceBatches=[]

export const employeeScreeningCatalog=[
  {id:'handSwab',label:'handSwab',sampleType:'employeeScreening',sourceEl:'Επίχρισμα χεριών',sourceEn:'Hand swab'},
  {id:'nasalSwab',label:'nasalSwab',sampleType:'employeeScreening',sourceEl:'Ρινικό επίχρισμα',sourceEn:'Nasal swab'},
  {id:'throatSwab',label:'throatSwab',sampleType:'employeeScreening',sourceEl:'Φαρυγγικό επίχρισμα',sourceEn:'Throat swab'},
  {id:'otherEmployeeScreening',label:'otherEmployeeScreening',sampleType:'employeeScreening',sourceEl:'Άλλο screening εργαζομένου',sourceEn:'Other employee screening'},
]

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
export function getEmployeeSurveillanceRecord(id){
  return employeeSurveillanceRecords.find(x=>x.id===id)||null
}
export function updateEmployeeSurveillanceRecord(id,patch){
  const record=getEmployeeSurveillanceRecord(id)
  if(!record)return null
  Object.assign(record,typeof patch==='function'?patch({...record}):patch)
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated'))
  return record
}
export function createEmployeeRecheck(record,{date,createdBy='Unknown actor',createdById='unknown'}){
  if(!record||!date)return []
  const employee={
    id:record.employeeId,
    firstName:record.employeeName.split(' ').slice(-1)[0]||record.employeeName,
    lastName:record.employeeName.split(' ').slice(0,-1).join(' ')||record.employeeName,
    firstNameEn:record.employeeNameEn.split(' ')[0]||record.employeeNameEn,
    lastNameEn:record.employeeNameEn.split(' ').slice(1).join(' ')||record.employeeNameEn,
    department:record.department,
    departmentEn:record.departmentEn,
  }
  const sampleIds=[]
  record.screeningTypes.forEach(typeId=>{
    const cfg=employeeScreeningCatalog.find(x=>x.id===typeId)||employeeScreeningCatalog.at(-1)
    const sampleId=nextLabId()
    createDemoLabSample({
      id:sampleId,workflowType:'employee_screening',subjectType:'employee',employeeId:employee.id,patientId:employee.id,
      patient:record.employeeName,patientEn:record.employeeNameEn,department:record.department,departmentEn:record.departmentEn,
      type:cfg.sampleType,source:cfg.sourceEl,sourceEn:cfg.sourceEn,sourceCode:cfg.id,anatomicalSite:cfg.sourceEl,
      collectedAt:`${date}T12:00:00`,receivedAt:null,status:'requested',priority:'routine',result:null,resultStatus:'draft',
      organism:null,organisms:[],resistance:null,critical:false,employeeSurveillanceCase:record.id,surveillanceCase:null,
      batchId:record.batchId,ast:[],communications:[],attachments:[],isRecheck:true,
      timeline:[{at:new Date().toISOString(),type:'employeeRecheckRequested',actor:createdBy}],notes:''
    })
    sampleIds.push(sampleId)
  })
  record.recheckRequired=true
  record.recheckDate=date
  record.recheckSampleIds=[...(record.recheckSampleIds||[]),...sampleIds]
  record.status='active'
  record.updatedAt=new Date().toISOString();record.updatedBy=createdBy;record.updatedById=createdById
  record.timeline=[{at:new Date().toISOString(),type:'employeeRecheckScheduled',actor:createdBy,actorId:createdById,detail:date},...(record.timeline||[])]
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated'))
  return sampleIds
}
export function syncEmployeeSurveillanceFromLab(){
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
