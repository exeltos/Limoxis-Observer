import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { ShieldCheck, Microscope, Pill, BedDouble, RefreshCcw, CircleCheckBig, FileClock, UserRound, Activity, Printer, Download, Pencil, Trash2, FolderOpen, ListTree, ChevronRight, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { AttachmentField } from '../../design-system/AttachmentField'
import { ManualDateField } from '../../design-system/ManualDateField'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { EmptyState } from '../../design-system/EmptyState'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { createClinicalSurveillance, deleteClinicalSurveillance, findCaseByPatient, findCasesByPatient, getClinicalCase } from './clinicalDemoData'
import { patientDemoData } from '../patients/patientDemoData'
import { createDemoSurveillanceListItem, deleteDemoSurveillanceListItem, syncDemoSurveillanceListItem } from './surveillanceDemoData'
import { NewSurveillanceFlow } from './NewSurveillanceFlow'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { demoLibrarySeed } from '../management/managementData'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'

export function PatientClinicalRecordPage({patientMode=false}){
  const { caseId, patientId } = useParams()
  const location=useLocation()
  const {goBack,restored}=useContextualNavigation(patientMode?'/patients':'/surveillance')
  const { t, language, locale } = useLanguage()
  const [tab,setTab] = useState(()=>location.state?.openTab||restored?.tab||'summary')
  const { notify, confirm } = useFeedback()
  const {role,membership,tenant}=useTenant()
  const patient = patientDemoData.find(x=>x.id===patientId) ?? null
  // eslint-disable-next-line no-unused-vars -- episodeVersion itself is never read; setEpisodeVersion is called after mutations purely to force a re-render (record/patientEpisodes below are recomputed fresh each render, not memoized).
  const [episodeVersion,setEpisodeVersion]=useState(0)
  const [newSurveillanceOpen,setNewSurveillanceOpen]=useState(false)
  const patientEpisodes = patientMode ? findCasesByPatient(patientId) : []
  const defaultRecord = patientMode ? findCaseByPatient(patientId) : getClinicalCase(caseId)
  const [selectedEpisodeId,setSelectedEpisodeId]=useState(defaultRecord?.id||'')
  const record = patientMode ? (patientEpisodes.find(x=>x.id===selectedEpisodeId) || defaultRecord) : defaultRecord
  const fmtDate=(value)=>value ? new Intl.DateTimeFormat(locale).format(new Date(`${value.slice(0,10)}T12:00:00`)) : '—'
  const fmtDateTime=(value)=>value ? new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '—'
  const age=useMemo(()=>record?.dateOfBirth?Math.floor((new Date(record.admissionDate)-new Date(record.dateOfBirth))/(365.2425*24*60*60*1000)):null,[record])

  if(!record && !patient) return <Page title={t('clinicalRecords.patientRecord')}><EmptyState title={t('noData')} description={t('clinicalRecords.noClinicalData')}/></Page>
  const patientName=language==='el'?(record?.patient||patient?.name):(record?.patientEn||patient?.nameEn)
  const department=language==='el'?(record?.department||patient?.department):(record?.departmentEn||patient?.departmentEn)
  const patientCode=record?.patientId||patient?.id
  const admissionDate=record?.admissionDate||patient?.admissionDate
  const has=(cap)=>can(role,cap,membership?.capabilities??[],membership?.customCapabilities??[])
  const canSurveillance=Boolean(record)&&has(CAPABILITIES.VIEW_SURVEILLANCE)
  const canLab=Boolean(record)&&(has(CAPABILITIES.VIEW_LAB)||has(CAPABILITIES.VIEW_SURVEILLANCE))
  const canTherapy=Boolean(record)&&(has(CAPABILITIES.VIEW_PHARMACY)||has(CAPABILITIES.VIEW_SURVEILLANCE))
  const canClinical=canSurveillance||canLab||canTherapy
  const canReopenSurveillance=has(CAPABILITIES.REOPEN_SURVEILLANCE)
  const canDeleteSurveillance=has(CAPABILITIES.DELETE_SURVEILLANCE)
  const tabDefinitions=[
    {id:'summary',label:t('summary'),icon:UserRound,show:true},
    {id:'surveillanceJourney',label:t('surveillance'),icon:ListTree,show:has(CAPABILITIES.VIEW_SURVEILLANCE)||has(CAPABILITIES.CREATE_SURVEILLANCE)||canLab||canTherapy},
    {id:'clinicalData',label:t('clinicalRecords.clinicalData'),icon:Activity,show:canClinical},
    {id:'documents',label:t('documents'),icon:FolderOpen,show:true},
    {id:'history',label:t('history'),icon:FileClock,show:canSurveillance},
  ].filter(x=>x.show)
  const activeTab=tabDefinitions.some(x=>x.id===tab)?tab:(tabDefinitions[0]?.id||'summary')

  function createSurveillance(draft,selectedPatient=null){
    const targetPatient=selectedPatient||patient||{
      id:record?.patientId,
      name:record?.patient,
      nameEn:record?.patientEn,
      department:record?.department,
      departmentEn:record?.departmentEn,
      admissionDate:record?.admissionDate,
      dateOfBirth:record?.dateOfBirth,
    }
    if(!targetPatient?.id)return
    const created=createClinicalSurveillance({
      patientId:targetPatient.id,
      patient:targetPatient.name,
      patientEn:targetPatient.nameEn,
      dateOfBirth:targetPatient.dateOfBirth,
      department:targetPatient.department,
      departmentEn:targetPatient.departmentEn,
      admissionDate:targetPatient.admissionDate,
      ...draft,
      createdBy:t('currentUser'),
    })
    createDemoSurveillanceListItem(created)
    setSelectedEpisodeId(created.id)
    setEpisodeVersion(v=>v+1)
    setTab('surveillanceJourney')
    notify(t('surveillanceCreated'),'success')
    return created
  }

  async function recordAction(action){ if(action===UI_ACTIONS.PRINT){window.print();return} if(action===UI_ACTIONS.DELETE){const ok=await confirm({title:t('confirmAction'),message:t('deleteConfirm'),danger:true,confirmLabel:t('delete')});if(!ok)return} notify(t('actionCompleted'), action===UI_ACTIONS.DELETE?'warning':'success') }

  return <Page fill title={patientName} subtitle={record?`${patientCode} · ${record.id}`:patientCode}>
    <EntityRecordShell
      className="patient-record-shell workspace-fill"
      avatar={patientName?.split(' ').map(x=>x?.[0]).slice(0,2).join('')}
      eyebrow={patientCode}
      title={patientName}
      subtitle={`${department||'—'} · ${t('clinicalRecords.admission')}: ${fmtDate(admissionDate)}`}
      status={<><span className={`status-badge ${(record?.status||patient?.status)==='active'?'active':''}`}>{t(record?.status||patient?.status||'active')}</span>{(canLab||canSurveillance)&&record?.resistance&&<span className="status-badge danger">{record.resistance}</span>}</>}
      headerActions={<><button className="entity-record-icon-button" title={t('print')} aria-label={t('print')} onClick={()=>window.print()}><Printer size={15}/></button><button className="entity-record-icon-button" title={t('export')} aria-label={t('export')} onClick={()=>recordAction(UI_ACTIONS.EXPORT)}><Download size={15}/></button></>}
      tabs={tabDefinitions}
      activeTab={activeTab}
      onTabChange={setTab}
      onBack={goBack}
      backLabel={patientMode?t('clinicalRecords.backToPatients'):t('clinicalRecords.backToSurveillance')}
    >

    {activeTab==='summary'&&<PatientSummary patient={patient} record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} age={age} has={has} notify={notify} confirm={confirm}/>}
        {activeTab==='surveillanceJourney'&&<SurveillanceWorkspace
      episodes={patientMode?patientEpisodes:(record?[record]:[])}
      selectedEpisodeId={record?.id||''}
      onSelect={setSelectedEpisodeId}
      onNewSurveillance={()=>setNewSurveillanceOpen(true)}
      canCreateSurveillance={has(CAPABILITIES.CREATE_SURVEILLANCE)}
      t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime}
      canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy}
      patientName={patientName} patientCode={patientCode} department={department}
      organizationName={tenant?.name||membership?.organization?.name||t('clinicalRecords.hospital')}
      canReopenSurveillance={canReopenSurveillance}
      canDeleteSurveillance={canDeleteSurveillance}
      onDeleteSurveillance={(episodeId,reason)=>{
        const removed=deleteClinicalSurveillance(episodeId,{actor:t('currentUser'),reason})
        if(removed){
          deleteDemoSurveillanceListItem(episodeId)
          setEpisodeVersion(v=>v+1)
          if(selectedEpisodeId===episodeId)setSelectedEpisodeId('')
          notify(t('clinicalRecords.surveillanceDeleted'),'success')
        }
        return removed
      }}
    />}
    {activeTab==='clinicalData'&&record&&<ClinicalDataHub record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy}/>}
    {activeTab==='documents'&&<PatientDocuments t={t}/>}
    {activeTab==='history'&&record&&<Timeline record={record} t={t} language={language} fmtDateTime={fmtDateTime}/>}
    {newSurveillanceOpen&&<NewSurveillanceFlow patient={patient||{id:record?.patientId,name:record?.patient,nameEn:record?.patientEn,department:record?.department,departmentEn:record?.departmentEn,admissionDate:record?.admissionDate,dateOfBirth:record?.dateOfBirth,status:'active'}} onClose={()=>setNewSurveillanceOpen(false)} onCreate={createSurveillance} onRecordChange={()=>setEpisodeVersion(v=>v+1)}/>}
    </EntityRecordShell>
  </Page>
}


