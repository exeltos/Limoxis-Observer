import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckSquare2, ClipboardCheck, FileClock, Link2, Paperclip, Pencil, Printer, ShieldCheck, Trash2 } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { getQualityRecord, qualityCollections } from './qualityDemoData'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'

const iconMap={incidents:AlertTriangle,findings:ShieldCheck,capas:CheckSquare2,audits:ClipboardCheck}

export function QualityRecordPage(){
  const {recordType,recordId}=useParams()
  const navigate=useNavigate()
  const {restored,goBack}=useContextualNavigation('/quality')
  const {t,language,locale}=useLanguage()
  const {role,membership}=useTenant()
  const {notify,confirm}=useFeedback()
  const original=getQualityRecord(recordType,recordId)
  const [record,setRecord]=useState(original?{...original}:null)
  const [tab,setTab]=useState(()=>restored?.tab||'details')
  const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
  const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canAttach=can(role,CAPABILITIES.ATTACH_FILES,addOns,custom)
  const canPrint=can(role,CAPABILITIES.PRINT_RECORDS,addOns,custom)
  if(!record)return <Page title={t('quality')}><div className="inline-empty">{t('noData')}</div></Page>
  const Icon=iconMap[recordType]||ShieldCheck
  const title=language==='el'?record.title:record.titleEn
  const tabs=[{id:'details',label:t('details'),icon:Icon},{id:'links',label:t('linkedRecords'),icon:Link2},{id:'documents',label:t('documents'),icon:Paperclip},{id:'history',label:t('history'),icon:FileClock}]
  return <Page fill><EntityRecordShell
    className="quality-record-shell workspace-fill"
    avatar={<Icon size={19}/>}
    eyebrow={record.id}
    title={title}
    subtitle={`${language==='el'?record.department:record.departmentEn||'—'} · ${t(record.status)}`}
    status={<span className={`status-badge ${['closed','completed'].includes(record.status)?'active':''}`}>{t(record.status)}</span>}
    headerActions={canPrint?<button className="entity-record-icon-button" onClick={()=>window.print()} title={t('print')}><Printer size={15}/></button>:null}
    tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {tab==='details'&&<QualityDetails recordType={recordType} record={record} setRecord={setRecord} t={t} language={language} locale={locale} canManage={canManage} notify={notify} confirm={confirm} onDeleted={goBack}/>}
      {tab==='links'&&<QualityLinks recordType={recordType} record={record} t={t} language={language}/>}
      {tab==='documents'&&<div className="record-section"><AttachmentField disabled={!canAttach&&!canManage} value={record.attachments||[]} onChange={attachments=>setRecord(r=>({...r,attachments}))}/></div>}
      {tab==='history'&&<QualityHistory record={record} t={t} locale={locale}/>}
  </EntityRecordShell></Page>
}

