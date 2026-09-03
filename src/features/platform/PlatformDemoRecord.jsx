import { useEffect,useState } from 'react'
import { Building2,FlaskConical,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Trash2,X } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { IconButton } from '../../design-system/IconButton'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { purgePlatformOrganization,resetPlatformDemoPassword,setPlatformDemoStatus } from '../../core/tenant/tenantService'
import { convertPlatformDemoToOrganization,loadPlatformDemoRecord,savePlatformDemoRecord } from './platformDemoService'
import './platform-demo-record.css'

const GREEK_REGIONS=['Ανατολική Μακεδονία και Θράκη','Κεντρική Μακεδονία','Δυτική Μακεδονία','Ήπειρος','Θεσσαλία','Ιόνια Νησιά','Δυτική Ελλάδα','Στερεά Ελλάδα','Αττική','Πελοπόννησος','Βόρειο Αιγαίο','Νότιο Αιγαίο','Κρήτη']
const HEALTH_REGIONS=['1η ΥΠΕ Αττικής','2η ΥΠΕ Πειραιώς και Αιγαίου','3η ΥΠΕ Μακεδονίας','4η ΥΠΕ Μακεδονίας και Θράκης','5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας','6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας','7η ΥΠΕ Κρήτης']
function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
function Action({icon,tone,label,title,onClick,disabled=false}){return <div className="platform-org-action-item"><IconButton tone={tone} label={title} disabled={disabled} onClick={onClick}>{icon}</IconButton><span>{label}</span></div>}
function FormSection({title,subtitle,children}){return <section className="platform-form-section"><header><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</header>{children}</section>}