function PatientSummary({patient,record,t,language,fmtDate,age,has,notify,confirm}){
  const latestSample=record?.samples?.[0]
  return <div className="patient-summary-layout">
    <PatientDetails patient={patient} record={record} t={t} language={language} fmtDate={fmtDate} age={age} has={has} notify={notify} confirm={confirm}/>
    {record&&<section className="patient-summary-strip">
      <SummaryItem label={t('surveillance')} value={`${record.id} · ${t(record.status)}`} tone="info"/>
      <SummaryItem label={t('clinicalRecords.haiClassification')} value={record.haiClassification?t(record.haiClassification.status):'—'} tone={record.haiClassification?.status==='confirmed'?'warning':'neutral'}/>
      <SummaryItem label={t('clinicalRecords.latestFinding')} value={latestSample?.organism||t(latestSample?.result||'pending')} tone={latestSample?.result==='positive'?'warning':'neutral'}/>
      <SummaryItem label={t('isolation')} value={record.isolation?t(record.isolation.status):t('no')} tone={record.isolation?'info':'neutral'}/>
      <SummaryItem label={t('therapy')} value={record.therapy?.length?`${record.therapy.length} · ${record.therapy.map(x=>x.antimicrobial).join(', ')}`:t('clinicalRecords.none')} tone={record.therapy?.length?'info':'neutral'}/>
      <SummaryItem label={t('nextReview')} value={fmtDate(record.reviewDue)} tone="neutral"/>
    </section>}
  </div>
}
function SummaryItem({label,value,tone='neutral'}){return <div className={`patient-summary-item ${tone}`}><span>{label}</span><strong>{value}</strong></div>}


function SurveillanceWorkspace({episodes,onSelect,onNewSurveillance,canCreateSurveillance,t,language,fmtDate,fmtDateTime,canSurveillance,canLab,canTherapy,patientName,patientCode,department,organizationName,canReopenSurveillance,canDeleteSurveillance,onDeleteSurveillance}){
  const [episodeRows,setEpisodeRows]=useState(episodes)
  useEffect(()=>setEpisodeRows(episodes),[episodes])
  const active=episodeRows.filter(x=>x.status==='active')
  const completed=episodeRows.filter(x=>x.status!=='active')
  const [openEpisodeId,setOpenEpisodeId]=useState(null)
  const openEpisode=episodeRows.find(x=>x.id===openEpisodeId) || null
  const selectAndOpen=(id)=>{onSelect(id);setOpenEpisodeId(id)}
  return <div className="surveillance-workspace">
    <div className="surveillance-workspace-toolbar">
      <div><span className="eyebrow">{t('surveillance')}</span><h3>{t('clinicalRecords.surveillanceEpisodes')}</h3><p>{t('clinicalRecords.surveillanceEpisodesHelp')}</p></div>
      {canCreateSurveillance&&<Button onClick={onNewSurveillance}>+ {t('newSurveillance')}</Button>}
    </div>
    <div className="episode-list-columns">
      <EpisodeList title={t('clinicalRecords.activeSurveillanceEpisodes')} tone="active" episodes={active} onOpen={selectAndOpen} t={t} fmtDate={fmtDate}/>
      <EpisodeList title={t('clinicalRecords.completedSurveillanceEpisodes')} tone="completed" episodes={completed} onOpen={selectAndOpen} t={t} fmtDate={fmtDate}/>
    </div>
    <div className="episode-list-help">{t('clinicalRecords.episodeListHelp')}</div>
    {!episodes.length&&<SurveillanceStartGuide t={t} canCreateSurveillance={canCreateSurveillance} onNew={onNewSurveillance}/>}
    {openEpisode&&<EpisodeDetailOverlay
      record={openEpisode}
      onClose={()=>setOpenEpisodeId(null)}
      t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime}
      canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy}
      patientName={patientName} patientCode={patientCode} department={department}
      organizationName={organizationName}
      canReopenSurveillance={canReopenSurveillance}
      canDeleteSurveillance={canDeleteSurveillance}
      onDeleteSurveillance={onDeleteSurveillance}
      onReopen={(episodeId,reason)=>setEpisodeRows(rows=>rows.map(ep=>ep.id===episodeId?{...ep,status:'active',completedAt:null,outcome:null,timeline:[{at:new Date().toISOString(),type:'surveillanceReopened',actor:t('clinicalRecords.superAdmin'),detail:reason},...(ep.timeline||[])]}:ep))}
    />}
  </div>
}

function SurveillanceStartGuide({t}){
  const steps=[
    [t('clinicalAssessment'),t('clinicalRecords.guideAssessment')],
    [t('microbiology'),t('clinicalRecords.guideMicrobiology')],
    [t('haiAmr'),t('clinicalRecords.guideHaiAmr')],
    [t('isolation'),t('clinicalRecords.guideIsolation')],
    [t('therapy'),t('clinicalRecords.guideTherapy')],
    [t('reassessment'),t('clinicalRecords.guideReassessment')],
    [t('outcome'),t('clinicalRecords.guideOutcome')],
  ]
  return <section className="surveillance-start-guide">
    <div className="start-guide-heading"><div><span className="eyebrow">{t('surveillanceJourney')}</span><h3>{t('clinicalRecords.howSurveillanceWorks')}</h3><p>{t('clinicalRecords.howSurveillanceWorksHelp')}</p></div></div>
    <div className="start-guide-flow">
      {steps.map(([label,help],index)=><div key={label} className="start-guide-step">
        <span className="step-number">{String(index+1).padStart(2,'0')}</span>
        <div><strong>{label}</strong><small>{help}</small></div>
        {index<steps.length-1&&<span className="step-arrow">→</span>}
      </div>)}
    </div>
    <div className="start-guide-advice"><AlertTriangle size={16}/><div><strong>{t('clinicalRecords.clinicalGuidance')}</strong><span>{t('clinicalRecords.clinicalGuidanceIntro')}</span></div></div>
  </section>
}

