import { useEffect,useState } from 'react'
import { Building2,DatabaseZap,FlaskConical,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Trash2,X } from 'lucide-react'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { IconButton } from '../../design-system/IconButton'
import { Button } from '../../design-system/Button'
import { ManualDateField } from '../../design-system/ManualDateField'
import { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'
import { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { resetPlatformDemoData,resetPlatformDemoPassword,setPlatformDemoStatus } from '../../core/tenant/tenantService'
import { OrganizationDeleteDialog } from './OrganizationDeleteDialog'
import { DemoEvaluationPanel } from '../demo/DemoEvaluationPanel'
import { ConvertDemoDialog, DemoExtendControls } from './DemoLifecycleControls'
import { convertPlatformDemo, extendPlatformDemo } from './platformLifecycleService'
import { demoDatesValid,loadPlatformDemoRecord,savePlatformDemoRecord } from './platformDemoService'
const GREEK_REGIONS=['Ανατολική Μακεδονία και Θράκη','Κεντρική Μακεδονία','Δυτική Μακεδονία','Ήπειρος','Θεσσαλία','Ιόνια Νησιά','Δυτική Ελλάδα','Στερεά Ελλάδα','Αττική','Πελοπόννησος','Βόρειο Αιγαίο','Νότιο Αιγαίο','Κρήτη']
const HEALTH_REGIONS=['1η ΥΠΕ Αττικής','2η ΥΠΕ Πειραιώς και Αιγαίου','3η ΥΠΕ Μακεδονίας','4η ΥΠΕ Μακεδονίας και Θράκης','5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας','6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας','7η ΥΠΕ Κρήτης']
function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
function Action({icon,tone,label,title,onClick,disabled=false}){return <div className="platform-org-action-item"><IconButton tone={tone} label={title} disabled={disabled} onClick={onClick}>{icon}</IconButton><span>{label}</span></div>}
function FormSection({title,subtitle,actions,children}){return <section className="platform-form-section"><header><div><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div>{actions&&<div className="platform-form-section-actions">{actions}</div>}</header>{children}</section>}

export function PlatformDemoRecord({demo,language='el',onBack,onOpenDemo,onChanged,onConverted,onDeleted}){
  const [record,setRecord]=useState(demo)
  const [draft,setDraft]=useState(null)
  const [saving,setSaving]=useState(false)
  const [working,setWorking]=useState(false)
  const [deleteOpen,setDeleteOpen]=useState(false)
  const [editing,setEditing]=useState(false)
  const [interested,setInterested]=useState(false)
  const [convertOpen,setConvertOpen]=useState(false)
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
  const datesValid=demoDatesValid(draft.validFrom,draft.validUntil)
  const canSave=Boolean(draft.label.trim()&&draft.contactEmail.trim()&&datesValid)

  async function saveEdit(){if(!canSave||saving)return;setSaving(true);try{const next=await savePlatformDemoRecord(record,draft);setRecord(next);setDraft(toDraft(next));setEditing(false);onChanged?.(next);notify(tx('Η καρτέλα Demo ενημερώθηκε.','Demo record updated.'),'success',{operation:'platform_demo_update'})}catch(error){notifyError(error,'save',{operation:'platform_demo_update'})}finally{setSaving(false)}}
  async function togglePause(){if(working)return;const next=record.status==='paused'?'active':'paused';const ok=await confirm({title:next==='paused'?tx('Παύση Demo','Pause Demo'):tx('Ενεργοποίηση Demo','Reactivate Demo'),message:next==='paused'?tx('Η πρόσβαση του Demo χρήστη θα απενεργοποιηθεί μέχρι να την ενεργοποιήσεις ξανά.','The Demo user will lose Demo access until you reactivate it.'):tx('Να ενεργοποιηθεί ξανά η πρόσβαση Demo;','Reactivate Demo access?'),confirmLabel:next==='paused'?tx('Παύση','Pause'):tx('Ενεργοποίηση','Reactivate')});if(!ok)return;setWorking(true);try{const updated=await setPlatformDemoStatus(record.id,next);const full=await loadPlatformDemoRecord(updated.id);setRecord(full);setDraft(toDraft(full));onChanged?.(full);notify(next==='paused'?tx('Το Demo τέθηκε σε παύση.','Demo paused.'):tx('Το Demo ενεργοποιήθηκε.','Demo reactivated.'),'success',{operation:'platform_demo_status'})}catch(error){notifyError(error,'action',{operation:'platform_demo_status'})}finally{setWorking(false)}}
  async function resetPassword(){if(working)return;const target=record.contact_email||tx('το καταχωρημένο email','the registered email address');const ok=await confirm({title:tx('Επαναφορά κωδικού Demo','Reset Demo password'),message:tx(`Θα αποσταλεί email ασφαλούς επαναφοράς κωδικού στο ${target}. Θέλεις να συνεχίσεις;`,`A secure password-reset email will be sent to ${target}. Continue?`),confirmLabel:tx('Αποστολή email','Send reset email')});if(!ok)return;setWorking(true);try{await resetPlatformDemoPassword(record);notify(tx('Στάλθηκε email επαναφοράς κωδικού στον Demo χρήστη.','Password reset email sent to the Demo user.'),'success',{operation:'platform_demo_reset_password'})}catch(error){notifyError(error,'action',{operation:'platform_demo_reset_password'})}finally{setWorking(false)}}
  // Demo → customer: one transaction that clears the synthetic data first.
  function convertToOrganization(){if(working||!record.organization_id)return;setConvertOpen(true)}
  async function submitConvert({name,code}){setWorking(true);try{if(canSave&&editing)await savePlatformDemoRecord(record,draft);const details={type:draft.type,region:draft.region,healthRegion:draft.healthRegion,city:draft.city,country:draft.country,contactEmail:draft.contactEmail,contactPhone:draft.contactPhone,bedCapacity:draft.bedCapacity===''||draft.bedCapacity==null?'':String(draft.bedCapacity)};const result=await convertPlatformDemo(record.organization_id,{name,code,details});setConvertOpen(false);notify(tx('Το Demo έγινε πραγματικός οργανισμός. Τα δεδομένα επίδειξης διαγράφηκαν.','The Demo is now a real organization. The demonstration data was deleted.'),'success',{operation:'platform_demo_convert'});const organization={id:result?.organizationId||record.organization_id,name,code};if(onConverted)await onConverted(organization);else window.location.assign(`/platform#organizations?organization=${organization.id}&tab=details`)}catch(error){notifyError(error,'action',{operation:'platform_demo_convert'})}finally{setWorking(false)}}
  async function extendDemo(validUntil){if(working)return;setWorking(true);try{await extendPlatformDemo(record.id,validUntil);const full=await loadPlatformDemoRecord(record.id);setRecord(full);setDraft(toDraft(full));onChanged?.(full);notify(tx(`Το Demo παρατάθηκε έως ${new Intl.DateTimeFormat('el-GR').format(new Date(`${validUntil}T12:00:00`))}.`,`The Demo was extended until ${new Intl.DateTimeFormat('en-GB').format(new Date(`${validUntil}T12:00:00`))}.`),'success',{operation:'platform_demo_extend'})}catch(error){notifyError(error,'save',{operation:'platform_demo_extend'})}finally{setWorking(false)}}
  async function resetData(){if(working||!record.organization_id)return;const ok=await confirm({title:tx('Επαναφορά δεδομένων Demo','Reset Demo data'),message:tx('Θα διαγραφούν όλα τα δεδομένα του Demo (και όσα πρόσθεσε ο αξιολογητής) και θα γραφτούν ξανά τα δεδομένα επίδειξης με σημερινές ημερομηνίες. Οι χρήστες και οι κωδικοί τους δεν αλλάζουν.','All Demo data (including what the evaluator added) will be deleted and the demonstration data written again with current dates. Users and their passwords stay the same.'),confirmLabel:tx('Επαναφορά δεδομένων','Reset data')});if(!ok)return;setWorking(true);try{const result=await resetPlatformDemoData(record.organization_id);notify(tx(`Τα δεδομένα του Demo γράφτηκαν: ${result?.patients??0} ασθενείς, ${result?.surveillanceCases??0} περιστατικά επιτήρησης, ${result?.laboratorySamples??0} δείγματα.`,`Demo data written: ${result?.patients??0} patients, ${result?.surveillanceCases??0} surveillance cases, ${result?.laboratorySamples??0} samples.`),'success',{operation:'platform_demo_reset_data'})}catch(error){notifyError(error,'action',{operation:'platform_demo_reset_data'})}finally{setWorking(false)}}
  function requestDelete(){setDeleteOpen(true)}
  function handleDeleted(){setDeleteOpen(false);if(onDeleted)onDeleted(record.id);else onBack?.()}

  const actions=<div className="platform-org-actions" aria-label={tx('Ενέργειες Demo','Demo actions')}>
    <Action icon={<LogIn size={18}/>} tone="primary" label={tx('Είσοδος','Enter')} title={tx('Είσοδος στο Demo','Open Demo')} onClick={onOpenDemo}/>
    <Action icon={<DatabaseZap size={17}/>} tone="neutral" label={tx('Δεδομένα','Data')} title={tx('Επαναφορά δεδομένων Demo','Reset Demo data')} disabled={working||!record.organization_id} onClick={resetData}/>
    <Action icon={<KeyRound size={17}/>} tone="neutral" label={tx('Κωδικός','Password')} title={tx('Επαναφορά κωδικού Demo χρήστη','Reset Demo user password')} disabled={working||!record.demo_user_id||!record.organization_id} onClick={resetPassword}/>
    <Action icon={record.status==='paused'?<PlayCircle size={17}/>:<PauseCircle size={17}/>} tone={record.status==='paused'?'success':'neutral'} label={record.status==='paused'?tx('Ενεργοποίηση','Reactivate'):tx('Παύση','Pause')} title={record.status==='paused'?tx('Ενεργοποίηση Demo','Reactivate Demo'):tx('Παύση Demo','Pause Demo')} disabled={working} onClick={togglePause}/>
    <Action icon={<Building2 size={17}/>} tone="success" label={tx('Σε οργανισμό','Convert')} title={tx('Μετατροπή Demo σε κανονικό οργανισμό','Convert Demo to production organization')} disabled={working||!record.organization_id} onClick={convertToOrganization}/>
    <Action icon={<Trash2 size={17}/>} tone="danger" label={tx('Διαγραφή','Delete')} title={tx('Οριστική διαγραφή Demo','Delete Demo permanently')} disabled={working||!record.organization_id||!deleteCode} onClick={requestDelete}/>
  </div>

  return <>
    <EntityRecordShell className="platform-owner-record-shell platform-demo-record-workspace" avatar={<FlaskConical size={20}/>} eyebrow={tx('ΚΑΡΤΕΛΑ DEMO','DEMO RECORD')} title={draft.label||org?.name||record.label} subtitle={tx('Πλήρης επεξεργάσιμη καρτέλα Demo με τα ίδια βασικά στοιχεία της δημιουργίας.','Full editable Demo record with the same core fields as creation.')} status={<span className={`status-badge ${active?'active':status==='paused'?'temporary':'danger'}`}>{statusLabel}</span>} headerActions={actions} onBack={onBack} backLabel={tx('Πίσω','Back')}>
      <div className="platform-owner-details platform-demo-record-form">
        <div className="platform-demo-record-status"><span className="platform-demo-icon"><FlaskConical size={20}/></span><div><strong>{statusLabel}{interested&&<span className="demo-interest-badge">{tx('Θέλει την εφαρμογή','Wants the application')}</span>}</strong><span>{active?`${remaining} ${tx('ημέρες υπόλοιπο','days remaining')}`:status==='paused'?tx('Η πρόσβαση έχει τεθεί σε παύση.','Access is paused.'):tx('Η πρόσβαση δεν είναι ενεργή.','Access is not active.')}</span></div></div>
        <DemoExtendControls validUntil={record.valid_until} language={language} working={working} onExtend={extendDemo}/>
        <div className={`platform-record-edit-fieldset ${editing?'is-editing':'is-locked'}`}><div className="platform-form-shell">
          <FormSection title={tx('Ταυτότητα Demo οργανισμού','Demo organization identity')} subtitle={tx('Τα στοιχεία αυτά ανήκουν στον απομονωμένο Demo οργανισμό.','These details belong to the isolated Demo organization.')} actions={editing?<><Button variant="secondary" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveEdit} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone="edit" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}>
            <div className="platform-form-grid"><label className="field field-wide"><span>{tx('Επωνυμία οργανισμού / υποψήφιος πελάτης','Organization / Prospect name')} *</span><input value={draft.label} readOnly={!editing} onChange={e=>setDraft(x=>({...x,label:e.target.value}))}/></label><label className="field"><span>{tx('Τύπος','Type')}</span><select value={draft.type} disabled={!editing} onChange={e=>setDraft(x=>({...x,type:e.target.value}))}><option value="hospital">{tx('Νοσοκομείο','Hospital')}</option><option value="clinic">{tx('Κλινική','Clinic')}</option><option value="group">{tx('Όμιλος','Group')}</option><option value="other">{tx('Άλλο','Other')}</option></select></label></div>
          </FormSection>
          <FormSection title={tx('Τοποθεσία & λειτουργία','Location & operations')}>
            <div className="platform-form-grid"><label className="field"><span>{tx('Περιφέρεια','Region')}</span><select value={draft.region} disabled={!editing} onChange={e=>setDraft(x=>({...x,region:e.target.value}))}><option value="">{tx('Επιλογή…','Select…')}</option>{GREEK_REGIONS.map(region=><option key={region}>{region}</option>)}</select></label><label className="field field-wide"><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')}</span><select value={draft.healthRegion} disabled={!editing} onChange={e=>setDraft(x=>({...x,healthRegion:e.target.value}))}><option value="">{tx('Επιλογή…','Select…')}</option>{HEALTH_REGIONS.map(region=><option key={region}>{region}</option>)}</select></label><LocationAutocompleteField label={tx('Πόλη','City')} value={draft.city} onChange={value=>setDraft(x=>({...x,city:value}))} options={CITY_OPTIONS} disabled={!editing}/><LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setDraft(x=>({...x,country:value}))} options={COUNTRY_OPTIONS} disabled={!editing}/><label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={draft.contactPhone} readOnly={!editing} onChange={e=>setDraft(x=>({...x,contactPhone:e.target.value}))}/></label><label className="field"><span>{tx('Δυναμικότητα κλινών','Bed capacity')}</span><input type="number" min="0" value={draft.bedCapacity} readOnly={!editing} onChange={e=>setDraft(x=>({...x,bedCapacity:e.target.value}))}/></label></div>
          </FormSection>
          <FormSection title={tx('Υπεύθυνος Demo & πρόσβαση','Demo contact & access')}>
            <div className="platform-demo-access-grid"><label className="field field-wide"><span>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</span><input value={draft.contactName} readOnly={!editing} onChange={e=>setDraft(x=>({...x,contactName:e.target.value}))}/></label><label className="field field-wide"><span>{tx('Email πρόσκλησης','Invitation email')} *</span><input type="email" value={draft.contactEmail} readOnly={!editing} onChange={e=>setDraft(x=>({...x,contactEmail:e.target.value}))}/></label><ManualDateField label={tx('Έναρξη','Start')} value={draft.validFrom} onChange={value=>setDraft(x=>({...x,validFrom:value}))} disabled={!editing}/><ManualDateField label={`${tx('Λήξη','End')} *`} value={draft.validUntil} onChange={value=>setDraft(x=>({...x,validUntil:value}))} disabled={!editing}/></div>{editing&&draft.validFrom&&draft.validUntil&&!datesValid&&<p className="field-error platform-demo-dates-error" role="alert">{tx('Η λήξη πρέπει να είναι μετά την έναρξη.','The end date must be after the start date.')}</p>}
          </FormSection>
        </div></div>
        <DemoEvaluationPanel organizationId={record.organization_id} language={language} onInterestChange={setInterested}/>
      </div>
    </EntityRecordShell>

    {convertOpen&&<ConvertDemoDialog language={language} defaultName={draft.label||org?.name||''} working={working} onConvert={submitConvert} onClose={()=>setConvertOpen(false)}/>}
    {deleteOpen&&<OrganizationDeleteDialog organizations={[{id:record.organization_id,name:org?.name||record.label,code:deleteCode,is_demo:true}]} language={language} onClose={()=>setDeleteOpen(false)} onDeleted={handleDeleted}/>}
  </>
}
