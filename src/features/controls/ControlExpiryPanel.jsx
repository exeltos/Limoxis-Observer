import { useEffect,useMemo,useRef,useState } from 'react'
import { ExportMenu } from '../../design-system/ExportMenu'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { PackageX } from 'lucide-react'

import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { FilterSelect } from '../../design-system/FilterBar'
import { ExpiryBadge } from './ControlExpiryEntry'
import { expiryCounts,expiryItems,expiryWindow,formLabel } from './controlExpiry'
import { expiryReturnFormHtml,printHtml } from './controlExpiryPrint'
import { rowFindingText } from './controlVocabulary'

const normalize=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()

// The medicines and supplies on the departments' lists, soonest expiry first,
// with a filter for those that expire soon or have expired. One control (its
// record tab) or every expiry control at once (the Controls page, with a
// «Control» column). «Removed / replaced» takes an item off the list.
// sources: [{record,departments}]
export function ControlExpiryPanel({sources,canRemove,onRemove,onOpenControl,showControl=false,query='',actorName='',language,locale,onExportChange}){
 const en=language==='en'
 const [filter,setFilterValue]=useState('alerting')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const setFilter=value=>{setFilterValue(value);setPage(1)}
 const items=useMemo(()=>sources.flatMap(({record,departments})=>expiryItems(record,departments).map(item=>({...item,record,window:expiryWindow(record),key:`${record.id}|${item.key}`}))).sort((a,b)=>(a.days??Infinity)-(b.days??Infinity)),[sources])
 const [department,setDepartmentValue]=useState('all')
 const departmentOptions=[...new Set(items.map(item=>item.department))].sort((a,b)=>a.localeCompare(b,'el'))
 const setDepartment=value=>{setDepartmentValue(value);setPage(1)}
 const needle=normalize(query)
 const scoped=department==='all'?items:items.filter(item=>item.department===department)
 const searched=needle?scoped.filter(item=>normalize(`${item.row.item} ${item.department} ${item.record.title} ${item.row.lot||''}`).includes(needle)):scoped
 const counts=expiryCounts(searched)
 const shown=filter==='expiring'?searched.filter(item=>item.state==='expiring'):filter==='expired'?searched.filter(item=>item.state==='expired'):filter==='alerting'?searched.filter(item=>item.state==='expiring'||item.state==='expired'):searched
 // The return form lists what has expired or expires soon in the current search.
 const returnItems=searched.filter(item=>item.state==='expired'||item.state==='expiring').sort((a,b)=>a.department.localeCompare(b.department,'el')||(a.days??0)-(b.days??0))
 const printReturnForm=()=>printHtml(expiryReturnFormHtml({title:sources.length===1?sources[0].record.title:(en?'All expiry checks':'Όλοι οι έλεγχοι λήξεων'),items:returnItems,actorName}))
 // One «Export» per tab: the page's own menu (top bar or record header) offers the
 // return form; this panel only reports it, and draws its own menu when nobody takes it.
 const printRef=useRef(printReturnForm);printRef.current=printReturnForm
 const returnCount=returnItems.length
 useEffect(()=>{
  if(!onExportChange)return undefined
  onExportChange({id:'return',kind:'print',label:en?`Return & replacement form (${returnCount})`:`Έντυπο επιστροφής (${returnCount})`,disabled:!returnCount,onClick:()=>printRef.current()})
  return()=>onExportChange(null)
 },[onExportChange,returnCount,en])
 const totalPages=Math.max(1,Math.ceil(shown.length/pageSize)),safePage=Math.min(page,totalPages)
 const paged=shown.slice((safePage-1)*pageSize,safePage*pageSize)
 const day=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:(value||'—')}
 const at=value=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const single=sources.length===1?expiryWindow(sources[0].record):null
 // The control column only tells the rows apart when more than one control is listed.
 const controlColumn=showControl&&new Set(sources.map(source=>source.record.id)).size>1
 const empty=!sources.length
  ? {title:en?'No expiry checks yet':'Δεν υπάρχουν έλεγχοι λήξεων',text:en?'Create a control in the «Medicines / Supplies» category and add its list of items.':'Δημιουργήστε έλεγχο με κατηγορία «Φάρμακα / Υλικά» και προσθέστε τη λίστα υλικών του.'}
  : searched.length
   ? {title:en?'No items in this view':'Κανένα υλικό σε αυτή την προβολή',text:en?'Choose «All» to see every item on the list.':'Επιλέξτε «Όλα» για να δείτε όλα τα υλικά της λίστας.'}
   : {title:en?'No items yet':'Δεν υπάρχουν υλικά',text:en?'Items appear here once they are on a control’s list or recorded with an expiry date.':'Τα υλικά εμφανίζονται εδώ μόλις μπουν στη λίστα ενός ελέγχου ή καταγραφούν με ημερομηνία λήξης.'}
 const columns=[
  {key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο'},
  controlColumn&&{key:'control',label:en?'Control':'Έλεγχος'},
  {key:'department',label:en?'Department':'Τμήμα'},
  {key:'quantity',label:en?'Quantity':'Ποσότητα'},
  {key:'lot',label:en?'Lot':'Παρτίδα'},
  {key:'expiry',label:en?'Expiry date':'Ημερομηνία λήξης'},
  {key:'status',label:en?'Status':'Κατάσταση'},
  {key:'recorded',label:en?'Recorded':'Καταγραφή'},
  {key:'actions',label:'',className:'control-history-menu-col'},
 ].filter(Boolean)
 return <RecordTabPanel
  className="control-expiry-panel workspace-fill"
  title={showControl?(en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'):(en?'Items & expiry':'Υλικά & λήξεις')}
  subtitle={single?(en?`Alert ${single.before} days before and up to ${single.after} days after expiry`:`Ειδοποίηση ${single.before} ημέρες πριν και έως ${single.after} ημέρες μετά τη λήξη`):(en?`${sources.length} expiry checks`:`${sources.length} ${sources.length===1?'έλεγχος':'έλεγχοι'} λήξεων`)}
  actions={<div className="control-expiry-tools"><SearchableSelect hideLabel className="control-expiry-filter" label={en?'Show':'Προβολή'} value={filter} onChange={next=>next&&(setFilter)(next)} options={[
   {value:'alerting',label:`${en?'Need attention':'Χρειάζονται ενέργεια'} (${counts.expired+counts.expiring})`},
   {value:'expiring',label:`${en?'Expiring':'Λήγουν'} (${counts.expiring})`},
   {value:'expired',label:`${en?'Expired':'Ληγμένα'} (${counts.expired})`},
   {value:'all',label:`${en?'All':'Όλα'} (${searched.length})`},
  ]}/>{!showControl&&departmentOptions.length>1&&<FilterSelect label={en?'Department':'Τμήμα'} value={department} onChange={setDepartment}><option value="all">{en?'All departments':'Όλα τα τμήματα'}</option>{departmentOptions.map(dep=><option key={dep} value={dep}>{dep}</option>)}</FilterSelect>}{!onExportChange&&<ExportMenu disabled={!returnItems.length} items={[{id:'return',kind:'print',label:en?`Return & replacement form (${returnItems.length})`:`Έντυπο επιστροφής (${returnItems.length})`,onClick:printReturnForm}]}/>}</div>}
  footer={shown.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
 >
  <RegistryTable
   className="control-expiry-registry"
   columns={columns}
   rows={paged}
   rowKey={item=>item.key}
   rowProps={item=>({className:`control-expiry-row ${item.state}`})}
   emptyTitle={empty.title}
   emptyText={empty.text}
   renderRow={item=><>
    <td><strong>{item.row.item}</strong><small>{[formLabel(item.row.form,language),item.row.note,rowFindingText(item.row,language)].filter(Boolean).join(' · ')}</small></td>
    {controlColumn&&<td className="control-expiry-control-cell">{onOpenControl?<button type="button" className="control-expiry-control-link" title={language==='el'?item.record.title:item.record.titleEn||item.record.title} onClick={()=>onOpenControl(item.record)}>{language==='el'?item.record.title:item.record.titleEn||item.record.title}</button>:item.record.title}</td>}
    <td>{item.department}</td>
    <td>{item.row.quantity||'—'}</td>
    <td>{item.row.lot||'—'}</td>
    <td><strong>{day(item.row.expiry)}</strong></td>
    <td><ExpiryBadge row={item.row} window={item.window} language={language}/></td>
    <td>{item.execution?<>{at(item.execution.at)}<small>{item.execution.by||''}</small></>:<span className="control-expiry-from-list">{en?'From the list':'Από τη λίστα'}</span>}</td>
    <td className="open-record-cell control-history-menu-col">{item.execution&&canRemove?.(item.record,item.department)&&<OverflowMenu label={en?'Item actions':'Ενέργειες υλικού'} align="end" items={[{id:'remove',label:en?'Removed / replaced':'Αφαιρέθηκε / Αντικαταστάθηκε',icon:PackageX,onClick:()=>onRemove(item)}]}/>}</td>
   </>}
  />
 </RecordTabPanel>
}
