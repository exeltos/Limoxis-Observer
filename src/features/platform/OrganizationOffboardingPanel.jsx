import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Archive, CalendarClock, Download, Info, Undo2 } from 'lucide-react'
import { supabase } from '../../core/supabase/client'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { cancelOrganizationDeletion, exportOrganization, listOrganizationExports, organizationExportLink, scheduleOrganizationDeletion } from './platformLifecycleService'
import './platformLifecycle.css'

const fmtDate=(value,en)=>value?new Date(value).toLocaleDateString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'
const fmtDateTime=(value,en)=>value?new Date(value).toLocaleString(en?'en-GB':'el-GR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'
const fmtSize=bytes=>!bytes?'—':bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(1)} MB`
const RECENT_EXPORT_DAYS=30
const isRecent=value=>value&&Date.now()-new Date(value).getTime()<RECENT_EXPORT_DAYS*86400000
const openLink=url=>{if(!url)return;const a=document.createElement('a');a.href=url;a.rel='noopener';document.body.appendChild(a);a.click();a.remove()}

// Organization record, "Export & deletion": a full ZIP copy for the hand-over,
// and deletion after a grace period (platform setting, default 30 days). The
// deletion needs an export from the last 30 days, or a reason to go without
// one; until the date the organization is closed, and it can be cancelled.
export function OrganizationOffboardingPanel({organization,language='el',onChanged,onDeleteNow}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const {notify,notifyError,confirm}=useFeedback()
  const [state,setState]=useState({loading:true,exports:[],deletion:null,graceDays:30})
  const [working,setWorking]=useState('')
  const [scheduleOpen,setScheduleOpen]=useState(false)
  const reload=useCallback(async()=>{
    if(!organization?.id)return
    try{
      const [exports,org,settings]=await Promise.all([
        listOrganizationExports(organization.id),
        supabase?supabase.from('organizations').select('deletion_scheduled_at,deletion_requested_at,deletion_reason,deletion_export_waived_reason').eq('id',organization.id).maybeSingle():{data:null},
        supabase?supabase.from('platform_settings').select('organization_deletion_grace_days').eq('id','global').maybeSingle():{data:null},
      ])
      setState({loading:false,exports,deletion:org?.data?.deletion_scheduled_at?org.data:null,graceDays:Number(settings?.data?.organization_deletion_grace_days)||30})
    }catch(error){setState(current=>({...current,loading:false}));notifyError(error,'load',{operation:'organization_offboarding_load'})}
  },[organization?.id,notifyError])
  useEffect(()=>{void reload()},[reload])

  async function createExport(){setWorking('export');try{const result=await exportOrganization(organization.id);notify(tx(`Το αντίγραφο δημιουργήθηκε: ${result.tables} πίνακες, ${result.rows} εγγραφές, ${result.files} αρχεία.`,`Export created: ${result.tables} tables, ${result.rows} rows, ${result.files} files.`),'success',{operation:'organization_export'});openLink(result.url);await reload()}catch(error){notifyError(error,'export',{operation:'organization_export'})}finally{setWorking('')}}
  async function download(item){setWorking(item.id);try{openLink(await organizationExportLink(item.id))}catch(error){notifyError(error,'export',{operation:'organization_export_download'})}finally{setWorking('')}}
  async function schedule(values){setWorking('schedule');try{const result=await scheduleOrganizationDeletion(organization.id,values);setScheduleOpen(false);notify(tx(`Η διαγραφή προγραμματίστηκε για τις ${fmtDate(result?.deletionScheduledAt,false)}. Οι χρήστες του οργανισμού δεν έχουν πια πρόσβαση.`,`Deletion scheduled for ${fmtDate(result?.deletionScheduledAt,true)}. The organization's users no longer have access.`),'success',{operation:'organization_deletion_schedule'});await reload();onChanged?.()}catch(error){notifyError(error,'save',{operation:'organization_deletion_schedule'})}finally{setWorking('')}}
  async function cancel(){const ok=await confirm({title:tx('Ακύρωση διαγραφής','Cancel deletion'),message:tx('Ο οργανισμός θα ενεργοποιηθεί ξανά και οι χρήστες του θα αποκτήσουν ξανά πρόσβαση.','The organization becomes active again and its users regain access.'),confirmLabel:tx('Ακύρωση διαγραφής','Cancel deletion')});if(!ok)return;setWorking('cancel');try{await cancelOrganizationDeletion(organization.id);notify(tx('Η διαγραφή ακυρώθηκε. Ο οργανισμός είναι ξανά ενεργός.','Deletion cancelled. The organization is active again.'),'success',{operation:'organization_deletion_cancel'});await reload();onChanged?.()}catch(error){notifyError(error,'save',{operation:'organization_deletion_cancel'})}finally{setWorking('')}}

  const recentExport=state.exports.find(item=>isRecent(item.created_at))||null
  const due=state.deletion&&new Date(state.deletion.deletion_scheduled_at).getTime()<=Date.now()
  return <section className="platform-form-section offboarding-panel">
    <header><div><strong>{tx('Αντίγραφο & διαγραφή','Export & deletion')}</strong><span>{tx('Πλήρες αντίγραφο του οργανισμού για παράδοση και προγραμματισμένη οριστική διαγραφή με περίοδο χάριτος.','A full copy of the organization for hand-over, and scheduled permanent deletion with a grace period.')}</span></div></header>
    {state.deletion&&<div className="offboarding-scheduled" role="status"><CalendarClock size={18}/><div><strong>{due?tx('Η περίοδος χάριτος έληξε','The grace period has ended'):tx(`Προς διαγραφή στις ${fmtDate(state.deletion.deletion_scheduled_at,false)}`,`To be deleted on ${fmtDate(state.deletion.deletion_scheduled_at,true)}`)}</strong><div>{tx('Αιτιολογία','Reason')}: {state.deletion.deletion_reason||'—'}{state.deletion.deletion_export_waived_reason?` · ${tx('Χωρίς αντίγραφο','No export')}: ${state.deletion.deletion_export_waived_reason}`:''}</div></div><span className="offboarding-spacer"/>
      <Button variant="secondary" disabled={Boolean(working)} onClick={cancel}><Undo2 size={15}/>{tx('Ακύρωση διαγραφής','Cancel deletion')}</Button>
      {due&&<Button variant="danger" className="button-destructive" disabled={Boolean(working)} onClick={onDeleteNow}>{tx('Οριστική διαγραφή','Delete permanently')}</Button>}
    </div>}
    <div className="lifecycle-note"><Info size={16}/><span>{tx(`Το αντίγραφο (ZIP) περιέχει κάθε πίνακα του οργανισμού σε CSV, τα στοιχεία του οργανισμού και όλα τα συνημμένα αρχεία. Για προγραμματισμένη διαγραφή χρειάζεται αντίγραφο των τελευταίων ${RECENT_EXPORT_DAYS} ημερών ή αιτιολογία παράλειψης.`,`The copy (ZIP) holds every organization table as CSV, the organization details and all attachments. Scheduling a deletion needs an export from the last ${RECENT_EXPORT_DAYS} days or a reason to go without one.`)}</span></div>
    <div className="offboarding-actions">
      <Button variant="secondary" loading={working==='export'} disabled={Boolean(working)} onClick={createExport}><Archive size={15}/>{tx('Δημιουργία αντιγράφου','Create export')}</Button>
      {!state.deletion&&<Button variant="danger" className="button-destructive" disabled={Boolean(working)||state.loading} onClick={()=>setScheduleOpen(true)}><CalendarClock size={15}/>{tx('Προγραμματισμός διαγραφής','Schedule deletion')}</Button>}
    </div>
    {state.exports.length>0&&<div className="offboarding-exports">{state.exports.map(item=><div className="offboarding-export" key={item.id}><Archive size={15}/><div><strong>{fmtDateTime(item.created_at,en)}</strong><small> · {item.tables_count} {tx('πίνακες','tables')} · {item.rows_count} {tx('εγγραφές','rows')} · {item.files_count} {tx('αρχεία','files')} · {fmtSize(item.file_size)}</small></div><span className="offboarding-spacer"/><Button variant="secondary" loading={working===item.id} disabled={Boolean(working)} onClick={()=>download(item)}><Download size={14}/>{tx('Λήψη','Download')}</Button></div>)}</div>}
    {scheduleOpen&&<ScheduleDeletionDialog language={language} organization={organization} graceDays={state.graceDays} recentExport={recentExport} working={working==='schedule'} onSchedule={schedule} onClose={()=>setScheduleOpen(false)}/>}
  </section>
}

