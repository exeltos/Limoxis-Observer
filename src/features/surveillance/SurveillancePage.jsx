import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Clock3, LockKeyhole, Microscope, ShieldCheck, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { ManualDateField } from '../../design-system/ManualDateField'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { createDemoSurveillanceListItem, surveillanceDemoData } from './surveillanceDemoData'
import { createClinicalSurveillance } from './clinicalDemoData'
import { patientDemoData } from '../patients/patientDemoData'
import { NewSurveillanceFlow } from './NewSurveillanceFlow'
import { BulkEmployeeSurveillanceFlow, EmployeeSurveillanceFlow, SurveillanceSubjectChooser } from './EmployeeSurveillanceFlow'
import { createEmployeeRecheck, employeeSurveillanceBatches, employeeSurveillanceRecords, getEmployeeSurveillanceKpis, syncEmployeeSurveillanceFromLab, updateEmployeeSurveillanceRecord } from './employeeSurveillanceData'
import { EnvironmentalRegistry, EnvironmentalSurveillanceFlow } from './EnvironmentalSurveillanceFlow'
import { environmentalSurveillanceBatches, environmentalSurveillanceRecords, getEnvironmentalKpis, syncEnvironmentalSurveillanceFromLab } from './environmentalSurveillanceData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { downloadRecordJson } from '../../core/export/recordExport'
import { MetricCard } from '../../design-system/MetricCard'