function EpisodeList({title,tone,episodes,onOpen,t,fmtDate}){
  return <section className={`episode-list-panel ${tone}`}>
    <header><div><span className="episode-dot"/><strong>{title}</strong></div><span className="episode-count">{episodes.length}</span></header>
    <div className="episode-table-wrap">
      {episodes.length?<table className="episode-table"><thead><tr><th>{t('clinicalRecords.surveillanceId')}</th><th>{t('period')}</th><th>{t('clinicalRecords.classification')}</th><th>{t('status')}</th></tr></thead><tbody>{episodes.map(ep=><tr key={ep.id} tabIndex={0} onClick={()=>onOpen(ep.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(ep.id)}}}>
        <td><strong>{ep.id}</strong>{ep.resistance&&<b className="episode-resistance">{ep.resistance}</b>}</td>
        <td>{fmtDate(ep.startedAt)}{ep.completedAt?` → ${fmtDate(ep.completedAt)}`:''}</td>
        <td>{ep.haiClassification?.type?t(ep.haiClassification.type):t('underAssessment')}</td>
        <td><span className={`status-badge ${ep.status==='active'?'active':''}`}>{t(ep.status)}</span></td>
      </tr>)}</tbody></table>:<div className="episode-empty">{t('noData')}</div>}
    </div>
  </section>
}
function EpisodeDetailOverlay({record,onClose,t,language,fmtDate,fmtDateTime,canSurveillance,canLab,canTherapy,patientName,patientCode,department,organizationName,canReopenSurveillance,onReopen,canDeleteSurveillance,onDeleteSurveillance}){
  const completed=record.status!=='active'
  const [reopenOpen,setReopenOpen]=useState(false)
  const [reopenReason,setReopenReason]=useState('')
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [deleteReason,setDeleteReason]=useState('')
  const reopen=()=>{if(!reopenReason.trim())return;onReopen(record.id,reopenReason.trim());setReopenOpen(false);setReopenReason('');onClose()}
  const removeEpisode=()=>{if(!deleteReason.trim())return;const removed=onDeleteSurveillance?.(record.id,deleteReason.trim());if(removed){setDeleteOpen(false);setDeleteReason('');onClose()}}
  return <div className="episode-overlay" role="dialog" aria-modal="true" aria-label={record.id}>
    <section className="episode-detail-card">
      <header className="episode-detail-header">
        <div>
          <span className="eyebrow">{completed?t('clinicalRecords.completedSurveillance'):t('activeSurveillance')}</span>
          <h2>{record.id}</h2>
          <p>{patientName} · {patientCode} · {department}</p>
        </div>
        <div className="episode-detail-actions">
          <span className={`status-badge ${record.status==='active'?'active':''}`}>{t(record.status)}</span>
          {record.resistance&&<span className="status-badge danger">{record.resistance}</span>}
          {!completed&&canDeleteSurveillance&&<button className="delete-surveillance-button" title={t('clinicalRecords.deleteSurveillance')} aria-label={t('clinicalRecords.deleteSurveillance')} onClick={()=>setDeleteOpen(true)}><Trash2 size={16}/></button>}{completed&&canReopenSurveillance&&<button className="reopen-surveillance-button" title={t('clinicalRecords.reopenSurveillance')} aria-label={t('clinicalRecords.reopenSurveillance')} onClick={()=>setReopenOpen(true)}><RefreshCcw size={16}/></button>}
          <button title={t('print')} aria-label={t('print')} onClick={()=>window.print()}><Printer size={16}/></button>
          <button title={t('close')} aria-label={t('close')} onClick={onClose}><X size={16}/></button>
        </div>
      </header>
      <div className="episode-detail-scroll">
        {completed
          ? <CompletedSurveillanceReport record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} patientName={patientName} patientCode={patientCode} department={department} organizationName={organizationName}/>
          : <ActiveSurveillanceReport record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy} patientName={patientName} patientCode={patientCode} department={department} organizationName={organizationName}/>}
      </div>
      {deleteOpen&&<div className="reopen-confirm-backdrop"><div className="reopen-confirm-card delete-surveillance-confirm"><span className="eyebrow">{t('clinicalRecords.restrictedAction')}</span><h3>{t('clinicalRecords.deleteSurveillance')}</h3><p>{t('clinicalRecords.deleteSurveillanceWarning')}</p><label><span>{t('reasonRequired')}</span><textarea value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} rows={4} autoFocus placeholder={t('clinicalRecords.deleteSurveillanceReasonPlaceholder')}/></label><div><Button variant="secondary" onClick={()=>{setDeleteOpen(false);setDeleteReason('')}}>{t('cancel')}</Button><Button variant="danger" disabled={!deleteReason.trim()} onClick={removeEpisode}>{t('delete')}</Button></div></div></div>}
      {reopenOpen&&<div className="reopen-confirm-backdrop"><div className="reopen-confirm-card"><span className="eyebrow">{t('clinicalRecords.restrictedAction')}</span><h3>{t('clinicalRecords.reopenSurveillance')}</h3><p>{t('clinicalRecords.reopenSurveillanceWarning')}</p><label><span>{t('reasonRequired')}</span><textarea value={reopenReason} onChange={e=>setReopenReason(e.target.value)} rows={4} autoFocus/></label><div><Button variant="secondary" onClick={()=>{setReopenOpen(false);setReopenReason('')}}>{t('cancel')}</Button><Button disabled={!reopenReason.trim()} onClick={reopen}>{t('clinicalRecords.restoreToActive')}</Button></div></div></div>}
    </section>
  </div>
}
function ReportIdentity({record,t,patientName,patientCode,department,organizationName,fmtDate}){
  const actors=[record.assessment?.assessedBy,...(record.timeline||[]).map(x=>x.actor),...(record.reassessments||[]).map(x=>x.by)].filter(Boolean)
  const users=[...new Set(actors)]
  return <div className="episode-report-identity">
    <div className="episode-report-group"><span>{t('clinicalRecords.hospital')}</span><strong>{organizationName||'—'}</strong></div>
    <div className="episode-report-group"><span>{t('patient')}</span><strong>{patientName}</strong><small>{patientCode} · {department}</small></div>
    <div className="episode-report-group"><span>{t('surveillance')}</span><strong>{record.id}</strong><small>{fmtDate(record.startedAt)}{record.completedAt?` → ${fmtDate(record.completedAt)}`:''}</small></div>
    <div className="episode-report-group"><span>{t('clinicalRecords.involvedUsers')}</span><strong>{users.length?users.join(', '):'—'}</strong></div>
  </div>
}
function CompletedSurveillanceReport({record,t,language,fmtDate,fmtDateTime,patientName,patientCode,department,organizationName}){
  const positiveSamples=record.samples.filter(x=>x.result==='positive')
  const actors=[record.assessment?.assessedBy,...(record.timeline||[]).map(x=>x.actor),...(record.reassessments||[]).map(x=>x.by)].filter(Boolean)
  const users=[...new Set(actors)]
  const assessmentText=record.assessment?(language==='el'?record.assessment.summary:record.assessment.summaryEn):t('clinicalRecords.notDocumented')
  const haiText=record.haiClassification
    ? `${t(record.haiClassification.status)}${record.haiClassification.type?` · ${t(record.haiClassification.type)}`:''}. ${language==='el'?(record.haiClassification.rationale||''):(record.haiClassification.rationaleEn||'')}`
    : t('clinicalRecords.notDocumented')
  const microbiologyText=record.samples.length
    ? `${record.samples.length} ${t('samples').toLowerCase()}, ${positiveSamples.length} ${t('positive').toLowerCase()}. ${positiveSamples.map(x=>`${x.organism||'—'}${x.susceptibility?` (${x.susceptibility})`:''}`).join(' · ')||t('clinicalRecords.noPositiveFindings')}`
    : t('clinicalRecords.noSamplesRecorded')
  const therapyText=record.therapy.length
    ? record.therapy.map(x=>`${x.antimicrobial} ${x.dose||''} ${x.route||''}, ${fmtDate(x.startedAt)}${x.plannedEnd?`–${fmtDate(x.plannedEnd)}`:''}`).join(' · ')
    : t('clinicalRecords.noTherapyRecorded')
  const isolationText=record.isolation
    ? `${t(record.isolation.status)}${record.isolation.startedAt?` · ${fmtDate(record.isolation.startedAt)}`:''}${record.isolation.endedAt?`–${fmtDate(record.isolation.endedAt)}`:''}`
    : t('clinicalRecords.noIsolationRecorded')
  const reassessmentText=record.reassessments.length
    ? record.reassessments.map(x=>`${fmtDate(x.date)}: ${t(x.status)} — ${language==='el'?(x.notes||''):(x.notesEn||'')}`).join(' ')
    : t('clinicalRecords.noReassessmentRecorded')
  const outcomeText=record.outcome
    ? `${t(record.outcome.status)} · ${fmtDate(record.outcome.date)}. ${language==='el'?(record.outcome.notes||''):(record.outcome.notesEn||'')}`
    : t('clinicalRecords.notDocumented')
  return <article className="surveillance-final-report">
    <header className="final-report-title">
      <div><span>{t('clinicalRecords.finalSurveillanceReport')}</span><h2>{patientName}</h2><p>{record.id} · {fmtDate(record.startedAt)} → {fmtDate(record.completedAt||record.outcome?.date)}</p></div>
      <div className="final-report-hospital"><span>{t('clinicalRecords.hospital')}</span><strong>{organizationName||'—'}</strong></div>
    </header>

    <section className="final-report-intro">
      <p><strong>{t('patient')}:</strong> {patientName} ({patientCode}), {t('department').toLowerCase()} {department}. <strong>{t('surveillance')}:</strong> {record.id}. <strong>{t('period')}:</strong> {fmtDate(record.startedAt)} – {fmtDate(record.completedAt||record.outcome?.date)}.</p>
      <p><strong>{t('clinicalRecords.involvedUsers')}:</strong> {users.length?users.join(', '):t('clinicalRecords.notDocumented')}.</p>
    </section>

    <NarrativeSection number="01" title={t('clinicalAssessment')} text={assessmentText}/>
    <NarrativeSection number="02" title={t('haiAmr')} text={haiText}/>
    <NarrativeSection number="03" title={t('microbiology')} text={microbiologyText}/>
    <NarrativeSection number="04" title={t('therapy')} text={therapyText}/>
    <NarrativeSection number="05" title={t('isolation')} text={isolationText}/>
    <NarrativeSection number="06" title={t('reassessment')} text={reassessmentText}/>
    <NarrativeSection number="07" title={t('outcome')} text={outcomeText}/>

    <section className="final-report-course">
      <div className="final-report-section-heading"><span>08</span><h3>{t('clinicalRecords.courseSummary')}</h3></div>
      <div className="course-timeline">
        {(record.timeline||[]).slice().reverse().map((item,index)=><div key={`${item.at}-${index}`} className="course-event"><time>{fmtDateTime(item.at)}</time><span>{t(item.type)}</span><strong>{item.actor||'—'}</strong><p>{t(item.detail)||item.detail}</p></div>)}
      </div>
    </section>

    <footer className="final-report-footer">
      <span>{t('clinicalRecords.completedRecordReadOnly')}</span>
      <strong>{record.id}</strong>
    </footer>
  </article>
}
function NarrativeSection({number,title,text}){return <section className="final-report-narrative"><div className="final-report-section-heading"><span>{number}</span><h3>{title}</h3></div><p>{text}</p></section>}

