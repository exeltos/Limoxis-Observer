import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, Microscope, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { downloadCsv } from '../../core/export/csvExport'
import { sampleSourceCatalog } from './laboratoryReferenceData'
import { createPatient, loadPatients } from '../patients/patientsService'
import { demoLibrarySeed } from '../management/managementData'
import { loadDepartments } from '../management/departmentsService'
import { MetricCard } from '../../design-system/MetricCard'
import { getLaboratoryKpis } from './laboratoryCloudService'
import { useLaboratoryRegistry } from './hooks/useLaboratoryRegistry'

const sourceOptions={
  bloodCulture:[['peripheral','peripheralBlood'],['centralLine','centralLine'],['arterialLine','arterialLine'],['other','other']],
  urineCulture:[['midstream','midstreamUrine'],['urinaryCatheter','urinaryCatheter'],['nephrostomy','nephrostomy'],['suprapubicCatheter','suprapubicCatheter'],['other','other']],
  respiratorySample:[['sputum','sputum'],['trachealAspirate','trachealAspirate'],['bal','bal'],['other','other']],
  woundCulture:[['woundSwab','woundSwab'],['deepTissue','deepTissue'],['drainage','drainage'],['other','other']],
}
export function LaboratoryWorkspace(){
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {canAccessRecord,tenant,isDemo}=useTenant()
  const {rows:repositoryRows,createSample:createRepositorySample}=useLaboratoryRegistry()
  const navigate=useNavigate()
  const registry=useRegistryMemory('laboratory')
  const saved=registry.loadViewState({query:'',status:'all',result:'all',department:'all'})
  const [query,setQuery]=useState(saved.query)
  const [status,setStatus]=useState(saved.status)
  const [result,setResult]=useState(saved.result)
  const [department,setDepartment]=useState(saved.department)
  const [newOpen,setNewOpen]=useState(false)
  const [patients,setPatients]=useState([])
  const [departmentOptions,setDepartmentOptions]=useState([])
  useEffect(()=>{
    let alive=true
    Promise.all([
      loadPatients(tenant?.id,{isDemo}),
      isDemo?Promise.resolve(demoLibrarySeed.departments.map(([name,nameEn])=>({id:name,name,nameEn}))):loadDepartments(tenant?.id),
    ]).then(([patientRows,departmentRows])=>{if(alive){setPatients(patientRows);setDepartmentOptions(departmentRows)}}).catch(()=>{})
    return ()=>{alive=false}
  },[tenant?.id,isDemo])
  const k=getLaboratoryKpis(repositoryRows)
  const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'
  const departments=[...new Set(repositoryRows.map(s=>language==='el'?s.department:s.departmentEn).filter(Boolean))]
  const rows=useMemo(
    ()=>repositoryRows
      .filter(s=>canAccessRecord(s))
      .filter(s=>`${s.id} ${s.patient} ${s.patientEn} ${s.patientId} ${s.organism??''} ${s.surveillanceCase??''}`.toLowerCase().includes(query.toLowerCase()))
      .filter(s=>status==='all'||s.status===status)
      .filter(s=>result==='all'||(result==='critical'?s.critical:s.result===result))
      .filter(s=>department==='all'||(language==='el'?s.department:s.departmentEn)===department),
    [query,status,result,department,language,repositoryRows,canAccessRecord]
  )

  async function createSample(draft){
    try{
      let patient=patients.find(item=>item.id===draft.patientId)
      if(draft.newPatient&&!isDemo){
        const names=String(draft.patient||draft.patientEn||'').trim().split(/\s+/)
        const created=await createPatient(tenant?.id,patients,{patientCode:draft.patientId,firstName:names.shift()||'',lastName:names.join(' ')||'',departmentId:draft.departmentId||null,department:draft.department,departmentEn:draft.departmentEn,admissionDate:new Date().toISOString().slice(0,10),status:'active'},{isDemo:false})
        patient=created.record
        setPatients(created.list)
      }
      await createRepositorySample({patientRecordId:patient?.recordId||null,draft:{...draft,subjectType:'patient',subjectName:draft.patient,subjectNameEn:draft.patientEn,subjectCode:draft.patientId}})
      setNewOpen(false)
      notify(t('laboratoryRecords.sampleCreated'),'success')
    }catch(error){notify(error?.message||t('actionFailed'),'error')}
  }

  function openSample(sample){
    registry.saveViewState({query,status,result,department})
    registry.openRecord(navigate,`/laboratory/${sample.id}`,sample.id,rows.map(x=>x.id))
  }

  function pageAction(action){
    if(action===UI_ACTIONS.CREATE){setNewOpen(true);return}
    if(action===UI_ACTIONS.PRINT){window.print();notify(t('printReadyMessage'),'success');return}
    if(action===UI_ACTIONS.EXPORT){
      downloadCsv('limoxis-laboratory.csv',[t('code'),t('exportSubject'),t('department'),t('exportSample'),t('status'),t('result'),t('exportOrganism')],
        rows.map(x=>[x.id,language==='el'?x.patient:x.patientEn,language==='el'?x.department:x.departmentEn,t(x.type),t(x.status),x.result?t(x.result):'',x.organism||'']))
      notify(t('laboratoryListExported'),'success')
    }
  }
  return <Page fill title={t('laboratory')} subtitle={t('laboratoryRecords.labSubtitle')} actions={<RecordActions actions={[UI_ACTIONS.CREATE,UI_ACTIONS.PRINT,UI_ACTIONS.EXPORT]} actionCapabilities={{[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_LAB_SAMPLES}} onAction={pageAction}/>}>
    <div className="workspace-summary">
      <div className="lab-kpis">
        <LabKpi icon={FlaskConical} label={t('laboratoryRecords.newSamplesToday')} value={k.today}/>
        <LabKpi icon={Clock3} label={t('laboratoryRecords.pendingResults')} value={k.pending}/>
        <LabKpi icon={Microscope} label={t('laboratoryRecords.positiveResults')} value={k.positive}/>
        <LabKpi icon={ShieldAlert} label={t('laboratoryRecords.amrFindings')} value={k.amr}/>
        <LabKpi icon={AlertTriangle} label={t('laboratoryRecords.uncommunicatedCritical')} value={k.critical} danger={k.critical>0}/>
      </div>
      <div className="governance-banner"><CheckCircle2 size={17}/><span>{t('laboratoryRecords.labGovernanceNote')}</span></div>
    </div>

    <section className="surface workspace-fill lab-registry-shell">
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('laboratoryRecords.searchLab')}
        activeAdvancedCount={(status!=='all'?1:0)+(department!=='all'?1:0)+(result!=='all'?1:0)}
        onClear={()=>{setQuery('');setStatus('all');setResult('all');setDepartment('all')}}
      >
        <FilterSelect label={t('status')} value={status} onChange={setStatus}>
          <option value="all">{t('all')}</option>
          <option value="requested">{t('requested')}</option>
          <option value="received">{t('received')}</option>
          <option value="processing">{t('processing')}</option>
          <option value="completed">{t('completed')}</option>
          <option value="rejected">{t('rejected')}</option>
        </FilterSelect>
        <FilterSelect label={t('department')} value={department} onChange={setDepartment}>
          <option value="all">{t('allDepartments')}</option>
          {departments.map(x=><option key={x} value={x}>{x}</option>)}
        </FilterSelect>
        <FilterSelect label={t('result')} value={result} onChange={setResult}>
          <option value="all">{t('all')}</option>
          <option value="positive">{t('positive')}</option>
          <option value="negative">{t('negative')}</option>
          <option value="critical">{t('criticalResult')}</option>
        </FilterSelect>
      </FilterBar>

      <div className="scroll-table" ref={registry.scrollRef}>
        <table className="data-table lab-table sticky-table">
          <thead><tr><th>{t('sampleCode')}</th><th>{t('laboratoryRecords.subject')}</th><th>{t('sampleType')}</th><th>{t('clinicalSource')}</th><th>{t('status')}</th><th>{t('result')}</th><th>{t('surveillance')}</th></tr></thead>
          <tbody>{rows.map(sample=><tr key={sample.id} {...registry.rowProps(sample.id)} onClick={()=>openSample(sample)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSample(sample)}}}>
            <td><strong>{sample.id}</strong><small>{fmt(sample.collectedAt)}</small></td>
            <td><strong>{language==='el'?sample.patient:sample.patientEn}</strong><small>{sample.patientId} · {language==='el'?sample.department:sample.departmentEn}</small></td>
            <td>{t(sample.type)}</td>
            <td>{language==='el'?sample.source:sample.sourceEn}{sample.anatomicalSite&&<small>{sample.anatomicalSite}</small>}</td>
            <td><Status text={t(sample.status)} kind={sample.status}/></td>
            <td><div className="lab-result-cell">{sample.result?<Status text={t(sample.result)} kind={sample.result}/>:<span>—</span>}{sample.resistance&&<b className="amr-chip">{sample.resistance}</b>}{sample.critical&&<span className="critical-mini" title={t('criticalResult')}>!</span>}</div></td>
            <td>{(sample.surveillanceCase||sample.employeeSurveillanceCase||sample.environmentalSurveillanceCase)?<span className="linked-case-chip">{sample.surveillanceCase||sample.employeeSurveillanceCase||sample.environmentalSurveillanceCase}</span>:'—'}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>

    {newOpen&&<NewSampleCard t={t} language={language} patients={patients} departments={departmentOptions} onClose={()=>setNewOpen(false)} onSave={createSample}/>} 
  </Page>
}

