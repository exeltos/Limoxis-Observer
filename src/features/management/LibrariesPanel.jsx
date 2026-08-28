import { useMemo, useState } from 'react'
import { BookOpen, Edit3, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { demoLibrarySeed } from './managementData'
import { BundleLibraryPanel } from './BundleLibraryPanel'

const categories=[
 ['departments','libraryDepartments'],['microorganisms','libraryMicroorganisms'],['antibiotics','libraryAntibiotics'],
 ['notifiableDiseases','libraryNotifiableDiseases'],['sampleTypes','librarySampleTypes'],
 ['professionalCategories','libraryProfessionalCategories'],['vaccines','libraryVaccines'],
 ['wasteTypes','libraryWasteTypes'],['antiseptics','libraryAntiseptics'],['isolationTypes','libraryIsolationTypes'],
 ['controlTypes','libraryControlTypes'],['documentCategories','libraryDocumentCategories'],['bundles','Bundles Πρόληψης']
]

export function LibrariesPanel(){
 const {language,t}=useLanguage()
 const {notify,confirm}=useFeedback()
 const [active,setActive]=useState('departments')
 const [query,setQuery]=useState('')
 const [rows,setRows]=useState(demoLibrarySeed)
 const [editor,setEditor]=useState(null)
 const [editorValue,setEditorValue]=useState('')
 const filtered=useMemo(()=>(rows[active]||[]).filter(x=>x.join(' ').toLowerCase().includes(query.toLowerCase())),[active,query,rows])

 function openAdd(){setEditor({mode:'add'});setEditorValue('')}
 function openEdit(original){setEditor({mode:'edit',original});setEditorValue(original[language==='el'?0:1]||'')}
 function saveEditor(){
  const value=editorValue.trim()
  if(!value||!editor)return
  if(editor.mode==='add'){
   setRows(c=>({...c,[active]:[...(c[active]||[]),[value,value]]}))
   notify(t('libraryItemCreated'),'success')
  }else{
   const original=editor.original
   setRows(c=>({...c,[active]:c[active].map(x=>x===original?(language==='el'?[value,x[1]]:[x[0],value]):x)}))
   notify(t('libraryItemUpdated'),'success')
  }
  setEditor(null);setEditorValue('')
 }
 async function remove(original){
  const ok=await confirm({title:t('delete'),message:t('confirmLibraryDelete'),confirmLabel:t('delete'),danger:true})
  if(!ok)return
  setRows(c=>({...c,[active]:c[active].filter(x=>x!==original)}))
  notify(t('libraryItemDeleted'),'success')
 }

 return <section className="management-section management-scroll-section">
  <div className="section-toolbar">
   <div><h2>{t('libraries')}</h2><p>{t('librariesSubtitle')}</p></div>
   {active!=='bundles'&&<Button onClick={openAdd}><Plus size={15}/>{t('newLibraryItem')}</Button>}
  </div>
  <div className="library-layout workspace-fill">
   <aside className="library-categories scroll-list">
    {categories.map(([id,key])=><button key={id} className={active===id?'active':''} onClick={()=>{setActive(id);setQuery('')}}>
     <BookOpen size={15}/><span>{key==='Bundles Πρόληψης'?'Bundles Πρόληψης':t(key)}</span><small>{id==='bundles'?'6':(rows[id]?.length||0)}</small>
    </button>)}
   </aside>
   <div className="library-content workspace-column">
    {active==='bundles'?<BundleLibraryPanel/>:<>
     <FilterBar compact query={query} onQueryChange={setQuery} placeholder={t('searchLibrary')} onClear={()=>setQuery('')}/>
     {active==='notifiableDiseases'&&<div className="governance-banner"><span>{t('notifiableLibraryGovernance')}</span></div>}
     <div className="table-wrap scroll-table"><table className="data-table sticky-table">
      <thead><tr><th>{t('name')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
      <tbody>{filtered.map(row=><tr key={`${active}-${row[0]}`}>
       <td><strong>{row[language==='el'?0:1]}</strong>{row[0]!==row[1]&&<small>{row[language==='el'?1:0]}</small>}</td>
       <td><span className="status-badge active">{t('active')}</span></td>
       <td><div className="row-actions">
        <button className="icon-button" title={t('edit')} onClick={()=>openEdit(row)}><Edit3 size={15}/></button>
        <button className="icon-button danger" title={t('delete')} onClick={()=>remove(row)}><Trash2 size={15}/></button>
       </div></td>
      </tr>)}</tbody>
     </table></div>
    </>}
   </div>
  </div>

  {editor&&<div className="modal-backdrop">
   <div className="library-item-editor" role="dialog" aria-modal="true" aria-labelledby="library-item-editor-title">
    <header><div><span className="eyebrow">LIBRARY</span><h3 id="library-item-editor-title">{editor.mode==='add'?t('newLibraryItem'):t('edit')}</h3></div><button className="icon-button" onClick={()=>setEditor(null)} aria-label={t('close')}><X size={16}/></button></header>
    <label className="field"><span>{t('name')}</span><input autoFocus value={editorValue} onChange={e=>setEditorValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEditor()}}/></label>
    <footer><Button variant="secondary" onClick={()=>setEditor(null)}>{t('cancel')}</Button><Button disabled={!editorValue.trim()} onClick={saveEditor}>{t('save')}</Button></footer>
   </div>
  </div>}
 </section>
}
