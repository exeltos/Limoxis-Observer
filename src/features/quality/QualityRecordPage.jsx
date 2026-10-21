import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RouteLoading } from '../../design-system/RouteLoading'
import { AlertOctagon, AlertTriangle, CheckSquare2, Scale, ChevronRight, ClipboardCheck, FileClock, Link2, ListChecks, Paperclip, Pencil, RotateCcw, ShieldCheck, Trash2, GitBranch, TrendingUp } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { ExportMenu } from '../../design-system/ExportMenu'
import { printReport } from '../../core/export/reportDocument'
import { QualityRecordDocument } from './QualityRecordDocument'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { can, CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Field } from '../../design-system/Field'
import { MoreSection } from '../../design-system/MoreSection'
import { ChoiceField } from '../../design-system/ChoiceField'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { TimeField } from '../../design-system/TimeField'
import { useLibraries } from '../management/useLibraries'
import { CAPA_TYPES, EFFECTIVENESS, IMPACTS, INCIDENT_CLASSES, REPORT_KINDS, harmLevel, incidentCategoryLabel, qualityCode, incidentCategoryOptions, qualityStatusTone, rcaDueDate, reportKindOf, severityOptions, vocabularyLabel, vocabularyOptions } from './qualityVocabulary'
import { YesNoField } from '../../design-system/YesNoField'
import { QualityDepartmentField, QualityOwnerField, departmentRef } from './QualityFields'
import { loadQualityRecord, loadQualityRecords, saveQualityRecord } from './qualityService'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth, auditEvent } from '../../core/audit/actor'
import { openCorrection, voidRecord as applyGovernedVoid } from '../../core/audit/governedLifecycle'
import { GovernedReasonDialog } from '../../design-system/GovernedReasonDialog'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { QualityCapaSteps } from './QualityCapaSteps'
import { IncidentFlowPanel } from './IncidentFlowBar'
import { QualityGlance } from './QualityGlance'
import { AuditRunTab } from './audits/AuditRunTab'
import { AuditPlanPanel } from './audits/AuditPlanPanel'
import { auditAnswersExport, auditReportDocument } from './audits/auditReport'
import { FINDING_CLASSES, standardLabel } from './audits/auditStandards'
import { exportRegistry } from '../../core/export/registryExports'
import { auditCompliance } from './qualityAudit'
import { QualityCapaRootCause } from './QualityCapaRootCause'
import { QualityCapaProgress } from './QualityCapaProgress'
import { IncidentEventFields, IncidentEventSummary, IncidentEventTypeField } from './IncidentEventDetails'
import { analysisProgress } from './rootCauseAnalysis'
import { capaSourceFor,sourcePath,subActionProgress } from './qualityDeviations'
import { incidentFlow,isFinalizedQualityRecord,openStepsBlockingCapa,recordOwners,statusOptions,withHarm,withIncidentClass } from './qualityRecordRules'
import './quality.css'

const iconMap={incidents:AlertTriangle,findings:ShieldCheck,capas:CheckSquare2,audits:ClipboardCheck}

const RECORD_KIND={incidents:['Συμβάν','Incident'],findings:['Εύρημα','Finding'],capas:['Διορθωτική ενέργεια','CAPA'],audits:['Επιθεώρηση','Audit']}

