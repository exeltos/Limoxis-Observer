import { useEffect, useMemo, useState } from 'react'
import { Activity, BedDouble, CircleCheckBig, FileClock, ListTree, Microscope, RefreshCcw, UserRound } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { EmptyState } from '../../design-system/EmptyState'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { downloadRecordJson } from '../../core/export/recordExport'
import { loadPatients, loadAdmissions } from '../patients/patientsService'
import { loadDepartments } from '../management/departmentsService'
import { addClinicalReassessment, completeClinicalCase, createClinicalCase, loadClinicalCases, loadClinicalCasesForPatient, saveClinicalEvent } from './clinicalCloudService'

export function PatientClinicalCloudRecordPage({patientMode=false}){
  const {caseId,patientId}=useParams()
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {role,membership,tenant,canAccessRecord}=useTenant()
  const navigate=useNavigate()
  const {goBack}=useContextualNavigation(patientMode?'/patients':'/surveillance')
  const [patients,setPatients]=useState([])
  const [episodes,setEpisodes]=useState([])
  const [admissions,setAdmissions]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState('summary')
  const [selectedEpisodeId,setSelectedEpisodeId]=useState(caseId||'')
  const [createOpen,setCreateOpen]=useState(false)
  const has=cap=>can(role,cap,membership?.capabilities??[],membership?.customCapabilities??[])

  useEffect(()=>{
    let alive=true
    async function load(){
      setLoading(true);setError('')
      try{
        const roster=await loadPatients(tenant?.id,{isDemo:false})
        if(!alive)return
        setPatients(roster)
        if(patientMode){
          const patient=roster.find(item=>item.id===patientId)
          if(patient?.recordId){
            const [caseRows,admissionRows]=await Promise.all([
              loadClinicalCasesForPatient(tenant?.id,patient.recordId),
              loadAdmissions(patient.recordId),
            ])
            if(!alive)return
            setEpisodes(caseRows)
            setAdmissions(admissionRows)
            setSelectedEpisodeId(current=>current||caseRows[0]?.id||'')
          }else{
            setEpisodes([]);setAdmissions([])
          }
        }else{
          const caseRows=await loadClinicalCases(tenant?.id)
          if(!alive)return
          const selected=caseRows.find(item=>item.id===caseId)
          setEpisodes(selected?[selected]:[])
          if(selected?.patientRecordId){
            const admissionRows=await loadAdmissions(selected.patientRecordId)
            if(alive)setAdmissions(admissionRows)
          }
        }
      }catch(err){if(alive)setError(err?.message||t('actionFailed'))}
      finally{if(alive)setLoading(false)}
    }
    load()
    return ()=>{alive=false}
  },[tenant?.id,patientMode,patientId,caseId,t])

  const patient=useMemo(()=>{
    if(patientMode)return patients.find(item=>item.id===patientId)||null
    const episode=episodes[0]
    return episode?patients.find(item=>item.recordId===episode.patientRecordId)||null:null
  },[patients,patientMode,patientId,episodes])
  const record=episodes.find(item=>item.id===selectedEpisodeId)||episodes[0]||null
  const subject=record||patient
  const inScope=!subject||canAccessRecord(subject)
  const fmtDate=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'
  const fmtDateTime=value=>value?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—'

  async function reloadCases(preferredId=''){
    if(!patient?.recordId)return
    const rows=await loadClinicalCasesForPatient(tenant?.id,patient.recordId)
    setEpisodes(rows)
    setSelectedEpisodeId(preferredId||rows[0]?.id||'')
  }

  if(loading)return <Page title={t('clinicalRecords.patientRecord')}><div className="surface clinical-surface"><p>{t('loading')}</p></div></Page>
  if(error)return <Page title={t('clinicalRecords.patientRecord')}><EmptyState title={t('actionFailed')} description={error}/></Page>
  if(!patient&&!record)return <Page title={t('clinicalRecords.patientRecord')}><EmptyState title={t('noData')} description={t('clinicalRecords.noClinicalData')}/></Page>
  if(!inScope)return <Page title={t('clinicalRecords.patientRecord')}><EmptyState title={t('scopeAccessDeniedTitle')} description={t('scopeAccessDeniedDescription')}/></Page>

  const patientName=language==='el'?(patient?.name||record?.patient):(patient?.nameEn||record?.patientEn||patient?.name||record?.patient)
  const patientCode=patient?.id||record?.patientId
  const department=language==='el'?(record?.department||patient?.department):(record?.departmentEn||patient?.departmentEn||record?.department||patient?.department)
  const tabs=[
    {id:'summary',label:t('summary'),icon:UserRound},
    ...(patientMode?[{id:'admissions',label:t('clinicalRecords.admissions'),icon:BedDouble}]:[]),
    {id:'surveillance',label:t('surveillance'),icon:ListTree},
    ...(record?[{id:'clinical',label:t('clinicalRecords.clinicalData'),icon:Activity},{id:'history',label:t('history'),icon:FileClock}]:[]),
  ]
  const activeTab=tabs.some(item=>item.id===tab)?tab:'summary'

  return <Page fill title={patientName} subtitle={record?`${patientCode} · ${record.id}`:patientCode}>
    <EntityRecordShell
      className="patient-record-shell workspace-fill"
      avatar={patientName?.split(' ').map(x=>x?.[0]).slice(0,2).join('')}
      eyebrow={patientCode}
      title={patientName}
      subtitle={`${department||'—'} · ${t('clinicalRecords.admission')}: ${fmtDate(patient?.admissionDate||record?.admissionDate)}`}
      status={<span className={`status-badge ${(record?.status||patient?.status)==='active'?'active':''}`}>{t(record?.status||patient?.status||'active')}</span>}
      headerActions={<PrintExportActions onExport={()=>downloadRecordJson({patient,record,episodes,admissions},{filename:record?.id||patientCode})}/>}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setTab}
      onBack={goBack}
      backLabel={patientMode?t('clinicalRecords.backToPatients'):t('clinicalRecords.backToSurveillance')}
    >
      {activeTab==='summary'&&<CloudSummary patient={patient} record={record} t={t} language={language} fmtDate={fmtDate}/>} 
      {activeTab==='admissions'&&<CloudAdmissions rows={admissions} t={t} fmtDate={fmtDate}/>} 
      {activeTab==='surveillance'&&<CloudSurveillanceList episodes={episodes} selectedId={record?.id} onSelect={id=>{setSelectedEpisodeId(id);setTab('clinical')}} canCreate={patientMode&&has(CAPABILITIES.CREATE_SURVEILLANCE)} onCreate={()=>setCreateOpen(true)} t={t} fmtDate={fmtDate}/>} 
      {activeTab==='clinical'&&record&&<CloudClinicalJourney record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} canAssess={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)||has(CAPABILITIES.EDIT_SURVEILLANCE)} canReassess={has(CAPABILITIES.REASSESS_SURVEILLANCE)} canOutcome={has(CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME)||has(CAPABILITIES.CLOSE_SURVEILLANCE)} onSaved={()=>reloadCases(record.id)} tenantId={tenant?.id}/>} 
      {activeTab==='history'&&record&&<CloudTimeline record={record} t={t} fmtDateTime={fmtDateTime}/>} 
      {createOpen&&patient&&<CreateCloudSurveillance patient={patient} tenantId={tenant?.id} t={t} language={language} onClose={()=>setCreateOpen(false)} onCreated={async created=>{setCreateOpen(false);await reloadCases(created.id);setTab('clinical');notify(t('surveillanceCreated'),'success')}}/>}
    </EntityRecordShell>
  </Page>
}

