import { useState } from 'react'
import { Building2, Droplets, Layers3, Plus, Wind, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { demoLibrarySeed } from '../management/managementData'
import { createEnvironmentalBatch, createEnvironmentalSurveillance, environmentalSourceCatalog, environmentalSubjectCatalog } from './environmentalSurveillanceData'

const icons={surface:Layers3,room:Building2,air:Wind,water:Droplets}
const sourceByType={
  surface:['surfaceSwab','contactPlate','other'],
  room:['roomSampling','surfaceSwab','contactPlate','other'],
  air:['activeAir','passiveAir','airSampling','other'],
  water:['tapWater','showerWater','waterSampling','other'],
}

export function EnvironmentalSurveillanceFlow({onClose,onCreated}){
  const actor=useAuditActor()
  const {t,language}=useLanguage()
  const {notify,confirm}=useFeedback()
  const [subjectType,setSubjectType]=useState('surface')
  const [mode,setMode]=useState('single')
  const [grouping,setGrouping]=useState('plate')
  const [department,setDepartment]=useState('')
  const [location,setLocation]=useState('')
  const [point,setPoint]=useState('')
  const [sourceCode,setSourceCode]=useState('surfaceSwab')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [notes,setNotes]=useState('')
  const [batchRows,setBatchRows]=useState([{id:1,location:'',point:'',plateCode:'A',platePosition:'1'}])

  function chooseType(type){
    setSubjectType(type)
    const cfg=environmentalSubjectCatalog.find(x=>x.id===type)
    setSourceCode(cfg?.defaultSource||'other')
    setGrouping(cfg?.supportsPlate?'plate':'individual')
  }
  function departmentPair(){
    return demoLibrarySeed.departments.find(([el])=>el===department)||[department,department]
  }
  function save(){
    if(!department||!date)return
    const [depEl,depEn]=departmentPair()
    if(mode==='single'){
      if(!location.trim()&&!point.trim())return
      const record=createEnvironmentalSurveillance({
        subjectType,department:depEl,departmentEn:depEn,location,point,sourceCode,startedAt:date,notes,createdBy:actor.name,
      })
      notify(t('clinicalRecords.environmentalSurveillanceCreated'),'success')
      onCreated?.(record)
      onClose()
      return
    }
    const items=batchRows.filter(x=>x.location.trim()||x.point.trim()).map(x=>({location:x.location,point:x.point,plateCode:x.plateCode,platePosition:x.platePosition,department:depEl,departmentEn:depEn}))
    if(!items.length)return
    const batch=createEnvironmentalBatch({items,subjectType,startedAt:date,department:depEl,departmentEn:depEn,sourceCode,notes,grouping,createdBy:actor.name})
    notify(t('clinicalRecords.environmentalBatchCreated').replace('{count}',String(items.length)),'success')
    onCreated?.(batch)
    onClose()
  }
  const updateRow=(id,key,value)=>setBatchRows(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row))
  const removeRow=async id=>{const ok=await confirm({title:language==='el'?'Αφαίρεση σημείου':'Remove sampling point',message:language==='el'?'Το σημείο δειγματοληψίας θα αφαιρεθεί από την τρέχουσα καταχώρηση. Θέλετε να συνεχίσετε;':'The sampling point will be removed from the current entry. Do you want to continue?',confirmLabel:language==='el'?'Αφαίρεση':'Remove',danger:true});if(!ok)return;setBatchRows(rows=>rows.filter(row=>row.id!==id));notify(language==='el'?'Το σημείο αφαιρέθηκε.':'Sampling point removed.','success')}
  const addRow=()=>setBatchRows(rows=>[...rows,{id:Date.now(),location:'',point:'',plateCode:rows.at(-1)?.plateCode||'A',platePosition:String(rows.length+1)}])
  const sources=sourceByType[subjectType]||['other']

  return <div className="modal-backdrop"><div className="entry-card environmental-surveillance-entry">
    <header><div><span className="eyebrow">{t('environmentalSurveillance')}</span><h3>{t('clinicalRecords.newEnvironmentalSurveillance')}</h3><p>{t('clinicalRecords.environmentalSurveillanceHelp')}</p></div><button className="icon-close" onClick={onClose}><X size={18}/></button></header>

    <div className="environmental-type-grid">{environmentalSubjectCatalog.map(item=>{const Icon=icons[item.id];return <button type="button" key={item.id} className={subjectType===item.id?'active':''} onClick={()=>chooseType(item.id)}><Icon size={18}/><strong>{t(item.label)}</strong></button>})}</div>
    <div className="entry-mode-switch environmental-mode-switch"><button className={mode==='single'?'active':''} onClick={()=>setMode('single')}>{t('clinicalRecords.singleSampling')}</button><button className={mode==='batch'?'active':''} onClick={()=>setMode('batch')}>{t('clinicalRecords.bulkSampling')}</button></div>
    {mode==='batch'&&environmentalSubjectCatalog.find(x=>x.id===subjectType)?.supportsPlate&&<div className="environmental-grouping-box">
      <span>{t('clinicalRecords.laboratoryOrganization')}</span>
      <div className="entry-mode-switch">
        <button className={grouping==='plate'?'active':''} onClick={()=>setGrouping('plate')}>{t('clinicalRecords.groupByPlate')}</button>
        <button className={grouping==='individual'?'active':''} onClick={()=>setGrouping('individual')}>{t('clinicalRecords.individualSamples')}</button>
      </div>
      <small>{grouping==='plate'?t('clinicalRecords.plateGroupingHelp'):t('clinicalRecords.individualGroupingHelp')}</small>
    </div>}

    <div className="entry-grid">
      <label><span>{t('department')}</span><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">{t('select')}</option>{demoLibrarySeed.departments.map(([el,en])=><option key={el} value={el}>{language==='el'?el:en}</option>)}</select></label>
      <ManualDateField label={t('samplingDate')} value={date} onChange={setDate}/>
      <label><span>{t('samplingMethod')}</span><select value={sourceCode} onChange={e=>setSourceCode(e.target.value)}>{sources.map(code=><option key={code} value={code}>{t(environmentalSourceCatalog[code]?.label||code)}</option>)}</select></label>
    </div>

    {mode==='single'?<div className="entry-grid environmental-point-fields">
      <label><span>{t('locationArea')}</span><input value={location} onChange={e=>setLocation(e.target.value)} placeholder={t('clinicalRecords.locationAreaPlaceholder')}/></label>
      <label><span>{t('samplingPoint')}</span><input value={point} onChange={e=>setPoint(e.target.value)} placeholder={t('clinicalRecords.samplingPointPlaceholder')}/></label>
    </div>:<div className="environmental-batch-points">
      <div className="batch-point-head"><strong>{t('samplingPoints')}</strong><Button variant="secondary" onClick={addRow}><Plus size={14}/>{t('clinicalRecords.addPoint')}</Button></div>
      <div className={`batch-point-columns ${grouping==='plate'?'plate':''}`}><span>#</span><span>{t('locationArea')}</span><span>{t('samplingPoint')}</span>{grouping==='plate'&&<><span>{t('plate')}</span><span>{t('position')}</span></>}<span></span></div>
      {batchRows.map((row,index)=><div className={`batch-point-row ${grouping==='plate'?'with-plate':''}`} key={row.id}><span>{String(index+1).padStart(2,'0')}</span><input value={row.location} onChange={e=>updateRow(row.id,'location',e.target.value)} placeholder={t('locationArea')}/><input value={row.point} onChange={e=>updateRow(row.id,'point',e.target.value)} placeholder={t('samplingPoint')}/>{grouping==='plate'&&<><input className="plate-code-input" value={row.plateCode} onChange={e=>updateRow(row.id,'plateCode',e.target.value.toUpperCase())} placeholder="A"/><input className="plate-position-input" value={row.platePosition} onChange={e=>updateRow(row.id,'platePosition',e.target.value)} placeholder="1"/></>}{batchRows.length>1&&<button className="danger" onClick={()=>removeRow(row.id)}>×</button>}</div>)}
    </div>}

    <label className="environmental-notes"><span>{t('notes')}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
    <div className="source-truth-note">{grouping==='plate'&&mode==='batch'?t('clinicalRecords.environmentalPlateCreatesLabRequests'):t('clinicalRecords.environmentalCreatesLabRequests')}</div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={!department||!date||(mode==='single'&&!location.trim()&&!point.trim())||(mode==='batch'&&!batchRows.some(x=>x.location.trim()||x.point.trim()))} onClick={save}>{t('createSurveillance')}</Button></footer>
  </div></div>
}

