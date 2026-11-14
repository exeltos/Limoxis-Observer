import './controlsScreens.css'
import { useEffect,useMemo,useRef,useState } from 'react'
import { ExportMenu, type ExportItem } from '../../design-system/ExportMenu'
import { ChevronDown,ChevronRight,PackageX } from 'lucide-react'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { printReport } from '../../core/export/reportDocument'
import { exportRegistry } from '../../core/export/registryExports'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ExpiryBadge } from './ControlExpiryEntry'
import { compareExpiryItems,expiryCounts,expiryItems,expiryWindow,formLabel } from './controlExpiry'
import { expiryReturnFormHtml,printHtml } from './controlExpiryPrint'
import { rowFindingText } from './controlVocabulary'
import type { Dispatch, SetStateAction } from 'react'
import type { ControlExecution, ControlRecord } from './controlTypes'
import type { ExpiryItem } from './controlExpiry'

// An item of the expiry list with its control and window (ControlExpiryPanel).
export type PanelItem = ExpiryItem & { record: ControlRecord, window: { before: number, after: number } }
type Item = PanelItem
// A group's head: expired, expiring soon, in date, or the findings of one check.
type GroupHead = { kind: string, execution?: ControlExecution | null, department?: string }
type ItemGroup = { key: string, head: GroupHead, items: Item[] }
// An item as the lines of the table join it: its control, department, state and row.
type EntryItem = Pick<PanelItem, 'key' | 'department' | 'state' | 'row'> & { record: Pick<ControlRecord, 'id'> }
type ItemEntry<T extends EntryItem = Item> = { key: string, item: T, members: T[] }
// A line of the table: an item with its departments, in its group.
type TableEntry = ItemEntry & { departments: string[], group: string }
// A row of the table: a group's title, an item (alone, or with its departments under it) or one of its departments.
type TableRow = { kind: 'head', key: string, group: ItemGroup, open: boolean, count: number } | { kind: 'single', key: string, entry: TableEntry } | { kind: 'group', key: string, entry: TableEntry } | { kind: 'member', key: string, member: Item }
// The prints and the sheet the page's «Export» menu calls.
type PrintActions = { list: (pdf?: boolean) => void, returnForm: (pdf?: boolean) => void, excel: () => void }
// The items the panel reports to the page's «Export» menu.
export type ExpiryExport = ExportItem[]

const normalize=(value:unknown)=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
const day=(value:unknown):string=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:((value||'—') as string)}
const controlTitle=(record:Pick<ControlRecord,'title'|'titleEn'>,language:string)=>language==='el'?record.title:record.titleEn||record.title

// The items in groups: expired, expiring soon, the findings check by check,
// and the items in date (closed until opened).
export function expiryGroups(items:Item[]){
 const out=new Map<string,ItemGroup>()
 const put=(key:string,head:GroupHead,item:Item)=>{if(!out.has(key))out.set(key,{key,head,items:[]});out.get(key)!.items.push(item)}
 for(const item of items){
  if(item.state==='finding')put(`finding|${item.department}|${item.execution?.id||''}`,{kind:'finding',execution:item.execution,department:item.department},item)
  else if(item.state==='expired')put('expired',{kind:'expired'},item)
  else if(item.state==='expiring')put('expiring',{kind:'expiring'},item)
  else put('ok',{kind:'ok'},item)
 }
 const order:Record<string,number>={expired:0,expiring:1,ok:3}
 return [...out.values()].sort((a,b)=>(order[a.head.kind]??2)-(order[b.head.kind]??2))
}

const statusText=(item:Item,language:string)=>{
 const en=language==='en'
 if(item.state==='finding')return rowFindingText(item.row,language)||(en?'Finding':'Εύρημα')
 if(item.state==='expired')return en?`Expired ${-item.days!} days ago`:`Έληξε πριν ${-item.days!} ημ.`
 if(item.state==='expiring')return en?`Expires in ${item.days} days`:`Λήγει σε ${item.days} ημ.`
 return en?'In date':'Εντός'
}