function CloudSummary({patient,record,t,language,fmtDate}){
  const name=language==='el'?(patient?.name||record?.patient):(patient?.nameEn||record?.patientEn||patient?.name||record?.patient)
  return <div className="patient-summary-layout"><section className="clinical-panel full-panel"><div className="record-section-header"><div><span className="eyebrow">{t('clinicalRecords.patientRecord')}</span><h3>{t('clinicalRecords.patientDetails')}</h3></div></div><div className="detail-grid patient-detail-grid"><Detail label={t('patientId')} value={patient?.id||record?.patientId}/><Detail label={t('name')} value={name}/><Detail label={t('department')} value={record?.department||patient?.department}/><Detail label={t('admissionDate')} value={fmtDate(patient?.admissionDate||record?.admissionDate)}/><Detail label={t('status')} value={t(patient?.status||record?.status||'active')}/><Detail label={t('surveillance')} value={record?`${record.id} · ${t(record.status)}`:t('clinicalRecords.noActiveSurveillance')}/></div></section></div>
}
function CloudAdmissions({rows,t,fmtDate}){return <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('clinicalRecords.patientRecord')}</span><h3>{t('clinicalRecords.admissions')}</h3></div></div>{rows.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('admissionDate')}</th><th>{t('department')}</th><th>{t('clinicalRecords.dischargeDate')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{fmtDate(row.admissionDate)}</td><td>{row.department||'—'}</td><td>{fmtDate(row.dischargeDate)}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('clinicalRecords.noAdmissions')}</div>}</section>}
function CloudSurveillanceList({episodes,selectedId,onSelect,canCreate,onCreate,t,fmtDate}){return <section className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('surveillance')}</span><h3>{t('clinicalRecords.surveillanceEpisodes')}</h3></div>{canCreate&&<Button onClick={onCreate}>+ {t('newSurveillance')}</Button>}</div>{episodes.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>ID</th><th>{t('period')}</th><th>{t('status')}</th><th>{t('nextReview')}</th></tr></thead><tbody>{episodes.map(row=><tr key={row.id} className={row.id===selectedId?'is-selected':''} tabIndex={0} onClick={()=>onSelect(row.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(row.id)}}}><td><strong>{row.id}</strong></td><td>{fmtDate(row.startedAt)}{row.completedAt?` → ${fmtDate(row.completedAt)}`:''}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td><td>{fmtDate(row.reviewDue)}</td></tr>)}</tbody></table></div>:<EmptyState title={t('clinicalRecords.noActiveSurveillance')} description={t('clinicalRecords.noClinicalData')}/>}</section>}

