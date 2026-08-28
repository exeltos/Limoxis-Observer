import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileClock, FlaskConical, LockKeyhole, Microscope, Paperclip, Pencil, PhoneCall, PlayCircle, ShieldAlert, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { ManualDateField } from '../../design-system/ManualDateField'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { useTenant } from '../../core/tenant/TenantContext'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { getClinicalCase } from '../surveillance/clinicalDemoData'
import { syncDemoSurveillanceListItem } from '../surveillance/surveillanceDemoData'
import { syncEnvironmentalSurveillanceFromLab } from '../surveillance/environmentalSurveillanceData'
import { syncEmployeeSurveillanceFromLab } from '../surveillance/employeeSurveillanceData'
import { getLabSample, updateLabSample } from './laboratoryDemoData'
import { Status } from './LaboratoryPage'
import { demoLibrarySeed } from '../management/managementData'
import { readEnvironmentalStandards } from '../management/EnvironmentalStandardsPanel'

export function LaboratorySampleRecordPage(){
  const {sampleId}=useParams()
  const recordNavigation=useRecordSequenceNavigation({registry:'laboratory',currentId:sampleId,pathForId:id=>`/laboratory/${id}`})
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const actor=auditActorFromAuth({profile,user})
  const actorName=actor.name
  const {role,membership,canAccessRecord,canSeeSensitiveEmployeeHealth}=useTenant()
  const {goTo}=useContextualNavigation('/laboratory')
  const source=getLabSample(sampleId)
  const [sample,setLocalSample]=useState(source?{...source}:null)
  const [tab,setTab]=useState('summary')
  const [correctionOpen,setCorrectionOpen]=useState(false)
  const [correctionReason,setCorrectionReason]=useState('')
  const addOns=membership?.capabilities??[]
  const custom=membership?.customCapabilities??[]
  const has=(cap)=>can(role,cap,addOns,custom)
  const canManage=has(CAPABILITIES.MANAGE_LAB_SAMPLES)
  const canValidate=has(CAPABILITIES.VALIDATE_LAB_RESULTS)
  const canCommunicate=has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS)
  const canClassify=has(CAPABILITIES.CLASSIFY_RESISTANCE)
  const canReopenLab=has(CAPABILITIES.REOPEN_LAB_RECORD)
  const canAttach=has(CAPABILITIES.ATTACH_FILES)
  const canPrint=has(CAPABILITIES.PRINT_RECORDS)
  const canExport=has(CAPABILITIES.EXPORT_RECORDS)
  const sampleInScope=!sample||canAccessRecord({...sample,department:sample.department})
  const employeeHealthAllowed=!sample||sample.workflowType!=='employee_screening'||canSeeSensitiveEmployeeHealth
  const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'

  if(!sample)return <Page title={t('laboratoryRecords.sample')}><div className="inline-empty">{t('noData')}</div></Page>
  if(!sampleInScope||!employeeHealthAllowed)return <Page title={t('laboratoryRecords.sample')}><div className="inline-empty">Δεν έχετε πρόσβαση σε αυτή την εγγραφή.</div></Page>

  const patientName=language==='el'?sample.patient:sample.patientEn
  const subjectLabel=sample.subjectType==='employee'?t('employee'):['surface','room','air','water'].includes(sample.subjectType)?t(sample.subjectType):t('patient')
  const finalized=Boolean(sample.finalizedAt)
  const correctionLocked=finalized||sample.status==='completed'||sample.resultStatus==='validated'
  const resultValidated=sample.resultStatus==='validated'||finalized
  const astRequired=sample.result==='positive'
  const astComplete=!astRequired||Boolean(sample.ast?.length)
  const communicationRequired=Boolean(sample.critical)
  const communicationComplete=!communicationRequired||Boolean(sample.communications?.length)
  const tabAccess={
    summary:true,
    result:finalized||['received','processing','completed'].includes(sample.status),
    ast:finalized||resultValidated,
    communication:finalized||(resultValidated&&astComplete),
    documents:finalized||(resultValidated&&astComplete&&communicationComplete),
    finalize:finalized||Boolean(sample.documentsReviewedAt),
    history:finalized,
  }
  const tabs=[
    {id:'summary',label:t('summary'),icon:FlaskConical},
    {id:'result',label:t('laboratoryRecords.microbiologyResult'),icon:Microscope,disabled:!tabAccess.result,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'ast',label:t('laboratoryRecords.antimicrobialSusceptibility'),icon:ShieldAlert,disabled:!tabAccess.ast,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'communication',label:t('laboratoryRecords.criticalCommunication'),icon:PhoneCall,disabled:!tabAccess.communication,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'documents',label:t('documents'),icon:Paperclip,disabled:!tabAccess.documents,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'finalize',label:t('laboratoryRecords.finalization'),icon:CheckCircle2,disabled:!tabAccess.finalize,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'history',label:t('history'),icon:FileClock,disabled:!tabAccess.history,lockedLabel:t('laboratoryRecords.availableAfterFinalization')},
  ]
  const workflowOrder=['summary','result','ast','communication','documents','finalize',...(finalized?['history']:[])]
  const workflowLabels=Object.fromEntries(tabs.map(item=>[item.id,item.label]))
  function openGeneralEdit(){
    if(correctionLocked){
      setCorrectionOpen(true)
      return
    }
    setTab(tabAccess.result?'result':'summary')
  }

  function persist(updater){
    const next=updateLabSample(sample.id,current=>{
      const updated=typeof updater==='function'?updater(current):{...current,...updater}
      return updated
    })
    if(next)setLocalSample({...next})
    return next
  }

  if(sample.workflowType==='employee_screening'){
    return <EmployeeScreeningLaboratoryRecord sample={sample} persist={persist} t={t} language={language} fmt={fmt} canManage={canManage} canValidate={canValidate} canAttach={canAttach} canReopen={canReopenLab} canPrint={canPrint} canExport={canExport} notify={notify} recordNavigation={recordNavigation} actorName={actorName}/>
  }

  if(['environmental_plate','environmental_individual'].includes(sample.workflowType)){
    return <EnvironmentalLaboratoryRecord
      sample={sample}
      persist={persist}
      t={t}
      language={language}
      fmt={fmt}
      canManage={canManage}
      canValidate={canValidate}
      canAttach={canAttach}
      canReopen={canReopenLab}
      canPrint={canPrint}
      canExport={canExport}
      notify={notify}
      recordNavigation={recordNavigation}
      actorName={actorName}
    />
  }

  function syncValidatedResult(next){
    if(!next?.surveillanceCase)return
    const surveillance=getClinicalCase(next.surveillanceCase)
    if(!surveillance)return
    const existingIndex=(surveillance.samples||[]).findIndex(x=>x.id===next.id)
    const linked={
      id:next.id,
      type:next.type,
      collectedAt:next.collectedAt,
      resultedAt:next.resultedAt,
      result:next.result,
      organism:next.organism,
      organisms:next.organisms||[],
      resistance:next.resistance,
      susceptibility:(next.ast||[]).map(x=>`${x.organism?`${x.organism}: `:''}${x.drug} ${x.sir}`).join(' · '),
      critical:Boolean(next.critical),
      communicatedAt:next.communications?.[0]?.at||null,
      status:next.status,
      resultStatus:next.resultStatus,
    }
    if(existingIndex>=0)surveillance.samples.splice(existingIndex,1,linked)
    else surveillance.samples=[...(surveillance.samples||[]),linked]

    if(next.resultStatus==='validated'&&next.result==='positive'&&next.organism){
      surveillance.organism=next.organism
      surveillance.organisms=next.organisms||[]
      surveillance.resistance=next.resistance||null
      surveillance.therapySuggestions=(next.ast||[]).filter(x=>x.sir==='S').map(x=>({antimicrobial:x.drug,organism:x.organism||next.organism,source:'laboratory_ast'}))
      surveillance.source=next.source||null
      surveillance.sourceEn=next.sourceEn||next.source||null
    }
    surveillance.timeline=[
      {
        at:new Date().toISOString(),
        type:'laboratoryResultValidated',
        actor:t('laboratory'),
        detail:`${next.id}${next.organism?` · ${next.organism}`:''}`,
      },
      ...(surveillance.timeline||[]),
    ]
    syncDemoSurveillanceListItem(surveillance)
  }

  function receiveSample(){
    const now=new Date().toISOString()
    persist(current=>({...current,status:'received',receivedAt:now,timeline:[{at:now,type:'sampleReceived',actor:actorName},...(current.timeline||[])]}))
    notify(t('laboratoryRecords.sampleReceivedMessage'),'success')
    setTab('summary')
  }

  function startProcessing(){
    const now=new Date().toISOString()
    persist(current=>({...current,status:'processing',timeline:[{at:now,type:'sampleProcessingStarted',actor:actorName},...(current.timeline||[])]}))
    notify(t('laboratoryRecords.sampleProcessingStartedMessage'),'success')
    setTab('result')
  }

  return <Page fill>
    <EntityRecordShell
      className="laboratory-record-shell workspace-fill"
      recordNavigation={recordNavigation}
      avatar={<FlaskConical size={20}/>}
      eyebrow={sample.id}
      title={t(sample.type)}
      subtitle={`${patientName} · ${sample.patientId} · ${language==='el'?sample.department:sample.departmentEn}`}
      status={<><Status text={t(sample.status)} kind={sample.status}/>{sample.resistance&&<b className="amr-chip">{sample.resistance}</b>}</>}
      headerActions={<>{(canManage||canReopenLab)&&<button className="general-edit-button" title={correctionLocked?'Διόρθωση εργαστηριακής εγγραφής':t('laboratoryRecords.generalEdit')} onClick={openGeneralEdit}><Pencil size={15}/><span>{correctionLocked?'Διόρθωση':t('laboratoryRecords.generalEdit')}</span></button>}<PrintExportActions showPrint={canPrint} showExport={canExport} onExport={()=>downloadRecordJson(sample,{filename:sample.id})}/></>}
      tabs={tabs}
      activeTab={tab}
      onTabChange={next=>{
        if(finalized){setTab(next);return}
        const currentIndex=workflowOrder.indexOf(tab)
        const nextIndex=workflowOrder.indexOf(next)
        if(nextIndex>=0&&tabAccess[next]&&(nextIndex<=currentIndex||correctionLocked))setTab(next)
      }}
      backLabel={t('backToLaboratory')}
    >
      {!canManage&&tab==='summary'&&<div className="permission-info-banner"><AlertTriangle size={16}/><span>{t('laboratoryRecords.laboratoryReadOnlyRole')}</span></div>}
      {tab==='summary'&&<SampleSummary sample={sample} t={t} language={language} fmt={fmt} subjectLabel={subjectLabel} canManage={canManage&&!finalized} finalized={finalized} onReceive={receiveSample} onStartProcessing={startProcessing} onOpenSurveillance={()=>sample.surveillanceCase&&goTo(`/surveillance/${sample.surveillanceCase}`,{state:{openTab:'surveillanceJourney'}})}/>}
      {tab==='result'&&<ResultPanel sample={sample} persist={persist} syncValidatedResult={syncValidatedResult} t={t} language={language} fmt={fmt} canManage={canManage&&!finalized} canValidate={canValidate&&!finalized} canClassify={canClassify} notify={notify} actorName={actorName} onNext={()=>setTab('ast')}/>}
      {tab==='ast'&&<AstPanel sample={sample} persist={persist} t={t} language={language} canManage={canManage&&!finalized} notify={notify} actorName={actorName} onNext={()=>setTab('communication')}/>}
      {tab==='communication'&&<CriticalCommunicationPanel sample={sample} persist={persist} syncValidatedResult={syncValidatedResult} t={t} language={language} fmt={fmt} canCommunicate={canCommunicate&&!finalized} notify={notify} actorName={actorName} onNext={()=>setTab('documents')}/>}
      {tab==='finalize'&&<FinalizationPanel sample={sample} persist={persist} syncValidatedResult={syncValidatedResult} t={t} fmt={fmt} canFinalize={canValidate&&!finalized} notify={notify} actorName={actorName} onFinalized={()=>setTab('summary')}/>}
      {tab==='documents'&&<DocumentsPanel sample={sample} persist={persist} t={t} canAttach={canAttach&&!finalized} finalized={finalized} notify={notify} actorName={actorName} onNext={()=>setTab('finalize')}/>}
      {tab==='history'&&<LabHistory sample={sample} t={t} fmt={fmt}/>}
      <LabStepNavigator active={tab} order={workflowOrder} labels={workflowLabels} canOpen={id=>Boolean(tabAccess[id])} onMove={setTab}/>
    </EntityRecordShell>
    {correctionOpen&&<div className="modal-backdrop"><div className="entry-card correction-entry-card"><header><div><span className="eyebrow">{t('laboratory')}</span><h3>{t('laboratoryRecords.generalEdit')}</h3><p>{t('laboratoryRecords.generalEditHelp')}</p></div><button className="icon-close" onClick={()=>setCorrectionOpen(false)}>×</button></header><div className="entry-grid"><label className="entry-span-2"><span>{t('reasonRequired')}</span><textarea rows={4} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder={t('laboratoryRecords.generalEditReasonPlaceholder')}/></label></div><footer><Button variant="secondary" onClick={()=>setCorrectionOpen(false)}>{t('cancel')}</Button><Button disabled={!correctionReason.trim()} onClick={()=>{const now=new Date().toISOString();persist(current=>({...current,status:'processing',finalizedAt:null,finalizedBy:null,documentsReviewedAt:null,correctionReason,correctionOpenedAt:now,timeline:[{at:now,type:'laboratoryRecordReopened',actor:actorName,detail:correctionReason},...(current.timeline||[])]}));setCorrectionOpen(false);setCorrectionReason('');setTab('result');notify(t('laboratoryRecords.laboratoryRecordReopenedMessage'),'success')}}>{t('laboratoryRecords.unlockForCorrection')}</Button></footer></div></div>}
  </Page>
}

