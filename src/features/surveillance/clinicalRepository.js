import {
  clinicalCases,
  createClinicalSurveillance,
  deleteClinicalSurveillance,
  findCasesByPatient,
  getClinicalCase,
} from './clinicalDemoData'
import {
  addAntimicrobialTherapy,
  addClinicalReassessment,
  addSurveillanceDevice,
  completeClinicalCase,
  createClinicalCase,
  endAntimicrobialTherapy,
  endIsolation,
  loadClinicalCases,
  loadClinicalCasesForPatient,
  removeSurveillanceDevice,
  reopenClinicalCase,
  requestLaboratorySample,
  saveAmrClassification,
  saveClinicalAssessment,
  saveClinicalEvent,
  saveHaiClassification,
  startIsolation,
  voidClinicalCase,
} from './clinicalCloudService'

const now=()=>new Date().toISOString()
const clone=value=>JSON.parse(JSON.stringify(value))
const id=(prefix)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`
const event=(type,actor,detail)=>({at:now(),type,actor:actor?.name||'Demo user',actorId:actor?.id||'demo',detail:detail||''})

function demoRecord(record){
  if(!record)return null
  record.samples=record.samples||[]
  record.therapy=record.therapy||[]
  record.devices=record.devices||[]
  record.reassessments=record.reassessments||[]
  record.timeline=record.timeline||[]
  return record
}
function touch(record,actor,type,detail){
  record.updatedAt=now();record.updatedBy=actor?.name||'Demo user';record.updatedById=actor?.id||'demo'
  record.timeline=[event(type,actor,detail),...(record.timeline||[])]
  return clone(record)
}

export function createClinicalRepository({isDemo,organizationId,actor}){
  async function loadForPatient(patient){
    if(isDemo)return clone(findCasesByPatient(patient?.id||patient?.patientId||''))
    if(!organizationId||!patient?.recordId)return []
    return loadClinicalCasesForPatient(organizationId,patient.recordId)
  }
  async function loadCase(caseId){
    if(isDemo)return clone(getClinicalCase(caseId))
    if(!organizationId||!caseId)return null
    const rows=await loadClinicalCases(organizationId)
    return rows.find(row=>String(row.id)===String(caseId))||null
  }
  async function createCase(patient,draft){
    if(!isDemo)return createClinicalCase(organizationId,patient.recordId,draft)
    return clone(createClinicalSurveillance({
      patientId:patient.id,patient:patient.name,patientEn:patient.nameEn||patient.name,dateOfBirth:patient.dateOfBirth,
      department:draft.department||patient.department,departmentEn:draft.departmentEn||patient.departmentEn||patient.department,
      admissionDate:patient.admissionDate,...draft,createdBy:actor?.name,createdById:actor?.id,
    }))
  }
  async function saveAssessment(record,draft){
    if(!isDemo)return saveClinicalAssessment(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);target.assessment={id:id('ASM'),...draft,assessedBy:actor?.name||'Demo user'}
    return touch(target,actor,'clinicalAssessment',draft.classification)
  }
  async function saveHai(record,draft){
    if(!isDemo)return saveHaiClassification(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);target.haiClassification={id:id('HAI'),...draft,classifiedAt:now(),classifiedBy:actor?.name||'Demo user'}
    return touch(target,actor,'haiClassification',draft.type)
  }
  async function requestSample(record,draft){
    if(!isDemo)return requestLaboratorySample(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);const sample={id:id('LAB'),type:draft.type,source:draft.source||'',priority:draft.priority||'routine',requestedAt:now(),result:'pending',organism:null,resistance:null,critical:false}
    target.samples.unshift(sample);touch(target,actor,'samples',sample.id);return clone(sample)
  }
  async function setIsolationNotRequired(record){
    if(!isDemo){await saveClinicalEvent(organizationId,record.recordId,'isolation_not_required',{required:false,detail:'no'});return null}
    const target=demoRecord(clinicalCases[record.id]);target.isolation=null;target.isolationDecision={required:false,at:now(),by:actor?.name||'Demo user'}
    return touch(target,actor,'isolationNotRequired','no')
  }
  async function beginIsolation(record,draft){
    if(!isDemo)return startIsolation(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);target.isolation={id:id('ISO'),status:'active',...draft,startedAt:draft.startedAt||now()}
    return touch(target,actor,'isolation',draft.reason)
  }
  async function finishIsolation(record,draft){
    if(!isDemo)return endIsolation(organizationId,record.isolation?.id,draft)
    const target=demoRecord(clinicalCases[record.id]);if(target.isolation)target.isolation={...target.isolation,status:'ended',endedAt:draft.endedAt||now(),endReason:draft.reason||''}
    return touch(target,actor,'isolationEnded',draft.reason)
  }
  async function addTherapy(record,draft){
    if(!isDemo)return addAntimicrobialTherapy(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);const therapy={id:id('TX'),status:'active',...draft,startedAt:draft.startedAt||new Date().toISOString().slice(0,10),plannedEnd:draft.plannedEndAt||draft.plannedEnd||null}
    target.therapy.unshift(therapy);return touch(target,actor,'therapy',therapy.antimicrobial)
  }
  async function finishTherapy(record,therapyId,draft){
    if(!isDemo)return endAntimicrobialTherapy(organizationId,therapyId,draft)
    const target=demoRecord(clinicalCases[record.id]);target.therapy=target.therapy.map(item=>item.id===therapyId?{...item,status:'completed',endedAt:draft.endedAt||now()}:item)
    return touch(target,actor,'therapyEnded',therapyId)
  }
  async function addDevice(record,draft){
    if(!isDemo)return addSurveillanceDevice(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id]);const device={id:id('DEV'),status:'active',name:draft.type,nameEn:draft.type,...draft}
    target.devices.unshift(device);return touch(target,actor,'deviceAdded',draft.type)
  }
  async function removeDevice(record,deviceId,draft={}){
    if(!isDemo)return removeSurveillanceDevice(organizationId,deviceId,draft)
    const target=demoRecord(clinicalCases[record.id]);target.devices=target.devices.map(item=>item.id===deviceId?{...item,status:'removed',removedAt:draft.removedAt||now()}:item)
    return touch(target,actor,'deviceRemoved',deviceId)
  }
  async function saveAmr(record,resultId,draft){
    if(!isDemo)return saveAmrClassification(organizationId,resultId,draft)
    const target=demoRecord(clinicalCases[record.id]);target.resistance=draft.classification||null
    return touch(target,actor,'amrClassification',draft.classification)
  }
  async function reassess(record,draft){
    if(!isDemo)return addClinicalReassessment(organizationId,record.recordId,record.patientRecordId,draft)
    const target=demoRecord(clinicalCases[record.id]);const row={id:id('REV'),...draft,by:actor?.name||'Demo user'};target.reassessments.unshift(row);if(draft.nextReviewDue)target.reviewDue=draft.nextReviewDue
    return touch(target,actor,'reassessment',draft.status)
  }
  async function complete(record,draft){
    if(!isDemo)return completeClinicalCase(organizationId,record.recordId,record.patientRecordId,draft)
    const target=demoRecord(clinicalCases[record.id]);target.outcome={id:id('OUT'),...draft};target.status='completed';target.completedAt=draft.date||now()
    return touch(target,actor,'outcome',draft.status)
  }
  async function reopen(record,reason){
    if(!isDemo){await reopenClinicalCase(organizationId,record.recordId,reason);return true}
    const target=demoRecord(clinicalCases[record.id]);target.status='active';target.completedAt=null;target.previousOutcome=target.outcome?clone(target.outcome):target.previousOutcome;target.outcome=null;target.reopenReason=reason
    touch(target,actor,'surveillanceReopened',reason);return true
  }
  async function voidCase(record,reason){
    if(!isDemo){await voidClinicalCase(organizationId,record.recordId,reason);return true}
    return deleteClinicalSurveillance(record.id,{actor:actor?.name,actorId:actor?.id,reason})
  }
  return {loadForPatient,loadCase,createCase,saveAssessment,saveHai,requestSample,setIsolationNotRequired,beginIsolation,finishIsolation,addTherapy,finishTherapy,addDevice,removeDevice,saveAmr,reassess,complete,reopen,voidCase}
}