function CloudClinicalJourney({record,t,language,fmtDate,fmtDateTime,canAssess,canReassess,canOutcome,onSaved,tenantId}){
  const {notify}=useFeedback()
  const [assessmentOpen,setAssessmentOpen]=useState(false)
  const [reviewOpen,setReviewOpen]=useState(false)
  const [outcomeOpen,setOutcomeOpen]=useState(false)
  return <div className="clinical-data-hub"><div className="clinical-data-heading"><span className="eyebrow">{t('surveillance')}</span><h3>{t('surveillanceJourney')}</h3></div><div className="clinical-data-grid">
    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('clinicalAssessment')}</strong><small>{record.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')}</small></div>{canAssess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setAssessmentOpen(true)}>{record.assessment?t('edit'):t('clinicalRecords.add')}</Button>}</div>{record.assessment?<p className="clinical-summary">{language==='el'?(record.assessment.summary||record.assessment.notes):(record.assessment.summaryEn||record.assessment.summary||record.assessment.notes)}</p>:<div className="inline-empty">{t('clinicalRecords.assessmentPending')}</div>}</section>
    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('samples')}</strong><small>{record.samples.length}</small></div></div>{record.samples.length?<div className="record-table-wrap"><table className="record-table"><tbody>{record.samples.map(sample=><tr key={sample.recordId||sample.id}><td><Microscope size={15}/></td><td><strong>{sample.id}</strong></td><td>{t(sample.type)}</td><td>{fmtDateTime(sample.collectedAt)}</td><td>{t(sample.status||sample.result)}</td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('clinicalRecords.noSamplesRecorded')}</div>}</section>
    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('reassessment')}</strong><small>{record.reassessments.length}</small></div>{canReassess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setReviewOpen(true)}>+ {t('reassessment')}</Button>}</div>{record.reassessments.length?record.reassessments.map(row=><article className="evidence-box" key={row.id}><strong>{fmtDate(row.date)} · {t(row.status)}</strong><span>{row.notes||row.decision||'—'}</span></article>):<div className="inline-empty">{t('clinicalRecords.noReassessmentRecorded')}</div>}</section>
    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('outcome')}</strong><small>{record.outcome?t(record.outcome.status):t('pending')}</small></div>{canOutcome&&record.status==='active'&&record.reassessments.length>0&&<Button onClick={()=>setOutcomeOpen(true)}>{t('clinicalRecords.completeSurveillance')}</Button>}</div>{record.outcome?<div className="evidence-box"><strong>{t(record.outcome.status)} · {fmtDate(record.outcome.date)}</strong><span>{record.outcome.notes||'—'}</span></div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>
  </div>
  {assessmentOpen&&<AssessmentDialog t={t} language={language} record={record} onClose={()=>setAssessmentOpen(false)} onSave={async draft=>{await saveClinicalEvent(tenantId,record.recordId,'clinical_assessment',{...draft,detail:'completed'},{occurredAt:draft.date});setAssessmentOpen(false);await onSaved();notify(t('clinicalRecords.clinicalAssessmentSaved'),'success')}}/>}
  {reviewOpen&&<ReassessmentDialog t={t} record={record} onClose={()=>setReviewOpen(false)} onSave={async draft=>{await addClinicalReassessment(tenantId,record.recordId,record.patientRecordId,draft);setReviewOpen(false);await onSaved();notify(t('clinicalRecords.reassessmentSaved'),'success')}}/>}
  {outcomeOpen&&<OutcomeDialog t={t} record={record} onClose={()=>setOutcomeOpen(false)} onSave={async draft=>{await completeClinicalCase(tenantId,record.recordId,record.patientRecordId,draft);setOutcomeOpen(false);await onSaved();notify(t('clinicalRecords.outcomeSaved'),'success')}}/>}
  </div>
}