function SampleSummary({sample,t,language,fmt,subjectLabel,canManage,finalized,onReceive,onStartProcessing,onOpenSurveillance}){
  return <div className="record-section laboratory-summary">
    <div className="record-section-header lab-summary-heading">
      <div><span className="eyebrow">{t('laboratoryRecords.sample')}</span><h3>{t('sampleDetails')}</h3></div>
    </div>
    {finalized&&<div className="validated-result-note lab-finalized-banner"><CheckCircle2 size={16}/><span>{t('laboratoryRecords.laboratoryRecordFinalizedReadOnly')}</span></div>}
    {canManage&&['requested','received'].includes(sample.status)&&<div className="lab-primary-workflow-action">
      {sample.status==='requested'&&<Button onClick={onReceive}><FlaskConical size={15}/>{t('laboratoryRecords.receiveSample')}</Button>}
      {sample.status==='received'&&<Button onClick={onStartProcessing}><PlayCircle size={15}/>{t('laboratoryRecords.startProcessing')}</Button>}
    </div>}
    <div className="detail-grid lab-detail-grid">
      <Detail l={t('sampleCode')} v={sample.id}/>
      <Detail l={subjectLabel} v={language==='el'?sample.patient:sample.patientEn}/>
      <Detail l={sample.subjectType==='employee'?t('employeeCode'):t('patientId')} v={sample.patientId}/>
      <Detail l={t('department')} v={language==='el'?sample.department:sample.departmentEn}/>
      <Detail l={t('sampleType')} v={t(sample.type)}/>
      <Detail l={t('clinicalSource')} v={language==='el'?sample.source:sample.sourceEn}/>
      <Detail l={t('anatomicalSite')} v={sample.anatomicalSite||'—'}/>
      <Detail l={t('collectedLabel')} v={fmt(sample.collectedAt)}/>
      <Detail l={t('laboratoryRecords.receivedLabel')} v={fmt(sample.receivedAt)}/>
      <Detail l={t('priority')} v={t(sample.priority)}/>
      <Detail l={t('status')} v={t(sample.status)}/>
      <Detail l={t('laboratoryRecords.resultStatus')} v={t(sample.resultStatus||'draft')}/>
    </div>
    {sample.surveillanceCase&&<button className="linked-surveillance-callout" onClick={onOpenSurveillance}><span>{t('laboratoryRecords.linkedSurveillance')}</span><strong>{sample.surveillanceCase}</strong><small>{t('laboratoryRecords.openLinkedSurveillance')}</small></button>}
    <div className="source-truth-note">{t('laboratoryRecords.labSourceTruth')}</div>
  </div>
}

