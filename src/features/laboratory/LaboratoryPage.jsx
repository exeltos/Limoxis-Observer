import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, Microscope, Plus, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { laboratorySamples, createDemoLabSample, getLabKpis, sampleSourceCatalog } from './laboratoryDemoData'
import { patientDemoData } from '../patients/patientDemoData'
import { demoLibrarySeed } from '../management/managementData'

const sourceOptions={
  bloodCulture:[['peripheral','peripheralBlood'],['centralLine','centralLine'],['arterialLine','arterialLine'],['other','other']],
  urineCulture:[['midstream','midstreamUrine'],['urinaryCatheter','urinaryCatheter'],['nephrostomy','nephrostomy'],['suprapubicCatheter','suprapubicCatheter'],['other','other']],
  respiratorySample:[['sputum','sputum'],['trachealAspirate','trachealAspirate'],['bal','bal'],['other','other']],
  woundCulture:[['woundSwab','woundSwab'],['deepTissue','deepTissue'],['drainage','drainage'],['other','other']],
}
export function LaboratoryPage(){
  const {t,language,locale}=useLanguage()
  const {notify}=useFeedback()
  const {role,membership,canAccessRecord}=useTenant()
  const navigate=useNavigate()
  const registry=useRegistryMemory('laboratory')
  const saved=registry.loadViewState({query:'',status:'all',result:'all',department:'all'})
  const [query,setQuery]=useState(saved.query)
  const [status,setStatus]=useState(saved.status)
  const [result,setResult]=useState(saved.result)
  const [department,setDepartment]=useState(saved.department)
  const [newOpen,setNewOpen]=useState(false)
  const [version,setVersion]=useState(0)
  const addOns=membership?.capabilities??[]
  const custom=membership?.customCapabilities??[]
  const canCreate=can(role,CAPABILITIES.MANAGE_LAB_SAMPLES,addOns,custom)
  const k=getLabKpis()
  const fmt=v=>v?new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'—'
  const departments=[...new Set(laboratorySamples.map(s=>language==='el'?s.department:s.departmentEn).filter(Boolean))]
  const rows=useMemo(
    ()=>laboratorySamples
      .filter(s=>`${s.id} ${s.patient} ${s.patientEn} ${s.patientId} ${s.organism??''} ${s.surveillanceCase??''}`.toLowerCase().includes(query.toLowerCase()))
      .filter(s=>status==='all'||s.status===status)
      .filter(s=>result==='all'||(result==='critical'?s.critical:s.result===result))
      .filter(s=>department==='all'||(language==='el'?s.department:s.departmentEn)===department),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version deliberately forces recompute after mutations to the shared demo array.
    [query,status,result,department,language,version]
  )

  function createSample(draft){
    const id=`LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(laboratorySamples.length+1).padStart(3,'0')}`
    createDemoLabSample({
      id,
      ...draft,
      status:'requested',
      result:null,
      resultStatus:'draft',
      organism:null,
      resistance:null,
      critical:false,
      ast:[],
      communications:[],
      attachments:[],
      timeline:[{at:new Date().toISOString(),type:'sampleRequested',actor:t('currentUser')}],
    })
    setVersion(v=>v+1)
    setNewOpen(false)
    notify(t('laboratoryRecords.sampleCreated'),'success')
  }

  function openSample(sample){
    registry.saveViewState({query,status,result,department})
    registry.openRecord(navigate,`/laboratory/${sample.id}`,sample.id)
  }

  return <Page fill title={t('laboratory')} subtitle={t('laboratoryRecords.labSubtitle')} actions={canCreate?<Button onClick={()=>setNewOpen(true)}><Plus size={15}/>{t('laboratoryRecords.newSample')}</Button>:null}>
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

    {newOpen&&<NewSampleCard t={t} language={language} onClose={()=>setNewOpen(false)} onSave={createSample}/>}
  </Page>
}

function LabKpi({icon:Icon,label,value,danger}){
  return <div className={`lab-kpi ${danger?'danger':''}`}><Icon size={18}/><div><strong>{value}</strong><span>{label}</span></div></div>
}

export function Status({text,kind}){
  return <span className={`lab-status ${kind}`}>{text}</span>
}

function NewSampleCard({t,language,onClose,onSave}){
  const [patientMode,setPatientMode]=useState('existing')
  const first=patientDemoData.find(x=>x.status==='active')||patientDemoData[0]
  const [draft,setDraft]=useState({
    patient:first?.name||'',
    patientEn:first?.nameEn||'',
    patientId:first?.id||'',
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
    const patient=patientDemoData.find(x=>x.id===id)
    if(patient)setDraft(d=>({...d,patient:patient.name,patientEn:patient.nameEn,patientId:patient.id,department:patient.department,departmentEn:patient.departmentEn}))
  }

  function setDepartment(el){
    const pair=demoLibrarySeed.departments.find(([value])=>value===el)
    setDraft(d=>({...d,department:el,departmentEn:pair?.[1]||el}))
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
      <button className={patientMode==='new'?'active':''} onClick={()=>{setPatientMode('new');setDraft(d=>({...d,patient:'',patientEn:'',patientId:'',surveillanceCase:null}))}}>{t('laboratoryRecords.newPatientInline')}</button>
    </div>
    <div className="entry-grid">
      {patientMode==='existing'
        ?<label className="entry-span-2"><span>{t('patient')}</span><select value={draft.patientId} onChange={e=>choosePatient(e.target.value)}>{patientDemoData.filter(x=>x.status==='active').map(patient=><option key={patient.id} value={patient.id}>{language==='el'?patient.name:patient.nameEn} · {patient.id}</option>)}</select></label>
        :<><label><span>{t('patient')}</span><input value={language==='el'?draft.patient:draft.patientEn} onChange={e=>set(language==='el'?'patient':'patientEn',e.target.value)}/></label><label><span>{t('patientId')}</span><input value={draft.patientId} onChange={e=>set('patientId',e.target.value)}/></label></>
      }
      <label><span>{t('department')}</span><select value={draft.department} onChange={e=>setDepartment(e.target.value)}>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
      <label><span>{t('sampleType')}</span><select value={draft.type} onChange={e=>setType(e.target.value)}><option value="bloodCulture">{t('bloodCulture')}</option><option value="urineCulture">{t('urineCulture')}</option><option value="respiratorySample">{t('respiratorySample')}</option><option value="woundCulture">{t('woundCulture')}</option></select></label>
      <label><span>{t('collectionSource')}</span><select value={draft.sourceCode} onChange={e=>setSource(e.target.value)}>{(sourceOptions[draft.type]||[]).map(([code])=><option key={code} value={code}>{t(sampleSourceCatalog[code]?.label||code)}</option>)}</select></label>
      <label><span>{t('anatomicalSite')}</span><input value={draft.anatomicalSite} onChange={e=>set('anatomicalSite',e.target.value)}/></label>
      <label><span>{t('collectedLabel')}</span><input type="datetime-local" value={draft.collectedAt} onChange={e=>set('collectedAt',e.target.value)}/></label>
      <label><span>{t('priority')}</span><select value={draft.priority} onChange={e=>set('priority',e.target.value)}><option value="routine">{t('routine')}</option><option value="urgent">{t('urgent')}</option><option value="critical">{t('critical')}</option></select></label>
    </div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!draft.patientId||!(draft.patient||draft.patientEn)} onClick={()=>onSave(draft)}>{t('save')}</Button></footer>
  </div></div>
}
