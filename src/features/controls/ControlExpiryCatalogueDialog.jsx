import { useState } from 'react'
import { ClipboardList,Package,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { MultiSelect } from '../../design-system/MultiSelect'
import { DialogActions,ObserverDialog } from '../../design-system/ObserverDialog'
import { catalogueItem } from './controlExpiry'

// The medicines and supplies an expiry check goes through every time. Each item
// can be limited to some of the control's departments (none chosen = all).
// Items are added one at a time or pasted as a list, one per line.
export function ControlExpiryCatalogueDialog({items,departments,onClose,onSave,language}){
 const en=language==='en'
 const [rows,setRows]=useState(()=>items.map(item=>({...item})))
 const [mode,setMode]=useState('single')
 const [name,setName]=useState(''),[unit,setUnit]=useState(''),[deps,setDeps]=useState([])
 const [pasted,setPasted]=useState('')
 const known=new Set(rows.map(row=>row.item.trim().toLowerCase()))
 const addOne=()=>{const item=name.trim();if(!item||known.has(item.toLowerCase()))return;setRows(current=>[...current,catalogueItem({item,unit,departments:deps})]);setName('');setUnit('')}
 const pastedNames=[...new Set(pasted.split('\n').map(line=>line.trim()).filter(Boolean))].filter(item=>!known.has(item.toLowerCase()))
 const addPasted=()=>{if(!pastedNames.length)return;setRows(current=>[...current,...pastedNames.map(item=>catalogueItem({item,departments:deps}))]);setPasted('')}
 const update=(id,patch)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row))
 const departmentOptions=departments.map(dep=>({value:dep,label:dep}))
 const departmentPicker=(selected,onChange,label)=><MultiSelect label={label} options={departmentOptions} selected={selected} onChange={onChange} placeholder={en?'All departments':'Όλα τα τμήματα'} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} departments`:`${n} τμήματα`} disabled={!departments.length}/>
 return <ObserverDialog
  width="wide"
  fixedHeight
  className="control-expiry-catalogue-dialog"
  eyebrow={en?'EXPIRY CHECK':'ΕΛΕΓΧΟΣ ΛΗΞΕΩΝ'}
  title={en?'List of medicines and supplies':'Λίστα φαρμάκων και υλικών'}
  subtitle={en?'Every entry opens with these items ready, with the expiry and lot recorded last time.':'Κάθε καταχώρηση ανοίγει με αυτά τα υλικά έτοιμα, με τη λήξη και την παρτίδα της προηγούμενης φοράς.'}
  onClose={onClose}
  footer={<DialogActions onSave={()=>{onSave(rows);onClose()}} saveLabel={en?'Save list':'Αποθήκευση λίστας'}/>}
 >
  <div className="control-catalogue-add">
   <ModeSwitch ariaLabel={en?'How to add':'Τρόπος προσθήκης'} value={mode} onChange={setMode} options={[{value:'single',label:en?'One item':'Ένα υλικό',icon:Package},{value:'paste',label:en?'Paste a list':'Επικόλληση λίστας',icon:ClipboardList}]}/>
   {mode==='single'
    ? <div className="entry-grid control-catalogue-single">
       <label><span>{en?'Item / Medicine *':'Υλικό / Φάρμακο *'}</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addOne()}}} placeholder={en?'e.g. Adrenaline 1mg/ml':'π.χ. Adrenaline 1mg/ml'}/></label>
       <label><span>{en?'Unit / pack':'Μονάδα / συσκευασία'}</span><input value={unit} onChange={e=>setUnit(e.target.value)} placeholder={en?'e.g. ampoule':'π.χ. φύσιγγα'}/></label>
       {departmentPicker(deps,setDeps,en?'Departments':'Τμήματα')}
       <Button variant="secondary" disabled={!name.trim()||known.has(name.trim().toLowerCase())} onClick={addOne}><Plus size={15}/>{en?' Add':' Προσθήκη'}</Button>
      </div>
    : <div className="entry-grid control-catalogue-paste">
       <label><span>{en?'One item per line':'Ένα υλικό ανά γραμμή'}</span><textarea value={pasted} onChange={e=>setPasted(e.target.value)} placeholder={en?'Adrenaline 1mg/ml\nAtropine 0.5mg/ml\nSaline 0.9% 500ml':'Adrenaline 1mg/ml\nAtropine 0.5mg/ml\nΦυσιολογικός ορός 0,9% 500ml'}/></label>
       <div className="control-catalogue-paste-side">
        {departmentPicker(deps,setDeps,en?'Departments':'Τμήματα')}
        <Button variant="secondary" disabled={!pastedNames.length} onClick={addPasted}><Plus size={15}/>{en?` Add ${pastedNames.length||''} items`:` Προσθήκη ${pastedNames.length||''} υλικών`}</Button>
       </div>
      </div>}
  </div>
  <div className="control-catalogue-list">
   <div className="control-catalogue-list-head"><strong>{en?'Items':'Υλικά'}</strong><span>{rows.length}</span></div>
   {rows.length
    ? <div className="control-structured-table-wrap"><table className="control-structured-table control-catalogue-table"><thead><tr><th>{en?'Item / Medicine':'Υλικό / Φάρμακο'}</th><th>{en?'Unit / pack':'Μονάδα / συσκευασία'}</th><th>{en?'Departments':'Τμήματα'}</th><th aria-label={en?'Actions':'Ενέργειες'}/></tr></thead>
       <tbody>{rows.map(row=><tr key={row.id}>
        <td><input aria-label={en?'Item / Medicine':'Υλικό / Φάρμακο'} value={row.item} onChange={e=>update(row.id,{item:e.target.value})}/></td>
        <td><input aria-label={en?'Unit / pack':'Μονάδα / συσκευασία'} value={row.unit||''} onChange={e=>update(row.id,{unit:e.target.value})}/></td>
        <td>{departmentPicker(row.departments||[],next=>update(row.id,{departments:next}),en?'Departments':'Τμήματα')}</td>
        <td><button type="button" className="control-row-delete" title={en?'Remove item':'Αφαίρεση υλικού'} aria-label={en?'Remove item':'Αφαίρεση υλικού'} onClick={()=>setRows(current=>current.filter(x=>x.id!==row.id))}><Trash2 size={14}/></button></td>
       </tr>)}</tbody>
      </table></div>
    : <div className="inline-empty" role="status"><strong>{en?'No items yet':'Δεν υπάρχουν υλικά ακόμα'}</strong><span>{en?'Add the medicines and supplies this check goes through.':'Προσθέστε τα φάρμακα και τα υλικά που ελέγχονται κάθε φορά.'}</span></div>}
  </div>
 </ObserverDialog>
}
