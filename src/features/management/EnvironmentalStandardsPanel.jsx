import { useMemo, useState } from 'react'
import { LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { demoLibrarySeed } from './managementData'
import { loadSnapshot } from '../../core/data/repository'
import { useRepositoryData } from '../../core/data/useRepositoryData'

const empty={protocolCode:'',subjectType:'surface',sourceCode:'surfaceSwab',unit:'CFU',limitCfu:'',active:true,system:false,locked:false,source:'Hospital',version:'local'}
const normalizeSystemStandards=rows=>(rows||[]).map(row=>row?.system===undefined?{...row,system:true,locked:true,source:'Limoxis System',version:'core'}:row)

export function readEnvironmentalStandards(){
  const saved=loadSnapshot('environmental_standards',normalizeSystemStandards(demoLibrarySeed.environmentalStandards))
  return Array.isArray(saved)?saved:normalizeSystemStandards(demoLibrarySeed.environmentalStandards)
}
export function EnvironmentalStandardsPanel({embedded=false}){
  const {t,language}=useLanguage();const {notify,confirm}=useFeedback();const {role,isDemo}=useTenant();const isPlatformOwner=role===ROLES.PLATFORM_OWNER
  const fallback=useMemo(()=>normalizeSystemStandards(demoLibrarySeed.environmentalStandards),[])
  const {data:repositoryRows,loading,saving,error,reload,saveData}=useRepositoryData('environmental_standards',{fallback})
  const rows=useMemo(()=>Array.isArray(repositoryRows)?repositoryRows:(isDemo?fallback:[]),[repositoryRows,isDemo,fallback])
  const [query,setQuery]=useState('')
  const [draft,setDraft]=useState(null)
  const readOnlySystem=Boolean(draft?.system&&!isPlatformOwner)
  const filtered=useMemo(()=>rows.filter(x=>`${x.protocolCode} ${x.subjectType} ${x.sourceCode} ${x.unit} ${x.source||''}`.toLowerCase().includes(query.toLowerCase())),[rows,query])
  async function persist(next){await saveData(next);window.dispatchEvent(new CustomEvent('limoxis:environmental-standards-updated'))}
  async function save(){
    if(readOnlySystem){notify(language==='en'?'System protocols can only be changed by the Platform Owner.':'Τα πρωτόκολλα συστήματος μπορούν να αλλάξουν μόνο από τον Platform Owner.','warning');return}
    if(!draft.protocolCode.trim()||!draft.subjectType||!draft.unit.trim()){notify(t('completeRequiredFields'),'error');return}
    const limit=draft.limitCfu===''?null:Number(draft.limitCfu)
    if(limit!==null&&(!Number.isFinite(limit)||limit<0)){notify(t('environmentalStandards.invalidLimit'),'error');return}
    const item={...draft,protocolCode:draft.protocolCode.trim(),unit:draft.unit.trim(),limitCfu:limit,id:draft.id||`ENV-${Date.now()}`,system:Boolean(draft.system),locked:Boolean(draft.system),source:draft.system?(draft.source||'Limoxis System'):'Hospital',version:draft.system?(draft.version||'core'):'local'}
    try{await persist(draft.id?rows.map(x=>x.id===draft.id?item:x):[...rows,item]);setDraft(null);notify(t('environmentalStandards.environmentalProtocolSaved'),'success')}catch{return}
  }
  async function remove(item){
    if(item.system&&!isPlatformOwner){notify(language==='en'?'System protocols can only be deleted by the Platform Owner.':'Τα πρωτόκολλα συστήματος μπορούν να διαγραφούν μόνο από τον Platform Owner.','warning');return}
    const ok=await confirm({title:t('delete'),message:t('environmentalStandards.confirmEnvironmentalProtocolDelete'),confirmLabel:t('delete'),danger:true})
    if(!ok)return
    try{await persist(rows.filter(x=>x.id!==item.id));notify(t('environmentalStandards.environmentalProtocolDeleted'),'success')}catch{return}
  }
  return <section className={embedded?"environmental-embedded management-scroll-section":"management-section management-scroll-section"}>
    <div className="section-toolbar"><div><h2>{t('environmentalProtocols')}</h2><p>{t('environmentalStandards.environmentalProtocolsSubtitle')}</p></div><Button onClick={()=>setDraft({...empty})}><Plus size={15}/>{t('environmentalStandards.newEnvironmentalProtocol')}</Button></div>
    <div className="governance-banner"><ShieldCheck size={16}/><span>{language==='en'?'Limoxis system protocols are centrally governed and read-only for hospital users. Hospitals may add their own local protocols.':'Τα πρωτόκολλα συστήματος Limoxis διαχειρίζονται κεντρικά και είναι μόνο για προβολή στους χρήστες νοσοκομείου. Το νοσοκομείο μπορεί να προσθέτει δικά του τοπικά πρωτόκολλα.'}</span></div>
    <FilterBar compact query={query} onQueryChange={setQuery} placeholder={t('environmentalStandards.searchEnvironmentalProtocols')} onClear={()=>setQuery('')}/>
    {loading&&<div className="inline-data-state">{language==='en'?'Loading data…':'Φόρτωση δεδομένων…'}</div>}
    {error&&<div className="inline-data-state error"><span>{language==='en'?'Unable to load data.':'Η φόρτωση δεδομένων απέτυχε.'}</span><Button variant="secondary" onClick={()=>reload().catch(()=>{})}>{language==='en'?'Retry':'Επανάληψη'}</Button></div>}
    <div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('environmentalStandards.protocolCode')}</th><th>{t('environmentalStandards.samplingCategory')}</th><th>{t('samplingMethod')}</th><th>{t('environmentalStandards.measurementUnit')}</th><th>{t('environmentalStandards.acceptableLimit')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{filtered.map(item=>{const systemLocked=item.system&&!isPlatformOwner;return <tr key={item.id}><td><strong>{item.protocolCode}</strong>{item.system&&<small>{isPlatformOwner?'System · Owner':'System · Read only'}</small>}</td><td>{t(item.subjectType)}</td><td>{t(item.sourceCode)}</td><td>{item.unit}</td><td><strong>{item.limitCfu??t('notConfigured')}</strong></td><td><span className={`status-badge ${item.active?'active':''}`}>{item.active?t('active'):t('environmentalStandards.protocolInactive')}</span></td><td><div className="row-actions"><button className={`icon-button ${systemLocked?'':'edit'}`} title={systemLocked?(language==='en'?'View system protocol':'Προβολή πρωτοκόλλου συστήματος'):t('edit')} onClick={()=>setDraft({...item,limitCfu:item.limitCfu??''})}>{systemLocked?<LockKeyhole size={15}/>:<Pencil size={15}/>}</button>{(!item.system||isPlatformOwner)&&<button className="icon-button danger" title={t('delete')} onClick={()=>remove(item)}><Trash2 size={15}/></button>}</div></td></tr>})}</tbody></table>{!loading&&filtered.length===0&&<div className="inline-empty">{t('noData')}</div>}</div>
    {draft&&<div className="modal-backdrop"><div className="role-editor environmental-standard-editor" role="dialog" aria-modal="true"><header><div><h3>{draft.id?t('environmentalStandards.editEnvironmentalProtocol'):t('environmentalStandards.newEnvironmentalProtocol')}</h3><p>{draft.system?(language==='en'?'Centrally governed Limoxis system protocol.':'Κεντρικά διαχειριζόμενο πρωτόκολλο συστήματος Limoxis.'):t('environmentalStandards.environmentalProtocolEditorHelp')}</p></div><button className="icon-button" onClick={()=>setDraft(null)}><X size={17}/></button></header>
      <div className="form-grid two-col">
        <label className="field"><span>{t('environmentalStandards.protocolCode')}</span><input value={draft.protocolCode} readOnly={Boolean(draft.id)||readOnlySystem} disabled={readOnlySystem} onChange={e=>setDraft({...draft,protocolCode:e.target.value})}/><small>{draft.id?t('environmentalStandards.protocolCodeLockedHelp'):t('environmentalStandards.protocolCodeHelp')}</small></label>
        <label className="field"><span>{t('environmentalStandards.samplingCategory')}</span><select disabled={readOnlySystem} value={draft.subjectType} onChange={e=>setDraft({...draft,subjectType:e.target.value})}><option value="surface">{t('environmentalStandards.surface')}</option><option value="room">{t('environmentalStandards.roomCategory')}</option><option value="air">{t('environmentalStandards.air')}</option><option value="water">{t('environmentalStandards.water')}</option></select></label>
        <label className="field"><span>{t('samplingMethod')}</span><select disabled={readOnlySystem} value={draft.sourceCode} onChange={e=>setDraft({...draft,sourceCode:e.target.value})}><option value="surfaceSwab">{t('environmentalStandards.surfaceSwab')}</option><option value="contactPlate">{t('environmentalStandards.contactPlate')}</option><option value="roomSampling">{t('environmentalStandards.roomSampling')}</option><option value="activeAir">{t('environmentalStandards.activeAir')}</option><option value="passiveAir">{t('environmentalStandards.passiveAir')}</option><option value="waterSampling">{t('environmentalStandards.waterSampling')}</option></select></label>
        <label className="field"><span>{t('environmentalStandards.measurementUnit')}</span><select disabled={readOnlySystem} value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value})}><option value="CFU">CFU</option><option value="CFU/cm²">CFU/cm²</option><option value="CFU/plate">CFU/plate</option><option value="CFU/m³">CFU/m³</option><option value="CFU/mL">CFU/mL</option><option value="CFU/100mL">CFU/100mL</option></select><small>{t('environmentalStandards.measurementUnitHelp')}</small></label>
        <label className="field"><span>{t('environmentalStandards.acceptableLimit')}</span><div className="field-with-suffix"><input disabled={readOnlySystem} type="number" min="0" step="any" value={draft.limitCfu} onChange={e=>setDraft({...draft,limitCfu:e.target.value})} placeholder={t('environmentalStandards.enterProtocolLimit')}/><span>{draft.unit}</span></div><small>{t('environmentalStandards.acceptableLimitHelp')}</small></label>
        <label className="field checkbox-field"><span>{t('status')}</span><label><input disabled={readOnlySystem} type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>{t('active')}</label></label>
      </div>
      <footer><Button variant="secondary" onClick={()=>setDraft(null)}>{readOnlySystem?(language==='en'?'Close':'Κλείσιμο'):t('cancel')}</Button>{!readOnlySystem&&<Button disabled={saving} onClick={save}>{saving?(language==='en'?'Saving…':'Αποθήκευση…'):t('save')}</Button>}</footer>
    </div></div>}
  </section>
}
