import { useEffect,useMemo,useState } from 'react'
import { Biohazard,BriefcaseMedical,Building2,Tablets,ClipboardCheck,Pencil,FileText,FlaskConical,LockKeyhole,PackageOpen,Plus,ShieldCheck,Syringe,Trash2,UsersRound } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterBar } from '../../design-system/FilterBar'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { demoLibrarySeed,newLocalLibraryItem } from './managementData'
import { loadSnapshot,saveSnapshot } from '../../core/data/repository'
import { createGlobalLibraryItem,createManagementLibraryItem,loadGlobalLibraryItems,loadManagementLibraries,removeGlobalLibraryItem,removeManagementLibraryItem,updateGlobalLibraryItem,updateManagementLibraryItem } from './managementCloudService'
import { isHospitalManagedLibraryKey } from './libraryGovernance'
const categories=[
 ['departments','libraryDepartments',Building2,'blue'],['microorganisms','libraryMicroorganisms',Biohazard,'red'],
 ['antibiotics','libraryAntibiotics',Tablets,'purple'],['deviceTypes','libraryDeviceTypes',ShieldCheck,'teal'],['surveillanceDefinitions','librarySurveillanceDefinitions',ClipboardCheck,'blue'],['notifiableDiseases','libraryNotifiableDiseases',ClipboardCheck,'orange'],
 ['clinicalSymptoms','signsSymptoms',ClipboardCheck,'blue'],['clinicalRiskFactors','riskFactors',ShieldCheck,'amber'],
 ['sampleTypes','librarySampleTypes',FlaskConical,'teal'],['professionalCategories','libraryProfessionalCategories',UsersRound,'indigo'],
 ['vaccines','libraryVaccines',Syringe,'green'],['wasteTypes','libraryWasteTypes',PackageOpen,'amber'],
 ['antiseptics','libraryAntiseptics',BriefcaseMedical,'cyan'],['isolationTypes','libraryIsolationTypes',ShieldCheck,'rose'],
 ['controlTypes','libraryControlTypes',ClipboardCheck,'slate'],['documentCategories','libraryDocumentCategories',FileText,'violet'],
]
const cloneSeed=()=>structuredClone(demoLibrarySeed)
function normalizeGovernance(seed){const next={...seed};for(const key of Object.keys(next)){if(!isHospitalManagedLibraryKey(key)||!Array.isArray(next[key]))continue;next[key]=next[key].map(row=>[row[0],row[1],{...(row[2]||{}),system:false,locked:false,source:'Hospital',version:'local'}])}return next}
function loadDemoState(){const stored=loadSnapshot('management_libraries',{});return normalizeGovernance({...cloneSeed(),...(stored&&typeof stored==='object'?stored:{})})}

