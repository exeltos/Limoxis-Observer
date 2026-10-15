import { useState } from 'react'
import { ListChecks,Package,Plus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { SectionHeader } from '../../design-system/SectionHeader'
import { expiryState,expiryWindow } from './controlExpiry'

// The items of an expiry check: one item (a form row) or a list (a table).
// Each row shows how far it is from its expiry date as soon as the date is set.
export function ControlExpiryEntry({record,rows,setRow,addRow,removeRow,keepFirstRow,language}){
 const en=language==='en'
 const window=expiryWindow(record)
 const listed=rows.some(row=>row.fromCatalogue)
 const [mode,setMode]=useState(listed||rows.length>1?'list':'single')
 function changeMode(next){
  if(next==='single'&&rows.length>1)keepFirstRow()
  setMode(next)
 }
 const findingSelect=(row,index)=><div className="control-finding-cell"><select aria-label={en?'Finding':'Εύρημα'} value={row.finding||''} onChange={e=>setRow(index,'finding',e.target.value)}><option value="">{en?'No finding':'Χωρίς εύρημα'}</option><option>{en?'Expired':'Ληγμένο'}</option><option>{en?'Near expiry':'Κοντόληκτο'}</option><option>{en?'Other':'Άλλο'}</option></select>{['Άλλο','Other'].includes(row.finding)&&<input className="control-finding-other" value={row.findingOther||''} onChange={e=>setRow(index,'findingOther',e.target.value)} placeholder={en?'Describe the finding':'Συμπληρώστε το εύρημα'}/>}</div>
 return <section className="control-expiry-entry">
  <SectionHeader
   title={en?'Medicines and supplies':'Φάρμακα και υλικά'}
   subtitle={en?`Alerts start ${window.before} days before expiry and continue for ${window.after} days after it.`:`Η ειδοποίηση ξεκινά ${window.before} ημέρες πριν τη λήξη και συνεχίζει ${window.after} ημέρες μετά.`}
   actions={<>
    {!listed&&<ModeSwitch ariaLabel={en?'Entry type':'Τρόπος καταχώρησης'} value={mode} onChange={changeMode} options={[{value:'single',label:en?'Single item':'Μεμονωμένο υλικό',icon:Package},{value:'list',label:en?'List':'Λίστα',icon:ListChecks}]}/>}
    {mode==='list'&&<Button variant="secondary" onClick={addRow}><Plus size={15}/>{listed?(en?' Item not on the list':' Έκτακτο υλικό'):(en?' Add item':' Προσθήκη υλικού')}</Button>}
   </>}
  />
  {mode==='single'
   ? <div className="entry-grid control-expiry-single">
      <label><span>{en?'Item / Medicine *':'Υλικό / Φάρμακο *'}</span><input autoFocus value={rows[0]?.item||''} onChange={e=>setRow(0,'item',e.target.value)} placeholder={en?'e.g. Adrenaline 1mg/ml':'π.χ. Adrenaline 1mg/ml'}/></label>
      <label><span>{en?'Quantity':'Ποσότητα'}</span><input type="number" min="0" value={rows[0]?.quantity||''} onChange={e=>setRow(0,'quantity',e.target.value)}/></label>
      <label><span>{en?'Lot':'Παρτίδα'}</span><input value={rows[0]?.lot||''} onChange={e=>setRow(0,'lot',e.target.value)}/></label>
      <ManualDateField label={en?'Expiry date *':'Ημερομηνία λήξης *'} value={rows[0]?.expiry||''} onChange={v=>setRow(0,'expiry',v)}/>
      <div className="field control-expiry-status-field"><span className="lo-field-label">{en?'Status':'Κατάσταση'}</span><div className="control-expiry-status-box"><ExpiryBadge row={rows[0]} window={window} language={language}/></div></div>
      <label className="control-expiry-finding"><span>{en?'Finding':'Εύρημα'}</span>{findingSelect(rows[0]||{},0)}</label>
     </div>
   : <div className="control-structured-table-wrap"><table className="control-structured-table control-expiry-table"><thead><tr><th>{en?'Item / Medicine':'Υλικό / Φάρμακο'}</th><th>{en?'Quantity':'Ποσότητα'}</th><th>{en?'Lot':'Παρτίδα'}</th><th>{en?'Expiry date':'Ημερομηνία λήξης'}</th><th>{en?'Status':'Κατάσταση'}</th><th>{en?'Finding':'Εύρημα'}</th><th aria-label={en?'Actions':'Ενέργειες'}/></tr></thead>
      <tbody>{rows.map((row,index)=><tr key={index}>
       <td>{row.fromCatalogue?<div className="control-catalogue-item"><strong>{row.item}</strong>{row.unit&&<small>{row.unit}</small>}</div>:<input value={row.item||''} onChange={e=>setRow(index,'item',e.target.value)} placeholder={en?'Item / Medicine':'Υλικό / Φάρμακο'}/>}</td>
       <td><input type="number" min="0" value={row.quantity||''} onChange={e=>setRow(index,'quantity',e.target.value)}/></td>
       <td><input value={row.lot||''} onChange={e=>setRow(index,'lot',e.target.value)}/></td>
       <td><ManualDateField className="table-date-field" value={row.expiry||''} onChange={v=>setRow(index,'expiry',v)}/></td>
       <td><ExpiryBadge row={row} window={window} language={language}/></td>
       <td>{findingSelect(row,index)}</td>
       <td>{!row.fromCatalogue&&<button type="button" className="control-row-delete" onClick={()=>removeRow(index)} title={en?'Remove row':'Αφαίρεση γραμμής'} aria-label={en?'Remove row':'Αφαίρεση γραμμής'}><Trash2 size={14}/></button>}</td>
      </tr>)}</tbody>
     </table></div>}
 </section>
}

export function ExpiryBadge({row,window,language,now}){
 const en=language==='en'
 const {state,days}=expiryState(row?.expiry,window,now)
 if(state==='unknown')return <span className="control-expiry-badge muted">—</span>
 if(state==='expired')return <span className="status-badge danger control-expiry-badge">{days===-1?(en?'Expired yesterday':'Έληξε χθες'):(en?`Expired ${-days} days ago`:`Έληξε πριν ${-days} ημ.`)}</span>
 if(state==='expiring')return <span className="status-badge warning control-expiry-badge">{days===0?(en?'Expires today':'Λήγει σήμερα'):(en?`Expires in ${days} days`:`Λήγει σε ${days} ημ.`)}</span>
 return <span className="status-badge active control-expiry-badge">{en?'In date':'Εντός ημερομηνίας'}</span>
}
