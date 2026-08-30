import { useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Building2, CheckCircle2, Copy, FlaskConical, Settings, ShieldCheck, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createOrganizationUser, createPlatformOrganization, deletePlatformOrganization } from '../../core/tenant/tenantService'

const emptyOrganization = { name:'', code:'', type:'hospital', status:'active', adminFullName:'' }

export function PlatformCenterPage(){
  const {memberships,setTenantByMembership,reloadMemberships}=useTenant()
  const {language}=useLanguage()
  const {notify}=useFeedback()
  const nav=useNavigate()
  const location=useLocation()
  const en=language==='en'
  const [createOpen,setCreateOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState(emptyOrganization)
  const [formError,setFormError]=useState('')
  const [credentials,setCredentials]=useState(null)

  const sections=[
    ['organizations',Building2,en?'Organizations / Hospitals':'Οργανισμοί / Νοσοκομεία',en?'Create, activate and enter an organization.':'Δημιουργία, ενεργοποίηση και είσοδος σε οργανισμό.'],
    ['users',Users,en?'Users & Hospital Admins':'Χρήστες & Hospital Admins',en?'Platform-level user and administrator management.':'Κεντρική διαχείριση χρηστών και διαχειριστών.'],
    ['demo',FlaskConical,'Demo',en?'Issue demo access or open the demo environment.':'Ενεργοποίηση Demo για τρίτους ή είσοδος στο Demo περιβάλλον.'],
    ['reports',BarChart3,en?'Global Reports':'Αναφορές',en?'Cross-organization analytics and comparisons.':'Συγκεντρωτικές αναφορές και συγκρίσεις οργανισμών.'],
    ['governance',ShieldCheck,en?'Audit & Governance':'Audit & Governance',en?'Platform audit trail, entitlements and security.':'Audit trail πλατφόρμας, entitlements και ασφάλεια.'],
    ['settings',Settings,en?'Platform Settings':'Ρυθμίσεις Πλατφόρμας',en?'Global platform configuration.':'Κεντρικές ρυθμίσεις της πλατφόρμας.'],
  ]
  const activeKey=(location.hash||'').replace('#','')
  const active=sections.find(([key])=>key===activeKey)
  const openSection=key=>nav(`/platform#${key}`)
  const goHome=()=>nav('/platform')
  const setField=(key,value)=>setDraft(current=>({...current,[key]:value}))
  const codeValid=/^[A-Z0-9_-]{2,24}$/.test(draft.code.trim().toUpperCase())
  const formValid=Boolean(draft.name.trim()&&codeValid&&draft.adminFullName.trim())
  const typeLabel=useMemo(()=>({hospital:en?'Hospital':'Νοσοκομείο',clinic:en?'Clinic':'Κλινική',group:en?'Group':'Όμιλος',other:en?'Other':'Άλλο'}),[en])
  const statusLabel=useMemo(()=>({active:en?'Active':'Ενεργός',suspended:en?'Suspended':'Σε αναστολή',archived:en?'Archived':'Αρχειοθετημένος'}),[en])

  function openCreate(){
    setDraft(emptyOrganization)
    setFormError('')
    setCreateOpen(true)
  }

  async function submitOrganization(){
    if(!formValid||saving)return
    setSaving(true);setFormError('')
    let created=null
    try{
      created=await createPlatformOrganization({name:draft.name,code:draft.code,type:draft.type,status:draft.status})
      const admin=await createOrganizationUser({organizationId:created.id,fullName:draft.adminFullName,role:'hospital_admin'})
      await reloadMemberships()
      setCreateOpen(false)
      setCredentials({organization:created,adminName:draft.adminFullName,username:admin?.username||'',temporaryPassword:admin?.temporaryPassword||''})
      notify(en?'Organization and Hospital Admin created.':'Ο οργανισμός και ο Hospital Admin δημιουργήθηκαν.','success')
    }catch(error){
      if(created?.id){
        try{await deletePlatformOrganization(created.id)}catch{/* keep original error */}
        try{await reloadMemberships()}catch{/* non-blocking */}
      }
      const message=String(error?.message||error||'')
      const duplicate=/duplicate|unique/i.test(message)
      const friendly=duplicate
        ? (en?'This organization code is already in use.':'Ο κωδικός οργανισμού χρησιμοποιείται ήδη.')
        : (en?'The organization could not be created. Check Supabase/Edge Function configuration and try again.':'Δεν ολοκληρώθηκε η δημιουργία. Έλεγξε τη ρύθμιση Supabase/Edge Function και δοκίμασε ξανά.')
      setFormError(friendly)
      notify(friendly,'danger')
    }finally{setSaving(false)}
  }

  async function copyText(text,label){
    if(!text)return
    try{await navigator.clipboard.writeText(text);notify(en?`${label} copied.`:`Αντιγράφηκε: ${label}.`,'success')}catch{notify(en?'Copy failed.':'Η αντιγραφή απέτυχε.','warning')}
  }

  const createDialog=createOpen?<ObserverDialog
    width="wide"
    eyebrow={en?'Platform Owner':'Platform Owner'}
    title={en?'New organization':'Νέος οργανισμός'}
    subtitle={en?'Create the hospital and its initial Hospital Admin.':'Δημιούργησε το νοσοκομείο και τον αρχικό Hospital Admin.'}
    onClose={()=>!saving&&setCreateOpen(false)}
    footer={<><Button variant="secondary" onClick={()=>setCreateOpen(false)} disabled={saving}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} savingLabel={en?'Saving…':'Αποθήκευση…'} disabled={!formValid} onClick={submitOrganization}>{en?'Save':'Αποθήκευση'}</SaveButton></>}
  >
    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>{en?'Organization details':'Στοιχεία οργανισμού'}</strong><span>{en?'Core identity used across the platform and audit trail.':'Βασική ταυτότητα που χρησιμοποιείται σε όλη την πλατφόρμα και στο audit trail.'}</span></div></div>
      <div className="entry-grid compact">
        <label className="field"><span>{en?'Organization name *':'Επωνυμία οργανισμού *'}</span><input autoFocus value={draft.name} onChange={e=>setField('name',e.target.value)} placeholder={en?'e.g. General Hospital':'π.χ. Γενικό Νοσοκομείο'}/></label>
        <label className="field"><span>{en?'Organization code *':'Κωδικός οργανισμού *'}</span><input value={draft.code} onChange={e=>setField('code',e.target.value.toUpperCase().replace(/\s+/g,'-'))} placeholder="HOSP-001" maxLength={24}/><small className={draft.code&&!codeValid?'field-error':'field-hint'}>{en?'2–24 characters: A–Z, 0–9, - or _.':'2–24 χαρακτήρες: A–Z, 0–9, - ή _.'}</small></label>
        <label className="field"><span>{en?'Type':'Τύπος'}</span><select value={draft.type} onChange={e=>setField('type',e.target.value)}><option value="hospital">{typeLabel.hospital}</option><option value="clinic">{typeLabel.clinic}</option><option value="group">{typeLabel.group}</option><option value="other">{typeLabel.other}</option></select></label>
        <label className="field"><span>{en?'Initial status':'Αρχική κατάσταση'}</span><select value={draft.status} onChange={e=>setField('status',e.target.value)}><option value="active">{statusLabel.active}</option><option value="suspended">{statusLabel.suspended}</option></select></label>
      </div>
    </div>
    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>{en?'Initial Hospital Admin':'Αρχικός Hospital Admin'}</strong><span>{en?'A dedicated account will be created with a generated username and temporary password.':'Θα δημιουργηθεί ξεχωριστός λογαριασμός με αυτόματο όνομα χρήστη και προσωρινό κωδικό.'}</span></div></div>
      <div className="entry-grid compact">
        <label className="field"><span>{en?'Full name *':'Ονοματεπώνυμο *'}</span><input value={draft.adminFullName} onChange={e=>setField('adminFullName',e.target.value)} placeholder={en?'Hospital administrator':'Διαχειριστής νοσοκομείου'}/></label>
        <label className="field"><span>{en?'Role':'Ρόλος'}</span><input value="Hospital Admin" disabled/></label>
      </div>
      <div className="platform-form-note"><ShieldCheck size={17}/><span>{en?'The Platform Owner remains outside the hospital membership model and retains full platform control.':'Ο Platform Owner παραμένει εκτός του membership του νοσοκομείου και διατηρεί πλήρη έλεγχο της πλατφόρμας.'}</span></div>
    </div>
    {formError&&<div className="platform-form-error" role="alert">{formError}</div>}
  </ObserverDialog>:null

  const credentialDialog=credentials?<ObserverDialog
    width="standard"
    eyebrow={en?'Account created':'Ο λογαριασμός δημιουργήθηκε'}
    title={en?'Hospital Admin credentials':'Στοιχεία σύνδεσης Hospital Admin'}
    subtitle={credentials.organization.name}
    onClose={()=>setCredentials(null)}
    footer={<Button variant="primary" onClick={()=>setCredentials(null)}>{en?'Done':'Ολοκλήρωση'}</Button>}
  >
    <div className="platform-success-panel"><CheckCircle2 size={22}/><div><strong>{en?'Organization ready':'Ο οργανισμός είναι έτοιμος'}</strong><span>{en?'Give these temporary credentials securely to the Hospital Admin.':'Παράδωσε με ασφαλή τρόπο τα προσωρινά στοιχεία στον Hospital Admin.'}</span></div></div>
    <div className="platform-credential-list">
      <div><span>{en?'Administrator':'Διαχειριστής'}</span><strong>{credentials.adminName}</strong></div>
      <div><span>{en?'Username':'Όνομα χρήστη'}</span><strong>{credentials.username||'—'}</strong><button type="button" onClick={()=>copyText(credentials.username,en?'Username':'Όνομα χρήστη')}><Copy size={15}/></button></div>
      <div><span>{en?'Temporary password':'Προσωρινός κωδικός'}</span><strong>{credentials.temporaryPassword||'—'}</strong><button type="button" onClick={()=>copyText(credentials.temporaryPassword,en?'Temporary password':'Προσωρινός κωδικός')}><Copy size={15}/></button></div>
    </div>
    <div className="platform-form-note platform-form-note-warning"><ShieldCheck size={17}/><span>{en?'The temporary password is shown only in this confirmation. Store or deliver it before closing.':'Ο προσωρινός κωδικός εμφανίζεται μόνο σε αυτή την επιβεβαίωση. Αποθήκευσέ τον ή παράδωσέ τον πριν κλείσεις.'}</span></div>
  </ObserverDialog>:null

  if(!active)return <><Page title={en?'Platform Center':'Κέντρο Πλατφόρμας'} subtitle={en?'Choose where you want to work.':'Επίλεξε πού θέλεις να εργαστείς.'}>
    <div className="platform-center-grid platform-center-grid-home">{sections.map(([key,Icon,title,desc])=><button key={key} className="platform-center-card" onClick={()=>openSection(key)}><span><Icon size={20}/></span><strong>{title}</strong><small>{desc}</small></button>)}</div>
  </Page>{createDialog}{credentialDialog}</>

  const [key,Icon,title,desc]=active
  return <><Page title={title} subtitle={desc}>
    <div className="platform-workspace-toolbar"><button type="button" className="platform-back-button" onClick={goHome}><ArrowLeft size={16}/>{en?'Platform Center':'Κέντρο Πλατφόρμας'}</button></div>
    {key==='organizations'?<section className="platform-center-section platform-workspace-section"><div className="platform-section-heading"><div><h2>{title}</h2><p>{en?'Select an organization to enter the full hospital application with Platform Owner rights.':'Επίλεξε οργανισμό για να μπεις στην πλήρη εφαρμογή του νοσοκομείου με δικαιώματα Platform Owner.'}</p></div><Button variant="primary" onClick={openCreate}>+ {en?'New organization':'Νέος οργανισμός'}</Button></div>{memberships.length?<div className="platform-org-list">{memberships.map(m=><button key={m.id} className="platform-org-row" onClick={()=>{setTenantByMembership(m.id);nav('/')}}><span><strong>{m.organization.name}</strong><small>{m.organization.code||'—'} · {typeLabel[m.organization.type]||m.organization.type||'—'} · {statusLabel[m.organization.status]||m.organization.status||'—'}</small></span><b>{en?'Open organization':'Άνοιγμα οργανισμού'} →</b></button>)}</div>:<div className="empty-state platform-empty"><strong>{en?'No organizations yet':'Δεν υπάρχουν ακόμη οργανισμοί'}</strong><span>{en?'Create the first hospital from here.':'Δημιούργησε από εδώ το πρώτο νοσοκομείο.'}</span></div>}</section>:
    <section className="platform-center-section platform-workspace-section platform-coming"><Icon size={20}/><div><h2>{title}</h2><p>{desc}</p><small>{en?'This workspace will be implemented in the next step.':'Η συγκεκριμένη περιοχή θα υλοποιηθεί στο επόμενο βήμα.'}</small></div></section>}
  </Page>{createDialog}{credentialDialog}</>
}