function ResultPanel({sample,persist,syncValidatedResult,t,language,fmt,canManage,canValidate,canClassify,notify,actorName,onNext}){
  const [editing,setEditing]=useState(()=>canManage&&sample.status==='processing'&&!sample.result)
  const [draft,setDraft]=useState({result:sample.result||'',organisms:sample.organisms?.length?sample.organisms:[...(sample.organism?[{name:sample.organism,resistance:sample.resistance||''}]:[])],critical:Boolean(sample.critical)})
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  const canEnterResult=['received','processing','completed'].includes(sample.status)

  function save(){
    if(!canEnterResult)return
    const now=new Date().toISOString()
    const amended=sample.resultStatus==='validated'
    const nextStatus=amended?'amended':'draft'
    const primary=draft.organisms?.[0]||null
    const next=persist(current=>({...current,...draft,organism:primary?.name||null,resistance:primary?.resistance||null,resultStatus:nextStatus,resultedAt:current.resultedAt||now,status:current.status==='received'?'processing':current.status,timeline:[{at:now,type:amended?'resultAmended':'resultUpdated',actor:actorName},...(current.timeline||[])]}))
    setEditing(false)
    notify(t(amended?'resultAmendedMessage':'resultSaved'),'success')
    if(next?.resultStatus==='validated')syncValidatedResult(next)
  }

  function validate(){
    if(!sample.result)return
    if(sample.result==='positive'&&!(sample.organisms?.length||sample.organism)){notify(t('laboratoryRecords.organismRequiredForPositive'),'warning');return}
    const now=new Date().toISOString()
    const next=persist(current=>({...current,resultStatus:'validated',validatedAt:now,validatedBy:actorName,status:'completed',timeline:[{at:now,type:'resultValidated',actor:actorName},...(current.timeline||[])]}))
    syncValidatedResult(next)
    notify(t('laboratoryRecords.resultValidatedAndSynced'),'success')
    onNext?.()
  }

  return <div className="record-section">
    <div className="record-section-header">
      <div><span className="eyebrow">{t('laboratoryRecords.microbiologyResult')}</span><h3>{t('laboratoryRecords.resultAndOrganism')}</h3></div>
      <div className="record-inline-actions">
        {canManage&&canEnterResult&&!editing&&<button title={sample.resultStatus==='validated'?t('laboratoryRecords.amendResult'):t('edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></button>}
        
      </div>
    </div>
    {!canEnterResult&&<div className="workflow-empty-step"><strong>{t('laboratoryRecords.resultLockedUntilReceipt')}</strong><span>{t('laboratoryRecords.resultLockedUntilReceiptHelp')}</span></div>}
    <div className={`detail-grid lab-result-grid ${editing?'employee-inline-edit':''}`}>
      <EditableSelect editing={editing} label={t('result')} value={draft.result} display={sample.result?t(sample.result):'—'} onChange={v=>set('result',v)} options={[['',t('select')],['positive',t('positive')],['negative',t('negative')],['inconclusive',t('inconclusive')],['contaminated',t('contaminated')]]}/>
      <div className="detail-item entry-span-2 lab-organisms-editor"><span>{t('laboratoryRecords.organisms')}</span>{editing&&draft.result==='positive'?<OrganismEditor organisms={draft.organisms||[]} onChange={rows=>set('organisms',rows)} options={demoLibrarySeed.microorganisms.map(([el,en])=>language==='el'?el:en)} t={t} canClassify={canClassify}/>:<div className="organism-read-list">{(sample.organisms?.length?sample.organisms:(sample.organism?[{name:sample.organism,resistance:sample.resistance}]:[])).map((row,index)=><span key={`${row.name}-${index}`}><strong>{row.name}</strong>{row.resistance&&<b className="amr-chip">{row.resistance}</b>}</span>)||'—'}</div>}</div>
      <EditableSelect editing={editing} label={t('criticalResult')} value={draft.critical?'yes':'no'} display={sample.critical?t('yes'):t('no')} onChange={v=>set('critical',v==='yes')} options={[['no',t('no')],['yes',t('yes')]]}/>
      <Detail l={t('laboratoryRecords.resultStatus')} v={t(sample.resultStatus||'draft')}/>
      <Detail l={t('laboratoryRecords.resultedAt')} v={fmt(sample.resultedAt)}/>
      <Detail l={t('laboratoryRecords.validatedAt')} v={fmt(sample.validatedAt)}/>
      <Detail l={t('laboratoryRecords.validatedBy')} v={sample.validatedBy||'—'}/>
    </div>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft({result:sample.result||'',organisms:sample.organisms?.length?sample.organisms:[...(sample.organism?[{name:sample.organism,resistance:sample.resistance||''}]:[])],critical:Boolean(sample.critical)});setEditing(false)}}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></div>}
    {!editing&&canValidate&&sample.result&&sample.resultStatus!=='validated'&&<div className="lab-validation-callout"><div><CheckCircle2 size={18}/><span><strong>{t('laboratoryRecords.resultReadyForValidation')}</strong><small>{t('laboratoryRecords.resultReadyForValidationHelp')}</small></span></div><Button onClick={validate}><CheckCircle2 size={15}/>{t('laboratoryRecords.validateResult')}</Button></div>}
    {sample.resultStatus==='validated'&&<div className="validated-result-note"><CheckCircle2 size={16}/><span>{t('laboratoryRecords.validatedResultSyncedHint')}</span></div>}
  </div>
}

function AstPanel({sample,persist,t,language,canManage,notify,actorName,onNext}){
  const {confirm}=useFeedback()
  const availableOrganisms=sample.organisms?.length?sample.organisms.map(x=>x.name):(sample.organism?[sample.organism]:[])
  const emptyDraft={organism:availableOrganisms[0]||'',drug:'',sir:'S',mic:'',method:'MIC',standard:'EUCAST',version:'16.0'}
  const [open,setOpen]=useState(false)
  const [editingIndex,setEditingIndex]=useState(null)
  const [draft,setDraft]=useState(emptyDraft)
  const available=sample.result==='positive'&&Boolean(sample.organism)

  function openNew(){
    setEditingIndex(null)
    setDraft(emptyDraft)
    setOpen(true)
  }
  function openEdit(row,index){
    setEditingIndex(index)
    setDraft({...emptyDraft,...row})
    setOpen(true)
  }
  function save(){
    if(!draft.drug.trim())return
    persist(current=>{
      const rows=[...(current.ast||[])]
      if(editingIndex===null)rows.push({...draft})
      else rows[editingIndex]={...draft}
      return {...current,ast:rows,timeline:[{at:new Date().toISOString(),type:editingIndex===null?'astUpdated':'astCorrected',actor:actorName,detail:draft.drug},...(current.timeline||[])]}
    })
    setOpen(false)
    setEditingIndex(null)
    setDraft(emptyDraft)
    notify(t(editingIndex===null?'astSaved':'astCorrectedMessage'),'success')
  }
  async function remove(index){
    const row=sample.ast?.[index]
    if(!row)return
    const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
    if(!ok)return
    persist(current=>({...current,ast:(current.ast||[]).filter((_,i)=>i!==index),timeline:[{at:new Date().toISOString(),type:'astDeleted',actor:actorName,detail:row.drug},...(current.timeline||[])]}))
    notify(t('laboratoryRecords.astDeletedMessage'),'success')
  }
  const canContinue=!available||Boolean(sample.ast?.length)
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.antimicrobialSusceptibility')}</span><h3>{t('laboratoryRecords.astResults')}</h3></div>{canManage&&available&&<Button onClick={openNew}>+ {t('laboratoryRecords.addAstResult')}</Button>}</div>
    <div className="ast-governance-note"><ShieldAlert size={16}/><span>{t('laboratoryRecords.eucastSirHint')} <strong>{t('laboratoryRecords.micFullLabel')}</strong> — {t('laboratoryRecords.micHelp')}</span></div>
    {!available&&<div className="workflow-empty-step"><strong>{t('laboratoryRecords.astNotRequired')}</strong><span>{t('laboratoryRecords.astNotRequiredHelp')}</span></div>}
    {sample.ast?.length?<div className="record-table-wrap"><table className="record-table ast-record-table"><thead><tr>{availableOrganisms.length>1&&<th>{t('organism')}</th>}<th>{t('antimicrobial')}</th><th>{t('laboratoryRecords.sir')}</th><th>{t('laboratoryRecords.micFullLabel')}</th><th>{t('laboratoryRecords.method')}</th><th>{t('laboratoryRecords.breakpointStandard')}</th>{canManage&&<th>{t('actions')}</th>}</tr></thead><tbody>{sample.ast.map((row,index)=><tr key={`${row.organism||''}-${row.drug}-${index}`}>{availableOrganisms.length>1&&<td>{row.organism||'—'}</td>}<td><strong>{row.drug}</strong></td><td><b className={`sir ${row.sir.toLowerCase()}`}>{row.sir}</b></td><td>{row.mic||'—'}</td><td>{row.method||'—'}</td><td>{row.standard||'EUCAST'} {row.version||''}</td>{canManage&&<td><div className="row-icon-actions"><button title={t('edit')} onClick={()=>openEdit(row,index)}><Pencil size={15}/></button><button className="danger" title={t('delete')} onClick={()=>remove(index)}><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div>:available?<div className="inline-empty">{t('laboratoryRecords.noAstResults')}</div>:null}
    {canManage&&<div className="lab-step-footer"><Button variant="secondary" onClick={()=>{}} disabled>{t('laboratoryRecords.previousUseTabs')}</Button><Button disabled={!canContinue} onClick={onNext}>{t('saveAndContinue')}</Button></div>}
    {open&&<div className="modal-backdrop"><div className="entry-card ast-entry-card"><header><div><span className="eyebrow">{t('laboratoryRecords.antimicrobialSusceptibility')}</span><h3>{editingIndex===null?t('laboratoryRecords.addAstResult'):t('laboratoryRecords.editAstResult')}</h3></div><button className="icon-close" onClick={()=>setOpen(false)}>×</button></header><div className="ast-editor-layout">
          <div className="ast-editor-section primary">
            <span className="ast-editor-section-title">{t('laboratoryRecords.astIdentification')}</span>
            <div className="ast-editor-grid">
              {availableOrganisms.length>1&&<label><span>{t('organism')}</span><select value={draft.organism} onChange={e=>setDraft(d=>({...d,organism:e.target.value}))}>{availableOrganisms.map(name=><option key={name}>{name}</option>)}</select></label>}
              <label className={availableOrganisms.length>1?'':'full'}><span>{t('antimicrobial')}</span><input list="ast-antimicrobials" value={draft.drug} onChange={e=>setDraft(d=>({...d,drug:e.target.value}))}/><datalist id="ast-antimicrobials">{demoLibrarySeed.antibiotics.map(([el,en])=><option key={el} value={language==='el'?el:en}/>)}</datalist><small className="field-hint">{t('selectOrTypeManually')}</small></label>
            </div>
          </div>
          <div className="ast-editor-section interpretation">
            <span className="ast-editor-section-title">{t('laboratoryRecords.astInterpretation')}</span>
            <div className="ast-editor-grid">
              <label><span>{t('laboratoryRecords.sir')}</span><select value={draft.sir} onChange={e=>setDraft(d=>({...d,sir:e.target.value}))}><option>S</option><option>I</option><option>R</option></select><small className="field-hint">{t('laboratoryRecords.sirShortHelp')}</small></label>
              <label><span>{t('laboratoryRecords.micFullLabel')}</span><input value={draft.mic} onChange={e=>setDraft(d=>({...d,mic:e.target.value}))}/><small className="field-hint">{t('laboratoryRecords.micHelpShort')}</small></label>
            </div>
          </div>
          <div className="ast-editor-section method">
            <span className="ast-editor-section-title">{t('laboratoryRecords.astMethod')}</span>
            <div className="ast-editor-grid three">
              <label><span>{t('laboratoryRecords.method')}</span><input value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}/></label>
              <label><span>{t('laboratoryRecords.breakpointStandard')}</span><input value={draft.standard} onChange={e=>setDraft(d=>({...d,standard:e.target.value}))}/></label>
              <label><span>{t('laboratoryRecords.version')}</span><input value={draft.version} onChange={e=>setDraft(d=>({...d,version:e.target.value}))}/></label>
            </div>
          </div>
        </div><footer><Button variant="secondary" onClick={()=>setOpen(false)}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></footer></div></div>}
  </div>
}

function CriticalCommunicationPanel({sample,persist,syncValidatedResult,t,language,fmt,canCommunicate,notify,actorName,onNext}){
  const [open,setOpen]=useState(false)
  const [draft,setDraft]=useState({to:'',toEn:'',method:'phone',readBack:true,notes:'',notesEn:''})
  function save(){
    const at=new Date().toISOString()
    const row={id:`COMM-${Date.now()}`,at,by:actorName,...draft}
    const next=persist(current=>({...current,communications:[row,...(current.communications||[])],timeline:[{at,type:'criticalCommunicated',actor:actorName},...(current.timeline||[])]}))
    syncValidatedResult(next)
    setOpen(false)
    setDraft({to:'',toEn:'',method:'phone',readBack:true,notes:'',notesEn:''})
    notify(t('laboratoryRecords.criticalCommunicationSaved'),'success')
    onNext?.()
  }
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('criticalResult')}</span><h3>{t('laboratoryRecords.criticalCommunication')}</h3></div>{sample.critical&&canCommunicate&&<Button onClick={()=>setOpen(true)}>+ {t('laboratoryRecords.newCommunication')}</Button>}</div>
    {!sample.critical&&<div className="source-truth-note">{t('laboratoryRecords.notMarkedCritical')}</div>}
    {sample.critical&&!(sample.communications?.length)&&<div className="critical-box open"><AlertTriangle size={17}/><div><strong>{t('laboratoryRecords.criticalCommunicationRequired')}</strong><span>{t('laboratoryRecords.criticalCommunicationRequiredHint')}</span></div></div>}
    {(sample.communications||[]).length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('date')}</th><th>{t('laboratoryRecords.recipient')}</th><th>{t('laboratoryRecords.method')}</th><th>{t('laboratoryRecords.communicatedBy')}</th><th>{t('laboratoryRecords.readBack')}</th><th>{t('notes')}</th></tr></thead><tbody>{sample.communications.map(row=><tr key={row.id}><td>{fmt(row.at)}</td><td>{language==='el'?row.to:row.toEn||row.to}</td><td>{t(row.method)}</td><td>{row.by}</td><td>{row.readBack?t('yes'):t('no')}</td><td>{language==='el'?row.notes:row.notesEn||row.notes}</td></tr>)}</tbody></table></div>:null}
    {(!sample.critical||sample.communications?.length>0)&&<div className="lab-step-footer"><Button onClick={onNext}>{t('laboratoryRecords.continueToFinalization')}</Button></div>}
    {open&&<div className="modal-backdrop"><div className="entry-card communication-entry-card"><header><div><span className="eyebrow">{t('laboratoryRecords.criticalCommunication')}</span><h3>{t('laboratoryRecords.newCommunication')}</h3></div><button className="icon-close" onClick={()=>setOpen(false)}>×</button></header><div className="entry-grid"><label><span>{t('laboratoryRecords.recipient')}</span><input value={language==='el'?draft.to:draft.toEn} onChange={e=>setDraft(d=>({...d,[language==='el'?'to':'toEn']:e.target.value}))}/></label><label><span>{t('laboratoryRecords.method')}</span><select value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}><option value="phone">{t('phone')}</option><option value="in_person">{t('laboratoryRecords.inPerson')}</option><option value="secure_message">{t('laboratoryRecords.secureMessage')}</option><option value="other">{t('other')}</option></select></label><label><span>{t('laboratoryRecords.readBack')}</span><select value={draft.readBack?'yes':'no'} onChange={e=>setDraft(d=>({...d,readBack:e.target.value==='yes'}))}><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></label><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={language==='el'?draft.notes:draft.notesEn} onChange={e=>setDraft(d=>({...d,[language==='el'?'notes':'notesEn']:e.target.value}))}/></label></div><footer><Button variant="secondary" onClick={()=>setOpen(false)}>{t('cancel')}</Button><Button disabled={!(draft.to||draft.toEn)} onClick={save}>{t('save')}</Button></footer></div></div>}
  </div>
}



