// Deviations recorded elsewhere (control executions with a finding, bundle
// assessments with a failed criterion, trainings evaluated as not or partly
// effective) that no CAPA points to yet. Recording
// staff cannot create CAPAs (quality RLS), so the quality manager turns each
// one into a CAPA from this queue, prefilled.

import { deviationActions } from '../controls/controlCriticality'

const DAY=24*60*60*1000
const PRIORITY_BY_CRITICALITY={high:'high',medium:'medium',low:'low'}

export function controlSourceId(control,execution){return `${control.id}#${execution.id}`}
export function bundleSourceId(assessment){return `BND-${assessment.id}`}

export function sourcePath(sourceId=''){
 const value=String(sourceId||'')
 if(value.startsWith('CTRL-'))return `/controls/${value.split('#')[0]}`
 if(value.startsWith('BND-'))return `/prevention/bundles/${value.slice(4)}`
 if(value.startsWith('TRAINING:'))return `/training/${value.slice(9)}`
 // A CAPA opened from a risk: RISK:<assessment code>:<risk key>.
 if(value.startsWith('RISK:')){const [,code,key]=value.split(':');return `/quality/risks/${code}${key?`?risk=${key}`:''}`}
 return null
}

export function trainingSourceId(program){return `TRAINING:${program.id}`}

export function deviationQueue({controls=[],bundles=[],trainings=[],capas=[],now=new Date(),days=90}={}){
 const since=now.getTime()-days*DAY
 const linked=new Set(capas.filter(capa=>capa.lifecycleStatus!=='voided').map(capa=>capa.sourceId).filter(Boolean))
 const items=[]
 for(const control of controls){
  for(const [department,assignment] of Object.entries(control.assignments||{})){
   for(const execution of assignment?.history||[]){
    if(!execution.hasFinding||execution.status==='cancelled')continue
    const at=new Date(execution.at).getTime()
    if(!Number.isFinite(at)||at<since)continue
    const sourceId=controlSourceId(control,execution)
    if(linked.has(sourceId))continue
    const unit=control.responseConfig?.unit?` ${control.responseConfig.unit}`:''
    items.push({
     key:`control:${execution.id}`,kind:'control',source:'control',sourceId,path:`/controls/${control.id}`,
     title:control.title,titleEn:control.titleEn||control.title,department,departmentId:assignment.departmentId||'',at:execution.at,
     detail:execution.value?`${execution.value}${unit}`:'',
     notes:execution.notes||'',
     priority:PRIORITY_BY_CRITICALITY[control.responseConfig?.criticality]||'medium',
     deviationActions:deviationActions(control,department),
    })
   }
  }
 }
 for(const assessment of bundles){
  if(!(assessment.failedCount>0)||['draft','cancelled'].includes(assessment.status))continue
  const at=new Date(assessment.date).getTime()
  if(!Number.isFinite(at)||at<since)continue
  const sourceId=bundleSourceId(assessment)
  if(linked.has(sourceId))continue
  items.push({
   key:`bundle:${assessment.id}`,kind:'bundle',source:'bundle',sourceId,path:`/prevention/bundles/${assessment.id}`,
   title:assessment.templateTitle||assessment.templateName,titleEn:assessment.templateName||assessment.templateTitle,
   department:assessment.departmentEl||'',departmentEn:assessment.departmentEn||assessment.departmentEl||'',departmentId:assessment.departmentId||'',at:assessment.date,
   detail:`${assessment.failedCount}/${assessment.applicableCount}`,
   notes:assessment.generalNotes||'',
   priority:assessment.failedCount>=2?'high':'medium',
   deviationActions:'',
  })
 }
 for(const program of trainings){
  const value=program?.effectiveness||{}
  if(!['partial','not_effective'].includes(value.result))continue
  const at=new Date(value.evaluatedAt||program.dueDate||'').getTime()
  if(!Number.isFinite(at)||at<since)continue
  const sourceId=trainingSourceId(program)
  if(linked.has(sourceId))continue
  items.push({
   key:`training:${program.id}`,kind:'training',source:'training',sourceId,path:`/training/${program.id}`,
   title:program.title,titleEn:program.titleEn||program.title,department:program.audience||'',departmentEn:program.audienceEn||program.audience||'',departmentId:'',at:value.evaluatedAt||program.dueDate,
   detail:value.result,notes:[value.criterion,value.notes].filter(Boolean).join(' · '),
   priority:value.result==='not_effective'?'high':'medium',
   deviationActions:'',
  })
 }
 return items.sort((a,b)=>new Date(b.at)-new Date(a.at))
}

