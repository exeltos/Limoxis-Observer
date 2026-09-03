import { useEffect,useState } from 'react'
import { FlaskConical,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Trash2 } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { IconButton } from '../../design-system/IconButton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { deletePlatformDemo,resetPlatformDemoPassword,setPlatformDemoStatus,updatePlatformDemoEntitlement } from '../../core/tenant/tenantService'

function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
function InfoSection({title,children}){return <section className="platform-info-section"><h3>{title}</h3><dl>{children}</dl></section>}
function InfoRow({label,value,status}){return <div className="platform-info-row"><dt>{label}</dt><dd>{status?<span className={`status-badge ${status==='active'?'active':'danger'}`}>{value||'—'}</span>:(value??'—')}</dd></div>}
function Action({icon,tone,label,title,onClick,disabled=false}){return <div className="platform-org-action-item"><IconButton tone={tone} label={title} disabled={disabled} onClick={onClick}>{icon}</IconButton><span>{label}</span></div>}

export function PlatformDemoRecord({demo,language='el',onBack,onOpenDemo,onChanged,onDeleted}){
  const [record,setRecord]=useState(demo)
  const [editOpen,setEditOpen]=useState(false)
  const [draft,setDraft]=useState(null)
  const [saving,setSaving]=useState(false)
  const [working,setWorking]=useState(false)
  const {notify,notifyError,confirm}=useFeedback()
  useEffect(()=>setRecord(demo),[demo])
  if(!record)return null

  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText
  const today=new Date().toISOString().slice(0,10)
  const remaining=daysBetween(today,record.valid_until)
  const active=record.status==='active'&&remaining>0
  const status=active?'active':record.status==='paused'?'paused':'expired'
  const statusLabel=active?tx('Ενεργό','Active'):status==='paused'?tx('Σε παύση','Paused'):tx('Ληγμένο / ανενεργό','Expired / inactive')
  const org=record.organization||null

  function openEdit(){setDraft({label:record.label||'',contactName:record.contact_name||'',contactEmail:record.contact_email||'',validFrom:record.valid_from||'',validUntil:record.valid_until||''});setEditOpen(true)}
  async function saveEdit(){if(!draft?.label?.trim()||!draft?.validFrom||!draft?.validUntil||saving)return;setSaving(true);try{const next=await updatePlatformDemoEntitlement(record.id,draft);setRecord(next);setEditOpen(false);onChanged?.(next);notify(tx('Η καρτέλα Demo ενημερώθηκε.','Demo record updated.'),'success',{operation:'platform_demo_update'})}catch(error){notifyError(error,'save',{operation:'platform_demo_update'})}finally{setSaving(false)}}
  async function togglePause(){if(working)return;const next=record.status==='paused'?'active':'paused';const ok=await confirm({title:next==='paused'?tx('Παύση Demo','Pause Demo'):tx('Ενεργοποίηση Demo','Reactivate Demo'),message:next==='paused'?tx('Η πρόσβαση του Demo χρήστη θα απενεργοποιηθεί μέχρι να την ενεργοποιήσεις ξανά.','The Demo user will lose Demo access until you reactivate it.'):tx('Να ενεργοποιηθεί ξανά η πρόσβαση Demo;','Reactivate Demo access?'),confirmLabel:next==='paused'?tx('Παύση','Pause'):tx('Ενεργοποίηση','Reactivate')});if(!ok)return;setWorking(true);try{const updated=await setPlatformDemoStatus(record.id,next);setRecord(updated);onChanged?.(updated);notify(next==='paused'?tx('Το Demo τέθηκε σε παύση.','Demo paused.'):tx('Το Demo ενεργοποιήθηκε.','Demo reactivated.'),'success',{operation:'platform_demo_status'})}catch(error){notifyError(error,'action',{operation:'platform_demo_status'})}finally{setWorking(false)}}
  async function resetPassword(){
    if(working)return
    const target=record.contact_email||tx('το καταχωρημένο email','the registered email address')
    const ok=await confirm({
      title:tx('Επαναφορά κωδικού Demo','Reset Demo password'),
      message:tx(
        `Θα αποσταλεί email ασφαλούς επαναφοράς κωδικού στο ${target}. Ο κωδικός δεν αλλάζει μέχρι ο Demo χρήστης να ολοκληρώσει τη διαδικασία. Θέλεις να συνεχίσεις;`,
        `A secure password-reset email will be sent to ${target}. The password will not change until the Demo user completes the reset flow. Do you want to continue?`
      ),
      confirmLabel:tx('Αποστολή email','Send reset email'),
    })
    if(!ok)return
    setWorking(true)
    try{await resetPlatformDemoPassword(record);notify(tx('Στάλθηκε email επαναφοράς κωδικού στον Demo χρήστη.','Password reset email sent to the Demo user.'),'success',{operation:'platform_demo_reset_password'})}catch(error){notifyError(error,'action',{operation:'platform_demo_reset_password'})}finally{setWorking(false)}
  }
  async function removeDemo(){if(working)return;const ok=await confirm({title:tx('Οριστική διαγραφή Demo','Delete Demo permanently'),message:tx(`Θα διαγραφούν η Demo πρόσβαση, ο Demo λογαριασμός και ο απομονωμένος Demo οργανισμός «${org?.name||record.label}». Η ενέργεια δεν αναιρείται.`,`The Demo access, Demo account, and isolated Demo organization “${org?.name||record.label}” will be permanently deleted. This cannot be undone.`),confirmLabel:tx('Οριστική διαγραφή','Delete permanently'),danger:true});if(!ok)return;setWorking(true);try{await deletePlatformDemo(record);notify(tx('Το Demo διαγράφηκε οριστικά.','Demo deleted permanently.'),'success',{operation:'platform_demo_delete'});if(onDeleted)onDeleted(record.id);else onBack?.()}catch(error){notifyError(error,'delete',{operation:'platform_demo_delete'});setWorking(false)}}

  const actions=<div className="platform-org-actions" aria-label={tx('Ενέργειες Demo','Demo actions')}>
    <Action icon={<LogIn size={18}/>} tone="primary" label={tx('Είσοδος','Enter')} title={tx('Είσοδος στο Demo','Open Demo')} onClick={onOpenDemo}/>
    <Action icon={<Pencil size={17}/>} tone="edit" label={tx('Επεξεργασία','Edit')} title={tx('Επεξεργασία Demo','Edit Demo')} onClick={openEdit}/>
    <Action icon={<KeyRound size={17}/>} tone="neutral" label={tx('Κωδικός','Password')} title={tx('Επαναφορά κωδικού Demo χρήστη','Reset Demo user password')} disabled={working||!record.demo_user_id||!record.organization_id} onClick={resetPassword}/>
    <Action icon={record.status==='paused'?<PlayCircle size={17}/>:<PauseCircle size={17}/>} tone={record.status==='paused'?'success':'neutral'} label={record.status==='paused'?tx('Ενεργοποίηση','Reactivate'):tx('Παύση','Pause')} title={record.status==='paused'?tx('Ενεργοποίηση Demo','Reactivate Demo'):tx('Παύση Demo','Pause Demo')} disabled={working} onClick={togglePause}/>
    <Action icon={<Trash2 size={17}/>} tone="danger" label={tx('Διαγραφή','Delete')} title={tx('Οριστική διαγραφή Demo','Delete Demo permanently')} disabled={working} onClick={removeDemo}/>
  </div>

  return <>
    <EntityRecordShell
      className="platform-owner-record-shell platform-demo-record-workspace"
      avatar={<FlaskConical size={20}/>} eyebrow={tx('ΚΑΡΤΕΛΑ DEMO','DEMO RECORD')}
      title={org?.name||record.label}
      subtitle={tx('Χρονικά περιορισμένο και πλήρως απομονωμένο περιβάλλον επίδειξης.','Time-limited, fully isolated demonstration environment.')}
      status={<span className={`status-badge ${active?'active':status==='paused'?'temporary':'danger'}`}>{statusLabel}</span>}
      headerActions={actions}
      onBack={onBack}
      backLabel={tx('Πίσω','Back')}
    >
      <div className="platform-owner-details">
        <div className="platform-demo-record-status"><span className="platform-demo-icon"><FlaskConical size={20}/></span><div><strong>{statusLabel}</strong><span>{active?`${remaining} ${tx('ημέρες υπόλοιπο','days remaining')}`:status==='paused'?tx('Η πρόσβαση έχει τεθεί σε παύση.','Access is paused.'):tx('Η πρόσβαση δεν είναι ενεργή.','Access is not active.')}</span></div></div>
        <div className="platform-info-sections platform-demo-info-sections">
          <InfoSection title={tx('Demo οργανισμός','Demo organization')}><InfoRow label={tx('Επωνυμία','Name')} value={org?.name||record.label}/><InfoRow label={tx('Κωδικός','Code')} value={org?.code||'—'}/><InfoRow label={tx('Τύπος','Type')} value="Demo / Prospect"/><InfoRow label={tx('Κατάσταση','Status')} value={statusLabel} status={active?'active':'danger'}/></InfoSection>
          <InfoSection title={tx('Επικοινωνία','Contact')}><InfoRow label={tx('Υπεύθυνος','Contact person')} value={record.contact_name||'—'}/><InfoRow label="Email" value={record.contact_email||'—'}/><InfoRow label={tx('Λογαριασμός Demo','Demo account')} value={record.demo_user_id?tx('Συνδεδεμένος','Linked'):tx('Δεν έχει συνδεθεί','Not linked')}/></InfoSection>
          <InfoSection title={tx('Διάρκεια πρόσβασης','Access period')}><InfoRow label={tx('Έναρξη','Start')} value={record.valid_from}/><InfoRow label={tx('Λήξη','End')} value={record.valid_until}/><InfoRow label={tx('Υπόλοιπο','Remaining')} value={`${remaining} ${tx('ημέρες','days')}`}/><InfoRow label={tx('Απομόνωση δεδομένων','Data isolation')} value={tx('Μόνο Demo δεδομένα','Demo data only')}/></InfoSection>
        </div>
      </div>
    </EntityRecordShell>
    {editOpen&&<ObserverDialog width="wide" eyebrow={tx('Platform Owner · Demo','Platform Owner · Demo')} title={tx('Επεξεργασία Demo','Edit Demo')} subtitle={tx('Ενημέρωση στοιχείων και διάρκειας πρόσβασης.','Update details and access period.')} onClose={()=>!saving&&setEditOpen(false)} footer={<SaveButton loading={saving} onClick={saveEdit}>{tx('Αποθήκευση','Save')}</SaveButton>}><div className="platform-form-shell"><section className="platform-form-section"><header><strong>{tx('Στοιχεία Demo','Demo details')}</strong></header><div className="platform-form-grid platform-demo-edit-grid"><label className="field field-wide"><span>{tx('Οργανισμός / Prospect','Organization / Prospect')} *</span><input value={draft?.label||''} onChange={e=>setDraft(x=>({...x,label:e.target.value}))}/></label><label className="field"><span>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</span><input value={draft?.contactName||''} onChange={e=>setDraft(x=>({...x,contactName:e.target.value}))}/></label><label className="field"><span>Email</span><input type="email" value={draft?.contactEmail||''} onChange={e=>setDraft(x=>({...x,contactEmail:e.target.value}))}/></label><ManualDateField label={tx('Έναρξη','Start')} value={draft?.validFrom||''} onChange={value=>setDraft(x=>({...x,validFrom:value}))}/><ManualDateField label={tx('Λήξη','End')} value={draft?.validUntil||''} onChange={value=>setDraft(x=>({...x,validUntil:value}))}/></div></section></div></ObserverDialog>}
  </>
}
