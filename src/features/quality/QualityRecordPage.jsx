import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckSquare2, ClipboardCheck, FileClock, Link2, Paperclip, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { downloadRecordJson } from '../../core/export/recordExport'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { loadQualityRecord, loadQualityRecords, saveQualityRecord } from './qualityService'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth, auditEvent } from '../../core/audit/actor'
import { openCorrection, voidRecord as applyGovernedVoid } from '../../core/audit/governedLifecycle'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'

const iconMap={incidents:AlertTriangle,findings:ShieldCheck,capas:CheckSquare2,audits:ClipboardCheck}

export function QualityRecordPage(){
  const {recordType,recordId}=useParams()
  const navigate=useNavigate()
  const recordNavigation=useRecordSequenceNavigation({registry:`quality.${recordType}`,currentId:recordId,pathForId:id=>`/quality/${recordType}/${id}`})
  const {restored,goBack}=useContextualNavigation('/quality')
  const {t,language,locale}=useLanguage()
  const {role,membership,tenant,canAccessRecord}=useTenant()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
  const organizationId=tenant?.id
  const [record,setRecord]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState(()=>restored?.tab||'details')
  const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canAttach=can(role,CAPABILITIES.ATTACH_FILES,addOns,custom)
  const canPrint=can(role,CAPABILITIES.PRINT_RECORDS,addOns,custom)
  useEffect(()=>{let active=true;setLoading(true);loadQualityRecord(recordType,organizationId,recordId).then(data=>{if(active)setRecord(data)}).catch(()=>{if(active)setRecord(null)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[recordType,recordId,organizationId])
  const finalized=Boolean(record&&['closed','completed','cancelled'].includes(record.status))
  const recordInScope=!record||canAccessRecord({...record,department:record.department})
  if(loading)return <Page title={t('quality')}><div className="inline-empty">{language==='en'?'Loading…':'Φόρτωση…'}</div></Page>
  if(!record)return <Page title={t('quality')}><div className="inline-empty">{t('noData')}</div></Page>
  if(!recordInScope)return <Page title={t('quality')}><div className="inline-empty">{language==='en'?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>
  const Icon=iconMap[recordType]||ShieldCheck
  const title=language==='el'?record.title:record.titleEn
  const tabs=[{id:'details',label:t('details'),icon:Icon},{id:'links',label:t('qualityRecords.linkedRecords'),icon:Link2},{id:'documents',label:t('documents'),icon:Paperclip},{id:'history',label:t('history'),icon:FileClock}]
  return <Page fill><EntityRecordShell
    className="quality-record-shell workspace-fill"
    avatar={<Icon size={19}/>}
    title={title}
    status={<span className={`status-badge ${['closed','completed'].includes(record.status)?'active':''}`}>{t(record.status)}</span>}
    recordNavigation={recordNavigation}
    headerActions={<PrintExportActions showPrint={canPrint} onExport={()=>downloadRecordJson(record,{filename:record.displayId||record.id})}/>}
    tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {tab==='details'&&<QualityDetails recordType={recordType} record={record} setRecord={setRecord} t={t} language={language} locale={locale} canManage={canManage} notify={notify} actor={actor} finalized={finalized} onDeleted={goBack} organizationId={organizationId} navigate={navigate}/>}
      {tab==='links'&&<QualityLinks recordType={recordType} record={record} t={t} language={language} organizationId={organizationId}/>}
      {tab==='documents'&&<QualityDocuments recordType={recordType} record={record} setRecord={setRecord} t={t} finalized={finalized} canAttach={canAttach} canManage={canManage} organizationId={organizationId}/>}
      {tab==='history'&&<QualityHistory record={record} t={t} locale={locale}/>}
  </EntityRecordShell></Page>
}

function QualityDetails({recordType,record,setRecord,t,language,locale,canManage,notify,actor,finalized,onDeleted,organizationId,navigate}){
  const en=language==='en'
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState({...record})
  const [governedAction,setGovernedAction]=useState(null)
  const [correctionReason,setCorrectionReason]=useState('')
  const [saving,setSaving]=useState(false)
  const {data:employeeRows}=useEmployeesData()
  const employeeNames=employeeRows.filter(x=>x.employmentStatus!=='inactive').map(x=>language==='en'?([x.firstNameEn||x.firstName,x.lastNameEn||x.lastName].filter(Boolean).join(' ')):([x.lastName,x.firstName].filter(Boolean).join(' '))).filter(Boolean)
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  const addOwner=name=>{const value=String(name||'').trim();if(!value)return;setDraft(x=>({...x,owner:'',owners:[...new Set([...(x.owners?.length?x.owners:[x.owner].filter(Boolean)),value])]}))}
  const removeOwner=name=>setDraft(x=>({...x,owners:(x.owners?.length?x.owners:[x.owner].filter(Boolean)).filter(v=>v!==name),owner:''}))

  async function persist(next){
    setSaving(true)
    try{
      const saved=await saveQualityRecord(recordType,organizationId,next)
      setRecord({...saved})
      return saved
    }catch(error){
      console.error(error)
      notify(en?'The change could not be saved.':'Δεν ήταν δυνατή η αποθήκευση της αλλαγής.','error')
      throw error
    }finally{
      setSaving(false)
    }
  }
  function beginEdit(){
    if(!canManage)return
    if(finalized){setGovernedAction('correct');return}
    setDraft({...record});setEditing(true)
  }
  async function save(){
    const now=new Date().toISOString()
    const event=auditEvent(finalized?'recordCorrected':'recordUpdated',{actor,reason:correctionReason})
    const next={...draft,lifecycleStatus:'active',updatedAt:now,updatedBy:actor.name,updatedById:actor.id,history:[event,...(draft.history||record.history||[])]}
    try{
      await persist(next)
      setEditing(false);setCorrectionReason('');notify(t('recordUpdated'),'success')
    }catch{
      // persist() already reported the failure to the user
    }
  }
  function requestVoid(){if(canManage)setGovernedAction('void')}
  async function governedConfirm(reason){
    if(governedAction==='correct'){
      setCorrectionReason(reason);setDraft(openCorrection(record,{actor,reason}));setEditing(true);setGovernedAction(null);return
    }
    if(governedAction==='void'){
      const next=applyGovernedVoid(record,{actor,reason})
      try{
        await persist(next)
        setGovernedAction(null);notify(en?'Record voided and retained in the audit trail.':'Η εγγραφή ακυρώθηκε και διατηρήθηκε στο audit trail.','success');onDeleted?.()
      }catch{setGovernedAction(null)}
    }
  }
  const actionItems=canManage&&!editing?[
    {id:'edit',label:finalized?(en?'Correct record':'Διόρθωση εγγραφής'):t('edit'),icon:finalized?RotateCcw:Pencil,onClick:beginEdit},
    {id:'void',label:en?'Void record':'Ακύρωση εγγραφής',icon:Trash2,tone:'danger',separatorBefore:true,onClick:requestVoid},
  ]:[]
  return <div className={`record-section quality-record-details ${editing?'is-editing':'is-viewing'}`}>
    <div className="record-section-header"><h3>{t('details')}</h3>{actionItems.length>0&&<OverflowMenu items={actionItems}/>}</div>
    <div className={`detail-grid quality-detail-grid ${editing?'employee-inline-edit':''}`}>
      <Field label={t('code')} value={draft.displayId||draft.id}/>
      <EditField editing={editing} label={t('title')} value={language==='el'?draft.title:draft.titleEn} onChange={v=>set(language==='el'?'title':'titleEn',v)}/>
      <EditField editing={editing} label={t('department')} value={language==='el'?draft.department:draft.departmentEn} onChange={v=>set(language==='el'?'department':'departmentEn',v)}/>
      <EditSelect editing={editing} label={t('status')} value={draft.status} onChange={v=>set('status',v)} options={statusOptions(recordType).map(x=>[x,t(x)])}/>
      {recordType==='incidents'&&<><EditSelect editing={editing} label={en?'Incident type':'Τύπος συμβάντος'} value={draft.incidentClass||'nearMiss'} onChange={v=>setDraft(x=>({...x,incidentClass:v,reachedPatient:v!=='nearMiss',harmOccurred:v==='harmful',impact:v==='harmful'?(x.impact==='none'?'minor':x.impact):'none'}))} options={[['nearMiss',en?'Near miss':'Παρ’ ολίγον συμβάν'],['noHarm',en?'No-harm incident':'Συμβάν χωρίς βλάβη'],['harmful',en?'Harmful incident':'Συμβάν με βλάβη']]}/><EditSelect editing={editing} label={en?'Category':'Κατηγορία συμβάντος'} value={draft.category||'clinical'} onChange={v=>set('category',v)} options={[['clinical',en?'Clinical / patient safety':'Κλινικό / ασφάλεια ασθενούς'],['medication',en?'Medication':'Φάρμακο'],['equipment',en?'Equipment / device':'Εξοπλισμός / ιατροτεχνολογικό'],['process',en?'Process / operational':'Διαδικασία / λειτουργικό'],['staff',en?'Staff / occupational safety':'Προσωπικό / επαγγελματική ασφάλεια'],['facility',en?'Facility / infrastructure':'Εγκαταστάσεις / υποδομές'],['security',en?'Security':'Ασφάλεια'],['other',en?'Other':'Άλλο']]}/><EditSelect editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/><Field label={t('qualityRecords.reportedBy')} value={draft.reportedBy}/>{editing?<label className="quality-owner-picker quality-detail-owner"><span>{en?'Responsible person(s)':'Υπεύθυνος / Υπεύθυνοι'}</span><div className="quality-owner-input"><input list="quality-record-owner-options" value={draft.owner||''} onChange={e=>set('owner',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addOwner(draft.owner)}}} placeholder={en?'Select employee or type a name':'Επιλέξτε εργαζόμενο ή πληκτρολογήστε όνομα'}/><button type="button" onClick={()=>addOwner(draft.owner)}>+</button></div><datalist id="quality-record-owner-options">{employeeNames.map(name=><option key={name} value={name}/>)}</datalist>{(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean)).length>0&&<div className="quality-owner-chips">{(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean)).map(name=><span key={name}>{name}<button type="button" onClick={()=>removeOwner(name)} aria-label={en?'Remove':'Αφαίρεση'}>×</button></span>)}</div>}</label>:<Field label={en?'Responsible person(s)':'Υπεύθυνος / Υπεύθυνοι'} value={(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean)).join(', ')}/>} <Field label={t('date')} value={fmt(draft.date,locale)}/><EditField editing={editing} label={en?'Time':'Ώρα'} value={draft.eventTime} onChange={v=>set('eventTime',v)} type="time"/><EditSelect editing={editing} label={en?'Actual / potential impact':'Πραγματική / δυνητική επίπτωση'} value={draft.impact||'none'} onChange={v=>set('impact',v)} options={[['none',en?'No harm / impact':'Χωρίς βλάβη / επίπτωση'],['minor',en?'Minor':'Μικρή'],['moderate',en?'Moderate':'Μέτρια'],['major',en?'Major':'Σημαντική'],['severe',en?'Severe':'Σοβαρή']]}/></>}
      {recordType==='findings'&&<><EditSelect editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/>{editing?<OwnerPicker draft={draft} set={set} addOwner={addOwner} removeOwner={removeOwner} employeeNames={employeeNames} en={en}/>:<Field label={t('owner')} value={(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean)).join(', ')}/>}<Field label={t('source')} value={`${t(draft.source)} · ${draft.sourceId||'—'}`}/></>}
      {recordType==='capas'&&<><EditSelect editing={editing} label={t('actionType')} value={draft.actionType} onChange={v=>set('actionType',v)} options={['corrective','preventive'].map(x=>[x,t(x)])}/><EditSelect editing={editing} label={t('priority')} value={draft.priority} onChange={v=>set('priority',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/>{editing?<OwnerPicker draft={draft} set={set} addOwner={addOwner} removeOwner={removeOwner} employeeNames={employeeNames} en={en}/>:<Field label={t('owner')} value={(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean)).join(', ')}/>}<EditDateField editing={editing} label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)} locale={locale}/><EditDateField editing={editing} label={t('qualityRecords.effectivenessDue')} value={draft.effectivenessDue} onChange={v=>set('effectivenessDue',v)} locale={locale}/><EditSelect editing={editing} label={t('qualityRecords.effectiveness')} value={draft.effectivenessStatus} onChange={v=>set('effectivenessStatus',v)} options={['pending','effective','notEffective'].map(x=>[x,t(x)])}/></>}
      {recordType==='audits'&&<><EditSelect editing={editing} label={t('auditType')} value={draft.auditType} onChange={v=>set('auditType',v)} options={['internal','external'].map(x=>[x,t(x)])}/>{editing?<OwnerPicker draft={{...draft,owner:draft.leadAuditor||draft.owner||''}} set={(k,v)=>set(k==='owner'?'leadAuditor':k,v)} addOwner={name=>{const value=String(name||'').trim();if(value)set('leadAuditor',value)}} removeOwner={()=>set('leadAuditor','')} employeeNames={employeeNames} en={en} single label={en?'Lead auditor':'Επικεφαλής ελεγκτής'}/>:<Field label={t('leadAuditor')} value={draft.leadAuditor}/>}<EditDateField editing={editing} label={t('plannedDate')} value={draft.plannedDate} onChange={v=>set('plannedDate',v)} locale={locale}/><Field label={t('qualityRecords.completedDate')} value={fmt(draft.completedDate,locale)}/></>}
    </div>
    <div className={recordType==='incidents'?'quality-incident-narrative':'quality-record-narrative'}><div className="quality-description"><span>{t(recordType==='audits'?'qualityRecords.auditScope':'description')}</span>{editing?<textarea rows={3} value={language==='el'?(draft.description??draft.scope??''):(draft.descriptionEn??draft.scopeEn??'')} onChange={e=>set(language==='el'?(recordType==='audits'?'scope':'description'):(recordType==='audits'?'scopeEn':'descriptionEn'),e.target.value)}/>:<p>{language==='el'?(record.description??record.scope??'—'):(record.descriptionEn??record.scopeEn??'—')}</p>}</div>{recordType==='incidents'&&<div className="quality-description quality-readonly-text"><span>{en?'Immediate actions taken':'Άμεσες ενέργειες που πραγματοποιήθηκαν'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.immediateActions||''):(draft.immediateActionsEn||'')} onChange={e=>set(language==='el'?'immediateActions':'immediateActionsEn',e.target.value)}/>:<p>{language==='el'?(record.immediateActions||'—'):(record.immediateActionsEn||record.immediateActions||'—')}</p>}</div>}</div>{recordType==='incidents'&&<div className="quality-investigation-card"><div className="quality-subsection-heading"><div><strong>{en?'Investigation & root cause':'Διερεύνηση & βασική αιτία'}</strong><span>{en?'Document the analysis before closing the incident.':'Καταγραφή της ανάλυσης πριν από την ολοκλήρωση του συμβάντος.'}</span></div></div><div className="quality-investigation-grid"><div className="quality-description quality-readonly-text"><span>{en?'Root cause':'Βασική αιτία (Root Cause)'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.rootCause||''):(draft.rootCauseEn||'')} onChange={e=>set(language==='el'?'rootCause':'rootCauseEn',e.target.value)}/>:<p>{language==='el'?(record.rootCause||'—'):(record.rootCauseEn||record.rootCause||'—')}</p>}</div><div className="quality-description quality-readonly-text"><span>{en?'Contributing factors':'Συνεισφέροντες παράγοντες'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.contributingFactors||''):(draft.contributingFactorsEn||'')} onChange={e=>set(language==='el'?'contributingFactors':'contributingFactorsEn',e.target.value)}/>:<p>{language==='el'?(record.contributingFactors||'—'):(record.contributingFactorsEn||record.contributingFactors||'—')}</p>}</div></div>{canManage&&!editing&&<div className="quality-workflow-actions"><Button variant="primary" onClick={()=>navigate('/quality/capas/new',{state:{qualitySource:{source:'incident',sourceId:record.id,departmentId:record.departmentId,title:(en?'CAPA for ':'CAPA για ')+(record.displayId||record.id)}}})}>{en?'Create linked CAPA':'Δημιουργία συνδεδεμένης CAPA'}</Button></div>}</div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" disabled={saving} onClick={()=>{setDraft({...record});setEditing(false);setCorrectionReason('')}}>{t('cancel')}</Button><SaveButton loading={saving} onClick={save}>{t('save')}</SaveButton></div>}
    <GovernedReasonDialog open={Boolean(governedAction)} title={governedAction==='correct'?(en?'Correct finalized record':'Διόρθωση ολοκληρωμένης εγγραφής'):(en?'Void record':'Ακύρωση εγγραφής')} description={governedAction==='correct'?(en?'The original record remains in history. Enter the reason for the correction.':'Η αρχική εγγραφή παραμένει στο ιστορικό. Καταγράψτε τον λόγο της διόρθωσης.'):(en?'The record will not be physically deleted. It will be marked as voided and retained in the audit trail.':'Η εγγραφή δεν θα διαγραφεί φυσικά. Θα χαρακτηριστεί ως ακυρωμένη και θα παραμείνει στο audit trail.')} confirmLabel={governedAction==='correct'?(en?'Start correction':'Έναρξη διόρθωσης'):(en?'Void record':'Ακύρωση εγγραφής')} danger={governedAction==='void'} onCancel={()=>setGovernedAction(null)} onConfirm={governedConfirm}/>
  </div>
}