function CloudTimeline({record,t,fmtDateTime}){const rows=[...(record.timeline||[]),...(record.reassessments||[]).map(item=>({at:item.date,type:'reassessment',detail:item.status})),...(record.outcome?[{at:record.outcome.date,type:'outcome',detail:record.outcome.status}]:[])].sort((a,b)=>String(b.at).localeCompare(String(a.at)));return <section className="clinical-panel full-panel"><div className="record-section-header"><div><FileClock size={17}/><strong>{t('clinicalRecords.timeline')}</strong></div></div><div className="clinical-timeline">{rows.map((item,index)=><article key={`${item.at}-${item.type}-${index}`}><div className="timeline-rail"><span/></div><div><header><strong>{t(item.type)}</strong><time>{fmtDateTime(item.at)}</time></header><p>{t(item.detail)||item.detail}</p></div></article>)}</div></section>}

function CreateCloudSurveillance({patient,tenantId,t,language,onClose,onCreated}){
  const [departments,setDepartments]=useState([])
  const [draft,setDraft]=useState({departmentId:patient.departmentId||'',startedAt:new Date().toISOString().slice(0,10),reviewDue:'',room:'',reason:'',reasonEn:'',suspectedSource:''})
  useEffect(()=>{loadDepartments(tenantId).then(rows=>setDepartments((rows||[]).filter(row=>row.is_active!==false))).catch(()=>setDepartments([]))},[tenantId])
  const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
  async function save(){if(!draft.startedAt||!(draft.reason||draft.reasonEn))return;const created=await createClinicalCase(tenantId,patient.recordId,draft);onCreated(created)}
  return <div className="modal-backdrop"><div className="entry-card"><header><div><span className="eyebrow">{t('surveillance')}</span><h3>{t('newSurveillance')}</h3></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid"><label><span>{t('department')}</span><select value={draft.departmentId} onChange={e=>set('departmentId',e.target.value)}><option value="">{t('select')}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><ManualDateField label={t('surveillanceStartDate')} value={draft.startedAt} onChange={value=>set('startedAt',value)}/><ManualDateField label={t('nextReview')} optional value={draft.reviewDue} onChange={value=>set('reviewDue',value)}/><label><span>{t('room')}</span><input value={draft.room} onChange={e=>set('room',e.target.value)}/></label><label className="entry-span-2"><span>{t('surveillanceReason')}</span><textarea rows={3} value={language==='el'?draft.reason:draft.reasonEn} onChange={e=>set(language==='el'?'reason':'reasonEn',e.target.value)}/></label></div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={!draft.startedAt||!(draft.reason||draft.reasonEn)} onClick={save}>{t('save')}</SaveButton></footer></div></div>
}
function AssessmentDialog({t,language,record,onClose,onSave}){const current=record.assessment||{};const [draft,setDraft]=useState({date:String(current.date||new Date().toISOString()).slice(0,10),summary:current.summary||'',summaryEn:current.summaryEn||''});return <SimpleDialog title={t('clinicalAssessment')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><ManualDateField label={t('assessmentDate')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label className="entry-span-2"><span>{t('clinicalSummary')}</span><textarea rows={4} value={language==='el'?draft.summary:draft.summaryEn} onChange={e=>setDraft(d=>({...d,[language==='el'?'summary':'summaryEn']:e.target.value}))}/></label></SimpleDialog>}
function ReassessmentDialog({t,onClose,onSave}){const [draft,setDraft]=useState({date:new Date().toISOString().slice(0,10),status:'clinicalImprovement',decision:'continueTreatment',notes:'',nextReviewDue:''});return <SimpleDialog title={t('reassessment')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><ManualDateField label={t('date')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label><span>{t('clinicalRecords.reviewStatus')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="clinicalImprovement">{t('clinicalImprovement')}</option><option value="stable">{t('clinicalRecords.stable')}</option><option value="deterioration">{t('clinicalRecords.deterioration')}</option><option value="resolved">{t('resolved')}</option></select></label><ManualDateField label={t('nextReview')} optional value={draft.nextReviewDue} onChange={nextReviewDue=>setDraft(d=>({...d,nextReviewDue}))}/><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label></SimpleDialog>}
function OutcomeDialog({t,onClose,onSave}){const [draft,setDraft]=useState({status:'resolved',date:new Date().toISOString().slice(0,10),notes:''});return <SimpleDialog title={t('outcome')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><label><span>{t('clinicalRecords.outcomeStatus')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="resolved">{t('resolved')}</option><option value="transferred">{t('transferred')}</option><option value="deceased">{t('clinicalRecords.deceased')}</option><option value="other">{t('other')}</option></select></label><ManualDateField label={t('clinicalRecords.outcomeDate')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label></SimpleDialog>}
function SimpleDialog({title,t,onClose,onSave,disabled,children}){return <div className="modal-backdrop"><div className="entry-card"><header><div><h3>{title}</h3></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid">{children}</div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={disabled} onClick={onSave}>{t('save')}</SaveButton></footer></div></div>}
function Detail({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
