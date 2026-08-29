import { useMemo,useState } from 'react'
import { Biohazard,BriefcaseMedical,Building2,Tablets,ClipboardCheck,Edit3,FileText,FlaskConical,LockKeyhole,PackageOpen,Plus,ShieldCheck,Syringe,Trash2,UsersRound,Wind } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { demoLibrarySeed,newLocalLibraryItem } from './managementData'
import { EnvironmentalStandardsPanel } from './EnvironmentalStandardsPanel'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const categories=[
 ['departments','libraryDepartments',Building2,'blue'],['microorganisms','libraryMicroorganisms',Biohazard,'red'],
 ['antibiotics','libraryAntibiotics',Tablets,'purple'],['notifiableDiseases','libraryNotifiableDiseases',ClipboardCheck,'orange'],
 ['sampleTypes','librarySampleTypes',FlaskConical,'teal'],['professionalCategories','libraryProfessionalCategories',UsersRound,'indigo'],
 ['vaccines','libraryVaccines',Syringe,'green'],['wasteTypes','libraryWasteTypes',PackageOpen,'amber'],
 ['antiseptics','libraryAntiseptics',BriefcaseMedical,'cyan'],['isolationTypes','libraryIsolationTypes',ShieldCheck,'rose'],
 ['controlTypes','libraryControlTypes',ClipboardCheck,'slate'],['documentCategories','libraryDocumentCategories',FileText,'violet'],
 ['environmentalProtocols','environmentalProtocols',Wind,'sky'],
]
const cloneSeed=()=>structuredClone(demoLibrarySeed)
function loadState(){const stored=loadSnapshot('management_libraries',{});return {...cloneSeed(),...(stored&&typeof stored==='object'?stored:{})}}
function saveState(rows){return saveSnapshot('management_libraries',rows)}

export function LibrariesPanel(){
 const {language,t}=useLanguage();const {notify,confirm}=useFeedback()
 const [active,setActive]=useState('departments');const [query,setQuery]=useState('');const [rows,setRows]=useState(loadState);const [editor,setEditor]=useState(null);const [draft,setDraft]=useState({el:'',en:''})
 const filtered=useMemo(()=>(rows[active]||[]).filter(x=>`${x[0]} ${x[1]} ${x[2]?.source||''}`.toLowerCase().includes(query.toLowerCase())),[active,query,rows])
 const persist=next=>{setRows(next);saveState(next)}
 function openEdit(row){setEditor({mode:'edit',row});setDraft({el:row[0]||'',en:row[1]||''})}
 function openAdd(){setEditor({mode:'add'});setDraft({el:'',en:''})}
 function saveEditor(){
  const el=draft.el.trim(),en=(draft.en||draft.el).trim();if(!el||!editor)return
  if(editor.mode==='add')persist({...rows,[active]:[...(rows[active]||[]),newLocalLibraryItem(el,en)]})
  else persist({...rows,[active]:(rows[active]||[]).map(x=>x===editor.row?[el,en,{...(x[2]||{}),system:false,locked:false,source:x[2]?.system?'Hospital override':(x[2]?.source||'Hospital'),version:'local'}]:x)})
  notify(editor.mode==='add'?t('libraryItemCreated'):t('librariesPanel.libraryItemUpdated'),'success');setEditor(null)
 }
 async function remove(row){
  const ok=await confirm({title:t('librariesPanel.removeFromLibraryTitle'),message:row[2]?.system?t('librariesPanel.removeSystemLibraryMessage'):t('librariesPanel.removeLocalLibraryMessage'),confirmLabel:t('librariesPanel.removeLabel'),danger:true})
  if(!ok)return
  persist({...rows,[active]:(rows[active]||[]).filter(x=>x!==row)});notify(t('librariesPanel.libraryItemRemoved'),'success')
 }
 return <section className="management-section management-scroll-section">
  <div className="section-toolbar"><div><h2>{t('libraries')}</h2><p>{t('librariesPanel.librariesSubtitle')}</p></div>{active!=='environmentalProtocols'&&<Button onClick={openAdd}><Plus size={15}/>{t('newLibraryItem')}</Button>}</div>
  {active!=='environmentalProtocols'&&<div className="library-governance-strip"><LockKeyhole size={15}/><div><strong>Core baseline + hospital overrides</strong><span>{t('librariesPanel.libraryGovernanceNote')}</span></div></div>}
  <div className="library-layout workspace-fill">
   <aside className="library-categories library-categories-v2 scroll-list">{categories.map(([id,key,Icon,tone])=><button key={id} className={active===id?'active':''} onClick={()=>{setActive(id);setQuery('')}}><span className={`library-category-icon tone-${tone}`}><Icon size={16}/></span><span className="library-category-copy"><strong>{t(key)}</strong><small>{id==='environmentalProtocols'?t('librariesPanel.environmentalProtocolsHint'):t('librariesPanel.centralLibraryHint')}</small></span><b>{id==='environmentalProtocols'?'6':(rows[id]?.length||0)}</b></button>)}</aside>
   <div className="library-content workspace-column">{active==='environmentalProtocols'?<EnvironmentalStandardsPanel embedded/>:<><FilterBar compact query={query} onQueryChange={setQuery} placeholder={t('searchLibrary')} onClear={()=>setQuery('')}/><div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('name')}</th><th>{t('librariesPanel.sourceReferenceLabel')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{filtered.map(row=>{const meta=row[2]||{};return <tr key={`${active}-${row[0]}-${row[1]}`}><td><strong>{row[language==='el'?0:1]}</strong>{row[0]!==row[1]&&<small>{row[language==='el'?1:0]}</small>}</td><td><span className="library-source">{meta.source||'Hospital'}</span>{meta.version&&meta.version!=='current'&&<small>{meta.version}</small>}</td><td>{meta.system?<span className="status-badge library-system-badge"><LockKeyhole size={11}/> Core</span>:<span className="status-badge active">{t('hospital')}</span>}</td><td><div className="record-inline-actions"><button title={t('edit')} onClick={()=>openEdit(row)}><Edit3 size={15}/></button><button className="danger" title={t('delete')} onClick={()=>remove(row)}><Trash2 size={15}/></button></div></td></tr>})}</tbody></table></div></>}</div>
  </div>
  {editor&&<ObserverDialog eyebrow={t('libraries')} title={editor.mode==='add'?t('librariesPanel.newLibraryItemTitle'):t('librariesPanel.editLibraryItemTitle')} subtitle={editor.row?.[2]?.system?t('librariesPanel.hospitalOverrideNote'):t('librariesPanel.localLibraryEntryNote')} width="standard" onClose={()=>setEditor(null)} footer={<DialogActions onCancel={()=>setEditor(null)} onSave={saveEditor} disabled={!draft.el.trim()}/>}>
   <div className="entry-grid compact"><label className="field"><span>{t('librariesPanel.nameElRequired')}</span><input autoFocus value={draft.el} onChange={e=>setDraft(x=>({...x,el:e.target.value}))}/></label><label className="field"><span>Name EN</span><input value={draft.en} onChange={e=>setDraft(x=>({...x,en:e.target.value}))}/></label></div>
  </ObserverDialog>}
 </section>
}
