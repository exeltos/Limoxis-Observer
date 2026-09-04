import { useEffect,useState } from 'react'
import { Navigate,useLocation,useParams } from 'react-router-dom'
import { AlertTriangle,CheckSquare2,ClipboardCheck,ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { createQualityRecord } from './qualityService'
import { loadDepartments } from '../management/departmentsService'

const config={incidents:{icon:AlertTriangle,title:'newIncident'},findings:{icon:ShieldCheck,title:'newFinding'},capas:{icon:CheckSquare2,title:'newCapa'},audits:{icon:ClipboardCheck,title:'newAudit'}}

export function QualityCreatePage(){
  const {recordType}=useParams();const location=useLocation();const {goBack}=useContextualNavigation('/quality');const {t,language}=useLanguage();const {notify}=useFeedback();const {user}=useAuth();const {role,membership,tenant}=useTenant();const c=config[recordType]||config.incidents;const Icon=c.icon
  const [saving,setSaving]=useState(false);const [departments,setDepartments]=useState([])
  const [draft,setDraft]=useState({title:'',titleEn:'',departmentId:'',status:recordType==='incidents'?'reported':recordType==='findings'?'open':recordType==='capas'?'open':'planned',severity:'medium',description:'',descriptionEn:'',date:new Date().toISOString().slice(0,10),source:'manual',sourceId:'',actionType:'corrective',priority:'medium',dueDate:'',effectivenessDue:'',effectivenessStatus:'pending',auditType:'internal',plannedDate:'',scope:'',scopeEn:'',attachments:[]})
  useEffect(()=>{let active=true;loadDepartments(tenant?.id).then(rows=>{if(active)setDepartments(rows.filter(x=>x.is_active!==false))}).catch(()=>{if(active)setDepartments([])});return()=>{active=false}},[tenant?.id])
  const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[];const canManage=can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom);const canReportIncident=can(role,CAPABILITIES.REPORT_INCIDENT,addOns,custom);const canCreate=canManage||(recordType==='incidents'&&canReportIncident)
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}));const titleValue=language==='el'?draft.title:draft.titleEn;const descriptionValue=language==='el'?(recordType==='audits'?draft.scope:draft.description):(recordType==='audits'?draft.scopeEn:draft.descriptionEn)
  async function save(){if(!canCreate||!titleValue.trim()||saving)return;setSaving(true);try{await createQualityRecord(recordType,tenant?.id,{...draft,title:draft.title||draft.titleEn,titleEn:draft.titleEn||draft.title},user?.id);notify(t('recordCreated'),'success');goBack()}catch(error){console.error(error);notify(language==='en'?'The quality record could not be saved.':'Δεν ήταν δυνατή η αποθήκευση της εγγραφής ποιότητας.','error')}finally{setSaving(false)}}
  if(!canCreate)return <Navigate to="/quality" replace/>
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<Icon size={19}/>} eyebrow={t('quality')} title={t(c.title)} subtitle={t('qualityRecords.newQualityRecord')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={goBack}>
    <div className="record-section quality-create-form"><div className="entry-grid">
      <label className="entry-span-2"><span>{t('title')}</span><input value={titleValue} onChange={e=>set(language==='el'?'title':'titleEn',e.target.value)}/></label>
      <label><span>{t('department')}</span><select value={draft.departmentId} onChange={e=>set('departmentId',e.target.value)}><option value="">{language==='en'?'Select department…':'Επιλέξτε τμήμα…'}</option>{departments.map(dep=><option key={dep.id} value={dep.id}>{dep.name}</option>)}</select></label>
      {recordType==='incidents'&&<><ManualDateField label={t('date')} value={draft.date} onChange={v=>set('date',v)}/><label><span>{t('severity')}</span><select value={draft.severity} onChange={e=>set('severity',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label></>}
      {recordType==='findings'&&<><label><span>{t('severity')}</span><select value={draft.severity} onChange={e=>set('severity',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><label><span>{t('source')}</span><select value={draft.source} onChange={e=>set('source',e.target.value)}><option value="manual">{t('qualityRecords.manualSource')}</option><option value="audit">{t('audit')}</option><option value="incident">{t('incident')}</option><option value="control">{language==='en'?'Control':'Έλεγχος'}</option></select></label><label><span>{t('qualityRecords.sourceId')}</span><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)}/></label></>}
      {recordType==='capas'&&<><label><span>{t('actionType')}</span><select value={draft.actionType} onChange={e=>set('actionType',e.target.value)}><option value="corrective">{t('corrective')}</option><option value="preventive">{t('preventive')}</option></select></label><label><span>{t('priority')}</span><select value={draft.priority} onChange={e=>set('priority',e.target.value)}>{['low','medium','high','critical'].map(x=><option key={x} value={x}>{t(x)}</option>)}</select></label><ManualDateField label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)}/><label><span>{t('qualityRecords.sourceId')}</span><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)}/></label></>}
      {recordType==='audits'&&<><label><span>{t('auditType')}</span><select value={draft.auditType} onChange={e=>set('auditType',e.target.value)}><option value="internal">{t('internal')}</option><option value="external">{t('external')}</option></select></label><ManualDateField label={t('plannedDate')} value={draft.plannedDate} onChange={v=>set('plannedDate',v)}/></>}
      <label className="entry-span-2"><span>{t(recordType==='audits'?'qualityRecords.auditScope':'description')}</span><textarea rows={5} value={descriptionValue} onChange={e=>set(language==='el'?(recordType==='audits'?'scope':'description'):(recordType==='audits'?'scopeEn':'descriptionEn'),e.target.value)}/></label>
    </div><AttachmentField value={draft.attachments} onChange={v=>set('attachments',v)}/><div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{t('cancel')}</Button><SaveButton loading={saving} disabled={!titleValue.trim()||saving} onClick={save}>{t('save')}</SaveButton></div></div>
  </EntityRecordShell></Page>
}