function QualityDetails({recordType,record,setRecord,t,language,locale,canManage,notify,confirm,onDeleted}){
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState({...record})
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  const save=()=>{setRecord({...draft,history:[{at:new Date().toISOString(),action:'recordUpdated',actor:t('currentUser')},...(record.history||[])]});setEditing(false);notify(t('recordUpdated'),'success')}
  async function remove(){const ok=await confirm({title:t('delete'),message:t('deleteConfirm'),danger:true,confirmLabel:t('delete')});if(ok){const collection=qualityCollections[recordType]||[];const index=collection.findIndex(x=>x.id===record.id);if(index>=0)collection.splice(index,1);notify(t('recordDeleted'),'warning');onDeleted?.()}}
  return <div className="record-section">
    <div className="record-section-header"><div><span className="eyebrow">{t('quality')}</span><h3>{t('details')}</h3></div>{canManage&&!editing&&<div className="record-inline-actions"><button onClick={()=>setEditing(true)} title={t('edit')}><Pencil size={16}/></button><button className="danger" onClick={remove} title={t('delete')}><Trash2 size={16}/></button></div>}</div>
    <div className={`detail-grid quality-detail-grid ${editing?'employee-inline-edit':''}`}>
      <Field label={t('code')} value={draft.id}/>
      <EditField editing={editing} label={t('title')} value={language==='el'?draft.title:draft.titleEn} onChange={v=>set(language==='el'?'title':'titleEn',v)}/>
      <EditField editing={editing} label={t('department')} value={language==='el'?draft.department:draft.departmentEn} onChange={v=>set(language==='el'?'department':'departmentEn',v)}/>
      <EditSelect editing={editing} label={t('status')} value={draft.status} onChange={v=>set('status',v)} options={statusOptions(recordType).map(x=>[x,t(x)])}/>
      {recordType==='incidents'&&<><EditSelect editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/><Field label={t('reportedBy')} value={draft.reportedBy}/><EditField editing={editing} label={t('owner')} value={draft.owner} onChange={v=>set('owner',v)}/><Field label={t('date')} value={fmt(draft.date,locale)}/></>}
      {recordType==='findings'&&<><EditSelect editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/><EditField editing={editing} label={t('owner')} value={draft.owner} onChange={v=>set('owner',v)}/><Field label={t('source')} value={`${t(draft.source)} · ${draft.sourceId||'—'}`}/></>}
      {recordType==='capas'&&<><EditSelect editing={editing} label={t('actionType')} value={draft.actionType} onChange={v=>set('actionType',v)} options={['corrective','preventive'].map(x=>[x,t(x)])}/><EditSelect editing={editing} label={t('priority')} value={draft.priority} onChange={v=>set('priority',v)} options={['low','medium','high','critical'].map(x=>[x,t(x)])}/><EditField editing={editing} label={t('owner')} value={draft.owner} onChange={v=>set('owner',v)}/><EditField editing={editing} type="date" label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)}/><EditField editing={editing} type="date" label={t('effectivenessDue')} value={draft.effectivenessDue} onChange={v=>set('effectivenessDue',v)}/><EditSelect editing={editing} label={t('effectiveness')} value={draft.effectivenessStatus} onChange={v=>set('effectivenessStatus',v)} options={['pending','effective','notEffective'].map(x=>[x,t(x)])}/></>}
      {recordType==='audits'&&<><EditSelect editing={editing} label={t('auditType')} value={draft.auditType} onChange={v=>set('auditType',v)} options={['internal','external'].map(x=>[x,t(x)])}/><EditField editing={editing} label={t('leadAuditor')} value={draft.leadAuditor} onChange={v=>set('leadAuditor',v)}/><EditField editing={editing} type="date" label={t('plannedDate')} value={draft.plannedDate} onChange={v=>set('plannedDate',v)}/><Field label={t('completedDate')} value={fmt(draft.completedDate,locale)}/></>}
    </div>
    <div className="quality-description"><span>{t(recordType==='audits'?'scope':'description')}</span>{editing?<textarea rows={5} value={language==='el'?(draft.description??draft.scope??''):(draft.descriptionEn??draft.scopeEn??'')} onChange={e=>set(language==='el'?(recordType==='audits'?'scope':'description'):(recordType==='audits'?'scopeEn':'descriptionEn'),e.target.value)}/>:<p>{language==='el'?(record.description??record.scope??'—'):(record.descriptionEn??record.scopeEn??'—')}</p>}</div>
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft({...record});setEditing(false)}}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></div>}
  </div>
}
function QualityLinks({recordType,record,t,language}){
  const {goTo}=useContextualNavigation('/quality')
  const links=[]
  if(record.linkedPatient)links.push([t('patient'),record.linkedPatient])
  if(record.linkedSurveillance)links.push([t('surveillance'),record.linkedSurveillance])
  if(record.sourceId)links.push([t('source'),record.sourceId])
  if(record.findingIds?.length)record.findingIds.forEach(id=>links.push([t('finding'),id]))
  const related=recordType==='incidents'?qualityCollections.capas.filter(x=>x.sourceId===record.id):recordType==='findings'?qualityCollections.capas.filter(x=>x.sourceId===record.id):[]
  return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('quality')}</span><h3>{t('linkedRecords')}</h3></div></div><div className="quality-link-list">{links.map(([label,id])=><button key={`${label}-${id}`} onClick={()=>goTo(linkPath(label,id,t),{tab:'links'})}><span>{label}</span><strong>{id}</strong></button>)}{related.map(x=><button key={x.id} onClick={()=>goTo(`/quality/capas/${x.id}`,{tab:'links'})}><span>{t('capa')}</span><strong>{x.id} · {language==='el'?x.title:x.titleEn}</strong></button>)}{!links.length&&!related.length&&<div className="inline-empty">{t('noLinkedRecords')}</div>}</div></div>
}
function linkPath(label,id,t){
  if(label===t('patient'))return `/patients/${id}`
  if(label===t('surveillance'))return `/surveillance/${id}`
  if(label===t('source')){
    if(id.startsWith('AUD-'))return `/quality/audits/${id}`
    if(id.startsWith('FND-'))return `/quality/findings/${id}`
    if(id.startsWith('INC-'))return `/quality/incidents/${id}`
  }
  if(label===t('finding'))return `/quality/findings/${id}`
  return '/quality'
}
function QualityHistory({record,t,locale}){const rows=useMemo(()=>[...(record.history||[])].sort((a,b)=>new Date(b.at)-new Date(a.at)),[record.history]);return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('quality')}</span><h3>{t('history')}</h3></div></div><div className="lab-history-list">{rows.map((x,i)=><div className="lab-history-row" key={`${x.at}-${i}`}><time>{new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(x.at))}</time><strong>{t(x.action)}</strong><span>{x.actor}</span></div>)}</div></div>}
function statusOptions(type){return type==='incidents'?['reported','underReview','closed']:type==='findings'?['open','inProgress','closed']:type==='capas'?['open','inProgress','verification','closed']:['planned','inProgress','completed','cancelled']}
function fmt(v,locale){return v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'}
function Field({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
function EditField({editing,label,value,onChange,type='text'}){if(editing&&type==='date')return <ManualDateField className="detail-item editable" label={label} value={value||''} onChange={onChange}/>;return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<input type={type} value={value||''} onChange={e=>onChange(e.target.value)}/>:<strong>{value||'—'}</strong>}</div>}
function EditSelect({editing,label,value,onChange,options}){return <div className={`detail-item ${editing?'editable':''}`}><span>{label}</span>{editing?<select value={value||''} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<strong>{options.find(x=>x[0]===value)?.[1]||value||'—'}</strong>}</div>}
