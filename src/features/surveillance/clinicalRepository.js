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
  recordTherapyAdministration,
  removeSurveillanceDevice,
  reopenClinicalCase,
  requestLaboratorySample,
  saveClinicalAssessment,
  saveClinicalEvent,
  saveHaiClassification,
  setTherapyApproval,
  startIsolation,
  updateClinicalCaseBasics,
  voidClinicalCase,
} from './clinicalCloudService'
import { linkSurveillanceCaseToAdmission,loadSurveillanceAdmissionLinks } from './clinicalAdmissionService'

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
  async function withAdmissionLinks(rows){
    if(isDemo||!rows?.length)return rows||[]
    const links=await loadSurveillanceAdmissionLinks(organizationId,rows.map(row=>row.recordId||row.id))
    return rows.map(row=>({...row,admissionId:links.get(row.recordId||row.id)||null}))
  }
  async function loadForPatient(patient){
    if(isDemo)return clone(findCasesByPatient(patient?.id||patient?.patientId||''))
    if(!organizationId||!patient?.recordId)return []
    return withAdmissionLinks(await loadClinicalCasesForPatient(organizationId,patient.recordId))
  }
  async function loadCase(caseId){
    if(isDemo)return clone(getClinicalCase(caseId))
    if(!organizationId||!caseId)return null
    const rows=await withAdmissionLinks(await loadClinicalCases(organizationId))
    return rows.find(row=>String(row.id)===String(caseId))||null
  }
  async function createCase(patient,draft){
    if(!isDemo){
      const created=await createClinicalCase(organizationId,patient.recordId,draft)
      if(draft.admissionId){
        await linkSurveillanceCaseToAdmission(organizationId,created.recordId||created.id,draft.admissionId)
        return {...created,admissionId:draft.admissionId,admissionDate:draft.admissionDate||created.admissionDate}
      }
      return created
    }
    return clone(createClinicalSurveillance({
      patientId:patient.id,patient:patient.name,patientEn:patient.nameEn||patient.name,dateOfBirth:patient.dateOfBirth,
      department:draft.department||patient.department,departmentEn:draft.departmentEn||patient.departmentEn||patient.department,
      admissionId:draft.admissionId||null,admissionDate:draft.admissionDate||patient.admissionDate,...draft,createdBy:actor?.name,createdById:actor?.id,
    }))
  }
  async function updateCase(record,draft){
    if(!isDemo)return updateClinicalCaseBasics(organizationId,record,draft)
    const target=demoRecord(clinicalCases[record.id])
    Object.assign(target,{startedAt:draft.startedAt||target.startedAt,reviewDue:draft.reviewDue??target.reviewDue,room:draft.room??target.room,reason:draft.reason??target.reason,reasonEn:draft.reasonEn??draft.reason??target.reasonEn,suspectedSource:draft.suspectedSource??target.suspectedSource})
    return touch(target,actor,'surveillanceUpdated',draft.reason||target.reason)
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
    const target=demoRecord(clinicalCases[record.id]);const therapy={id:id('TX'),status:'active',...draft,approvalStatus:draft.isAdvancedAntibiotic?'pending':(draft.approvalStatus||'not_required'),startedAt:draft.startedAt||new Date().toISOString().slice(0,10),plannedEnd:draft.plannedEndAt||draft.plannedEnd||null,administrations:[]}
    target.therapy.unshift(therapy);return touch(target,actor,'therapy',therapy.antimicrobial)
  }
  async function finishTherapy(record,therapyId,draft){
    if(!isDemo)return endAntimicrobialTherapy(organizationId,therapyId,draft)
    const target=demoRecord(clinicalCases[record.id]);target.therapy=target.therapy.map(item=>item.id===therapyId?{...item,status:'completed',endedAt:draft.endedAt||now()}:item)
    return touch(target,actor,'therapyEnded',therapyId)
  }
  async function updateTherapyApproval(record,therapyId,approvalStatus){
    if(!isDemo)return setTherapyApproval(organizationId,therapyId,approvalStatus)
    const target=demoRecord(clinicalCases[record.id]);target.therapy=target.therapy.map(item=>item.id===therapyId?{...item,approvalStatus}:item)
    return touch(target,actor,'therapyApproval',approvalStatus)
  }
  async function recordAdministration(record,therapyId,draft){
    if(!isDemo)return recordTherapyAdministration(organizationId,therapyId,draft)
    const target=demoRecord(clinicalCases[record.id])
    const administration={id:id('ADM'),therapyId,administeredAt:draft.administeredAt||now(),dose:draft.dose||'',route:draft.route||'',status:draft.status||'administered',withheldReason:draft.withheldReason||'',administeredBy:actor?.id||'demo',notes:draft.notes||'',createdBy:actor?.id||'demo',createdAt:now()}
    target.therapy=target.therapy.map(item=>item.id===therapyId?{...item,administrations:[administration,...(item.administrations||[])]}:item)
    touch(target,actor,'therapyAdministered',therapyId);return administration
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
  return {loadForPatient,loadCase,createCase,updateCase,saveAssessment,saveHai,requestSample,setIsolationNotRequired,beginIsolation,finishIsolation,addTherapy,finishTherapy,updateTherapyApproval,recordAdministration,addDevice,removeDevice,reassess,complete,reopen,voidCase}
}