export function QualityRecordPage(){
  const {recordType,recordId}=useParams()
  const recordNavigation=useRecordSequenceNavigation({registry:`quality.${recordType}`,currentId:recordId,pathForId:id=>`/quality/${recordType}/${id}`})
  const {restored,goBack,goTo}=useContextualNavigation('/quality')
  const {t,language,locale}=useLanguage()
  const {role,membership,tenant,canAccessRecord,actualRole,isRolePreview}=useTenant()
  const {notify}=useFeedback()
  const {profile,user}=useAuth()
  const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
  const organizationId=tenant?.id
  const [record,setRecord]=useState(null)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState(()=>restored?.tab||'details')
  // A tab opened by the flow's next step can open straight in edit mode.
  const [autoEdit,setAutoEdit]=useState(false)
  const openTab=(id,edit=false)=>{setAutoEdit(edit);setTab(id)}
  // «Download» is the record as a PDF document (QualityRecordDocument, off screen).
  const documentRef=useRef(null)
  // Printed on the shared document layout (hospital band, page X / Y, DEMO mark): real text, not a picture.
  function downloadPdf(pdf){
    if(!documentRef.current)return
    const en=language==='en'
    const ok=printReport({language,kind:{incidents:en?'Incident':'Συμβάν',findings:en?'Finding':'Εύρημα',capas:en?'Corrective action':'Διορθωτική ενέργεια',audits:en?'Audit':'Επιθεώρηση'}[recordType],code:record.displayId||record.id,title:en?(record.titleEn||record.title):record.title,
     body:`<div class="rd-html">${documentRef.current.innerHTML}</div>`,signatures:[en?'Prepared by':'Συντάχθηκε',en?'Approved by':'Εγκρίθηκε'],filename:record.displayId||record.id}, { pdf: pdf === true })
    if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
  }
  function printAudit(pdf){
    if(!printReport(auditReportDocument(record,linked,{language}),{pdf}))notify(language==='en'?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
  }
  const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[]
  // The Platform Owner has full access here, as on the other Quality pages.
  const ownerFullAccess=!isRolePreview&&actualRole===ROLES.PLATFORM_OWNER
  const canManage=ownerFullAccess||can(role,CAPABILITIES.MANAGE_QUALITY,addOns,custom)
  const canAttach=ownerFullAccess||can(role,CAPABILITIES.ATTACH_FILES,addOns,custom)
  const canPrint=ownerFullAccess||can(role,CAPABILITIES.PRINT_RECORDS,addOns,custom)
  // The record on hand belongs to loadedFor: moving to the next record never shows one frame of the previous one.
  const recordKey=`${recordType}:${recordId}`
  const [loadedFor,setLoadedFor]=useState('')
  useEffect(()=>{let active=true;setLoading(true);loadQualityRecord(recordType,organizationId,recordId).then(data=>{if(active)setRecord(data)}).catch(()=>{if(active)setRecord(null)}).finally(()=>{if(active){setLoadedFor(`${recordType}:${recordId}`);setLoading(false)}});return()=>{active=false}},[recordType,recordId,organizationId])
  // What follows the record: an incident's or a finding's CAPAs, an audit's
  // findings. The incident flow and the «at a glance» figures read them.
  const [linked,setLinked]=useState([])
  const linkedSection=recordType==='audits'?'findings':['incidents','findings'].includes(recordType)?'capas':null
  // Reloads when the record changes too: an audit that just created its findings lists them.
  useEffect(()=>{let active=true;if(!linkedSection||!record?.id){setLinked([]);return()=>{active=false}};loadQualityRecords(linkedSection,organizationId).then(rows=>{if(active)setLinked(rows.filter(x=>x.sourceId===record.id))}).catch(()=>{if(active)setLinked([])});return()=>{active=false}},[linkedSection,record?.id,record?.updatedAt,record?.history?.length,organizationId])
  const linkedCapas=recordType==='incidents'?linked:[]
  const finalized=isFinalizedQualityRecord(record)
  const recordInScope=!record||canAccessRecord({...record,department:record.department})
  if(loading||loadedFor!==recordKey)return <RouteLoading/>
  if(!record)return <Page title={t('quality')}><div className="inline-empty">{t('noData')}</div></Page>
  if(!recordInScope)return <Page title={t('quality')}><div className="inline-empty">{language==='en'?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>
  const Icon=iconMap[recordType]||ShieldCheck
  const title=language==='el'?record.title:record.titleEn
  const steps=subActionProgress(record.subActions||[])
  const incident=recordType==='incidents'
  const audit=recordType==='audits'
  const auditScore=audit?auditCompliance(record):null
  const tabs=[{id:'details',label:t('details'),icon:Icon},...(audit?[{id:'checklist',label:`${language==='en'?'Questionnaire':'Ερωτηματολόγιο'}${record.checklist?.length?` ${auditScore.rate!=null?`${auditScore.rate}%`:`0/${record.checklist.length}`}`:''}`,icon:ListChecks}]:[]),...(incident?[{id:'assessment',label:language==='en'?`Assessment${record.sentinel?' ⚠':''}`:`Αξιολόγηση${record.sentinel?' ⚠':''}`,icon:Scale,sheet:true}]:[]),...(recordType==='capas'?[{id:'steps',label:language==='en'?`Steps${steps.total?` ${steps.done}/${steps.total}`:''}`:`Βήματα${steps.total?` ${steps.done}/${steps.total}`:''}`,icon:ListChecks},{id:'rootCause',label:language==='en'?`Root causes${analysisProgress(record.rootCauseAnalysis).concluded?' ✓':''}`:`Αιτίες${analysisProgress(record.rootCauseAnalysis).concluded?' ✓':''}`,icon:GitBranch},{id:'progress',label:language==='en'?`Progress${record.progress?.length?` ${record.progress.length}`:''}`:`Πρόοδος${record.progress?.length?` ${record.progress.length}`:''}`,icon:TrendingUp}]:[]),{id:'links',label:incident?(language==='en'?`Corrective actions${linkedCapas.length?` ${linkedCapas.length}`:''}`:`Διορθωτικές ενέργειες${linkedCapas.length?` ${linkedCapas.length}`:''}`):t('qualityRecords.linkedRecords'),icon:incident?CheckSquare2:Link2},{id:'documents',label:t('documents'),icon:Paperclip},{id:'history',label:t('history'),icon:FileClock}]
  return <Page fill><EntityRecordShell
    className="quality-record-shell workspace-fill"
    avatar={<Icon size={19}/>}
    eyebrow={qualityCode(record,language)}
    title={title}
    subtitle={[RECORD_KIND[recordType]?.[language==='en'?1:0],language==='en'?record.departmentEn||record.department:record.department].filter(Boolean).join(' · ')||undefined}
    status={<StatusBadge tone={qualityStatusTone(record.status)}>{t(record.status)}</StatusBadge>}
    recordNavigation={recordNavigation}
    headerActions={canPrint&&(audit
      // The audit report on the shared layout, and its answers as Excel.
      ?<ExportMenu onPrint={()=>printAudit(false)} onPdf={()=>printAudit(true)} onExcel={record.checklist?.length?()=>exportRegistry(auditAnswersExport(record,language)):undefined}/>
      :<ExportMenu onPrint={()=>downloadPdf(false)} onPdf={()=>downloadPdf(true)} />)}
    tabs={tabs} activeTab={tab} onTabChange={id=>openTab(id)}>
      {incident&&(tab==='details'||tab==='assessment')?<div className="quality-record-layout">
        <QualityDetails key={`${tab}:${autoEdit}`} autoEdit={autoEdit} view={tab} recordType={recordType} record={record} linked={linked} setRecord={setRecord} t={t} language={language} canManage={canManage} notify={notify} actor={actor} finalized={finalized} onDeleted={goBack} organizationId={organizationId}/>
        <IncidentFlowPanel steps={incidentFlow(record,linkedCapas)} record={record} capas={linkedCapas} language={language} t={t} activeTab={tab} canAct={canManage&&!finalized}
          onSelect={id=>openTab(id)} onOpenCapa={capa=>goTo(`/quality/capas/${capa.id}`,{returnTo:`/quality/incidents/${record.id}`,returnTab:tab})}
          onStep={next=>{if(next.id==='assess'||next.id==='close')openTab('assessment',true);else if(next.id==='capa')goTo('/quality/capas/new',{returnTo:`/quality/incidents/${record.id}`,returnTab:'details',state:{qualitySource:capaSourceFor('incidents',record,language)}});else if(next.capa)goTo(`/quality/capas/${next.capa.id}`,{returnTo:`/quality/incidents/${record.id}`,returnTab:'details'})}}/>
      </div>:(tab==='details'||tab==='assessment')&&<QualityDetails key={tab} view={tab} recordType={recordType} record={record} linked={linked} setRecord={setRecord} t={t} language={language} canManage={canManage} notify={notify} actor={actor} finalized={finalized} onDeleted={goBack} organizationId={organizationId}/>}
      {tab==='rootCause'&&recordType==='capas'&&<QualityCapaRootCause record={record} setRecord={setRecord} canManage={canManage} finalized={finalized} organizationId={organizationId} actor={actor} notify={notify} language={language} locale={locale}/>}
      {tab==='steps'&&recordType==='capas'&&<QualityCapaSteps record={record} setRecord={setRecord} canManage={canManage} finalized={finalized} organizationId={organizationId} actor={actor} notify={notify} language={language} locale={locale}/>}
      {tab==='progress'&&recordType==='capas'&&<QualityCapaProgress record={record} setRecord={setRecord} canManage={canManage} finalized={finalized} organizationId={organizationId} actor={actor} notify={notify} language={language}/>}
      {tab==='details'&&audit&&<div className="record-section"><AuditPlanPanel record={record} setRecord={setRecord} organizationId={organizationId} canManage={canManage} finalized={finalized} language={language} notify={notify} actor={actor}/></div>}
      {tab==='checklist'&&audit&&<AuditRunTab record={record} setRecord={setRecord} organizationId={organizationId} canManage={canManage} finalized={finalized} language={language} actor={actor} notify={notify} userId={profile?.id||user?.id}/>}
      {tab==='links'&&<QualityLinks recordType={recordType} record={record} t={t} language={language} organizationId={organizationId} canManage={canManage} finalized={finalized}/>}
      {tab==='documents'&&<QualityDocuments recordType={recordType} record={record} setRecord={setRecord} t={t} finalized={finalized} canAttach={canAttach} canManage={canManage} organizationId={organizationId}/>}
      {tab==='history'&&<QualityHistory record={record} t={t} language={language}/>}
  </EntityRecordShell>
  {canPrint&&<QualityRecordDocument recordType={recordType} record={record} linked={linked} language={language} t={t} documentRef={documentRef}/>}
  </Page>
}

function QualityDetails({autoEdit=false,view='details',recordType,record,linked=[],setRecord,t,language,canManage,notify,actor,finalized,onDeleted,organizationId}){
  const en=language==='en'
  const assessment=view==='assessment'
  const [editing,setEditing]=useState(()=>autoEdit&&canManage&&!finalized)
  const [draft,setDraft]=useState({...record})
  const [governedAction,setGovernedAction]=useState(null)
  const [correctionReason,setCorrectionReason]=useState('')
  const [saving,setSaving]=useState(false)
  const {libraries}=useLibraries()
  const categories=libraries.incidentCategories||[]
  // The English text follows the written one while it is only its fallback copy.
  const set=(k,v)=>setDraft(x=>({...x,[k]:v,...((k==='title'||k==='description')&&x[`${k}En`]===x[k]?{[`${k}En`]:v}:{})}))
  const patch=next=>setDraft(x=>({...x,...next}))

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
    const openSteps=openStepsBlockingCapa(recordType,draft,record)
    if(openSteps>0){
      notify(en?`${openSteps} step(s) are still open. Complete them in the Steps tab before moving the CAPA to verification or closing it.`:`Υπάρχουν ${openSteps} ανοιχτά βήματα. Ολοκληρώστε τα στην καρτέλα «Βήματα» πριν η διορθωτική ενέργεια περάσει σε επαλήθευση ή κλείσει.`,'error')
      return
    }
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
  // «⋯»: the record as a PDF for anyone who may print; editing and voiding for Quality.
  const actionItems=editing?[]:[
    canManage&&{id:'edit',label:finalized?(en?'Correct record':'Διόρθωση εγγραφής'):t('edit'),icon:finalized?RotateCcw:Pencil,onClick:beginEdit},
    canManage&&{id:'void',label:en?'Void record':'Ακύρωση εγγραφής',icon:Trash2,tone:'danger',separatorBefore:true,onClick:requestVoid},
  ].filter(Boolean)
  return <div className={`record-section quality-record-details ${editing?'is-editing':'is-viewing'}`}>
    <div className="record-section-header"><h3>{assessment?(en?'Assessment':'Αξιολόγηση'):t('details')}</h3>{actionItems.length>0&&<OverflowMenu items={actionItems}/>}</div>
    {!assessment&&!editing&&<QualityGlance recordType={recordType} record={record} language={language} t={t} linked={linked}/>}
    <div className={`detail-grid quality-detail-grid ${editing?'employee-inline-edit':''}`}>
      {assessment?<>
        <EditChoice editing={editing} label={t('status')} value={draft.status} onChange={v=>set('status',v)} options={statusOptions(recordType).map(value=>({value,label:t(value)}))}/>
        <EditChoice editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={severityOptions(t)}/>
        {draft.incidentClass==='harmful'?<EditChoice editing={editing} label={en?'Harm to the patient (WHO)':'Βλάβη στον ασθενή (WHO)'} value={harmLevel(draft.impact)} onChange={v=>setDraft(x=>withHarm(x,v))} options={vocabularyOptions(IMPACTS.filter(item=>item.value!=='none'),language)}/>:<Detail label={en?'Harm to the patient (WHO)':'Βλάβη στον ασθενή (WHO)'} value={vocabularyLabel(IMPACTS,'none',language)}/>}
        {editing?<div className="detail-item editable"><YesNoField label={en?'Sentinel event':'Σοβαρό ανεπιθύμητο (sentinel)'} value={Boolean(draft.sentinel)} onChange={v=>setDraft(x=>({...x,sentinel:v,rcaDueDate:v?(x.rcaDueDate||rcaDueDate(x.date)):''}))}/></div>:<Detail label={en?'Sentinel event':'Σοβαρό ανεπιθύμητο (sentinel)'} value={draft.sentinel?(en?'Yes':'Ναι'):(en?'No':'Όχι')}/>}
        {draft.sentinel&&<EditDate editing={editing} label={en?'Root cause analysis due':'Προθεσμία ανάλυσης ριζικής αιτίας'} value={draft.rcaDueDate} onChange={v=>set('rcaDueDate',v)} language={language}/>}
      </>:<>
      {/* Code, title and status are in the record's header; the form edits them. */}
      {editing&&<EditText editing={editing} label={t('title')} value={language==='el'?draft.title:draft.titleEn} onChange={v=>set(language==='el'?'title':'titleEn',v)}/>}
      {editing&&language==='el'&&<MoreSection className="quality-english-more" moreLabel="Αγγλική μετάφραση" lessLabel="Λιγότερα">
        <Field label="Τίτλος (αγγλικά)"><input value={draft.titleEn===draft.title?'':(draft.titleEn||'')} onChange={e=>set('titleEn',e.target.value)}/></Field>
        {recordType!=='audits'&&<Field label="Περιγραφή (αγγλικά)"><textarea rows={3} value={draft.descriptionEn===draft.description?'':(draft.descriptionEn||'')} onChange={e=>set('descriptionEn',e.target.value)}/></Field>}
      </MoreSection>}
      {editing?<div className="detail-item editable"><QualityDepartmentField value={departmentRef(draft)} onChange={patch}/></div>:<Detail label={t('department')} value={en?draft.departmentEn||draft.department:draft.department}/>}
      {recordType!=='incidents'&&editing&&<EditChoice editing={editing} label={t('status')} value={draft.status} onChange={v=>set('status',v)} options={statusOptions(recordType).map(value=>({value,label:t(value)}))}/>}
      {recordType==='incidents'&&<>
        <EditChoice editing={editing} label={en?'Kind':'Είδος'} value={reportKindOf(draft)} onChange={v=>set('reportKind',v)} options={vocabularyOptions(REPORT_KINDS,language)}/>
        {editing&&['clinical','nonClinical'].includes(reportKindOf(draft))&&<EditChoice editing={editing} label={en?'Reached the patient':'Έφτασε στον ασθενή'} value={draft.incidentClass||'nearMiss'} onChange={v=>setDraft(x=>withIncidentClass(x,v))} options={vocabularyOptions(INCIDENT_CLASSES,language)}/>}
        <EditChoice editing={editing} label={en?'Category':'Κατηγορία συμβάντος'} value={draft.category||'clinical'} onChange={v=>set('category',v)} options={incidentCategoryOptions(categories,language,reportKindOf(draft)==='suggestion'?null:reportKindOf(draft))} display={incidentCategoryLabel(draft.category||'clinical',categories,language)}/>
        <Detail label={t('qualityRecords.reportedBy')} value={draft.anonymous?(en?'Anonymous report':'Ανώνυμη αναφορά'):draft.reportedBy}/>
        <EditOwners editing={editing} draft={draft} patch={patch} en={en}/>
        <Detail label={t('date')} value={formatDay(draft.date,language)}/>
        {editing?<div className="detail-item editable"><TimeField label={en?'Time':'Ώρα'} value={draft.eventTime||''} onChange={v=>set('eventTime',v)}/></div>:<Detail label={en?'Time':'Ώρα'} value={draft.eventTime}/>}
      </>}
      </>}
      {!assessment&&recordType==='findings'&&<>
        {editing&&<EditChoice editing={editing} label={t('severity')} value={draft.severity} onChange={v=>set('severity',v)} options={severityOptions(t)}/>}
        <EditOwners editing={editing} draft={draft} patch={patch} en={en} label={t('owner')}/>
        <Detail label={t('date')} value={formatDay(draft.date,language)}/>
        {(draft.source==='audit'||draft.findingClass)&&<>
          <EditChoice editing={editing} label={en?'Audit finding class':'Κατάταξη ευρήματος'} value={draft.findingClass||''} onChange={v=>set('findingClass',v)} options={vocabularyOptions(FINDING_CLASSES,language)}/>
          {draft.clauseRef&&<Detail label={en?'Standard / clause':'Πρότυπο / άρθρο'} value={[standardLabel(draft.standard,language),draft.clauseRef].filter(Boolean).join(' · ')}/>}
          <EditDate editing={editing} label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)} language={language}/>
          <EditChoice editing={editing} label={en?'Effectiveness verified':'Επαλήθευση αποτελεσματικότητας'} value={draft.verificationStatus||'pending'} onChange={v=>set('verificationStatus',v)} options={[{value:'pending',label:en?'Pending':'Εκκρεμεί'},{value:'effective',label:en?'Effective':'Αποτελεσματική'},{value:'not_effective',label:en?'Not effective':'Μη αποτελεσματική'}]}/>
          {(editing||draft.verifiedOn)&&<EditDate editing={editing} label={en?'Verified on':'Επαληθεύτηκε στις'} value={draft.verifiedOn} onChange={v=>set('verifiedOn',v)} language={language}/>}
          {(editing||draft.verifiedBy)&&<EditText editing={editing} label={en?'Verified by':'Επαλήθευσε'} value={draft.verifiedBy} onChange={v=>set('verifiedBy',v)}/>}
          {(editing||draft.verificationNote)&&<EditText editing={editing} label={en?'Verification evidence':'Τεκμήρια επαλήθευσης'} value={draft.verificationNote} onChange={v=>set('verificationNote',v)}/>}
          <EditText editing={editing} label={en?'Follow-up audit (code)':'Επαναληπτική επιθεώρηση (κωδικός)'} value={draft.followUpAuditId} onChange={v=>set('followUpAuditId',v.trim())}/>
        </>}
      </>}
      {!assessment&&recordType==='capas'&&<>
        <EditChoice editing={editing} label={t('actionType')} value={draft.actionType} onChange={v=>set('actionType',v)} options={vocabularyOptions(CAPA_TYPES,language)}/>
        <EditChoice editing={editing} label={t('priority')} value={draft.priority} onChange={v=>set('priority',v)} options={severityOptions(t)}/>
        <EditOwners editing={editing} draft={draft} patch={patch} en={en} label={t('owner')}/>
        {editing&&<EditDate editing={editing} label={t('dueDate')} value={draft.dueDate} onChange={v=>set('dueDate',v)} language={language}/>}
        {editing&&<EditDate editing={editing} label={t('qualityRecords.effectivenessDue')} value={draft.effectivenessDue} onChange={v=>set('effectivenessDue',v)} language={language}/>}
        {editing&&<EditChoice editing={editing} label={t('qualityRecords.effectiveness')} value={draft.effectivenessStatus} onChange={v=>set('effectivenessStatus',v)} options={vocabularyOptions(EFFECTIVENESS,language)}/>}
      </>}
      {/* An audit's kind, date, standard and team are its planning (AuditPlanPanel, below). */}
      {!assessment&&recordType==='audits'&&!editing&&<Detail label={t('leadAuditor')} value={draft.leadAuditor}/>}
    </div>
    {!assessment&&recordType==='incidents'&&['clinical','nonClinical'].includes(reportKindOf(draft))&&(editing||draft.eventType)&&<div className="quality-event-section">
      <div className="quality-subsection-heading"><div><strong>{en?'Event details':'Στοιχεία συμβάντος'}</strong></div></div>
      {editing?<div className="detail-grid quality-detail-grid employee-inline-edit"><div className="detail-item editable"><IncidentEventTypeField value={draft.eventType} onChange={v=>set('eventType',v)} language={language}/></div></div>:null}
      {editing?<IncidentEventFields record={draft} onChange={setDraft} language={language}/>:<IncidentEventSummary record={draft} language={language}/>}
    </div>}
    {!assessment&&<div className={recordType==='incidents'?'quality-incident-narrative':'quality-record-narrative'}><div className="quality-description"><span>{t(recordType==='audits'?'qualityRecords.auditScope':'description')}</span>{editing?<textarea rows={3} value={language==='el'?(draft.description??draft.scope??''):(draft.descriptionEn??draft.scopeEn??'')} onChange={e=>set(language==='el'?(recordType==='audits'?'scope':'description'):(recordType==='audits'?'scopeEn':'descriptionEn'),e.target.value)}/>:<p>{language==='el'?(record.description??record.scope??'—'):(record.descriptionEn??record.scopeEn??'—')}</p>}</div>{recordType==='incidents'&&<div className="quality-description quality-readonly-text"><span>{en?'Immediate actions taken':'Άμεσες ενέργειες που πραγματοποιήθηκαν'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.immediateActions||''):(draft.immediateActionsEn||'')} onChange={e=>set(language==='el'?'immediateActions':'immediateActionsEn',e.target.value)}/>:<p>{language==='el'?(record.immediateActions||'—'):(record.immediateActionsEn||record.immediateActions||'—')}</p>}</div>}</div>}{assessment&&<div className="quality-investigation-card">{draft.sentinel&&<div className="governance-banner warning quality-sentinel-banner"><AlertOctagon size={17}/><span>{en?`Sentinel event: a root cause analysis is required${draft.rcaDueDate?` by ${formatDay(draft.rcaDueDate,language)}`:''}. Open it as a CAPA in «Corrective actions» (5 Whys and Ishikawa are in the CAPA's «Root causes» tab).`:`Σοβαρό ανεπιθύμητο (sentinel): απαιτείται ανάλυση ριζικής αιτίας${draft.rcaDueDate?` έως ${formatDay(draft.rcaDueDate,language)}`:''}. Ανοίξτε την ως διορθωτική ενέργεια στην καρτέλα «Διορθωτικές ενέργειες» (5 Γιατί και Ishikawa στην καρτέλα «Αιτίες» της).`}</span></div>}<div className="quality-subsection-heading"><div><strong>{en?'Investigation & root cause':'Διερεύνηση & βασική αιτία'}</strong><span>{en?'Document the analysis before closing the incident.':'Καταγραφή της ανάλυσης πριν από την ολοκλήρωση του συμβάντος.'}</span></div></div><div className="quality-investigation-grid"><div className="quality-description quality-readonly-text"><span>{en?'Root cause':'Βασική αιτία (Root Cause)'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.rootCause||''):(draft.rootCauseEn||'')} onChange={e=>set(language==='el'?'rootCause':'rootCauseEn',e.target.value)}/>:<p>{language==='el'?(record.rootCause||'—'):(record.rootCauseEn||record.rootCause||'—')}</p>}</div><div className="quality-description quality-readonly-text"><span>{en?'Contributing factors':'Συνεισφέροντες παράγοντες'}</span>{editing?<textarea rows={2} value={language==='el'?(draft.contributingFactors||''):(draft.contributingFactorsEn||'')} onChange={e=>set(language==='el'?'contributingFactors':'contributingFactorsEn',e.target.value)}/>:<p>{language==='el'?(record.contributingFactors||'—'):(record.contributingFactorsEn||record.contributingFactors||'—')}</p>}</div></div></div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" disabled={saving} onClick={()=>{setDraft({...record});setEditing(false);setCorrectionReason('')}}>{t('cancel')}</Button><SaveButton loading={saving} onClick={save}>{t('save')}</SaveButton></div>}
    <GovernedReasonDialog open={Boolean(governedAction)} title={governedAction==='correct'?(en?'Correct finalized record':'Διόρθωση ολοκληρωμένης εγγραφής'):(en?'Void record':'Ακύρωση εγγραφής')} description={governedAction==='correct'?(en?'The original record remains in history. Enter the reason for the correction.':'Η αρχική εγγραφή παραμένει στο ιστορικό. Καταγράψτε τον λόγο της διόρθωσης.'):(en?'The record will not be physically deleted. It will be marked as voided and retained in the audit trail.':'Η εγγραφή δεν θα διαγραφεί φυσικά. Θα χαρακτηριστεί ως ακυρωμένη και θα παραμείνει στο audit trail.')} confirmLabel={governedAction==='correct'?(en?'Start correction':'Έναρξη διόρθωσης'):(en?'Void record':'Ακύρωση εγγραφής')} danger={governedAction==='void'} onCancel={()=>setGovernedAction(null)} onConfirm={governedConfirm}/>
  </div>
}

