import { useEffect,useState } from 'react'
import { RotateCcw,Trash2 } from 'lucide-react'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { BIN_DAYS,daysLeft,purgeExpiredBin,purgeFromBin,restoreFromBin } from '../../core/recycleBin/recycleBinService'
import { useRecycleBin } from './useRecycleBin'
import { RecycleBinIcon } from './RecycleBinIcon'
import './recycleBin.css'

const MODULES={clinical:['Κλινικά','Clinical'],quality:['Ποιότητα','Quality'],occupational:['Ιατρική εργασίας','Occupational health'],administration:['Διοίκηση','Administration']}

function fmtDateTime(value){
  const date=new Date(value)
  if(Number.isNaN(date.getTime()))return '—'
  const pad=n=>String(n).padStart(2,'0')
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// What was deleted in the last 30 days: each record can be put back as it was, or deleted for good.
export function RecycleBinPage(){
  const {tenant,role}=useTenant()
  const {language}=useLanguage()
  const {notify,notifyError,confirm}=useFeedback()
  const en=language==='en',tx=(el,enText)=>en?enText:el
  const organizationId=tenant?.id||null
  const {allowed,entries,loading,error}=useRecycleBin(organizationId,role)
  const [busy,setBusy]=useState(null)
  useEffect(()=>{void purgeExpiredBin(organizationId)},[organizationId])
  async function restore(entry){
    setBusy(entry.id)
    try{await restoreFromBin(organizationId,entry);notify(tx(`Έγινε επαναφορά: ${entry.label}.`,`Restored: ${entry.label}.`),'success')}
    catch(cause){notifyError(cause,'save',{operation:'recycle_bin_restore'})}
    finally{setBusy(null)}
  }
  async function purge(entry){
    const ok=await confirm({title:tx('Οριστική διαγραφή','Delete for good'),message:tx(`Το «${entry.label}» θα διαγραφεί οριστικά και δεν θα μπορεί να επανέλθει.`,`“${entry.label}” will be deleted for good and cannot be restored.`),confirmLabel:tx('Οριστική διαγραφή','Delete for good'),danger:true})
    if(!ok)return
    setBusy(entry.id)
    try{await purgeFromBin(organizationId,entry);notify(tx('Διαγράφηκε οριστικά.','Deleted for good.'),'success')}
    catch(cause){notifyError(cause,'delete',{operation:'recycle_bin_purge'})}
    finally{setBusy(null)}
  }
  if(!allowed)return <div className="empty-state"><strong>{tx('Δεν υπάρχει πρόσβαση στον κάδο.','The recycle bin is not available for your role.')}</strong></div>
  return <Page fill title={tx('Κάδος ανακύκλωσης','Recycle bin')} subtitle={tx(`Ό,τι διαγράφεται μένει εδώ ${BIN_DAYS} ημέρες και μπορεί να επανέλθει όπως ήταν.`,`Whatever is deleted stays here for ${BIN_DAYS} days and can be restored as it was.`)}>
    <div className="platform-registry-shell workspace-column recycle-bin-shell">
      {loading?<div className="inline-empty">{tx('Φόρτωση κάδου…','Loading the recycle bin…')}</div>:entries.length?<div className="table-wrap scroll-table"><table className="data-table sticky-table recycle-bin-table"><thead><tr><th>{tx('Εγγραφή','Record')}</th><th>{tx('Ενότητα','Area')}</th><th>{tx('Διαγράφηκε','Deleted')}</th><th>{tx('Λήγει σε','Expires in')}</th><th aria-label={tx('Ενέργειες','Actions')}/></tr></thead><tbody>{entries.map(entry=>{const left=daysLeft(entry);return <tr key={entry.id}><td><strong>{entry.label}</strong>{entry.detail&&<small>{entry.detail}</small>}</td><td>{(MODULES[entry.module]||MODULES.administration)[en?1:0]}</td><td><strong>{fmtDateTime(entry.deletedAt)}</strong><small>{entry.deletedByName||'—'}</small></td><td><span className={`status-badge ${left<=5?'warning':'neutral'}`}>{tx(`${left} ${left===1?'ημέρα':'ημέρες'}`,`${left} ${left===1?'day':'days'}`)}</span></td><td><div className="row-actions recycle-bin-actions"><Button variant="secondary" disabled={busy===entry.id} onClick={()=>restore(entry)}><RotateCcw size={15}/><span>{tx('Επαναφορά','Restore')}</span></Button><Button variant="secondary" className="button-destructive" disabled={busy===entry.id} onClick={()=>purge(entry)}><Trash2 size={15}/><span>{tx('Οριστική διαγραφή','Delete for good')}</span></Button></div></td></tr>})}</tbody></table></div>:<div className="registry-empty-state recycle-bin-empty"><RecycleBinIcon full={false} size={64}/><strong>{tx('Ο κάδος είναι άδειος','The recycle bin is empty')}</strong><span>{tx('Ό,τι διαγράφετε εμφανίζεται εδώ και μπορεί να επανέλθει.','Whatever you delete appears here and can be restored.')}</span></div>}
      {error&&!loading&&<div className="data-access-state warning" role="status"><span>{tx('Δεν ήταν δυνατή η φόρτωση του κάδου.','The recycle bin could not be loaded.')}</span></div>}
    </div>
  </Page>
}
