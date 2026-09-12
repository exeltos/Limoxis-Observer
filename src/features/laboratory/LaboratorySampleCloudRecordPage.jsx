import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileClock, FlaskConical, LockKeyhole, Microscope, Paperclip, Pencil, PhoneCall, ShieldAlert } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EmptyState } from '../../design-system/EmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import {
  ENVIRONMENTAL_CATEGORIES,
  addAstResult,
  communicateCriticalResult,
  environmentalMethodLabel,
  finalizeLaboratorySample,
  loadEnvironmentalStandards,
  loadLaboratorySample,
  markDocumentsReviewed,
  reopenLaboratorySample,
  resolveEnvironmentalStandard,
  sampleTypeLabel,
  saveMicrobiologyResult,
  updateLaboratorySampleStatus,
} from './laboratoryCloudService'
import { LaboratoryStatus as Status } from './LaboratoryStatus'
import { LaboratoryAttachmentsPanel } from './LaboratoryAttachmentsPanel'
import { LaboratoryWorkflowNavigator } from './components/LaboratoryWorkflowNavigator'

const localText={
  el:{rejectSample:'Απόρριψη δείγματος',rejectionReason:'Αιτιολογία απόρριψης',sampleRejected:'Το δείγμα απορρίφθηκε και η αιτιολογία καταγράφηκε.',finalizedAstNotice:'Το αντιβιόγραμμα έχει οριστικοποιηθεί. Για αλλαγή δημιουργήστε διορθωμένη έκδοση του αποτελέσματος.',correction:'Διόρθωση',generalEdit:'Γενική επεξεργασία',correctionHelp:'Η εργαστηριακή εγγραφή έχει οριστικοποιηθεί. Για διόρθωση απαιτείται αιτιολογία και η ενέργεια καταγράφεται στο ιστορικό.',correctionPlaceholder:'Περιγράψτε το λάθος ή τον λόγο διόρθωσης…',unlockForCorrection:'Ξεκλείδωμα για διόρθωση',reasonRequired:'Αιτιολογία *',markDocumentsReviewed:'Έλεγχος εγγράφων ολοκληρώθηκε',documentsReviewed:'Τα έγγραφα ελέγχθηκαν και η καταχώρηση προχωρά.',finalize:'Οριστικοποίηση',finalizeRecord:'Οριστικοποίηση εγγραφής',finalized:'Η εργαστηριακή καταχώριση οριστικοποιήθηκε',finalizedReadOnly:'Οριστικοποιημένη εργαστηριακή καταχώριση · μόνο για ανάγνωση',finalizationWarning:'Η οριστικοποίηση είναι μη αναστρέψιμη ενέργεια χωρίς αιτιολογημένο ξεκλείδωμα.',checkResult:'Το μικροβιολογικό αποτέλεσμα έχει επικυρωθεί',checkAst:'Το αντιβιόγραμμα έχει ολοκληρωθεί όπου απαιτείται',checkCommunication:'Η επικοινωνία κρίσιμου αποτελέσματος έχει καταγραφεί όπου απαιτείται',checkDocuments:'Τα έγγραφα έχουν ελεγχθεί',cfu:'CFU',acceptableLimit:'Αποδεκτό όριο',assessment:'Αξιολόγηση',withinLimits:'Εντός ορίων',outsideLimits:'Εκτός ορίων',waitingForCfu:'Αναμονή CFU',noProtocolConfigured:'Δεν βρέθηκε πρωτόκολλο',protocolNote:'Το όριο εφαρμόζεται αυτόματα από το κεντρικά ρυθμισμένο πρωτόκολλο.'},
  en:{rejectSample:'Reject sample',rejectionReason:'Rejection reason',sampleRejected:'The sample was rejected and the reason was recorded.',finalizedAstNotice:'Susceptibility evidence is finalized. Create an amended result version for any correction.',correction:'Correction',generalEdit:'General edit',correctionHelp:'This laboratory record has been finalized. A correction requires a reason and is recorded in the history.',correctionPlaceholder:'Describe the mistake or the reason for the correction…',unlockForCorrection:'Unlock for correction',reasonRequired:'Reason *',markDocumentsReviewed:'Document review completed',documentsReviewed:'Documents have been reviewed and the record can proceed.',finalize:'Finalization',finalizeRecord:'Finalize record',finalized:'The laboratory record has been finalized',finalizedReadOnly:'Finalized laboratory record · read only',finalizationWarning:'Finalization is irreversible without a justified unlock.',checkResult:'The microbiology result has been validated',checkAst:'Susceptibility testing is complete where required',checkCommunication:'Critical result communication is recorded where required',checkDocuments:'Documents have been reviewed',cfu:'CFU',acceptableLimit:'Acceptable limit',assessment:'Assessment',withinLimits:'Within limits',outsideLimits:'Outside limits',waitingForCfu:'Waiting for CFU',noProtocolConfigured:'No protocol configured',protocolNote:'The limit is applied automatically from the centrally configured protocol.'},
}