function EmployeeScreeningLaboratoryRecord({sample,persist,t,language,fmt,canManage,canValidate,canAttach,canReopen,canPrint,canExport,notify,recordNavigation,actorName}){
  const navigate=useNavigate()
  const location=useLocation()
  const finalized=Boolean(sample.finalizedAt)
  const correctionLocked=finalized||sample.status==='completed'||sample.resultStatus==='validated'
  const [tab,setTab]=useState('summary')
  const [correctionOpen,setCorrectionOpen]=useState(false)
  const [correctionReason,setCorrectionReason]=useState('')
  const [draft,setDraft]=useState({
    result:sample.result||'',
    organism:sample.organism||'',
    interventionType:sample.interventionType||'',
    interventionDetails:sample.interventionDetails||'',
    interventionStart:sample.interventionStart||'',
    interventionEnd:sample.interventionEnd||'',
  })
  useEffect(()=>{
    setDraft({
      result:sample.result||'',organism:sample.organism||'',
      interventionType:sample.interventionType||'',interventionDetails:sample.interventionDetails||'',
      interventionStart:sample.interventionStart||'',interventionEnd:sample.interventionEnd||'',
    })
  },[sample.id,sample.result,sample.organism,sample.interventionType,sample.interventionDetails,sample.interventionStart,sample.interventionEnd])
  const resultDone=sample.resultStatus==='validated'||finalized
  const documentsDone=Boolean(sample.documentsReviewedAt)
  const tabs=[
    {id:'summary',label:t('summary'),icon:FlaskConical},
    {id:'result',label:t('laboratoryRecords.screeningResult'),icon:Microscope,disabled:!['received','processing','completed'].includes(sample.status)&&!finalized},
    {id:'documents',label:t('documents'),icon:Paperclip,disabled:!resultDone&&!finalized},
    {id:'finalize',label:t('laboratoryRecords.finalization'),icon:CheckCircle2,disabled:!documentsDone&&!finalized},
    {id:'history',label:t('history'),icon:FileClock,disabled:!finalized},
  ]
  const workflowOrder=['summary','result','documents','finalize',...(finalized?['history']:[])]
  const workflowLabels=Object.fromEntries(tabs.map(item=>[item.id,item.label]))
  const access={
    summary:true,
    result:['received','processing','completed'].includes(sample.status)||finalized,
    documents:resultDone||finalized,
    finalize:documentsDone||finalized,
    history:finalized,
  }
  function openGeneralEdit(){
    if(correctionLocked){setCorrectionOpen(true);return}
    setTab(access.result?'result':'summary')
  }
  function receive(){const now=new Date().toISOString();persist(c=>({...c,status:'received',receivedAt:now,timeline:[{at:now,type:'employeeScreeningReceived',actor:actorName},...(c.timeline||[])]}));notify(t('laboratoryRecords.sampleReceivedMessage'),'success')}
  function start(){const now=new Date().toISOString();persist(c=>({...c,status:'processing',timeline:[{at:now,type:'employeeScreeningProcessingStarted',actor:actorName},...(c.timeline||[])]}));setTab('result')}
  function validate(){
    if(!draft.result)return
    if(draft.result==='positive'&&!draft.organism.trim()){notify(t('laboratoryRecords.organismRequiredForPositive'),'warning');return}
    const now=new Date().toISOString()
    persist(c=>({...c,
      result:draft.result,
      organism:draft.result==='positive'?draft.organism.trim():null,
      organisms:draft.result==='positive'?[{name:draft.organism.trim()}]:[],
      interventionType:draft.interventionType||null,
      interventionDetails:draft.interventionDetails.trim()||null,
      interventionStart:draft.interventionStart||null,
      interventionEnd:draft.interventionEnd||null,
      resultStatus:'validated',validatedAt:now,status:'processing',
      timeline:[{at:now,type:'employeeScreeningResultValidated',actor:actorName,detail:draft.interventionType?`${t('clinicalRecords.intervention')}: ${draft.interventionType}`:undefined},...(c.timeline||[])]
    }))
    syncEmployeeSurveillanceFromLab();window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated'));notify(t('laboratoryRecords.screeningResultSaved'),'success');setTab('documents')
  }
  function finalize(){
    const now=new Date().toISOString()
    persist(c=>({...c,status:'completed',finalizedAt:now,finalizedBy:actorName,timeline:[{at:now,type:'employeeScreeningFinalized',actor:actorName},...(c.timeline||[])]}))
    syncEmployeeSurveillanceFromLab();window.dispatchEvent(new CustomEvent('limoxis:employee-surveillance-updated'));notify(t('laboratoryRecords.screeningFinalized'),'success');setTab('summary')
  }
  function reopenForCorrection(){
    const reason=correctionReason.trim()
    if(!reason)return
    const now=new Date().toISOString()
    persist(c=>({...c,status:'processing',finalizedAt:null,finalizedBy:null,documentsReviewedAt:null,correctionReason:reason,correctionOpenedAt:now,timeline:[{at:now,type:'laboratoryRecordReopened',actor:actorName,detail:reason},...(c.timeline||[])]}))
    setCorrectionOpen(false);setCorrectionReason('');setTab('result');notify(t('laboratoryRecords.laboratoryRecordReopenedMessage'),'success')
  }
  return <Page fill><EntityRecordShell
    className="laboratory-record-shell workspace-fill employee-screening-lab"
    recordNavigation={recordNavigation}
    avatar={<FlaskConical size={20}/>} eyebrow={sample.id} title={t(sample.sourceCode||'employeeScreening')}
    subtitle={`${language==='el'?sample.patient:sample.patientEn} · ${sample.employeeId||sample.patientId} · ${language==='el'?sample.department:sample.departmentEn}`}
    status={<Status text={finalized?t('completed'):t(sample.status)} kind={sample.status}/>} 
    headerActions={<>{(canManage||canReopen)&&<button className="general-edit-button" title={correctionLocked?'Διόρθωση εργαστηριακής εγγραφής':t('laboratoryRecords.generalEdit')} onClick={openGeneralEdit}><Pencil size={15}/><span>{correctionLocked?'Διόρθωση':t('laboratoryRecords.generalEdit')}</span></button>}<PrintExportActions showPrint={canPrint} showExport={canExport} onExport={()=>downloadRecordJson(sample,{filename:sample.id})}/></>}
    tabs={tabs} activeTab={tab} onTabChange={next=>{const reached=finalized?4:documentsDone?3:resultDone?2:['received','processing'].includes(sample.status)?1:0;const ni=workflowOrder.indexOf(next);if(ni>=0&&access[next]&&(ni<=reached||correctionLocked))setTab(next)}} backLabel={t('backToLaboratory')}>
      {tab==='summary'&&<div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('employeeSurveillance')}</span><h3>{t('laboratoryRecords.employeeScreeningSample')}</h3></div></div><div className="detail-grid lab-detail-grid"><Detail l={t('employee')} v={language==='el'?sample.patient:sample.patientEn}/><Detail l={t('employeeCode')} v={sample.employeeId||sample.patientId}/><Detail l={t('department')} v={language==='el'?sample.department:sample.departmentEn}/><Detail l={t('screeningType')} v={t(sample.sourceCode)}/><Detail l={t('samplingDate')} v={fmt(sample.collectedAt)}/><Detail l={t('status')} v={t(sample.status)}/></div>{(sample.interventionType||sample.interventionDetails)&&<div className="source-truth-note"><strong>{t('clinicalRecords.intervention')}:</strong> {sample.interventionType?t(`clinicalRecords.${sample.interventionType}`):''}{sample.interventionDetails?` · ${sample.interventionDetails}`:''}</div>}{canManage&&sample.status==='requested'&&<div className="lab-step-footer"><Button onClick={receive}>{t('laboratoryRecords.receiveSample')}</Button></div>}{canManage&&sample.status==='received'&&<div className="lab-step-footer"><Button onClick={start}>{t('laboratoryRecords.startProcessing')}</Button></div>}</div>}
      {tab==='result'&&<div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.screeningResult')}</span><h3>{t('laboratoryRecords.employeeScreeningAssessment')}</h3><p>{t('laboratoryRecords.employeeScreeningAssessmentHelp')}</p></div></div><div className="form-grid two-col"><label className="field"><span>{t('result')}</span><select value={draft.result} disabled={finalized} onChange={e=>setDraft({...draft,result:e.target.value,organism:e.target.value==='negative'?'':draft.organism})}><option value="">{t('select')}</option><option value="negative">{t('negative')}</option><option value="positive">{t('positive')}</option></select></label>{draft.result==='positive'&&<label className="field"><span>{t('organism')}</span><input disabled={finalized} list="employee-screening-organisms" value={draft.organism} onChange={e=>setDraft({...draft,organism:e.target.value})}/><datalist id="employee-screening-organisms">{demoLibrarySeed.microorganisms.map(([el,en])=><option key={el} value={language==='el'?el:en}/>)}</datalist></label>}</div>
        {draft.result==='positive'&&<div className="record-section employee-screening-intervention-section"><div className="record-section-header"><div><span className="eyebrow">{t('clinicalRecords.interventionAndRecheck')}</span><h3>{t('clinicalRecords.intervention')}</h3><p>{t('clinicalRecords.optionalNotes')}</p></div></div><div className="form-grid two-col">
          <label className="field"><span>{t('clinicalRecords.interventionType')}</span><select disabled={finalized} value={draft.interventionType} onChange={e=>setDraft({...draft,interventionType:e.target.value})}><option value="">{t('clinicalRecords.noInterventionPlanned')}</option><option value="ointment">{t('clinicalRecords.ointment')}</option><option value="nasalOintment">{t('clinicalRecords.nasalOintment')}</option><option value="topicalTreatment">{t('clinicalRecords.topicalTreatment')}</option><option value="other">{t('other')}</option></select></label>
          <label className="field"><span>{t('clinicalRecords.interventionDetails')}</span><input disabled={finalized} value={draft.interventionDetails} onChange={e=>setDraft({...draft,interventionDetails:e.target.value})} placeholder={language==='el'?'π.χ. αλοιφή 2 φορές/ημέρα για 5 ημέρες':'e.g. ointment twice daily for 5 days'}/></label>
          <ManualDateField className="field" disabled={finalized} label={t('clinicalRecords.startedOn')} value={draft.interventionStart} onChange={v=>setDraft({...draft,interventionStart:v})}/>
          <ManualDateField className="field" disabled={finalized} label={t('clinicalRecords.plannedEnd')} value={draft.interventionEnd} onChange={v=>setDraft({...draft,interventionEnd:v})}/>
        </div></div>}
        {canValidate&&!finalized&&<div className="lab-step-footer"><Button disabled={!draft.result||(draft.result==='positive'&&!draft.organism.trim())} onClick={validate}>{t('laboratoryRecords.validateAndContinue')}</Button></div>}</div>}
      {tab==='documents'&&<DocumentsPanel sample={sample} persist={persist} t={t} canAttach={canAttach&&!finalized} finalized={finalized} notify={notify} actorName={actorName} onNext={()=>setTab('finalize')}/>} 
      {tab==='finalize'&&<div className="record-section"><div className="finalization-warning"><LockKeyhole size={17}/><div><strong>{t('laboratoryRecords.screeningFinalReview')}</strong><span>{sample.result==='positive'?t('laboratoryRecords.positiveScreeningCreatesFollowup'):t('laboratoryRecords.negativeScreeningCanClose')}</span></div></div>{canValidate&&!finalized&&<div className="lab-step-footer"><Button disabled={!sample.documentsReviewedAt} onClick={finalize}>{t('laboratoryRecords.finalizeLaboratoryRecord')}</Button></div>}{finalized&&sample.result==='positive'&&<div className="positive-followup-cta"><div><strong>{t('laboratoryRecords.followupNowRequired')}</strong><span>{t('laboratoryRecords.followupNowRequiredHelp')}</span></div><Button onClick={()=>{
  const from={pathname:location.pathname,search:location.search,hash:location.hash,state:location.state??null}
  navigate(`/surveillance?mode=employees&employeeSurveillanceId=${encodeURIComponent(sample.employeeSurveillanceCase||'')}`,{state:{limoxisFrom:from}})
}}>{t('laboratoryRecords.openEmployeeFollowup')}</Button></div>}</div>}
    {tab==='history'&&<LabHistory sample={sample} t={t} fmt={fmt}/>}
    <LabStepNavigator active={tab} order={workflowOrder} labels={workflowLabels} canOpen={id=>Boolean(access[id])} onMove={setTab}/>
    {correctionOpen&&<div className="modal-backdrop"><div className="entry-card correction-entry-card"><header><div><span className="eyebrow">{t('laboratory')}</span><h3>{t('laboratoryRecords.generalEdit')}</h3><p>{t('laboratoryRecords.generalEditHelp')}</p></div><button className="icon-close" onClick={()=>setCorrectionOpen(false)}>×</button></header><div className="entry-grid"><label className="entry-span-2"><span>{t('reasonRequired')}</span><textarea rows={4} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder={t('laboratoryRecords.generalEditReasonPlaceholder')}/></label></div><footer><Button variant="secondary" onClick={()=>setCorrectionOpen(false)}>{t('cancel')}</Button><Button disabled={!correctionReason.trim()} onClick={reopenForCorrection}>{t('laboratoryRecords.unlockForCorrection')}</Button></footer></div></div>}
  </EntityRecordShell></Page>
}