function ActiveSurveillanceReport({record,t,language,fmtDate,fmtDateTime,canSurveillance,canLab,canTherapy,patientName,patientCode,department,organizationName}){
  return <div className="episode-report active-report">
    <ReportIdentity record={record} t={t} patientName={patientName} patientCode={patientCode} department={department} organizationName={organizationName} fmtDate={fmtDate} language={language}/>
    <SurveillanceJourney record={record} t={t} language={language} fmtDate={fmtDate} fmtDateTime={fmtDateTime} canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy}/>
  </div>
}

function SurveillanceJourney({record,t,language,fmtDate,fmtDateTime,canSurveillance,canLab,canTherapy}){
  const linkedLab=laboratorySamples.filter(x=>x.surveillanceCase===record.id)
  const validatedLab=linkedLab.filter(x=>x.resultStatus==='validated'&&x.organism)
  const effectiveSamples=linkedLab.length?linkedLab:record.samples
  const unlocked={
    assessment:true,
    samples:Boolean(record.assessment),
    hai:validatedLab.length>0,
    isolation:Boolean(record.assessment),
    therapy:validatedLab.length>0,
    reassessment:Boolean(record.assessment)&&(Boolean(record.isolation)||record.isolationDecision?.required===false||Boolean(record.haiClassification)||validatedLab.length>0),
    outcome:Boolean(record.reassessments.length),
  }
  const nodes=[
    {id:'assessment',label:t('clinicalAssessment'),icon:ShieldCheck,show:canSurveillance,status:record.assessment?'complete':'pending',meta:record.assessment?fmtDate(record.assessment.date):t('pending')},
    {id:'samples',label:t('sampleAndLaboratory'),icon:Microscope,show:canLab,status:linkedLab.length?'complete':'pending',meta:linkedLab.length?(validatedLab.length?`${linkedLab.length} · ${validatedLab.length} ${t('clinicalRecords.validated').toLowerCase()}`:`${linkedLab.length} · ${t('waitingForLaboratory')}`):t('clinicalRecords.notStarted')},
    {id:'hai',label:t('haiAmr'),icon:AlertTriangle,show:canSurveillance,status:record.haiClassification?'complete':'pending',meta:record.resistance||t(record.haiClassification?.status||'pending')},
    {id:'isolation',label:t('isolation'),icon:BedDouble,show:canSurveillance,status:(record.isolation||record.isolationDecision?.required===false)?'complete':'pending',meta:record.isolation?t(record.isolation.status):(record.isolationDecision?.required===false?t('notRequired'):t('clinicalRecords.notStarted'))},
    {id:'therapy',label:t('therapy'),icon:Pill,show:canTherapy,status:record.therapy.length?'complete':'pending',meta:record.therapy[0]?.antimicrobial||t('clinicalRecords.notStarted')},
    {id:'reassessment',label:t('reassessment'),icon:RefreshCcw,show:canSurveillance,status:record.reassessments.length?'complete':'due',meta:record.reassessments[0]?fmtDate(record.reassessments[0].date):(record.reviewDue?fmtDate(record.reviewDue):t('notScheduled'))},
    {id:'outcome',label:t('outcome'),icon:CircleCheckBig,show:canSurveillance,status:record.outcome?'complete':'pending',meta:record.outcome?t(record.outcome.status):t('pending')},
  ].filter(x=>x.show).map(x=>({...x,locked:!unlocked[x.id]}))
  const {notify,confirm}=useFeedback()
  const [section,setSection]=useState(null)
  return <div className="surveillance-journey">
    <div className="journey-heading"><div><span className="eyebrow">{t('activeSurveillance')}</span><h3>{t('surveillanceJourney')}</h3><p>{t('clinicalRecords.strictActiveJourneyHelp')}</p></div><span className="journey-case-id">{record.id}</span></div>
    <JourneyGuidance record={{...record,samples:effectiveSamples}} t={t} canSurveillance={canSurveillance} canLab={canLab} canTherapy={canTherapy} onSelect={id=>{if(unlocked[id])setSection(id)}}/>
    <div className="journey-map strict-journey-map">
      <button className={`journey-start journey-start-button ${section==='start'?'active':''}`} onClick={()=>canSurveillance&&setSection('start')}><CheckCircle2 size={16}/><span>{t('surveillanceStarted')}</span><strong>{fmtDate(record.startedAt)}</strong></button>
      <div className="journey-connector vertical"/>
      <div className="journey-nodes strict-nodes">{nodes.slice(0,5).map(node=><JourneyNode key={node.id} node={node} active={section===node.id} onClick={()=>!node.locked&&setSection(node.id)}/>)}</div>
      {nodes.some(x=>x.id==='reassessment')&&<><div className="journey-connector vertical"/><div className="journey-final-row">{nodes.filter(x=>x.id==='reassessment'||x.id==='outcome').map(node=><JourneyNode key={node.id} node={node} active={section===node.id} onClick={()=>!node.locked&&setSection(node.id)}/>)}</div></>}
    </div>
    {section&&<div className="journey-detail">
      {section==='start'&&<ActiveStartEditor record={record} t={t} language={language} onSaved={()=>{notify(t('clinicalRecords.surveillanceUpdated'),'success');setSection(null)}}/>}
      {section==='assessment'&&<ActiveAssessmentEditor record={record} t={t} language={language} onSaved={()=>{notify(t('clinicalRecords.clinicalAssessmentSaved'),'success');setSection(null)}}/>} 
      {section==='samples'&&<Samples record={{...record,samples:effectiveSamples}} t={t} fmtDateTime={fmtDateTime}/>} 
      {section==='hai'&&<ActiveHaiEditor record={record} t={t} language={language} onSaved={()=>{syncDemoSurveillanceListItem(record);notify(t('clinicalRecords.haiClassificationSaved'),'success');setSection(null)}}/>} 
      {section==='isolation'&&<ActiveIsolationEditor record={record} t={t} language={language} confirm={confirm} onSaved={mode=>{if(mode!=='cancel')notify(t('isolationSaved'),'success');setSection(null)}}/>} 
      {section==='therapy'&&<ActiveTherapyEditor record={record} t={t} language={language} onSaved={()=>{syncDemoSurveillanceListItem(record);notify(t('clinicalRecords.therapySaved'),'success');setSection(null)}}/>} 
      {section==='reassessment'&&<ActiveReassessmentEditor record={record} t={t} language={language} onSaved={()=>{syncDemoSurveillanceListItem(record);notify(t('clinicalRecords.reassessmentSaved'),'success');setSection(null)}}/>} 
      {section==='outcome'&&<ActiveOutcomeEditor record={record} t={t} language={language} onSaved={()=>{syncDemoSurveillanceListItem(record);notify(t('clinicalRecords.outcomeSaved'),'success');setSection(null)}}/>} 
    </div>}
  </div>
}