function QualityLinks({recordType,record,t,language,organizationId,canManage=false,finalized=false}){
  const {goTo}=useContextualNavigation('/quality')
  const [related,setRelated]=useState([])
  const [sourceRecord,setSourceRecord]=useState(null)
  useEffect(()=>{
    let active=true
    if(recordType==='incidents'||recordType==='findings'){
      loadQualityRecords('capas',organizationId).then(rows=>{if(active)setRelated(rows.filter(x=>x.sourceId===record.id).map(x=>({...x,kind:'capas'})))}).catch(()=>{if(active)setRelated([])})
    }else if(recordType==='audits'){
      loadQualityRecords('findings',organizationId).then(rows=>{if(active)setRelated(rows.filter(x=>x.sourceId===record.id).map(x=>({...x,kind:'findings'})))}).catch(()=>{if(active)setRelated([])})
    }else{
      setRelated([])
    }
    return()=>{active=false}
  },[recordType,record.id,organizationId])
  useEffect(()=>{
    let active=true
    setSourceRecord(null)
    if(!record.sourceId)return()=>{active=false}
    const section=record.sourceId.startsWith('INC-')?'incidents':record.sourceId.startsWith('FND-')?'findings':record.sourceId.startsWith('AUD-')?'audits':null
    if(section)loadQualityRecords(section,organizationId).then(rows=>{if(active)setSourceRecord(rows.find(x=>x.id===record.sourceId)||null)}).catch(()=>{if(active)setSourceRecord(null)})
    return()=>{active=false}
  },[record.sourceId,organizationId])
  const sourceLabel=record.sourceId?.startsWith('INC-')?t('incident'):record.sourceId?.startsWith('FND-')?t('qualityRecords.finding'):record.sourceId?.startsWith('AUD-')?t('audit'):t('source')
  const links=[]
  // A production link holds the patient's record id, which has no page of its own (the patient page opens by code).
  if(record.linkedPatient&&!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(record.linkedPatient))links.push({label:t('patient'),id:record.linkedPatient,path:`/patients/${record.linkedPatient}`})
  if(record.linkedSurveillance)links.push({label:t('surveillance'),id:record.linkedSurveillance,path:`/surveillance/${record.linkedSurveillance}`})
  if(record.sourceId&&sourcePath(record.sourceId))links.push({label:record.sourceId.startsWith('BND-')?'Bundle':record.sourceId.startsWith('TRAINING:')?(language==='en'?'Training':'Εκπαίδευση'):record.sourceId.startsWith('RISK:')?(language==='en'?'Risk assessment':'Εκτίμηση κινδύνου'):(language==='en'?'Control':'Έλεγχος'),id:record.sourceId.startsWith('BND-')?(language==='en'?'Bundle assessment':'Αξιολόγηση bundle'):record.sourceId.startsWith('TRAINING:')?record.sourceId.slice(9):record.sourceId.startsWith('RISK:')?record.sourceId.split(':').slice(1).join(' · '):record.sourceId.split('#')[0],path:sourcePath(record.sourceId)})
  else if(record.sourceId)links.push({label:sourceLabel,id:record.sourceId,source:true,title:sourceRecord?(language==='el'?sourceRecord.title:sourceRecord.titleEn):''})
  if(record.findingIds?.length)record.findingIds.forEach(id=>links.push({label:t('qualityRecords.finding'),id,path:`/quality/findings/${id}`}))
  const navigationOptions={returnTo:`/quality/${recordType}/${record.id||record.code}`,returnTab:'links'}
  const openLinked=path=>goTo(path,navigationOptions)
  const openSource=id=>goTo(sourceRecordPath(id),navigationOptions)
  const en=language==='en'
  // From an incident or a finding Quality opens its CAPA here; a sentinel one is a root cause analysis.
  const canCreateCapa=canManage&&!finalized&&(recordType==='incidents'||recordType==='findings')
  const createCapa=()=>goTo('/quality/capas/new',{...navigationOptions,state:{qualitySource:capaSourceFor(recordType,record,language)}})
  return <div className="record-section"><div className="record-section-header"><h3>{recordType==='incidents'?(en?'Corrective actions & links':'Διορθωτικές ενέργειες & συνδέσεις'):t('qualityRecords.linkedRecords')}</h3>{canCreateCapa&&<Button variant="primary" onClick={createCapa}><CheckSquare2 size={15}/>{record.sentinel?(en?' Open root cause analysis':' Άνοιγμα ανάλυσης ριζικής αιτίας'):(en?' New CAPA':' Νέα διορθωτική ενέργεια')}</Button>}</div><div className="quality-link-list">
    {links.map(link=><button type="button" key={`${link.label}-${link.id}`} onClick={()=>link.source?openSource(link.id):openLinked(link.path)}><span className="quality-link-kind">{link.label}</span><span className="quality-link-main"><strong>{link.id}</strong>{link.title&&<small>{link.title}</small>}</span><ChevronRight size={16}/></button>)}
    {related.map(x=><button type="button" key={x.id} onClick={()=>goTo(`/quality/${x.kind}/${x.id}`,{returnTo:`/quality/${recordType}/${record.id||record.code}`,returnTab:'links'})}><span className="quality-link-kind">{t(x.kind==='findings'?'qualityRecords.finding':'qualityRecords.capa')}</span><span className="quality-link-main"><strong>{qualityCode(x,language)}</strong><small>{language==='el'?x.title:x.titleEn}</small></span><ChevronRight size={16}/></button>)}
    {!links.length&&!related.length&&<div className="inline-empty">{t('qualityRecords.noLinkedRecords')}</div>}
  </div></div>
}