function EnvironmentalLaboratoryRecord({sample,persist,t,language,fmt,canManage,canValidate,canAttach,canReopen,canPrint,canExport,notify,recordNavigation,actorName}){
  const isPlate=sample.workflowType==='environmental_plate'
  const finalized=Boolean(sample.finalizedAt)
  const correctionLocked=finalized||sample.status==='completed'||sample.resultStatus==='validated'
  const [tab,setTab]=useState('summary')
  const [correctionOpen,setCorrectionOpen]=useState(false)
  const [reason,setReason]=useState('')
  const positions=isPlate
    ?(sample.platePositions||[])
    :[{
      surveillanceId:sample.environmentalSurveillanceCase,
      position:'1',
      location:sample.patient,
      locationEn:sample.patientEn,
      point:sample.anatomicalSite,
      pointEn:sample.anatomicalSite,
      result:sample.result,
      cfu:sample.cfu||'',
      limitCfu:sample.limitCfu||'',
      withinLimit:sample.withinLimit??null,
      organism:sample.organism||'',
      notes:sample.notes||'',
    }]
  const resultComplete=positions.length>0&&positions.every(row=>row.result&&row.withinLimit!==null)
  const documentsComplete=Boolean(sample.documentsReviewedAt)
  const reachedStep=finalized?4:documentsComplete?3:resultComplete?2:['received','processing','completed'].includes(sample.status)?1:0
  const access={
    summary:true,
    results:reachedStep>=1,
    documents:reachedStep>=2,
    finalize:reachedStep>=3,
    history:finalized,
  }
  const tabs=[
    {id:'summary',label:t('summary'),icon:FlaskConical},
    {id:'results',label:isPlate?t('laboratoryRecords.plateResults'):t('laboratoryRecords.environmentalResult'),icon:Microscope,disabled:!access.results,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'documents',label:t('documents'),icon:Paperclip,disabled:!access.documents,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'finalize',label:t('laboratoryRecords.finalization'),icon:CheckCircle2,disabled:!access.finalize,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'history',label:t('history'),icon:FileClock,disabled:!access.history,lockedLabel:t('laboratoryRecords.availableAfterFinalization')},
  ]
  const order=['summary','results','documents','finalize',...(finalized?['history']:[])]
  const workflowLabels=Object.fromEntries(tabs.map(item=>[item.id,item.label]))
  function openGeneralEdit(){
    if(correctionLocked){setCorrectionOpen(true);return}
    setTab(access.results?'results':'summary')
  }

  function receive(){
    const now=new Date().toISOString()
    persist(current=>({...current,status:'received',receivedAt:now,timeline:[{at:now,type:isPlate?'environmentalPlateReceived':'environmentalSampleReceived',actor:actorName},...(current.timeline||[])]}))
    syncEnvironmentalSurveillanceFromLab()
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:environmental-updated'))
    notify(t('laboratoryRecords.sampleReceivedMessage'),'success')
  }
  function start(){
    const now=new Date().toISOString()
    persist(current=>({...current,status:'processing',timeline:[{at:now,type:isPlate?'environmentalPlateProcessingStarted':'environmentalSampleProcessingStarted',actor:actorName},...(current.timeline||[])]}))
    syncEnvironmentalSurveillanceFromLab()
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:environmental-updated'))
    setTab('results')
    notify(t('laboratoryRecords.sampleProcessingStartedMessage'),'success')
  }
  function reopen(){
    if(!reason.trim())return
    const now=new Date().toISOString()
    persist(current=>({...current,status:'processing',finalizedAt:null,finalizedBy:null,documentsReviewedAt:null,correctionReason:reason,timeline:[{at:now,type:'laboratoryRecordReopened',actor:actorName,detail:reason},...(current.timeline||[])]}))
    setCorrectionOpen(false);setReason('');setTab('results')
    notify(t('laboratoryRecords.laboratoryRecordReopenedMessage'),'success')
  }

  return <Page fill>
    <EntityRecordShell
      className="laboratory-record-shell environmental-lab-record workspace-fill"
      recordNavigation={recordNavigation}
      avatar={<FlaskConical size={20}/>}
      eyebrow={sample.id}
      title={isPlate?`${t('plate')} ${sample.plateCode||''}`:t(sample.type)}
      subtitle={`${language==='el'?sample.department:sample.departmentEn} · ${sample.batchId||sample.patientId}`}
      status={<Status text={finalized?t('completed'):t(sample.status)} kind={finalized?'completed':sample.status}/>}
      headerActions={<>{(canManage||canReopen)&&<button className="general-edit-button" onClick={openGeneralEdit} title={correctionLocked?'Διόρθωση εργαστηριακής εγγραφής':t('laboratoryRecords.generalEdit')}><Pencil size={15}/><span>{correctionLocked?'Διόρθωση':t('laboratoryRecords.generalEdit')}</span></button>}<PrintExportActions showPrint={canPrint} showExport={canExport} onExport={()=>downloadRecordJson(sample,{filename:sample.id})}/></>}
      tabs={tabs}
      activeTab={tab}
      onTabChange={next=>{
        if(finalized){setTab(next);return}
        const ni=order.indexOf(next)
        if(ni>=0&&access[next]&&(ni<=reachedStep||correctionLocked))setTab(next)
      }}
      backLabel={t('backToLaboratory')}
    >
      {tab==='summary'&&<EnvironmentalLabSummary sample={sample} positions={positions} isPlate={isPlate} t={t} language={language} fmt={fmt} canManage={canManage&&!finalized} finalized={finalized} onReceive={receive} onStart={start}/>}
      {tab==='results'&&<EnvironmentalResultsPanel sample={sample} positions={positions} isPlate={isPlate} persist={persist} t={t} language={language} canManage={canManage&&!finalized} notify={notify} actorName={actorName} onNext={()=>setTab('documents')}/>}
      {tab==='documents'&&<DocumentsPanel sample={sample} persist={persist} t={t} canAttach={canAttach&&!finalized} finalized={finalized} notify={notify} actorName={actorName} onNext={()=>setTab('finalize')}/>}
      {tab==='finalize'&&<EnvironmentalFinalization sample={sample} positions={positions} isPlate={isPlate} persist={persist} t={t} fmt={fmt} canFinalize={canValidate&&!finalized} notify={notify} actorName={actorName} onFinalized={()=>setTab('summary')}/>}
      {tab==='history'&&<LabHistory sample={sample} t={t} fmt={fmt}/>}
      <LabStepNavigator active={tab} order={order} labels={workflowLabels} canOpen={id=>Boolean(access[id])} onMove={setTab}/>
    </EntityRecordShell>
    {correctionOpen&&<div className="modal-backdrop"><div className="entry-card correction-entry-card"><header><div><span className="eyebrow">{t('laboratory')}</span><h3>{t('laboratoryRecords.generalEdit')}</h3><p>{t('laboratoryRecords.generalEditHelp')}</p></div><button className="icon-close" onClick={()=>setCorrectionOpen(false)}>×</button></header><div className="entry-grid"><label className="entry-span-2"><span>{t('reasonRequired')}</span><textarea rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></label></div><footer><Button variant="secondary" onClick={()=>setCorrectionOpen(false)}>{t('cancel')}</Button><Button disabled={!reason.trim()} onClick={reopen}>{t('laboratoryRecords.unlockForCorrection')}</Button></footer></div></div>}
  </Page>
}

