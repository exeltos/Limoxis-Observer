import { useEffect,useState } from 'react'
import { Pencil,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { IconButton } from '../../design-system/IconButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { HAI_CRITERIA_SETS } from '../surveillance/haiCriteriaDefinitions'
import { loadHaiCriteriaLibraryItems,loadGlobalHaiCriteriaLibraryItems,updateGlobalHaiCriteriaLibraryItem } from './haiCriteriaLibraryCloudService'

const RULE_LABELS={el:{all:'Όλα τα κριτήρια','any':'Οποιοδήποτε κριτήριο',atLeastTwo:'Τουλάχιστον 2 κριτήρια'},en:{all:'All criteria',any:'Any criterion',atLeastTwo:'At least 2 criteria'}}
const clone=value=>JSON.parse(JSON.stringify(value))
const demoRows=()=>Object.entries(HAI_CRITERIA_SETS).map(([key,set])=>({id:key,criteriaKey:key,labelEl:set.labelEl,labelEn:set.labelEn,source:set.source,groups:set.groups,system:true,organizationId:null}))

export function HaiCriteriaLibraryPanel({global=false}={}){
 const {notify}=useFeedback()
 const {tenant,isDemo:tenantIsDemo}=useTenant();const isDemo=!global&&tenantIsDemo;const isPlatformOwner=global // system (platform-wide) entries are edited only on the platform screen
 const {language}=useLanguage();const en=language==='en';const ruleLabels=RULE_LABELS[language]||RULE_LABELS.en
 const [rows,setRows]=useState(()=>isDemo?demoRows():[])
 const [loading,setLoading]=useState(!isDemo)
 const [selected,setSelected]=useState(null)

 useEffect(()=>{
  if(isDemo){setRows(demoRows());setLoading(false);return}
  if(!global&&!tenant?.id)return
  let active=true;setLoading(true)
  const loader=global?loadGlobalHaiCriteriaLibraryItems():loadHaiCriteriaLibraryItems(tenant.id)
  loader.then(data=>{if(active)setRows(data)}).catch(error=>{if(active)notify(error?.message||(en?'Could not load the HAI criteria library.':'Δεν ήταν δυνατή η φόρτωση της βιβλιοθήκης κριτηρίων HAI.'),'error')}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[global,isDemo,tenant?.id,en,notify])

 function openItem(item){setSelected({...clone(item),readOnly:!isPlatformOwner})}

 async function save(item){
  if(!isPlatformOwner)return
  try{
   if(isDemo){notify(en?'Demo mode: changes are not persisted.':'Λειτουργία demo: οι αλλαγές δεν αποθηκεύονται.','warning');setSelected(null);return}
   const saved=await updateGlobalHaiCriteriaLibraryItem(item)
   setRows(current=>current.map(x=>x.id===saved.id?saved:x))
   setSelected(null);notify(en?'Criteria set saved. The change will apply to every hospital.':'Το σετ κριτηρίων αποθηκεύτηκε. Η αλλαγή θα ισχύσει για όλα τα νοσοκομεία.','success')
  }catch(error){notify(error?.message||(en?'The criteria set could not be saved.':'Δεν ήταν δυνατή η αποθήκευση του σετ κριτηρίων.'),'error')}
 }

 return <div className="bundle-library-panel hai-criteria-library-panel">
  <div className="section-toolbar bundle-library-toolbar"><div><h2>{en?'HAI Surveillance Criteria':'Κριτήρια Επιτήρησης HAI'}</h2><p>{en?'CDC/NHSN-based checklists (CLABSI/CAUTI/VAP/SSI) offered in the HAI classification dialog.':'Λίστες ελέγχου βάσει CDC/NHSN (CLABSI/CAUTI/VAP/SSI) που εμφανίζονται στον διάλογο ταξινόμησης HAI.'}</p></div></div>
  {loading&&<div className="inline-empty">{en?'Loading...':'Φόρτωση...'}</div>}
  <RegistryTable
    wrapperClassName="table-wrap scroll-table bundle-library-table-wrap"
    className="bundle-library-table"
    columns={[{key:'set',label:en?'Criteria set':'Σετ κριτηρίων'},{key:'source',label:en?'Source':'Πηγή'},{key:'groups',label:en?'Groups':'Ομάδες'},{key:'items',label:en?'Items':'Κριτήρια'},{key:'actions',label:''}]}
    rows={rows}
    rowKey={item=>item.id}
    rowProps={item=>({className:'clickable-row',onClick:()=>openItem(item)})}
    renderRow={item=><><td><strong>{en?item.labelEn:item.labelEl}</strong>{item.system&&<span className="status-badge active">{en?'System · Owner managed':'Σύστημα · Μόνο ιδιοκτήτης'}</span>}</td><td>{(en?item.source:String(item.source||'').replace('simplified, age ≤1 year LCBI criteria','απλοποιημένα, κριτήρια LCBI για ηλικία ≤1 έτους').replace('(simplified)','(απλοποιημένα)'))||'—'}</td><td>{item.groups?.length||0}</td><td>{item.groups?.reduce((sum,group)=>sum+(group.items?.length||0),0)||0}</td><td onClick={e=>e.stopPropagation()}><OverflowMenu items={[{id:'edit',label:en?'Edit':'Επεξεργασία',icon:Pencil,hidden:!isPlatformOwner,onClick:()=>openItem(item)}]}/></td></>}
  />{!loading&&!rows.length&&<div className="inline-empty">{en?'No criteria sets found.':'Δεν βρέθηκαν σετ κριτηρίων.'}</div>}
  {selected&&<HaiCriteriaEditor language={language} draft={selected} ruleLabels={ruleLabels} onClose={()=>setSelected(null)} onSave={save}/>}
 </div>
}

const rowsFor=text=>Math.min(5,Math.max(2,Math.ceil(String(text||'').length/52)))

function HaiCriteriaEditor({draft,onClose,onSave,language,ruleLabels}){
 const en=language==='en'
 const [value,setValue]=useState({...draft,groups:(draft.groups||[]).map(group=>({...group,items:(group.items||[]).map(item=>({...item}))}))})
 const locked=Boolean(value.readOnly)
 const set=(key,v)=>setValue(x=>({...x,[key]:v}))
 function groupChange(gi,key,v){setValue(x=>({...x,groups:x.groups.map((g,i)=>i===gi?{...g,[key]:v}:g)}))}
 function itemChange(gi,ii,key,v){setValue(x=>({...x,groups:x.groups.map((g,i)=>i!==gi?g:{...g,items:g.items.map((it,n)=>n===ii?{...it,[key]:v}:it)})}))}
 function addItem(gi){setValue(x=>({...x,groups:x.groups.map((g,i)=>i!==gi?g:{...g,items:[...g.items,{id:`item_${Date.now()}`,textEl:'',textEn:''}]})}))}
 function removeItem(gi,ii){setValue(x=>({...x,groups:x.groups.map((g,i)=>i!==gi?g:{...g,items:g.items.filter((_,n)=>n!==ii)})}))}
 function addGroup(){setValue(x=>({...x,groups:[...x.groups,{id:`group_${Date.now()}`,rule:'any',items:[]}]}))}
 function removeGroup(gi){setValue(x=>({...x,groups:x.groups.filter((_,i)=>i!==gi)}))}
 function submit(){onSave(value)}
 return <ObserverDialog width="wide" className="hai-criteria-dialog" eyebrow={en?'HAI CRITERIA':'ΚΡΙΤΗΡΙΑ HAI'} title={locked?(en?'Read-only criteria set':'Προβολή σετ κριτηρίων'):(en?'Edit criteria set':'Επεξεργασία σετ κριτηρίων')} subtitle={locked?(en?'Only platform administration can edit a system criteria set.':'Μόνο η διαχείριση της πλατφόρμας μπορεί να επεξεργαστεί ένα σετ κριτηρίων συστήματος.'):(en?'Changes apply immediately to every hospital using this criteria set.':'Οι αλλαγές ισχύουν αμέσως για κάθε νοσοκομείο που χρησιμοποιεί αυτό το σετ κριτηρίων.')} onClose={onClose} footer={<DialogActions showCancel cancelLabel={locked?(en?'Close':'Κλείσιμο'):undefined} onCancel={onClose} onSave={locked?undefined:submit}/>}>
  <section className="record-section hai-editor-meta"><div className="record-section-header"><div><span className="eyebrow">{en?'IDENTITY':'ΣΤΟΙΧΕΙΑ'}</span><h3>{en?'Criteria set':'Σετ κριτηρίων'}</h3></div></div><div className="entry-grid hai-editor-meta-grid">
   <label><span>{en?'Label (EL) *':'Ετικέτα (EL) *'}</span><input disabled={locked} value={value.labelEl||''} onChange={e=>set('labelEl',e.target.value)}/></label>
   <label><span>{en?'Label (EN)':'Ετικέτα (EN)'}</span><input disabled={locked} value={value.labelEn||''} onChange={e=>set('labelEn',e.target.value)}/></label>
   <label className="entry-span-2"><span>{en?'Source':'Πηγή'}</span><input disabled={locked} value={value.source||''} onChange={e=>set('source',e.target.value)}/></label>
  </div></section>
  <section className="record-section hai-editor-groups"><div className="record-section-header"><div><span className="eyebrow">{en?'LOGIC':'ΛΟΓΙΚΗ'}</span><h3>{en?'Criteria groups':'Ομάδες κριτηρίων'}</h3><p>{en?'Each group is satisfied according to its rule; the checklist is met only when every group is satisfied.':'Κάθε ομάδα ικανοποιείται σύμφωνα με τον κανόνα της· η λίστα ελέγχου πληρείται μόνο όταν ικανοποιούνται όλες οι ομάδες.'}</p></div>{!locked&&<Button variant="secondary" onClick={addGroup}><Plus size={14}/>{en?'Add group':'Νέα ομάδα'}</Button>}</div>
   {(value.groups||[]).map((group,gi)=><div className={`hai-group-card ${locked?'is-locked':''}`} key={gi}>
    <div className="hai-group-head">
     <span className="hai-group-index">{gi+1}</span>
     <label><span>{en?'Group code':'Κωδικός ομάδας'}</span><input disabled={locked} value={group.id||''} onChange={e=>groupChange(gi,'id',e.target.value)}/></label>
     <label><span>{en?'Rule':'Κανόνας'}</span><select disabled={locked} value={group.rule||'any'} onChange={e=>groupChange(gi,'rule',e.target.value)}><option value="all">{ruleLabels.all}</option><option value="any">{ruleLabels.any}</option><option value="atLeastTwo">{ruleLabels.atLeastTwo}</option></select></label>
     {!locked&&<IconButton tone="danger" size="sm" onClick={()=>removeGroup(gi)} label={en?'Remove group':'Αφαίρεση ομάδας'}><Trash2 size={15}/></IconButton>}
    </div>
    <div className="hai-item-table">
     <div className="hai-item-row hai-item-head"><span>{en?'Criterion (EL)':'Κριτήριο (EL)'}</span><span>{en?'Criterion (EN)':'Κριτήριο (EN)'}</span>{!locked&&<span/>}</div>
     {(group.items||[]).map((item,ii)=><div className="hai-item-row" key={item.id||ii}>
      <textarea rows={rowsFor(item.textEl)} disabled={locked} value={item.textEl||''} aria-label={en?'Criterion (EL)':'Κριτήριο (EL)'} onChange={e=>itemChange(gi,ii,'textEl',e.target.value)}/>
      <textarea rows={rowsFor(item.textEn)} disabled={locked} value={item.textEn||''} aria-label={en?'Criterion (EN)':'Κριτήριο (EN)'} onChange={e=>itemChange(gi,ii,'textEn',e.target.value)}/>
      {!locked&&<IconButton tone="danger" size="sm" onClick={()=>removeItem(gi,ii)} label={en?'Remove':'Αφαίρεση'}><Trash2 size={15}/></IconButton>}
     </div>)}
     {!(group.items||[]).length&&<div className="inline-empty">{en?'No criteria yet.':'Δεν υπάρχουν ακόμη κριτήρια.'}</div>}
    </div>
    {!locked&&<div className="hai-group-actions"><Button variant="secondary" onClick={()=>addItem(gi)}><Plus size={14}/>{en?'Add criterion':'Νέο κριτήριο'}</Button></div>}
   </div>)}
  </section>
 </ObserverDialog>
}