function QualityDocuments({record,recordType,setRecord,t,finalized,canAttach,canManage,organizationId}){
  return <div className="record-section"><div className="record-section-header"><h3>{t('documents')}</h3></div><AttachmentField disabled={finalized||(!canAttach&&!canManage)} value={record.attachments||[]} onChange={attachments=>setRecord(r=>({...r,attachments}))} organizationId={organizationId} entityType={`quality_${recordType}`} entityId={record.dbId||record.id}/></div>
}

// Where a source code (AUD-, FND-, INC-) opens.
function sourceRecordPath(id){
  if(id.startsWith('AUD-'))return `/quality/audits/${id}`
  if(id.startsWith('FND-'))return `/quality/findings/${id}`
  if(id.startsWith('INC-'))return `/quality/incidents/${id}`
  return '/quality'
}
function QualityHistory({record,t,language}){const rows=useMemo(()=>[...(record.history||[])].sort((a,b)=>new Date(b.at)-new Date(a.at)),[record.history]);return <div className="record-section"><div className="record-section-header"><h3>{t('history')}</h3></div>{rows.length?<div className="lab-history-list">{rows.map((x,i)=><div className="lab-history-row" key={`${x.at}-${i}`}><time>{formatDateTime(x.at,language)}</time><strong>{t(x.action)}</strong><span>{x.actor||'—'}</span></div>)}</div>:<div className="inline-empty">{t('noData')}</div>}</div>}
function Detail({label,value}){return <div className="detail-item"><span className="lo-field-label">{label}</span><strong>{value||'—'}</strong></div>}
function EditText({editing,label,value,onChange}){return editing?<div className="detail-item editable"><Field label={label}><input value={value||''} onChange={e=>onChange(e.target.value)}/></Field></div>:<Detail label={label} value={value}/>}
function EditDate({editing,label,value,onChange,language}){return editing?<div className="detail-item editable"><ManualDateField label={label} value={value||''} onChange={onChange}/></div>:<Detail label={label} value={formatDay(value,language)}/>}
// Up to three answers: the mode switch; a longer list: a searchable list.
function EditChoice({editing,label,value,onChange,options,display}){
  if(!editing)return <Detail label={label} value={display||options.find(x=>x.value===value)?.label||value}/>
  return <div className="detail-item editable">{options.length<=3?<ChoiceField label={label} value={value} options={options} onChange={onChange}/>:<SearchableSelect label={label} value={value||''} options={options} onChange={v=>v&&onChange(v)} clearLabel=""/>}</div>
}
function EditOwners({editing,draft,patch,en,label}){const text=label||(en?'Responsible person(s)':'Υπεύθυνος / Υπεύθυνοι');return editing?<div className="detail-item editable quality-detail-owner"><QualityOwnerField record={draft} onChange={patch} label={text}/></div>:<Detail label={text} value={recordOwners(draft).join(', ')}/>}
