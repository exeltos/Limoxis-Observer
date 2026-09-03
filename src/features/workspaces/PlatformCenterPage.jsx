import { useEffect,useMemo,useState } from 'react'
import { Activity,ArrowLeft,BarChart3,Building2,Clock3,FlaskConical,Send,ShieldCheck,Trash2,Users } from 'lucide-react'
import { useLocation,useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import {
  createOrganizationUser,
  createPlatformDemoEntitlement,
  createPlatformOrganization,
  listOrganizationMembersDetailed,
  listPlatformDemos,
  listPlatformOrganizationMembers,
  manageOrganizationUser,
  purgePlatformOrganization,
  setPlatformOrganizationStatus,
  updatePlatformOrganization,
} from '../../core/tenant/tenantService'
import { AnalysisPage } from '../analysis/AnalysisPage'
import { HospitalDiagnosticsPanel } from '../platform/HospitalDiagnosticsPanel'
import { PlatformOrganizationActions } from './PlatformOrganizationActions'
import { PlatformUserDialog } from './PlatformUserDialog'

const GREEK_REGIONS=['Ανατολική Μακεδονία και Θράκη','Κεντρική Μακεδονία','Δυτική Μακεδονία','Ήπειρος','Θεσσαλία','Ιόνια Νησιά','Δυτική Ελλάδα','Στερεά Ελλάδα','Αττική','Πελοπόννησος','Βόρειο Αιγαίο','Νότιο Αιγαίο','Κρήτη']
const HEALTH_REGIONS=['1η ΥΠΕ Αττικής','2η ΥΠΕ Πειραιώς και Αιγαίου','3η ΥΠΕ Μακεδονίας','4η ΥΠΕ Μακεδονίας και Θράκης','5η ΥΠΕ Θεσσαλίας και Στερεάς Ελλάδας','6η ΥΠΕ Πελοποννήσου, Ιονίων Νήσων, Ηπείρου και Δυτικής Ελλάδας','7η ΥΠΕ Κρήτης']
const emptyOrganization={name:'',code:'',type:'hospital',status:'active',region:'',healthRegion:'',city:'',country:'Greece',contactEmail:'',contactPhone:'',bedCapacity:'',adminFullName:'',adminEmail:''}

function daysBetween(a,b){return Math.max(0,Math.ceil((new Date(b)-new Date(a))/86400000))}
function demoProgress(item){const total=Math.max(1,daysBetween(item.valid_from,item.valid_until));const remaining=daysBetween(new Date().toISOString().slice(0,10),item.valid_until);return {remaining,pct:Math.max(0,Math.min(100,Math.round((remaining/total)*100)))}}

export function PlatformCenterPage(){
  const {memberships,setTenantByMembership,reloadMemberships,enterPlatformDemo}=useTenant()
  const {language}=useLanguage()
  const {notify,notifyError,confirm}=useFeedback()
  const nav=useNavigate(),location=useLocation(),en=language==='en'
  const tx=(elText,enText)=>en?enText:elText

  const [createOpen,setCreateOpen]=useState(false)
  const [saving,setSaving]=useState(false)
  const [draft,setDraft]=useState(emptyOrganization)
  const [formError,setFormError]=useState('')
  const [members,setMembers]=useState([])
  const [demos,setDemos]=useState([])
  const [loadingStats,setLoadingStats]=useState(true)
  const [selectedOrg,setSelectedOrg]=useState(null)
  const [editOrg,setEditOrg]=useState(null)
  const [inviteSending,setInviteSending]=useState(false)
  const [editAdmin,setEditAdmin]=useState(null)
  const [orgUsers,setOrgUsers]=useState([])
  const [orgUsersLoading,setOrgUsersLoading]=useState(false)
  const [selectedUser,setSelectedUser]=useState(null)
  const [orgDetailTab,setOrgDetailTab]=useState('details')
  const [deleteOrg,setDeleteOrg]=useState(null)
  const [deletePassword,setDeletePassword]=useState('')
  const [deleteConfirm,setDeleteConfirm]=useState('')
  const [deleting,setDeleting]=useState(false)
  const [demoOpen,setDemoOpen]=useState(false)
  const [demoDraft,setDemoDraft]=useState({label:'',contactName:'',contactEmail:'',validFrom:new Date().toISOString().slice(0,10),validUntil:''})
  const [demoSaving,setDemoSaving]=useState(false)
  const [convertDemo,setConvertDemo]=useState(null)

  const activeKey=((location.hash||'').replace('#','').split('?')[0])
  const organizations=memberships.map(m=>m.organization).filter(Boolean)
  const activeOrganizations=organizations.filter(o=>o.status==='active').length
  const activeDemos=demos.filter(d=>d.status==='active'&&daysBetween(new Date().toISOString().slice(0,10),d.valid_until)>0)
  const expiringDemos=activeDemos.filter(d=>demoProgress(d).remaining<=14)

  async function refreshPlatformData(){
    setLoadingStats(true)
    try{
      const [m,d]=await Promise.all([listPlatformOrganizationMembers(),listPlatformDemos()])
      setMembers(m);setDemos(d)
    }catch(error){console.warn(error)}finally{setLoadingStats(false)}
  }
  useEffect(()=>{void refreshPlatformData()},[memberships.length])

  const memberCountByOrg=useMemo(()=>members.reduce((acc,m)=>{acc[m.organization_id]=(acc[m.organization_id]||0)+1;return acc},{}),[members])
  const hospitalAdminStatusByOrg=useMemo(()=>members.reduce((acc,m)=>{if(m.role==='hospital_admin')acc[m.organization_id]=m.status;return acc},{}),[members])
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
      await reloadMemberships();await refreshPlatformData();setCreateOpen(false)
      notify(tx('Ο οργανισμός αποθηκεύτηκε.','Organization saved.'),'success',{operation:'platform_organization_create'})
      try{
        const invitation=await createOrganizationUser({organizationId:created.id,fullName:draft.adminFullName,role:'hospital_admin',email:draft.adminEmail})
        if(invitation?.reused)notify(tx('Ο χρήστης υπήρχε ήδη και προστέθηκε ως Hospital Admin στον οργανισμό.','This account already existed and was assigned as Hospital Admin.'),'success',{operation:'platform_admin_assign'})
        else notify(invitation?.emailSent?tx('Η πρόσκληση του Hospital Admin στάλθηκε.','Hospital Admin invitation sent.'):tx('Ο Hospital Admin δημιουργήθηκε, αλλά η πρόσκληση δεν μπόρεσε να αποσταλεί.','Hospital Admin was created, but the invitation could not be delivered.'),invitation?.emailSent?'success':'warning',{operation:'platform_admin_invite'})
      }catch(inviteError){notifyError(inviteError,'action',{operation:'platform_admin_invite'})}
    }catch(error){
      const duplicate=/duplicate|unique/i.test(String(error?.message||error||''))
      const friendly=duplicate?tx('Ο κωδικός οργανισμού χρησιμοποιείται ήδη.','This organization code already exists.'):tx('Δεν ήταν δυνατή η αποθήκευση του οργανισμού. Δοκιμάστε ξανά.','The organization could not be saved. Please try again.')
      setFormError(friendly);notifyError(error,'save',{operation:'platform_organization_create'})
    }finally{setSaving(false)}
  }

  async function togglePause(org){
    const next=org.status==='suspended'?'active':'suspended'
    const ok=await confirm({
      title:next==='suspended'?tx('Παύση οργανισμού','Suspend organization'):tx('Επανενεργοποίηση οργανισμού','Reactivate organization'),
      message:next==='suspended'?tx(`Να τεθεί σε παύση ο οργανισμός «${org.name}»;`,`Suspend “${org.name}”?`):tx(`Να ενεργοποιηθεί ξανά ο οργανισμός «${org.name}»;`,`Reactivate “${org.name}”?`),
      confirmLabel:next==='suspended'?tx('Παύση','Suspend'):tx('Ενεργοποίηση','Reactivate'),
    })
    if(!ok)return
    try{
      await setPlatformOrganizationStatus(org.id,next)
      await reloadMemberships();await refreshPlatformData()
      setSelectedOrg(current=>current?.id===org.id?{...current,status:next}:current)
      notify(tx('Η κατάσταση του οργανισμού ενημερώθηκε.','Organization status updated.'),'success',{operation:'platform_organization_status'})
    }catch(error){notifyError(error,'action',{operation:'platform_organization_status'})}
  }

  function requestRemoveOrganization(org){setDeleteOrg(org);setDeletePassword('');setDeleteConfirm('')}
  async function confirmRemoveOrganization(){
    if(!deleteOrg||deleting)return
    if(deleteConfirm.trim().toUpperCase()!==deleteOrg.code?.toUpperCase()){
      notify(tx('Πληκτρολόγησε ακριβώς τον κωδικό του οργανισμού για επιβεβαίωση.','Type the organization code exactly to confirm.'),'warning',{operation:'platform_organization_delete'});return
    }
    if(!deletePassword){
      notify(tx('Απαιτείται ο κωδικός πρόσβασης του Platform Owner για επαναταυτοποίηση.','Platform Owner password is required for re-authentication.'),'warning',{operation:'platform_organization_delete'});return
    }
    setDeleting(true)
    try{
      await purgePlatformOrganization({organizationId:deleteOrg.id,password:deletePassword,confirmation:deleteConfirm.trim()})
      await reloadMemberships();await refreshPlatformData();setSelectedOrg(null);setDeleteOrg(null)
      notify(tx('Ο οργανισμός και τα σχετικά δεδομένα διαγράφηκαν οριστικά.','The organization and related data were permanently deleted.'),'success',{operation:'platform_organization_delete'})
    }catch(error){notifyError(error,'delete',{operation:'platform_organization_delete'})}finally{setDeleting(false)}
  }

  async function loadOrgUsers(org){
    setOrgUsersLoading(true)
    try{setOrgUsers(await listOrganizationMembersDetailed(org.id))}
    catch(error){notifyError(error,'load',{operation:'platform_users_load'})}
    finally{setOrgUsersLoading(false)}
  }
  function openOrganization(org){setSelectedOrg(org);setOrgDetailTab('details');setSelectedUser(null);void loadOrgUsers(org)}
  function closeOrganization(){setSelectedOrg(null);setSelectedUser(null);setOrgDetailTab('details')}

  async function beginEditOrg(org){
    setEditAdmin(null)
    setEditOrg({id:org.id,name:org.name||'',code:org.code||'',type:org.type||'hospital',status:org.status||'active',region:org.region||'',healthRegion:org.health_region||'',city:org.city||'',country:org.country||'Greece',contactEmail:org.contact_email||'',contactPhone:org.contact_phone||'',bedCapacity:org.bed_capacity??'',adminFullName:'',adminEmail:''})
    try{
      const users=await listOrganizationMembersDetailed(org.id)
      const admin=users.find(user=>user.role==='hospital_admin')||null
      setEditAdmin(admin)
      if(admin)setEditOrg(x=>x?({...x,adminFullName:admin.name||'',adminEmail:admin.email||''}):x)
    }catch(error){console.warn(error)}
  }

  async function saveOrgEdit({sendInitialInvitation=false}={}){
    if(!editOrg?.name?.trim()||!editOrg?.code?.trim())return
    setSaving(true)
    try{
      await updatePlatformOrganization(editOrg.id,editOrg)
      if(sendInitialInvitation&&!editAdmin){
        const name=String(editOrg.adminFullName||'').trim(),email=String(editOrg.adminEmail||'').trim()
        if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error(tx('Συμπλήρωσε ονοματεπώνυμο και έγκυρο email Hospital Admin.','Enter a full name and valid Hospital Admin email.'))
        const result=await createOrganizationUser({organizationId:editOrg.id,fullName:name,role:'hospital_admin',email})
        if(!result?.emailSent)throw new Error(tx('Η αποθήκευση ολοκληρώθηκε, αλλά η πρόσκληση δεν μπόρεσε να αποσταλεί.','Changes were saved, but the invitation could not be sent.'))
        notify(tx('Οι αλλαγές αποθηκεύτηκαν και η πρόσκληση Hospital Admin στάλθηκε.','Changes saved and Hospital Admin invitation sent.'),'success',{operation:'platform_organization_update'})
      }else notify(tx('Τα στοιχεία του οργανισμού ενημερώθηκαν.','Organization details updated.'),'success',{operation:'platform_organization_update'})
      setSelectedOrg(current=>current?.id===editOrg.id?{
        ...current,
        name:editOrg.name,
        code:editOrg.code,
        type:editOrg.type,
        status:editOrg.status,
        region:editOrg.region,
        health_region:editOrg.healthRegion,
        city:editOrg.city,
        country:editOrg.country,
        contact_email:editOrg.contactEmail,
        contact_phone:editOrg.contactPhone,
        bed_capacity:editOrg.bedCapacity,
      }:current)
      await reloadMemberships();await refreshPlatformData()
      if(selectedOrg?.id===editOrg.id)await loadOrgUsers(selectedOrg)
      setEditOrg(null);setEditAdmin(null)
    }catch(error){notifyError(error,'save',{operation:'platform_organization_update'})}finally{setSaving(false)}
  }

  async function resendHospitalAdminInvitation(){
    if(!editOrg?.id||!editAdmin?.userId||inviteSending)return
    if(editAdmin.status!=='invited'){
      notify(editAdmin.status==='active'?tx('Ο Hospital Admin είναι ήδη ενεργός. Χρησιμοποίησε επαναφορά κωδικού αν χρειάζεται.','Hospital Admin is already active. Use password reset if needed.'):tx('Ο Hospital Admin βρίσκεται σε παύση. Επανενεργοποίησέ τον πριν από οποιαδήποτε πρόσκληση.','Hospital Admin is suspended. Reactivate the account before resending an invitation.'),'warning',{operation:'platform_admin_invite'});return
    }
    setInviteSending(true)
    try{
      const result=await manageOrganizationUser({organizationId:editOrg.id,userId:editAdmin.userId,action:'resend_invitation'})
      notify(result?.emailSent?tx('Η πρόσκληση Hospital Admin επαναποστάλθηκε.','Hospital Admin invitation resent.'):tx('Η πρόσκληση ανανεώθηκε.','Invitation refreshed.'),'success',{operation:'platform_admin_invite'})
      const users=await listOrganizationMembersDetailed(editOrg.id)
      setEditAdmin(users.find(user=>user.role==='hospital_admin')||null)
      if(selectedOrg?.id===editOrg.id)await loadOrgUsers(selectedOrg)
    }catch(error){notifyError(error,'action',{operation:'platform_admin_invite'})}finally{setInviteSending(false)}
  }

  async function userAction(action,extra={}){
    if(!selectedOrg||!selectedUser)return
    try{
      await manageOrganizationUser({organizationId:selectedOrg.id,userId:selectedUser.userId,action,...extra})
      notify(action==='reset_password'?tx('Στάλθηκε email επαναφοράς κωδικού.','Password reset email sent.'):action==='resend_invitation'?tx('Η πρόσκληση επαναπροωθήθηκε.','Invitation resent.'):tx('Η ενέργεια ολοκληρώθηκε.','Action completed.'),'success',{operation:`platform_user_${action}`})
      await loadOrgUsers(selectedOrg)
      if(action==='delete')setSelectedUser(null)
      else if(action==='suspend')setSelectedUser(u=>({...u,status:'disabled'}))
      else if(action==='reactivate')setSelectedUser(u=>({...u,status:'active'}))
    }catch(error){notifyError(error,'action',{operation:`platform_user_${action}`})}
  }

  async function confirmUserDelete(){
    if(!selectedUser)return
    const ok=await confirm({title:tx('Οριστική διαγραφή χρήστη','Delete user permanently'),message:tx(`Θα διαγραφεί ο λογαριασμός ${selectedUser.username} από τον οργανισμό.`,`The account ${selectedUser.username} will be removed from the organization.`),confirmLabel:tx('Οριστική διαγραφή','Delete permanently'),danger:true})
    if(ok)await userAction('delete')
  }

  async function createDemo(){
    if(!demoDraft.label.trim()||!demoDraft.validUntil)return
    setDemoSaving(true)
    try{await createPlatformDemoEntitlement(demoDraft);await refreshPlatformData();setDemoOpen(false);notify(tx('Το Demo ενεργοποιήθηκε.','Demo access enabled.'),'success',{operation:'platform_demo_create'})}
    catch(error){notifyError(error,'save',{operation:'platform_demo_create'})}
    finally{setDemoSaving(false)}
  }
  function enterOrganization(org){const membership=memberships.find(m=>m.organization?.id===org.id);if(membership){setTenantByMembership(membership.id);nav('/')}}

  const createDialog=createOpen?<ObserverDialog width="wide" eyebrow="Platform Owner" title={tx('Νέος οργανισμός','New organization')} subtitle={tx('Στοιχεία οργανισμού και πρόσκληση αρχικού Hospital Admin.','Organization identity and initial Hospital Admin invitation.')} onClose={()=>!saving&&setCreateOpen(false)} footer={<SaveButton loading={saving} savingLabel={tx('Αποθήκευση…','Saving…')} disabled={!formValid} onClick={submitOrganization}>{tx('Αποθήκευση & αποστολή πρόσκλησης','Save & send invitation')}</SaveButton>}>
    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>{tx('Στοιχεία οργανισμού','Organization details')}</strong><span>{tx('Τα στοιχεία αυτά χρησιμοποιούνται σε αναλύσεις, φίλτρα, reports και audit.','These details are used in analytics, filters, reports and audit records.')}</span></div></div>
      <div className="entry-grid compact">
        <label className="field"><span>{tx('Επωνυμία','Name')} *</span><input autoFocus value={draft.name} onChange={e=>setField('name',e.target.value)}/></label>
        <label className="field"><span>{tx('Κωδικός / Hospital Prefix','Code / Hospital Prefix')} *</span><input value={draft.code} onChange={e=>setField('code',e.target.value.toUpperCase().replace(/\s+/g,'-'))} placeholder="HOSPITAL1" maxLength={24}/><small className={draft.code&&!codeValid?'field-error':'field-hint'}>{tx('2–24 χαρακτήρες: A–Z, 0–9, - ή _.','2–24 characters: A–Z, 0–9, - or _.')}</small></label>
        <label className="field"><span>{tx('Τύπος','Type')}</span><select value={draft.type} onChange={e=>setField('type',e.target.value)}><option value="hospital">{tx('Νοσοκομείο','Hospital')}</option><option value="clinic">{tx('Κλινική','Clinic')}</option><option value="group">{tx('Όμιλος','Group')}</option><option value="other">{tx('Άλλο','Other')}</option></select></label>
        <label className="field"><span>{tx('Κατάσταση','Status')}</span><select value={draft.status} onChange={e=>setField('status',e.target.value)}><option value="active">{tx('Ενεργός','Active')}</option><option value="suspended">{tx('Σε παύση','Suspended')}</option></select></label>
        <label className="field"><span>{tx('Περιφέρεια','Region')} *</span><select value={draft.region} onChange={e=>setField('region',e.target.value)}><option value="">{tx('Επιλογή…','Select…')}</option>{GREEK_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>{tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')} *</span><select value={draft.healthRegion} onChange={e=>setField('healthRegion',e.target.value)}><option value="">{tx('Επιλογή…','Select…')}</option>{HEALTH_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>{tx('Πόλη','City')} *</span><input value={draft.city} onChange={e=>setField('city',e.target.value)}/></label>
        <label className="field"><span>{tx('Χώρα','Country')}</span><input value={draft.country} onChange={e=>setField('country',e.target.value)}/></label>
        <label className="field"><span>{tx('Κεντρικό email','Main email')}</span><input type="email" value={draft.contactEmail} onChange={e=>setField('contactEmail',e.target.value)}/></label>
        <label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={draft.contactPhone} onChange={e=>setField('contactPhone',e.target.value)}/></label>
        <label className="field"><span>{tx('Δυναμικότητα κλινών','Bed capacity')}</span><input type="number" min="0" value={draft.bedCapacity} onChange={e=>setField('bedCapacity',e.target.value)}/></label>
      </div>
    </div>
    <div className="observer-form-section">
      <div className="observer-form-section-title"><div><strong>{tx('Αρχικός Hospital Admin','Initial Hospital Admin')}</strong><span>{tx('Το username θα δημιουργηθεί αυτόματα. Ο χρήστης θα λάβει πρόσκληση και θα ορίσει ο ίδιος κωδικό.','The username is created automatically. The user receives an invitation and sets their own password.')}</span></div></div>
      <div className="entry-grid compact"><label className="field"><span>{tx('Ονοματεπώνυμο','Full name')} *</span><input value={draft.adminFullName} onChange={e=>setField('adminFullName',e.target.value)}/></label><label className="field"><span>{tx('Email πρόσκλησης','Invitation email')} *</span><input type="email" value={draft.adminEmail} onChange={e=>setField('adminEmail',e.target.value)}/><small className={draft.adminEmail&&!emailValid?'field-error':'field-hint'}>{tx('Χρησιμοποιείται μόνο για την ασφαλή πρόσκληση/ενεργοποίηση.','Used only for secure invitation and activation.')}</small></label></div>
    </div>
    {formError&&<div className="platform-form-error" role="alert">{formError}</div>}
  </ObserverDialog>:null

  const editDialog=editOrg?<ObserverDialog width="wide" eyebrow={tx('Platform Owner · Οργανισμός','Platform Owner · Organization')} title={`${tx('Επεξεργασία','Edit')} — ${editOrg.name}`} subtitle={tx('Οι αλλαγές εφαρμόζονται στα στοιχεία πλατφόρμας, φίλτρα και reports.','Changes apply to platform details, filters and reports.')} onClose={()=>{setEditOrg(null);setEditAdmin(null)}} footer={<SaveButton loading={saving} onClick={()=>saveOrgEdit({sendInitialInvitation:!editAdmin})}>{editAdmin?tx('Αποθήκευση','Save'):tx('Αποθήκευση & αποστολή πρόσκλησης','Save & send invitation')}</SaveButton>}>
    <div className="entry-grid compact">
      <label className="field entry-span-2"><span>{tx('Επωνυμία','Name')}</span><input value={editOrg.name} onChange={e=>setEditOrg(x=>({...x,name:e.target.value}))}/></label>
      <label className="field"><span>{tx('Κωδικός','Code')}</span><input value={editOrg.code} onChange={e=>setEditOrg(x=>({...x,code:e.target.value.toUpperCase()}))}/></label>
      <label className="field"><span>{tx('Τύπος','Type')}</span><select value={editOrg.type} onChange={e=>setEditOrg(x=>({...x,type:e.target.value}))}><option value="hospital">{tx('Νοσοκομείο','Hospital')}</option><option value="clinic">{tx('Κλινική','Clinic')}</option><option value="group">{tx('Όμιλος','Group')}</option><option value="other">{tx('Άλλο','Other')}</option></select></label>
      <label className="field"><span>{tx('Περιφέρεια','Region')}</span><select value={editOrg.region} onChange={e=>setEditOrg(x=>({...x,region:e.target.value}))}><option value="">—</option>{GREEK_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="field"><span>{tx('ΥΠΕ','Health Region')}</span><select value={editOrg.healthRegion} onChange={e=>setEditOrg(x=>({...x,healthRegion:e.target.value}))}><option value="">—</option>{HEALTH_REGIONS.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="field"><span>{tx('Πόλη','City')}</span><input value={editOrg.city} onChange={e=>setEditOrg(x=>({...x,city:e.target.value}))}/></label>
      <label className="field"><span>{tx('Χώρα','Country')}</span><input value={editOrg.country} onChange={e=>setEditOrg(x=>({...x,country:e.target.value}))}/></label>
      <label className="field"><span>{tx('Κλίνες','Beds')}</span><input type="number" value={editOrg.bedCapacity} onChange={e=>setEditOrg(x=>({...x,bedCapacity:e.target.value}))}/></label>
      <label className="field"><span>Email</span><input value={editOrg.contactEmail} onChange={e=>setEditOrg(x=>({...x,contactEmail:e.target.value}))}/></label>
      <label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={editOrg.contactPhone} onChange={e=>setEditOrg(x=>({...x,contactPhone:e.target.value}))}/></label>
    </div>
    <div className="platform-admin-invite-panel">
      <div className="platform-admin-invite-copy"><Send size={17}/><div><strong>Hospital Admin</strong><span>{editAdmin?tx('Ο λογαριασμός έχει ήδη δημιουργηθεί. Η απλή αποθήκευση δεν στέλνει νέα πρόσκληση.','The account already exists. Saving does not resend an invitation.'):tx('Συμπλήρωσε τα στοιχεία. Με την πρώτη αποθήκευση θα δημιουργηθεί λογαριασμός και θα σταλεί πρόσκληση.','Complete the details. The first save creates the account and sends an invitation.')}</span></div></div>
      <div className="entry-grid compact"><label className="field"><span>{tx('Ονοματεπώνυμο Admin','Admin full name')}</span><input value={editOrg.adminFullName||''} readOnly={Boolean(editAdmin)} onChange={e=>setEditOrg(x=>({...x,adminFullName:e.target.value}))}/></label><label className="field"><span>{tx('Email πρόσκλησης','Invitation email')}</span><input type="email" value={editOrg.adminEmail||''} readOnly={Boolean(editAdmin)} onChange={e=>setEditOrg(x=>({...x,adminEmail:e.target.value}))}/></label></div>
      {editAdmin&&<div className="platform-admin-status-row"><span className={`status-badge ${editAdmin.status==='active'?'active':editAdmin.status==='disabled'?'danger':'temporary'}`}>{editAdmin.status==='active'?tx('Ενεργός','Active'):editAdmin.status==='disabled'?tx('Σε παύση','Suspended'):tx('Εκκρεμής','Pending')}</span>{editAdmin.status==='invited'&&<Button variant="secondary" disabled={inviteSending} onClick={resendHospitalAdminInvitation}><Send size={15}/>{inviteSending?tx('Αποστολή…','Sending…'):tx('Επαναποστολή πρόσκλησης','Resend invitation')}</Button>}</div>}
    </div>
  </ObserverDialog>:null

  const deleteDialog=deleteOrg?<ObserverDialog width="wide" eyebrow={tx('Κρίσιμη ενέργεια · Επαναταυτοποίηση','Critical action · Re-authentication')} title={tx('Οριστική διαγραφή οργανισμού','Delete organization permanently')} subtitle={tx('Η ενέργεια δεν αναιρείται.','This action cannot be undone.')} onClose={()=>!deleting&&setDeleteOrg(null)} footer={<Button className="button-destructive" loading={deleting} disabled={!deletePassword||deleteConfirm.trim().toUpperCase()!==deleteOrg.code?.toUpperCase()} onClick={confirmRemoveOrganization}><Trash2 size={15}/>{tx('Οριστική διαγραφή','Delete permanently')}</Button>}>
    <div className="destructive-warning"><Trash2 size={20}/><div><strong>{tx('Θα διαγραφούν ο οργανισμός και όλα τα δεδομένα του.','The organization and all of its data will be deleted.')}</strong><span>{tx('Η ενέργεια είναι οριστική και περιλαμβάνει τις εγγραφές και τους λογαριασμούς που ανήκουν αποκλειστικά σε αυτόν τον οργανισμό.','This is permanent and includes records and accounts belonging exclusively to this organization.')}</span></div></div>
    <div className="entry-grid compact"><label className="field"><span>{tx('Πληκτρολόγησε τον κωδικό','Type the code')}: <b>{deleteOrg.code}</b></span><input name={`purge-confirm-${deleteOrg.id}`} value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} data-lpignore="true" data-1p-ignore="true"/></label><label className="field"><span>{tx('Κωδικός Platform Owner','Platform Owner password')}</span><input name={`purge-password-${deleteOrg.id}`} type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} autoComplete="new-password" data-lpignore="true" data-1p-ignore="true"/></label></div>
  </ObserverDialog>:null

  if(!activeKey)return <><Page title={tx('Dashboard Πλατφόρμας','Platform Dashboard')} subtitle={tx('Συνολική εικόνα του Limoxis Observer και των οργανισμών του.','Overview of Limoxis Observer and its organizations.')}>
    <div className="kpi-grid platform-kpi-grid"><article className="kpi-card"><span>{tx('Σύνολο οργανισμών','Organizations')}</span><strong>{organizations.length}</strong><small>{activeOrganizations} {tx('ενεργοί','active')}</small></article><article className="kpi-card"><span>{tx('Σύνολο χρηστών','Users')}</span><strong>{loadingStats?'—':members.length}</strong><small>{tx('σε όλους τους οργανισμούς','across all organizations')}</small></article><article className="kpi-card"><span>{tx('Ενεργά Demo','Active demos')}</span><strong>{loadingStats?'—':activeDemos.length}</strong><small>{expiringDemos.length} {tx('λήγουν ≤14 ημέρες','expire within 14 days')}</small></article></div>
    <section className="platform-center-section"><div className="platform-section-heading"><div><h2>{tx('Demo που βρίσκονται σε εξέλιξη','Active demos')}</h2><p>{tx('Παρακολούθηση διάρκειας και έγκαιρη ειδοποίηση πριν τη λήξη.','Track duration and upcoming expiry.')}</p></div></div>{activeDemos.length?<div className="platform-demo-list">{activeDemos.map(d=>{const p=demoProgress(d);return <div className="platform-demo-row" key={d.id}><div><strong>{d.organization?.name||d.label}</strong><small>{d.contact_name||d.contact_email||'Demo access'} · {tx('έως','until')} {new Date(d.valid_until).toLocaleDateString(en?'en-GB':'el-GR')}</small></div><div className="platform-demo-progress"><div><span style={{width:`${p.pct}%`}}/></div><small className={p.remaining<=14?'warning':''}>{p.remaining} {tx('ημέρες υπόλοιπο','days remaining')}</small></div></div>})}</div>:<div className="empty-state platform-empty"><Clock3 size={22}/><strong>{tx('Δεν υπάρχουν ενεργά Demo','No active demos')}</strong><span>{tx('Τα Demo που ενεργοποιείς θα εμφανίζονται εδώ με χρόνο μέχρι τη λήξη.','Enabled demos will appear here with time remaining.')}</span></div>}</section>
  </Page>{createDialog}</>

  if(activeKey==='organizations'){
    if(selectedOrg)return <><Page fill title={selectedOrg.name} subtitle={`${selectedOrg.code||'—'} · ${selectedOrg.city||'—'} · ${selectedOrg.region||'—'}`} actions={<PlatformOrganizationActions organization={selectedOrg} language={language} onEnter={()=>enterOrganization(selectedOrg)} onEdit={()=>beginEditOrg(selectedOrg)} onTogglePause={()=>togglePause(selectedOrg)} onDelete={()=>requestRemoveOrganization(selectedOrg)}/>}>
      <div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={closeOrganization}><ArrowLeft size={16}/>{tx('Οργανισμοί','Organizations')}</button></div>
      <section className="platform-center-section platform-owner-record-workspace">
        <div className="platform-org-tabs">
          <button className={orgDetailTab==='details'?'active':''} onClick={()=>setOrgDetailTab('details')}>{tx('Στοιχεία','Details')}</button>
          <button className={orgDetailTab==='users'?'active':''} onClick={()=>setOrgDetailTab('users')}><Users size={14}/>{tx('Χρήστες','Users')} ({orgUsers.length})</button>
          <button className={orgDetailTab==='diagnostics'?'active':''} onClick={()=>setOrgDetailTab('diagnostics')}><Activity size={14}/>{tx('Λειτουργία & συμβάντα','Activity & events')}</button>
          <button className={orgDetailTab==='analysis'?'active':''} onClick={()=>setOrgDetailTab('analysis')}><BarChart3 size={14}/>{tx('Ανάλυση','Analytics')}</button>
        </div>
        {orgDetailTab==='details'&&<div className="platform-owner-details-grid">
          <OwnerField label={tx('Επωνυμία','Name')} value={selectedOrg.name}/>
          <OwnerField label={tx('Κωδικός / Hospital Prefix','Code / Hospital Prefix')} value={selectedOrg.code}/>
          <OwnerField label={tx('Τύπος οργανισμού','Organization type')} value={selectedOrg.type||'hospital'}/>
          <OwnerField label={tx('Κατάσταση','Status')} value={selectedOrg.status==='active'?tx('Ενεργός','Active'):tx('Σε παύση','Suspended')} status={selectedOrg.status}/>
          <OwnerField label={tx('Υγειονομική Περιφέρεια (ΥΠΕ)','Health Region')} value={selectedOrg.health_region}/>
          <OwnerField label={tx('Περιφέρεια','Region')} value={selectedOrg.region}/>
          <OwnerField label={tx('Πόλη','City')} value={selectedOrg.city}/>
          <OwnerField label={tx('Χώρα','Country')} value={selectedOrg.country}/>
          <OwnerField label={tx('Κεντρικό email','Main email')} value={selectedOrg.contact_email}/>
          <OwnerField label={tx('Τηλέφωνο','Phone')} value={selectedOrg.contact_phone}/>
          <OwnerField label={tx('Δυναμικότητα κλινών','Bed capacity')} value={selectedOrg.bed_capacity}/>
          <OwnerField label={tx('Χρήστες οργανισμού','Organization users')} value={memberCountByOrg[selectedOrg.id]||0}/>
          <OwnerField label="Hospital Admin" value={hospitalAdminStatusByOrg[selectedOrg.id]==='active'?tx('Ενεργός','Active'):hospitalAdminStatusByOrg[selectedOrg.id]==='disabled'?tx('Σε παύση','Suspended'):hospitalAdminStatusByOrg[selectedOrg.id]==='invited'?tx('Εκκρεμής πρόσκληση','Invitation pending'):tx('Δεν έχει οριστεί','Not assigned')}/>
        </div>}
        {orgDetailTab==='users'&&<div className="platform-owner-users">{orgUsersLoading?<div className="inline-empty">{tx('Φόρτωση χρηστών…','Loading users…')}</div>:orgUsers.length?<div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{tx('Χρήστης','User')}</th><th>Username</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead><tbody>{orgUsers.map(user=><tr key={user.id} tabIndex={0} onClick={()=>setSelectedUser(user)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedUser(user)}}}><td><strong>{user.name}</strong><small>{user.email||'—'}</small></td><td>{user.username}</td><td>{roleLabel(user.role,language)}</td><td><span className={`status-badge ${user.status==='active'?'active':user.status==='disabled'?'danger':'temporary'}`}>{user.status==='active'?tx('Ενεργός','Active'):user.status==='disabled'?tx('Σε παύση','Suspended'):tx('Εκκρεμής','Pending')}</span></td></tr>)}</tbody></table></div>:<div className="inline-empty">{tx('Δεν υπάρχουν χρήστες.','No users found.')}</div>}</div>}
        {orgDetailTab==='diagnostics'&&<HospitalDiagnosticsPanel organization={selectedOrg} language={language}/>} 
        {orgDetailTab==='analysis'&&<div className="platform-org-analysis-link"><div><strong>{tx('Ανάλυση οργανισμού','Organization analytics')}</strong><span>{tx('Δείκτες, μικροοργανισμοί, trends και report για το συγκεκριμένο νοσοκομείο.','Indicators, microorganisms, trends and report for this hospital.')}</span></div><Button onClick={()=>nav(`/platform#reports?organization=${selectedOrg.id}`)}><BarChart3 size={15}/>{tx('Άνοιγμα Analysis / Report','Open Analysis / Report')}</Button></div>}
      </section>
    </Page>{editDialog}<PlatformUserDialog organization={selectedOrg} user={selectedUser} language={language} onChange={setSelectedUser} onAction={userAction} onDeleteConfirm={confirmUserDelete}/>{deleteDialog}</>

    return <><Page title={tx('Οργανισμοί','Organizations')} subtitle={tx('Διαχείριση οργανισμών, χρηστών, πρόσβασης και ανάλυσης.','Manage organizations, users, access and analytics.')}>
      <div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={()=>nav('/platform')}><ArrowLeft size={16}/>{tx('Dashboard','Dashboard')}</button></div>
      <section className="platform-center-section">
        <div className="platform-section-heading"><div><h2>{tx('Οργανισμοί / Νοσοκομεία','Organizations / Hospitals')}</h2><p>{tx('Κλικ σε μια εγγραφή για να ανοίξεις την πλήρη καρτέλα οργανισμού.','Select a row to open the full organization record.')}</p></div><Button onClick={openCreate}>+ {tx('Νέος οργανισμός','New organization')}</Button></div>
        {organizations.length?<div className="platform-org-list">{organizations.map(org=><button key={org.id} type="button" className={`platform-org-row platform-org-main platform-owner-clickable-row ${org.status==='suspended'?'is-paused':''}`} onClick={()=>openOrganization(org)}><span><strong>{org.name}</strong><small>{org.code} · {org.city||'—'} · {org.region||'—'} · {org.status==='active'?tx('Ενεργός','Active'):tx('ΣΕ ΠΑΥΣΗ','SUSPENDED')} · {memberCountByOrg[org.id]||0} {tx('χρήστες','users')}{hospitalAdminStatusByOrg[org.id]==='invited'&&<span className="status-badge temporary">Admin: {tx('Εκκρεμής','Pending')}</span>}{hospitalAdminStatusByOrg[org.id]==='active'&&<span className="status-badge active">Admin: {tx('Ενεργός','Active')}</span>}{hospitalAdminStatusByOrg[org.id]==='disabled'&&<span className="status-badge danger">Admin: {tx('Σε παύση','Suspended')}</span>}</small></span></button>)}</div>:<div className="empty-state platform-empty"><Building2 size={22}/><strong>{tx('Δεν υπάρχουν οργανισμοί','No organizations')}</strong><span>{tx('Δημιούργησε τον πρώτο οργανισμό.','Create the first organization.')}</span></div>}
      </section>
    </Page>{createDialog}</>
  }

  if(activeKey==='demo')return <><Page title="Demo" subtitle={tx('Απομονωμένο περιβάλλον παρουσίασης. Τα demo δεδομένα υπάρχουν μόνο εδώ και δεν αναμειγνύονται με πραγματικούς οργανισμούς.','Isolated presentation environment. Demo data exists only here and never mixes with production organizations.')}>
    <div className="platform-workspace-toolbar"><button className="platform-back-button" onClick={()=>nav('/platform')}><ArrowLeft size={16}/>Dashboard</button></div>
    <section className="platform-center-section platform-demo-access"><div className="platform-demo-access-copy"><span className="platform-demo-icon"><FlaskConical size={22}/></span><div><h2>{tx('Demo περιβάλλον','Demo environment')}</h2><p>{tx('Άνοιξε εσύ το πλήρες Limoxis Observer με ασφαλή demo δεδομένα ή ενεργοποίησε χρονικά περιορισμένο Demo για υποψήφιο οργανισμό.','Open Limoxis Observer with safe demo data or enable time-limited access for a prospect.')}</p></div></div><div className="platform-demo-actions"><Button variant="secondary" onClick={()=>setDemoOpen(true)}>+ {tx('Νέο Demo','New Demo')}</Button><Button onClick={()=>{enterPlatformDemo();nav('/')}}>{tx('Πρόσβαση Demo','Open Demo')}</Button></div></section>
    <section className="platform-center-section"><div className="platform-section-heading"><div><h2>{tx('Demo προσβάσεις','Demo access')}</h2><p>{tx('Μετά την αξιολόγηση μπορείς να μετατρέψεις ένα prospect σε μόνιμο οργανισμό. Τα synthetic demo records δεν μεταφέρονται.','After evaluation, a prospect can become a production organization. Synthetic demo records are never transferred.')}</p></div></div>{demos.length?<div className="platform-demo-list">{demos.map(d=><div className="platform-demo-row" key={d.id}><div><strong>{d.label}</strong><small>{d.contact_name||d.contact_email||'—'} · {d.valid_from} → {d.valid_until} · {d.status}</small></div><div className="platform-demo-actions">{!d.organization_id&&<Button variant="secondary" onClick={()=>setConvertDemo(d)}>{tx('Μετατροπή σε οργανισμό','Convert to organization')}</Button>}</div></div>)}</div>:<div className="inline-empty">{tx('Δεν υπάρχουν Demo προσβάσεις.','No demo access records.')}</div>}</section>
  </Page>
  {demoOpen&&<ObserverDialog width="wide" eyebrow="Platform Owner" title={tx('Νέο Demo','New Demo')} subtitle={tx('Χρονικά περιορισμένη πρόσβαση σε αποκλειστικά synthetic demo δεδομένα.','Time-limited access to synthetic demo data only.')} onClose={()=>setDemoOpen(false)} footer={<SaveButton loading={demoSaving} disabled={!demoDraft.label.trim()||!demoDraft.validUntil} onClick={createDemo}>{tx('Ενεργοποίηση Demo','Enable Demo')}</SaveButton>}><div className="entry-grid compact"><label className="field entry-span-2"><span>{tx('Οργανισμός / Prospect','Organization / Prospect')} *</span><input value={demoDraft.label} onChange={e=>setDemoDraft(x=>({...x,label:e.target.value}))}/></label><label className="field"><span>{tx('Υπεύθυνος επικοινωνίας','Contact person')}</span><input value={demoDraft.contactName} onChange={e=>setDemoDraft(x=>({...x,contactName:e.target.value}))}/></label><label className="field"><span>Email</span><input type="email" value={demoDraft.contactEmail} onChange={e=>setDemoDraft(x=>({...x,contactEmail:e.target.value}))}/></label><ManualDateField label={tx('Έναρξη','Start')} value={demoDraft.validFrom} onChange={value=>setDemoDraft(x=>({...x,validFrom:value}))}/><ManualDateField label={`${tx('Λήξη','End')} *`} value={demoDraft.validUntil} onChange={value=>setDemoDraft(x=>({...x,validUntil:value}))}/></div></ObserverDialog>}
  {convertDemo&&<ObserverDialog width="wide" eyebrow="Demo → Production" title={tx('Μετατροπή σε μόνιμο οργανισμό','Convert to production organization')} subtitle={tx('Δημιουργείται καθαρός production οργανισμός. Τα synthetic demo δεδομένα δεν αντιγράφονται.','A clean production organization is created. Synthetic demo data is not copied.')} onClose={()=>setConvertDemo(null)}><div className="setup-note"><ShieldCheck size={16}/><span>{tx('Για ασφάλεια, η μετατροπή ανοίγει τη φόρμα Νέου Οργανισμού με προτεινόμενη επωνυμία. Συμπλήρωσε Περιφέρεια, ΥΠΕ και Hospital Admin πριν την αποθήκευση.','For safety, conversion opens the New Organization form with a suggested name. Complete Region, Health Region and Hospital Admin before saving.')}</span></div><Button onClick={()=>{setDraft({...emptyOrganization,name:convertDemo.label,adminEmail:convertDemo.contact_email||''});setConvertDemo(null);setCreateOpen(true);nav('/platform#organizations')}}>{tx('Συνέχεια στη δημιουργία οργανισμού','Continue to organization creation')}</Button></ObserverDialog>}</>

  return <AnalysisPage platform organizations={organizations}/>
}

function OwnerField({label,value,status}){
  return <div className="platform-owner-field"><span>{label}</span>{status?<strong><span className={`status-badge ${status==='active'?'active':'danger'}`}>{value||'—'}</span></strong>:<strong>{value??'—'}</strong>}</div>
}