// One line per item, lot and expiry date (owner, 7/11/2026): the same lot in several departments is one line that
// opens to its departments, each with its own «Removed». Columns with titles sort the list; by default the expired
// first, then those expiring soon, the findings and those in date.
const STATE_ORDER={expired:0,expiring:1,finding:2,ok:3}
export function expiryEntries<T extends EntryItem>(items:T[]){
 const out=new Map<string,ItemEntry<T>>()
 for(const item of items){
  const key=[item.record.id,item.state,normalize(item.row.item),item.row.lot||'',item.row.expiry||'',item.state==='finding'?item.key:''].join('|')
  if(!out.has(key))out.set(key,{key,item,members:[]})
  out.get(key)!.members.push(item)
 }
 return [...out.values()].map(entry=>({...entry,departments:[...new Set(entry.members.map(member=>member.department))]}))
}
interface ExpiryTableProps { items:Item[], canRemove?:(record:ControlRecord,department:string)=>boolean, onRemove?:(item:Item)=>void, showControl:boolean, showDepartment:boolean, language:string, locale:string, picked:Set<string>, onPick:(key:string)=>void }
function ExpiryTable({items,canRemove,onRemove,showControl,showDepartment,language,locale,picked,onPick}:ExpiryTableProps){
 const en=language==='en'
 const [opened,setOpened]=useState(()=>new Set<string>())
 // The groups as before (owner, 7/11/2026): expired, expiring soon, the findings check by check (date · who ·
 // department) and those in date; a group opens and closes on its title.
 const [flipped,setFlipped]=useState(()=>new Set<string>())
 const toggleIn=(setter:Dispatch<SetStateAction<Set<string>>>)=>(key:string)=>setter(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})
 const toggle=toggleIn(setOpened),flip=toggleIn(setFlipped)
 const at=(value:string|null|undefined)=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const groups=useMemo(()=>expiryGroups(items),[items])
 const entries=useMemo(()=>groups.flatMap(group=>expiryEntries(group.items).map(entry=>({...entry,group:group.key}))),[groups])
 const {sorted,sort,onSort}=useTableSort(entries,{
  item:entry=>entry.item.row.item,
  departments:entry=>entry.departments.length===1?entry.departments[0]:entry.departments.length,
  expiry:entry=>entry.item.row.expiry||null,
  state:entry=>((STATE_ORDER as Record<string,number>)[entry.item.state]??4)*100000+(entry.item.days??0),
 })
 const title=(head:GroupHead)=>head.kind==='expired'?(en?'Expired':'Έχουν λήξει'):head.kind==='expiring'?(en?'Expire soon':'Λήγουν σύντομα'):head.kind==='ok'?(en?'In date':'Εντός ημερομηνίας'):`${en?'Check of':'Έλεγχος'} ${at(head.execution?.at)}${head.execution?.by?` · ${head.execution.by}`:''}${showDepartment?` · ${head.department}`:''}`
 const details=(item:Item,single:boolean)=>[showControl&&controlTitle(item.record,language),item.row.lot&&`${en?'Lot':'Παρτίδα'} ${item.row.lot}`,formLabel(item.row.form,language),single&&item.row.quantity&&`${en?'Qty':'Ποσ.'} ${item.row.quantity}`,single&&item.row.note,item.state!=='finding'&&rowFindingText(item.row,language)].filter(Boolean).join(' · ')
 const status=(item:Item)=>item.state==='finding'?<span className="control-expiry-finding">{statusText(item,language)}</span>:<ExpiryBadge row={item.row} window={item.window} language={language}/>
 const action=(item:Item)=>item.execution&&item.state!=='finding'&&canRemove?.(item.record,item.department)?<Button variant="secondary" className="control-expiry-remove" title={en?'Removed / replaced: takes the item off the list':'Αφαιρέθηκε / αντικαταστάθηκε: βγαίνει από τη λίστα'} onClick={event=>{event.stopPropagation();onRemove!(item)}}><PackageX size={14} aria-hidden="true"/>{en?'Removed':'Αφαιρέθηκε'}</Button>:item.execution?<small>{at(item.execution.at)}</small>:<small className="control-expiry-from-list">{en?'From the list':'Από τη λίστα'}</small>
 const rows=groups.flatMap((group,index):TableRow[]=>{
  const closed=group.head.kind==='ok'||(group.head.kind==='finding'&&index>2)
  const open=closed?flipped.has(group.key):!flipped.has(group.key)
  const own=sorted.filter(entry=>entry.group===group.key)
  return [{kind:'head',key:`head|${group.key}`,group,open,count:group.items.length},...(open?own.flatMap((entry):TableRow[]=>entry.members.length===1?[{kind:'single',key:entry.key,entry}]:[{kind:'group',key:entry.key,entry},...(opened.has(entry.key)?entry.members.map(member=>({kind:'member' as const,key:`${entry.key}|${member.key}`,member})):[])]):[])]
 })
 return <RegistryTable sort={sort} onSort={onSort} className="control-expiry-table"
   columns={[{key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο',sortable:true},...(showDepartment?[{key:'departments',label:en?'Departments':'Τμήματα',sortable:true}]:[]),{key:'expiry',label:en?'Expiry':'Λήξη',sortable:true},{key:'state',label:en?'Status':'Κατάσταση',sortable:true},{key:'action',label:'',ariaLabel:en?'Removed':'Αφαιρέθηκε'}]}
   rows={rows} rowKey={row=>row.key}
   emptyTitle={en?'No items.':'Κανένα υλικό.'}
   renderRow={row=>{
    if(row.kind==='head')return <tr className={`control-expiry-head ${row.group.head.kind}`} onClick={()=>flip(row.group.key)} aria-expanded={row.open}><td colSpan={showDepartment?5:4}>{onPick&&<span className="control-expiry-head-pick" onClick={event=>event.stopPropagation()}><CheckboxField className="control-expiry-group-pick" label="" ariaLabel={en?`Print «${title(row.group.head)}»`:`Εκτύπωση «${title(row.group.head)}»`} checked={picked?.has(row.group.key)||false} onChange={()=>onPick(row.group.key)}/></span>}<strong>{row.open?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>}{title(row.group.head)}</strong><span className="control-expiry-head-count">{row.count}</span></td></tr>
    if(row.kind==='member')return <tr className="control-expiry-member"><td/><td>{row.member.department}{row.member.row.quantity&&<small>{en?'Qty':'Ποσ.'} {row.member.row.quantity}</small>}</td><td/><td/><td className="control-expiry-action">{action(row.member)}</td></tr>
    const {entry}=row,{item}=entry,single=row.kind==='single',open=opened.has(entry.key)
    return <tr className={`control-expiry-row ${item.state}${single?'':' is-group'}`} onClick={single?undefined:()=>toggle(entry.key)} aria-expanded={single?undefined:open}>
     <td><strong>{!single&&(open?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>)}{item.row.item}</strong><small>{details(item,single)}</small></td>
     {showDepartment&&<td>{single?item.department:<><strong>{en?`${entry.departments.length} departments`:`${entry.departments.length} τμήματα`}</strong><small>{entry.departments.join(', ')}</small></>}</td>}
     <td className="control-expiry-date">{day(item.row.expiry)}</td>
     <td>{status(item)}</td>
     <td className="control-expiry-action">{single?action(item):null}</td>
    </tr>
   }}/>
}

// The medicines and supplies on the departments' lists. Several departments:
// a card each, which opens that department's whole list in a dialog, grouped
// (expired, expiring soon, findings, in date) and printable. One department:
// its grouped list straight away. «Removed» takes an item off the list.
// sources: [{record,departments}]
interface ControlExpiryPanelProps { sources:{record:ControlRecord,departments:string[]}[], canRemove?:(record:ControlRecord,department:string)=>boolean, onRemove?:(item:Item)=>void, query?:string, stateFilter?:string|null, actorName?:string, language:string, locale:string, onExportChange?:((api:ExpiryExport|null)=>void)|null }
export function ControlExpiryPanel({sources,canRemove,onRemove,query='',stateFilter=null,actorName='',language,locale,onExportChange}:ControlExpiryPanelProps){
 const en=language==='en'
 const {notify}=useFeedback()
 const items=useMemo(():Item[]=>sources.flatMap(({record,departments})=>expiryItems(record,departments).map(item=>({...item,record,window:expiryWindow(record),key:`${record.id}|${item.key}`}))).sort(compareExpiryItems),[sources])
 const departmentOptions:string[]=[...new Set<string>(items.map(item=>item.department))].sort((a,b)=>a.localeCompare(b,'el'))
 const needle=normalize(query)
 const matched=needle?items.filter(item=>normalize(`${item.row.item} ${item.department} ${item.record.title} ${item.row.lot||''}`).includes(needle)):items
 // «11 expired» / «19 expiring» in the page's totals narrow the list to them.
 const searched=stateFilter?matched.filter(item=>item.state===stateFilter):matched
 const counts=expiryCounts(searched)
 const several=departmentOptions.length>1
 const manyControls=new Set(sources.map(source=>source.record.id)).size>1
 // The return form lists what has expired or expires soon (of the open department, or all).
 const returnOf=(list:Item[])=>list.filter(item=>item.state==='expired'||item.state==='expiring').sort((a,b)=>a.department.localeCompare(b.department,'el')||(a.days??0)-(b.days??0))
 // The groups ticked (owner, 7/11/2026): the return form and the list print only them; none ticked, everything.
 const [picked,setPicked]=useState(()=>new Set<string>())
 const pick=(key:string)=>setPicked(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})
 const pickedItems=useMemo(()=>{const keys=new Set(expiryGroups(searched).map(group=>group.key).filter(key=>picked.has(key)));return keys.size?expiryGroups(searched).filter(group=>keys.has(group.key)).flatMap(group=>group.items):null},[searched,picked])
 // A ticked check's findings go on the form too (its expired / short-dated items as recorded).
 const returnItems=pickedItems?pickedItems.filter(item=>item.state!=='ok').sort((a,b)=>a.department.localeCompare(b.department,'el')||(a.days??0)-(b.days??0)):returnOf(searched)
 const listItems=pickedItems||searched
 const formTitle=sources.length===1?sources[0].record.title:(en?'All expiry checks':'Όλοι οι έλεγχοι λήξεων')
 const printReturnForm=(list=returnItems,pdf=false)=>{if(!printHtml(expiryReturnFormHtml({title:formTitle,items:list,actorName}),{pdf}))notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')}
 // One «Export» per tab: the page's own menu (top bar or record header) offers the
 // return form; this panel only reports it, and draws its own menu when nobody takes it.
 // It reports two prints: the whole list (to sign) and the return form.
 const printRef=useRef<PrintActions>({} as PrintActions);printRef.current={list:(pdf=false)=>printList(several?'all':departmentOptions[0]||'all',listItems,'',pdf),returnForm:(pdf=false)=>printReturnForm(returnItems,pdf),excel:()=>exportList(searched)}
 // The same list as the print (department and search as chosen), as a sheet.
 function exportList(list:Item[]){
  exportRegistry({name:en?'expiry-list':'lixeis',headers:[en?'Item / Medicine':'Υλικό / Φάρμακο',en?'Department':'Τμήμα',en?'Control':'Έλεγχος',en?'Quantity':'Ποσότητα',en?'Lot':'Παρτίδα',en?'Expiry date':'Ημερομηνία λήξης',en?'Status':'Κατάσταση'],rows:list.map(item=>[item.row.item,item.department,controlTitle(item.record,language),item.row.quantity||'',item.row.lot||'',day(item.row.expiry),statusText(item,language)])})
 }
 const returnCount=returnItems.length,listCount=listItems.length,pickedCount=pickedItems?expiryGroups(searched).filter(group=>picked.has(group.key)).length:0
 useEffect(()=>{
  if(!onExportChange)return undefined
  const sel=pickedCount?(en?` · ${pickedCount} ${pickedCount===1?'group':'groups'}`:` · ${pickedCount} ${pickedCount===1?'ομάδα':'ομάδες'}`):''
  onExportChange([
   {id:'list',kind:'print',label:en?`Print: expiry list (${listCount}${sel})`:`Εκτύπωση: λίστα λήξεων (${listCount}${sel})`,disabled:!listCount,onClick:()=>printRef.current.list()},
   {id:'list-pdf',kind:'pdf',label:en?`PDF: expiry list (${listCount}${sel})`:`PDF: λίστα λήξεων (${listCount}${sel})`,disabled:!listCount,onClick:()=>printRef.current.list(true)},
   {id:'return',kind:'print',label:en?`Print: return & replacement form (${returnCount}${sel})`:`Εκτύπωση: έντυπο επιστροφής (${returnCount}${sel})`,disabled:!returnCount,onClick:()=>printRef.current.returnForm()},
   {id:'return-pdf',kind:'pdf',label:en?`PDF: return & replacement form (${returnCount}${sel})`:`PDF: έντυπο επιστροφής (${returnCount}${sel})`,disabled:!returnCount,onClick:()=>printRef.current.returnForm(true)},
   {id:'list-excel',kind:'excel',label:en?`Excel: expiry list (${listCount}${sel})`:`Excel: λίστα λήξεων (${listCount}${sel})`,disabled:!listCount,onClick:()=>printRef.current.excel()},
  ])
  return()=>onExportChange(null)
 },[onExportChange,returnCount,listCount,pickedCount,en])
 const placeName=(place:string)=>place==='all'?(en?'All departments':'Όλα τα τμήματα'):place
 const groupName=(head:GroupHead,place:string)=>head.kind==='expired'?(en?'Expired':'Έχουν λήξει'):head.kind==='expiring'?(en?'Expire soon':'Λήγουν σύντομα'):head.kind==='ok'?(en?'In date':'Εντός ημερομηνίας'):`${en?'Findings of the check of':'Ευρήματα ελέγχου'} ${day(String(head.execution?.at||'').slice(0,10))}${head.execution?.by?` · ${head.execution.by}`:''}${place==='all'?` · ${head.department}`:''}`
 // The list of a department (all its groups, or one) on the shared document layout, to sign.
 function printList(place:string,list:Item[],part='',pdf=false){
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
 const listProps={canRemove,onRemove,showControl:manyControls,language,locale,picked,onPick:pick}
 return <RecordTabPanel
  className="control-expiry-panel workspace-fill"
  title={null}
  subtitle={single?(en?`Alert ${single.before} days before and up to ${single.after} days after expiry`:`Ειδοποίηση ${single.before} ημέρες πριν και έως ${single.after} ημέρες μετά τη λήξη`):(en?`${sources.length} expiry checks`:`${sources.length} ${sources.length===1?'έλεγχος':'έλεγχοι'} λήξεων`)}
  actions={onExportChange?null:<div className="control-expiry-tools">{!onExportChange&&<span className="control-expiry-totals">{en?`${counts.expired} expired · ${counts.expiring} expiring`:`${counts.expired} ληγμένα · ${counts.expiring} λήγουν`}</span>}{!onExportChange&&<ExportMenu disabled={!searched.length} items={[{id:'list',kind:'print',label:en?`Expiry list (${searched.length})`:`Λίστα λήξεων (${searched.length})`,onClick:()=>printRef.current.list()},{id:'return',kind:'print',label:en?`Return & replacement form (${returnItems.length})`:`Έντυπο επιστροφής (${returnItems.length})`,disabled:!returnItems.length,onClick:()=>printReturnForm()}]}/>}</div>}
 >
  {!searched.length?<div className="inline-empty control-expiry-empty"><strong>{empty.title}</strong><span>{empty.text}</span></div>
  :<div className="control-expiry-inline"><ExpiryTable items={searched} showDepartment={several} {...listProps}/></div>}
 </RecordTabPanel>
}