export function SurveillancePage(){
  const { t, language, locale } = useLanguage()
  const { notify } = useFeedback()
  const navigate = useNavigate()
  const location = useLocation()
  const registry = useRegistryMemory('surveillance')
  const {role,isDemo,canAccessRecord,canSeeSensitiveEmployeeHealth}=useTenant()
  const {profile,user}=useAuth()
  const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])
  const canSeeEmployeeSurveillance=isDemo||canSeeSensitiveEmployeeHealth
  const canSeeEnvironmental=![ROLES.DEPARTMENT_MANAGER,ROLES.DEPARTMENT_USER,ROLES.DOCTOR_REVIEWER].includes(role)
  const saved = registry.loadViewState({
    query:'',
    department:'all',
    resistance:'all',
    review:'all',
  })

  const [query,setQuery] = useState(saved.query)
  const [department,setDepartment] = useState(saved.department)
  const [resistance,setResistance] = useState(saved.resistance)
  const [review,setReview] = useState(saved.review)
  const [newOpen,setNewOpen] = useState(false)
  const [creationMode,setCreationMode] = useState(null)
  const [registryMode,setRegistryMode] = useState('patients')
  const [version,setVersion] = useState(0)
  const searchParams=new URLSearchParams(location.search)
  const requestedEmployeeFromUrl=searchParams.get('employeeSurveillanceId')
  const requestedModeFromUrl=searchParams.get('mode')

  useEffect(()=>{
    if(requestedModeFromUrl==='employees'&&canSeeEmployeeSurveillance)setRegistryMode('employees')
    if(requestedEmployeeFromUrl&&canSeeEmployeeSurveillance)setRegistryMode('employees')
  },[requestedModeFromUrl,requestedEmployeeFromUrl,canSeeEmployeeSurveillance])

  useEffect(()=>{
    const refresh=()=>setVersion(v=>v+1)
    window.addEventListener('limoxis:environmental-updated',refresh)
    window.addEventListener('limoxis:employee-surveillance-updated',refresh)
    return ()=>{
      window.removeEventListener('limoxis:environmental-updated',refresh)
      window.removeEventListener('limoxis:employee-surveillance-updated',refresh)
    }
  },[])

  syncEmployeeSurveillanceFromLab()
  syncEnvironmentalSurveillanceFromLab()
  const active = surveillanceDemoData.filter(x=>x.state==='active').length
  const due = surveillanceDemoData.filter(x=>x.domains.reassessment==='overdue').length
  const isolation = surveillanceDemoData.filter(x=>x.isolation).length
  const resistant = surveillanceDemoData.filter(x=>x.resistance).length
  const environmentalKpis=getEnvironmentalKpis()
  const employeeKpis=getEmployeeSurveillanceKpis()
  const employeeSurveillanceCount=employeeSurveillanceRecords.length
  const employeeBatchCount=employeeSurveillanceBatches.length

  const fmt = value => value
    ? new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`))
    : '—'

  const departments = [
    ...new Set(
      surveillanceDemoData
        .map(x=>language==='el'?x.department:x.departmentEn)
        .filter(Boolean)
    )
  ]

  const rows = useMemo(
    ()=>surveillanceDemoData
      .filter(x=>canAccessRecord(x))
      .filter(x=>`${x.id} ${x.patientId} ${x.patient} ${x.patientEn} ${x.organism||''}`.toLowerCase().includes(query.toLowerCase()))
      .filter(x=>department==='all'||(language==='el'?x.department:x.departmentEn)===department)
      .filter(x=>resistance==='all'||(resistance==='resistant'?Boolean(x.resistance):!x.resistance))
      .filter(x=>review==='all'||x.domains.reassessment===review),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'version' is a deliberate cache-bust counter (see setVersion below); not read directly but must stay in deps to force recompute after record changes.
    [query,department,resistance,review,language,version,canAccessRecord]
  )

  function createSurveillance(draft,patient){
    const created = createClinicalSurveillance({
      patientId:patient.id,
      patient:patient.name,
      patientEn:patient.nameEn,
      dateOfBirth:patient.dateOfBirth,
      department:patient.department,
      departmentEn:patient.departmentEn,
      admissionDate:patient.admissionDate,
      ...draft,
      createdBy:actor.name,
    })
    createDemoSurveillanceListItem(created)
    setVersion(v=>v+1)
    notify(t('surveillanceCreated'),'success')
    return created
  }

  function openRecord(item){
    registry.saveViewState({query,department,resistance,review})
    registry.openRecord(navigate,`/surveillance/${item.id}`,item.id,rows.map(x=>x.id))
  }

  return (
    <Page
      fill
      title={t('clinicalRecords.surveillanceCenter')}
      subtitle={t('surveillanceSubtitleV051')}
      actions={
        <RecordActions
          actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]}
          actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.CREATE_SURVEILLANCE}}
          onAction={action=>{
            if(action===UI_ACTIONS.CREATE){
              setCreationMode('chooser')
              return
            }
            if(action===UI_ACTIONS.PRINT){
              window.print()
              return
            }
            if(action===UI_ACTIONS.EXPORT){
              const exportRows=registryMode==='employees'?employeeSurveillanceRecords:registryMode==='batches'?employeeSurveillanceBatches:registryMode==='environmental'?environmentalSurveillanceRecords:rows
              downloadRecordJson(exportRows,{filename:`surveillance-${registryMode}`})
              notify(t('currentListExported'),'success')
              return
            }
            notify(t('actionCompleted'),'info')
          }}
        />
      }
    >
      <div className="workspace-summary surveillance-summary">
        <div className="module-summary-strip">
          {registryMode==='employees'||registryMode==='batches'?<>
            <SummaryMetric icon={Activity} label={t('clinicalRecords.activeEmployeeScreenings')} value={employeeKpis.active}/>
            <SummaryMetric icon={Microscope} label={t('clinicalRecords.positiveEmployeeScreenings')} value={employeeKpis.positive}/>
            <SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.needsIntervention')} value={employeeKpis.needsIntervention}/>
            <SummaryMetric icon={Clock3} label={t('clinicalRecords.needsRecheck')} value={employeeKpis.needsRecheck}/>
          </>:registryMode==='environmental'?<>
            <SummaryMetric icon={Activity} label={t('clinicalRecords.activeEnvironmentalSampling')} value={environmentalKpis.active}/>
            <SummaryMetric icon={Clock3} label={t('clinicalRecords.pendingEnvironmentalLab')} value={environmentalKpis.pendingLab}/>
            <SummaryMetric icon={Microscope} label={t('clinicalRecords.positiveEnvironmentalPoints')} value={environmentalKpis.positive}/>
            <SummaryMetric icon={AlertTriangle} label={t('pointsOutsideLimits')} value={environmentalKpis.outOfLimits}/>
          </>:<>
            <SummaryMetric icon={Activity} label={t('activeSurveillance')} value={active}/>
            <SummaryMetric icon={Clock3} label={t('clinicalRecords.needsReview')} value={due}/>
            <SummaryMetric icon={AlertTriangle} label={t('clinicalRecords.activeIsolation')} value={isolation}/>
            <SummaryMetric icon={Microscope} label={t('clinicalRecords.mdrXdr')} value={resistant}/>
          </>}
        </div>
        <div className="governance-banner compact-governance">
          <ShieldCheck size={16}/>
          <span>{registryMode==='environmental'?t('clinicalRecords.environmentalSurveillanceGovernance'):t('clinicalRecords.parallelSurveillanceNote')}</span>
        </div>
      </div>

      <nav className="tabs surveillance-domain-tabs canonical-module-tabs" aria-label={t('surveillanceCategoriesAria')}>
        <button className={`tab ${registryMode==='patients'?'active':''}`} onClick={()=>setRegistryMode('patients')}><Activity size={14}/>{t('patients')} <span className="tab-count">{surveillanceDemoData.length}</span></button>
        <button className={`tab ${registryMode==='employees'?'active':''}`} disabled={!canSeeEmployeeSurveillance} title={!canSeeEmployeeSurveillance?t('sensitiveEmployeeHealthPermissionRequired'):''} onClick={()=>canSeeEmployeeSurveillance&&setRegistryMode('employees')}><Users size={14}/>{t('employees')} {canSeeEmployeeSurveillance?<span className="tab-count">{employeeSurveillanceCount}</span>:<LockKeyhole size={12}/>}</button>
        <button className={`tab ${registryMode==='batches'?'active':''}`} disabled={!canSeeEmployeeSurveillance} title={!canSeeEmployeeSurveillance?t('sensitiveEmployeeHealthPermissionRequired'):''} onClick={()=>canSeeEmployeeSurveillance&&setRegistryMode('batches')}><Users size={14}/>{t('clinicalRecords.bulkSurveillance')} {canSeeEmployeeSurveillance?<span className="tab-count">{employeeBatchCount}</span>:<LockKeyhole size={12}/>}</button>
        <button className={`tab ${registryMode==='environmental'?'active':''}`} disabled={!canSeeEnvironmental} onClick={()=>canSeeEnvironmental&&setRegistryMode('environmental')}><Microscope size={14}/>{t('clinicalRecords.environment')} <span className="tab-count">{environmentalSurveillanceRecords.length}</span></button>
      </nav>

      {registryMode==='patients'&&<div className="workspace-fill surface surveillance-workspace">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={t('clinicalRecords.searchSurveillance')}
          activeAdvancedCount={
            (department!=='all'?1:0)+
            (resistance!=='all'?1:0)+
            (review!=='all'?1:0)
          }
          onClear={()=>{
            setQuery('')
            setDepartment('all')
            setResistance('all')
            setReview('all')
          }}
          advanced={
            <>
              <FilterSelect label={t('clinicalRecords.resistance')} value={resistance} onChange={setResistance}>
                <option value="all">{t('all')}</option>
                <option value="resistant">{t('clinicalRecords.mdrXdr')}</option>
                <option value="none">{t('clinicalRecords.noResistanceFlag')}</option>
              </FilterSelect>
              <FilterSelect label={t('reassessment')} value={review} onChange={setReview}>
                <option value="all">{t('all')}</option>
                <option value="overdue">{t('overdue')}</option>
                <option value="inProgress">{t('inProgress')}</option>
                <option value="completed">{t('completed')}</option>
              </FilterSelect>
            </>
          }
        >
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}>
            <option value="all">{t('allDepartments')}</option>
            {departments.map(x=><option key={x} value={x}>{x}</option>)}
          </FilterSelect>
        </FilterBar>

        <div
          className="surveillance-list surveillance-registry scroll-list"
          ref={registry.scrollRef}
        >
          <div className="surveillance-registry-head">
            <span>{t('surveillance')}</span>
            <span>{t('patient')}</span>
            <span>{t('department')}</span>
            <span>{t('clinicalRecords.startedAt')}</span>
            <span>{t('microbiology')}</span>
            <span>{t('status')}</span>
            <span>{t('reassessment')}</span>
          </div>

          {rows.map(item=>{
            const reviewStatus = item.domains.reassessment
            return (
              <article
                key={item.id}
                {...registry.rowProps(item.id)}
                className={`surveillance-registry-row ${registry.highlightId===item.id?'registry-row-returned':''}`}
                onClick={()=>openRecord(item)}
                onKeyDown={e=>{
                  if(e.key==='Enter'||e.key===' '){
                    e.preventDefault()
                    openRecord(item)
                  }
                }}
              >
                <div className="surv-main">
                  <strong>{item.id}</strong>
                  <small>{item.patientId}</small>
                </div>
                <div className="surv-patient">
                  <strong>{language==='el'?item.patient:item.patientEn}</strong>
                </div>
                <div>
                  <span>{language==='el'?item.department:item.departmentEn}</span>
                </div>
                <div>
                  <span>{fmt(item.startedAt)}</span>
                </div>
                <div className="surv-micro">
                  <strong>{item.organism||'—'}</strong>
                  {item.resistance&&<span className="risk-badge">{item.resistance}</span>}
                </div>
                <div className="surv-status">
                  <span className="status-badge active">{t('clinicalRecords.activeSurveillanceState')}</span>
                  {item.isolation&&<span className="status-badge active">{t('isolation')}</span>}
                </div>
                <div className={`surv-review ${reviewStatus==='overdue'?'overdue':''}`}>
                  <strong>{fmt(item.reviewDue)}</strong>
                  <small>{t(reviewStatus)}</small>
                </div>
              </article>
            )
          })}
        </div>
      </div>}

      {registryMode==='employees'&&<EmployeeSurveillanceRegistry t={t} language={language} fmt={fmt} version={version} onChange={()=>setVersion(v=>v+1)}/>}
      {registryMode==='batches'&&<EmployeeBatchRegistry t={t} language={language} fmt={fmt} version={version}/>}
      {registryMode==='environmental'&&<EnvironmentalRegistry records={environmentalSurveillanceRecords} batches={environmentalSurveillanceBatches} t={t} language={language} fmt={fmt} onOpenSample={sampleId=>navigate(`/laboratory/${sampleId}`,{state:{returnTo:'/surveillance'}})}/>}

      {newOpen&&(
        <NewSurveillanceFlow
          patients={patientDemoData}
          onClose={()=>setNewOpen(false)}
          onCreate={createSurveillance}
          onRecordChange={()=>setVersion(v=>v+1)}
        />
      )}
      {creationMode==='chooser'&&<SurveillanceSubjectChooser onClose={()=>setCreationMode(null)} onPatient={()=>{setCreationMode(null);setNewOpen(true)}} onEmployee={()=>setCreationMode('employee')} onBulkEmployee={()=>setCreationMode('bulkEmployee')} onEnvironmental={()=>setCreationMode('environmental')}/>}
      {creationMode==='employee'&&<EmployeeSurveillanceFlow onClose={()=>setCreationMode(null)} onCreated={()=>{setVersion(v=>v+1);setRegistryMode('employees')}}/>}
      {creationMode==='bulkEmployee'&&<BulkEmployeeSurveillanceFlow onClose={()=>setCreationMode(null)} onCreated={()=>{setVersion(v=>v+1);setRegistryMode('batches')}}/>}
      {creationMode==='environmental'&&<EnvironmentalSurveillanceFlow onClose={()=>setCreationMode(null)} onCreated={()=>{setVersion(v=>v+1);setRegistryMode('environmental')}}/>}
    </Page>
  )
}


function EmployeeSurveillanceRegistry({t,language,fmt,version,onChange,requestedRecordId,onRequestedRecordHandled,returnFrom,onReturn,actorName}){
  const [selected,setSelected]=useState(null)
  const [editMode,setEditMode]=useState(false)
  const [intervention,setIntervention]=useState('')
  const [interventionType,setInterventionType]=useState('')
  const [interventionStart,setInterventionStart]=useState('')
  const [interventionEnd,setInterventionEnd]=useState('')
  const [noIntervention,setNoIntervention]=useState(false)
  const [recheckDate,setRecheckDate]=useState('')
  const [noRecheck,setNoRecheck]=useState(false)
  const [correctionReason,setCorrectionReason]=useState('')
  const rows=useMemo(()=>[...employeeSurveillanceRecords],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'version' is a deliberate cache-bust counter bumped elsewhere after mutations to employeeSurveillanceRecords (a module-level array mutated in place); not read directly but required to force recompute.
    [version])

  const isPositive=row=>['positive','positive_recheck'].includes(row.resultStatus)
  const samplesFor=row=>laboratorySamples.filter(x=>x.employeeSurveillanceCase===row.id)
  const hasFollowup=row=>Boolean(row.intervention||row.interventionType||row.noIntervention||row.recheckDate||row.noRecheck)
  // Follow-up remains visible/editable after a positive employee screening has been closed.
  // This mirrors the correction model used by finalized laboratory/environmental samples:
  // completed data stay auditable, but authorized corrections can still be recorded with a reason.
  const hasPositiveHistory=row=>samplesFor(row).some(sample=>(sample.finalizedAt||sample.resultStatus==='validated')&&sample.result==='positive')
  const followupEligible=row=>isPositive(row)||row.resultStatus==='cleared'||hasFollowup(row)||hasPositiveHistory(row)

  function loadFollowup(row){
    setIntervention(row.intervention||'')
    setInterventionType(row.interventionType||'')
    setInterventionStart(row.interventionStart||'')
    setInterventionEnd(row.interventionEnd||'')
    setNoIntervention(Boolean(row.noIntervention))
    setRecheckDate(row.recheckDate||'')
    setNoRecheck(Boolean(row.noRecheck))
    setCorrectionReason('')
  }
  function openRecord(row){
    setSelected(row)
    loadFollowup(row)
    setEditMode(false)
  }
  useEffect(()=>{
    if(!requestedRecordId)return
    const row=employeeSurveillanceRecords.find(x=>x.id===requestedRecordId)
    if(row)openRecord(row)
    onRequestedRecordHandled?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally narrow: only re-fires when requestedRecordId or the mutation-triggered 'version' counter changes (openRecord/onRequestedRecordHandled are not memoized by their callers, so including them would refire this every render).
  },[requestedRecordId,version])
  function startEdit(){
    if(!selected)return
    loadFollowup(selected)
    setEditMode(true)
  }
  function cancelEdit(){
    if(selected)loadFollowup(selected)
    setEditMode(false)
  }
  function saveFollowup(){
    if(!selected)return
    const previous={
      intervention:selected.intervention||'', interventionType:selected.interventionType||'', interventionStart:selected.interventionStart||'', interventionEnd:selected.interventionEnd||'', noIntervention:Boolean(selected.noIntervention), recheckDate:selected.recheckDate||'', noRecheck:Boolean(selected.noRecheck)
    }
    const next={intervention:intervention.trim(),interventionType,interventionStart,interventionEnd,noIntervention,recheckDate,noRecheck}
    const changed=Object.keys(previous).some(k=>previous[k]!==next[k])
    if(hasFollowup(selected)&&changed&&!correctionReason.trim())return

    const now=new Date().toISOString()
    const updated=updateEmployeeSurveillanceRecord(selected.id,{
      intervention:noIntervention?null:(intervention.trim()||null),
      interventionType:noIntervention?null:(interventionType||null),
      interventionStart:noIntervention?null:(interventionStart||null),
      interventionEnd:noIntervention?null:(interventionEnd||null),
      noIntervention,
      interventionStatus:noIntervention?'not_required':(intervention.trim()||interventionType?'recorded':'optional'),
      recheckDate:noRecheck?null:(recheckDate||null),
      noRecheck,
      recheckRequired:false,
      correctionReason:correctionReason.trim()||selected.correctionReason||null,
      timeline:[{at:now,type:hasFollowup(selected)?'employeeFollowupCorrected':'employeeFollowupRecorded',actor:actorName,detail:correctionReason.trim()||null},...(selected.timeline||[])]
    })
    if(!noRecheck&&recheckDate&&recheckDate!==previous.recheckDate){
      createEmployeeRecheck(updated||selected,{date:recheckDate,createdBy:actorName,createdById:actor.id})
    }
    const fresh=employeeSurveillanceRecords.find(x=>x.id===selected.id)
    setSelected(fresh||updated||selected)
    setEditMode(false)
    setCorrectionReason('')
    onChange?.()
  }
  const existingChanged=selected&&hasFollowup(selected)&&(
    (selected.intervention||'')!==intervention.trim() ||
    (selected.interventionType||'')!==interventionType ||
    (selected.interventionStart||'')!==interventionStart ||
    (selected.interventionEnd||'')!==interventionEnd ||
    Boolean(selected.noIntervention)!==noIntervention ||
    (selected.recheckDate||'')!==recheckDate ||
    Boolean(selected.noRecheck)!==noRecheck
  )
  const saveDisabled=Boolean(existingChanged&&!correctionReason.trim())

  return <section className="surface workspace-fill employee-surveillance-registry">
    <div className="registry-section-heading"><div><span className="eyebrow">{t('employeeSurveillance')}</span><h3>{t('clinicalRecords.employeeSurveillanceRegistry')}</h3><p>{t('clinicalRecords.clickRowForDetails')}</p></div></div>
    <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th className="col-surveillance">{t('surveillance')}</th><th className="col-employee">{t('employee')}</th><th className="col-screening">{t('screeningType')}</th><th className="col-result">{t('result')}</th><th className="col-intervention">{t('clinicalRecords.intervention')}</th><th className="col-recheck">{t('clinicalRecords.recheck')}</th><th className="col-status">{t('status')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={`registry-row-clickable ${isPositive(row)?'employee-screening-positive':''}`} tabIndex={0} onClick={()=>openRecord(row)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRecord(row)}}}>
      <td><strong>{row.id}</strong></td>
      <td><strong>{language==='el'?row.employeeName:row.employeeNameEn}</strong><small>{row.employeeId} · {language==='el'?row.department:row.departmentEn}</small></td>
      <td>{row.screeningTypes.map(x=>t(x)).join(', ')}</td>
      <td><span className={`status-badge ${row.resultStatus==='negative'||row.resultStatus==='cleared'?'active':''}`}>{t(row.resultStatus||'pending')}</span></td>
      <td className="col-intervention">{row.noIntervention?t('clinicalRecords.noInterventionPlanned'):(row.intervention||row.interventionType|| (isPositive(row)?t('optional'):'—'))}</td>
      <td className="col-recheck">{row.noRecheck?t('clinicalRecords.noRecheckPlanned'):(row.recheckDate?fmt(row.recheckDate):(isPositive(row)?t('optional'):'—'))}</td>
      <td className="col-status"><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td>
    </tr>)}</tbody></table></div>

    {selected&&<div className="modal-backdrop"><div className="entry-card employee-screening-record-card">
      <header><div><span className="eyebrow">{t('clinicalRecords.employeeScreeningRecord')}</span><h3>{language==='el'?selected.employeeName:selected.employeeNameEn}</h3><p>{selected.id} · {language==='el'?selected.department:selected.departmentEn}</p></div><div className="record-modal-actions">{followupEligible(selected)&&!editMode&&<Button variant="secondary" onClick={startEdit}>{t('edit')}</Button>}<button className="icon-close" title={returnFrom?t('backToLaboratory'):t('close')} onClick={()=>{if(returnFrom){onReturn?.();return}setSelected(null)}}>{returnFrom?'←':'×'}</button></div></header>

      <div className="employee-record-status-strip"><div><small>{t('screeningType')}</small><strong>{selected.screeningTypes.map(x=>t(x)).join(', ')}</strong></div><div><small>{t('result')}</small><strong>{t(selected.resultStatus||'pending')}</strong></div><div><small>{t('status')}</small><strong>{t(selected.status)}</strong></div></div>

      {followupEligible(selected)&&<div className="employee-screening-flow">
        <div className="screening-flow-step done"><span>01</span><strong>{t('clinicalRecords.positiveResult')}</strong><small>{t('completed')}</small></div>
        <div className={`screening-flow-step ${hasFollowup(selected)?'done':'current'}`}><span>02</span><strong>{t('clinicalRecords.intervention')}</strong><small>{t('optional')}</small></div>
        <div className={`screening-flow-step ${selected.recheckDate||selected.noRecheck?'done':''}`}><span>03</span><strong>{t('clinicalRecords.recheck')}</strong><small>{t('optional')}</small></div>
        <div className={`screening-flow-step ${selected.resultStatus==='cleared'?'done':''}`}><span>04</span><strong>{t('outcome')}</strong><small>{selected.resultStatus==='cleared'?t('completed'):t('clinicalRecords.open')}</small></div>
      </div>}

      <section className="employee-record-section"><div className="followup-section-title"><strong>{t('clinicalRecords.laboratoryResults')}</strong><span>{t('clinicalRecords.laboratoryResultsSourceTruth')}</span></div><div className="employee-sample-list">{samplesFor(selected).map(sample=><div key={sample.id} className="employee-sample-row"><div><strong>{sample.id}</strong><span>{t(sample.sourceCode||'employeeScreening')}</span></div><div><span className={`status-badge ${sample.result==='negative'?'active':''}`}>{sample.result?t(sample.result):t(sample.status)}</span>{sample.organism&&<small>{sample.organism}</small>}{sample.isRecheck&&<b>{t('clinicalRecords.recheck')}</b>}</div></div>)}</div></section>

      {followupEligible(selected)&&<section className="employee-record-section followup-highlight"><div className="followup-section-title"><strong>{t('clinicalRecords.interventionAndRecheck')}</strong><span>{t('clinicalRecords.followupOptionalHelp')}</span></div>
        {!editMode&&<><div className="followup-read-grid"><div><small>{t('clinicalRecords.intervention')}</small><strong>{selected.noIntervention?t('clinicalRecords.noInterventionPlanned'):(selected.interventionType||selected.intervention||t('clinicalRecords.notRecorded'))}</strong>{selected.intervention&&selected.interventionType&&<span>{selected.intervention}</span>}{selected.interventionStart&&<span>{t('clinicalRecords.start')}: {fmt(selected.interventionStart)}</span>}{selected.interventionEnd&&<span>{t('clinicalRecords.end')}: {fmt(selected.interventionEnd)}</span>}</div><div><small>{t('clinicalRecords.recheck')}</small><strong>{selected.noRecheck?t('clinicalRecords.noRecheckPlanned'):(selected.recheckDate?fmt(selected.recheckDate):t('notScheduled'))}</strong></div></div><div className="followup-inline-actions"><Button variant="secondary" onClick={startEdit}>{hasFollowup(selected)?t('edit'):t('clinicalRecords.recordFollowup')}</Button></div></>}

        {editMode&&<div className="employee-followup-edit-grid">
          <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noIntervention} onChange={e=>{setNoIntervention(e.target.checked);if(e.target.checked){setIntervention('');setInterventionType('');setInterventionStart('');setInterventionEnd('')}}}/><span>{t('clinicalRecords.noInterventionPlanned')}</span></label></div>
          {!noIntervention&&<><label className="field"><span>{t('clinicalRecords.interventionType')}</span><input list="employee-intervention-types" value={interventionType} onChange={e=>setInterventionType(e.target.value)} placeholder={t('clinicalRecords.chooseOrType')}/><datalist id="employee-intervention-types"><option value={t('clinicalRecords.ointment')}/><option value={t('clinicalRecords.nasalOintment')}/><option value={t('clinicalRecords.topicalTreatment')}/><option value={t('clinicalRecords.decolonizationProtocol')}/><option value={t('other')}/></datalist></label><label className="field"><span>{t('clinicalRecords.interventionDetails')}</span><input value={intervention} onChange={e=>setIntervention(e.target.value)} placeholder={t('clinicalRecords.optionalNotes')}/></label><ManualDateField className="field" label={t('clinicalRecords.start')} value={interventionStart} onChange={setInterventionStart}/><ManualDateField className="field" label={t('clinicalRecords.end')} value={interventionEnd} onChange={setInterventionEnd}/></>}
          <div className="entry-span-2 followup-choice-row"><label><input type="checkbox" checked={noRecheck} onChange={e=>{setNoRecheck(e.target.checked);if(e.target.checked)setRecheckDate('')}}/><span>{t('clinicalRecords.noRecheckPlanned')}</span></label></div>
          {!noRecheck&&<div className="entry-span-2"><ManualDateField className="field" label={t('clinicalRecords.recheckDate')} value={recheckDate} onChange={setRecheckDate}/><small className="field-hint">{t('clinicalRecords.recheckOptionalHelp')}</small></div>}
          {hasFollowup(selected)&&<label className="field entry-span-2"><span>{t('clinicalRecords.correctionReason')}</span><textarea rows="2" value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder={t('clinicalRecords.correctionReasonPlaceholder')}/><small>{t('clinicalRecords.correctionReasonHelp')}</small></label>}
          <div className="lab-step-footer entry-span-2"><Button variant="secondary" onClick={cancelEdit}>{t('cancel')}</Button><Button disabled={saveDisabled} onClick={saveFollowup}>{t('clinicalRecords.saveChanges')}</Button></div>
        </div>}
      </section>}

      {!followupEligible(selected)&&<section className="employee-record-section"><div className="source-truth-note">{t('clinicalRecords.screeningNoFollowupNeeded')}</div></section>}
      {selected.resultStatus==='cleared'&&<div className="source-truth-note">{t('clinicalRecords.screeningClearedEditableNote')}</div>}
    </div></div>}
  </section>
}

function EmployeeBatchRegistry({t,language,fmt,version,onOpenRecord}){
  const [selectedBatch,setSelectedBatch]=useState(null)
  const rows=useMemo(()=>[...employeeSurveillanceBatches],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 'version' is a deliberate cache-bust counter bumped elsewhere after mutations to employeeSurveillanceBatches (a module-level array mutated in place); not read directly but required to force recompute.
    [version])
  const batchRecords=batch=>employeeSurveillanceRecords.filter(x=>batch?.surveillanceIds?.includes(x.id))

  return <section className="surface workspace-fill employee-surveillance-registry">
    <div className="registry-section-heading">
      <div>
        <span className="eyebrow">{t('clinicalRecords.bulkSurveillance')}</span>
        <h3>{t('clinicalRecords.employeeSurveillanceBatches')}</h3>
        <p>{t('clinicalRecords.clickRowForBatchDetails')}</p>
      </div>
    </div>

    <div className="scroll-table"><table className="data-table sticky-table">
      <thead><tr><th>{t('batch')}</th><th>{t('department')}</th><th>{t('screeningDate')}</th><th>{t('screeningType')}</th><th>{t('employees')}</th><th>{t('status')}</th></tr></thead>
      <tbody>{rows.map(row=><tr
        key={row.id}
        className="registry-row-clickable"
        tabIndex={0}
        onClick={()=>setSelectedBatch(row)}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedBatch(row)}}}
      >
        <td><strong>{row.id}</strong></td>
        <td>{language==='el'?row.department:row.departmentEn}</td>
        <td>{fmt(row.startedAt)}</td>
        <td>{row.screeningTypes.map(x=>t(x)).join(', ')}</td>
        <td>{row.employeeIds.length}</td>
        <td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td>
      </tr>)}</tbody>
    </table></div>

    {selectedBatch&&<div className="modal-backdrop">
      <div className="entry-card employee-batch-record-card">
        <header>
          <div><span className="eyebrow">{t('clinicalRecords.bulkSurveillance')}</span><h3>{selectedBatch.id}</h3><p>{fmt(selectedBatch.startedAt)} · {selectedBatch.screeningTypes.map(x=>t(x)).join(', ')}</p></div>
          <button className="icon-close" onClick={()=>setSelectedBatch(null)}>×</button>
        </header>
        <div className="employee-batch-record-list">
          {batchRecords(selectedBatch).map(record=><button key={record.id} className="employee-batch-record-row" onClick={()=>{setSelectedBatch(null);onOpenRecord?.(record.id)}}>
            <div><strong>{language==='el'?record.employeeName:record.employeeNameEn}</strong><span>{record.employeeId} · {language==='el'?record.department:record.departmentEn}</span></div>
            <div><span className={`status-badge ${record.resultStatus==='negative'||record.resultStatus==='cleared'?'active':''}`}>{t(record.resultStatus||'pending')}</span><b>›</b></div>
          </button>)}
        </div>
      </div>
    </div>}
  </section>
}

function SummaryMetric({icon:Icon,label,value}){return <MetricCard icon={Icon} value={value} label={label}/>}
