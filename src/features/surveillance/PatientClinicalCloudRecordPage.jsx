import { useEffect, useMemo, useState } from 'react'
import { Activity, BedDouble, FileClock, ListTree, Microscope, ShieldCheck, Syringe, UserRound } from 'lucide-react'
import { useParams } from 'react-router-dom'
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
import {
  addAntimicrobialTherapy,
  addClinicalReassessment,
  addSurveillanceDevice,
  completeClinicalCase,
  createClinicalCase,
  endAntimicrobialTherapy,
  endIsolation,
  loadClinicalCases,
  loadClinicalCasesForPatient,
  removeSurveillanceDevice,
  requestLaboratorySample,
  saveAmrClassification,
  saveClinicalAssessment,
  saveHaiClassification,
  startIsolation,
} from './clinicalCloudService'

export function PatientClinicalCloudRecordPage({patientMode=false}){
  const {caseId,patientId}=useParams()
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {role,membership,tenant,canAccessRecord}=useTenant()
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
            const [caseRows,admissionRows]=await Promise.all([loadClinicalCasesForPatient(tenant?.id,patient.recordId),loadAdmissions(patient.recordId)])
            if(!alive)return
            setEpisodes(caseRows);setAdmissions(admissionRows);setSelectedEpisodeId(current=>current||caseRows[0]?.id||'')
          }else{setEpisodes([]);setAdmissions([])}
        }else{
          const caseRows=await loadClinicalCases(tenant?.id)
          if(!alive)return
          const selected=caseRows.find(item=>item.id===caseId)
          setEpisodes(selected?[selected]:[])
          if(selected?.patientRecordId){const admissionRows=await loadAdmissions(selected.patientRecordId);if(alive)setAdmissions(admissionRows)}
        }
      }catch(err){if(alive)setError(err?.message||t('actionFailed'))}
      finally{if(alive)setLoading(false)}
    }
    load();return ()=>{alive=false}
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
    if(patientMode&&patient?.recordId){const rows=await loadClinicalCasesForPatient(tenant?.id,patient.recordId);setEpisodes(rows);setSelectedEpisodeId(preferredId||rows[0]?.id||'');return}
    const rows=await loadClinicalCases(tenant?.id);const selected=rows.find(item=>item.id===(preferredId||record?.id||caseId));setEpisodes(selected?[selected]:[]);setSelectedEpisodeId(selected?.id||'')
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
    <EntityRecordShell className="patient-record-shell workspace-fill" avatar={patientName?.split(' ').map(x=>x?.[0]).slice(0,2).join('')} eyebrow={patientCode} title={patientName} subtitle={`${department||'—'} · ${t('clinicalRecords.admission')}: ${fmtDate(patient?.admissionDate||record?.admissionDate)}`} status={<span className={`status-badge ${(record?.status||patient?.status)==='active'?'active':''}`}>{t(record?.status||patient?.status||'active')}</span>} headerActions={<PrintExportActions onExport={()=>downloadRecordJson({patient,record,episodes,admissions},{filename:record?.id||patientCode})}/>} tabs={tabs} activeTab={activeTab} onTabChange={setTab} onBack={goBack} backLabel={patientMode?t('clinicalRecords.backToPatients'):t('clinicalRecords.backToSurveillance')}>
      {activeTab==='summary'&&<CloudSummary patient={patient} record={record} t={t} language={language} fmtDate={fmtDate}/>} 
      {activeTab==='admissions'&&<CloudAdmissions rows={admissions} t={t} fmtDate={fmtDate}/>} 
      {activeTab==='surveillance'&&<CloudSurveillanceList episodes={episodes} selectedId={record?.id} onSelect={id=>{setSelectedEpisodeId(id);setTab('clinical')}} canCreate={patientMode&&has(CAPABILITIES.CREATE_SURVEILLANCE)} onCreate={()=>setCreateOpen(true)} t={t} fmtDate={fmtDate}/>} 
      {activeTab==='clinical'&&record&&<CloudClinicalJourney record={record} t={t} fmtDate={fmtDate} fmtDateTime={fmtDateTime} canAssess={has(CAPABILITIES.RECORD_CLINICAL_ASSESSMENT)} canEdit={has(CAPABILITIES.EDIT_SURVEILLANCE)} canClassifyResistance={has(CAPABILITIES.CLASSIFY_RESISTANCE)} canIsolation={has(CAPABILITIES.MANAGE_ISOLATION)} canTherapy={has(CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY)} canReassess={has(CAPABILITIES.REASSESS_SURVEILLANCE)} canOutcome={has(CAPABILITIES.RECORD_SURVEILLANCE_OUTCOME)||has(CAPABILITIES.CLOSE_SURVEILLANCE)} onSaved={()=>reloadCases(record.id)} tenantId={tenant?.id}/>} 
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

