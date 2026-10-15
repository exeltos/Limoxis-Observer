import { useState } from 'react'
import { ClipboardPaste,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { MultiSelect } from '../../design-system/MultiSelect'
import { DialogActions,ObserverDialog } from '../../design-system/ObserverDialog'
import { ExpiryBadge } from './ControlExpiryEntry'
import { ITEM_FORMS,catalogueItem,parseCatalogueLines } from './controlExpiry'

// The medicines and supplies an expiry check goes through, one row each: name,
// quantity, form (tablet, vial, …), expiry date, note and the departments that
// keep it (none chosen = all). Rows can also be pasted from a spreadsheet.
// defaultDepartments: what a new row starts with (a department's own control: that department).
export function ControlExpiryCatalogueDialog({items,departments,defaultDepartments=[],window,onClose,onSave,language}){
 const en=language==='en'
 const fresh=(row={})=>catalogueItem({...row,departments:row.departments?.length?row.departments:defaultDepartments})
 const [rows,setRows]=useState(()=>items.length?items.map(item=>({...item,departments:item.departments?.length?item.departments:[...defaultDepartments]})):[fresh()])
 const [pasteOpen,setPasteOpen]=useState(false),[pasted,setPasted]=useState('')
 const update=(id,patch)=>setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row))
 const addRow=()=>setRows(current=>[...current,fresh()])
 const pastedRows=parseCatalogueLines(pasted)
 const addPasted=()=>{if(!pastedRows.length)return;setRows(current=>[...current.filter(row=>row.item.trim()),...pastedRows.map(row=>fresh(row))]);setPasted('');setPasteOpen(false)}
 const departmentOptions=departments.map(dep=>({value:dep,label:dep}))
 const filled=rows.filter(row=>String(row.item||'').trim())
 return <ObserverDialog
  width="workspace"
  fixedHeight
  className="control-expiry-catalogue-dialog"
  eyebrow={en?'EXPIRY CHECK':'ΕΛΕΓΧΟΣ ΛΗΞΕΩΝ'}
  title={en?'List of medicines and supplies':'Λίστα φαρμάκων και υλικών'}
  subtitle={en?'Every entry opens with these items ready; the expiry dates here show on the Expiry tab until an entry records new ones.':'Κάθε καταχώρηση ανοίγει με αυτά τα υλικά έτοιμα· οι λήξεις εδώ εμφανίζονται στις Λήξεις μέχρι να καταγραφούν νέες.'}
  onClose={onClose}
  footer={<DialogActions onSave={()=>{onSave(filled);onClose()}} saveLabel={en?`Save list (${filled.length})`:`Αποθήκευση λίστας (${filled.length})`}/>}
 >
  <div className="control-catalogue-toolbar">
   <Button variant="secondary" onClick={addRow}><Plus size={15}/>{en?' Add row':' Νέα γραμμή'}</Button>
   <Button variant={pasteOpen?'primary':'secondary'} onClick={()=>setPasteOpen(open=>!open)}><ClipboardPaste size={15}/>{en?' Paste from Excel':' Επικόλληση από Excel'}</Button>
  </div>
  {pasteOpen&&<div className="control-catalogue-paste">
   <label className="field"><span className="lo-field-label">{en?'One item per line: name, quantity, form, expiry, note (columns copied from Excel)':'Ένα υλικό ανά γραμμή: ονομασία, ποσότητα, είδος, λήξη, παρατήρηση (στήλες αντιγραμμένες από Excel)'}</span><textarea autoFocus value={pasted} onChange={e=>setPasted(e.target.value)} placeholder={'Adrenaline 1mg/ml\t10\tΦύσιγγα\t31/12/2026\nΦυσιολογικός ορός 0,9% 500ml\t24\tΦιάλη\t30/06/2027'}/></label>
   <Button variant="secondary" disabled={!pastedRows.length} onClick={addPasted}><Plus size={15}/>{en?` Add ${pastedRows.length||''} rows`:` Προσθήκη ${pastedRows.length||''} γραμμών`}</Button>
  </div>}
  <div className="control-structured-table-wrap control-catalogue-wrap">
   <table className="control-structured-table control-catalogue-table">
    <thead><tr><th>{en?'Name':'Ονομασία'}</th><th>{en?'Quantity':'Ποσότητα'}</th><th>{en?'Form':'Είδος'}</th><th>{en?'Expiry date':'Ημερομηνία λήξης'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Note':'Παρατήρηση'}</th><th>{en?'Departments':'Τμήματα'}</th><th aria-label={en?'Actions':'Ενέργειες'}/></tr></thead>
    <tbody>{rows.map((row,index)=><tr key={row.id}>
     <td><input autoFocus={!pasteOpen&&index===rows.length-1&&!row.item} aria-label={en?'Name':'Ονομασία'} value={row.item} onChange={e=>update(row.id,{item:e.target.value})} placeholder={en?'e.g. Adrenaline 1mg/ml':'π.χ. Adrenaline 1mg/ml'}/></td>
     <td><input type="number" min="0" aria-label={en?'Quantity':'Ποσότητα'} value={row.quantity||''} onChange={e=>update(row.id,{quantity:e.target.value})}/></td>
     <td><select aria-label={en?'Form':'Είδος'} value={row.form||''} onChange={e=>update(row.id,{form:e.target.value})}><option value="">{en?'Select…':'Επιλέξτε…'}</option>{ITEM_FORMS.map(([key,el,enLabel])=><option key={key} value={key}>{en?enLabel:el}</option>)}</select></td>
     <td><ManualDateField className="table-date-field" value={row.expiry||''} onChange={value=>update(row.id,{expiry:value})}/></td>
     <td><ExpiryBadge row={row} window={window} language={language}/></td>
     <td><input aria-label={en?'Note':'Παρατήρηση'} value={row.note||''} onChange={e=>update(row.id,{note:e.target.value})}/></td>
     <td><MultiSelect label={en?'Departments':'Τμήματα'} options={departmentOptions} selected={row.departments||[]} onChange={next=>update(row.id,{departments:next})} placeholder={en?'All departments':'Όλα τα τμήματα'} searchPlaceholder={en?'Search department…':'Αναζήτηση τμήματος…'} emptyLabel={en?'No department matches':'Κανένα τμήμα δεν ταιριάζει'} selectAllLabel={en?'Select all':'Επιλογή όλων'} clearAllLabel={en?'Clear all':'Αποεπιλογή όλων'} countLabel={n=>en?`${n} departments`:`${n} τμήματα`}/></td>
     <td><button type="button" className="control-row-delete" title={en?'Remove row':'Αφαίρεση γραμμής'} aria-label={en?'Remove row':'Αφαίρεση γραμμής'} onClick={()=>setRows(current=>current.length===1?[fresh()]:current.filter(x=>x.id!==row.id))}><Trash2 size={14}/></button></td>
    </tr>)}</tbody>
   </table>
  </div>
 </ObserverDialog>
}
