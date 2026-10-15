import { useMemo,useState } from 'react'
import { PackageX } from 'lucide-react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ExpiryBadge } from './ControlExpiryEntry'
import { expiryCounts,expiryItems,expiryWindow,formLabel } from './controlExpiry'

const normalize=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()

// The medicines and supplies on the departments' lists, soonest expiry first,
// with a filter for those that expire soon or have expired. One control (its
// record tab) or every expiry control at once (the Controls page, with a
// «Control» column). «Removed / replaced» takes an item off the list.
// sources: [{record,departments}]
export function ControlExpiryPanel({sources,canRemove,onRemove,onOpenControl,showControl=false,query='',language,locale}){
 const en=language==='en'
 const [filter,setFilterValue]=useState('alerting')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const setFilter=value=>{setFilterValue(value);setPage(1)}
 const items=useMemo(()=>sources.flatMap(({record,departments})=>expiryItems(record,departments).map(item=>({...item,record,window:expiryWindow(record),key:`${record.id}|${item.key}`}))).sort((a,b)=>(a.days??Infinity)-(b.days??Infinity)),[sources])
 const needle=normalize(query)
 const searched=needle?items.filter(item=>normalize(`${item.row.item} ${item.department} ${item.record.title} ${item.row.lot||''}`).includes(needle)):items
 const counts=expiryCounts(searched)
 const shown=filter==='expiring'?searched.filter(item=>item.state==='expiring'):filter==='expired'?searched.filter(item=>item.state==='expired'):filter==='alerting'?searched.filter(item=>item.state==='expiring'||item.state==='expired'):searched
 const totalPages=Math.max(1,Math.ceil(shown.length/pageSize)),safePage=Math.min(page,totalPages)
 const paged=shown.slice((safePage-1)*pageSize,safePage*pageSize)
 const day=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:(value||'—')}
 const at=value=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const single=sources.length===1?expiryWindow(sources[0].record):null
 const empty=!sources.length
  ? {title:en?'No expiry checks yet':'Δεν υπάρχουν έλεγχοι λήξεων',text:en?'Create a control in the «Medicines / Supplies» category and add its list of items.':'Δημιουργήστε έλεγχο με κατηγορία «Φάρμακα / Υλικά» και προσθέστε τη λίστα υλικών του.'}
  : searched.length
   ? {title:en?'No items in this view':'Κανένα υλικό σε αυτή την προβολή',text:en?'Choose «All» to see every item on the list.':'Επιλέξτε «Όλα» για να δείτε όλα τα υλικά της λίστας.'}
   : {title:en?'No items yet':'Δεν υπάρχουν υλικά',text:en?'Items appear here once they are on a control’s list or recorded with an expiry date.':'Τα υλικά εμφανίζονται εδώ μόλις μπουν στη λίστα ενός ελέγχου ή καταγραφούν με ημερομηνία λήξης.'}
 const columns=[
  {key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο'},
  showControl&&{key:'control',label:en?'Control':'Έλεγχος'},
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
  title={en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'}
  subtitle={single?(en?`Alert ${single.before} days before and up to ${single.after} days after expiry`:`Ειδοποίηση ${single.before} ημέρες πριν και έως ${single.after} ημέρες μετά τη λήξη`):(en?`${sources.length} expiry checks`:`${sources.length} ${sources.length===1?'έλεγχος':'έλεγχοι'} λήξεων`)}
  actions={<ModeSwitch ariaLabel={en?'Show':'Προβολή'} value={filter} onChange={setFilter} options={[
   {value:'alerting',label:`${en?'Need attention':'Χρειάζονται ενέργεια'} (${counts.expired+counts.expiring})`},
   {value:'expiring',label:`${en?'Expiring':'Λήγουν'} (${counts.expiring})`},
   {value:'expired',label:`${en?'Expired':'Ληγμένα'} (${counts.expired})`},
   {value:'all',label:`${en?'All':'Όλα'} (${searched.length})`},
  ]}/>}
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
    <td><strong>{item.row.item}</strong><small>{[formLabel(item.row.form,language),item.row.note,item.row.finding==='Άλλο'||item.row.finding==='Other'?item.row.findingOther:item.row.finding].filter(Boolean).join(' · ')}</small></td>
    {showControl&&<td>{onOpenControl?<button type="button" className="control-expiry-control-link" onClick={()=>onOpenControl(item.record)}>{language==='el'?item.record.title:item.record.titleEn||item.record.title}</button>:item.record.title}</td>}
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
