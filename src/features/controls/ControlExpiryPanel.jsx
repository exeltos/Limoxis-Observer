import { useEffect,useMemo,useRef,useState } from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ChevronDown,ChevronRight,PackageX } from 'lucide-react'
import { RegistryTable } from '../../design-system/RegistryTable'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTableSort } from '../../design-system/useTableSort'
import { Button } from '../../design-system/Button'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { printReport } from '../../core/export/reportDocument'
import { exportRegistry } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ExpiryBadge } from './ControlExpiryEntry'
import { compareExpiryItems,expiryCounts,expiryItems,expiryWindow,formLabel } from './controlExpiry'
import { expiryReturnFormHtml,printHtml } from './controlExpiryPrint'
import { rowFindingText } from './controlVocabulary'

const normalize=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const day=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:(value||'—')}
const controlTitle=(record,language)=>language==='el'?record.title:record.titleEn||record.title

// The items in groups: expired, expiring soon, the findings check by check,
// and the items in date (closed until opened).
export function expiryGroups(items){
 const out=new Map()
 const put=(key,head,item)=>{if(!out.has(key))out.set(key,{key,head,items:[]});out.get(key).items.push(item)}
 for(const item of items){
  if(item.state==='finding')put(`finding|${item.department}|${item.execution?.id||''}`,{kind:'finding',execution:item.execution,department:item.department},item)
  else if(item.state==='expired')put('expired',{kind:'expired'},item)
  else if(item.state==='expiring')put('expiring',{kind:'expiring'},item)
  else put('ok',{kind:'ok'},item)
 }
 const order={expired:0,expiring:1,ok:3}
 return [...out.values()].sort((a,b)=>(order[a.head.kind]??2)-(order[b.head.kind]??2))
}

const statusText=(item,language)=>{
 const en=language==='en'
 if(item.state==='finding')return rowFindingText(item.row,language)||(en?'Finding':'Εύρημα')
 if(item.state==='expired')return en?`Expired ${-item.days} days ago`:`Έληξε πριν ${-item.days} ημ.`
 if(item.state==='expiring')return en?`Expires in ${item.days} days`:`Λήγει σε ${item.days} ημ.`
 return en?'In date':'Εντός'
}