export function LaboratorySampleCloudRecordPage(){
  const {sampleId}=useParams()
  const {t,locale,language}=useLanguage()
  const text=key=>localText[language]?.[key]||localText.en[key]
  const {notify}=useFeedback()
  const {role,membership,tenant,canAccessRecord}=useTenant()
  const {goBack}=useContextualNavigation('/laboratory')
  const recordNavigation=useRecordSequenceNavigation({registry:'laboratory',currentId:sampleId,pathForId:id=>`/laboratory/${id}`})
  const [sample,setSample]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState('summary')
  const [dialog,setDialog]=useState(null)
  const [standards,setStandards]=useState([])
  const has=cap=>can(role,cap,membership?.capabilities??[],membership?.customCapabilities??[])
  const canManage=has(CAPABILITIES.MANAGE_LAB_SAMPLES)
  const canValidate=has(CAPABILITIES.VALIDATE_LAB_RESULTS)
  const canCommunicate=has(CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS)
  const canReopen=has(CAPABILITIES.REOPEN_LAB_RECORD)
  const fmt=value=>value?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—'

  async function reload(){setLoading(true);setError('');try{setSample(await loadLaboratorySample(tenant?.id,sampleId))}catch(err){setError(err?.message||t('actionFailed'))}finally{setLoading(false)}}
  useEffect(()=>{reload()},[tenant?.id,sampleId]) // eslint-disable-line react-hooks/exhaustive-deps
  const isEnvironmental=ENVIRONMENTAL_CATEGORIES.includes(sample?.type)
  useEffect(()=>{if(isEnvironmental&&tenant?.id)loadEnvironmentalStandards(tenant.id).then(setStandards).catch(()=>setStandards([]))},[isEnvironmental,tenant?.id])
  const standard=isEnvironmental?resolveEnvironmentalStandard(standards,sample.type,sample.environmentalMethod):null

  const result=sample?.microbiologyResults?.[0]||null
  const ast=result?.ast||[]
  const communications=result?.communications||[]
  const resultIsDraft=!result||result.resultStatus==='draft'
  const finalized=Boolean(sample?.finalizedAt)
  const canManageActive=canManage&&!finalized
  const resultValidated=result&&['validated','amended'].includes(result.resultStatus)
  const astRequired=result?.result==='positive'&&!isEnvironmental
  const astComplete=!astRequired||ast.length>0
  const communicationRequired=Boolean(result?.critical)
  const communicationComplete=!communicationRequired||communications.length>0
  const documentsReviewed=Boolean(sample?.documentsReviewedAt)
  const readyToFinalize=Boolean(resultValidated&&astComplete&&communicationComplete&&documentsReviewed)
  const tabAccess={
    summary:true,
    result:finalized||['received','processing','completed'].includes(sample?.status),
    ast:finalized||resultValidated,
    communication:finalized||(resultValidated&&astComplete),
    documents:finalized||(resultValidated&&astComplete&&communicationComplete),
    finalize:finalized||documentsReviewed,
    history:finalized,
  }
  const tabs=useMemo(()=>[
    {id:'summary',label:t('summary'),icon:FlaskConical},
    {id:'result',label:t('laboratoryRecords.microbiologyResult'),icon:Microscope,disabled:!tabAccess.result,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    ...(isEnvironmental?[]:[{id:'ast',label:t('laboratoryRecords.antimicrobialSusceptibility'),icon:ShieldAlert,disabled:!tabAccess.ast,lockedLabel:t('laboratoryRecords.completePreviousStep')}]),
    {id:'communication',label:t('laboratoryRecords.criticalCommunication'),icon:PhoneCall,disabled:!tabAccess.communication,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'documents',label:t('documents'),icon:Paperclip,disabled:!tabAccess.documents,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'finalize',label:t('laboratoryRecords.finalization'),icon:CheckCircle2,disabled:!tabAccess.finalize,lockedLabel:t('laboratoryRecords.completePreviousStep')},
    {id:'history',label:t('history'),icon:FileClock,disabled:!tabAccess.history,lockedLabel:t('laboratoryRecords.availableAfterFinalization')},
  ],[t,isEnvironmental,language,resultValidated,astComplete,communicationComplete,documentsReviewed,finalized,sample?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const workflowOrder=['summary','result',...(isEnvironmental?[]:['ast']),'communication','documents','finalize',...(finalized?['history']:[])]
  const workflowLabels=Object.fromEntries(tabs.map(item=>[item.id,item.label]))
  async function saveAndReload(work,message){try{await work();setDialog(null);await reload();notify(message,'success')}catch(err){notify(err?.message||t('actionFailed'),'error')}}
  async function markDocuments(){await saveAndReload(()=>markDocumentsReviewed(tenant?.id,sample.recordId),text('documentsReviewed'))}
  async function finalize(){if(!readyToFinalize)return;await saveAndReload(()=>finalizeLaboratorySample(tenant?.id,sample.recordId),text('finalized'))}
  async function reopen(reason){await saveAndReload(()=>reopenLaboratorySample(tenant?.id,sample.recordId,reason),text('unlockForCorrection'));setTab('result')}

  if(loading)return <Page title={t('laboratoryRecords.sample')}><div className="inline-empty">{t('loading')}</div></Page>
  if(error)return <Page title={t('laboratoryRecords.sample')}><EmptyState title={t('actionFailed')} description={error}/></Page>
  if(!sample)return <Page title={t('laboratoryRecords.sample')}><EmptyState title={t('noData')} description={t('laboratoryRecords.sample')}/></Page>
  if(!canAccessRecord(sample))return <Page title={t('laboratoryRecords.sample')}><EmptyState title={t('scopeAccessDeniedTitle')} description={t('scopeAccessDeniedDescription')}/></Page>

  return <Page fill><EntityRecordShell className="laboratory-record-shell workspace-fill" recordNavigation={recordNavigation} avatar={<FlaskConical size={20}/>} eyebrow={sample.id} title={sampleTypeLabel(sample.type,t)} subtitle={`${sample.patient} · ${sample.patientId} · ${sample.department||'—'}`} status={<><Status text={finalized?t('completed'):t(sample.status)} kind={finalized?'completed':sample.status}/>{sample.resistance&&<b className="amr-chip">{sample.resistance}</b>}</>} headerActions={<>{(canManage||canReopen)&&<button className="general-edit-button" title={finalized?text('correction'):text('generalEdit')} onClick={()=>{if(finalized)setDialog('correction');else setTab('result')}}><Pencil size={15}/><span>{finalized?text('correction'):text('generalEdit')}</span></button>}<PrintExportActions onExport={()=>downloadRecordJson(sample,{filename:sample.id})}/></>} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={goBack} backLabel={t('backToLaboratory')} footer={<LaboratoryWorkflowNavigator active={tab} order={workflowOrder} labels={workflowLabels} canOpen={id=>Boolean(tabAccess[id])} onMove={setTab}/>}>
    {!canManage&&tab==='summary'&&<div className="permission-info-banner"><AlertTriangle size={16}/><span>{t('laboratoryRecords.laboratoryReadOnlyRole')}</span></div>}
    {finalized&&tab==='summary'&&<div className="validated-result-note"><CheckCircle2 size={16}/><span>{text('finalizedReadOnly')}</span></div>}
    {tab==='summary'&&<section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('sampleDetails')}</strong><small>{sample.id}</small></div><div className="record-section-actions">{canManageActive&&sample.status==='requested'&&<Button onClick={()=>saveAndReload(()=>updateLaboratorySampleStatus(tenant?.id,sample.recordId,'received',{receivedAt:new Date()}),t('laboratoryRecords.sampleReceivedMessage'))}>{t('received')}</Button>}{canManageActive&&['requested','collected','received'].includes(sample.status)&&<Button variant="secondary" onClick={()=>setDialog('reject')}>{text('rejectSample')}</Button>}{canManageActive&&['received','collected'].includes(sample.status)&&<Button onClick={()=>saveAndReload(()=>updateLaboratorySampleStatus(tenant?.id,sample.recordId,'processing'),t('laboratoryRecords.sampleProcessingStartedMessage'))}>{t('processing')}</Button>}</div></div><div className="detail-grid patient-detail-grid"><Detail label={t('patient')} value={sample.patient}/><Detail label={t('department')} value={sample.department}/><Detail label={t('sampleType')} value={sampleTypeLabel(sample.type,t)}/>{isEnvironmental?<Detail label={language==='en'?'Sampling method':'Μέθοδος δειγματοληψίας'} value={environmentalMethodLabel(sample.environmentalMethod,t)}/>:<Detail label={t('clinicalSource')} value={sample.source}/>}<Detail label={t('priority')} value={t(sample.priority)}/><Detail label={t('collectedLabel')} value={fmt(sample.collectedAt)}/><Detail label={t('received')} value={fmt(sample.receivedAt)}/><Detail label={t('surveillance')} value={sample.surveillanceCase||'—'}/>{sample.rejectionReason&&<Detail label={text('rejectionReason')} value={sample.rejectionReason}/>}</div></section>}
    {tab==='result'&&<ResultDialogPanel t={t} text={text} result={result} isEnvironmental={isEnvironmental} standard={standard} canManage={canManageActive} canValidate={canValidate} onSave={draft=>saveAndReload(()=>saveMicrobiologyResult(tenant?.id,sample.recordId,draft),t('saved'))}/>}
    {tab==='ast'&&!isEnvironmental&&<section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('laboratoryRecords.antimicrobialSusceptibility')}</strong><small>{ast.length}</small></div>{canManageActive&&result&&resultIsDraft&&<Button variant="secondary" onClick={()=>setDialog('ast')}>+ {t('clinicalRecords.add')}</Button>}</div>{result&&!resultIsDraft&&<div className="permission-info-banner"><ShieldAlert size={16}/><span>{text('finalizedAstNotice')}</span></div>}{ast.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('antibiotic')}</th><th>S/I/R</th><th>{t('method')}</th><th>{t('version')}</th></tr></thead><tbody>{ast.map(row=><tr key={row.id}><td>{row.drug}</td><td><strong>{row.sir}</strong></td><td>{row.method}</td><td>{row.standard} {row.version}</td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>}
    {tab==='communication'&&<section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('laboratoryRecords.criticalCommunication')}</strong><small>{communications.length}</small></div>{canCommunicate&&!finalized&&result?.critical&&<Button variant="secondary" onClick={()=>setDialog('communication')}>+ {t('clinicalRecords.add')}</Button>}</div>{result?.critical?communications.length?communications.map(row=><article className="evidence-box" key={row.id}><strong>{row.to} · {fmt(row.at)}</strong><span>{t(row.method)}{row.readBack?` · ${t('confirmed')}`:''}</span></article>):<div className="inline-empty">{t('laboratoryRecords.uncommunicatedCritical')}</div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>}
    {tab==='documents'&&<LaboratoryAttachmentsPanel organizationId={tenant?.id} sampleRecordId={sample.recordId} canManage={canManageActive} t={t} notify={notify}/>}
    {tab==='documents'&&!finalized&&<div className="lab-step-footer"><Button variant="secondary" disabled={documentsReviewed} onClick={markDocuments}>{documentsReviewed?text('checkDocuments'):text('markDocumentsReviewed')}</Button></div>}
    {tab==='finalize'&&<section className="clinical-panel full-panel finalization-panel"><div className="record-section-header"><div><span className="eyebrow">{text('finalize')}</span><h3>{text('finalizeRecord')}</h3></div></div><div className="finalization-checklist"><FinalCheck ok={Boolean(resultValidated)} text={text('checkResult')}/><FinalCheck ok={astComplete} text={text('checkAst')}/><FinalCheck ok={communicationComplete} text={text('checkCommunication')}/><FinalCheck ok={documentsReviewed} text={text('checkDocuments')}/></div>{finalized?<div className="validated-result-note"><CheckCircle2 size={17}/><span>{text('finalized')}</span></div>:<div className="finalization-warning"><LockKeyhole size={17}/><div><strong>{text('finalize')}</strong><span>{text('finalizationWarning')}</span></div></div>}{canValidate&&!finalized&&<div className="lab-step-footer"><Button disabled={!readyToFinalize} onClick={finalize}><CheckCircle2 size={15}/>{text('finalizeRecord')}</Button></div>}</section>}
    {tab==='history'&&<section className="clinical-panel full-panel"><div className="record-section-header"><div><FileClock size={17}/><strong>{t('history')}</strong></div></div><div className="clinical-timeline"><Timeline at={sample.requestedAt} title={t('requested')} fmt={fmt}/>{sample.receivedAt&&<Timeline at={sample.receivedAt} title={t('received')} fmt={fmt}/>} {sample.rejectedAt&&<Timeline at={sample.rejectedAt} title={text('rejectSample')} fmt={fmt}/>} {(sample.microbiologyResults||[]).map((item,index)=><Timeline key={item.id} at={item.resultedAt} title={`${t('laboratoryRecords.microbiologyResult')} · ${t(item.resultStatus)}${index?` · v${sample.microbiologyResults.length-index}`:''}`} fmt={fmt}/>)} {communications.map(row=><Timeline key={row.id} at={row.at} title={t('laboratoryRecords.criticalCommunication')} fmt={fmt}/>)} {sample.documentsReviewedAt&&<Timeline at={sample.documentsReviewedAt} title={text('checkDocuments')} fmt={fmt}/>} {sample.finalizedAt&&<Timeline at={sample.finalizedAt} title={text('finalized')} fmt={fmt}/>}</div></section>}
  </EntityRecordShell>
  {dialog==='ast'&&<AstDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndReload(()=>addAstResult(tenant?.id,result.id,draft),t('saved'))}/>}
  {dialog==='communication'&&<CommunicationDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndReload(()=>communicateCriticalResult(tenant?.id,result.id,draft),t('saved'))}/>}
  {dialog==='reject'&&<RejectDialog t={t} title={text('rejectSample')} reasonLabel={text('rejectionReason')} onClose={()=>setDialog(null)} onSave={reason=>saveAndReload(()=>updateLaboratorySampleStatus(tenant?.id,sample.recordId,'rejected',{rejectionReason:reason}),text('sampleRejected'))}/>}
  {dialog==='correction'&&<CorrectionDialog t={t} text={text} onClose={()=>setDialog(null)} onSave={reopen}/>}
  </Page>
}

function ResultDialogPanel({t,text,result,isEnvironmental,standard,canManage,canValidate,onSave}){
  const [editing,setEditing]=useState(false)
  const hasConfiguredLimit=standard?.limitCfu!=null&&standard?.limitCfu!==''
  const [draft,setDraft]=useState(()=>({id:result?.id||null,result:result?.result||(isEnvironmental?'':'negative'),organism:result?.organism||'',resistance:result?.resistance||'',critical:Boolean(result?.critical),method:result?.method||'',preliminary:Boolean(result?.preliminary),validationStatus:result?.resultStatus||'draft',interpretationStandard:result?.interpretationStandard||'EUCAST',interpretationVersion:result?.interpretationVersion||'',cfuCount:result?.cfuCount??''}))
  useEffect(()=>{setDraft({id:result?.id||null,result:result?.result||(isEnvironmental?'':'negative'),organism:result?.organism||'',resistance:result?.resistance||'',critical:Boolean(result?.critical),method:result?.method||'',preliminary:Boolean(result?.preliminary),validationStatus:result?.resultStatus||'draft',interpretationStandard:result?.interpretationStandard||'EUCAST',interpretationVersion:result?.interpretationVersion||'',cfuCount:result?.cfuCount??''})},[result?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  function computeCfuLimit(){return hasConfiguredLimit?Number(standard.limitCfu):null}
  function computeWithinLimit(nextResult,cfu){
    if(nextResult==='negative')return true
    if(nextResult==='positive')return cfu!==''&&hasConfiguredLimit&&Number.isFinite(Number(cfu))?Number(cfu)<=computeCfuLimit():null
    return null
  }
  function save(){
    const cfuLimit=isEnvironmental?computeCfuLimit():null
    const withinLimit=isEnvironmental?computeWithinLimit(draft.result,draft.result==='negative'?'0':draft.cfuCount):null
    onSave({...draft,cfuCount:isEnvironmental?(draft.result==='negative'?0:(draft.cfuCount===''?null:Number(draft.cfuCount))):null,cfuLimit,withinLimit})
    setEditing(false)
  }
  const complete=isEnvironmental?(draft.result==='negative'||(draft.result==='positive'&&draft.cfuCount!==''&&hasConfiguredLimit)):Boolean(draft.result)
  return <div className="clinical-panel full-panel record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('laboratoryRecords.microbiologyResult')}</span><h3>{isEnvironmental?t('laboratoryRecords.environmentalResult'):t('laboratoryRecords.resultAndOrganism')}</h3></div>{canManage&&!editing&&<Button variant="secondary" onClick={()=>setEditing(true)}><Pencil size={14}/>{result?t('edit'):t('clinicalRecords.add')}</Button>}</div>
    {isEnvironmental&&<div className={`smart-protocol-strip ${standard?.limitCfu!=null?'configured':'missing'}`}><div><strong>{standard?.protocolCode||text('noProtocolConfigured')}</strong>{hasConfiguredLimit&&<span> · {standard.limitCfu} {standard.unit||'CFU'}</span>}</div><span className="smart-lock-chip">🔒 {text('protocolNote')}</span></div>}
    {editing?<div className="detail-grid patient-detail-grid employee-inline-edit">
      <div className="detail-item"><span>{t('result')}</span><select value={draft.result} onChange={e=>setDraft(d=>({...d,result:e.target.value}))}><option value="">{t('select')}</option><option value="negative">{t('negative')}</option><option value="positive">{t('positive')}</option>{!isEnvironmental&&<><option value="inconclusive">{t('inconclusive')}</option><option value="contaminated">{t('contaminated')}</option></>}</select></div>
      {isEnvironmental?draft.result==='positive'&&<div className="detail-item"><span>{text('cfu')}</span><input inputMode="decimal" value={draft.cfuCount} onChange={e=>setDraft(d=>({...d,cfuCount:e.target.value}))} placeholder="CFU"/></div>:<div className="detail-item"><span>{t('exportOrganism')}</span><input value={draft.organism} onChange={e=>setDraft(d=>({...d,organism:e.target.value}))}/></div>}
      {!isEnvironmental&&<div className="detail-item"><span>{t('classification')}</span><select value={draft.resistance} onChange={e=>setDraft(d=>({...d,resistance:e.target.value}))}><option value="">—</option><option value="MDR">MDR</option><option value="XDR">XDR</option><option value="PDR">PDR</option></select></div>}
      <div className="detail-item"><span>{t('method')}</span><input value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}/></div>
      {!isEnvironmental&&<div className="detail-item"><span>{t('criticalResult')}</span><select value={draft.critical?'yes':'no'} onChange={e=>setDraft(d=>({...d,critical:e.target.value==='yes'}))}><option value="no">{t('no')}</option><option value="yes">{t('yes')}</option></select></div>}
      <div className="detail-item"><span>{t('status')}</span><select disabled={!canValidate} value={draft.validationStatus} onChange={e=>setDraft(d=>({...d,validationStatus:e.target.value}))}><option value="draft">{t('draft')}</option>{canValidate&&<option value="validated">{t('validated')}</option>}</select></div>
    </div>:<div className="detail-grid patient-detail-grid">
      <Detail label={t('result')} value={result?t(result.result):'—'}/>
      {isEnvironmental?<><Detail label={text('cfu')} value={result?.result==='negative'?'0':(result?.cfuCount??'—')}/><Detail label={text('acceptableLimit')} value={result?.cfuLimit!=null?`${result.cfuLimit} ${standard?.unit||'CFU'}`:'—'}/><Detail label={text('assessment')} value={result?.withinLimit===true?text('withinLimits'):result?.withinLimit===false?text('outsideLimits'):result?'—':'—'}/></>:<><Detail label={t('exportOrganism')} value={result?.organism}/><Detail label={t('classification')} value={result?.resistance}/><Detail label={t('criticalResult')} value={result?.critical?t('yes'):t('no')}/></>}
      <Detail label={t('method')} value={result?.method}/>
      <Detail label={t('status')} value={result?t(result.resultStatus):t('pending')}/>
    </div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>setEditing(false)}>{t('cancel')}</Button><SaveButton disabled={!complete} onClick={save}>{t('save')}</SaveButton></div>}
  </div>
}

function AstDialog({t,onClose,onSave}){const [draft,setDraft]=useState({drug:'',method:'MIC',sir:'S',standard:'EUCAST',version:'',mic:'',operator:'',zone:'',notes:''});return <SimpleDialog title={t('laboratoryRecords.antimicrobialSusceptibility')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.drug||!draft.version}><label><span>{t('antibiotic')}</span><input value={draft.drug} onChange={e=>setDraft(d=>({...d,drug:e.target.value}))}/></label><label><span>S/I/R</span><select value={draft.sir} onChange={e=>setDraft(d=>({...d,sir:e.target.value}))}><option>S</option><option>I</option><option>R</option></select></label><label><span>{t('method')}</span><input value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}/></label><label><span>{t('source')}</span><input value={draft.standard} onChange={e=>setDraft(d=>({...d,standard:e.target.value}))}/></label><label><span>{t('version')}</span><input value={draft.version} onChange={e=>setDraft(d=>({...d,version:e.target.value}))}/></label><label><span>MIC</span><input value={draft.mic} onChange={e=>setDraft(d=>({...d,mic:e.target.value}))}/></label></SimpleDialog>}
function CommunicationDialog({t,onClose,onSave}){const [draft,setDraft]=useState({recipientName:'',recipientRole:'',method:'phone',readBack:true,notes:''});return <SimpleDialog title={t('laboratoryRecords.criticalCommunication')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.recipientName}><label><span>{t('recipient')}</span><input value={draft.recipientName} onChange={e=>setDraft(d=>({...d,recipientName:e.target.value}))}/></label><label><span>{t('role')}</span><input value={draft.recipientRole} onChange={e=>setDraft(d=>({...d,recipientRole:e.target.value}))}/></label><label><span>{t('method')}</span><select value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value}))}><option value="phone">{t('phone')}</option><option value="in_person">{t('inPerson')}</option><option value="secure_message">{t('secureMessage')}</option><option value="other">{t('other')}</option></select></label><label><span>{t('confirmed')}</span><select value={draft.readBack?'yes':'no'} onChange={e=>setDraft(d=>({...d,readBack:e.target.value==='yes'}))}><option value="yes">{t('yes')}</option><option value="no">{t('no')}</option></select></label><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={3} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label></SimpleDialog>}
function RejectDialog({t,title,reasonLabel,onClose,onSave}){const [reason,setReason]=useState('');return <SimpleDialog title={title} t={t} onClose={onClose} onSave={()=>onSave(reason.trim())} disabled={!reason.trim()}><label className="entry-span-2"><span>{reasonLabel}</span><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)}/></label></SimpleDialog>}
function CorrectionDialog({t,text,onClose,onSave}){const [reason,setReason]=useState('');return <div className="modal-backdrop"><div className="entry-card correction-entry-card"><header><div><span className="eyebrow">{t('laboratory')}</span><h3>{text('correction')}</h3><p>{text('correctionHelp')}</p></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid"><label className="entry-span-2"><span>{text('reasonRequired')}</span><textarea autoFocus rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder={text('correctionPlaceholder')}/></label></div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!reason.trim()} onClick={()=>onSave(reason.trim())}>{text('unlockForCorrection')}</Button></footer></div></div>}
function SimpleDialog({title,t,onClose,onSave,disabled,children}){return <div className="modal-backdrop"><div className="entry-card"><header><div><h3>{title}</h3></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid">{children}</div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={disabled} onClick={onSave}>{t('save')}</SaveButton></footer></div></div>}
function Detail({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
function Timeline({at,title,fmt}){return <article><div className="timeline-dot"/><div><strong>{title}</strong><span>{fmt(at)}</span></div></article>}
function FinalCheck({ok,text}){return <div className={`final-check ${ok?'ok':'pending'}`}><span>{ok?'✓':'○'}</span><strong>{text}</strong></div>}