function LabKpi({icon:Icon,label,value,danger}){
  return <MetricCard icon={Icon} value={value} label={label} tone={danger?'danger':'neutral'}/>
}

export function Status({text,kind}){
  return <span className={`lab-status ${kind}`}>{text}</span>
}

function NewSampleCard({t,language,patients,departments,onClose,onSave}){
  const [patientMode,setPatientMode]=useState('existing')
  const first=patients.find(x=>x.status==='active')||patients[0]
  const [draft,setDraft]=useState({
    patient:first?.name||'',
    patientEn:first?.nameEn||'',
    patientId:first?.id||'',
    patientRecordId:first?.recordId||null,
    newPatient:false,
    departmentId:first?.departmentId||null,
    department:first?.department||'',
    departmentEn:first?.departmentEn||'',
    type:'bloodCulture',
    source:sampleSourceCatalog.peripheral.el,
    sourceEn:sampleSourceCatalog.peripheral.en,
    sourceCode:'peripheral',
    anatomicalSite:'',
    collectedAt:new Date().toISOString().slice(0,16),
    receivedAt:null,
    priority:'routine',
    surveillanceCase:null,
  })
  const set=(k,v)=>setDraft(x=>({...x,[k]:v}))

  function choosePatient(id){
    const patient=patients.find(x=>x.id===id)
    if(patient)setDraft(d=>({...d,patient:patient.name,patientEn:patient.nameEn,patientId:patient.id,patientRecordId:patient.recordId||null,newPatient:false,departmentId:patient.departmentId||null,department:patient.department,departmentEn:patient.departmentEn}))
  }

  function setDepartment(id){
    const item=departments.find(value=>value.id===id)
    setDraft(d=>({...d,departmentId:id,department:item?.name||'',departmentEn:item?.nameEn||item?.name||''}))
  }

  function setType(type){
    const firstSource=(sourceOptions[type]||[])[0]?.[0]||'other'
    const source=sampleSourceCatalog[firstSource]||{el:firstSource,en:firstSource}
    setDraft(d=>({...d,type,sourceCode:firstSource,source:source.el,sourceEn:source.en,anatomicalSite:''}))
  }

  function setSource(code){
    const source=sampleSourceCatalog[code]||{el:code,en:code}
    setDraft(d=>({...d,sourceCode:code,source:source.el,sourceEn:source.en}))
  }

  return <div className="modal-backdrop"><div className="entry-card lab-entry-card">
    <header><div><span className="eyebrow">{t('laboratoryRecords.newSample')}</span><h3>{t('sampleDetails')}</h3></div><button className="icon-close" onClick={onClose}>×</button></header>
    <div className="entry-mode-switch">
      <button className={patientMode==='existing'?'active':''} onClick={()=>{setPatientMode('existing');choosePatient(first?.id||'')}}>{t('existingPatient')}</button>
      <button className={patientMode==='new'?'active':''} onClick={()=>{setPatientMode('new');setDraft(d=>({...d,patient:'',patientEn:'',patientId:'',patientRecordId:null,newPatient:true,surveillanceCase:null}))}}>{t('laboratoryRecords.newPatientInline')}</button>
    </div>
    <div className="entry-grid">
      {patientMode==='existing'
        ?<label className="entry-span-2"><span>{t('patient')}</span><select value={draft.patientId} onChange={e=>choosePatient(e.target.value)}>{patients.filter(x=>x.status==='active').map(patient=><option key={patient.id} value={patient.id}>{language==='el'?patient.name:patient.nameEn} · {patient.id}</option>)}</select></label>
        :<><label><span>{t('patient')}</span><input value={language==='el'?draft.patient:draft.patientEn} onChange={e=>set(language==='el'?'patient':'patientEn',e.target.value)}/></label><label><span>{t('patientId')}</span><input value={draft.patientId} onChange={e=>set('patientId',e.target.value)}/></label></>
      }
      <label><span>{t('department')}</span><select value={draft.departmentId||''} onChange={e=>setDepartment(e.target.value)}>{departments.map(item=><option key={item.id} value={item.id}>{language==='el'?item.name:(item.nameEn||item.name)}</option>)}</select></label>
      <label><span>{t('sampleType')}</span><select value={draft.type} onChange={e=>setType(e.target.value)}><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label>
      <label><span>{t('collectionSource')}</span><select value={draft.sourceCode} onChange={e=>setSource(e.target.value)}>{(sourceOptions[draft.type]||[]).map(([code])=><option key={code} value={code}>{t(sampleSourceCatalog[code]?.label||code)}</option>)}</select></label>
      <label><span>{t('anatomicalSite')}</span><input value={draft.anatomicalSite} onChange={e=>set('anatomicalSite',e.target.value)}/></label>
      <label><span>{t('collectedLabel')}</span><input type="datetime-local" value={draft.collectedAt} onChange={e=>set('collectedAt',e.target.value)}/></label>
      <label><span>{t('priority')}</span><select value={draft.priority} onChange={e=>set('priority',e.target.value)}><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label>
    </div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={!draft.patientId||!(draft.patient||draft.patientEn)} onClick={()=>onSave(draft)}>{t('save')}</SaveButton></footer>
  </div></div>
}