// One line per item, lot and expiry date (owner, 7/11/2026): the same lot in several departments is one line that
// opens to its departments, each with its own «Removed». Columns with titles sort the list; by default the expired
// first, then those expiring soon, the findings and those in date.
const STATE_ORDER={expired:0,expiring:1,finding:2,ok:3}
export function expiryEntries(items){
 const out=new Map()
 for(const item of items){
  const key=[item.record.id,item.state,normalize(item.row.item),item.row.lot||'',item.row.expiry||'',item.state==='finding'?item.key:''].join('|')
  if(!out.has(key))out.set(key,{key,item,members:[]})
  out.get(key).members.push(item)
 }
 return [...out.values()].map(entry=>({...entry,departments:[...new Set(entry.members.map(member=>member.department))]}))
}
function ExpiryTable({items,canRemove,onRemove,showControl,language,locale,onOpen}){
 const en=language==='en'
 const [opened,setOpened]=useState(()=>new Set())
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25)
 const toggle=key=>setOpened(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})
 const at=value=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const entries=useMemo(()=>expiryEntries(items),[items])
 const {sorted,sort,onSort}=useTableSort(entries,{
  item:entry=>entry.item.row.item,
  departments:entry=>entry.departments.length===1?entry.departments[0]:entry.departments.length,
  expiry:entry=>entry.item.row.expiry||null,
  state:entry=>(STATE_ORDER[entry.item.state]??4)*100000+(entry.item.days??0),
 })
 useEffect(()=>setPage(1),[sort,items])
 const totalPages=Math.max(1,Math.ceil(sorted.length/pageSize)),safePage=Math.min(page,totalPages)
 const shown=sorted.slice((safePage-1)*pageSize,safePage*pageSize)
 const details=(item,single)=>[showControl&&controlTitle(item.record,language),item.row.lot&&`${en?'Lot':'Παρτίδα'} ${item.row.lot}`,formLabel(item.row.form,language),single&&item.row.quantity&&`${en?'Qty':'Ποσ.'} ${item.row.quantity}`,single&&item.row.note,item.state!=='finding'&&rowFindingText(item.row,language)].filter(Boolean).join(' · ')
 const status=item=>item.state==='finding'?<span className="control-expiry-finding">{statusText(item,language)}</span>:<ExpiryBadge row={item.row} window={item.window} language={language}/>
 const action=item=>item.execution&&item.state!=='finding'&&canRemove?.(item.record,item.department)?<Button variant="secondary" className="control-expiry-remove" title={en?'Removed / replaced: takes the item off the list':'Αφαιρέθηκε / αντικαταστάθηκε: βγαίνει από τη λίστα'} onClick={event=>{event.stopPropagation();onRemove(item)}}><PackageX size={14} aria-hidden="true"/>{en?'Removed':'Αφαιρέθηκε'}</Button>:item.execution?<small>{at(item.execution.at)}</small>:<small className="control-expiry-from-list">{en?'From the list':'Από τη λίστα'}</small>
 const rows=shown.flatMap(entry=>entry.members.length===1?[{kind:'single',key:entry.key,entry}]:[{kind:'group',key:entry.key,entry},...(opened.has(entry.key)?entry.members.map(member=>({kind:'member',key:`${entry.key}|${member.key}`,member})):[])])
 return <>
  <RegistryTable sort={sort} onSort={onSort} className="control-expiry-table"
   columns={[{key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο',sortable:true},{key:'departments',label:en?'Departments':'Τμήματα',sortable:true},{key:'expiry',label:en?'Expiry':'Λήξη',sortable:true},{key:'state',label:en?'Status':'Κατάσταση',sortable:true},{key:'action',label:'',ariaLabel:en?'Removed':'Αφαιρέθηκε'}]}
   rows={rows} rowKey={row=>row.key}
   emptyTitle={en?'No items.':'Κανένα υλικό.'}
   renderRow={row=>{
    if(row.kind==='member')return <tr className={`control-expiry-member${onOpen?' is-link':''}`} onClick={onOpen?()=>onOpen(row.member.record):undefined}><td/><td>{row.member.department}{row.member.row.quantity&&<small>{en?'Qty':'Ποσ.'} {row.member.row.quantity}</small>}</td><td/><td/><td className="control-expiry-action">{action(row.member)}</td></tr>
    const {entry}=row,{item}=entry,single=row.kind==='single',open=opened.has(entry.key)
    return <tr className={`control-expiry-row ${item.state}${single?(onOpen?' is-link':''):' is-group'}`} onClick={single?(onOpen?()=>onOpen(item.record):undefined):()=>toggle(entry.key)} aria-expanded={single?undefined:open}>
     <td><strong>{!single&&(open?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>)}{item.row.item}</strong><small>{details(item,single)}</small></td>
     <td>{single?item.department:<><strong>{en?`${entry.departments.length} departments`:`${entry.departments.length} τμήματα`}</strong><small>{entry.departments.join(', ')}</small></>}</td>
     <td className="control-expiry-date">{day(item.row.expiry)}</td>
     <td>{status(item)}</td>
     <td className="control-expiry-action">{single?action(item):null}</td>
    </tr>
   }}/>
  {entries.length>pageSize&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={entries.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
 </>
}

// The medicines and supplies on the departments' lists. Several departments:
// a card each, which opens that department's whole list in a dialog, grouped
// (expired, expiring soon, findings, in date) and printable. One department:
// its grouped list straight away. «Removed» takes an item off the list.
// sources: [{record,departments}]
export function ControlExpiryPanel({sources,canRemove,onRemove,onOpenControl,query='',stateFilter=null,actorName='',language,locale,onExportChange}){
 const en=language==='en'
 const {notify}=useFeedback()
 const items=useMemo(()=>sources.flatMap(({record,departments})=>expiryItems(record,departments).map(item=>({...item,record,window:expiryWindow(record),key:`${record.id}|${item.key}`}))).sort(compareExpiryItems),[sources])
 const departmentOptions=[...new Set(items.map(item=>item.department))].sort((a,b)=>a.localeCompare(b,'el'))
 const needle=normalize(query)
 const matched=needle?items.filter(item=>normalize(`${item.row.item} ${item.department} ${item.record.title} ${item.row.lot||''}`).includes(needle)):items
 // «11 expired» / «19 expiring» in the page's totals narrow the list to them.
 const searched=stateFilter?matched.filter(item=>item.state===stateFilter):matched
 const counts=expiryCounts(searched)
 const several=departmentOptions.length>1
 const manyControls=new Set(sources.map(source=>source.record.id)).size>1
 // The return form lists what has expired or expires soon (of the open department, or all).
 const returnOf=list=>list.filter(item=>item.state==='expired'||item.state==='expiring').sort((a,b)=>a.department.localeCompare(b.department,'el')||(a.days??0)-(b.days??0))
 const returnItems=returnOf(searched)
 const formTitle=sources.length===1?sources[0].record.title:(en?'All expiry checks':'Όλοι οι έλεγχοι λήξεων')
 const printReturnForm=(list=returnItems,pdf=false)=>{if(!printHtml(expiryReturnFormHtml({title:formTitle,items:list,actorName}),{pdf}))notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')}
 // One «Export» per tab: the page's own menu (top bar or record header) offers the
 // return form; this panel only reports it, and draws its own menu when nobody takes it.
 // It reports two prints: the whole list (to sign) and the return form.
 const printRef=useRef(null);printRef.current={list:(pdf=false)=>printList(several?'all':departmentOptions[0]||'all',searched,'',pdf),returnForm:(pdf=false)=>printReturnForm(returnItems,pdf),excel:()=>exportList(searched)}
 // The same list as the print (department and search as chosen), as a sheet.
 function exportList(list){
  exportRegistry({name:en?'expiry-list':'lixeis',headers:[en?'Item / Medicine':'Υλικό / Φάρμακο',en?'Department':'Τμήμα',en?'Control':'Έλεγχος',en?'Quantity':'Ποσότητα',en?'Lot':'Παρτίδα',en?'Expiry date':'Ημερομηνία λήξης',en?'Status':'Κατάσταση'],rows:list.map(item=>[item.row.item,item.department,controlTitle(item.record,language),item.row.quantity||'',item.row.lot||'',day(item.row.expiry),statusText(item,language)])})
 }
 const returnCount=returnItems.length,listCount=searched.length
 useEffect(()=>{
  if(!onExportChange)return undefined
  onExportChange([
   {id:'list',kind:'print',label:en?`Print: expiry list (${listCount})`:`Εκτύπωση: λίστα λήξεων (${listCount})`,disabled:!listCount,onClick:()=>printRef.current.list()},
   {id:'list-pdf',kind:'pdf',label:en?`PDF: expiry list (${listCount})`:`PDF: λίστα λήξεων (${listCount})`,disabled:!listCount,onClick:()=>printRef.current.list(true)},
   {id:'return',kind:'print',label:en?`Print: return & replacement form (${returnCount})`:`Εκτύπωση: έντυπο επιστροφής (${returnCount})`,disabled:!returnCount,onClick:()=>printRef.current.returnForm()},
   {id:'return-pdf',kind:'pdf',label:en?`PDF: return & replacement form (${returnCount})`:`PDF: έντυπο επιστροφής (${returnCount})`,disabled:!returnCount,onClick:()=>printRef.current.returnForm(true)},
   {id:'list-excel',kind:'excel',label:en?`Excel: expiry list (${listCount})`:`Excel: λίστα λήξεων (${listCount})`,disabled:!listCount,onClick:()=>printRef.current.excel()},
  ])
  return()=>onExportChange(null)
 },[onExportChange,returnCount,listCount,en])
 const placeName=place=>place==='all'?(en?'All departments':'Όλα τα τμήματα'):place
 const groupName=(head,place)=>head.kind==='expired'?(en?'Expired':'Έχουν λήξει'):head.kind==='expiring'?(en?'Expire soon':'Λήγουν σύντομα'):head.kind==='ok'?(en?'In date':'Εντός ημερομηνίας'):`${en?'Findings of the check of':'Ευρήματα ελέγχου'} ${day(String(head.execution?.at||'').slice(0,10))}${head.execution?.by?` · ${head.execution.by}`:''}${place==='all'?` · ${head.department}`:''}`
 // The list of a department (all its groups, or one) on the shared document layout, to sign.
 function printList(place,list,part='',pdf=false){
  const columns=[en?'Item / Medicine':'Υλικό / Φάρμακο',...(place==='all'?[en?'Department':'Τμήμα']:[]),...(manyControls?[en?'Control':'Έλεγχος']:[]),en?'Quantity':'Ποσότητα',en?'Lot':'Παρτίδα',en?'Expiry date':'Ημερομηνία λήξης',en?'Status':'Κατάσταση']
  const c=expiryCounts(list)
  const ok=printReport({
   language,kind:en?'Controls':'Έλεγχοι',
   title:`${en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'} · ${placeName(place)}${part?` · ${part}`:''}`,
   meta:[[en?'Department':'Τμήμα',placeName(place)],[en?'Expired':'Ληγμένα',String(c.expired)],[en?'Expiring':'Λήγουν',String(c.expiring)],[en?'Items':'Υλικά',String(list.length)]],
   sections:expiryGroups(list).map(group=>({title:`${groupName(group.head,place)} (${group.items.length})`,table:{columns,rows:group.items.map(item=>[item.row.item,...(place==='all'?[item.department]:[]),...(manyControls?[controlTitle(item.record,language)]:[]),item.row.quantity||'—',item.row.lot||'—',day(item.row.expiry),statusText(item,language)])}})),
   signatures:[en?'Checked by':'Ελέγχθηκε από',en?'Head of department':'Προϊστάμενος/η τμήματος'],
   filename:en?'expiry-list':'lixeis',
  },{pdf:pdf===true})
  if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 }
 const empty=!sources.length
  ? {title:en?'No expiry checks yet':'Δεν υπάρχουν έλεγχοι λήξεων',text:en?'Create a control in the «Medicines / Supplies» category and add its list of items.':'Δημιουργήστε έλεγχο με κατηγορία «Φάρμακα / Υλικά» και προσθέστε τη λίστα υλικών του.'}
  : {title:en?'No items yet':'Δεν υπάρχουν υλικά',text:en?'Items appear here once they are on a control’s list or recorded with an expiry date.':'Τα υλικά εμφανίζονται εδώ μόλις μπουν στη λίστα ενός ελέγχου ή καταγραφούν με ημερομηνία λήξης.'}
 const single=sources.length===1?expiryWindow(sources[0].record):null
 const listProps={canRemove,onRemove,showControl:manyControls,language,locale,onOpen:onOpenControl}
 return <RecordTabPanel
  className="control-expiry-panel workspace-fill"
  title={null}
  subtitle={single?(en?`Alert ${single.before} days before and up to ${single.after} days after expiry`:`Ειδοποίηση ${single.before} ημέρες πριν και έως ${single.after} ημέρες μετά τη λήξη`):(en?`${sources.length} expiry checks`:`${sources.length} ${sources.length===1?'έλεγχος':'έλεγχοι'} λήξεων`)}
  actions={onExportChange?null:<div className="control-expiry-tools">{!onExportChange&&<span className="control-expiry-totals">{en?`${counts.expired} expired · ${counts.expiring} expiring`:`${counts.expired} ληγμένα · ${counts.expiring} λήγουν`}</span>}{!onExportChange&&<ExportMenu disabled={!searched.length} items={[{id:'list',kind:'print',label:en?`Expiry list (${searched.length})`:`Λίστα λήξεων (${searched.length})`,onClick:()=>printRef.current.list()},{id:'return',kind:'print',label:en?`Return & replacement form (${returnItems.length})`:`Έντυπο επιστροφής (${returnItems.length})`,disabled:!returnItems.length,onClick:()=>printReturnForm()}]}/>}</div>}
 >
  {!searched.length?<div className="inline-empty control-expiry-empty"><strong>{empty.title}</strong><span>{empty.text}</span></div>
  :<div className="control-expiry-inline"><ExpiryTable items={searched} {...listProps}/></div>}
 </RecordTabPanel>
}