export function LibrariesPanel({global=false}={}){
 const {language,t}=useLanguage();const {notify,confirm}=useFeedback();const {tenant,isDemo:tenantIsDemo}=useTenant();const isDemo=!global&&tenantIsDemo;const isPlatformOwner=global // system (platform-wide) entries are edited only on the platform screen
 const visibleCategories=useMemo(()=>global?categories.filter(([id])=>id!=='departments'):categories,[global])
 const [active,setActive]=useState(()=>global?visibleCategories[0][0]:'departments');const [query,setQuery]=useState('');const [rows,setRows]=useState(()=>isDemo?loadDemoState():{});const [loading,setLoading]=useState(!isDemo);const [editor,setEditor]=useState(null);const [draft,setDraft]=useState({el:'',en:''})
 useEffect(()=>{if(global){let mounted=true;setLoading(true);loadGlobalLibraryItems().then(data=>{if(mounted)setRows(data)}).catch(error=>{if(mounted)notify(error?.message||t('loadFailed'),'error')}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}}if(isDemo){setRows(loadDemoState());setLoading(false);return}if(!tenant?.id){setRows({});setLoading(false);return}let mounted=true;setLoading(true);loadManagementLibraries(tenant.id).then(data=>{if(mounted)setRows(data)}).catch(error=>{if(mounted)notify(error?.message||t('loadFailed'),'error')}).finally(()=>{if(mounted)setLoading(false)});return()=>{mounted=false}},[global,isDemo,tenant?.id,notify,t])
 const filtered=useMemo(()=>(rows[active]||[]).filter(x=>`${x[0]} ${x[1]} ${x[2]?.source||''}`.toLowerCase().includes(query.toLowerCase())),[active,query,rows])
 function persistDemo(next){setRows(next);saveSnapshot('management_libraries',next)}
 function openEdit(row){const system=Boolean(row?.[2]?.system);setEditor({mode:system&&!isPlatformOwner?'view':'edit',row});setDraft({el:row[0]||'',en:row[1]||''})}
 function openAdd(){setEditor({mode:'add'});setDraft({el:'',en:''})}
 async function saveEditor(){const el=draft.el.trim(),en=(draft.en||draft.el).trim();if(!el||!editor)return;if(editor.row?.[2]?.system&&!isPlatformOwner){notify(t('librariesSystemRecordEditBlocked'),'warning');return}try{if(global){const saved=editor.mode==='add'?await createGlobalLibraryItem(active,{nameEl:el,nameEn:en}):await updateGlobalLibraryItem(editor.row,{nameEl:el,nameEn:en});setRows(current=>({...current,[active]:editor.mode==='add'?[...(current[active]||[]),saved]:(current[active]||[]).map(row=>row===editor.row?saved:row)}))}else if(isDemo){if(editor.mode==='add')persistDemo({...rows,[active]:[...(rows[active]||[]),newLocalLibraryItem(el,en)]});else persistDemo({...rows,[active]:(rows[active]||[]).map(x=>x===editor.row?[el,en,{...(x[2]||{}),source:x[2]?.system?'Limoxis System':(x[2]?.source||'Hospital')}]:x)})}else{const saved=editor.mode==='add'?await createManagementLibraryItem(tenant.id,active,{nameEl:el,nameEn:en}):await updateManagementLibraryItem(tenant.id,active,editor.row,{nameEl:el,nameEn:en});setRows(current=>({...current,[active]:editor.mode==='add'?[...(current[active]||[]),saved]:(current[active]||[]).map(row=>row===editor.row?saved:row)}))}notify(editor.mode==='add'?t('libraryItemCreated'):t('librariesPanel.libraryItemUpdated'),'success');setEditor(null)}catch(error){notify(error?.message||t('saveFailed'),'error')}}
 async function remove(row){if(row?.[2]?.system&&!isPlatformOwner){notify(t('librariesSystemRecordDeleteBlocked'),'warning');return}const ok=await confirm({title:t('librariesPanel.removeFromLibraryTitle'),message:row[2]?.system?t('librariesPanel.removeSystemLibraryMessage'):t('librariesPanel.removeLocalLibraryMessage'),confirmLabel:t('librariesPanel.removeLabel'),danger:true});if(!ok)return;try{if(global){await removeGlobalLibraryItem(row);setRows(current=>({...current,[active]:(current[active]||[]).filter(x=>x!==row)}))}else if(isDemo)persistDemo({...rows,[active]:(rows[active]||[]).filter(x=>x!==row)});else{await removeManagementLibraryItem(tenant.id,active,row);setRows(current=>({...current,[active]:(current[active]||[]).filter(x=>x!==row)}))}notify(t('librariesPanel.libraryItemRemoved'),'success')}catch(error){notify(error?.message||t('deleteFailed'),'error')}}
 return <section className="management-section management-scroll-section">
  <div className="section-toolbar"><div><h2>{t('libraries')}</h2><p>{global?t('librariesPanel.globalLibrariesSubtitle'):t('librariesPanel.librariesSubtitle')}</p></div><Button onClick={openAdd}><Plus size={15}/>{t('newLibraryItem')}</Button></div>
  <div className="library-governance-strip"><LockKeyhole size={15}/><div><strong>{t('librariesGovernanceStripTitle')}</strong><span>{global?t('librariesPanel.globalLibrariesGovernanceText'):t('librariesGovernanceStripText')}</span></div></div>
  <div className="library-layout workspace-fill">
   <aside className="library-categories library-categories-v2 scroll-list">{visibleCategories.map(([id,key,Icon,tone])=><button key={id} className={active===id?'active':''} onClick={()=>{setActive(id);setQuery('')}}><span className={`library-category-icon tone-${tone}`}><Icon size={16}/></span><span className="library-category-copy"><strong>{t(key)}</strong><small>{t('librariesPanel.centralLibraryHint')}</small></span><b>{rows[id]?.length||0}</b></button>)}</aside>
   <div className="library-content workspace-column"><FilterBar compact query={query} onQueryChange={setQuery} placeholder={t('searchLibrary')} onClear={()=>setQuery('')}/><RegistryTable
     wrapperClassName="table-wrap scroll-table"
     columns={[{key:'name',label:t('libraryEntryLabel')},{key:'source',label:t('librariesPanel.sourceReferenceLabel')},{key:'status',label:t('status')},{key:'actions',label:t('actions')}]}
     rows={filtered}
     rowKey={row=>{const meta=row[2]||{};return `${active}-${meta.id||row[0]}-${row[1]}`}}
     renderRow={row=>{const meta=row[2]||{};const systemLocked=meta.system&&!isPlatformOwner;return <><td><strong>{row[language==='el'?0:1]}</strong>{row[0]!==row[1]&&<small>{row[language==='el'?1:0]}</small>}</td><td><span className="library-source">{!meta.source||meta.source==='Hospital'?t('libraryHospitalSource'):meta.source}</span>{meta.version&&meta.version!=='current'&&<small>{meta.version==='local'?t('libraryLocalVersion'):meta.version}</small>}</td><td>{meta.system?<span className="status-badge library-system-badge"><LockKeyhole size={11}/>{isPlatformOwner?t('librariesPanel.systemOwnerBadge'):t('librariesPanel.systemReadOnlyBadge')}</span>:<span className="status-badge active">{t('hospital')}</span>}</td><td><OverflowMenu items={[
       {id:'edit',label:systemLocked?t('librariesViewSystemRecord'):t('edit'),icon:systemLocked?LockKeyhole:Pencil,onClick:()=>openEdit(row)},
       {id:'delete',label:t('delete'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>remove(row),hidden:meta.system&&!isPlatformOwner},
     ]}/></td></>}}
   />{loading&&<div className="inline-empty">{t('loading')}</div>}{!loading&&filtered.length===0&&<div className="inline-empty">{t('noData')}</div>}</div>
  </div>
  {editor&&<ObserverDialog eyebrow={t('libraries')} title={editor.mode==='add'?t('librariesPanel.newLibraryItemTitle'):editor.mode==='view'?t('librariesSystemRecordViewTitle'):t('librariesPanel.editLibraryItemTitle')} subtitle={editor.row?.[2]?.system?t('librariesSystemRecordManagedNote'):t('librariesPanel.localLibraryEntryNote')} width="standard" onClose={()=>setEditor(null)} footer={editor.mode==='view'?<Button variant="secondary" onClick={()=>setEditor(null)}>{t('close')}</Button>:<DialogActions onCancel={()=>setEditor(null)} onSave={saveEditor} disabled={!draft.el.trim()}/>}><div className="entry-grid compact"><label className="field"><span>{t('librariesPanel.nameElRequired')}</span><input autoFocus={editor.mode!=='view'} disabled={editor.mode==='view'} value={draft.el} onChange={e=>setDraft(x=>({...x,el:e.target.value}))}/></label><label className="field"><span>Name EN</span><input disabled={editor.mode==='view'} value={draft.en} onChange={e=>setDraft(x=>({...x,en:e.target.value}))}/></label></div></ObserverDialog>}
 </section>
}
