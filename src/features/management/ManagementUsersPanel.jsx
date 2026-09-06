import { useEffect,useState } from 'react'
import { CirclePause,KeyRound,Plus,RotateCcw,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { supabase,invokeAuthenticatedFunction } from '../../core/supabase/client'
import { demoUsers } from './managementData'
import { creatableManagementRoles,managementMemberStatusLabel,managementRoleNames } from './managementRoles'

export function ManagementUsersPanel(){
 const {language,t}=useLanguage()
 const {tenant,role,membership,isDemo}=useTenant()
 const {user:authUser}=useAuth()
 const {notify,confirm}=useFeedback()
 const [rows,setRows]=useState([])
 const [loading,setLoading]=useState(false)
 const [createOpen,setCreateOpen]=useState(false)
 const [createdUser,setCreatedUser]=useState(null)
 const [selectedUser,setSelectedUser]=useState(null)
 const [busy,setBusy]=useState(false)
 const [revision,setRevision]=useState(0)
 const currentUserId=authUser?.id||''
 const isPlatformOwner=role===ROLES.PLATFORM_OWNER
 const addOns=membership?.capabilities??[]
 const customCaps=membership?.customCapabilities??[]
 const canManageUsers=can(role,CAPABILITIES.MANAGE_USERS,addOns,customCaps)
 const canManageRow=user=>isPlatformOwner||user?.userId!==currentUserId

 useEffect(()=>{
  if(isDemo||!supabase||!tenant?.id)return
  let active=true
  setLoading(true)
  ;(async()=>{
   try{
    const {data:memberRows,error}=await supabase.from('organization_members').select('id,user_id,role,status').eq('organization_id',tenant.id)
    if(error)throw error
    if(!active)return
    const ids=[...new Set((memberRows||[]).map(x=>x.user_id).filter(Boolean))]
    let profiles=[]
    if(ids.length){
     const result=await supabase.from('profiles').select('id,full_name,username,contact_email,phone,job_title').in('id',ids)
     if(result.error)throw result.error
     profiles=result.data||[]
    }
    const byId=new Map(profiles.map(x=>[x.id,x]))
    setRows((memberRows||[]).map(row=>{
     const p=byId.get(row.user_id)||{}
     return {id:row.id,userId:row.user_id,role:row.role,status:row.status,username:p.username||'—',name:p.full_name||'—',email:p.contact_email||'',phone:p.phone||'',jobTitle:p.job_title||''}
    }))
   }catch(error){if(active)notify(error?.message||(language==='en'?'Could not load users.':'Αποτυχία φόρτωσης χρηστών.'),'error')}
   finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[isDemo,tenant?.id,revision,language,notify])

 async function createUser(payload){
  if(!supabase||!tenant?.id)return
  try{
   setBusy(true)
   const data=await invokeAuthenticatedFunction('create-organization-user',{organizationId:tenant.id,...payload})
   setCreateOpen(false)
   setCreatedUser({...data,employeeCreated:Boolean(data?.employeeId)})
   setRevision(x=>x+1)
   notify(payload.employee?.create?(language==='en'?'Employee and user account created.':'Ο εργαζόμενος και ο λογαριασμός χρήστη δημιουργήθηκαν.'):(language==='en'?'User account created.':'Ο λογαριασμός χρήστη δημιουργήθηκε.'),'success')
  }catch(error){notify(error?.message||(language==='en'?'User creation failed.':'Η δημιουργία χρήστη απέτυχε.'),'error')}
  finally{setBusy(false)}
 }

 async function runAction(user,action,payload={}){
  if(!tenant?.id||!user?.userId)return
  if(!canManageRow(user)){
   notify(language==='en'?'Only the Platform Owner can manage your own account from this screen.':'Ο δικός σας λογαριασμός μπορεί να διαχειριστεί από αυτή την οθόνη μόνο από τον Platform Owner.','warning')
   return
  }
  if(action==='suspend'){
   const ok=await confirm({title:language==='en'?'Pause access':'Παύση πρόσβασης',message:language==='en'?`Pause ${user.name}'s access? The employee record remains unchanged.`:`Να τεθεί σε παύση η πρόσβαση του χρήστη «${user.name}»; Η καρτέλα εργαζομένου παραμένει κανονικά.`,confirmLabel:language==='en'?'Pause access':'Παύση πρόσβασης'})
   if(!ok)return
  }
  if(action==='delete'){
   const ok=await confirm({title:language==='en'?'Delete login account':'Διαγραφή λογαριασμού σύνδεσης',message:language==='en'?`Delete ${user.name}'s login and organization access? The employee record and all workforce history are preserved.`:`Θα διαγραφεί μόνο ο λογαριασμός σύνδεσης και η πρόσβαση του «${user.name}». Η καρτέλα εργαζομένου και όλο το ιστορικό προσωπικού διατηρούνται.`,confirmLabel:language==='en'?'Delete account':'Διαγραφή λογαριασμού',danger:true})
   if(!ok)return
  }
  try{
   setBusy(true)
   await invokeAuthenticatedFunction('manage-organization-user',{organizationId:tenant.id,userId:user.userId,action,...payload})
   if(action==='delete'){
    setRows(current=>current.filter(row=>row.userId!==user.userId))
    setSelectedUser(null)
    notify(language==='en'?'Login account deleted. Employee record preserved.':'Ο λογαριασμός σύνδεσης διαγράφηκε. Η καρτέλα εργαζομένου διατηρήθηκε.','success')
    return
   }
   if(action==='reset_password'){
    notify(language==='en'?'Password reset email sent.':'Στάλθηκε email επαναφοράς κωδικού.','success')
    return
   }
   const nextStatus=action==='suspend'?'disabled':action==='reactivate'?'active':user.status
   const nextRole=action==='update'&&payload.role?payload.role:user.role
   const patch={status:nextStatus,role:nextRole}
   setRows(current=>current.map(row=>row.userId===user.userId?{...row,...patch}:row))
   setSelectedUser(current=>current?.userId===user.userId?{...current,...patch}:current)
   notify(action==='update'?(language==='en'?'User role updated.':'Ο ρόλος του χρήστη ενημερώθηκε.'):action==='reactivate'?(language==='en'?'Access restored.':'Η πρόσβαση ενεργοποιήθηκε ξανά.'):(language==='en'?'Access paused.':'Η πρόσβαση τέθηκε σε παύση.'),'success')
  }catch(error){notify(error?.message||(language==='en'?'The user action failed.':'Η ενέργεια χρήστη απέτυχε.'),'error')}
  finally{setBusy(false)}
 }

 return <section className="management-section management-scroll-section">
  <div className="section-toolbar">
   <div><h2>{t('organizationUsers')}</h2><p>{tenant?.name} · {language==='en'?'Accounts, roles and access lifecycle':'Λογαριασμοί, ρόλοι και κύκλος ζωής πρόσβασης'}</p></div>
   {canManageUsers&&!isDemo&&<Button onClick={()=>setCreateOpen(true)}><Plus size={15}/>{t('managementPanel.createUser')}</Button>}
  </div>
  <div className="table-wrap scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('users')}</th><th>Username</th><th>{t('roleLabel')}</th><th>{t('status')}</th><th/></tr></thead><tbody>
   {isDemo?demoUsers.map(user=><tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>DEMO</td><td>{user.role}</td><td><span className="status-badge active">{managementMemberStatusLabel('active',language)}</span></td><td/></tr>):rows.map(user=>{
    const self=user.userId===currentUserId
    return <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email||'—'}</small></td><td>{user.username}</td><td><span className="role-badge">{t(managementRoleNames[user.role]??user.role)}</span></td><td><span className={`status-badge ${user.status==='active'?'active':user.status==='disabled'?'danger':'temporary'}`}>{managementMemberStatusLabel(user.status,language)}</span></td><td>{canManageRow(user)?<button className="text-button" onClick={()=>setSelectedUser(user)}>{t('manageUserAction')}</button>:<span className="role-badge">{language==='en'?'Your account':'Ο λογαριασμός σας'}</span>}{self&&isPlatformOwner&&<small>{language==='en'?'Platform Owner control':'Έλεγχος Platform Owner'}</small>}</td></tr>
   })}
  </tbody></table>{loading&&<div className="inline-empty">{t('loading')}</div>}{!isDemo&&!loading&&!rows.length&&<div className="inline-empty">{t('noConnectedUsers')}</div>}</div>
  {createOpen&&<CreateUserDialog t={t} language={language} busy={busy} onClose={()=>setCreateOpen(false)} onCreate={createUser}/>} 
  {createdUser&&<CreatedUserDialog data={createdUser} t={t} language={language} onClose={()=>setCreatedUser(null)}/>} 
  {selectedUser&&canManageRow(selectedUser)&&<UserAccessDialog user={selectedUser} t={t} language={language} busy={busy} onClose={()=>setSelectedUser(null)} onAction={(action,payload)=>runAction(selectedUser,action,payload)}/>} 
 </section>
}

function CreateUserDialog({t,language,busy,onClose,onCreate}){
 const [form,setForm]=useState({fullName:'',role:'staff_user',email:'',phone:'',jobTitle:'',createEmployee:true,employeeCode:'',departmentId:'',employmentStatus:'active'})
 const valid=form.fullName.trim()&&form.email.trim()&&form.role
 const set=(key,value)=>setForm(current=>({...current,[key]:value}))
 return <ObserverDialog open title={t('managementPanel.createUser')} onClose={onClose}><div className="entry-form-grid"><label className="field"><span>{t('name')}</span><input value={form.fullName} onChange={e=>set('fullName',e.target.value)}/></label><label className="field"><span>Email</span><input type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label><label className="field"><span>{t('roleLabel')}</span><select value={form.role} onChange={e=>set('role',e.target.value)}>{creatableManagementRoles.map(item=><option key={item} value={item}>{t(managementRoleNames[item]??item)}</option>)}</select></label><label className="field"><span>{t('phone')}</span><input value={form.phone} onChange={e=>set('phone',e.target.value)}/></label><label className="field"><span>{t('jobTitle')}</span><input value={form.jobTitle} onChange={e=>set('jobTitle',e.target.value)}/></label><label className="field checkbox-field"><input type="checkbox" checked={form.createEmployee} onChange={e=>set('createEmployee',e.target.checked)}/><span>{language==='en'?'Also create employee record':'Δημιουργία και καρτέλας εργαζομένου'}</span></label>{form.createEmployee&&<><label className="field"><span>{language==='en'?'Employee code':'Κωδικός εργαζομένου'}</span><input value={form.employeeCode} onChange={e=>set('employeeCode',e.target.value)}/></label><label className="field"><span>{language==='en'?'Employment status':'Κατάσταση εργασίας'}</span><select value={form.employmentStatus} onChange={e=>set('employmentStatus',e.target.value)}><option value="active">{language==='en'?'Active':'Ενεργός'}</option><option value="inactive">{language==='en'?'Inactive':'Ανενεργός'}</option></select></label></>}</div><DialogActions><Button variant="secondary" onClick={onClose}>{t('cancel')}</Button><SaveButton disabled={busy||!valid} onClick={()=>onCreate({fullName:form.fullName,role:form.role,email:form.email,phone:form.phone,jobTitle:form.jobTitle,employee:{create:form.createEmployee,employeeCode:form.employeeCode,departmentId:form.departmentId||null,employmentStatus:form.employmentStatus}})}>{t('managementPanel.createUser')}</SaveButton></DialogActions></ObserverDialog>
}

function CreatedUserDialog({data,t,language,onClose}){return <ObserverDialog open title={t('managementPanel.credentialsTitle')} onClose={onClose}><div className="credential-box"><strong>{data.username}</strong><code>{data.temporaryPassword}</code><p>{language==='en'?'Share the temporary password securely. The user must change it at first sign-in.':'Δώστε τον προσωρινό κωδικό με ασφαλή τρόπο. Ο χρήστης πρέπει να τον αλλάξει στην πρώτη σύνδεση.'}</p>{data.employeeCreated&&<p>{language==='en'?'Employee record created and linked.':'Δημιουργήθηκε και συνδέθηκε καρτέλα εργαζομένου.'}</p>}</div><DialogActions><Button onClick={onClose}>{t('close')}</Button></DialogActions></ObserverDialog>}

function UserAccessDialog({user,t,language,busy,onClose,onAction}){
 const [role,setRole]=useState(user.role)
 const roleChanged=role!==user.role
 const active=user.status==='active'
 return <ObserverDialog open width="wide" eyebrow={language==='en'?'USER ACCESS':'ΠΡΟΣΒΑΣΗ ΧΡΗΣΤΗ'} title={language==='en'?'Manage access':'Διαχείριση πρόσβασης'} subtitle={user.name} onClose={onClose}>
  <div className="detail-grid quality-detail-grid">
   <div className="detail-item"><span>{language==='en'?'Username':'Όνομα χρήστη'}</span><strong>{user.username||'—'}</strong></div>
   <div className="detail-item"><span>Email</span><strong>{user.email||'—'}</strong></div>
   <div className="detail-item"><span>{t('status')}</span><strong><span className={`status-badge ${active?'active':user.status==='disabled'?'danger':'temporary'}`}>{managementMemberStatusLabel(user.status,language)}</span></strong></div>
  </div>
  <div className="quality-description"><span>{t('roleLabel')}</span><div className="field"><select value={role} disabled={busy} onChange={e=>setRole(e.target.value)}>{creatableManagementRoles.map(item=><option key={item} value={item}>{t(managementRoleNames[item]??item)}</option>)}</select></div></div>
  <div className="source-truth-note"><strong>{language==='en'?'Login access is separate from the employee record':'Η πρόσβαση σύνδεσης είναι ανεξάρτητη από την καρτέλα εργαζομένου'}</strong><p>{language==='en'?'Pausing or deleting this login never deletes the employee record, training, certifications or workforce history.':'Η παύση ή η διαγραφή του λογαριασμού σύνδεσης δεν διαγράφει ποτέ την καρτέλα εργαζομένου, τις εκπαιδεύσεις, τις πιστοποιήσεις ή το ιστορικό προσωπικού.'}</p></div>
  <div className="record-actions"><Button variant="secondary" disabled={busy} onClick={()=>onAction('reset_password')}><KeyRound size={15}/>{language==='en'?'Reset password':'Επαναφορά κωδικού'}</Button>{active?<Button variant="secondary" disabled={busy} onClick={()=>onAction('suspend')}><CirclePause size={15}/>{language==='en'?'Pause access':'Παύση πρόσβασης'}</Button>:<Button variant="secondary" disabled={busy} onClick={()=>onAction('reactivate')}><RotateCcw size={15}/>{language==='en'?'Restore access':'Ενεργοποίηση πρόσβασης'}</Button>}<Button variant="secondary" className="button-destructive" disabled={busy} onClick={()=>onAction('delete')}><Trash2 size={15}/>{language==='en'?'Delete login':'Διαγραφή λογαριασμού'}</Button></div>
  <DialogActions><Button variant="secondary" onClick={onClose} disabled={busy}>{t('close')}</Button><SaveButton disabled={busy||!roleChanged} onClick={()=>onAction('update',{role})}>{language==='en'?'Save role':'Αποθήκευση ρόλου'}</SaveButton></DialogActions>
 </ObserverDialog>
}