function CloudClinicalJourney({record,t,fmtDate,fmtDateTime,canAssess,canEdit,canClassifyResistance,canIsolation,canTherapy,canReassess,canOutcome,onSaved,tenantId}){
  const {notify}=useFeedback()
  const [dialog,setDialog]=useState(null)
  const activeIsolation=record.isolations?.find(row=>row.status==='active')
  const activeTherapies=(record.therapy||[]).filter(row=>row.status==='active'||row.status==='planned')
  const activeDevices=(record.devices||[]).filter(row=>row.status==='active')
  const microbiology=(record.samples||[]).flatMap(sample=>(sample.microbiologyResults||[]).map(result=>({...result,sampleCode:sample.id})))
  const unclassifiedResult=microbiology.find(result=>!result.amr&&result.organism)
  const saveAndClose=async(work,message)=>{await work();setDialog(null);await onSaved();notify(message,'success')}
  return <div className="clinical-data-hub"><div className="clinical-data-heading"><span className="eyebrow">{t('surveillance')}</span><h3>{t('surveillanceJourney')}</h3></div><div className="clinical-data-grid">
    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('clinicalAssessment')}</strong><small>{record.assessment?fmtDate(record.assessment.date||record.startedAt):t('pending')}</small></div>{canAssess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('assessment')}>{record.assessment?t('clinicalRecords.addReassessment'):t('clinicalRecords.add')}</Button>}</div>{record.assessment?<div className="evidence-box"><strong>{t(record.assessment.classification||'undetermined')}</strong><span>{record.assessment.summary||'—'}</span></div>:<div className="inline-empty">{t('clinicalRecords.assessmentPending')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><ShieldCheck size={17}/><strong>{t('haiClassification')}</strong></div>{canAssess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('hai')}>+ {t('classification')}</Button>}</div>{record.haiClassification?<div className="evidence-box"><strong>{record.haiClassification.type} · {t(record.haiClassification.status)}</strong><span>{record.haiClassification.rationale||record.haiClassification.definitionSet}</span></div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('samples')}</strong><small>{record.samples.length}</small></div>{canAssess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('sample')}>+ {t('sample')}</Button>}</div>{record.samples.length?<div className="record-table-wrap"><table className="record-table"><thead><tr><th>{t('sampleCode')}</th><th>{t('sampleType')}</th><th>{t('status')}</th><th>{t('result')}</th><th>{t('exportOrganism')}</th><th>AMR</th></tr></thead><tbody>{record.samples.map(sample=><tr key={sample.recordId||sample.id}><td><Microscope size={15}/> <strong>{sample.id}</strong></td><td>{t(sample.type)}</td><td>{t(sample.status)}</td><td>{sample.result?t(sample.result):'—'}</td><td>{sample.organism||'—'}</td><td>{sample.resistance||'—'}</td></tr>)}</tbody></table></div>:<div className="inline-empty">{t('clinicalRecords.noSamplesRecorded')}</div>}{canClassifyResistance&&unclassifiedResult&&<div className="record-section-actions"><Button variant="secondary" onClick={()=>setDialog({type:'amr',result:unclassifiedResult})}>{t('classifyResistance')} · {unclassifiedResult.sampleCode}</Button></div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('isolation')}</strong><small>{activeIsolation?t('active'):t('clinicalRecords.notDocumented')}</small></div>{canIsolation&&record.status==='active'&&(activeIsolation?<Button variant="secondary" onClick={()=>setDialog({type:'endIsolation',row:activeIsolation})}>{t('endIsolation')}</Button>:<Button variant="secondary" onClick={()=>setDialog('isolation')}>+ {t('isolation')}</Button>)}</div>{activeIsolation?<div className="evidence-box"><strong>{(activeIsolation.precautions||[]).join(', ')||t('isolation')}</strong><span>{activeIsolation.room||'—'} · {activeIsolation.reason}</span></div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><Syringe size={17}/><strong>{t('antimicrobialTherapy')}</strong><small>{activeTherapies.length}</small></div>{canTherapy&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('therapy')}>+ {t('therapy')}</Button>}</div>{(record.therapy||[]).length?(record.therapy||[]).map(row=><article className="evidence-box" key={row.id}><strong>{row.antimicrobial} · {t(row.status)}</strong><span>{[row.dose,row.route,row.indication].filter(Boolean).join(' · ')||'—'}</span>{canTherapy&&row.status==='active'&&<Button variant="secondary" onClick={()=>setDialog({type:'endTherapy',row})}>{t('complete')}</Button>}</article>):<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('devices')}</strong><small>{activeDevices.length}</small></div>{(canEdit||canAssess)&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('device')}>+ {t('device')}</Button>}</div>{(record.devices||[]).length?(record.devices||[]).map(row=><article className="evidence-box" key={row.id}><strong>{row.name} · {t(row.status)}</strong><span>{[row.site,row.indication,fmtDateTime(row.insertedAt)].filter(Boolean).join(' · ')}</span>{(canEdit||canAssess)&&row.status==='active'&&<Button variant="secondary" onClick={()=>setDialog({type:'removeDevice',row})}>{t('remove')}</Button>}</article>):<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('reassessment')}</strong><small>{record.reassessments.length}</small></div>{canReassess&&record.status==='active'&&<Button variant="secondary" onClick={()=>setDialog('reassessment')}>+ {t('reassessment')}</Button>}</div>{record.reassessments.length?record.reassessments.map(row=><article className="evidence-box" key={row.id}><strong>{fmtDate(row.date)} · {t(row.status)}</strong><span>{row.notes||row.decision||'—'}</span></article>):<div className="inline-empty">{t('clinicalRecords.noReassessmentRecorded')}</div>}</section>

    <section className="clinical-panel full-panel"><div className="record-section-header"><div><strong>{t('outcome')}</strong><small>{record.outcome?t(record.outcome.status):t('pending')}</small></div>{canOutcome&&record.status==='active'&&record.reassessments.length>0&&<Button onClick={()=>setDialog('outcome')}>{t('clinicalRecords.completeSurveillance')}</Button>}</div>{record.outcome?<div className="evidence-box"><strong>{t(record.outcome.status)} · {fmtDate(record.outcome.date)}</strong><span>{record.outcome.notes||'—'}</span></div>:<div className="inline-empty">{t('clinicalRecords.notDocumented')}</div>}</section>
  </div>

  {dialog==='assessment'&&<AssessmentDialog t={t} record={record} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>saveClinicalAssessment(tenantId,record,draft),t('clinicalRecords.clinicalAssessmentSaved'))}/>} 
  {dialog==='hai'&&<HaiDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>saveHaiClassification(tenantId,record,draft),t('saved'))}/>} 
  {dialog==='sample'&&<SampleRequestDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>requestLaboratorySample(tenantId,record,draft),t('laboratoryRecords.sampleCreated'))}/>} 
  {dialog==='isolation'&&<IsolationDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>startIsolation(tenantId,record,draft),t('saved'))}/>} 
  {dialog?.type==='endIsolation'&&<EndReasonDialog title={t('endIsolation')} t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>endIsolation(tenantId,dialog.row.id,draft),t('saved'))}/>} 
  {dialog==='therapy'&&<TherapyDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>addAntimicrobialTherapy(tenantId,record,draft),t('saved'))}/>} 
  {dialog?.type==='endTherapy'&&<EndReasonDialog title={t('complete')} t={t} reasonOptional onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>endAntimicrobialTherapy(tenantId,dialog.row.id,draft),t('saved'))}/>} 
  {dialog==='device'&&<DeviceDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>addSurveillanceDevice(tenantId,record,draft),t('saved'))}/>} 
  {dialog?.type==='removeDevice'&&<EndReasonDialog title={t('remove')} t={t} reasonOptional onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>removeSurveillanceDevice(tenantId,dialog.row.id,{removedAt:draft.endedAt}),t('saved'))}/>} 
  {dialog?.type==='amr'&&<AmrDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>saveAmrClassification(tenantId,dialog.result.id,draft),t('saved'))}/>} 
  {dialog==='reassessment'&&<ReassessmentDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>addClinicalReassessment(tenantId,record.recordId,record.patientRecordId,draft),t('clinicalRecords.reassessmentSaved'))}/>} 
  {dialog==='outcome'&&<OutcomeDialog t={t} onClose={()=>setDialog(null)} onSave={draft=>saveAndClose(()=>completeClinicalCase(tenantId,record.recordId,record.patientRecordId,draft),t('clinicalRecords.outcomeSaved'))}/>} 
  </div>
}