function EnvironmentalLabSummary({sample,positions,isPlate,t,language,fmt,canManage,finalized,onReceive,onStart}){
  return <div className="record-section environmental-lab-summary">
    <div className="record-section-header"><div><span className="eyebrow">{t('environmentalSurveillance')}</span><h3>{isPlate?t('laboratoryRecords.plateOverview'):t('laboratoryRecords.environmentalSampleOverview')}</h3></div></div>
    {finalized&&<div className="validated-result-note"><CheckCircle2 size={16}/><span>{t('laboratoryRecords.laboratoryRecordFinalizedReadOnly')}</span></div>}
    {canManage&&['requested','received'].includes(sample.status)&&<div className="lab-primary-workflow-action">{sample.status==='requested'?<Button onClick={onReceive}><FlaskConical size={15}/>{t('laboratoryRecords.receiveSample')}</Button>:<Button onClick={onStart}><PlayCircle size={15}/>{t('laboratoryRecords.startProcessing')}</Button>}</div>}
    <div className="detail-grid lab-detail-grid">
      <Detail l={t('sampleCode')} v={sample.id}/>
      {isPlate&&<Detail l={t('plate')} v={sample.plateCode}/>}
      <Detail l={t('batch')} v={sample.batchId}/>
      <Detail l={t('department')} v={language==='el'?sample.department:sample.departmentEn}/>
      <Detail l={t('samplingMethod')} v={language==='el'?sample.source:sample.sourceEn}/>
      <Detail l={t('samplingDate')} v={fmt(sample.collectedAt)}/>
      <Detail l={t('status')} v={t(sample.status)}/>
      <Detail l={t('samplingPoints')} v={String(positions.length)}/>
    </div>
    <div className="plate-position-preview"><div className="plate-position-preview-head"><span>{t('position')}</span><span>{t('locationArea')}</span><span>{t('samplingPoint')}</span></div>{positions.map(row=><div key={row.surveillanceId||row.position}><strong>{row.position}</strong><span>{language==='el'?row.location:row.locationEn}</span><span>{language==='el'?row.point:row.pointEn}</span></div>)}</div>
    <div className="source-truth-note">{isPlate?t('laboratoryRecords.plateLabSourceTruth'):t('laboratoryRecords.environmentalLabSourceTruth')}</div>
  </div>
}

function resolveEnvironmentalStandard(sample){
  const standards=readEnvironmentalStandards()||[]
  return standards.find(item=>item.active&&item.subjectType===sample.subjectType&&item.sourceCode===sample.sourceCode)
    || standards.find(item=>item.active&&item.subjectType===sample.subjectType)
    || null
}

