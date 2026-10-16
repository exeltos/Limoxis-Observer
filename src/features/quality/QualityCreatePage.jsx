import { useState } from 'react'
import { Navigate,useLocation,useParams } from 'react-router-dom'
import { CheckSquare2,ClipboardCheck,ListChecks,ShieldCheck,UserCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { FormCard,FormGrid } from '../../design-system/FormCard'
import { Field } from '../../design-system/Field'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES,ROLES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { auditActorFromAuth, auditEvent } from '../../core/audit/actor'
import { createQualityRecord } from './qualityService'
import { AUDIT_TYPES,CAPA_TYPES,FINDING_SOURCES,severityOptions,vocabularyOptions } from './qualityVocabulary'
import { QualityDepartmentField,QualityOwnerField,QualityPersonField,departmentRef } from './QualityFields'
import { IncidentReportPage } from './IncidentReportPage'
import { AuditChecklistSource } from './QualityAuditParts'
import './quality.css'
import { signalDemoScenario } from '../demo/demoScenarioSignals'
import { signalDemoStep } from '../demo/demoScenarioSignals'

const config={findings:{icon:ShieldCheck,title:'newFinding'},capas:{icon:CheckSquare2,title:'newCapa'},audits:{icon:ClipboardCheck,title:'newAudit'}}

// A new incident is the staff report form; findings, CAPA and audits are
// created here by the Quality team.
export function QualityCreatePage(){
  const {recordType}=useParams()
  if(recordType==='incidents')return <IncidentReportPage/>
  return <QualityRecordCreate recordType={config[recordType]?recordType:'findings'}/>
}

const initialStatus={findings:'open',capas:'open',audits:'planned'}

// What another screen (a deviation, a risk, the calendar, an incident) hands to the form.
function prefillFrom(source){
  if(!source)return {}
  return Object.fromEntries(Object.entries({source:source.source,sourceId:source.sourceId,departmentId:source.departmentId,department:source.department,departmentEn:source.departmentEn,title:source.title,titleEn:source.title,description:source.description,descriptionEn:source.description,priority:source.priority,subActions:Array.isArray(source.subActions)?source.subActions:undefined,dueDate:source.dueDate,plannedDate:source.plannedDate}).filter(([,value])=>value!==undefined&&value!==null&&value!==''))
}

function QualityRecordCreate({recordType}){
  const location=useLocation();const {goBack}=useContextualNavigation('/quality');const {t,language}=useLanguage();const en=language==='en';const {notify}=useFeedback();const {user,profile}=useAuth();const {role,membership,tenant,actualRole,isRolePreview}=useTenant();const c=config[recordType];const Icon=c.icon
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState(()=>({title:'',titleEn:'',departmentId:'',department:'',departmentEn:'',status:initialStatus[recordType],severity:'medium',owners:[],owner:'',ownerId:null,description:'',descriptionEn:'',date:new Date().toISOString().slice(0,10),source:recordType==='capas'?'other':'manual',sourceId:'',actionType:'corrective',priority:'medium',dueDate:'',effectivenessDue:'',effectivenessStatus:'pending',auditType:'internal',plannedDate:'',scope:'',scopeEn:'',leadAuditor:'',leadAuditorId:null,checklist:[],checklistSource:'',...prefillFrom(location.state?.qualitySource)}))
  const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[];const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER;const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}));const patch=next=>setDraft(x=>({...x,...next}))
  const titleKey=en?'titleEn':'title';const textKey=recordType==='audits'?(en?'scopeEn':'scope'):(en?'descriptionEn':'description')
  const valid=Boolean(draft[titleKey].trim())
  async function save(){if(!canManage||!valid||saving)return;setSaving(true);try{const actor=auditActorFromAuth({profile,user});await createQualityRecord(recordType,tenant?.id,{...draft,title:draft.title||draft.titleEn,titleEn:draft.titleEn||draft.title,reportedByLabel:actor.name,history:[auditEvent('recordCreated',{actor})]},user?.id);if(recordType==='capas')signalDemoScenario('incident_capa');if(recordType==='audits')signalDemoStep('quality_audit','create');notify(t('recordCreated'),'success')
  goBack()}catch(error){console.error(error);notify(en?'The quality record could not be saved.':'Δεν ήταν δυνατή η αποθήκευση της εγγραφής ποιότητας.','error')}finally{setSaving(false)}}
  if(!canManage)return <Navigate to="/quality" replace/>
  const sourceText={emptyLabel:en?'No match':'Δεν βρέθηκε',clearLabel:en?'Clear':'Καθαρισμός'}
  const steps=draft.subActions?.length>0&&recordType==='capas'&&<FormCard wide icon={ListChecks} title={String(draft.sourceId||'').startsWith('TRAINING:')?(en?'Suggested steps':'Προτεινόμενα βήματα'):en?'Steps from the control’s actions on deviation':'Βήματα από τις ενέργειες σε απόκλιση του ελέγχου'} hint={en?'Assign owners and due dates in the Steps tab after saving.':'Υπεύθυνους και προθεσμίες ορίζετε στην καρτέλα «Βήματα» μετά την αποθήκευση.'}><ol className="quality-prefill-steps">{draft.subActions.map(step=><li key={step.id}>{step.title}</li>)}</ol></FormCard>
  return <Page fill><EntityRecordShell className="quality-record-shell workspace-fill" avatar={<Icon size={19}/>} eyebrow={t('quality')} title={t(c.title)} subtitle={t('qualityRecords.newQualityRecord')} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={goBack}>
    <div className="record-section quality-create-form"><div className="lo-form-cards">
      <FormCard title={en?'Record':'Εγγραφή'} icon={Icon}>
        <Field label={`${t('title')} *`}><input value={draft[titleKey]} onChange={e=>set(titleKey,e.target.value)}/></Field>
        <QualityDepartmentField value={departmentRef(draft)} onChange={patch}/>
        {recordType==='findings'&&<ChoiceField label={t('severity')} value={draft.severity} options={severityOptions(t)} onChange={v=>set('severity',v)}/>}
        {recordType==='capas'&&<><ChoiceField label={t('actionType')} value={draft.actionType} options={vocabularyOptions(CAPA_TYPES,language)} onChange={v=>set('actionType',v)}/><ChoiceField label={t('priority')} value={draft.priority} options={severityOptions(t)} onChange={v=>set('priority',v)}/></>}
        {recordType==='audits'&&<ChoiceField label={t('auditType')} value={draft.auditType} options={vocabularyOptions(AUDIT_TYPES,language)} onChange={v=>set('auditType',v)}/>}
      </FormCard>
      <FormCard title={recordType==='audits'?(en?'Planning':'Προγραμματισμός'):(en?'Responsibility':'Ευθύνη')} icon={UserCheck}>
        {recordType==='audits'?<><QualityPersonField label={t('leadAuditor')} name={draft.leadAuditor} department={draft.department} onChange={({name,userId})=>patch({leadAuditor:name,leadAuditorId:userId})}/><ManualDateField label={t('plannedDate')} value={draft.plannedDate} onChange={v=>set('plannedDate',v)}/></>:<QualityOwnerField record={draft} onChange={patch}/>}
        {recordType==='findings'&&<FormGrid columns={2}><SearchableSelect label={t('source')} value={draft.source} options={vocabularyOptions(FINDING_SOURCES,language)} onChange={v=>set('source',v||'manual')} {...sourceText} clearLabel=""/><Field label={t('qualityRecords.sourceId')}><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)} placeholder={en?'e.g. AUD-2608-003':'π.χ. AUD-2608-003'}/></Field></FormGrid>}
        {recordType==='capas'&&<FormGrid columns={2}><ManualDateField label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)}/><Field label={t('qualityRecords.sourceId')}><input value={draft.sourceId} onChange={e=>set('sourceId',e.target.value)}/></Field></FormGrid>}
      </FormCard>
      <FormCard wide title={t(recordType==='audits'?'qualityRecords.auditScope':'description')}>
        <Field label={t(recordType==='audits'?'qualityRecords.auditScope':'description')}><textarea rows={3} value={draft[textKey]} onChange={e=>set(textKey,e.target.value)}/></Field>
      </FormCard>
      {steps}
      {recordType==='audits'&&<AuditChecklistSource draft={draft} setDraft={setDraft} organizationId={tenant?.id} language={language}/>}
    </div><div className="inline-edit-footer"><Button variant="secondary" onClick={goBack}>{t('cancel')}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{t('save')}</SaveButton></div></div>
  </EntityRecordShell></Page>
}
