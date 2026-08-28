import { useMemo,useState } from 'react'
import { Check,Copy,Edit3,Plus,RotateCcw,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { FilterBar } from '../../design-system/FilterBar'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadBundleLibrary,saveBundleLibrary } from './bundleLibraryData'

const STATUS_LABELS={draft:'Draft',published:'Published',retired:'Retired'}

export function BundleLibraryPanel(){
 const {notify,confirm}=useFeedback()
 const [rows,setRows]=useState(()=>loadBundleLibrary())
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('all')
 const [selected,setSelected]=useState(null)
 const filtered=useMemo(()=>rows.filter(x=>status==='all'||x.status===status).filter(x=>`${x.name} ${x.titleEl} ${x.titleEn} ${x.source} ${x.scope}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status])
 const publishCount=rows.filter(x=>x.status==='published').length

 function newBundle(){
  setSelected({id:`CUSTOM-${Date.now()}`,name:'Νέο Bundle',titleEl:'',titleEn:'',version:'0.1',status:'draft',scope:'',source:'Τοπικό πρωτόκολλο',sourceVersion:'',system:false,departments:[],elements:[{id:'item_1',labelEl:'',labelEn:'',required:true}]})
 }
 function duplicate(item){
  setSelected({...JSON.parse(JSON.stringify(item)),id:`${item.id}-COPY-${Date.now()}`,name:`${item.name} Copy`,version:'0.1',status:'draft',system:false})
 }
 function save(item){
  setRows(current=>{
   const exists=current.some(x=>x.id===item.id)
   const next=exists?current.map(x=>x.id===item.id?item:x):[...current,item]
   saveBundleLibrary(next);return next
  })
  setSelected(null);notify('Το Bundle αποθηκεύτηκε στη Βιβλιοθήκη.','success')
 }
 async function publish(item){
  const ok=await confirm({title:'Δημοσίευση Bundle',message:'Η δημοσιευμένη έκδοση θα χρησιμοποιείται σε νέες εκτελέσεις. Οι παλιές εκτελέσεις παραμένουν συνδεδεμένες με τη δική τους έκδοση.',confirmLabel:'Δημοσίευση'})
  if(!ok)return
  setRows(current=>{const next=current.map(x=>x.id===item.id?{...x,status:'published',publishedAt:new Date().toISOString()}:x);saveBundleLibrary(next);return next})
  notify('Η έκδοση δημοσιεύτηκε.','success')
 }
 async function retire(item){
  const ok=await confirm({title:'Απόσυρση Bundle',message:'Δεν θα είναι διαθέσιμο για νέες εκτελέσεις. Το ιστορικό παραμένει διαθέσιμο.',confirmLabel:'Απόσυρση'})
  if(!ok)return
  setRows(current=>{const next=current.map(x=>x.id===item.id?{...x,status:'retired',retiredAt:new Date().toISOString()}:x);saveBundleLibrary(next);return next})
  notify('Το Bundle αποσύρθηκε.','success')
 }

 return <div className="bundle-library-panel">
  <div className="bundle-library-toolbar">
   <div><h3>Bundles Πρόληψης</h3><p>Versioned templates για κλινική εφαρμογή, auditability και ελεγχόμενες αλλαγές.</p></div>
   <div className="bundle-library-actions"><span className="bundle-library-count"><b>{publishCount}</b> published</span><Button onClick={newBundle}><Plus size={15}/>Νέο Bundle</Button></div>
  </div>
  <FilterBar compact query={query} onQueryChange={setQuery} placeholder="Αναζήτηση Bundle..." onClear={()=>{setQuery('');setStatus('all')}} advanced={<label className="filter-select"><span>Κατάσταση</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Όλες</option><option value="published">Published</option><option value="draft">Draft</option><option value="retired">Retired</option></select></label>} activeAdvancedCount={status==='all'?0:1}/>
  <div className="table-wrap scroll-table bundle-library-table-wrap">
   <table className="data-table sticky-table bundle-library-table">
    <thead><tr><th>Bundle</th><th>Έκδοση</th><th>Κατάσταση</th><th>Στοιχεία</th><th>Πηγή / guideline</th><th>Scope</th><th></th></tr></thead>
    <tbody>{filtered.map(item=><tr key={item.id} className="clickable-row" onClick={()=>setSelected(JSON.parse(JSON.stringify(item)))}>
     <td><strong>{item.name}</strong><small>{item.titleEl}{item.titleEn?` · ${item.titleEn}`:''}</small></td>
     <td><strong>v{item.version}</strong></td>
     <td><span className={`bundle-library-status ${item.status}`}>{STATUS_LABELS[item.status]}</span></td>
     <td>{item.elements.length}</td>
     <td><strong>{item.source||'—'}</strong><small>{item.sourceVersion||''}</small></td>
     <td><span className="bundle-library-scope-text">{item.scope||'—'}</span></td>
     <td onClick={e=>e.stopPropagation()}><div className="row-actions">
      <button className="icon-button" title="Άνοιγμα / επεξεργασία" onClick={()=>setSelected(JSON.parse(JSON.stringify(item)))}><Edit3 size={14}/></button>
      <button className="icon-button" title="Δημιουργία νέας draft έκδοσης" onClick={()=>duplicate(item)}><Copy size={14}/></button>
      {item.status==='draft'&&<button className="text-button compact" onClick={()=>publish(item)}><Check size={13}/> Publish</button>}
      {item.status==='published'&&<button className="text-button compact" onClick={()=>retire(item)}><RotateCcw size={13}/> Retire</button>}
     </div></td>
    </tr>)}</tbody>
   </table>
  </div>
  {selected&&<BundleEditor draft={selected} onClose={()=>setSelected(null)} onSave={save}/>}
 </div>
}

function BundleEditor({draft,onClose,onSave}){
 const [value,setValue]=useState(draft)
 const set=(k,v)=>setValue(x=>({...x,[k]:v}))
 function elementChange(index,key,v){setValue(x=>({...x,elements:x.elements.map((e,i)=>i===index?{...e,[key]:v}:e)}))}
 function addElement(){setValue(x=>({...x,elements:[...x.elements,{id:`item_${Date.now()}`,labelEl:'',labelEn:'',required:true}]}))}
 async function removeElement(index){const ok=await confirm({title:'Αφαίρεση στοιχείου',message:'Το στοιχείο θα αφαιρεθεί από το Bundle. Θέλετε να συνεχίσετε;',confirmLabel:'Αφαίρεση',danger:true});if(!ok)return;setValue(x=>({...x,elements:x.elements.filter((_,i)=>i!==index)}));notify('Το στοιχείο αφαιρέθηκε.','success')}
 const locked=value.status==='published'||value.status==='retired'
 return <div className="modal-backdrop"><div className="entry-card bundle-library-editor">
  <header><div><span className="eyebrow">BUNDLE LIBRARY</span><h3>{locked?'Προβολή δημοσιευμένης έκδοσης':'Επεξεργασία Draft Bundle'}</h3><p>{locked?'Published/retired εκδόσεις παραμένουν αμετάβλητες. Δημιούργησε draft copy για αλλαγές.':'Οι αλλαγές ενεργοποιούνται μόνο μετά από Publish.'}</p></div><button className="icon-close" onClick={onClose}><X size={16}/></button></header>
  <div className="bundle-library-editor-body">
   <section className="bundle-editor-meta">
    <div className="entry-grid">
     <label><span>Κωδικός *</span><input disabled={locked||value.system} value={value.id} onChange={e=>set('id',e.target.value)}/></label>
     <label><span>Όνομα *</span><input disabled={locked} value={value.name} onChange={e=>set('name',e.target.value)}/></label>
     <label><span>Τίτλος EL *</span><input disabled={locked} value={value.titleEl} onChange={e=>set('titleEl',e.target.value)}/></label>
     <label><span>Title EN</span><input disabled={locked} value={value.titleEn} onChange={e=>set('titleEn',e.target.value)}/></label>
     <label><span>Έκδοση *</span><input disabled={locked} value={value.version} onChange={e=>set('version',e.target.value)}/></label>
     <label><span>Scope</span><input disabled={locked} value={value.scope||''} onChange={e=>set('scope',e.target.value)}/></label>
     <label><span>Πηγή / guideline</span><input disabled={locked} value={value.source||''} onChange={e=>set('source',e.target.value)}/></label>
     <label><span>Έκδοση / review πηγής</span><input disabled={locked} value={value.sourceVersion||''} onChange={e=>set('sourceVersion',e.target.value)}/></label>
    </div>
   </section>
   <section className="bundle-editor-elements">
    <div className="bundle-editor-elements-head"><div><strong>Στοιχεία Bundle</strong><small>Η σειρά εδώ είναι η σειρά στην εκτέλεση.</small></div>{!locked&&<button type="button" className="button button-secondary" onClick={addElement}><Plus size={13}/>Προσθήκη στοιχείου</button>}</div>
    <div className="bundle-editor-element-list">{value.elements.map((e,i)=><div className="bundle-editor-element" key={e.id}>
     <span className="bundle-editor-order">{i+1}</span>
     <div><input disabled={locked} value={e.labelEl} onChange={ev=>elementChange(i,'labelEl',ev.target.value)} placeholder="Περιγραφή EL"/><input disabled={locked} value={e.labelEn||''} onChange={ev=>elementChange(i,'labelEn',ev.target.value)} placeholder="Description EN"/></div>
     <label className="bundle-required-toggle"><input type="checkbox" disabled={locked} checked={e.required!==false} onChange={ev=>elementChange(i,'required',ev.target.checked)}/><span>Required</span></label>
     {!locked&&<button className="icon-button danger" onClick={()=>removeElement(i)}><X size={13}/></button>}
    </div>)}</div>
   </section>
  </div>
  <footer><Button variant="secondary" onClick={onClose}>Κλείσιμο</Button>{!locked&&<Button disabled={!value.id.trim()||!value.name.trim()||!value.titleEl.trim()||value.elements.length===0} onClick={()=>onSave(value)}>Αποθήκευση Draft</Button>}</footer>
 </div></div>
}
