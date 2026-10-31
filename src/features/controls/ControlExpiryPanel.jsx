import { useEffect,useMemo,useRef,useState } from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { ChevronDown,ChevronRight,PackageX } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { CheckboxField } from '../../design-system/CheckboxField'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { printReport } from '../../core/export/reportDocument'
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

// One department's (or every department's) items, grouped; the dialog and a
// one-department tab show it.
// picked/onPick: a box on each group, to print the groups ticked.
function ExpiryGroupList({items,canRemove,onRemove,showControl,showDepartment,language,locale,picked=null,onPick}){
 const en=language==='en'
 const [opened,setOpened]=useState(()=>new Set())
 const toggle=key=>setOpened(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next})
 const at=value=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const groups=expiryGroups(items)
 const title=head=>head.kind==='expired'?(en?'Expired':'Έχουν λήξει'):head.kind==='expiring'?(en?'Expire soon':'Λήγουν σύντομα'):head.kind==='ok'?(en?'In date':'Εντός ημερομηνίας'):`${en?'Check of':'Έλεγχος'} ${at(head.execution?.at)}${head.execution?.by?` · ${head.execution.by}`:''}${showDepartment?` · ${head.department}`:''}`
 const details=item=>[showDepartment&&item.department,showControl&&controlTitle(item.record,language),item.row.quantity&&`${en?'Qty':'Ποσ.'} ${item.row.quantity}`,item.row.lot&&`${en?'Lot':'Παρτίδα'} ${item.row.lot}`,formLabel(item.row.form,language),item.row.note,item.state!=='finding'&&rowFindingText(item.row,language)].filter(Boolean).join(' · ')
 if(!groups.length)return <p className="control-expiry-card-clear">{en?'No items.':'Κανένα υλικό.'}</p>
 return <div className="control-expiry-groups-list">{groups.map((group,index)=>{
  const closed=group.head.kind==='ok'||(group.head.kind==='finding'&&index>2)
  const open=closed?opened.has(group.key):!opened.has(group.key)
  return <section key={group.key} className={`control-expiry-group ${group.head.kind}`}>
   <div className="control-expiry-group-bar">
    {picked&&<CheckboxField className="control-expiry-group-pick" label="" ariaLabel={en?`Print «${title(group.head)}»`:`Εκτύπωση «${title(group.head)}»`} checked={picked.has(group.key)} onChange={()=>onPick?.(group.key)}/>}
    <button type="button" className="control-expiry-group-head" aria-expanded={open} onClick={()=>toggle(group.key)}>{open?<ChevronDown size={15} aria-hidden="true"/>:<ChevronRight size={15} aria-hidden="true"/>}<strong>{title(group.head)}</strong><small>{group.items.length}</small></button>
   </div>
   {open&&<ul className="control-expiry-items">{group.items.map(item=><li key={item.key} className={`control-expiry-item ${item.state}`}>
    <span className="control-expiry-item-name"><strong>{item.row.item}</strong><small>{details(item)}</small></span>
    <span className="control-expiry-item-date">{day(item.row.expiry)}</span>
    <span>{item.state==='finding'?<span className="control-expiry-finding">{statusText(item,language)}</span>:<ExpiryBadge row={item.row} window={item.window} language={language}/>}</span>
    <span className="control-expiry-item-action">{item.execution&&item.state!=='finding'&&canRemove?.(item.record,item.department)?<Button variant="secondary" className="control-expiry-remove" title={en?'Removed / replaced: takes the item off the list':'Αφαιρέθηκε / αντικαταστάθηκε: βγαίνει από τη λίστα'} onClick={()=>onRemove(item)}><PackageX size={14} aria-hidden="true"/>{en?'Removed':'Αφαιρέθηκε'}</Button>:item.execution?<small>{at(item.execution.at)}</small>:<small className="control-expiry-from-list">{en?'From the list':'Από τη λίστα'}</small>}</span>
   </li>)}</ul>}
  </section>
 })}</div>
}