export function EnvironmentalRegistry({records,batches,t,language,fmt,onOpenSample}){
  return <section className="surface workspace-fill environmental-registry">
    <div className="registry-section-heading"><div><span className="eyebrow">{t('environmentalSurveillance')}</span><h3>{t('clinicalRecords.environmentalSurveillanceRegistry')}</h3><p>{t('clinicalRecords.environmentalSurveillanceRegistryHelp')}</p></div></div>
    <div className="environmental-summary-strip">{['surface','room','air','water'].map(type=><div key={type}><strong>{records.filter(x=>x.subjectType===type).length}</strong><span>{t(environmentalSubjectCatalog.find(x=>x.id===type)?.label||type)}</span></div>)}</div>
    <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('surveillance')}</th><th>{t('clinicalRecords.type')}</th><th>{t('department')}</th><th>{t('locationArea')}</th><th>{t('samplingPoint')}</th><th>{t('samplingDate')}</th><th>{t('batch')}</th><th>{t('clinicalRecords.platePosition')}</th><th>{t('result')}</th><th>{t('status')}</th></tr></thead><tbody>{records.map(row=><tr key={row.id} className="registry-row-clickable" tabIndex={0} onClick={()=>onOpenSample?.(row.sampleId)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&row.sampleId){e.preventDefault();onOpenSample?.(row.sampleId)}}}><td><strong>{row.id}</strong></td><td>{t(environmentalSubjectCatalog.find(x=>x.id===row.subjectType)?.label||row.subjectType)}</td><td>{language==='el'?row.department:row.departmentEn}</td><td>{language==='el'?row.location:row.locationEn}</td><td>{language==='el'?row.point:row.pointEn}</td><td>{fmt(row.startedAt)}</td><td>{row.batchId||'—'}</td><td>{row.plateCode?`${t('plate')} ${row.plateCode} · ${t('position')} ${row.platePosition}`:'—'}</td><td>{row.result?<span className="environment-result-cell"><strong>{t(row.result)}</strong>{row.cfu!==null&&row.cfu!==''&&<small>{row.cfu} CFU</small>}{row.withinLimit===true&&<b className="limit-ok">{t('withinLimits')}</b>}{row.withinLimit===false&&<b className="limit-bad">{t('outsideLimits')}</b>}</span>:'—'}</td><td><span className={`status-badge ${row.status==='active'?'active':''}`}>{t(row.status)}</span></td></tr>)}</tbody></table></div>
    {batches.length>0&&<div className="environmental-batch-summary"><strong>{t('clinicalRecords.environmentalBatches')}</strong><span>{batches.length}</span></div>}
  </section>
}
