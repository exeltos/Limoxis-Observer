import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckSquare2, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { qualityCollections } from './qualityDemoData'
import { demoLibrarySeed } from '../management/managementData'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'

const config={
  incidents:{icon:AlertTriangle,title:'newIncident',prefix:'INC'},
  findings:{icon:ShieldCheck,title:'newFinding',prefix:'FND'},
  capas:{icon:CheckSquare2,title:'newCapa',prefix:'CAPA'},
  audits:{icon:ClipboardCheck,title:'newAudit',prefix:'AUD'},
}

export function QualityCreatePage(){
  const {recordType}=useParams()
  const navigate=useNavigate()
  const location=useLocation()
  const {goBack}=useContextualNavigation('/quality')
  const {t,language}=useLanguage()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const actor=auditActorFromAuth({profile,user})
  const c=config[recordType]||config.incidents
  const Icon=c.icon
  const controlSource=location.state?.controlSource
  const [draft,setDraft]=useState(()=>{
    const base={
      title:'',titleEn:'',department:'ΜΕΘ',departmentEn:'ICU',status:recordType==='incidents'?'reported':recordType==='findings'?'open':recordType==='capas'?'open':'planned',
      severity:'medium',owner:'',description:'',descriptionEn:'',date:new Date().toISOString().slice(0,10),source:'manual',sourceId:'',
      actionType:'corrective',priority:'medium',dueDate:'',effectivenessDue:'',effectivenessStatus:'pending',
      auditType:'internal',leadAuditor:'',plannedDate:'',scope:'',scopeEn:'',attachments:[],history:[]
    }
    if(!controlSource)return base
    const rowText=(controlSource.rows||[]).map((r,i)=>`${i+1}. ${r.item||'Στοιχείο'}${r.finding?` — ${r.finding}${r.finding==='Άλλο'&&r.findingOther?`: ${r.findingOther}`:''}`:''}${r.action?` — Ενέργεια: ${r.action}`:''}`).join('\n')
    return {...base,title:`Εύρημα από έλεγχο: ${controlSource.controlTitle}`,department:controlSource.department||base.department,source:'control',sourceId:controlSource.controlId||'',severity:controlSource.hasFinding?'medium':'low',description:[`Προέλευση: ${controlSource.controlId} — ${controlSource.controlTitle}`,controlSource.value?`Αποτέλεσμα: ${controlSource.value}`:'',controlSource.notes?`Σημειώσεις: ${controlSource.notes}`:'',rowText].filter(Boolean).join('\n\n')}
  })
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  function setDepartment(el){const pair=demoLibrarySeed.departments.find(([x])=>x===el);setDraft(d=>({...d,department:el,departmentEn:pair?.[1]||el}))}
  function save(){
    const id=`${c.prefix}-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String((qualityCollections[recordType]?.length||0)+1).padStart(3,'0')}`
    const record={id,...draft,history:[{at:new Date().toISOString(),action:'recordCreated',actor:actor.name}]}
    qualityCollections[recordType]?.unshift(record)
    notify(t('recordCreated'),'success')
    navigate(`/quality/${recordType}/${id}`,{replace:true,state:{limoxisFrom:location.state?.limoxisFrom}})
  }
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<Icon size={19}/>} eyebrow={t('quality')} title={t(c.title)} subtitle={t('qualityRecords.newQualityRecord')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={goBack}>
    <div className="record-section quality-create-form">
      <div className="entry-grid">
        <label className="entry-span-2"><span>{t('title')}</span><input value={language==='el'?draft.title:draft.titleEn} onChange={e=>set(language==='el'?'title':'titleEn',e.target.value)}/></label>
        <label><span>{t('department')}</span><select value={draft.department} onChange={e=>setDepartment(e.target.value)}>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
        {recordType!=='audits'&&<label><span>{t('owner')}</span><input value={draft.owner} onChange={e=>set('owner',e.target.value)}/></label>}
        {recordType==='incidents'&&<><ManualDateField label={t('date')} value={draft.date} onChange={v=>set('date',v)}/><label><span>{t('severity')}</span><select value={draft.severity} onChange={e=>set('severity',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label></>}
        {recordType==='findings'&&<><label><span>{t('severity')}</span><select value={draft.severity} onChange={e=>set('severity',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><label><span>{t('source')}</span><select value={draft.source} onChange={e=>set('source',e.target.value)}><option value="manual">{t('qualityRecords.manualSource')}</option><option value="audit">{t('audit')}</option><option value="incident">{t('incident')}</option></select></label><label><span>{t('qualityRecords.sourceId')}</span><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)}/></label></>}
        {recordType==='capas'&&<><label><span>{t('actionType')}</span><select value={draft.actionType} onChange={e=>set('actionType',e.target.value)}><option value="corrective">{t('corrective')}</option><option value="preventive">{t('preventive')}</option></select></label><label><span>{t('priority')}</span><select value={draft.priority} onChange={e=>set('priority',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><ManualDateField label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)}/><label><span>{t('qualityRecords.sourceId')}</span><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)}/></label></>}
        {recordType==='audits'&&<><label><span>{t('auditType')}</span><select value={draft.auditType} onChange={e=>set('auditType',e.target.value)}><option value="internal">{t('internal')}</option><option value="external">{t('external')}</option></select></label><label><span>{t('leadAuditor')}</span><input value={draft.leadAuditor} onChange={e=>set('leadAuditor',e.target.value)}/></label><ManualDateField label={t('plannedDate')} value={draft.plannedDate} onChange={v=>set('plannedDate',v)}/></>}
        <label className="entry-span-2"><span>{t(recordType==='audits'?'qualityRecords.auditScope':'description')}</span><textarea rows={6} value={language==='el'?(recordType==='audits'?draft.scope:draft.description):(recordType==='audits'?draft.scopeEn:draft.descriptionEn)} onChange={e=>set(language==='el'?(recordType==='audits'?'scope':'description'):(recordType==='audits'?'scopeEn':'descriptionEn'),e.target.value)}/></label>
      </div>
      <AttachmentField value={draft.attachments} onChange={v=>set('attachments',v)}/>
      <div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{t('cancel')}</Button><Button disabled={!(draft.title||draft.titleEn)} onClick={save}>{t('save')}</Button></div>
    </div>
  </EntityRecordShell></Page>
}
