import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Building2, Clock3, FlaskConical, PauseCircle, PlayCircle, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { createOrganizationUser, createPlatformOrganization, deletePlatformOrganization, listPlatformDemos, listPlatformOrganizationMembers, setPlatformOrganizationStatus } from '../../core/tenant/tenantService'

const GREEK_REGIONS=['Ανατολική Μακεδονία και Θράκη','Κεντρική Μακεδονία','Δυτική Μακεδονία','Ήπειρος','Θεσσαλία','Ιόνια Νησιά','Δυτική Ελλάδα','Στερεά Ελλάδα','Αττική','Πελοπόννησος','Βόρειο Αιγαίο','Νότιο Αιγαίο','Κρήτη']
const HEALTH_REGIONS=['1η ΥΠΕ Αττικής','2η ΥΠΕ Πειραιώς και Αιγαίου','3η ΥΠΕ Μακεδονίας','4η ΥΠΕ Μακεδονίας και Θράκης','5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας','6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας','7η ΥΠΕ Κρήτης']
const emptyOrganization={name:'',code:'',type:'hospital',status:'active',region:'',healthRegion:'',city:'',country:'Greece',contactEmail:'',contactPhone:'',bedCapacity:'',adminFullName:'',adminEmail:''}

function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
function demoProgress(item){const total=Math.max(1,daysBetween(item.valid_from,item.valid_until));const remaining=daysBetween(new Date().toISOString().slice(0,10),item.valid_until);return {remaining,pct:Math.max(0,Math.min(100,Math.round((remaining/total)*100)))}}

