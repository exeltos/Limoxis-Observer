import { useMemo,useState } from 'react'
import { PackageX } from 'lucide-react'
import { ModeSwitch } from '../../design-system/ModeSwitch'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { ExpiryBadge } from './ControlExpiryEntry'
import { expiryCounts,expiryItems,expiryWindow } from './controlExpiry'

// The medicines and supplies still on the departments' lists, soonest expiry
// first, with a filter for those that expire soon or have expired. «Removed /
// replaced» takes an item off the list and stops its alert.
export function ControlExpiryPanel({record,departments,canRemove,onRemove,language,locale}){
 const en=language==='en'
 const [filter,setFilterValue]=useState('alerting')
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
 const setFilter=value=>{setFilterValue(value);setPage(1)}
 const window=expiryWindow(record)
 const items=useMemo(()=>expiryItems(record,departments),[record,departments])
 const counts=expiryCounts(items)
 const shown=filter==='expiring'?items.filter(item=>item.state==='expiring'):filter==='expired'?items.filter(item=>item.state==='expired'):filter==='alerting'?items.filter(item=>item.state==='expiring'||item.state==='expired'):items
 const totalPages=Math.max(1,Math.ceil(shown.length/pageSize)),safePage=Math.min(page,totalPages)
 const paged=shown.slice((safePage-1)*pageSize,safePage*pageSize)
 const day=value=>{const [y,m,d]=String(value||'').slice(0,10).split('-');return y&&m&&d?`${d}/${m}/${y}`:(value||'—')}
 const at=value=>value?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'—'
 const empty=items.length
  ? {title:en?'No items in this view':'Κανένα υλικό σε αυτή την προβολή',text:en?'Choose «All» to see every item on the list.':'Επιλέξτε «Όλα» για να δείτε όλα τα υλικά της λίστας.'}
  : {title:en?'No items recorded yet':'Δεν έχουν καταχωρηθεί υλικά',text:en?'Items appear here once an entry lists them with an expiry date.':'Τα υλικά εμφανίζονται εδώ μόλις καταχωρηθούν με ημερομηνία λήξης.'}
 return <RecordTabPanel
  className="control-expiry-panel workspace-fill"
  title={en?'Medicine and supply expiry':'Λήξεις φαρμάκων και υλικών'}
  subtitle={en?`Alert ${window.before} days before and up to ${window.after} days after expiry`:`Ειδοποίηση ${window.before} ημέρες πριν και έως ${window.after} ημέρες μετά τη λήξη`}
  actions={<ModeSwitch ariaLabel={en?'Show':'Προβολή'} value={filter} onChange={setFilter} options={[
   {value:'alerting',label:`${en?'Need attention':'Χρειάζονται ενέργεια'} (${counts.expired+counts.expiring})`},
   {value:'expiring',label:`${en?'Expiring':'Λήγουν'} (${counts.expiring})`},
   {value:'expired',label:`${en?'Expired':'Ληγμένα'} (${counts.expired})`},
   {value:'all',label:`${en?'All':'Όλα'} (${items.length})`},
  ]}/>}
  footer={shown.length>0&&<RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/>}
 >
  <RegistryTable
   className="control-expiry-registry"
   columns={[{key:'item',label:en?'Item / Medicine':'Υλικό / Φάρμακο'},{key:'department',label:en?'Department':'Τμήμα'},{key:'quantity',label:en?'Quantity':'Ποσότητα'},{key:'lot',label:en?'Lot':'Παρτίδα'},{key:'expiry',label:en?'Expiry date':'Ημερομηνία λήξης'},{key:'status',label:en?'Status':'Κατάσταση'},{key:'recorded',label:en?'Recorded':'Καταχώρηση'},{key:'actions',label:'',className:'control-history-menu-col'}]}
   rows={paged}
   rowKey={item=>item.key}
   rowProps={item=>({className:`control-expiry-row ${item.state}`})}
   emptyTitle={empty.title}
   emptyText={empty.text}
   renderRow={item=><>
    <td><strong>{item.row.item}</strong>{item.row.finding&&<small>{item.row.finding==='Άλλο'||item.row.finding==='Other'?item.row.findingOther||item.row.finding:item.row.finding}</small>}</td>
    <td>{item.department}</td>
    <td>{item.row.quantity||'—'}</td>
    <td>{item.row.lot||'—'}</td>
    <td><strong>{day(item.row.expiry)}</strong></td>
    <td><ExpiryBadge row={item.row} window={window} language={language}/></td>
    <td>{at(item.execution.at)}<small>{item.execution.by||''}</small></td>
    <td className="open-record-cell control-history-menu-col">{canRemove(item.department)&&<OverflowMenu label={en?'Item actions':'Ενέργειες υλικού'} align="end" items={[{id:'remove',label:en?'Removed / replaced':'Αφαιρέθηκε / Αντικαταστάθηκε',icon:PackageX,onClick:()=>onRemove(item)}]}/>}</td>
   </>}
  />
 </RecordTabPanel>
}