function EnvironmentalResultsPanel({sample,positions,isPlate,persist,t,language,canManage,notify,actorName,onNext}){
  const [standardsVersion,setStandardsVersion]=useState(0)
  useEffect(()=>{
    const refresh=()=>setStandardsVersion(v=>v+1)
    window.addEventListener('limoxis:environmental-standards-updated',refresh)
    return ()=>window.removeEventListener('limoxis:environmental-standards-updated',refresh)
  },[])
  const standard=useMemo(()=>resolveEnvironmentalStandard(sample),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveEnvironmentalStandard only reads sample.subjectType/sourceCode (see its body above); using the full 'sample' object would recompute on every render since it's a new reference each time.
    [sample.subjectType,sample.sourceCode,standardsVersion])
  const configuredLimit=standard?.limitCfu
  const hasConfiguredLimit=configuredLimit!==null&&configuredLimit!==undefined&&configuredLimit!==''
  const normalizeRow=row=>{
    const result=row.result||''
    if(result==='negative')return {...row,cfu:'0',limitCfu:hasConfiguredLimit?String(configuredLimit):'',withinLimit:true,organism:''}
    if(result==='positive'){
      const cfu=row.cfu??''
      const limit=hasConfiguredLimit?String(configuredLimit):''
      const within=cfu!==''&&hasConfiguredLimit&&Number.isFinite(Number(cfu))?Number(cfu)<=Number(configuredLimit):null
      return {...row,limitCfu:limit,withinLimit:within}
    }
    return {...row,cfu:'',limitCfu:hasConfiguredLimit?String(configuredLimit):'',withinLimit:null,organism:''}
  }
  const [editing,setEditing]=useState(()=>canManage)
  const [rows,setRows]=useState(positions.map(normalizeRow))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow: resets local 'rows' only when the sample identity/status/limit actually changes, not on every parent re-render of 'positions' (which would silently discard the user's in-progress edits).
  useEffect(()=>setRows(positions.map(normalizeRow)),[sample.id,sample.resultStatus,configuredLimit])

  const update=(index,key,value)=>setRows(current=>current.map((row,i)=>{
    if(i!==index)return row
    if(key==='result')return normalizeRow({...row,result:value})
    if(key==='cfu'){
      const next={...row,cfu:value}
      if(next.result==='positive'&&hasConfiguredLimit&&value!==''&&Number.isFinite(Number(value)))next.withinLimit=Number(value)<=Number(configuredLimit)
      else if(next.result==='positive')next.withinLimit=null
      return next
    }
    if(key==='organism')return {...row,organism:value}
    return {...row,[key]:value}
  }))

  const rowComplete=row=>{
    if(row.result==='negative')return true
    if(row.result==='positive')return row.cfu!==''&&hasConfiguredLimit&&row.withinLimit!==null
    return false
  }
  const complete=rows.length>0&&rows.every(rowComplete)

  function syncCenter(){
    syncEnvironmentalSurveillanceFromLab()
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:environmental-updated'))
  }
  function persistRows(validated){
    const now=new Date().toISOString()
    const positive=rows.some(row=>row.result==='positive')
    return persist(current=>{
      if(isPlate)return {...current,platePositions:rows,result:positive?'positive':rows.some(row=>row.result)?'negative':null,resultStatus:validated?'validated':'draft',resultedAt:validated?now:current.resultedAt,validatedAt:validated?now:current.validatedAt,status:'processing',environmentalStandardId:standard?.id||null,environmentalProtocolCode:standard?.protocolCode||null,timeline:[{at:now,type:validated?'environmentalPlateResultsValidated':'environmentalResultsDraftSaved',actor:actorName},...(current.timeline||[])]}
      const row=rows[0]
      return {...current,result:row.result||null,cfu:row.cfu,limitCfu:row.limitCfu,withinLimit:row.withinLimit,organism:row.organism||null,organisms:row.organism?[{name:row.organism}]:[],resultStatus:validated?'validated':'draft',resultedAt:validated?now:current.resultedAt,validatedAt:validated?now:current.validatedAt,status:'processing',environmentalStandardId:standard?.id||null,environmentalProtocolCode:standard?.protocolCode||null,timeline:[{at:now,type:validated?'environmentalResultValidated':'environmentalResultsDraftSaved',actor:actorName},...(current.timeline||[])]}
    })
  }
  function saveDraft(){
    const next=persistRows(false)
    if(next){syncCenter();notify(t('laboratoryRecords.draftSaved'),'success')}
  }
  function save(){
    if(!complete)return
    const next=persistRows(true)
    if(next){syncCenter();setEditing(false);notify(t('laboratoryRecords.environmentalResultsSaved'),'success');onNext?.()}
  }

  return <div className="record-section environmental-results-panel">
    <div className="record-section-header"><div><span className="eyebrow">{isPlate?t('laboratoryRecords.plateResults'):t('laboratoryRecords.environmentalResult')}</span><h3>{isPlate?t('laboratoryRecords.evaluateWholePlate'):t('laboratoryRecords.evaluateEnvironmentalSample')}</h3><p>{t('laboratoryRecords.smartEnvironmentalEvaluationHelp')}</p></div>{canManage&&!editing&&<Button variant="secondary" onClick={()=>setEditing(true)}><Pencil size={14}/>{t('edit')}</Button>}</div>
    <div className={`smart-protocol-strip ${hasConfiguredLimit?'configured':'missing'}`}>
      <div><strong>{standard?.protocolCode||t('laboratoryRecords.noProtocolConfigured')}</strong><span>{hasConfiguredLimit?`${t('laboratoryRecords.automaticLimit')}: ${configuredLimit} ${standard?.unit||'CFU'}`:t('laboratoryRecords.environmentalProtocolNeedsLimit')}</span></div>
      <span className="smart-lock-chip">🔒 {t('laboratoryRecords.centrallyManaged')}</span>
    </div>
    <div className="environmental-result-table-wrap"><table className="record-table environmental-result-table"><thead><tr>{isPlate&&<th>{t('position')}</th>}<th>{t('locationArea')}</th><th>{t('samplingPoint')}</th><th>{t('result')}</th><th>CFU</th><th>{t('laboratoryRecords.acceptableLimitCfu')}</th><th>{t('laboratoryRecords.assessment')}</th><th>{t('organism')}</th></tr></thead><tbody>{rows.map((row,index)=>{
      const positive=row.result==='positive', negative=row.result==='negative'
      return <tr key={row.surveillanceId||index} className={`smart-result-row ${row.result||'pending'}`}>
        {isPlate&&<td><strong>{row.position}</strong></td>}
        <td>{language==='el'?row.location:row.locationEn}</td>
        <td>{language==='el'?row.point:row.pointEn}</td>
        <td>{editing?<select value={row.result||''} onChange={e=>update(index,'result',e.target.value)}><option value="">{t('select')}</option><option value="negative">{t('negative')}</option><option value="positive">{t('positive')}</option></select>:<Status text={row.result?t(row.result):'—'} kind={row.result}/>}</td>
        <td>{positive?(editing?<input inputMode="decimal" value={row.cfu??''} onChange={e=>update(index,'cfu',e.target.value)} placeholder="CFU"/>:row.cfu||'—'):negative?<span className="smart-auto-value">0 <small>{t('laboratoryRecords.automatic')}</small></span>:<span className="smart-na">—</span>}</td>
        <td>{row.result?<div className={`smart-locked-value ${hasConfiguredLimit?'':'missing'}`}><strong>{hasConfiguredLimit?`${configuredLimit} ${standard?.unit||'CFU'}`:t('notConfigured')}</strong><small>{standard?.protocolCode||t('laboratoryRecords.centralConfiguration')}</small></div>:<span className="smart-na">—</span>}</td>
        <td>{negative?<span className="limit-ok">{t('laboratoryRecords.negativeWithinLimits')}</span>:positive?(row.withinLimit===null?<span className="smart-warning">{hasConfiguredLimit?t('laboratoryRecords.waitingForCfu'):t('laboratoryRecords.limitNotConfigured')}</span>:row.withinLimit?<span className="limit-ok">{t('withinLimits')}</span>:<span className="limit-bad">{t('outsideLimits')}</span>):<span>—</span>}</td>
        <td>{positive?(editing?<><input list={`env-organisms-${index}`} value={row.organism||''} onChange={e=>update(index,'organism',e.target.value)} placeholder={t('optional')}/><datalist id={`env-organisms-${index}`}>{demoLibrarySeed.microorganisms.map(([el,en])=><option key={el} value={language==='el'?el:en}/>)}</datalist></>:row.organism||'—'):<span className="smart-na">{negative?t('notRequired'):'—'}</span>}</td>
      </tr>
    })}</tbody></table></div>
    {editing&&<div className="smart-automation-note"><ShieldAlert size={15}/><div><strong>{t('laboratoryRecords.smartFieldsActive')}</strong><span>{t('laboratoryRecords.smartFieldsEnvironmentalNote')}</span></div></div>}
    {canManage&&editing&&<div className="lab-step-footer"><Button variant="secondary" onClick={saveDraft}>{t('laboratoryRecords.saveDraft')}</Button><Button disabled={!complete} onClick={save}>{t('laboratoryRecords.validateAndContinue')}</Button></div>}
  </div>
}

function EnvironmentalFinalization({sample,isPlate,persist,t,fmt,canFinalize,notify,actorName,onFinalized}){
  const resultsReady=isPlate?(sample.platePositions||[]).length>0&&(sample.platePositions||[]).every(row=>row.result&&row.withinLimit!==null):sample.resultStatus==='validated'&&sample.withinLimit!==null
  const ready=resultsReady&&Boolean(sample.documentsReviewedAt)
  function finalize(){
    if(!ready)return
    const now=new Date().toISOString()
    persist(current=>({...current,status:'completed',finalizedAt:now,finalizedBy:actorName,timeline:[{at:now,type:isPlate?'environmentalPlateFinalized':'environmentalSampleFinalized',actor:actorName},...(current.timeline||[])]}))
    syncEnvironmentalSurveillanceFromLab()
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('limoxis:environmental-updated'))
    notify(t('laboratoryRecords.environmentalLaboratoryFinalized'),'success')
    onFinalized?.()
  }
  const outside=isPlate?(sample.platePositions||[]).filter(row=>row.withinLimit===false).length:(sample.withinLimit===false?1:0)
  return <div className="record-section finalization-panel">
    <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.finalization')}</span><h3>{t('laboratoryRecords.environmentalFinalReview')}</h3></div></div>
    <div className="finalization-checklist"><FinalCheck ok={resultsReady} text={t('laboratoryRecords.finalCheckEnvironmentalResults')}/><FinalCheck ok={Boolean(sample.documentsReviewedAt)} text={t('laboratoryRecords.finalCheckDocuments')}/></div>
    <div className={`environment-final-summary ${outside?'danger':'ok'}`}><strong>{outside}</strong><span>{t('pointsOutsideLimits')}</span></div>
    {sample.finalizedAt?<div className="validated-result-note"><CheckCircle2 size={17}/><span>{t('laboratoryRecords.finalizedByAt').replace('{user}',sample.finalizedBy||'—').replace('{date}',fmt(sample.finalizedAt))}</span></div>:<div className="finalization-warning"><LockKeyhole size={17}/><div><strong>{t('laboratoryRecords.finalizationIsIrreversible')}</strong><span>{t('laboratoryRecords.environmentalFinalizationHelp')}</span></div></div>}
    {canFinalize&&!sample.finalizedAt&&<div className="lab-step-footer"><Button disabled={!ready} onClick={finalize}><CheckCircle2 size={15}/>{t('laboratoryRecords.finalizeLaboratoryRecord')}</Button></div>}
  </div>
}