function QualityLinks({recordType,record,t,language,organizationId}){
  const navigate=useNavigate()
  const [related,setRelated]=useState([])
  useEffect(()=>{
    let active=true
    if(recordType!=='incidents'&&recordType!=='findings'){setRelated([]);return}
    loadQualityRecords('capas',organizationId).then(rows=>{if(active)setRelated(rows.filter(x=>x.sourceId===record.id))}).catch(()=>{if(active)setRelated([])})
    return()=>{active=false}
  },[recordType,record.id,organizationId])
  const links=[]
  if(record.linkedPatient)links.push([t('patient'),record.linkedPatient])
  if(record.linkedSurveillance)links.push([t('surveillance'),record.linkedSurveillance])
  if(record.sourceId)links.push([t('source'),record.sourceId])
  if(record.findingIds?.length)record.findingIds.forEach(id=>links.push([t('qualityRecords.finding'),id]))
  return <div className="record-section"><div className="record-section-header"><h3>{t('qualityRecords.linkedRecords')}</h3></div><div className="quality-link-list">{links.map(([label,id])=><button type="button" key={`${label}-${id}`} onClick={()=>navigate(linkPath(label,id,t))}><span>{label}</span><strong>{id}</strong></button>)}{related.map(x=><button type="button" key={x.id} onClick={()=>navigate(`/quality/capas/${x.id}`)}><span>{t('qualityRecords.capa')}</span><strong>{x.displayId||x.id} · {language==='el'?x.title:x.titleEn}</strong></button>)}{!links.length&&!related.length&&<div className="inline-empty">{t('qualityRecords.noLinkedRecords')}</div>}</div></div>
}