function ScheduleDeletionDialog({language,organization,graceDays,recentExport,working,onSchedule,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [reason,setReason]=useState('')
  const [waived,setWaived]=useState('')
  const [confirmed,setConfirmed]=useState(false)
  const date=new Date();date.setDate(date.getDate()+graceDays)
  const ready=reason.trim()&&(recentExport||waived.trim())&&confirmed&&!working
  return <ObserverDialog width="standard" className="schedule-deletion-dialog" eyebrow={tx('Κρίσιμη ενέργεια · Πραγματικός οργανισμός','Critical action · Real organization')} title={tx(`Προγραμματισμός διαγραφής: ${organization?.name||''}`,`Schedule deletion: ${organization?.name||''}`)}
    subtitle={tx(`Ο οργανισμός κλείνει τώρα και διαγράφεται οριστικά μετά από ${graceDays} ημέρες (${fmtDate(date,false)}). Μέχρι τότε η διαγραφή ακυρώνεται.`,`The organization closes now and is permanently deleted after ${graceDays} days (${fmtDate(date,true)}). Until then it can be cancelled.`)}
    onClose={()=>!working&&onClose?.()} footer={<><Button variant="secondary" disabled={working} onClick={onClose}>{tx('Ακύρωση','Cancel')}</Button><Button variant="danger" className="button-destructive" loading={working} disabled={!ready} onClick={()=>onSchedule?.({reason:reason.trim(),exportWaivedReason:recentExport?'':waived.trim()})}><CalendarClock size={15}/>{tx('Προγραμματισμός διαγραφής','Schedule deletion')}</Button></>}>
    {recentExport
      ?<div className="lifecycle-note"><Archive size={16}/><span>{tx(`Υπάρχει αντίγραφο της ${fmtDateTime(recentExport.created_at,false)}. Ο πελάτης μπορεί να το παραλάβει πριν τη διαγραφή.`,`An export from ${fmtDateTime(recentExport.created_at,true)} exists. The customer can receive it before the deletion.`)}</span></div>
      :<div className="lifecycle-warning"><AlertTriangle size={16}/><div><strong>{tx(`Δεν υπάρχει αντίγραφο των τελευταίων ${RECENT_EXPORT_DAYS} ημερών`,`No export from the last ${RECENT_EXPORT_DAYS} days`)}</strong><span>{tx('Δημιουργήστε πρώτα αντίγραφο ή γράψτε γιατί δεν χρειάζεται. Η αιτιολογία καταγράφεται στο ιστορικό.','Create an export first, or say why it is not needed. The reason is kept in the audit log.')}</span></div></div>}
    <div className="lifecycle-form">
      <label className="field lifecycle-wide"><span>{tx('Αιτιολογία διαγραφής','Reason for deletion')} *</span><textarea rows={2} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={working} placeholder={tx('π.χ. λήξη σύμβασης','e.g. contract ended')}/></label>
      {!recentExport&&<label className="field lifecycle-wide"><span>{tx('Γιατί δεν χρειάζεται αντίγραφο','Why no export is needed')} *</span><textarea rows={2} maxLength={1000} value={waived} onChange={e=>setWaived(e.target.value)} disabled={working}/></label>}
      <label className="lifecycle-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={working}/><span>{tx('Κατανοώ ότι οι χρήστες του οργανισμού χάνουν την πρόσβαση από τώρα και ότι μετά την ημερομηνία τα δεδομένα διαγράφονται οριστικά.','I understand the organization\'s users lose access now and that after the date the data is permanently deleted.')}</span></label>
    </div>
  </ObserverDialog>
}
