import { useState } from 'react'
import { Building2, Droplets, Layers3, Plus, Wind, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { environmentalMethodLabel, sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { environmentalSubjectCatalog } from './environmentalSurveillanceData'

const icons={surface:Layers3,room:Building2,air:Wind,water:Droplets}
const sourceByType={
  surface:['surfaceSwab','contactPlate','other'],
  room:['roomSampling','surfaceSwab','contactPlate','other'],
  air:['activeAir','passiveAir','airSampling','other'],
  water:['tapWater','showerWater','waterSampling','other'],
}

export function EnvironmentalSurveillanceFlow({isDemo,departmentOptions=[],createSample,onClose,onCreated}){
  const {t,language}=useLanguage()
  const {notify,notifyError,confirm}=useFeedback()
  const [subjectType,setSubjectType]=useState('surface')
  const [mode,setMode]=useState('single')
  const [departmentValue,setDepartmentValue]=useState('')
  const [location,setLocation]=useState('')
  const [point,setPoint]=useState('')
  const [sourceCode,setSourceCode]=useState('surfaceSwab')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [notes,setNotes]=useState('')
  const [batchRows,setBatchRows]=useState([{id:1,location:'',point:''}])
  const [saving,setSaving]=useState(false)

  function chooseType(type){
    setSubjectType(type)
    const cfg=environmentalSubjectCatalog.find(x=>x.id===type)
    setSourceCode(cfg?.defaultSource||'other')
  }

  function departmentFields(){
    const dep=departmentOptions.find(x=>x.value===departmentValue)
    if(!dep)return isDemo?{department:'',departmentEn:''}:{departmentId:null}
    return isDemo?{department:dep.label,departmentEn:dep.labelEn||dep.label}:{departmentId:dep.value}
  }

  function buildDraft(entryLocation,entryPoint,batchId){
    const subjectName=[entryLocation,entryPoint].filter(Boolean).join(' · ')
    return {
      subjectType:'environment',
      type:subjectType,
      environmentalMethod:sourceCode,
      subjectName,subjectNameEn:subjectName,subjectCode:'ENV',
      location:entryLocation,point:entryPoint,
      environmentalBatchId:batchId||null,
      collectedAt:date,priority:'routine',notes,
      ...departmentFields(),
    }
  }

  async function save(){
    if(!date||saving)return
    setSaving(true)
    try{
      if(mode==='single'){
        if(!location.trim()&&!point.trim())return
        await createSample({patientRecordId:null,draft:buildDraft(location.trim(),point.trim())})
        notify(t('clinicalRecords.environmentalSurveillanceCreated'),'success')
        onCreated?.()
        onClose()
        return
      }
      const items=batchRows.filter(x=>x.location.trim()||x.point.trim())
      if(!items.length)return
      const batchId=items.length>1?`ENVB-${Date.now()}`:null
      for(const item of items){
        await createSample({patientRecordId:null,draft:buildDraft(item.location.trim(),item.point.trim(),batchId)})
      }
      notify(t('clinicalRecords.environmentalBatchCreated').replace('{count}',String(items.length)),'success')
      onCreated?.()
      onClose()
    }catch(error){
      notifyError(error,'save',{operation:'environmental_surveillance_create'})
    }finally{
      setSaving(false)
    }
  }

  const updateRow=(id,key,value)=>setBatchRows(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row))
  const removeRow=async id=>{const ok=await confirm({title:language==='el'?'Αφαίρεση σημείου':'Remove sampling point',message:language==='el'?'Το σημείο δειγματοληψίας θα αφαιρεθεί από την τρέχουσα καταχώρηση. Θέλετε να συνεχίσετε;':'The sampling point will be removed from the current entry. Do you want to continue?',confirmLabel:language==='el'?'Αφαίρεση':'Remove',danger:true});if(!ok)return;setBatchRows(rows=>rows.filter(row=>row.id!==id))}
  const addRow=()=>setBatchRows(rows=>[...rows,{id:Date.now(),location:'',point:''}])
  const sources=sourceByType[subjectType]||['other']

  return <div className="modal-backdrop"><div className="entry-card environmental-surveillance-entry">
    <header><div><span className="eyebrow">{t('environmentalSurveillance')}</span><h3>{t('clinicalRecords.newEnvironmentalSurveillance')}</h3><p>{t('clinicalRecords.environmentalSurveillanceHelp')}</p></div><button className="icon-close" onClick={onClose}><X size={18}/></button></header>

    <div className="environmental-type-grid">{environmentalSubjectCatalog.map(item=>{const Icon=icons[item.id];return <button type="button" key={item.id} className={subjectType===item.id?'active':''} onClick={()=>chooseType(item.id)}><Icon size={18}/><strong>{sampleTypeLabel(item.id,t)}</strong></button>})}</div>
    <div className="entry-mode-switch environmental-mode-switch"><button className={mode==='single'?'active':''} onClick={()=>setMode('single')}>{t('clinicalRecords.singleSampling')}</button><button className={mode==='batch'?'active':''} onClick={()=>setMode('batch')}>{t('clinicalRecords.bulkSampling')}</button></div>

    <div className="entry-grid">
      <label><span>{t('department')}</span><select value={departmentValue} onChange={e=>setDepartmentValue(e.target.value)}><option value="">{t('select')}</option>{departmentOptions.map(item=><option key={item.value} value={item.value}>{language==='el'?item.label:(item.labelEn||item.label)}</option>)}</select></label>
      <ManualDateField label={t('samplingDate')} value={date} onChange={setDate}/>
      <label><span>{t('samplingMethod')}</span><select value={sourceCode} onChange={e=>setSourceCode(e.target.value)}>{sources.map(code=><option key={code} value={code}>{environmentalMethodLabel(code,t)}</option>)}</select></label>
    </div>

    {mode==='single'?<div className="entry-grid environmental-point-fields">
      <label><span>{t('locationArea')}</span><input value={location} onChange={e=>setLocation(e.target.value)} placeholder={t('clinicalRecords.locationAreaPlaceholder')}/></label>
      <label><span>{t('samplingPoint')}</span><input value={point} onChange={e=>setPoint(e.target.value)} placeholder={t('clinicalRecords.samplingPointPlaceholder')}/></label>
    </div>:<div className="environmental-batch-points">
      <div className="batch-point-head"><strong>{t('samplingPoints')}</strong><Button variant="secondary" onClick={addRow}><Plus size={14}/>{t('clinicalRecords.addPoint')}</Button></div>
      <div className="batch-point-columns"><span>#</span><span>{t('locationArea')}</span><span>{t('samplingPoint')}</span><span></span></div>
      {batchRows.map((row,index)=><div className="batch-point-row" key={row.id}><span>{String(index+1).padStart(2,'0')}</span><input value={row.location} onChange={e=>updateRow(row.id,'location',e.target.value)} placeholder={t('locationArea')}/><input value={row.point} onChange={e=>updateRow(row.id,'point',e.target.value)} placeholder={t('samplingPoint')}/>{batchRows.length>1&&<button className="danger" onClick={()=>removeRow(row.id)}>×</button>}</div>)}
    </div>}

    <label className="environmental-notes"><span>{t('notes')}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
    <div className="source-truth-note">{t('clinicalRecords.environmentalCreatesLabRequests')}</div>
    <footer><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><Button disabled={saving||!date||(mode==='single'&&!location.trim()&&!point.trim())||(mode==='batch'&&!batchRows.some(x=>x.location.trim()||x.point.trim()))} onClick={save}>{t('createSurveillance')}</Button></footer>
  </div></div>
}

export function EnvironmentalRegistry({rows,summaryRows,t,language,fmt,onOpenSample}){
  const summary=summaryRows||rows
  return <section className="surface workspace-fill environmental-registry">
    <div className="registry-section-heading"><div><span className="eyebrow">{t('environmentalSurveillance')}</span><h3>{t('clinicalRecords.environmentalSurveillanceRegistry')}</h3><p>{t('clinicalRecords.environmentalSurveillanceRegistryHelp')}</p></div></div>
    <div className="environmental-summary-strip">{environmentalSubjectCatalog.map(item=><div key={item.id}><strong>{summary.filter(x=>x.type===item.id).length}</strong><span>{sampleTypeLabel(item.id,t)}</span></div>)}</div>
    <div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('surveillance')}</th><th>{t('clinicalRecords.type')}</th><th>{t('department')}</th><th>{t('locationArea')}</th><th>{t('samplingPoint')}</th><th>{t('samplingDate')}</th><th>{t('batch')}</th><th>{t('result')}</th><th>{t('status')}</th></tr></thead><tbody>{rows.map(row=>{const code=row.code||row.id;return <tr key={code} className="registry-row-clickable" tabIndex={0} onClick={()=>onOpenSample?.(code)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&code){e.preventDefault();onOpenSample?.(code)}}}><td><strong>{code}</strong></td><td>{sampleTypeLabel(row.type,t)}</td><td>{language==='el'?row.department:row.departmentEn}</td><td>{row.location||'—'}</td><td>{row.point||'—'}</td><td>{fmt(row.collectedAt||row.requestedAt)}</td><td>{row.environmentalBatchId||'—'}</td><td>{row.result?<span className="environment-result-cell"><strong>{t(row.result)}</strong>{row.microbiologyResults?.[0]?.cfuCount!=null&&<small>{row.microbiologyResults[0].cfuCount} CFU</small>}{row.microbiologyResults?.[0]?.withinLimit===true&&<b className="limit-ok">{t('withinLimits')}</b>}{row.microbiologyResults?.[0]?.withinLimit===false&&<b className="limit-bad">{t('outsideLimits')}</b>}</span>:'—'}</td><td><span className={`status-badge ${row.status==='completed'?'':'active'}`}>{t(row.status)}</span></td></tr>})}</tbody></table></div>
  </section>
}