function ActiveHaiEditor({record,t,language,onSaved}){
  const current=record.haiClassification||{}
  const [draft,setDraft]=useState({
    status:current.status||'suspected',
    type:current.type||'other',
    definitionSet:current.definitionSet||'WHO / ECDC HAI surveillance',
    criteriaMet:current.criteriaMet??false,
    rationale:current.rationale||'',
    rationaleEn:current.rationaleEn||'',
  })
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  function save(){
    const now=new Date().toISOString()
    record.haiClassification={...draft}
    record.timeline=[{at:now,type:'haiClassificationUpdated',actor:t('currentUser'),detail:draft.status},...(record.timeline||[])]
    onSaved?.()
  }
  return <section className="clinical-panel full-panel active-edit-panel">
    <div className="section-actions"><div><PanelTitle icon={ShieldCheck} title={t('clinicalRecords.haiClassification')}/><p className="section-note">{t('clinicalRecords.haiEditorHelp')}</p></div></div>
    <div className="lab-readonly-source">
      <div><span>{t('organism')}</span><strong>{record.organism||'—'}</strong></div>
      <div><span>{t('clinicalRecords.resistanceClass')}</span><strong>{record.resistance||'—'}</strong></div>
      <small>{t('clinicalRecords.microbiologyReadOnlyFromLab')}</small>
    </div>
    <div className="entry-grid">
      <label><span>{t('clinicalRecords.caseStatus')}</span><select value={draft.status} onChange={e=>set('status',e.target.value)}><option value="suspected">{t('suspected')}</option><option value="confirmed">{t('confirmed')}</option><option value="excluded">{t('clinicalRecords.excluded')}</option></select></label>
      <label><span>{t('clinicalRecords.haiType')}</span><select value={draft.type} onChange={e=>set('type',e.target.value)}><option value="bloodstreamInfection">{t('bloodstreamInfection')}</option><option value="urinaryTractInfection">{t('urinaryTractInfection')}</option><option value="ventilatorAssociatedPneumonia">{t('ventilatorAssociatedPneumonia')}</option><option value="surgicalSiteInfection">{t('clinicalRecords.surgicalSiteInfection')}</option><option value="other">{t('other')}</option></select></label>
      <label><span>{t('clinicalRecords.criteriaMet')}</span><select value={draft.criteriaMet?'yes':'no'} onChange={e=>set('criteriaMet',e.target.value==='yes')}><option value="no">{t('no')}</option><option value="yes">{t('yes')}</option></select></label>
      <label><span>{t('clinicalRecords.definitionSet')}</span><input value={draft.definitionSet} onChange={e=>set('definitionSet',e.target.value)}/></label>
      <label className="entry-span-2"><span>{t('clinicalRecords.classificationRationale')}</span><textarea rows={4} value={language==='el'?draft.rationale:draft.rationaleEn} onChange={e=>set(language==='el'?'rationale':'rationaleEn',e.target.value)}/></label>
    </div>
    <div className="flow-step-actions"><Button onClick={save}>{t('save')}</Button></div>
  </section>
}

