import { useEffect,useMemo,useState } from 'react'
import { Check,Copy,Pencil,Plus,RotateCcw,Trash2,X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterBar } from '../../design-system/FilterBar'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { loadBundleLibrary,saveBundleLibrary } from './bundleLibraryData'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { ROLES } from '../../core/permissions/roles'
import { createBundleTemplate,loadBundleTemplates,publishBundleTemplate,removeBundleTemplate,retireBundleTemplate,updateBundleTemplate } from './bundleLibraryCloudService'
const STATUS_LABELS={el:{draft:'Πρόχειρο',published:'Δημοσιευμένο',retired:'Αποσυρμένο'},en:{draft:'Draft',published:'Published',retired:'Retired'}}
const clone=value=>JSON.parse(JSON.stringify(value))
const normalize=item=>({...item,bundleKey:item.bundleKey||item.id})

export function BundleLibraryPanel(){
 const {notify,confirm}=useFeedback()
 const {tenant,isDemo,role}=useTenant();const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const {language}=useLanguage();const en=language==='en';const statusLabels=STATUS_LABELS[language]||STATUS_LABELS.en
 const [rows,setRows]=useState(()=>isDemo?loadBundleLibrary().map(normalize):[])
 const [loading,setLoading]=useState(!isDemo)
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('all')
 const [selected,setSelected]=useState(null)
 const filtered=useMemo(()=>rows.filter(x=>!x.hidden).filter(x=>status==='all'||x.status===status).filter(x=>`${x.bundleKey||''} ${x.name||''} ${x.titleEl||''} ${x.titleEn||''} ${x.source||''} ${x.scope||''}`.toLowerCase().includes(query.toLowerCase())),[rows,query,status])
 const publishCount=rows.filter(x=>!x.hidden&&x.status==='published').length

 useEffect(()=>{
  if(isDemo){setRows(loadBundleLibrary().map(normalize));setLoading(false);return}
  if(!tenant?.id)return
  let active=true;setLoading(true)
  loadBundleTemplates(tenant.id).then(data=>{if(active)setRows(data)}).catch(error=>{if(active)notify(error?.message||(en?'Could not load Bundle Library.':'Δεν ήταν δυνατή η φόρτωση της Βιβλιοθήκης Bundles.'),'error')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[isDemo,tenant?.id,en,notify])

 function newBundle(){setSelected({bundleKey:`CUSTOM-${Date.now()}`,name:en?'New Bundle':'Νέα δέσμη μέτρων',titleEl:'',titleEn:'',version:'0.1',status:'draft',scope:'',source:en?'Local protocol':'Τοπικό πρωτόκολλο',sourceVersion:'',system:false,departments:[],elements:[{id:'item_1',labelEl:'',labelEn:'',required:true}],isNew:true})}
 function duplicate(item){setSelected({...clone(item),id:undefined,bundleKey:item.bundleKey||item.name,name:`${item.name} Copy`,version:nextBundleVersion(item.version),status:'draft',system:false,source:`${item.source||'Core'} · hospital copy`,basedOn:isDemo?null:item.id,publishedAt:null,retiredAt:null,isNew:true})}
 function openBundle(item){const immutable=!item.system&&(item.status==='published'||item.status==='retired');const readOnly=(item.system&&!isPlatformOwner)||immutable;setSelected({...clone(item),readOnly})}

 async function removeBundle(item){
  if(item.system&&!isPlatformOwner){notify(en?'System-managed Bundles can only be changed by the Platform Owner.':'Τα system-managed Bundles μπορούν να αλλάξουν μόνο από τον Platform Owner.','warning');return}
  const ok=await confirm({title:en?'Delete Bundle':'Διαγραφή Bundle',message:item.system?(en?`System Bundle “${item.name}” will be permanently removed. Continue?`:`Το System Bundle «${item.name}» θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;`):(en?`Bundle “${item.name}” will be removed. Existing clinical assessments remain unchanged.`:`Το Bundle «${item.name}» θα αφαιρεθεί. Οι υπάρχουσες κλινικές αξιολογήσεις δεν επηρεάζονται.`),confirmLabel:en?'Delete':'Διαγραφή',danger:true})
  if(!ok)return
  try{
   if(isDemo){const next=rows.filter(x=>x.id!==item.id);setRows(next);saveBundleLibrary(next)}else{await removeBundleTemplate(tenant.id,item);setRows(current=>current.filter(x=>x.id!==item.id))}
   notify(en?'Bundle removed.':'Το Bundle αφαιρέθηκε.','success')
  }catch(error){notify(error?.message||(en?'Bundle could not be removed.':'Δεν ήταν δυνατή η διαγραφή του Bundle.'),'error')}
 }

 async function save(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can modify this system item.':'Μόνο ο Platform Owner μπορεί να τροποποιήσει αυτό το στοιχείο συστήματος.','warning');return}
  const cleaned={...item,titleEn:item.titleEl,elements:(item.elements||[]).map(element=>({...element,labelEn:element.labelEl}))};delete cleaned.readOnly;delete cleaned.isNew
  try{
   if(isDemo){
    const demoItem={...cleaned,id:cleaned.id||cleaned.bundleKey};const exists=rows.some(x=>x.id===demoItem.id);const next=exists?rows.map(x=>x.id===demoItem.id?demoItem:x):[demoItem,...rows];setRows(next);saveBundleLibrary(next)
   }else{
    const saved=item.isNew||!item.id?await createBundleTemplate(tenant.id,cleaned):await updateBundleTemplate(tenant.id,cleaned)
    setRows(current=>item.isNew||!item.id?[saved,...current]:current.map(x=>x.id===saved.id?saved:x))
   }
   setSelected(null);notify(en?'Bundle saved to the Library.':'Το Bundle αποθηκεύτηκε στη Βιβλιοθήκη.','success')
  }catch(error){notify(error?.message||(en?'Bundle could not be saved.':'Δεν ήταν δυνατή η αποθήκευση του Bundle.'),'error')}
 }

 async function publish(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can publish system Bundles.':'Μόνο ο Platform Owner μπορεί να δημοσιεύει System Bundles.','warning');return}
  const ok=await confirm({title:en?'Publish Bundle':'Δημοσίευση Bundle',message:en?'This version will become available for new executions. Historical executions remain linked to their original version.':'Η έκδοση θα είναι διαθέσιμη για νέες εκτελέσεις. Οι ιστορικές εκτελέσεις παραμένουν συνδεδεμένες με την αρχική τους έκδοση.',confirmLabel:en?'Publish':'Δημοσίευση'});if(!ok)return
  try{if(isDemo){const next=rows.map(x=>x.id===item.id?{...x,status:'published',publishedAt:new Date().toISOString()}:x);setRows(next);saveBundleLibrary(next)}else{const saved=await publishBundleTemplate(tenant.id,item);setRows(current=>current.map(x=>x.id===saved.id?saved:x))}notify(en?'Version published.':'Η έκδοση δημοσιεύτηκε.','success')}catch(error){notify(error?.message||(en?'Version could not be published.':'Δεν ήταν δυνατή η δημοσίευση της έκδοσης.'),'error')}
 }

 async function retire(item){
  if(item.system&&!isPlatformOwner){notify(en?'Only the Platform Owner can retire system Bundles.':'Μόνο ο Platform Owner μπορεί να αποσύρει System Bundles.','warning');return}
  const ok=await confirm({title:en?'Retire Bundle':'Απόσυρση Bundle',message:en?'It will no longer be offered for new executions. History remains available.':'Δεν θα προσφέρεται για νέες εκτελέσεις. Το ιστορικό παραμένει διαθέσιμο.',confirmLabel:en?'Retire':'Απόσυρση'});if(!ok)return
  try{if(isDemo){const next=rows.map(x=>x.id===item.id?{...x,status:'retired',retiredAt:new Date().toISOString()}:x);setRows(next);saveBundleLibrary(next)}else{const saved=await retireBundleTemplate(tenant.id,item);setRows(current=>current.map(x=>x.id===saved.id?saved:x))}notify(en?'Bundle retired.':'Το Bundle αποσύρθηκε.','success')}catch(error){notify(error?.message||(en?'Bundle could not be retired.':'Δεν ήταν δυνατή η απόσυρση του Bundle.'),'error')}
 }

 return <div className="bundle-library-panel">
  <div className="bundle-library-toolbar"><div><h3>{en?'Prevention Bundles':'Δέσμες Πρόληψης'}</h3><p>{en?'Versioned templates with controlled system and hospital governance.':'Πρότυπα με ελεγχόμενες εκδόσεις συστήματος και νοσοκομείου.'}</p></div><div className="bundle-library-actions"><span className="bundle-library-count"><b>{publishCount}</b> {en?'published':'δημοσιευμένα'}</span><Button onClick={newBundle}><Plus size={15}/>{en?'New Bundle':'Νέα δέσμη μέτρων'}</Button></div></div>
  <FilterBar compact query={query} onQueryChange={setQuery} placeholder={en?'Search Bundle...':'Αναζήτηση Bundle...'} onClear={()=>{setQuery('');setStatus('all')}} advanced={<label className="filter-select"><span>{en?'Status':'Κατάσταση'}</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">{en?'All':'Όλες'}</option><option value="published">{statusLabels.published}</option><option value="draft">{statusLabels.draft}</option><option value="retired">{statusLabels.retired}</option></select></label>} activeAdvancedCount={status==='all'?0:1}/>
  {loading&&<div className="inline-empty">{en?'Loading...':'Φόρτωση...'}</div>}
  <RegistryTable
    wrapperClassName="table-wrap scroll-table bundle-library-table-wrap"
    className="bundle-library-table"
    columns={[{key:'bundle',label:'Bundle'},{key:'version',label:en?'Version':'Έκδοση'},{key:'status',label:en?'Status':'Κατάσταση'},{key:'elements',label:en?'Elements':'Στοιχεία'},{key:'source',label:en?'Source / guideline':'Πηγή / guideline'},{key:'scope',label:en?'Scope':'Πεδίο'},{key:'actions',label:''}]}
    rows={filtered}
    rowKey={item=>item.id||`${item.bundleKey}-${item.version}`}
    rowProps={item=>({className:'clickable-row',onClick:()=>openBundle(item)})}
    renderRow={item=>{const systemLocked=item.system&&!isPlatformOwner;return <><td><strong>{item.name}</strong>{item.system&&<span className="status-badge active">{en?'System · Owner managed':'System · Μόνο Owner'}</span>}<small>{item.titleEl}</small></td><td><strong>v{item.version}</strong></td><td><span className={`bundle-library-status ${item.status}`}>{statusLabels[item.status]}</span></td><td>{item.elements?.length||0}</td><td><strong>{item.source||'—'}</strong><small>{item.sourceVersion||''}</small></td><td><span className="bundle-library-scope-text">{item.scope||'—'}</span></td><td onClick={e=>e.stopPropagation()}><OverflowMenu items={[
      {id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:()=>openBundle(item),hidden:systemLocked||item.status!=='draft'},
      {id:'duplicate',label:en?'Create new draft version':'Δημιουργία νέας draft έκδοσης',icon:Copy,onClick:()=>duplicate(item),hidden:systemLocked},
      {id:'publish',label:en?'Publish':'Δημοσίευση',icon:Check,onClick:()=>publish(item),hidden:systemLocked||item.status!=='draft'},
      {id:'retire',label:en?'Retire':'Απόσυρση',icon:RotateCcw,onClick:()=>retire(item),hidden:systemLocked||item.status!=='published'},
      {id:'delete',label:en?'Delete':'Διαγραφή',icon:Trash2,tone:'danger',separatorBefore:true,onClick:()=>removeBundle(item),hidden:systemLocked},
    ]}/></td></>}}
  />{!loading&&filtered.length===0&&<div className="inline-empty">{en?'No Bundles found.':'Δεν βρέθηκαν Bundles.'}</div>}
  {selected&&<BundleEditor language={language} draft={selected} isPlatformOwner={isPlatformOwner} onClose={()=>setSelected(null)} onSave={save}/>} 
 </div>
}

function nextBundleVersion(version){const p=String(version||'1.0').split('.').map(Number);return p.length>=2&&p.every(Number.isFinite)?`${p[0]}.${p[1]+1}`:'1.1'}
function BundleEditor({draft,onClose,onSave,language,isPlatformOwner}){
 const {notify,confirm}=useFeedback();const en=language==='en';const [value,setValue]=useState({...draft,titleEl:draft.titleEl||draft.titleEn||'',elements:(draft.elements||[]).map(element=>({...element,labelEl:element.labelEl||element.labelEn||''}))});const set=(k,v)=>setValue(x=>({...x,[k]:v}))
 function elementChange(index,key,v){setValue(x=>({...x,elements:x.elements.map((e,i)=>i===index?{...e,[key]:v}:e)}))}
 function addElement(){setValue(x=>({...x,elements:[...(x.elements||[]),{id:`item_${Date.now()}`,labelEl:'',labelEn:'',required:true}]}))}
 async function removeElement(index){const ok=await confirm({title:en?'Remove element':'Αφαίρεση στοιχείου',message:en?'The element will be removed from this Bundle draft. Continue?':'Το στοιχείο θα αφαιρεθεί από αυτό το πρόχειρο Bundle. Θέλετε να συνεχίσετε;',confirmLabel:en?'Remove':'Αφαίρεση',danger:true});if(!ok)return;setValue(x=>({...x,elements:x.elements.filter((_,i)=>i!==index)}));notify(en?'Element removed.':'Το στοιχείο αφαιρέθηκε.','success')}
 const locked=Boolean(value.readOnly)||(value.system&&!isPlatformOwner)||(!value.system&&(value.status==='published'||value.status==='retired'))
 function submit(){if(!value.bundleKey?.trim()||!value.name?.trim()||!value.titleEl?.trim()){notify(en?'Complete all required fields.':'Συμπληρώστε όλα τα υποχρεωτικά πεδία.','danger');return}onSave(value)}
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="entry-card bundle-library-editor" role="dialog" aria-modal="true"><header><div><span className="eyebrow">BUNDLE LIBRARY</span><h3>{locked?(en?'Read-only Bundle':'Προβολή Bundle'):(en?'Edit Bundle':'Επεξεργασία Bundle')}</h3><p>{value.system&&!isPlatformOwner?(en?'Limoxis system item. Only the Platform Owner can modify or delete it.':'Στοιχείο συστήματος Limoxis. Μόνο ο Platform Owner μπορεί να το τροποποιήσει ή να το διαγράψει.'):(locked?(en?'Published and retired versions are immutable. Create a new draft version to make changes.':'Οι δημοσιευμένες και αποσυρμένες εκδόσεις είναι αμετάβλητες. Δημιουργήστε νέα πρόχειρη έκδοση για αλλαγές.'):(en?'Changes become operational only after publishing.':'Οι αλλαγές γίνονται λειτουργικές μόνο μετά τη δημοσίευση.'))}</p></div><button className="icon-close" onClick={onClose}><X size={16}/></button></header><div className="bundle-library-editor-body"><section className="bundle-editor-meta"><div className="entry-grid"><label><span>{en?'Code *':'Κωδικός *'}</span><input disabled={locked||value.system||!value.isNew} value={value.bundleKey||''} onChange={e=>set('bundleKey',e.target.value)}/></label><label><span>{en?'Name *':'Όνομα *'}</span><input disabled={locked} value={value.name||''} onChange={e=>set('name',e.target.value)}/></label><label><span>{en?'Title *':'Τίτλος *'}</span><input disabled={locked} value={value.titleEl||''} onChange={e=>set('titleEl',e.target.value)}/></label><label><span>{en?'Version':'Έκδοση'}</span><input disabled={locked} value={value.version||''} onChange={e=>set('version',e.target.value)}/></label><label><span>{en?'Scope':'Πεδίο'}</span><input disabled={locked} value={value.scope||''} onChange={e=>set('scope',e.target.value)}/></label><label><span>{en?'Source':'Πηγή'}</span><input disabled={locked} value={value.source||''} onChange={e=>set('source',e.target.value)}/></label><label><span>{en?'Source version':'Έκδοση πηγής'}</span><input disabled={locked} value={value.sourceVersion||''} onChange={e=>set('sourceVersion',e.target.value)}/></label></div></section><section className="bundle-editor-elements"><div className="section-toolbar compact"><div><h4>{en?'Bundle elements':'Στοιχεία δέσμης μέτρων'}</h4><p>{en?'Required and optional controls stored with this exact version.':'Υποχρεωτικοί και προαιρετικοί έλεγχοι που αποθηκεύονται με αυτή την ακριβή έκδοση.'}</p></div>{!locked&&<Button variant="secondary" onClick={addElement}><Plus size={14}/>{en?'Add element':'Νέο στοιχείο'}</Button>}</div><div className="bundle-elements-list">{(value.elements||[]).map((element,index)=><div className="bundle-element-row" key={element.id||index}><input disabled={locked} value={element.labelEl||''} placeholder={en?'Bundle element':'Στοιχείο Bundle'} onChange={e=>elementChange(index,'labelEl',e.target.value)}/><label className="bundle-element-required"><input disabled={locked} type="checkbox" checked={Boolean(element.required)} onChange={e=>elementChange(index,'required',e.target.checked)}/><span>{en?'Required':'Υποχρεωτικό'}</span></label>{!locked&&<IconButton tone="danger" size="sm" onClick={()=>removeElement(index)} label={en?'Remove':'Αφαίρεση'}><Trash2 size={14}/></IconButton>}</div>)}</div></section></div><footer><Button variant="secondary" onClick={onClose}>{en?'Close':'Κλείσιμο'}</Button>{!locked&&<SaveButton onClick={submit}>{en?'Save draft':'Αποθήκευση'}</SaveButton>}</footer></div></div>
}
