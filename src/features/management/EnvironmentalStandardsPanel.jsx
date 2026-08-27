import { useMemo, useState } from 'react'
import { Edit3, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { demoLibrarySeed } from './managementData'

const storageKey='limoxis.environmentalStandards.v1'
const empty={protocolCode:'',subjectType:'surface',sourceCode:'surfaceSwab',unit:'CFU',limitCfu:'',active:true}

export function readEnvironmentalStandards(){
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null')
    return Array.isArray(saved)?saved:demoLibrarySeed.environmentalStandards
  }catch{return demoLibrarySeed.environmentalStandards}
}
export function EnvironmentalStandardsPanel(){
  const {t}=useLanguage();const {notify}=useFeedback()
  const [rows,setRows]=useState(()=>readEnvironmentalStandards())
  const [query,setQuery]=useState('')
  const [draft,setDraft]=useState(null)
  const filtered=useMemo(()=>rows.filter(x=>`${x.protocolCode} ${x.subjectType} ${x.sourceCode} ${x.unit}`.toLowerCase().includes(query.toLowerCase())),[rows,query])
  function persist(next){setRows(next);localStorage.setItem(storageKey,JSON.stringify(next));window.dispatchEvent(new CustomEvent('limoxis:environmental-standards-updated'))}
  function save(){
    if(!draft.protocolCode.trim()||!draft.subjectType||!draft.unit.trim()){notify(t('completeRequiredFields'),'error');return}
    const limit=draft.limitCfu===''?null:Number(draft.limitCfu)
    if(limit!==null&&(!Number.isFinite(limit)||limit<0)){notify(t('environmentalStandards.invalidLimit'),'error');return}
    const item={...draft,protocolCode:draft.protocolCode.trim(),unit:draft.unit.trim(),limitCfu:limit,id:draft.id||`ENV-${Date.now()}`}
    persist(draft.id?rows.map(x=>x.id===draft.id?item:x):[...rows,item]);setDraft(null);notify(t('environmentalStandards.environmentalProtocolSaved'),'success')
  }
  function remove(item){if(!confirm(t('environmentalStandards.confirmEnvironmentalProtocolDelete')))return;persist(rows.filter(x=>x.id!==item.id));notify(t('environmentalStandards.environmentalProtocolDeleted'),'success')}
  return <section className="management-section management-scroll-section">
    <div className="section-toolbar"><div><h2>{t('environmentalProtocols')}</h2><p>{t('environmentalStandards.environmentalProtocolsSubtitle')}</p></div><Button onClick={()=>setDraft({...empty})}><Plus size={15}/>{t('environmentalStandards.newEnvironmentalProtocol')}</Button></div>
    <div className="governance-banner"><ShieldCheck size={16}/><span>{t('environmentalStandards.environmentalProtocolsGovernance')}</span></div>
    <FilterBar compact query={query} onQueryChange={setQuery} placeholder={t('environmentalStandards.searchEnvironmentalProtocols')} onClear={()=>setQuery('')}/>
    <div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('environmentalStandards.protocolCode')}</th><th>{t('environmentalStandards.samplingCategory')}</th><th>{t('samplingMethod')}</th><th>{t('environmentalStandards.measurementUnit')}</th><th>{t('environmentalStandards.acceptableLimit')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><strong>{item.protocolCode}</strong></td><td>{t(item.subjectType)}</td><td>{t(item.sourceCode)}</td><td>{item.unit}</td><td><strong>{item.limitCfu??t('notConfigured')}</strong></td><td><span className={`status-badge ${item.active?'active':''}`}>{item.active?t('active'):t('environmentalStandards.protocolInactive')}</span></td><td><div className="row-actions"><button className="icon-button" title={t('edit')} onClick={()=>setDraft({...item,limitCfu:item.limitCfu??''})}><Edit3 size={15}/></button><button className="icon-button danger" title={t('delete')} onClick={()=>remove(item)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
    {draft&&<div className="modal-backdrop"><div className="role-editor environmental-standard-editor" role="dialog" aria-modal="true"><header><div><h3>{draft.id?t('environmentalStandards.editEnvironmentalProtocol'):t('environmentalStandards.newEnvironmentalProtocol')}</h3><p>{t('environmentalStandards.environmentalProtocolEditorHelp')}</p></div><button className="icon-button" onClick={()=>setDraft(null)}><X size={17}/></button></header>
      <div className="form-grid two-col">
        <label className="field"><span>{t('environmentalStandards.protocolCode')}</span><input value={draft.protocolCode} readOnly={Boolean(draft.id)} onChange={e=>setDraft({...draft,protocolCode:e.target.value})}/><small>{draft.id?t('environmentalStandards.protocolCodeLockedHelp'):t('environmentalStandards.protocolCodeHelp')}</small></label>
        <label className="field"><span>{t('environmentalStandards.samplingCategory')}</span><select value={draft.subjectType} onChange={e=>setDraft({...draft,subjectType:e.target.value})}><option value="surface">{t('environmentalStandards.surface')}</option><option value="room">{t('environmentalStandards.roomCategory')}</option><option value="air">{t('environmentalStandards.air')}</option><option value="water">{t('environmentalStandards.water')}</option></select></label>
        <label className="field"><span>{t('samplingMethod')}</span><select value={draft.sourceCode} onChange={e=>setDraft({...draft,sourceCode:e.target.value})}><option value="surfaceSwab">{t('environmentalStandards.surfaceSwab')}</option><option value="contactPlate">{t('environmentalStandards.contactPlate')}</option><option value="roomSampling">{t('environmentalStandards.roomSampling')}</option><option value="activeAir">{t('environmentalStandards.activeAir')}</option><option value="passiveAir">{t('environmentalStandards.passiveAir')}</option><option value="waterSampling">{t('environmentalStandards.waterSampling')}</option></select></label>
        <label className="field"><span>{t('environmentalStandards.measurementUnit')}</span><select value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value})}><option value="CFU">CFU</option><option value="CFU/cm²">CFU/cm²</option><option value="CFU/plate">CFU/plate</option><option value="CFU/m³">CFU/m³</option><option value="CFU/mL">CFU/mL</option><option value="CFU/100mL">CFU/100mL</option></select><small>{t('environmentalStandards.measurementUnitHelp')}</small></label>
        <label className="field"><span>{t('environmentalStandards.acceptableLimit')}</span><div className="field-with-suffix"><input type="number" min="0" step="any" value={draft.limitCfu} onChange={e=>setDraft({...draft,limitCfu:e.target.value})} placeholder={t('environmentalStandards.enterProtocolLimit')}/><span>{draft.unit}</span></div><small>{t('environmentalStandards.acceptableLimitHelp')}</small></label>
        <label className="field checkbox-field"><span>{t('status')}</span><label><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>{t('active')}</label></label>
      </div>
      <footer><Button variant="secondary" onClick={()=>setDraft(null)}>{t('cancel')}</Button><Button onClick={save}>{t('save')}</Button></footer>
    </div></div>}
  </section>
}
