import { useMemo,useState } from 'react'
import { ListChecks,Package,PackageX,Plus,Trash2,Undo2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { IconButton } from '../../design-system/IconButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { RegistryTable } from '../../design-system/RegistryTable'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { SectionHeader } from '../../design-system/SectionHeader'
import { SignalBadge } from '../../design-system/StatusBadge'
import { libraryOptions } from '../management/useLibraries'
import { ITEM_FORMS,expiryState,expiryWindow,formKey,formLabel } from './controlExpiry'
import { EXPIRY_FINDINGS,expiryFindingCode,expiryFindingLabel } from './controlVocabulary'

// Options for the item name: the medicines & supplies library, plus what this
// department recorded before (suggested first).
export function useItemOptions(libraries,history=[],language='el'){
 return useMemo(()=>{
  const base=libraryOptions(libraries?.medicinesSupplies||[],language)
  const known=new Set(base.map(x=>x.value))
  const used=[...new Set(history.flatMap(h=>(h.structuredData?.rows||[]).map(r=>String(r.item||'').trim())).filter(Boolean))]
  return {options:[...base,...used.filter(v=>!known.has(v)).map(v=>({value:v,label:v}))],recent:used}
 },[libraries,history,language])
}
// Item forms: the itemForms library (stored as keys: tablet, vial, …).
export function formOptions(libraries,language='el'){
 const items=libraries?.itemForms||[]
 return items.length
  ?items.map(item=>({value:formKey(item.code||item.value),label:language==='en'?item.en:item.el}))
  :ITEM_FORMS.map(([key,el,en])=>({value:key,label:language==='en'?en:el}))
}

// The items of an expiry check: one item (a form) or a list (a table).
// Each row shows how far it is from its expiry date as soon as the date is set.
export function ControlExpiryEntry({record,rows,setRow,addRow,removeRow,keepFirstRow,libraries,history,language}){
 const en=language==='en'
 const window=expiryWindow(record)
 const listed=rows.some(row=>row.fromCatalogue)
 const [mode,setMode]=useState(listed||rows.length>1?'list':'single')
 const items=useItemOptions(libraries,history,language)
 const forms=formOptions(libraries,language)
 const findingOptions=EXPIRY_FINDINGS.map(code=>({value:code,label:expiryFindingLabel(code,language)}))
 const select={emptyLabel:en?'No match':'Καμία αντιστοιχία',customLabel:text=>en?`Use «${text}»`:`Χρήση «${text}»`}
 function changeMode(next){if(next==='single'&&rows.length>1)keepFirstRow();setMode(next)}
 const itemField=(row,index,hideLabel)=><SearchableSelect hideLabel={hideLabel} label={en?'Item / Medicine *':'Υλικό / Φάρμακο *'} value={row.item||''} options={items.options} recentValues={items.recent} recentLabel={en?'Recorded before':'Έχουν καταγραφεί'} onChange={v=>setRow(index,'item',v)} allowCustom placeholder={en?'Search the list or type':'Αναζήτηση στη λίστα ή πληκτρολόγηση'} {...select}/>
 const formField=(row,index,hideLabel)=><SearchableSelect hideLabel={hideLabel} label={en?'Form':'Είδος'} value={formKey(row.form)} options={forms} onChange={v=>setRow(index,'form',v)} placeholder="—" {...select} clearLabel={en?'Clear':'Καθαρισμός'}/>
 const findingField=(row,index,hideLabel)=><div className="control-finding-cell"><SearchableSelect hideLabel={hideLabel} label={en?'Finding':'Εύρημα'} value={expiryFindingCode(row.finding)} options={findingOptions} onChange={v=>setRow(index,'finding',v)} placeholder={en?'No finding':'Χωρίς εύρημα'} {...select} clearLabel={en?'Clear':'Καθαρισμός'}/>{expiryFindingCode(row.finding)==='other'&&<input className="control-finding-other" aria-label={en?'Describe the finding':'Περιγραφή ευρήματος'} value={row.findingOther||''} onChange={e=>setRow(index,'findingOther',e.target.value)} placeholder={en?'Describe the finding':'Συμπληρώστε το εύρημα'}/>}</div>
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
   ?<div className="control-expiry-single">
     {itemField(rows[0]||{},0,false)}
     {formField(rows[0]||{},0,false)}
     <Field label={en?'Quantity':'Ποσότητα'}><input type="number" min="0" inputMode="numeric" value={rows[0]?.quantity||''} onChange={e=>setRow(0,'quantity',e.target.value)}/></Field>
     <Field label={en?'Lot':'Παρτίδα'}><input value={rows[0]?.lot||''} onChange={e=>setRow(0,'lot',e.target.value)}/></Field>
     <ManualDateField label={en?'Expiry date *':'Ημερομηνία λήξης *'} value={rows[0]?.expiry||''} onChange={v=>setRow(0,'expiry',v)}/>
     <div className="field"><span className="lo-field-label">{en?'Status':'Κατάσταση'}</span><div className="control-expiry-status-box"><ExpiryBadge row={rows[0]} window={window} language={language}/></div></div>
     {findingField(rows[0]||{},0,false)}
     <Field label={en?'Note':'Παρατήρηση'}><input value={rows[0]?.note||''} onChange={e=>setRow(0,'note',e.target.value)}/></Field>
    </div>
   :<RegistryTable className="control-exec-table control-expiry-table" wrapperClassName="control-exec-table-wrap" columns={[
     {key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο'},{key:'form',label:en?'Form':'Είδος'},{key:'quantity',label:en?'Qty':'Ποσ.'},{key:'lot',label:en?'Lot':'Παρτίδα'},{key:'expiry',label:en?'Expiry date':'Λήξη'},{key:'status',label:en?'Status':'Κατάσταση'},{key:'finding',label:en?'Finding':'Εύρημα'},{key:'note',label:en?'Note':'Παρατήρηση'},{key:'actions',label:'',ariaLabel:en?'Actions':'Ενέργειες',className:'control-exec-action-col'},
    ]} rows={rows} rowKey={(_,index)=>index} rowProps={row=>({className:row.removedAt?'is-removed':undefined})} renderRow={(row,index)=><>
     <td>{row.fromCatalogue?<strong className="control-catalogue-item">{row.item}</strong>:itemField(row,index,true)}</td>
     <td>{row.fromCatalogue?<span className="control-catalogue-form">{formLabel(row.form,language)||'—'}</span>:formField(row,index,true)}</td>
     <td><input type="number" min="0" inputMode="numeric" aria-label={en?'Quantity':'Ποσότητα'} value={row.quantity||''} onChange={e=>setRow(index,'quantity',e.target.value)}/></td>
     <td><input aria-label={en?'Lot':'Παρτίδα'} value={row.lot||''} onChange={e=>setRow(index,'lot',e.target.value)}/></td>
     <td><ManualDateField className="table-date-field" value={row.expiry||''} onChange={v=>setRow(index,'expiry',v)}/></td>
     <td><ExpiryBadge row={row} window={window} language={language}/></td>
     <td>{findingField(row,index,true)}</td>
     <td><input aria-label={en?'Note':'Παρατήρηση'} value={row.note||''} onChange={e=>setRow(index,'note',e.target.value)}/></td>
     <td className="control-exec-action-col">{row.fromCatalogue
      ?<IconButton size="sm" tone={row.removedAt?'primary':'neutral'} label={row.removedAt?(en?'Keep on the list':'Επαναφορά στη λίστα'):(en?'Removed from the list (used, withdrawn)':'Αφαίρεση από τη λίστα (χρησιμοποιήθηκε, αποσύρθηκε)')} onClick={()=>setRow(index,'removedAt',row.removedAt?'':new Date().toISOString())}>{row.removedAt?<Undo2 size={14}/>:<PackageX size={14}/>}</IconButton>
      :<IconButton size="sm" tone="danger" label={en?'Remove row':'Αφαίρεση γραμμής'} onClick={()=>removeRow(index)}><Trash2 size={14}/></IconButton>}</td>
    </>}/>}
 </section>
}

export function ExpiryBadge({row,window,language,now}){
 const en=language==='en'
 const {state,days}=expiryState(row?.expiry,window,now)
 if(state==='unknown')return <SignalBadge className="control-expiry-badge">—</SignalBadge>
 if(state==='expired')return <SignalBadge tone="danger" className="control-expiry-badge">{days===-1?(en?'Expired yesterday':'Έληξε χθες'):(en?`Expired ${-days} days ago`:`Έληξε πριν ${-days} ημ.`)}</SignalBadge>
 if(state==='expiring')return <SignalBadge tone="warning" className="control-expiry-badge">{days===0?(en?'Expires today':'Λήγει σήμερα'):(en?`Expires in ${days} days`:`Λήγει σε ${days} ημ.`)}</SignalBadge>
 return <SignalBadge tone="success" className="control-expiry-badge">{en?'In date':'Εντός'}</SignalBadge>
}