function QualityDocuments({record,recordType,setRecord,t,finalized,canAttach,canManage,organizationId}){
  return <div className="record-section"><div className="record-section-header"><h3>{t('documents')}</h3></div><AttachmentField disabled={finalized||(!canAttach&&!canManage)} value={record.attachments||[]} onChange={attachments=>setRecord(r=>({...r,attachments}))} organizationId={organizationId} entityType={`quality_${recordType}`} entityId={record.dbId||record.id}/></div>
}

function linkPath(label,id,t){
  if(label===t('patient'))return `/patients/${id}`
  if(label===t('surveillance'))return `/surveillance/${id}`
  if(label===t('source')){
    if(id.startsWith('AUD-'))return `/quality/audits/${id}`
    if(id.startsWith('FND-'))return `/quality/findings/${id}`
    if(id.startsWith('INC-'))return `/quality/incidents/${id}`
  }
  if(label===t('qualityRecords.finding'))return `/quality/findings/${id}`
  return '/quality'
}
function QualityHistory({record,t,locale}){const rows=useMemo(()=>[...(record.history||[])].sort((a,b)=>new Date(b.at)-new Date(a.at)),[record.history]);return <div className="record-section"><div className="record-section-header"><h3>{t('history')}</h3></div>{rows.length?<div className="lab-history-list">{rows.map((x,i)=><div className="lab-history-row" key={`${x.at}-${i}`}><time>{new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(x.at))}</time><strong>{t(x.action)}</strong><span>{x.actor||'—'}</span></div>)}</div>:<div className="inline-empty">{t('noData')}</div>}</div>}
function OwnerPicker({draft,set,addOwner,removeOwner,employeeNames,en,single=false,label}){const selected=single?[draft.owner].filter(Boolean):(draft.owners?.length?draft.owners:[draft.owner].filter(Boolean));return <label className="quality-owner-picker quality-detail-owner"><span>{label||(en?'Responsible person(s)':'Υπεύθυνος / Υπεύθυνοι')}</span><div className="quality-owner-input"><input list="quality-record-owner-options-shared" value={single?(draft.owner||''):(draft.owner||'')} onChange={e=>set('owner',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addOwner(draft.owner)}}} placeholder={en?'Select employee or type a name':'Επιλέξτε εργαζόμενο ή πληκτρολογήστε όνομα'}/><button type="button" onClick={()=>addOwner(draft.owner)}>+</button></div><datalist id="quality-record-owner-options-shared">{employeeNames.map(name=><option key={name} value={name}/>)}</datalist>{selected.length>0&&<div className="quality-owner-chips">{selected.map(name=><span key={name}>{name}<button type="button" onClick={()=>removeOwner(name)} aria-label={en?'Remove':'Αφαίρεση'}>×</button></span>)}</div>}</label>}
function statusOptions(type){return type==='incidents'?['reported','underReview','closed']:type==='findings'?['open','inProgress','closed']:type==='capas'?['open','inProgress','verification','closed']:['planned','inProgress','completed','cancelled']}
function fmt(v,locale){return v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'}
function Field({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
function EditDateField({editing,label,value,onChange,locale}){return editing?<ManualDateField label={label} value={value||''} onChange={onChange}/>:<Field label={label} value={fmt(value,locale)}/>} 
function EditField({editing,label,value,onChange,type='text'}){if(editing&&type==='date')return <ManualDateField className="detail-item editable" label={label} value={value||''} onChange={onChange}/>;return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<input type={type} value={value||''} onChange={e=>onChange(e.target.value)}/>:<strong>{value||'—'}</strong>}</div>}
function EditSelect({editing,label,value,onChange,options}){return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<select value={value||''} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<strong>{options.find(x=>x[0]===value)?.[1]||value||'—'}</strong>}</div>}