// What the CAPA create page receives for one queue item.
export function capaPrefill(item,language='el'){
 const en=language==='en'
 const title=en?item.titleEn||item.title:item.title
 const lines=[
  item.kind==='control'
   ?(en?`Control deviation in ${item.department}: ${item.detail||'non-compliant'}.`:`Απόκλιση ελέγχου στο τμήμα ${item.department}: ${item.detail||'μη συμμόρφωση'}.`)
   :item.kind==='training'
   ?(en?`Training evaluated as ${item.detail==='partial'?'partly effective':'not effective'}.`:`Η εκπαίδευση αξιολογήθηκε ως ${item.detail==='partial'?'μερικώς αποτελεσματική':'μη αποτελεσματική'}.`)
   :(en?`Bundle assessment in ${item.department}: ${item.detail} criteria not met.`:`Αξιολόγηση δέσμης μέτρων στο τμήμα ${item.department}: ${item.detail} κριτήρια δεν τηρήθηκαν.`),
  item.notes&&(en?`Notes: ${item.notes}`:`Σημειώσεις: ${item.notes}`),
 ].filter(Boolean)
 // A training that did not change practice starts from the same three steps as in Training.
 const trainingSteps=en?['Find why practice did not change','Targeted retraining or change of method','Re-evaluate effectiveness']:['Διερεύνηση γιατί δεν άλλαξε η πρακτική','Στοχευμένη επανεκπαίδευση ή αλλαγή μεθόδου','Επαναξιολόγηση αποτελεσματικότητας']
 const subActions=item.kind==='training'?trainingSteps.map((text,index)=>newSubAction(text,index)):item.deviationActions
  ?item.deviationActions.split('\n').map(line=>line.replace(/^\s*(\d+[.)]|[-•])\s*/,'').trim()).filter(Boolean).map((text,index)=>newSubAction(text,index))
  :[]
 return {source:item.kind==='training'?'other':item.source,sourceId:item.sourceId,departmentId:item.departmentId,title:en?`Corrective action: ${title}`:`Διορθωτική ενέργεια: ${title}`,description:lines.join('\n'),priority:item.priority,subActions}
}

export function newSubAction(title='',index=0){
 return {id:`sa-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2,6)}`,title,owner:'',dueDate:'',done:false,doneAt:null,doneBy:''}
}

export function subActionProgress(subActions=[]){
 const total=subActions.length
 const done=subActions.filter(item=>item.done).length
 return {total,done,open:total-done}
}

export function overdueSubActions(subActions=[],today=new Date().toISOString().slice(0,10)){
 return subActions.filter(item=>!item.done&&item.dueDate&&item.dueDate<today)
}

// What a new CAPA opened from an incident or a finding starts with; a sentinel
// event's is its root cause analysis, due by the RCA deadline.
export function capaSourceFor(recordType,record,language='el'){
 const en=language==='en',code=record.displayId||record.id
 return {source:recordType==='incidents'?'incident':'finding',sourceId:record.id,departmentId:record.departmentId,department:record.department,departmentEn:record.departmentEn,priority:record.sentinel?'critical':record.severity,dueDate:record.sentinel?record.rcaDueDate:undefined,title:record.sentinel?(en?`Root cause analysis: ${code}`:`Ανάλυση ριζικής αιτίας: ${code}`):(en?'CAPA for ':'Διορθωτική ενέργεια για ')+code}
}