function FinalizationPanel({sample,persist,syncValidatedResult,t,fmt,canFinalize,notify,actorName,onFinalized}){
  const ready=sample.resultStatus==='validated'&&(!sample.result||sample.result!=='positive'||Boolean(sample.ast?.length))&&(!sample.critical||Boolean(sample.communications?.length))&&Boolean(sample.documentsReviewedAt)
  function finalize(){
    if(!ready)return
    const now=new Date().toISOString()
    const next=persist(current=>({...current,finalizedAt:now,finalizedBy:actorName,status:'completed',timeline:[{at:now,type:'laboratoryRecordFinalized',actor:actorName},...(current.timeline||[])]}))
    syncValidatedResult(next)
    notify(t('laboratoryRecords.laboratoryRecordFinalizedMessage'),'success')
    onFinalized?.()
  }
  return <div className="record-section finalization-panel">
    <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.finalization')}</span><h3>{t('laboratoryRecords.finalLaboratoryReview')}</h3></div></div>
    <div className="finalization-checklist">
      <FinalCheck ok={sample.resultStatus==='validated'} text={t('laboratoryRecords.finalCheckResultValidated')}/>
      <FinalCheck ok={sample.result!=='positive'||Boolean(sample.ast?.length)} text={t('laboratoryRecords.finalCheckAst')}/>
      <FinalCheck ok={!sample.critical||Boolean(sample.communications?.length)} text={t('laboratoryRecords.finalCheckCriticalCommunication')}/><FinalCheck ok={Boolean(sample.documentsReviewedAt)} text={t('laboratoryRecords.finalCheckDocuments')}/>
    </div>
    {sample.finalizedAt?<div className="validated-result-note"><CheckCircle2 size={17}/><span>{t('laboratoryRecords.finalizedByAt').replace('{user}',sample.finalizedBy||'—').replace('{date}',fmt(sample.finalizedAt))}</span></div>:<div className="finalization-warning"><LockKeyhole size={17}/><div><strong>{t('laboratoryRecords.finalizationIsIrreversible')}</strong><span>{t('laboratoryRecords.finalizationReadOnlyHelp')}</span></div></div>}
    {canFinalize&&!sample.finalizedAt&&<div className="lab-step-footer"><Button disabled={!ready} onClick={finalize}><CheckCircle2 size={15}/>{t('laboratoryRecords.finalizeLaboratoryRecord')}</Button></div>}
  </div>
}
function FinalCheck({ok,text}){return <div className={`final-check ${ok?'ok':'pending'}`}><span>{ok?'✓':'○'}</span><strong>{text}</strong></div>}

function DocumentsPanel({sample,persist,t,canAttach,finalized,notify,actorName,onNext}){
  const categories=[
    ['laboratoryReport','laboratoryReport'],
    ['externalLaboratoryResult','externalLaboratoryResult'],
    ['referralDocument','referralDocument'],
    ['clinicalDocument','clinicalDocument'],
    ['photo','photo'],
    ['other','other'],
  ]
  function saveAndContinue(){
    const now=new Date().toISOString()
    persist(current=>({...current,documentsReviewedAt:now,timeline:[{at:now,type:'documentsReviewed',actor:actorName},...(current.timeline||[])]}))
    notify?.(t('laboratoryRecords.documentsSavedAndReviewed'),'success')
    onNext?.()
  }
  return <div className="record-section laboratory-documents-panel">
    <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.sample')}</span><h3>{t('documents')}</h3><p>{t('laboratoryRecords.documentsBeforeFinalizationHelp')}</p></div></div>
    <AttachmentField disabled={!canAttach} categories={categories} value={sample.attachments||[]} onChange={files=>persist({attachments:files})}/>
    {!finalized&&<div className="lab-step-footer"><Button onClick={saveAndContinue}>{t('saveAndContinue')}</Button></div>}
  </div>
}
function LabHistory({sample,t,fmt}){
  const rows=useMemo(()=>[...(sample.timeline||[])].sort((a,b)=>new Date(b.at)-new Date(a.at)),[sample.timeline])
  return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.sample')}</span><h3>{t('history')}</h3></div></div><div className="lab-history-list">{rows.map((row,index)=><div key={`${row.at}-${index}`} className="lab-history-row"><time>{fmt(row.at)}</time><strong>{t(row.type)}</strong><span>{row.actor||'—'}</span></div>)}</div></div>
}

function LabStepNavigator({active,order,labels,canOpen,onMove}){
  const current=order.indexOf(active)
  if(current<0)return null
  let previous=null,next=null
  for(let i=current-1;i>=0;i--){if(canOpen(order[i])){previous=order[i];break}}
  for(let i=current+1;i<order.length;i++){if(canOpen(order[i])){next=order[i];break}}
  if(!previous&&!next)return null
  return <div className="lab-workflow-navigator" aria-label="Πλοήγηση βημάτων εργαστηρίου">
    <button type="button" className="lab-workflow-nav-button previous" disabled={!previous} onClick={()=>previous&&onMove(previous)}>
      <ChevronLeft size={16}/><span><small>Προηγούμενο βήμα</small><strong>{previous?labels[previous]:''}</strong></span>
    </button>
    <div className="lab-workflow-progress"><span>Βήμα {current+1} από {order.length}</span></div>
    <button type="button" className="lab-workflow-nav-button next" disabled={!next} onClick={()=>next&&onMove(next)}>
      <span><small>Επόμενο βήμα</small><strong>{next?labels[next]:''}</strong></span><ChevronRight size={16}/>
    </button>
  </div>
}

function Detail({l,v}){return <div className="detail-item"><span>{l}</span><strong>{v||'—'}</strong></div>}
function OrganismEditor({organisms,onChange,options,t,canClassify}){
  const {confirm,notify}=useFeedback()
  const rows=organisms?.length?organisms:[{name:'',resistance:''}]
  const update=(index,key,value)=>onChange(rows.map((row,i)=>i===index?{...row,[key]:value}:row))
  const add=()=>onChange([...rows,{name:'',resistance:''}])
  const remove=async index=>{
    const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),confirmLabel:t('delete'),danger:true})
    if(!ok)return
    onChange(rows.filter((_,i)=>i!==index))
    notify(t('actionCompleted'),'success')
  }
  return <div className="organism-editor-list">{rows.map((row,index)=><div className="organism-editor-row" key={index}><input list="lab-microorganisms" value={row.name||''} onChange={e=>update(index,'name',e.target.value)} placeholder={t('organism')}/>{canClassify&&<select value={row.resistance||''} onChange={e=>update(index,'resistance',e.target.value)}><option value="">—</option><option>MDR</option><option>XDR</option><option>PDR</option></select>}{rows.length>1&&<button type="button" className="danger" title={t('delete')} onClick={()=>remove(index)}><Trash2 size={14}/></button>}<datalist id="lab-microorganisms">{options.map(option=><option key={option} value={option}/>)}</datalist></div>)}<button type="button" className="inline-add-button" onClick={add}>+ {t('laboratoryRecords.addOrganism')}</button></div>
}
function EditableSelect({editing,label,value,display,onChange,options}){return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<select value={typeof value==='boolean'?(value?'yes':'no'):value} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<strong>{display||'—'}</strong>}</div>}