function ActiveTherapyEditor({record,t,language,onSaved}){
  const today=new Date().toISOString().slice(0,10)
  const [rows,setRows]=useState(record.therapy?.length?record.therapy.map(x=>({...x})):[])
  const [draft,setDraft]=useState({antimicrobial:'',dose:'',route:'IV',startedAt:today,plannedEnd:'',indication:'',organism:''})
  const [editingId,setEditingId]=useState(null)
  const suggestions=record.therapySuggestions||[]
  const organisms=record.organisms?.length?record.organisms.map(x=>x.name):(record.organism?[record.organism]:[])
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  const isAdvanced=name=>demoLibrarySeed.advancedAntibiotics.some(([el,en])=>[el.toLowerCase(),en.toLowerCase()].includes((name||'').trim().toLowerCase()))

  function reset(){
    setDraft({antimicrobial:'',dose:'',route:'IV',startedAt:today,plannedEnd:'',indication:'',organism:''})
    setEditingId(null)
  }
  function saveRow(){
    if(!draft.antimicrobial.trim()||!draft.startedAt)return
    const row={id:editingId||`TX-${Date.now()}`,...draft,advancedAntibiotic:isAdvanced(draft.antimicrobial),approved:true}
    const next=editingId?rows.map(x=>x.id===editingId?row:x):[...rows,row]
    setRows(next)
    reset()
  }
  function edit(row){
    setDraft({...row})
    setEditingId(row.id)
  }
  function remove(id){
    setRows(rows.filter(x=>x.id!==id))
    if(editingId===id)reset()
  }
  function applySuggestion(item){
    setDraft(d=>({...d,antimicrobial:item.antimicrobial,organism:item.organism||''}))
    setEditingId(null)
  }
  function saveAll(){
    const now=new Date().toISOString()
    record.therapy=rows
    record.timeline=[{at:now,type:'therapyUpdated',actor:t('currentUser'),detail:rows.map(x=>x.antimicrobial).join(', ')},...(record.timeline||[])]
    onSaved?.()
  }

  return <section className="clinical-panel full-panel active-edit-panel">
    <div className="section-actions"><div><PanelTitle icon={Pill} title={t('therapy')}/><p className="section-note">{t('clinicalRecords.therapyReviewerAuthorityHelp')}</p></div></div>

    {suggestions.length>0&&<div className="therapy-suggestions"><span className="eyebrow">{t('clinicalRecords.laboratorySuggestions')}</span><p>{t('clinicalRecords.laboratorySuggestionsHelp')}</p><div>{suggestions.map((item,index)=><button key={`${item.antimicrobial}-${index}`} onClick={()=>applySuggestion(item)}><strong>{item.antimicrobial}</strong>{item.organism&&<small>{item.organism}</small>}</button>)}</div></div>}

    {rows.length>0&&<div className="record-table-wrap"><table className="record-table therapy-record-table"><thead><tr>{organisms.length>1&&<th>{t('organism')}</th>}<th>{t('antimicrobial')}</th><th>{t('dose')}</th><th>{t('clinicalRecords.route')}</th><th>{t('clinicalRecords.startedOn')}</th><th>{t('clinicalRecords.plannedEnd')}</th><th>{t('actions')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{organisms.length>1&&<td>{row.organism||'—'}</td>}<td><strong>{row.antimicrobial}</strong>{row.advancedAntibiotic&&<span className="advanced-mini">{t('clinicalRecords.advancedAntibiotic')}</span>}</td><td>{row.dose||'—'}</td><td>{row.route||'—'}</td><td>{row.startedAt||'—'}</td><td>{row.plannedEnd||'—'}</td><td><div className="row-icon-actions"><button title={t('edit')} onClick={()=>edit(row)}><Pencil size={14}/></button><button className="danger" title={t('delete')} onClick={()=>remove(row.id)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}

    <div className="entry-grid therapy-entry-grid">
      {organisms.length>1&&<label><span>{t('organism')}</span><select value={draft.organism} onChange={e=>set('organism',e.target.value)}><option value="">{t('all')}</option>{organisms.map(name=><option key={name}>{name}</option>)}</select></label>}
      <label><span>{t('antimicrobial')}</span><input list="therapy-antimicrobials" value={draft.antimicrobial} onChange={e=>set('antimicrobial',e.target.value)}/><datalist id="therapy-antimicrobials">{demoLibrarySeed.antibiotics.map(([el,en])=><option key={el} value={language==='el'?el:en}/>)}</datalist><small className="field-hint">{t('selectOrTypeManually')}</small></label>
      <label><span>{t('dose')}</span><input value={draft.dose} onChange={e=>set('dose',e.target.value)}/></label>
      <label><span>{t('clinicalRecords.route')}</span><select value={draft.route} onChange={e=>set('route',e.target.value)}><option value="IV">IV</option><option value="PO">PO</option><option value="IM">IM</option><option value="other">{t('other')}</option></select></label>
      <ManualDateField label={t('clinicalRecords.startedOn')} value={draft.startedAt} onChange={v=>set('startedAt',v)}/>
      <ManualDateField label={t('clinicalRecords.plannedEnd')} optional value={draft.plannedEnd} onChange={v=>set('plannedEnd',v)}/>
      <label><span>{t('clinicalRecords.indication')}</span><input value={draft.indication} onChange={e=>set('indication',e.target.value)}/></label>
      {draft.antimicrobial&&isAdvanced(draft.antimicrobial)&&<div className="advanced-antibiotic-alert entry-span-2"><AlertTriangle size={15}/><span><strong>{t('clinicalRecords.advancedAntibiotic')}</strong>{t('clinicalRecords.advancedAntibioticDetected')}</span></div>}
    </div>
    <div className="therapy-row-actions"><Button variant="secondary" onClick={reset}>{t('clinicalRecords.clear')}</Button><Button disabled={!draft.antimicrobial.trim()||!draft.startedAt} onClick={saveRow}>{editingId?t('clinicalRecords.update'):t('clinicalRecords.add')}</Button></div>
    <div className="flow-step-actions"><Button onClick={saveAll}>{t('save')}</Button></div>
  </section>
}

function ActiveReassessmentEditor({record,t,language,onSaved}){
  const today=new Date().toISOString().slice(0,10)
  const [draft,setDraft]=useState({date:today,status:'clinicalImprovement',decision:'continueTreatment',notes:'',notesEn:''})
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  function save(){
    const now=new Date().toISOString()
    const row={id:`REV-${Date.now()}`,...draft,by:t('currentUser')}
    record.reassessments=[row,...(record.reassessments||[])]
    record.reviewDue=null
    record.timeline=[{at:now,type:'reassessment',actor:t('currentUser'),detail:draft.status},...(record.timeline||[])]
    onSaved?.()
  }
  return <section className="clinical-panel full-panel active-edit-panel">
    <div className="section-actions"><div><PanelTitle icon={RefreshCcw} title={t('reassessment')}/><p className="section-note">{t('clinicalRecords.reassessmentEditorHelp')}</p></div></div>
    <div className="entry-grid">
      <ManualDateField label={t('date')} value={draft.date} onChange={v=>set('date',v)}/>
      <label><span>{t('clinicalRecords.reviewStatus')}</span><select value={draft.status} onChange={e=>set('status',e.target.value)}><option value="clinicalImprovement">{t('clinicalImprovement')}</option><option value="stable">{t('clinicalRecords.stable')}</option><option value="deterioration">{t('clinicalRecords.deterioration')}</option><option value="resolved">{t('resolved')}</option></select></label>
      <label><span>{t('clinicalRecords.decision')}</span><select value={draft.decision} onChange={e=>set('decision',e.target.value)}><option value="continueTreatment">{t('continueTreatment')}</option><option value="modifyTreatment">{t('clinicalRecords.modifyTreatment')}</option><option value="continueIsolation">{t('continueIsolation')}</option><option value="stopIsolation">{t('clinicalRecords.stopIsolation')}</option><option value="closeSurveillance">{t('clinicalRecords.closeSurveillance')}</option></select></label>
      <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={language==='el'?draft.notes:draft.notesEn} onChange={e=>set(language==='el'?'notes':'notesEn',e.target.value)}/></label>
    </div>
    <div className="flow-step-actions"><Button onClick={save}>{t('save')}</Button></div>
  </section>
}

function ActiveOutcomeEditor({record,t,language,onSaved}){
  const today=new Date().toISOString().slice(0,10)
  const [draft,setDraft]=useState({status:'resolved',date:today,notes:'',notesEn:''})
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  function save(){
    if(!draft.date)return
    const now=new Date().toISOString()
    record.outcome={...draft}
    record.status='completed'
    record.completedAt=draft.date
    record.timeline=[{at:now,type:'outcome',actor:t('currentUser'),detail:draft.status},...(record.timeline||[])]
    onSaved?.()
  }
  return <section className="clinical-panel full-panel active-edit-panel">
    <div className="section-actions"><div><PanelTitle icon={CircleCheckBig} title={t('outcome')}/><p className="section-note">{t('clinicalRecords.outcomeEditorHelp')}</p></div></div>
    <div className="entry-grid">
      <label><span>{t('clinicalRecords.outcomeStatus')}</span><select value={draft.status} onChange={e=>set('status',e.target.value)}><option value="resolved">{t('resolved')}</option><option value="transferred">{t('transferred')}</option><option value="deceased">{t('clinicalRecords.deceased')}</option><option value="other">{t('other')}</option></select></label>
      <ManualDateField label={t('clinicalRecords.outcomeDate')} value={draft.date} onChange={v=>set('date',v)}/>
      <label className="entry-span-2"><span>{t('notes')}</span><textarea rows={4} value={language==='el'?draft.notes:draft.notesEn} onChange={e=>set(language==='el'?'notes':'notesEn',e.target.value)}/></label>
    </div>
    <div className="flow-step-actions"><Button disabled={!draft.date} onClick={save}>{t('clinicalRecords.completeSurveillance')}</Button></div>
  </section>
}

function JourneyGuidance({record,t,canSurveillance,canLab,canTherapy,onSelect}){
  const cues=[]
  const pendingSamples=record.samples.filter(x=>x.result==='pending')
  if(canSurveillance&&!record.assessment)cues.push({id:'assessment',tone:'warning',title:t('clinicalRecords.initialAssessmentRequired'),text:t('clinicalRecords.initialAssessmentRequiredHint')})
  if(canLab&&pendingSamples.length)cues.push({id:'samples',tone:'info',title:t('clinicalRecords.pendingLaboratoryResult'),text:t('clinicalRecords.pendingLaboratoryResultHint')})
  if(canSurveillance&&record.haiClassification&&!record.haiClassification.criteriaMet)cues.push({id:'hai',tone:'warning',title:t('clinicalRecords.haiCriteriaNeedReview'),text:t('clinicalRecords.haiCriteriaNeedReviewHint')})
  if(canSurveillance&&record.resistance&&!record.isolation)cues.push({id:'isolation',tone:'warning',title:t('clinicalRecords.reviewIsolationNeed'),text:t('clinicalRecords.reviewIsolationNeedHint')})
  if(canTherapy&&record.samples.some(x=>x.result==='positive')&&!record.therapy.length)cues.push({id:'therapy',tone:'warning',title:t('clinicalRecords.reviewAntimicrobialTherapy'),text:t('clinicalRecords.reviewAntimicrobialTherapyHint')})
  if(canSurveillance&&!record.reassessments.length)cues.push({id:'reassessment',tone:'due',title:t('clinicalRecords.reassessmentRequired'),text:t('clinicalRecords.reassessmentRequiredHint')})
  if(canSurveillance&&record.reviewDue)cues.push({id:'reassessment',tone:'neutral',title:t('nextReview'),text:`${t('clinicalRecords.reassessmentPlanned')}: ${record.reviewDue}`})
  if(!cues.length)return <div className="journey-guidance clear"><CheckCircle2 size={16}/><span>{t('clinicalRecords.noImmediateIntervention')}</span></div>
  return <div className="journey-guidance"><div className="journey-guidance-title"><AlertTriangle size={15}/><strong>{t('clinicalRecords.attentionNeeded')}</strong><span>{cues.length}</span></div><div className="journey-guidance-items">{cues.map((cue,index)=><button key={`${cue.id}-${index}`} className={`guidance-cue ${cue.tone}`} onClick={()=>onSelect(cue.id)}><strong>{cue.title}</strong><small>{cue.text}</small><ChevronRight size={14}/></button>)}</div></div>
}

function JourneyNode({node,active,onClick}){
  const Icon=node.icon
  return <button disabled={node.locked} className={`journey-node ${node.status} ${active?'active':''} ${node.locked?'locked':''}`} onClick={onClick}>
    <span className="journey-node-icon"><Icon size={17}/></span>
    <span className="journey-node-copy"><strong>{node.label}</strong><small>{node.meta}</small></span>
    <ChevronRight size={15}/>
  </button>
}

function ClinicalDataHub({record,t,language,fmtDate,fmtDateTime,canSurveillance,canLab,canTherapy}){
  return <div className="clinical-data-hub">
    <div className="clinical-data-heading"><span className="eyebrow">{t('clinicalRecords.patientRecord')}</span><h3>{t('clinicalRecords.clinicalData')}</h3></div>
    <div className="clinical-data-grid">
      {canSurveillance&&<Assessment record={record} t={t} language={language} fmtDate={fmtDate}/>}
      {canLab&&<Samples record={record} t={t} fmtDateTime={fmtDateTime}/>}
      {canTherapy&&<Therapy record={record} t={t} fmtDate={fmtDate}/>}
      {canSurveillance&&<DevicesRisk record={record} t={t} language={language} fmtDate={fmtDate}/>}
    </div>
  </div>
}
function PatientDocuments({t}){return <div className="record-section"><div className="record-section-header"><div><span className="eyebrow">{t('clinicalRecords.patientRecord')}</span><h3>{t('documents')}</h3></div></div><AttachmentField/></div>}


function PatientDetails({patient,record,t,language,fmtDate,age,has,notify,confirm}){
  const [editing,setEditing]=useState(false)
  const source=patient||{id:record?.patientId,name:record?.patient,nameEn:record?.patientEn,department:record?.department,departmentEn:record?.departmentEn,admissionDate:record?.admissionDate,status:record?.status}
  const [draft,setDraft]=useState({...source})
  const canEdit=has(CAPABILITIES.EDIT_PATIENT)
  const canDelete=has(CAPABILITIES.DELETE_PATIENT)
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))
  async function remove(){const ok=await confirm({title:t('confirmAction'),message:t('deleteConfirm'),danger:true,confirmLabel:t('delete')});if(ok)notify(t('actionCompleted'),'warning')}
  return <section className="clinical-panel full-panel patient-details-panel">
    <div className="record-section-header"><div><span className="eyebrow">{t('clinicalRecords.patientRecord')}</span><h3>{t('clinicalRecords.patientDetails')}</h3></div><div className="record-inline-actions">{canEdit&&!editing&&<button title={t('edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></button>}{canDelete&&!editing&&<button className="danger" title={t('delete')} onClick={remove}><Trash2 size={16}/></button>}</div></div>
    <div className={`detail-grid patient-detail-grid ${editing?'employee-inline-edit':''}`}>
      <PatientInline l={t('patientId')} v={draft.id||record?.patientId}/>
      <PatientInline editing={editing} l={t('name')} v={language==='el'?(draft.name||record?.patient):(draft.nameEn||record?.patientEn)} onChange={v=>set(language==='el'?'name':'nameEn',v)}/>
      <PatientInline editing={editing} l={t('department')} v={language==='el'?(draft.department||record?.department):(draft.departmentEn||record?.departmentEn)} onChange={v=>set(language==='el'?'department':'departmentEn',v)}/>
      <PatientInline l={t('admissionDate')} v={fmtDate(draft.admissionDate||record?.admissionDate)}/>
      <PatientInline l={t('clinicalRecords.age')} v={age??'—'}/>
      <PatientInline l={t('status')} v={t(draft.status||record?.status||'active')}/>
      {record&&<PatientInline l={t('surveillance')} v={`${record.id} · ${t(record.status)}`}/>}
      {record&&<PatientInline l={t('isolation')} v={record.isolation?t(record.isolation.status):t('no')}/>}
    </div>
    {!record&&<div className="patient-no-surveillance"><strong>{t('clinicalRecords.noActiveSurveillance')}</strong><span>{t('clinicalRecords.noClinicalData')}</span></div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" onClick={()=>{setDraft({...source});setEditing(false)}}>{t('cancel')}</Button><Button onClick={()=>{setEditing(false);notify(t('actionCompleted'),'success')}}>{t('save')}</Button></div>}
  </section>
}
function PatientInline({editing=false,l,v,onChange}){return <div className={`detail-item ${editing?'editable':''}`}><span>{l}</span>{editing?<input value={v||''} onChange={e=>onChange?.(e.target.value)}/>:<strong>{v||'—'}</strong>}</div>}

function ActiveStartEditor({record,t,language,onSaved}){
  const [draft,setDraft]=useState({startedAt:record.startedAt||'',reviewDue:record.reviewDue||'',department:record.department||'',departmentEn:record.departmentEn||'',room:record.room||'',reason:record.reason||'',reasonEn:record.reasonEn||''})
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  function save(){Object.assign(record,draft);record.timeline=[{at:new Date().toISOString(),type:'surveillanceUpdated',actor:t('currentUser'),detail:'start'},...(record.timeline||[])];onSaved?.()}
  return <section className="clinical-panel full-panel active-edit-panel"><div className="section-actions"><PanelTitle icon={Activity} title={t('surveillanceStart')}/><span className="edit-enabled-badge">{t('clinicalRecords.editableActiveSurveillance')}</span></div><div className="entry-grid"><ManualDateField label={t('surveillanceStartDate')} value={draft.startedAt} onChange={v=>set('startedAt',v)}/><ManualDateField label={t('nextReview')} optional value={draft.reviewDue} onChange={v=>set('reviewDue',v)}/><label><span>{t('department')}</span><input value={language==='el'?draft.department:draft.departmentEn} onChange={e=>set(language==='el'?'department':'departmentEn',e.target.value)}/></label><label><span>{t('room')}</span><input value={draft.room} onChange={e=>set('room',e.target.value)}/></label><label className="entry-span-2"><span>{t('surveillanceReason')}</span><textarea rows={3} value={language==='el'?draft.reason:draft.reasonEn} onChange={e=>set(language==='el'?'reason':'reasonEn',e.target.value)}/></label></div><div className="flow-step-actions"><Button onClick={save}>{t('save')}</Button></div></section>
}

function ActiveAssessmentEditor({record,t,language,onSaved}){
  const a=record.assessment||{}
  const [draft,setDraft]=useState({date:a.date||'',summary:a.summary||'',summaryEn:a.summaryEn||'',symptoms:(a.symptoms||[]).join(', '),risks:(a.riskFactors||[]).join(', '),notes:a.notes||'',notesEn:a.notesEn||''})
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  function save(){record.assessment={...a,date:draft.date,assessedBy:a.assessedBy||t('currentUser'),summary:draft.summary,summaryEn:draft.summaryEn||draft.summary,symptoms:draft.symptoms.split(',').map(x=>x.trim()).filter(Boolean),symptomsEn:draft.symptoms.split(',').map(x=>x.trim()).filter(Boolean),riskFactors:draft.risks.split(',').map(x=>x.trim()).filter(Boolean),riskFactorsEn:draft.risks.split(',').map(x=>x.trim()).filter(Boolean),notes:draft.notes,notesEn:draft.notesEn||draft.notes};record.timeline=[{at:new Date().toISOString(),type:'clinicalAssessmentUpdated',actor:t('currentUser'),detail:'updated'},...(record.timeline||[])];onSaved?.()}
  return <section className="clinical-panel full-panel active-edit-panel"><div className="section-actions"><PanelTitle icon={ShieldCheck} title={t('clinicalAssessment')}/><span className="edit-enabled-badge">{t('clinicalRecords.editableActiveSurveillance')}</span></div><div className="entry-grid"><ManualDateField label={t('assessmentDate')} value={draft.date} onChange={v=>set('date',v)}/><label className="entry-span-2"><span>{t('clinicalSummary')} · {t('optional')}</span><textarea rows={3} value={language==='el'?draft.summary:draft.summaryEn} onChange={e=>set(language==='el'?'summary':'summaryEn',e.target.value)}/></label><label><span>{t('signsSymptoms')}</span><input value={draft.symptoms} onChange={e=>set('symptoms',e.target.value)}/></label><label><span>{t('riskFactors')}</span><input value={draft.risks} onChange={e=>set('risks',e.target.value)}/></label></div><div className="flow-step-actions"><Button onClick={save}>{t('save')}</Button></div></section>
}

function ActiveIsolationEditor({record,t,language,confirm,onSaved}){
  const existing=record.isolation
  const initialNeeded=existing?true:(record.isolationDecision?.required===false?false:null)
  const [needed,setNeeded]=useState(initialNeeded)
  const [draft,setDraft]=useState({startedAt:existing?.startedAt?.slice(0,10)||new Date().toISOString().slice(0,10),precautionType:existing?.type||existing?.precautions?.[0]||'contact',reason:existing?.reason||'',reasonEn:existing?.reasonEn||'',provisional:existing?.provisional??true})
  const set=(k,v)=>setDraft(d=>({...d,[k]:v}))
  async function save(){const now=new Date().toISOString();if(needed===false&&existing){const ok=await confirm({title:t('clinicalRecords.changeIsolationDecision'),message:t('clinicalRecords.removeActiveIsolationConfirm'),confirmLabel:t('confirm')});if(!ok)return}if(needed===false){record.isolation=null;record.isolationDecision={required:false,decidedAt:now,by:t('currentUser')};record.timeline=[{at:now,type:'isolationNotRequired',actor:t('currentUser'),detail:'no'},...(record.timeline||[])];onSaved?.('saved');return}if(needed===true){record.isolationDecision={required:true,decidedAt:now,by:t('currentUser')};record.isolation={id:existing?.id||`ISO-${Date.now()}`,status:'active',startedAt:draft.startedAt,endedAt:null,type:draft.precautionType,precautions:[draft.precautionType],room:record.room||'',nextReview:record.reviewDue||null,reason:draft.reason||draft.reasonEn||'',reasonEn:draft.reasonEn||draft.reason||'',provisional:Boolean(draft.provisional),by:t('currentUser')};record.timeline=[{at:now,type:existing?'isolationUpdated':'isolationStarted',actor:t('currentUser'),detail:draft.precautionType},...(record.timeline||[])];onSaved?.('saved')}}
  return <section className="clinical-panel full-panel active-edit-panel isolation-decision-editor"><div className="section-actions"><div><PanelTitle icon={BedDouble} title={t('isolation')}/><p className="section-note">{t('clinicalRecords.isolationDecisionFirstHelp')}</p></div><span className="edit-enabled-badge">{t('clinicalRecords.editableActiveSurveillance')}</span></div><div className={`isolation-question ${needed===null?'required-decision':''}`}><strong>{t('isIsolationRequired')}</strong><span>{needed===null?t('isolationDecisionRequired'):t('isIsolationRequiredHelp')}</span><div><button type="button" className={needed===true?'selected yes':''} onClick={()=>setNeeded(true)}>{t('yes')}</button><button type="button" className={needed===false?'selected no':''} onClick={()=>setNeeded(false)}>{t('no')}</button></div></div>{needed===true&&<div className="entry-grid isolation-fields"><ManualDateField label={t('isolationStart')} value={draft.startedAt} onChange={v=>set('startedAt',v)}/><label><span>{t('precautionType')}</span><select value={draft.precautionType} onChange={e=>set('precautionType',e.target.value)}><option value="contact">{t('contactPrecautions')}</option><option value="droplet">{t('dropletPrecautions')}</option><option value="airborne">{t('airbornePrecautions')}</option><option value="protective">{t('protectiveIsolation')}</option><option value="other">{t('other')}</option></select></label><label className="entry-span-2"><span>{t('isolationReason')}</span><textarea rows={3} value={language==='el'?draft.reason:draft.reasonEn} onChange={e=>set(language==='el'?'reason':'reasonEn',e.target.value)}/></label><label className="inline-check entry-span-2"><input type="checkbox" checked={draft.provisional} onChange={e=>set('provisional',e.target.checked)}/><span>{t('provisionalIsolation')}</span></label></div>}{needed===false&&<div className="no-isolation-note"><CheckCircle2 size={16}/><span>{t('noIsolationDecisionHint')}</span></div>}<div className="flow-step-actions"><Button variant="secondary" onClick={()=>onSaved?.('cancel')}>{t('close')}</Button><Button disabled={needed===null||(needed===true&&!draft.startedAt)} onClick={save}>{t('save')}</Button></div></section>
}

function Assessment({record,t,language,fmtDate}){
  const a=record.assessment
  const screening=Object.entries(a?.screening||{}).filter(([,value])=>value&&value!=='unknown')
  return <section className="clinical-panel full-panel"><div className="section-actions"><PanelTitle icon={ShieldCheck} title={t('clinicalAssessment')}/></div>
    {!a?<div className="workflow-empty-step"><strong>{t('clinicalRecords.assessmentPending')}</strong><span>{t('clinicalRecords.assessmentPendingHint')}</span></div>:<>
      <div className="detail-grid"><Detail label={t('assessmentDate')} value={fmtDate(a.date)}/><Detail label={t('clinicalRecords.assessedBy')} value={a.assessedBy}/></div>
      {screening.length>0&&<><h4>{t('riskScreeningQuestionnaire')}</h4><div className="screening-summary-grid">{screening.map(([key,value])=><div key={key}><span>{t(`q${key[0].toUpperCase()}${key.slice(1)}`)}</span><strong>{t(value)}</strong></div>)}</div></>}
      {(a.summary||a.summaryEn)&&<><h4>{t('clinicalSummary')}</h4><p className="clinical-summary">{language==='el'?a.summary:a.summaryEn}</p></>}
      <div className="two-column-lists"><TagList title={t('signsSymptoms')} items={language==='el'?a.symptoms:a.symptomsEn}/><TagList title={t('riskFactors')} items={language==='el'?a.riskFactors:a.riskFactorsEn}/></div>
      {(a.notes||a.notesEn)&&<div className="evidence-box"><strong>{t('notes')}</strong><span>{language==='el'?a.notes:a.notesEn}</span></div>}
    </>}
  </section>
}

function Samples({record,t,fmtDateTime}){return <section className="clinical-panel full-panel"><div className="section-actions"><div><PanelTitle icon={Microscope} title={t('samples')}/><p className="section-note">{t('clinicalRecords.sourceOfTruthLab')}</p></div><ClinicalAction capability={CAPABILITIES.VIEW_LAB}><Button>{t('clinicalRecords.openInLaboratory')}</Button></ClinicalAction></div><div className="table-wrap"><table className="data-table clinical-table"><thead><tr><th>ID</th><th>{t('sampleType')}</th><th>{t('clinicalRecords.collectionDate')}</th><th>{t('clinicalRecords.cultureResult')}</th><th>{t('organism')}</th><th>{t('clinicalRecords.resistanceClass')}</th><th>{t('criticalResult')}</th></tr></thead><tbody>{record.samples.map(s=><tr key={s.id}><td><strong>{s.id}</strong></td><td>{t(s.type)}</td><td>{fmtDateTime(s.collectedAt)}</td><td><span className={`status-badge ${s.result==='positive'?'risk':''}`}>{t(s.result)}</span></td><td>{s.organism??'—'}</td><td>{s.resistance??'—'}</td><td>{s.critical?`${t('positive')} · ${fmtDateTime(s.communicatedAt)}`:'—'}</td></tr>)}</tbody></table></div>{record.samples[0]?.susceptibility&&<div className="evidence-box"><strong>{t('clinicalRecords.susceptibility')}</strong><span>{record.samples[0].susceptibility}</span></div>}</section>}

function Therapy({record,t,fmtDate}){return <section className="clinical-panel full-panel"><div className="section-actions"><div><PanelTitle icon={Pill} title={t('therapy')}/><p className="section-note">{t('clinicalRecords.sourceOfTruthPharmacy')}</p></div><ClinicalAction capability={CAPABILITIES.VIEW_PHARMACY}><Button>{t('clinicalRecords.openInPharmacy')}</Button></ClinicalAction></div>{record.therapy.length?<div className="therapy-list">{record.therapy.map(x=><article key={x.id}><header><strong>{x.antimicrobial}</strong><span className="status-badge active">{t('active')}</span></header><div className="detail-grid four"><Detail label={t('dose')} value={x.dose}/><Detail label={t('clinicalRecords.route')} value={x.route}/><Detail label={t('clinicalRecords.startedOn')} value={fmtDate(x.startedAt)}/><Detail label={t('clinicalRecords.plannedEnd')} value={fmtDate(x.plannedEnd)}/></div><Detail label={t('clinicalRecords.indication')} value={x.indication}/></article>)}</div>:<EmptyInline text={t('clinicalRecords.noClinicalData')}/>}</section>}

function Timeline({record,t,language,fmtDateTime}){return <section className="clinical-panel full-panel"><PanelTitle icon={FileClock} title={t('clinicalRecords.timeline')}/><div className="clinical-timeline">{record.timeline.map((item,i)=><article key={`${item.at}-${i}`}><div className="timeline-rail"><span/></div><div><header><strong>{t(item.type)}</strong><time>{fmtDateTime(item.at)}</time></header><p>{t(item.detail)} · {(language==='en'&&item.actorEn)?item.actorEn:item.actor}</p></div></article>)}</div></section>}

function PanelTitle({icon:Icon,title}){return <div className="panel-title"><Icon size={17}/><strong>{title}</strong></div>}

function DevicesRisk({record,t,language,fmtDate}){return <section className="clinical-panel full-panel"><div className="section-actions"><div><PanelTitle icon={FileClock} title={t('clinicalRecords.devicesRisk')}/><p className="section-note">{t('clinicalRecords.devicesRiskNote')}</p></div></div>{record.devices?.length?<div className="therapy-list">{record.devices.map(x=><article key={x.id}><header><strong>{language==='el'?x.name:x.nameEn}</strong><span className={`status-badge ${x.status==='active'?'active':''}`}>{t(x.status)}</span></header><div className="detail-grid four"><Detail label={t('clinicalRecords.insertedOn')} value={fmtDate(x.insertedAt)}/><Detail label={t('clinicalRecords.deviceSite')} value={language==='el'?x.site:x.siteEn}/><Detail label={t('clinicalRecords.reviewDue')} value={fmtDate(x.reviewDue)}/><Detail label={t('clinicalRecords.deviceIndication')} value={language==='el'?x.indication:x.indicationEn}/></div></article>)}</div>:<EmptyInline text={t('clinicalRecords.noClinicalData')}/>}</section>}

function Detail({label,value}){return <div className="detail-item"><span>{label}</span><strong>{value||'—'}</strong></div>}
function TagList({title,items}){return <div><h4>{title}</h4><div className="tag-row">{items.map(item=><span className="clinical-tag" key={item}>{item}</span>)}</div></div>}
function EmptyInline({text}){return <div className="empty-inline">{text}</div>}
function ClinicalAction({capability,children}){const {role,membership}=useTenant();return can(role,capability,membership?.capabilities??[],membership?.customCapabilities??[])?children:null}
