import { useEffect,useMemo,useState } from 'react'
import { AlertTriangle,Info,Trash2 } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { deletePlatformOrganizations,getOrganizationDeletionImpact } from '../../core/tenant/tenantService'
import './platformDeletion.css'

const fmtNumber=(value,language)=>new Intl.NumberFormat(language==='en'?'en-GB':'el-GR').format(Number(value)||0)
function fmtBytes(bytes,language){const n=Number(bytes)||0;if(n<1024)return `${fmtNumber(n,language)} B`;const units=['KB','MB','GB','TB'];let v=n/1024,i=0;while(v>=1024&&i<units.length-1){v/=1024;i++}return `${new Intl.NumberFormat(language==='en'?'en-GB':'el-GR',{maximumFractionDigits:1}).format(v)} ${units[i]}`}

// One organization: type its code. Several (Demo only): type "ΔΙΑΓΡΑΦΗ <count>" / "DELETE <count>".
export function deletionPhrase(organizations,language){return organizations.length>1?`${language==='en'?'DELETE':'ΔΙΑΓΡΑΦΗ'} ${organizations.length}`:String(organizations[0]?.code||'')}
export function deletionPhraseMatches(value,organizations,language){const typed=String(value||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('el-GR');return Boolean(typed)&&typed===deletionPhrase(organizations,language).toLocaleUpperCase('el-GR')}

// Permanent deletion of one organization (Demo or real) or of several Demo at
// once. Shows what will be removed, refuses what the server would refuse (a
// real organization that is not suspended), and asks for the confirmation
// phrase and the Platform Owner's password.
export function OrganizationDeleteDialog({organizations,language='el',onClose,onDeleted}){
  const en=language==='en',tx=(el,enText)=>en?enText:el
  const {notify,notifyError}=useFeedback()
  const ids=useMemo(()=>organizations.map(o=>o.id).filter(Boolean),[organizations])
  const [impact,setImpact]=useState(null),[impactError,setImpactError]=useState('')
  const [confirmation,setConfirmation]=useState(''),[password,setPassword]=useState(''),[working,setWorking]=useState(false)
  useEffect(()=>{let active=true;setImpact(null);setImpactError('');getOrganizationDeletionImpact(ids).then(rows=>{if(active)setImpact(rows)}).catch(error=>{if(active)setImpactError(error?.message||'error')});return()=>{active=false}},[ids])

  const many=organizations.length>1
  const allDemo=organizations.every(o=>o.is_demo)
  const rows=impact||[]
  const blocked=rows.filter(r=>(r.blockers||[]).length)
  const totals=rows.reduce((a,r)=>({records:a.records+(Number(r.records)||0),files:a.files+(Number(r.files)||0),bytes:a.bytes+(Number(r.bytes)||0),accountsDeleted:a.accountsDeleted+(Number(r.accountsDeleted)||0)}),{records:0,files:0,bytes:0,accountsDeleted:0})
  const phrase=deletionPhrase(organizations,language)
  const ready=Boolean(impact)&&!blocked.length&&deletionPhraseMatches(confirmation,organizations,language)&&Boolean(password)&&(!many||allDemo)
  const blockerLabel=b=>b==='not_suspended'?tx('Θέσε πρώτα τον οργανισμό σε παύση.','Suspend the organization first.'):b==='has_children'?tx('Έχει θυγατρικούς οργανισμούς.','Has child organizations.'):b

  async function submit(){
    if(!ready||working)return
    setWorking(true)
    try{
      const result=await deletePlatformOrganizations({organizationIds:ids,password,confirmation:confirmation.trim()})
      const results=Array.isArray(result?.results)?result.results:[]
      const failed=results.filter(r=>!r.ok)
      const deletedIds=results.filter(r=>r.ok).map(r=>r.organizationId)
      if(failed.length)notify(tx(`Διαγράφηκαν ${deletedIds.length}. Δεν διαγράφηκαν: ${failed.map(r=>`${r.name||r.code} (${r.error})`).join(', ')}`,`Deleted ${deletedIds.length}. Not deleted: ${failed.map(r=>`${r.name||r.code} (${r.error})`).join(', ')}`),'warning',{operation:'platform_organization_delete'})
      else notify(many?tx(`Διαγράφηκαν οριστικά ${deletedIds.length} Demo.`,`${deletedIds.length} Demo permanently deleted.`):allDemo?tx('Το Demo και όλα τα σχετικά δεδομένα διαγράφηκαν οριστικά.','The Demo and all related data were permanently deleted.'):tx('Ο οργανισμός και τα σχετικά δεδομένα διαγράφηκαν οριστικά.','The organization and related data were permanently deleted.'),'success',{operation:'platform_organization_delete'})
      await onDeleted?.(deletedIds,result)
    }catch(error){notifyError(error,'delete',{operation:'platform_organization_delete'});setWorking(false)}
  }

  const title=many?tx(`Διαγραφή ${organizations.length} Demo`,`Delete ${organizations.length} Demo`):allDemo?tx('Οριστική διαγραφή Demo','Delete Demo permanently'):tx(`Διαγραφή «${organizations[0]?.name||''}»`,`Delete “${organizations[0]?.name||''}”`)
  const subtitle=allDemo?tx('Τα Demo διαγράφονται αμέσως και οριστικά. Δεν επηρεάζεται κανένα πραγματικό νοσοκομείο.','Demo are deleted immediately and permanently. No real hospital is affected.'):tx('Πραγματικός οργανισμός: διαγράφονται οριστικά όλα τα δεδομένα, τα αρχεία και οι λογαριασμοί του. Η ενέργεια δεν αναιρείται.','Real organization: all of its data, files and accounts are permanently deleted. This cannot be undone.')

  return <ObserverDialog width="wide" className="organization-delete-dialog" eyebrow={allDemo?tx('Κρίσιμη ενέργεια','Critical action'):tx('Κρίσιμη ενέργεια · Πραγματικός οργανισμός','Critical action · Real organization')} title={title} subtitle={subtitle} onClose={()=>!working&&onClose?.()} footer={<><Button variant="secondary" disabled={working} onClick={onClose}>{tx('Ακύρωση','Cancel')}</Button><Button variant="danger" className="button-destructive" loading={working} disabled={!ready} onClick={submit}><Trash2 size={15}/>{many?tx(`Οριστική διαγραφή ${organizations.length} Demo`,`Permanently delete ${organizations.length} Demo`):tx('Οριστική διαγραφή','Delete permanently')}</Button></>}>
    <div className="organization-delete-impact">
      <table className="data-table"><thead><tr><th>{allDemo?'Demo':tx('Οργανισμός','Organization')}</th><th>{tx('Εγγραφές','Records')}</th><th>{tx('Αρχεία','Files')}</th><th>{tx('Λογαριασμοί που διαγράφονται','Accounts deleted')}</th></tr></thead>
        <tbody>{impact?rows.map(r=><tr key={r.organizationId} className={(r.blockers||[]).length?'is-blocked':''}><td><strong>{r.name}</strong><small>{r.code}{(r.blockers||[]).length?<> · <b className="organization-delete-blocker">{r.blockers.map(blockerLabel).join(' ')}</b></>:null}</small></td><td>{fmtNumber(r.records,language)}{Number(r.systemRecords)>0&&<small>{tx(`+ ${fmtNumber(r.systemRecords,language)} βιβλιοθήκες συστήματος`,`+ ${fmtNumber(r.systemRecords,language)} system library rows`)}</small>}</td><td>{fmtNumber(r.files,language)}{Number(r.files)>0&&<small>{fmtBytes(r.bytes,language)}</small>}</td><td>{fmtNumber(r.accountsDeleted,language)} {tx('από','of')} {fmtNumber(r.members,language)}{Number(r.accountsKept)>0&&<small>{Number(r.accountsKept)===1?tx('1 μέλος και άλλου οργανισμού — διατηρείται','1 also belongs elsewhere — kept'):tx(`${fmtNumber(r.accountsKept,language)} μέλη και άλλου οργανισμού — διατηρούνται`,`${fmtNumber(r.accountsKept,language)} also belong elsewhere — kept`)}</small>}</td></tr>):<tr><td colSpan={4} className="organization-delete-loading">{impactError?tx('Δεν ήταν δυνατός ο υπολογισμός των επιπτώσεων. Η διαγραφή δεν είναι διαθέσιμη.','Could not work out what would be deleted. Deletion is unavailable.'):tx('Υπολογισμός επιπτώσεων…','Working out what will be deleted…')}</td></tr>}</tbody>
        {impact&&many&&<tfoot><tr><td>{tx('Σύνολο','Total')}</td><td>{fmtNumber(totals.records,language)}</td><td>{fmtNumber(totals.files,language)}<small>{fmtBytes(totals.bytes,language)}</small></td><td>{fmtNumber(totals.accountsDeleted,language)}</td></tr></tfoot>}
      </table>
    </div>
    {blocked.length>0?<div className="organization-delete-note is-warning" role="alert"><AlertTriangle size={17}/><span>{tx('Οι πραγματικοί οργανισμοί διαγράφονται μόνο αφού τεθούν σε παύση. Κλείσε αυτό το παράθυρο, πάτησε «Παύση» στην καρτέλα του οργανισμού και ξαναδοκίμασε.','Real organizations can be deleted only after they are suspended. Close this window, press “Suspend” on the organization record and try again.')}</span></div>
      :<div className="organization-delete-note"><Info size={17}/><span>{tx('Διαγράφονται: ο οργανισμός, όλα τα δεδομένα του, τα αρχεία του και οι λογαριασμοί που δεν ανήκουν σε άλλον οργανισμό. Μένει μια εγγραφή στο ημερολόγιο ελέγχου της πλατφόρμας.','Deleted: the organization, all of its data, its files and the accounts that belong to no other organization. An entry remains in the platform audit log.')}</span></div>}
    <div className="platform-form-grid organization-delete-confirm">
      <label className="field"><span>{tx('Πληκτρολόγησε','Type')} <b>{phrase}</b> {tx('για επιβεβαίωση','to confirm')}</span><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" disabled={working}/></label>
      <label className="field"><span>{tx('Κωδικός Ιδιοκτήτη Πλατφόρμας','Platform Owner password')}</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" disabled={working}/></label>
    </div>
  </ObserverDialog>
}
