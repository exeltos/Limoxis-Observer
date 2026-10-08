// Deviations recorded elsewhere (control executions with a finding, bundle
// assessments with a failed criterion) that no CAPA points to yet. Recording
// staff cannot create CAPAs (quality RLS), so the quality manager turns each
// one into a CAPA from this queue, prefilled.

const DAY=24*60*60*1000
const PRIORITY_BY_CRITICALITY={high:'high',medium:'medium',low:'low'}

export function controlSourceId(control,execution){return `${control.id}#${execution.id}`}
export function bundleSourceId(assessment){return `BND-${assessment.id}`}

export function sourcePath(sourceId=''){
 const value=String(sourceId||'')
 if(value.startsWith('CTRL-'))return `/controls/${value.split('#')[0]}`
 if(value.startsWith('BND-'))return `/prevention/bundles/${value.slice(4)}`
 return null
}

export function deviationQueue({controls=[],bundles=[],capas=[],now=new Date(),days=90}={}){
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
     deviationActions:String(control.responseConfig?.deviationActions||'').trim(),
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
 return items.sort((a,b)=>new Date(b.at)-new Date(a.at))
}

// What the CAPA create page receives for one queue item.
export function capaPrefill(item,language='el'){
 const en=language==='en'
 const title=en?item.titleEn||item.title:item.title
 const lines=[
  item.kind==='control'
   ?(en?`Control deviation in ${item.department}: ${item.detail||'non-compliant'}.`:`Απόκλιση ελέγχου στο τμήμα ${item.department}: ${item.detail||'μη συμμόρφωση'}.`)
   :(en?`Bundle assessment in ${item.department}: ${item.detail} criteria not met.`:`Αξιολόγηση bundle στο τμήμα ${item.department}: ${item.detail} κριτήρια δεν τηρήθηκαν.`),
  item.notes&&(en?`Notes: ${item.notes}`:`Σημειώσεις: ${item.notes}`),
 ].filter(Boolean)
 const subActions=item.deviationActions
  ?item.deviationActions.split('\n').map(line=>line.replace(/^\s*(\d+[.)]|[-•])\s*/,'').trim()).filter(Boolean).map((text,index)=>newSubAction(text,index))
  :[]
 return {source:item.source,sourceId:item.sourceId,departmentId:item.departmentId,title:en?`Corrective action: ${title}`:`Διορθωτική ενέργεια: ${title}`,description:lines.join('\n'),priority:item.priority,subActions}
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