export function PlatformCenterPage(){
  const {memberships,setTenantByMembership,reloadMemberships}=useTenant()
  const {language}=useLanguage(); const {notify,confirm}=useFeedback(); const nav=useNavigate(); const location=useLocation(); const en=language==='en'
  const [createOpen,setCreateOpen]=useState(false); const [saving,setSaving]=useState(false); const [draft,setDraft]=useState(emptyOrganization); const [formError,setFormError]=useState('')
  const [members,setMembers]=useState([]); const [demos,setDemos]=useState([]); const [loadingStats,setLoadingStats]=useState(true); const [selectedOrg,setSelectedOrg]=useState(null)
  const activeKey=(location.hash||'').replace('#','')
  const organizations=memberships.map(m=>m.organization).filter(Boolean)
  const activeOrganizations=organizations.filter(o=>o.status==='active').length
  const activeDemos=demos.filter(d=>d.status==='active'&&daysBetween(new Date().toISOString().slice(0,10),d.valid_until)>0)
  const expiringDemos=activeDemos.filter(d=>demoProgress(d).remaining<=14)

  async function refreshPlatformData(){
    setLoadingStats(true)
    try{const [m,d]=await Promise.all([listPlatformOrganizationMembers(),listPlatformDemos()]);setMembers(m);setDemos(d)}catch(error){console.warn(error)}finally{setLoadingStats(false)}
  }
  useEffect(()=>{refreshPlatformData()},[memberships.length])
  const memberCountByOrg=useMemo(()=>members.reduce((acc,m)=>{acc[m.organization_id]=(acc[m.organization_id]||0)+1;return acc},{}),[members])
  const setField=(key,value)=>setDraft(current=>({...current,[key]:value}))
  const codeValid=/^[A-Z0-9_-]{2,24}$/.test(draft.code.trim().toUpperCase())
  const emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.adminEmail.trim())
  const formValid=Boolean(draft.name.trim()&&codeValid&&draft.region&&draft.healthRegion&&draft.city.trim()&&draft.adminFullName.trim()&&emailValid)
  const openCreate=()=>{setDraft(emptyOrganization);setFormError('');setCreateOpen(true)}

  async function submitOrganization(){
    if(!formValid||saving)return
    setSaving(true);setFormError('')
    try{
      const created=await createPlatformOrganization(draft)
      await reloadMemberships(); await refreshPlatformData()
      setCreateOpen(false)
      notify(en?'Organization saved.':'Ο οργανισμός αποθηκεύτηκε.','success')
      try{
        const invitation=await createOrganizationUser({organizationId:created.id,fullName:draft.adminFullName,role:'hospital_admin',email:draft.adminEmail})
        notify(invitation?.emailSent?(en?'Hospital Admin invitation email sent.':'Το email πρόσκλησης του Hospital Admin στάλθηκε.'):(en?'Hospital Admin invitation created, but email delivery is not configured yet.':'Η πρόσκληση Hospital Admin δημιουργήθηκε, αλλά δεν έχει ρυθμιστεί ακόμη η αποστολή email.'),invitation?.emailSent?'success':'warning')
      }catch(inviteError){
        notify(en?'Organization saved, but the Admin invitation could not be sent. You can retry from the organization users.':'Ο οργανισμός αποθηκεύτηκε, αλλά η πρόσκληση Admin δεν στάλθηκε. Μπορείς να την επαναλάβεις από τους χρήστες του οργανισμού.','warning')
      }
    }catch(error){
      const msg=String(error?.message||error||''); const duplicate=/duplicate|unique/i.test(msg)
      const friendly=duplicate?(en?'This organization code already exists.':'Ο κωδικός οργανισμού χρησιμοποιείται ήδη.'):(en?'Organization could not be saved. Apply the v0.27.14 platform migration and retry.':'Δεν αποθηκεύτηκε ο οργανισμός. Εφάρμοσε το migration v0.27.14 της πλατφόρμας και δοκίμασε ξανά.')
      setFormError(friendly);notify(friendly,'danger')
    }finally{setSaving(false)}
  }

  async function togglePause(org){
    const next=org.status==='suspended'?'active':'suspended'; const ok=await confirm({title:next==='suspended'?'Παύση οργανισμού':'Επανενεργοποίηση οργανισμού',message:next==='suspended'?`Να τεθεί σε παύση ο οργανισμός «${org.name}»;`:`Να ενεργοποιηθεί ξανά ο οργανισμός «${org.name}»;`,confirmLabel:next==='suspended'?'Παύση':'Ενεργοποίηση'})
    if(!ok)return
    try{await setPlatformOrganizationStatus(org.id,next);await reloadMemberships();notify('Η κατάσταση του οργανισμού ενημερώθηκε.','success')}catch{notify('Η αλλαγή κατάστασης απέτυχε.','danger')}
  }
  async function removeOrganization(org){
    const ok=await confirm({title:'Πλήρης διαγραφή οργανισμού',message:`ΠΡΟΣΟΧΗ: Θα διαγραφεί ο οργανισμός «${org.name}» και τα δεδομένα που συνδέονται με αυτόν. Η ενέργεια δεν αναιρείται.`,confirmLabel:'Οριστική διαγραφή'})
    if(!ok)return
    try{await deletePlatformOrganization(org.id);await reloadMemberships();await refreshPlatformData();setSelectedOrg(null);notify('Ο οργανισμός διαγράφηκε.','success')}catch{notify('Η πλήρης διαγραφή απέτυχε. Για διαγραφή και των Auth χρηστών απαιτείται το Platform purge Edge Function.','danger')}
  }
  function enterOrganization(org){const membership=memberships.find(m=>m.organization?.id===org.id);if(membership){setTenantByMembership(membership.id);nav('/')}}

  const createDialog=createOpen?<ObserverDialog width="wide" eyebrow="Platform Owner" title={en?'New organization':'Νέος οργανισμός'} subtitle={en?'Organization identity and initial Hospital Admin invitation.':'Στοιχεία οργανισμού και πρόσκληση αρχικού Hospital Admin.'} onClose={()=>!saving&&setCreateOpen(false)} footer={<><Button variant="secondary" onClick={()=>setCreateOpen(false)} disabled={saving}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={saving} savingLabel={en?'Saving…':'Αποθήκευση…'} disabled={!formValid} onClick={submitOrganization}>{en?'Save organization':'Αποθήκευση οργανισμού'}</SaveButton></>}>
    <div className="observer-form-section"><div className="observer-form-section-title"><div><strong>Στοιχεία οργανισμού</strong><span>Τα στοιχεία αυτά χρησιμοποιούνται σε αναλύσεις, φίλτρα, reports και audit.</span></div></div>
      <div className="entry-grid compact">
        <label className="field"><span>Επωνυμία *</span><input autoFocus value={draft.name} onChange={e=>setField('name',e.target.value)} /></label>
        <label className="field"><span>Κωδικός / Hospital Prefix *</span><input value={draft.code} onChange={e=>setField('code',e.target.value.toUpperCase().replace(/\s+/g,'-'))} placeholder="HOSPITAL1" maxLength={24}/><small className={draft.code&&!codeValid?'field-error':'field-hint'}>2–24 χαρακτήρες: A–Z, 0–9, - ή _.</small></label>
        <label className="field"><span>Τύπος</span><select value={draft.type} onChange={e=>setField('type',e.target.value)}><option value="hospital">Νοσοκομείο</option><option value="clinic">Κλινική</option><option value="group">Όμιλος</option><option value="other">Άλλο</option></select></label>
        <label className="field"><span>Κατάσταση</span><select value={draft.status} onChange={e=>setField('status',e.target.value)}><option value="active">Ενεργός</option><option value="suspended">Σε παύση</option></select></label>
        <label className="field"><span>Περιφέρεια *</span><select value={draft.region} onChange={e=>setField('region',e.target.value)}><option value="">Επιλογή…</option>{GREEK_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>Υγειονομική Περιφέρεια (ΥΠΕ) *</span><select value={draft.healthRegion} onChange={e=>setField('healthRegion',e.target.value)}><option value="">Επιλογή…</option>{HEALTH_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>Πόλη *</span><input value={draft.city} onChange={e=>setField('city',e.target.value)}/></label>
        <label className="field"><span>Χώρα</span><input value={draft.country} onChange={e=>setField('country',e.target.value)}/></label>
        <label className="field"><span>Κεντρικό email</span><input type="email" value={draft.contactEmail} onChange={e=>setField('contactEmail',e.target.value)}/></label>
        <label className="field"><span>Τηλέφωνο</span><input value={draft.contactPhone} onChange={e=>setField('contactPhone',e.target.value)}/></label>
        <label className="field"><span>Δυναμικότητα κλινών</span><input type="number" min="0" value={draft.bedCapacity} onChange={e=>setField('bedCapacity',e.target.value)}/></label>
      </div>
    </div>
    <div className="observer-form-section"><div className="observer-form-section-title"><div><strong>Αρχικός Hospital Admin</strong><span>Το username θα δημιουργηθεί αυτόματα. Ο χρήστης θα λάβει πρόσκληση στο προσωπικό email του και θα ορίσει ο ίδιος κωδικό.</span></div></div>
      <div className="entry-grid compact"><label className="field"><span>Ονοματεπώνυμο *</span><input value={draft.adminFullName} onChange={e=>setField('adminFullName',e.target.value)}/></label><label className="field"><span>Email πρόσκλησης *</span><input type="email" value={draft.adminEmail} onChange={e=>setField('adminEmail',e.target.value)}/><small className={draft.adminEmail&&!emailValid?'field-error':'field-hint'}>Χρησιμοποιείται μόνο για την ασφαλή πρόσκληση/ενεργοποίηση.</small></label></div>
    </div>{formError&&<div className="platform-form-error" role="alert">{formError}</div>}
  </ObserverDialog>:null

  if(!activeKey)return <><Page title="Dashboard Πλατφόρμας" subtitle="Συνολική εικόνα του Limoxis Observer και των οργανισμών του.">
    <div className="kpi-grid platform-kpi-grid"><article className="kpi-card"><span>Σύνολο οργανισμών</span><strong>{organizations.length}</strong><small>{activeOrganizations} ενεργοί</small></article><article className="kpi-card"><span>Σύνολο χρηστών</span><strong>{loadingStats?'—':members.length}</strong><small>σε όλους τους οργανισμούς</small></article><article className="kpi-card"><span>Ενεργά Demo</span><strong>{loadingStats?'—':activeDemos.length}</strong><small>{expiringDemos.length} λήγουν ≤14 ημέρες</small></article></div>
    <section className="platform-center-section"><div className="platform-section-heading"><div><h2>Demo που βρίσκονται σε εξέλιξη</h2><p>Παρακολούθηση διάρκειας και έγκαιρη ειδοποίηση πριν τη λήξη.</p></div></div>{activeDemos.length?<div className="platform-demo-list">{activeDemos.map(d=>{const p=demoProgress(d);return <div className="platform-demo-row" key={d.id}><div><strong>{d.organization?.name||d.label}</strong><small>{d.contact_name||d.contact_email||'Demo access'} · έως {new Date(d.valid_until).toLocaleDateString('el-GR')}</small></div><div className="platform-demo-progress"><div><span style={{width:`${p.pct}%`}}/></div><small className={p.remaining<=14?'warning':''}>{p.remaining} ημέρες υπόλοιπο</small></div></div>})}</div>:<div className="empty-state platform-empty"><Clock3 size={22}/><strong>Δεν υπάρχουν ενεργά Demo</strong><span>Τα Demo που ενεργοποιείς θα εμφανίζονται εδώ με χρόνο μέχρι τη λήξη.</span></div>}</section>
  </Page>{createDialog}</>

  if(activeKey==='organizations')return <><Page title="Οργανισμοί" subtitle="Διαχείριση οργανισμών, χρηστών, πρόσβασης και ανάλυσης."><div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={()=>nav('/platform')}><ArrowLeft size={16}/>Dashboard</button></div><section className="platform-center-section"><div className="platform-section-heading"><div><h2>Οργανισμοί / Νοσοκομεία</h2><p>Άνοιξε έναν οργανισμό για παρεμβάσεις ή μπες στην εφαρμογή του ως Platform Owner.</p></div><Button onClick={openCreate}>+ Νέος οργανισμός</Button></div>{organizations.length?<div className="platform-org-list">{organizations.map(org=><div key={org.id} className={`platform-org-row platform-org-row-actions ${selectedOrg?.id===org.id?'selected':''}`}><button className="platform-org-main" onClick={()=>setSelectedOrg(selectedOrg?.id===org.id?null:org)}><span><strong>{org.name}</strong><small>{org.code} · {org.city||'—'} · {org.region||'—'} · {org.status==='active'?'Ενεργός':'Σε παύση'} · {memberCountByOrg[org.id]||0} χρήστες</small></span></button><div className="platform-org-actions"><Button variant="secondary" onClick={()=>enterOrganization(org)}>Είσοδος</Button><button className="icon-button" title={org.status==='suspended'?'Ενεργοποίηση':'Παύση'} onClick={()=>togglePause(org)}>{org.status==='suspended'?<PlayCircle size={17}/>:<PauseCircle size={17}/>}</button><button className="icon-button danger" title="Οριστική διαγραφή" onClick={()=>removeOrganization(org)}><Trash2 size={17}/></button></div>{selectedOrg?.id===org.id&&<div className="platform-org-detail"><div><span>ΥΠΕ</span><strong>{org.health_region||'—'}</strong></div><div><span>Χρήστες</span><strong>{memberCountByOrg[org.id]||0}</strong></div><div><span>Κλίνες</span><strong>{org.bed_capacity||'—'}</strong></div><div className="platform-org-detail-actions"><Button variant="secondary" onClick={()=>nav(`/platform#reports?organization=${org.id}`)}><BarChart3 size={15}/> Ανάλυση / Report</Button></div></div>}</div>)}</div>:<div className="empty-state platform-empty"><Building2 size={22}/><strong>Δεν υπάρχουν οργανισμοί</strong><span>Δημιούργησε τον πρώτο οργανισμό.</span></div>}</section></Page>{createDialog}</>

  if(activeKey==='demo')return <Page title="Demo" subtitle="Άνοιγμα Demo για δική σου παρουσίαση και διαχείριση ενεργών Demo προσβάσεων."><div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={()=>nav('/platform')}><ArrowLeft size={16}/>Dashboard</button></div><section className="platform-center-section platform-coming"><FlaskConical size={22}/><div><h2>Demo περιβάλλον</h2><p>Εδώ θα ανοίγεις άμεσα το ασφαλές Demo και θα δημιουργείς/παύεις Demo προσβάσεις με ημερομηνία λήξης.</p></div></section></Page>

  return <Page title="Ανάλυση" subtitle="Συγκεντρωτικά reports και συγκρίσεις με φίλτρα οργανισμού, περιφέρειας και χρονικής περιόδου."><div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={()=>nav('/platform')}><ArrowLeft size={16}/>Dashboard</button></div><section className="platform-center-section"><div className="platform-section-heading"><div><h2>Global Reports & Analytics</h2><p>Η ίδια report εμπειρία που θα βλέπουν Hospital Admin και Υπεύθυνος Λοιμώξεων, με επιπλέον platform φίλτρα.</p></div></div><div className="entry-grid compact platform-report-filters"><label className="field"><span>Οργανισμός</span><select><option>Όλοι οι οργανισμοί</option>{organizations.map(o=><option key={o.id}>{o.name}</option>)}</select></label><label className="field"><span>Περιφέρεια</span><select><option>Όλες οι περιφέρειες</option>{GREEK_REGIONS.map(r=><option key={r}>{r}</option>)}</select></label><label className="field"><span>Περίοδος</span><select><option>Τρέχον έτος</option><option>Μήνας</option><option>Τρίμηνο</option><option>Εξάμηνο</option><option>Έτος</option><option>Σύγκριση ετών</option></select></label></div><div className="platform-analysis-categories">{['Επιτήρηση','Εργαστήριο','Πρόληψη','Υγιεινή Χεριών','AMR / Αντιμικροβιακά','Έλεγχοι','Ποιότητα','Εκπαίδευση','Υγεία Εργαζομένων','Governance'].map(x=><article key={x}><BarChart3 size={18}/><strong>{x}</strong><small>Δείκτες, τάσεις, σύγκριση και export.</small></article>)}</div></section></Page>
}