function CloudTimeline({record,t,fmtDateTime}){return <section className="clinical-panel full-panel"><div className="record-section-header"><div><FileClock size={17}/><strong>{t('clinicalRecords.timeline')}</strong></div></div><div className="clinical-timeline">{(record.timeline||[]).map((item,index)=><article key={`${item.at}-${item.type}-${index}`}><div className="timeline-rail"><span/></div><div><header><strong>{t(item.type)}</strong><time>{fmtDateTime(item.at)}</time></header><p>{t(item.detail)||item.detail}</p></div></article>)}</div></section>}

function CreateCloudSurveillance({patient,tenantId,t,language,onClose,onCreated}){
  const [departments,setDepartments]=useState([])
  const [draft,setDraft]=useState({departmentId:patient.departmentId||'',startedAt:new Date().toISOString().slice(0,10),reviewDue:'',room:'',reason:'',reasonEn:'',suspectedSource:''})
  useEffect(()=>{loadDepartments(tenantId).then(rows=>setDepartments((rows||[]).filter(row=>row.is_active!==false))).catch(()=>setDepartments([]))},[tenantId])
  const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
  async function save(){if(!draft.startedAt||!(draft.reason||draft.reasonEn))return;const created=await createClinicalCase(tenantId,patient.recordId,draft);onCreated(created)}
  return <div className="modal-backdrop"><div className="entry-card"><header><div><span className="eyebrow">{t('surveillance')}</span><h3>{t('newSurveillance')}</h3></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid"><label><span>{t('department')}</span><select value={draft.departmentId} onChange={e=>set('departmentId',e.target.value)}><option value="">{t('select')}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><ManualDateField label={t('surveillanceStartDate')} value={draft.startedAt} onChange={value=>set('startedAt',value)}/><ManualDateField label={t('nextReview')} optional value={draft.reviewDue} onChange={value=>set('reviewDue',value)}/><label><span>{t('room')}</span><input value={draft.room} onChange={e=>set('room',e.target.value)}/></label><label className="entry-span-2"><span>{t('surveillanceReason')}</span><textarea rows={3} value={language==='el'?draft.reason:draft.reasonEn} onChange={e=>set(language==='el'?'reason':'reasonEn',e.target.value)}/></label></div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={!draft.startedAt||!(draft.reason||draft.reasonEn)} onClick={save}>{t('save')}</SaveButton></footer></div></div>
}
function AssessmentDialog({t,record,onClose,onSave}){const current=record.assessment||{};const [draft,setDraft]=useState({date:String(current.date||new Date().toISOString()).slice(0,10),assessmentType:current.assessmentType||'suspected',classification:current.classification||'undetermined',summary:current.summary||''});return <SimpleDialog title={t('clinicalAssessment')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><ManualDateField label={t('assessmentDate')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label><span>{t('type')}</span><select value={draft.assessmentType} onChange={e=>setDraft(d=>({...d,assessmentType:e.target.value}))}><option value="suspected">{t('suspected')}</option><option value="healthcare_associated">{t('healthcareAssociated')}</option><option value="community_associated">{t('communityAssociated')}</option><option value="other">{t('other')}</option></select></label><label><span>{t('classification')}</span><select value={draft.classification} onChange={e=>setDraft(d=>({...d,classification:e.target.value}))}><option value="infection">{t('infection')}</option><option value="colonization">{t('colonization')}</option><option value="no_infection">{t('noInfection')}</option><option value="undetermined">{t('undetermined')}</option></select></label><label className="entry-span-2"><span>{t('clinicalSummary')}</span><textarea rows={4} value={draft.summary} onChange={e=>setDraft(d=>({...d,summary:e.target.value}))}/></label></SimpleDialog>}
function HaiDialog({t,onClose,onSave}){const [draft,setDraft]=useState({status:'suspected',type:'',definitionSet:'ECDC',definitionVersion:'',criteriaMet:null,rationale:''});return <SimpleDialog title={t('haiClassification')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.type||!draft.definitionSet}><label><span>{t('type')}</span><input value={draft.type} onChange={e=>setDraft(d=>({...d,type:e.target.value}))}/></label><label><span>{t('status')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="suspected">{t('suspected')}</option><option value="probable">{t('probable')}</option><option value="confirmed">{t('confirmed')}</option><option value="excluded">{t('excluded')}</option><option value="undetermined">{t('undetermined')}</option></select></label><label><span>{t('source')}</span><input value={draft.definitionSet} onChange={e=>setDraft(d=>({...d,definitionSet:e.target.value}))}/></label><label><span>{t('version')}</span><input value={draft.definitionVersion} onChange={e=>setDraft(d=>({...d,definitionVersion:e.target.value}))}/></label><label className="entry-span-2"><span>{t('rationale')}</span><textarea rows={3} value={draft.rationale} onChange={e=>setDraft(d=>({...d,rationale:e.target.value}))}/></label></SimpleDialog>}
function SampleRequestDialog({t,onClose,onSave}){const [draft,setDraft]=useState({type:'bloodCulture',source:'',priority:'routine'});return <SimpleDialog title={t('laboratoryRecords.newSample')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.type}><label><span>{t('sampleType')}</span><select value={draft.type} onChange={e=>setDraft(d=>({...d,type:e.target.value}))}><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label><label><span>{t('clinicalSource')}</span><input value={draft.source} onChange={e=>setDraft(d=>({...d,source:e.target.value}))}/></label><label><span>{t('priority')}</span><select value={draft.priority} onChange={e=>setDraft(d=>({...d,priority:e.target.value}))}><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label></SimpleDialog>}
function IsolationDialog({t,onClose,onSave}){const [draft,setDraft]=useState({precautions:['contact'],room:'',reason:'',startedAt:new Date().toISOString().slice(0,10),reviewDue:''});return <SimpleDialog title={t('isolation')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.reason||!draft.startedAt}><label><span>{t('precautions')}</span><select value={draft.precautions[0]||'contact'} onChange={e=>setDraft(d=>({...d,precautions:[e.target.value]}))}><option value="contact">{t('contact')}</option><option value="droplet">{t('droplet')}</option><option value="airborne">{t('airborne')}</option><option value="protective">{t('protective')}</option></select></label><label><span>{t('room')}</span><input value={draft.room} onChange={e=>setDraft(d=>({...d,room:e.target.value}))}/></label><ManualDateField label={t('startDate')} value={draft.startedAt} onChange={startedAt=>setDraft(d=>({...d,startedAt}))}/><ManualDateField label={t('nextReview')} optional value={draft.reviewDue} onChange={reviewDue=>setDraft(d=>({...d,reviewDue}))}/><label className="entry-span-2"><span>{t('reason')}</span><textarea rows={3} value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))}/></label></SimpleDialog>}
function TherapyDialog({t,onClose,onSave}){const [draft,setDraft]=useState({antimicrobial:'',dose:'',route:'IV',indication:'',startedAt:new Date().toISOString().slice(0,10),plannedEndAt:'',approvalStatus:'not_required'});return <SimpleDialog title={t('antimicrobialTherapy')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.antimicrobial||!draft.startedAt}><label><span>{t('antibiotic')}</span><input value={draft.antimicrobial} onChange={e=>setDraft(d=>({...d,antimicrobial:e.target.value}))}/></label><label><span>{t('dose')}</span><input value={draft.dose} onChange={e=>setDraft(d=>({...d,dose:e.target.value}))}/></label><label><span>{t('route')}</span><input value={draft.route} onChange={e=>setDraft(d=>({...d,route:e.target.value}))}/></label><label><span>{t('indication')}</span><input value={draft.indication} onChange={e=>setDraft(d=>({...d,indication:e.target.value}))}/></label><ManualDateField label={t('startDate')} value={draft.startedAt} onChange={startedAt=>setDraft(d=>({...d,startedAt}))}/><ManualDateField label={t('plannedEndDate')} optional value={draft.plannedEndAt} onChange={plannedEndAt=>setDraft(d=>({...d,plannedEndAt}))}/></SimpleDialog>}
function DeviceDialog({t,onClose,onSave}){const [draft,setDraft]=useState({type:'',site:'',indication:'',insertedAt:new Date().toISOString().slice(0,10),reviewDue:''});return <SimpleDialog title={t('device')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.type}><label><span>{t('type')}</span><input value={draft.type} onChange={e=>setDraft(d=>({...d,type:e.target.value}))}/></label><label><span>{t('site')}</span><input value={draft.site} onChange={e=>setDraft(d=>({...d,site:e.target.value}))}/></label><label className="entry-span-2"><span>{t('indication')}</span><input value={draft.indication} onChange={e=>setDraft(d=>({...d,indication:e.target.value}))}/></label><ManualDateField label={t('startDate')} value={draft.insertedAt} onChange={insertedAt=>setDraft(d=>({...d,insertedAt}))}/><ManualDateField label={t('nextReview')} optional value={draft.reviewDue} onChange={reviewDue=>setDraft(d=>({...d,reviewDue}))}/></SimpleDialog>}
function AmrDialog({t,onClose,onSave}){const [draft,setDraft]=useState({classification:'MDR',definitionSource:'ECDC',definitionVersion:'',status:'proposed',rationale:''});return <SimpleDialog title={t('classifyResistance')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.definitionSource||!draft.definitionVersion}><label><span>{t('classification')}</span><select value={draft.classification} onChange={e=>setDraft(d=>({...d,classification:e.target.value}))}><option value="MDR">MDR</option><option value="XDR">XDR</option><option value="PDR">PDR</option></select></label><label><span>{t('status')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="proposed">{t('proposed')}</option><option value="reviewed">{t('reviewed')}</option><option value="confirmed">{t('confirmed')}</option><option value="overridden">{t('overridden')}</option></select></label><label><span>{t('source')}</span><input value={draft.definitionSource} onChange={e=>setDraft(d=>({...d,definitionSource:e.target.value}))}/></label><label><span>{t('version')}</span><input value={draft.definitionVersion} onChange={e=>setDraft(d=>({...d,definitionVersion:e.target.value}))}/></label><label className="entry-span-2"><span>{t('rationale')}</span><textarea rows={3} value={draft.rationale} onChange={e=>setDraft(d=>({...d,rationale:e.target.value}))}/></label></SimpleDialog>}
function EndReasonDialog({title,t,onClose,onSave,reasonOptional=false}){const [draft,setDraft]=useState({endedAt:new Date().toISOString().slice(0,10),reason:''});return <SimpleDialog title={title} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.endedAt||(!reasonOptional&&!draft.reason)}><ManualDateField label={t('endDate')} value={draft.endedAt} onChange={endedAt=>setDraft(d=>({...d,endedAt}))}/>{!reasonOptional&&<label className="entry-span-2"><span>{t('reason')}</span><textarea rows={3} value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))}/></label>}</SimpleDialog>}
function ReassessmentDialog({t,onClose,onSave}){const [draft,setDraft]=useState({date:new Date().toISOString().slice(0,10),status:'clinicalImprovement',decision:'continueTreatment',notes:'',nextReviewDue:''});return <SimpleDialog title={t('reassessment')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><ManualDateField label={t('date')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label><span>{t('clinicalRecords.reviewStatus')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="clinicalImprovement">{t('clinicalImprovement')}</option><option value="stable">{t('clinicalRecords.stable')}</option><option value="deterioration">{t('clinicalRecords.deterioration')}</option><option value="resolved">{t('resolved')}</option></select></label><ManualDateField label={t('nextReview')} optional value={draft.nextReviewDue} onChange={nextReviewDue=>setDraft(d=>({...d,nextReviewDue}))}/><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label></SimpleDialog>}
function OutcomeDialog({t,onClose,onSave}){const [draft,setDraft]=useState({status:'resolved',date:new Date().toISOString().slice(0,10),notes:''});return <SimpleDialog title={t('outcome')} t={t} onClose={onClose} onSave={()=>onSave(draft)} disabled={!draft.date}><label><span>{t('clinicalRecords.outcomeStatus')}</span><select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value}))}><option value="resolved">{t('resolved')}</option><option value="transferred">{t('transferred')}</option><option value="deceased">{t('clinicalRecords.deceased')}</option><option value="other">{t('other')}</option></select></label><ManualDateField label={t('clinicalRecords.outcomeDate')} value={draft.date} onChange={date=>setDraft(d=>({...d,date}))}/><label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label></SimpleDialog>}
function SimpleDialog({title,t,onClose,onSave,disabled,children}){return <div className="modal-backdrop"><div className="entry-card"><header><div><h3>{title}</h3></div><button className="icon-close" onClick={onClose}>×</button></header><div className="entry-grid">{children}</div><footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={disabled} onClick={onSave}>{t('save')}</SaveButton></footer></div></div>}
function Detail({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}