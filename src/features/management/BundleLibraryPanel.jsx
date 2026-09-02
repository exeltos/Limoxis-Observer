import { useMemo,useState } from 'react'
import { Check,Copy,Pencil,Plus,RotateCcw,Trash2,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadBundleLibrary,saveBundleLibrary } from './bundleLibraryData'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useAuth } from '../../core/auth/AuthContext'
import { auditActorFromAuth } from '../../core/audit/actor'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'

const STATUS_LABELS={el:{draft:'Πρόχειρο',published:'Δημοσιευμένο',retired:'Αποσυρμένο'},en:{draft:'Draft',published:'Published',retired:'Retired'}}

export function BundleLibraryPanel(){
 const {notify,confirm}=useFeedback()
 const {profile,user}=useAuth();const actor=auditActorFromAuth({profile,user})
 const {role}=useTenant();const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const {language}=useLanguage();const en=language==='en';const statusLabels=STATUS_LABELS[language]
 const [rows,setRows]=useState(()=>loadBundleLibrary())
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('all')
 const [selected,setSelected]=useState(null)
 const filtered=useMemo(()=>rows.filter(x=>!x.hidden).filter(x=>status==='all'||x.status===status).filter(x=>`${x.name} ${x.titleEl} ${x.titleEn} ${x.source} ${x.scope}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status])
 const publishCount=rows.filter(x=>x.status==='published').length

 function newBundle(){
  setSelected({id:`CUSTOM-${Date.now()}`,name:en?'New Bundle':'Νέο Bundle',titleEl:'',titleEn:'',version:'0.1',status:'draft',scope:'',source:en?'Local protocol':'Τοπικό πρωτόκολλο',sourceVersion:'',system:false,departments:[],elements:[{id:'item_1',labelEl:'',labelEn:'',required:true}]})
 }
 function duplicate(item){
  setSelected({...JSON.parse(JSON.stringify(item)),id:`${item.id}-COPY-${Date.now()}`,name:`${item.name} Copy`,version:'0.1',status:'draft',system:false,source:`${item.source||'Core'} · hospital copy`,basedOn:item.id})
 }
 function openBundle(item){
  if(item.system&&!isPlatformOwner){setSelected({...JSON.parse(JSON.stringify(item)),readOnly:true});return}
  if(item.system&&isPlatformOwner){setSelected(JSON.parse(JSON.stringify(item)));return}
  if(item.status==='published'||item.status==='retired')setSelected({...JSON.parse(JSON.stringify(item)),id:`${item.id}-LOCAL-${Date.now()}`,version:nextBundleVersion(item.version),status:'draft',system:false,source:`${item.source||'Core'} · hospital override`,basedOn:item.id})
  else setSelected(JSON.parse(JSON.stringify(item)))
 }
 async function removeBundle(item){
  if(item.system&&!isPlatformOwner){notify(en?'System-managed Bundles can only be changed by the Platform Owner.':'Τα system-managed Bundles μπορούν να αλλάξουν μόνο από τον Platform Owner.','warning');return}
  const ok=await confirm({title:en?'Delete Bundle':'Διαγραφή Bundle',message:item.system?(en?`System Bundle “${item.name}” will be removed. Continue?`:`Το System Bundle «${item.name}» θα αφαιρεθεί. Θέλετε να συνεχίσετε;`):(en?`Bundle “${item.name}” will be removed from the hospital library. Existing executions are not affected.`:`Το Bundle «${item.name}» θα αφαιρεθεί από τη βιβλιοθήκη του νοσοκομείου. Οι υπάρχουσες εκτελέσεις δεν επηρεάζονται.`),confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  setRows(current=>{const now=new Date().toISOString();const governed=item.status==='published'||item.status==='retired';const next=governed?current.map(x=>x.id===item.id?{...x,hidden:true,hiddenAt:now,hiddenBy:actor.name,hiddenById:actor.id}:x):current.filter(x=>x.id!==item.id);saveBundleLibrary(next);return next});notify(en?'Bundle removed.':'Το Bundle αφαιρέθηκε.','success')
 }
 function save(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can modify this system item.':'Μόνο ο Platform Owner μπορεί να τροποποιήσει αυτό το στοιχείο συστήματος.','warning');return}
  const cleaned={...item};delete cleaned.readOnly
  setRows(current=>{
   const exists=current.some(x=>x.id===cleaned.id)
   const next=exists?current.map(x=>x.id===cleaned.id?cleaned:x):[...current,cleaned]
   saveBundleLibrary(next);return next
  })
  setSelected(null);notify(en?'Bundle saved to the Library.':'Το Bundle αποθηκεύτηκε στη Βιβλιοθήκη.','success')
 }
 async function publish(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can publish system Bundles.':'Μόνο ο Platform Owner μπορεί να δημοσιεύει System Bundles.','warning');return}
  const ok=await confirm({title:en?'Publish Bundle':'Δημοσίευση Bundle',message:en?'The published version will be used for new executions. Previous executions remain linked to their own version.':'Η δημοσιευμένη έκδοση θα χρησιμοποιείται σε νέες εκτελέσεις. Οι παλιές εκτελέσεις παραμένουν συνδεδεμένες με τη δική τους έκδοση.',confirmLabel:en?'Publish':'Δημοσίευση'})
  if(!ok)return
  setRows(current=>{const next=current.map(x=>x.id===item.id?{...x,status:'published',publishedAt:new Date().toISOString(),publishedBy:actor.name,publishedById:actor.id}:x);saveBundleLibrary(next);return next})
  notify(en?'Version published.':'Η έκδοση δημοσιεύτηκε.','success')
 }
 async function retire(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can retire system Bundles.':'Μόνο ο Platform Owner μπορεί να αποσύρει System Bundles.','warning');return}
  const ok=await confirm({title:en?'Retire Bundle':'Απόσυρση Bundle',message:en?'It will no longer be available for new executions. History remains available.':'Δεν θα είναι διαθέσιμο για νέες εκτελέσεις. Το ιστορικό παραμένει διαθέσιμο.',confirmLabel:en?'Retire':'Απόσυρση'})
  if(!ok)return
  setRows(current=>{const next=current.map(x=>x.id===item.id?{...x,status:'retired',retiredAt:new Date().toISOString(),retiredBy:actor.name,retiredById:actor.id}:x);saveBundleLibrary(next);return next})
  notify(en?'Bundle retired.':'Το Bundle αποσύρθηκε.','success')
 }

 return <div className="bundle-library-panel">
  <div className="bundle-library-toolbar">
   <div><h3>{en?'Prevention Bundles':'Bundles Πρόληψης'}</h3><p>{en?'Versioned templates for clinical use, auditability and controlled changes.':'Versioned templates για κλινική εφαρμογή, auditability και ελεγχόμενες αλλαγές.'}</p></div>
   <div className="bundle-library-actions"><span className="bundle-library-count"><b>{publishCount}</b> published</span><Button onClick={newBundle}><Plus size={15}/>{en?'New Bundle':'Νέο Bundle'}</Button></div>
  </div>
  <FilterBar compact query={query} onQueryChange={setQuery} placeholder={en?'Search Bundle...':'Αναζήτηση Bundle...'} onClear={()=>{setQuery('');setStatus('all')}} advanced={<label className="filter-select"><span>{en?'Status':'Κατάσταση'}</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{en?'All':'Όλες'}</option><option value="published">Published</option><option value="draft">Draft</option><option value="retired">Retired</option></select></label>} activeAdvancedCount={status==='all'?0:1}/>
  <div className="table-wrap scroll-table bundle-library-table-wrap">
   <table className="data-table sticky-table bundle-library-table">
    <thead><tr><th>Bundle</th><th>{en?'Version':'Έκδοση'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Elements':'Στοιχεία'}</th><th>{en?'Source / guideline':'Πηγή / guideline'}</th><th>Scope</th><th></th></tr></thead>
    <tbody>{filtered.map(item=>{const systemLocked=item.system&&!isPlatformOwner;return <tr key={item.id} className="clickable-row" onClick={()=>openBundle(item)}>
     <td><strong>{item.name}</strong>{item.system&&<span className="status-badge active">{en?'System · Owner managed':'System · Μόνο Owner'}</span>}<small>{item.titleEl}{item.titleEn?` · ${item.titleEn}`:''}</small></td>
     <td><strong>v{item.version}</strong></td>
     <td><span className={`bundle-library-status ${item.status}`}>{statusLabels[item.status]}</span></td>
     <td>{item.elements.length}</td>
     <td><strong>{item.source||'—'}</strong><small>{item.sourceVersion||''}</small></td>
     <td><span className="bundle-library-scope-text">{item.scope||'—'}</span></td>
     <td onClick={e=>e.stopPropagation()}><div className="row-actions">
      <button className="icon-button edit" title={systemLocked?(en?'View system Bundle':'Προβολή System Bundle'):(en?'Open / edit':'Άνοιγμα / επεξεργασία')} onClick={()=>openBundle(item)}><Pencil size={14}/></button>
      {!systemLocked&&<><button className="icon-button" title={en?'Create new draft version':'Δημιουργία νέας draft έκδοσης'} onClick={()=>duplicate(item)}><Copy size={14}/></button><button className="icon-button danger" title={en?'Delete':'Διαγραφή'} onClick={()=>removeBundle(item)}><Trash2 size={14}/></button>
      {item.status==='draft'&&<button className="text-button compact" onClick={()=>publish(item)}><Check size={13}/> Publish</button>}
      {item.status==='published'&&<button className="text-button compact" onClick={()=>retire(item)}><RotateCcw size={13}/> Retire</button>}</>}
     </div></td>
    </tr>})}</tbody>
   </table>
  </div>
  {selected&&<BundleEditor language={language} draft={selected} isPlatformOwner={isPlatformOwner} onClose={()=>setSelected(null)} onSave={save}/>} 
 </div>
}

function nextBundleVersion(version){const p=String(version||'1.0').split('.').map(Number);return p.length>=2&&p.every(Number.isFinite)?`${p[0]}.${p[1]+1}`:'1.1'}
function BundleEditor({draft,onClose,onSave,language,isPlatformOwner}){
 const {notify,confirm}=useFeedback();const en=language==='en'
 const [value,setValue]=useState(draft)
 const set=(k,v)=>setValue(x=>({...x,[k]:v}))
 function elementChange(index,key,v){setValue(x=>({...x,elements:x.elements.map((e,i)=>i===index?{...e,[key]:v}:e)}))}
 function addElement(){setValue(x=>({...x,elements:[...x.elements,{id:`item_${Date.now()}`,labelEl:'',labelEn:'',required:true}]}))}
 async function removeElement(index){const ok=await confirm({title:en?'Remove element':'Αφαίρεση στοιχείου',message:en?'The element will be removed from the Bundle. Continue?':'Το στοιχείο θα αφαιρεθεί από το Bundle. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true});if(!ok)return;setValue(x=>({...x,elements:x.elements.filter((_,i)=>i!==index)}));notify(en?'Element removed.':'Το στοιχείο αφαιρέθηκε.','success')}
 const locked=Boolean(value.readOnly)||(value.system&&!isPlatformOwner)||(!value.system&&(value.status==='published'||value.status==='retired'))
 return <div className="modal-backdrop"><div className="entry-card bundle-library-editor">
  <header><div><span className="eyebrow">BUNDLE LIBRARY</span><h3>{locked?(en?'Read-only Bundle':'Προβολή Bundle'):(en?'Edit Bundle':'Επεξεργασία Bundle')}</h3><p>{value.system&&!isPlatformOwner?(en?'This is a Limoxis system item. Only the Platform Owner can modify or delete it.':'Αυτό είναι στοιχείο συστήματος Limoxis. Μόνο ο Platform Owner μπορεί να το τροποποιήσει ή να το διαγράψει.'):(locked?(en?'Published/retired hospital versions remain immutable. Create a draft copy to make changes.':'Οι published/retired εκδόσεις του νοσοκομείου παραμένουν αμετάβλητες. Δημιούργησε draft copy για αλλαγές.'):(en?'Changes become active only after Publish.':'Οι αλλαγές ενεργοποιούνται μόνο μετά από Publish.'))}</p></div><button className="icon-close" onClick={onClose}><X size={16}/></button></header>
  <div className="bundle-library-editor-body">
   <section className="bundle-editor-meta">
    <div className="entry-grid">
     <label><span>{en?'Code *':'Κωδικός *'}</span><input disabled={locked||value.system} value={value.id} onChange={e=>set('id',e.target.value)}/></label>
     <label><span>{en?'Name *':'Όνομα *'}</span><input disabled={locked} value={value.name} onChange={e=>set('name',e.target.value)}/></label>
     <label><span>{en?'Title EL *':'Τίτλος EL *'}</span><input disabled={locked} value={value.titleEl} onChange={e=>set('titleEl',e.target.value)}/></label>
     <label><span>Title EN</span><input disabled={locked} value={value.titleEn} onChange={e=>set('titleEn',e.target.value)}/></label>
     <label><span>{en?'Version *':'Έκδοση *'}</span><input disabled={locked} value={value.version} onChange={e=>set('version',e.target.value)}/></label>
     <label><span>Scope</span><input disabled={locked} value={value.scope||''} onChange={e=>set('scope',e.target.value)}/></label>
     <label><span>{en?'Source / guideline':'Πηγή / guideline'}</span><input disabled={locked} value={value.source||''} onChange={e=>set('source',e.target.value)}/></label>
     <label><span>{en?'Source version / review':'Έκδοση / review πηγής'}</span><input disabled={locked} value={value.sourceVersion||''} onChange={e=>set('sourceVersion',e.target.value)}/></label>
    </div>
   </section>
   <section className="bundle-editor-elements">
    <div className="bundle-editor-elements-head"><div><strong>{en?'Bundle elements':'Στοιχεία Bundle'}</strong><small>{en?'This order is used during execution.':'Η σειρά εδώ είναι η σειρά στην εκτέλεση.'}</small></div>{!locked&&<button type="button" className="button button-secondary" onClick={addElement}><Plus size={13}/>{en?'Add element':'Προσθήκη στοιχείου'}</button>}</div>
    <div className="bundle-editor-element-list">{value.elements.map((e,i)=><div className="bundle-editor-element" key={e.id}>
     <span className="bundle-editor-order">{i+1}</span>
     <div><input disabled={locked} value={e.labelEl} onChange={ev=>elementChange(i,'labelEl',ev.target.value)} placeholder={en?'Description EL':'Περιγραφή EL'}/><input disabled={locked} value={e.labelEn||''} onChange={ev=>elementChange(i,'labelEn',ev.target.value)} placeholder="Description EN"/></div>
     <label className="bundle-required-toggle"><input type="checkbox" disabled={locked} checked={e.required!==false} onChange={ev=>elementChange(i,'required',ev.target.checked)}/><span>Required</span></label>
     {!locked&&<button className="icon-button danger" onClick={()=>removeElement(i)}><X size={13}/></button>}
    </div>)}</div>
   </section>
  </div>
  <footer><Button variant="secondary" onClick={onClose}>{en?'Close':'Κλείσιμο'}</Button>{!locked&&<Button disabled={!value.id.trim()||!value.name.trim()||!value.titleEl.trim()||value.elements.length===0} onClick={()=>onSave(value)}>{en?'Save':'Αποθήκευση'}</Button>}</footer>
 </div></div>
}