// The medicines and supplies on the departments' lists. Several departments:
// a card each, which opens that department's whole list in a dialog, grouped
// (expired, expiring soon, findings, in date) and printable. One department:
// its grouped list straight away. «Removed» takes an item off the list.
// sources: [{record,departments}]
export function ControlExpiryPanel({sources,canRemove,onRemove,showControl=false,query='',actorName='',language,locale,onExportChange}){
 const en=language==='en'
 const {notify}=useFeedback()
 const items=useMemo(()=>sources.flatMap(({record,departments})=>expiryItems(record,departments).map(item=>({...item,record,window:expiryWindow(record),key:`${record.id}|${item.key}`}))).sort(compareExpiryItems),[sources])
 const departmentOptions=[...new Set(items.map(item=>item.department))].sort((a,b)=>a.localeCompare(b,'el'))
 const needle=normalize(query)
 const searched=needle?items.filter(item=>normalize(`${item.row.item} ${item.department} ${item.record.title} ${item.row.lot||''}`).includes(needle)):items
 const counts=expiryCounts(searched)
 const several=departmentOptions.length>1
 const manyControls=new Set(sources.map(source=>source.record.id)).size>1
 // The return form lists what has expired or expires soon (of the open department, or all).
 const returnOf=list=>list.filter(item=>item.state==='expired'||item.state==='expiring').sort((a,b)=>a.department.localeCompare(b.department,'el')||(a.days??0)-(b.days??0))
 const returnItems=returnOf(searched)
 const formTitle=sources.length===1?sources[0].record.title:(en?'All expiry checks':'Όλοι οι έλεγχοι λήξεων')
 const printReturnForm=(list=returnItems)=>printHtml(expiryReturnFormHtml({title:formTitle,items:list,actorName}))
 // One «Export» per tab: the page's own menu (top bar or record header) offers the
 // return form; this panel only reports it, and draws its own menu when nobody takes it.
 // It reports two prints: the whole list (to sign) and the return form.
 const printRef=useRef(null);printRef.current={list:()=>printList(several?'all':departmentOptions[0]||'all',searched),returnForm:()=>printReturnForm()}
 const returnCount=returnItems.length,listCount=searched.length
 useEffect(()=>{
  if(!onExportChange)return undefined
  onExportChange([
   {id:'list',kind:'print',label:en?`Expiry list (${listCount})`:`Λίστα λήξεων (${listCount})`,disabled:!listCount,onClick:()=>printRef.current.list()},
   {id:'return',kind:'print',label:en?`Return & replacement form (${returnCount})`:`Έντυπο επιστροφής (${returnCount})`,disabled:!returnCount,onClick:()=>printRef.current.returnForm()},
  ])
  return()=>onExportChange(null)
 },[onExportChange,returnCount,listCount,en])
 const placeName=place=>place==='all'?(en?'All departments':'Όλα τα τμήματα'):place
 const groupName=(head,place)=>head.kind==='expired'?(en?'Expired':'Έχουν λήξει'):head.kind==='expiring'?(en?'Expire soon':'Λήγουν σύντομα'):head.kind==='ok'?(en?'In date':'Εντός ημερομηνίας'):`${en?'Findings of the check of':'Ευρήματα ελέγχου'} ${day(String(head.execution?.at||'').slice(0,10))}${head.execution?.by?` · ${head.execution.by}`:''}${place==='all'?` · ${head.department}`:''}`
 // The list of a department (all its groups, or one) on the shared document layout, to sign.
 function printList(place,list,part=''){
  const columns=[en?'Item / Medicine':'Υλικό / Φάρμακο',...(place==='all'?[en?'Department':'Τμήμα']:[]),...(manyControls?[en?'Control':'Έλεγχος']:[]),en?'Quantity':'Ποσότητα',en?'Lot':'Παρτίδα',en?'Expiry date':'Ημερομηνία λήξης',en?'Status':'Κατάσταση']
  const c=expiryCounts(list)
  const ok=printReport({
   language,kind:en?'Controls':'Έλεγχοι',
   title:`${en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'} · ${placeName(place)}${part?` · ${part}`:''}`,
   meta:[[en?'Department':'Τμήμα',placeName(place)],[en?'Expired':'Ληγμένα',String(c.expired)],[en?'Expiring':'Λήγουν',String(c.expiring)],[en?'Items':'Υλικά',String(list.length)]],
   sections:expiryGroups(list).map(group=>({title:`${groupName(group.head,place)} (${group.items.length})`,table:{columns,rows:group.items.map(item=>[item.row.item,...(place==='all'?[item.department]:[]),...(manyControls?[controlTitle(item.record,language)]:[]),item.row.quantity||'—',item.row.lot||'—',day(item.row.expiry),statusText(item,language)])}})),
   signatures:[en?'Checked by':'Ελέγχθηκε από',en?'Head of department':'Προϊστάμενος/η τμήματος'],
   filename:en?'expiry-list':'lixeis',
  })
  if(!ok)notify(en?'Allow pop-ups to print.':'Επιτρέψτε τα αναδυόμενα παράθυρα για την εκτύπωση.','error')
 }
 const empty=!sources.length
  ? {title:en?'No expiry checks yet':'Δεν υπάρχουν έλεγχοι λήξεων',text:en?'Create a control in the «Medicines / Supplies» category and add its list of items.':'Δημιουργήστε έλεγχο με κατηγορία «Φάρμακα / Υλικά» και προσθέστε τη λίστα υλικών του.'}
  : {title:en?'No items yet':'Δεν υπάρχουν υλικά',text:en?'Items appear here once they are on a control’s list or recorded with an expiry date.':'Τα υλικά εμφανίζονται εδώ μόλις μπουν στη λίστα ενός ελέγχου ή καταγραφούν με ημερομηνία λήξης.'}
 const single=sources.length===1?expiryWindow(sources[0].record):null
 const listProps={canRemove,onRemove,showControl:manyControls,language,locale}
 return <RecordTabPanel
  className="control-expiry-panel workspace-fill"
  title={showControl?(en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'):(en?'Items & expiry':'Υλικά & λήξεις')}
  subtitle={single?(en?`Alert ${single.before} days before and up to ${single.after} days after expiry`:`Ειδοποίηση ${single.before} ημέρες πριν και έως ${single.after} ημέρες μετά τη λήξη`):(en?`${sources.length} expiry checks`:`${sources.length} ${sources.length===1?'έλεγχος':'έλεγχοι'} λήξεων`)}
  actions={<div className="control-expiry-tools">{!onExportChange&&<span className="control-expiry-totals">{en?`${counts.expired} expired · ${counts.expiring} expiring`:`${counts.expired} ληγμένα · ${counts.expiring} λήγουν`}</span>}{!onExportChange&&<ExportMenu disabled={!searched.length} items={[{id:'list',kind:'print',label:en?`Expiry list (${searched.length})`:`Λίστα λήξεων (${searched.length})`,onClick:()=>printRef.current.list()},{id:'return',kind:'print',label:en?`Return & replacement form (${returnItems.length})`:`Έντυπο επιστροφής (${returnItems.length})`,disabled:!returnItems.length,onClick:()=>printReturnForm()}]}/>}</div>}
 >
  {!searched.length?<div className="inline-empty control-expiry-empty"><strong>{empty.title}</strong><span>{empty.text}</span></div>
  :<div className="control-expiry-inline"><ExpiryGroupList items={searched} showDepartment={several} {...listProps}/></div>}
 </RecordTabPanel>
}