export function PlatformDemoRecord({demo,language='el',onBack,onOpenDemo,onChanged,onDeleted}){
  const [record,setRecord]=useState(demo)
  const [draft,setDraft]=useState(null)
  const [saving,setSaving]=useState(false)
  const [working,setWorking]=useState(false)
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [deleteConfirm,setDeleteConfirm]=useState('')
  const [deletePassword,setDeletePassword]=useState('')
  const [editing,setEditing]=useState(false)
  const {notify,notifyError,confirm}=useFeedback()
  const en=language==='en'
  const tx=(elText,enText)=>en?enText:elText

  function toDraft(value){const org=value?.organization||{};return value?{label:org.name||value.label||'',type:org.type||'hospital',region:org.region||'',healthRegion:org.health_region||'',city:org.city||'',country:org.country||'',contactPhone:org.contact_phone||'',bedCapacity:org.bed_capacity??'',contactName:value.contact_name||'',contactEmail:value.contact_email||org.contact_email||'',validFrom:value.valid_from||'',validUntil:value.valid_until||''}:null}

  useEffect(()=>{
    let cancelled=false
    setRecord(demo)
    setDraft(toDraft(demo))
    setEditing(false)
    if(demo?.id){
      loadPlatformDemoRecord(demo.id).then(full=>{if(!cancelled){setRecord(full);setDraft(toDraft(full))}}).catch(()=>{})
    }
    return()=>{cancelled=true}
  },[demo])

  if(!record||!draft)return null
  const today=new Date().toISOString().slice(0,10)
  const remaining=daysBetween(today,record.valid_until)
  const active=record.status==='active'&&remaining>0
  const status=active?'active':record.status==='paused'?'paused':'expired'
  const statusLabel=active?tx('Ενεργό','Active'):status==='paused'?tx('Σε παύση','Paused'):tx('Ληγμένο / ανενεργό','Expired / inactive')
  const org=record.organization||null
  const deleteCode=org?.code||''
  const canSave=Boolean(draft.label.trim()&&draft.contactEmail.trim()&&draft.validFrom&&draft.validUntil)

  async function saveEdit(){if(!canSave||saving)return;setSaving(true);try{const next=await savePlatformDemoRecord(record,draft);setRecord(next);setDraft(toDraft(next));setEditing(false);onChanged?.(next);notify(tx('Η καρτέλα Demo ενημερώθηκε.','Demo record updated.'),'success',{operation:'platform_demo_update'})}catch(error){notifyError(error,'save',{operation:'platform_demo_update'})}finally{setSaving(false)}}
  async function togglePause(){if(working)return;const next=record.status==='paused'?'active':'paused';const ok=await confirm({title:next==='paused'?tx('Παύση Demo','Pause Demo'):tx('Ενεργοποίηση Demo','Reactivate Demo'),message:next==='paused'?tx('Η πρόσβαση του Demo χρήστη θα απενεργοποιηθεί μέχρι να την ενεργοποιήσεις ξανά.','The Demo user will lose Demo access until you reactivate it.'):tx('Να ενεργοποιηθεί ξανά η πρόσβαση Demo;','Reactivate Demo access?'),confirmLabel:next==='paused'?tx('Παύση','Pause'):tx('Ενεργοποίηση','Reactivate')});if(!ok)return;setWorking(true);try{const updated=await setPlatformDemoStatus(record.id,next);const full=await loadPlatformDemoRecord(updated.id);setRecord(full);setDraft(toDraft(full));onChanged?.(full);notify(next==='paused'?tx('Το Demo τέθηκε σε παύση.','Demo paused.'):tx('Το Demo ενεργοποιήθηκε.','Demo reactivated.'),'success',{operation:'platform_demo_status'})}catch(error){notifyError(error,'action',{operation:'platform_demo_status'})}finally{setWorking(false)}}
  async function resetPassword(){if(working)return;const target=record.contact_email||tx('το καταχωρημένο email','the registered email address');const ok=await confirm({title:tx('Επαναφορά κωδικού Demo','Reset Demo password'),message:tx(`Θα αποσταλεί email ασφαλούς επαναφοράς κωδικού στο ${target}. Θέλεις να συνεχίσεις;`,`A secure password-reset email will be sent to ${target}. Continue?`),confirmLabel:tx('Αποστολή email','Send reset email')});if(!ok)return;setWorking(true);try{await resetPlatformDemoPassword(record);notify(tx('Στάλθηκε email επαναφοράς κωδικού στον Demo χρήστη.','Password reset email sent to the Demo user.'),'success',{operation:'platform_demo_reset_password'})}catch(error){notifyError(error,'action',{operation:'platform_demo_reset_password'})}finally{setWorking(false)}}
  async function convertToOrganization(){if(working||!record.organization_id)return;const ok=await confirm({title:tx('Μετατροπή Demo σε οργανισμό','Convert Demo to organization'),message:tx('Ο ίδιος Demo οργανισμός θα γίνει κανονικός production οργανισμός και η Demo πρόσβαση θα ανακληθεί. Τα στοιχεία της καρτέλας θα διατηρηθούν. Θέλεις να συνεχίσεις;','The same Demo organization will become a production organization and Demo access will be revoked. Record details will be preserved. Continue?'),confirmLabel:tx('Μετατροπή σε οργανισμό','Convert to organization')});if(!ok)return;setWorking(true);try{if(canSave)await savePlatformDemoRecord(record,draft);const organization=await convertPlatformDemoToOrganization(record,draft);notify(tx('Το Demo μετατράπηκε σε κανονικό οργανισμό.','Demo converted to a production organization.'),'success',{operation:'platform_demo_convert'});window.location.assign(`/platform#organizations?organization=${organization.id}&tab=details`)}catch(error){notifyError(error,'action',{operation:'platform_demo_convert'});setWorking(false)}}
  function requestDelete(){setDeleteConfirm('');setDeletePassword('');setDeleteOpen(true)}
  async function confirmDelete(){if(working||!record.organization_id||!deleteCode||deleteConfirm.trim().toUpperCase()!==deleteCode.toUpperCase()||!deletePassword)return;setWorking(true);try{await purgePlatformOrganization({organizationId:record.organization_id,password:deletePassword,confirmation:deleteConfirm.trim()});setDeleteOpen(false);notify(tx('Το Demo και όλα τα σχετικά δεδομένα διαγράφηκαν οριστικά.','The Demo and all related data were permanently deleted.'),'success',{operation:'platform_demo_delete'});if(onDeleted)onDeleted(record.id);else onBack?.()}catch(error){notifyError(error,'delete',{operation:'platform_demo_delete'});setWorking(false)}}

  const actions=<div className="platform-org-actions" aria-label={tx('Ενέργειες Demo','Demo actions')}>
    <Action icon={<LogIn size={18}/>} tone="primary" label={tx('Είσοδος','Enter')} title={tx('Είσοδος στο Demo','Open Demo')} onClick={onOpenDemo}/>
    <Action icon={<KeyRound size={17}/>} tone="neutral" label={tx('Κωδικός','Password')} title={tx('Επαναφορά κωδικού Demo χρήστη','Reset Demo user password')} disabled={working||!record.demo_user_id||!record.organization_id} onClick={resetPassword}/>
    <Action icon={record.status==='paused'?<PlayCircle size={17}/>:<PauseCircle size={17}/>} tone={record.status==='paused'?'success':'neutral'} label={record.status==='paused'?tx('Ενεργοποίηση','Reactivate'):tx('Παύση','Pause')} title={record.status==='paused'?tx('Ενεργοποίηση Demo','Reactivate Demo'):tx('Παύση Demo','Pause Demo')} disabled={working} onClick={togglePause}/>
    <Action icon={<Building2 size={17}/>} tone="success" label={tx('Σε οργανισμό','Convert')} title={tx('Μετατροπή Demo σε κανονικό οργανισμό','Convert Demo to production organization')} disabled={working||!record.organization_id} onClick={convertToOrganization}/>
    <Action icon={<Trash2 size={17}/>} tone="danger" label={tx('Διαγραφή','Delete')} title={tx('Οριστική διαγραφή Demo','Delete Demo permanently')} disabled={working||!record.organization_id||!deleteCode} onClick={requestDelete}/>
  </div>

  return <>
    <EntityRecordShell className="platform-owner-record-shell platform-demo-record-workspace" avatar={<FlaskConical size={20}/>} eyebrow={tx('ΚΑΡΤΕΛΑ DEMO','DEMO RECORD')} title={draft.label||org?.name||record.label} subtitle={tx('Πλήρης επεξεργάσιμη καρτέλα Demo με τα ίδια βασικά στοιχεία της δημιουργίας.','Full editable Demo record with the same core fields as creation.')} status={<span className={`status-badge ${active?'active':status==='paused'?'temporary':'danger'}`}>{statusLabel}</span>} headerActions={actions} onBack={onBack} backLabel={tx('Πίσω','Back')}>
      <div className="platform-owner-details platform-demo-record-form">
        <div className="platform-demo-record-status"><span className="platform-demo-icon"><FlaskConical size={20}/></span><div><strong>{statusLabel}</strong><span>{active?`${remaining} ${tx('ημέρες υπόλοιπο','days remaining')}`:status==='paused'?tx('Η πρόσβαση έχει τεθεί σε παύση.','Access is paused.'):tx('Η πρόσβαση δεν είναι ενεργή.','Access is not active.')}</span></div></div>
        <div className="platform-record-edit-toolbar">{editing?<><Button variant="secondary" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveEdit} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone="edit" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}</div>
        <fieldset className="platform-record-edit-fieldset" disabled={!editing}><div className="platform-form-shell">
          <FormSection title={tx('Ταυτότητα Demo οργανισμού','Demo organization identity')} subtitle={tx('Τα στοιχεία αυτά ανήκουν στον απομονωμένο Demo οργανισμό.','These details belong to the isolated Demo organization.')}>
            <div className="platform-form-grid"><label className="field field-wide"><span>{tx('Επωνυμία οργανισμού / Prospect','Organization / Prospect name')} *</span><input value={draft.label} onChange={e=>setDraft(x=>({...x,label:e.target.value}))}/></label><label className="field"><span>{tx('Τύπος','Type')}</span><select value={draft.type} onChange={e=>setDraft(x=>({...x,type:e.target.value}))}><option value="hospital">{tx('Νοσοκομείο','Hospital')}</option><option value="clinic">{tx('Κλινική','Clinic')}</option><option value="group">{tx('Όμιλος','Group')}</option><option value="other">{tx('Άλλο','Other')}</option></select></label></div>
          </FormSection>
          <FormSection title={tx('Τοποθεσία & λειτουργία','Location & operations')}>
            <div className="platform-form-grid"><label className="field"><span>{tx('Περιφέρεια','Region')}</span><select value={draft.region} onChange={e=>setDraft(x=>({...x,region:e.target.value}))}><option value="">{tx('Επιλογή…','Select…')}</option>{GREEK_REGIONS.map(region=><option key={region}>{region}</option>)}</select></label><label className="field field-wide"><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')}</span><select value={draft.healthRegion} onChange={e=>setDraft(x=>({...x,healthRegion:e.target.value}))}><option value="">{tx('Επιλογή…','Select…')}</option>{HEALTH_REGIONS.map(region=><option key={region}>{region}</option>)}</select></label><LocationAutocompleteField label={tx('Πόλη','City')} value={draft.city} onChange={value=>setDraft(x=>({...x,city:value}))} options={CITY_OPTIONS}/><LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setDraft(x=>({...x,country:value}))} options={COUNTRY_OPTIONS}/><label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={draft.contactPhone} onChange={e=>setDraft(x=>({...x,contactPhone:e.target.value}))}/></label><label className="field"><span>{tx('Δυναμικότητα κλινών','Bed capacity')}</span><input type="number" min="0" value={draft.bedCapacity} onChange={e=>setDraft(x=>({...x,bedCapacity:e.target.value}))}/></label></div>
          </FormSection>
          <FormSection title={tx('Υπεύθυνος Demo & πρόσβαση','Demo contact & access')}>
            <div className="platform-demo-access-grid"><label className="field field-wide"><span>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</span><input value={draft.contactName} onChange={e=>setDraft(x=>({...x,contactName:e.target.value}))}/></label><label className="field field-wide"><span>{tx('Email πρόσκλησης','Invitation email')} *</span><input type="email" value={draft.contactEmail} onChange={e=>setDraft(x=>({...x,contactEmail:e.target.value}))}/></label><ManualDateField label={tx('Έναρξη','Start')} value={draft.validFrom} onChange={value=>setDraft(x=>({...x,validFrom:value}))}/><ManualDateField label={`${tx('Λήξη','End')} *`} value={draft.validUntil} onChange={value=>setDraft(x=>({...x,validUntil:value}))}/></div>
          </FormSection>
        </div></fieldset>
      </div>
    </EntityRecordShell>

    {deleteOpen&&<ObserverDialog width="wide" eyebrow={tx('Κρίσιμη ενέργεια · Επαναταυτοποίηση','Critical action · Re-authentication')} title={tx('Οριστική διαγραφή Demo','Delete Demo permanently')} subtitle={tx('Η ενέργεια δεν αναιρείται.','This action cannot be undone.')} onClose={()=>!working&&setDeleteOpen(false)} footer={<Button className="button-destructive" loading={working} disabled={!deletePassword||deleteConfirm.trim().toUpperCase()!==deleteCode.toUpperCase()} onClick={confirmDelete}><Trash2 size={15}/>{tx('Οριστική διαγραφή','Delete permanently')}</Button>}><div className="destructive-warning"><Trash2 size={20}/><div><strong>{tx('Θα διαγραφούν το Demo, ο απομονωμένος οργανισμός και όλα τα δεδομένα του.','The Demo, isolated organization, and all related data will be deleted.')}</strong><span>{tx('Η ενέργεια είναι οριστική.','This action is permanent.')}</span></div></div><div className="platform-form-grid"><label className="field"><span>{tx('Πληκτρολόγησε τον κωδικό','Type the code')}: <b>{deleteCode}</b></span><input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} autoComplete="off"/></label><label className="field"><span>{tx('Κωδικός Platform Owner','Platform Owner password')}</span><input type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} autoComplete="new-password"/></label></div></ObserverDialog>}
  </>
}
