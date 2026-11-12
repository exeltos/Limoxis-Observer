import { useCallback,useEffect,useState } from 'react'
import { ArrowLeft,CirclePause,KeyRound,Link2,Plus,UserPlus,RotateCcw,ShieldCheck,Trash2,UserRound,UsersRound } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { RegistryTable } from '../../design-system/RegistryTable'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES,ROLES,can } from '../../core/permissions/roles'
import { supabase,invokeAuthenticatedFunction } from '../../core/supabase/client'
import { employeeRows as demoEmployeeRows } from '../employees/employeeDemoData'
import { creatableManagementRoles,managementMemberStatusLabel,managementRoleNames } from './managementRoles'
import { screenGuideChoice,screenGuideValue } from '../demo/screenGuideSettings'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { InvitationLinkDialog } from '../platform/InvitationLinkDialog'
import { SupplierRenewalSenderField } from '../quality/resources/SupplierRenewalSenderField'
import { needsDepartment } from '../platform/bulkAccountsModel'
import { useDepartments } from './useLibraries'
import { BulkAccountsPanel } from '../platform/BulkAccountsPanel'
import { loadEmployeeAccounts } from '../platform/bulkAccountsService'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { cloudClient } from '../../core/supabase/cloudContext'
import type { ReactNode } from 'react'
import type { AnyRecord } from '../../types/featureTypes'
import type { LanguageContextValue } from '../../core/i18n/languageTypes'
import type { LibraryDepartment } from './useLibraries'

type T = LanguageContextValue['t']
type UserRow = AnyRecord & { id: string, userId: string, role: string, status: string, name: string }

const DEMO_USERS: UserRow[]=[
 {id:'DEMO-MEMBER-001',userId:'DEMO-USER-001',role:ROLES.HOSPITAL_ADMIN,status:'active',username:'demo.admin',name:'Διαχειριστής Demo',nameEn:'Demo Administrator',email:'demo.admin@example.org'},
 {id:'DEMO-MEMBER-002',userId:'DEMO-USER-002',role:ROLES.INFECTION_CONTROL_LEAD,status:'active',username:'demo.infection',name:'Υπεύθυνος Λοιμώξεων',nameEn:'Infection Control Lead',email:'infection.demo@example.org'},
 {id:'DEMO-MEMBER-003',userId:'DEMO-USER-003',role:ROLES.LABORATORY,status:'active',username:'demo.lab',name:'Εργαστήριο Demo',nameEn:'Demo Laboratory',email:'lab.demo@example.org'},
 {id:'DEMO-MEMBER-004',userId:'DEMO-USER-004',role:ROLES.DEPARTMENT_MANAGER,status:'active',username:'demo.icu',name:'Προϊστάμενος ΜΕΘ',nameEn:'ICU Manager',email:'icu.demo@example.org',departmentId:'ΜΕΘ',departmentName:'ΜΕΘ'},
]

// Greek or English text by the interface language.
const useTx=()=>{const {language}=useLanguage();return useCallback((el: string,en: string)=>language==='en'?en:el,[language])}

export function ManagementUsersPanel(){const tx=useTx();
 const {language,t}=useLanguage(),{tenant,role,membership,isDemo,isRolePreview}=useTenant(),{user:authUser}=useAuth(),{notify,confirm}=useFeedback()
 const [invitationLink,setInvitationLink]=useState<{link: string,name: string}|null>(null)
 // «Μαζική δημιουργία»: the employees without an account, as the Platform Owner sees them, for this hospital.
 const [query,setQuery]=useState(''),[roleFilter,setRoleFilter]=useState('all'),[statusFilter,setStatusFilter]=useState<string|null>(null)
 const [view,setView]=useState('accounts'),[roster,setRoster]=useState<AnyRecord>({employees:[],departments:[]}),[rosterLoading,setRosterLoading]=useState(false)
 const [rows,setRows]=useState<UserRow[]>([]),[loading,setLoading]=useState(false),[createOpen,setCreateOpen]=useState(false),[createdUser,setCreatedUser]=useState<AnyRecord|null>(null),[selectedUser,setSelectedUser]=useState<UserRow|null>(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 const {departments}=useDepartments(),departmentName=(id: string|null|undefined)=>{const d=departments.find(x=>x.id===id);return d?(language==='en'?d.nameEn||d.name:d.name):''}
 const currentUserId=authUser?.id||'',isPlatformOwner=role===ROLES.PLATFORM_OWNER,previewingHospitalAdmin=Boolean(isRolePreview&&role===ROLES.HOSPITAL_ADMIN)
 const canManageUsers=can(role,CAPABILITIES.MANAGE_USERS,membership?.capabilities??[],membership?.customCapabilities??[])
 const isSelfRow=(u: UserRow|null|undefined)=>Boolean(!isPlatformOwner&&u?.userId===currentUserId)
 const isPreviewProtectedRow=(u: UserRow|null|undefined)=>Boolean(previewingHospitalAdmin&&u?.role===ROLES.HOSPITAL_ADMIN)
 const canManageRow=(u: UserRow|null|undefined)=>isPlatformOwner||!isPreviewProtectedRow(u)
 useEffect(()=>{
  if(isDemo){setRows(DEMO_USERS.map(row=>({...row})));setLoading(false);return}
  if(!supabase||!tenant?.id)return
  let active=true;setLoading(true)
  // One RPC: member and profile RLS show an admin only its own row (organization_users_list).
  ;(async()=>{try{const [{data:members,error},{data:scopes,error:scopeError}]=await Promise.all([cloudClient().rpc('organization_users_list',{p_organization_id:tenant.id}),cloudClient().rpc('organization_member_departments',{p_organization_id:tenant.id})]);if(error)throw error;if(scopeError)throw scopeError;if(!active)return;const scopeOf=new Map((scopes||[]).map(row=>[row.membership_id,row]));setRows((members||[]).map(row=>({id:row.id,userId:row.user_id,role:row.role,status:row.status,screenGuides:screenGuideChoice(row.screen_guides),username:row.username||'—',name:row.full_name||'—',email:row.contact_email||'',departmentId:scopeOf.get(row.id)?.department_id||'',departmentName:scopeOf.get(row.id)?.department_name||''})))}catch(e){if(active)notify((e as Error)?.message||tx('Αποτυχία φόρτωσης χρηστών.','Users could not be loaded.'),'error')}finally{if(active)setLoading(false)}})()
  return()=>{active=false}
 },[isDemo,tenant?.id,revision,notify,tx])
 const loadRoster=useCallback(async()=>{if(!tenant?.id)return;setRosterLoading(true);try{setRoster(await loadEmployeeAccounts(tenant.id))}catch(e){notify((e as Error)?.message||tx('Αποτυχία φόρτωσης εργαζομένων.','Employees could not be loaded.'),'error')}finally{setRosterLoading(false)}},[tenant?.id,notify,tx])
 const openRoster=()=>{setView('roster');loadRoster()}
 async function saveScreenGuides(userId: string,choice: string){const {error}=await cloudClient().rpc('set_member_screen_guides',{p_organization_id:tenant!.id,p_user_id:userId,p_enabled:screenGuideValue(choice) as boolean});if(error)throw error}
 async function createUser(payload: AnyRecord,screenGuides='default'){
  if(isDemo){
   const userId=`DEMO-USER-${Date.now()}`
   const username=`demo.${payload.fullName.toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώ]+/gi,'.').replace(/^\.|\.$/g,'')||'user'}`
   const created={id:`DEMO-MEMBER-${Date.now()}`,userId,role:payload.role,status:'active',username,name:payload.fullName,email:payload.email,departmentId:payload.departmentId||'',departmentName:departmentName(payload.departmentId)}
   setRows(current=>[created,...current]);setCreateOpen(false);signalDemoStep('users_roles','create');setCreatedUser({username,employeeLinked:Boolean(payload.employeeDbId||payload.employee),demo:true});notify(language==='en'?'Demo user created locally.':'Ο demo χρήστης δημιουργήθηκε τοπικά.','success');return
  }
  try{setBusy(true);const data=await invokeAuthenticatedFunction('create-organization-user',{organizationId:tenant!.id,...payload});if(screenGuides!=='default'&&data?.userId){try{await saveScreenGuides(data.userId,screenGuides)}catch{notify(tx('Ο χρήστης δημιουργήθηκε, αλλά η ρύθμιση των οδηγών οθονών δεν αποθηκεύτηκε. Ορίστε την από τα στοιχεία του χρήστη.','The user was created, but the screen guide setting was not saved.'),'warning')}}setCreateOpen(false);signalDemoStep('users_roles','create');setCreatedUser({...data,employeeLinked:Boolean(data?.employeeId)});setRevision(x=>x+1);notify(data?.emailSent===false?tx('Ο υπάρχων λογαριασμός συνδέθηκε με τον οργανισμό.','The existing account was linked to the organization.'):tx('Η πρόσκληση στάλθηκε.','The invitation was sent.'),'success')}catch(e){notify((e as Error)?.message||tx('Η δημιουργία χρήστη απέτυχε.','The user could not be created.'),'error')}finally{setBusy(false)}
 }
 async function runAction(user: UserRow,action: string,payload: AnyRecord={}){
  if(!canManageRow(user)){notify(tx('Η διαχείριση αυτού του λογαριασμού είναι κλειδωμένη στην προεπισκόπηση ρόλου.','This account cannot be managed in the role preview.'),'warning');return}
  if(action==='screen_guides'){
   try{setBusy(true);if(!isDemo)await saveScreenGuides(user.userId,payload.screenGuides);const patch={screenGuides:payload.screenGuides};setRows(v=>v.map(x=>x.userId===user.userId?{...x,...patch}:x));setSelectedUser(v=>v?.userId===user.userId?{...v,...patch}:v);notify(tx('Η ρύθμιση των οδηγών οθονών αποθηκεύτηκε.','The screen guide setting was saved.'),'success')}
   catch(e){notify((e as Error)?.message||tx('Αποτυχία αποθήκευσης.','The changes could not be saved.'),'error')}finally{setBusy(false)}
   return
  }
  const self=isSelfRow(user)
  if(self&&action==='update'&&payload.role){notify(tx('Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο ή τα δικαιώματα πρόσβασης.','You cannot change your own role or access rights.'),'warning');return}
  if(self&&['suspend','reactivate','delete','resend_invitation','invitation_link'].includes(action)){notify(tx('Δεν μπορείτε να αλλάξετε την κατάσταση πρόσβασης ή να διαγράψετε τον δικό σας λογαριασμό.','You cannot change the access status of, or delete, your own account.'),'warning');return}
  if(action==='suspend'&&!await confirm({title:tx('Παύση πρόσβασης','Suspend access'),message:language==='en'?`Suspend the access of «${user.name}»? The employee record stays.`:`Να τεθεί σε παύση η πρόσβαση του «${user.name}»; Η καρτέλα εργαζομένου παραμένει.`,confirmLabel:tx('Παύση πρόσβασης','Suspend access')}))return
  if(action==='delete'&&!await confirm({title:tx('Διαγραφή λογαριασμού σύνδεσης','Delete sign-in account'),message:language==='en'?`Only the sign-in account of «${user.name}» will be deleted. The employee record and its history are kept.`:`Θα διαγραφεί μόνο ο λογαριασμός σύνδεσης του «${user.name}». Η καρτέλα εργαζομένου και το ιστορικό του διατηρούνται.`,confirmLabel:tx('Διαγραφή λογαριασμού','Delete account'),danger:true}))return
  // A pending invitation's activation link, for when the email does not arrive: shown, not emailed.
  if(action==='invitation_link'){
   if(isDemo){notify(tx('Στο Demo δεν δημιουργούνται σύνδεσμοι πρόσκλησης.','Invitation links are not created in the Demo.'),'info');return}
   try{setBusy(true);const result=await invokeAuthenticatedFunction('manage-organization-user',{organizationId:tenant!.id,userId:user.userId,action});setInvitationLink({link:result.link,name:user.name})}
   catch(e){notify((e as Error)?.message||tx('Δεν ήταν δυνατή η δημιουργία συνδέσμου.','The link could not be created.'),'error')}finally{setBusy(false)}
   return
  }
  if(isDemo){
   if(action==='delete'){setRows(v=>v.filter(x=>x.userId!==user.userId));setSelectedUser(null);notify(tx('Ο demo λογαριασμός διαγράφηκε τοπικά.','The demo account was deleted locally.'),'success');return}
   if(action==='reset_password'){notify(language==='en'?'Demo password reset simulated.':'Η επαναφορά κωδικού προσομοιώθηκε στο Demo.','success');return}
   const patch={status:action==='suspend'?'disabled':action==='reactivate'?'active':user.status,role:action==='update'&&payload.role?payload.role:user.role,...(action==='update'&&payload.departmentId!==undefined?{departmentId:payload.departmentId||'',departmentName:departmentName(payload.departmentId)}:{})}
   setRows(v=>v.map(x=>x.userId===user.userId?{...x,...patch}:x));setSelectedUser(v=>v?.userId===user.userId?{...v,...patch}:v);if(action==='update'&&payload?.role)signalDemoStep('users_roles','role');notify(language==='en'?'Demo access updated locally.':'Η demo πρόσβαση ενημερώθηκε τοπικά.','success');return
  }
  try{setBusy(true);const result=await invokeAuthenticatedFunction('manage-organization-user',{organizationId:tenant!.id,userId:user.userId,action,...payload});if(action==='delete'){setRows(v=>v.filter(x=>x.userId!==user.userId));setSelectedUser(null);return notify(result?.accountDeleted===false?tx('Η πρόσβαση στον οργανισμό αφαιρέθηκε. Ο λογαριασμός παραμένει ενεργός σε άλλον οργανισμό.','Access to the organization was removed. The account stays active in another organization.'):tx('Ο λογαριασμός σύνδεσης διαγράφηκε.','The sign-in account was deleted.'),'success')}if(action==='reset_password')return notify(tx('Στάλθηκε email επαναφοράς κωδικού.','A password reset email was sent.'),'success');const patch={status:action==='suspend'?'disabled':action==='reactivate'?'active':user.status,role:action==='update'&&payload.role?payload.role:user.role,...(action==='update'&&payload.departmentId!==undefined?{departmentId:payload.departmentId||'',departmentName:departmentName(payload.departmentId)}:{})};setRows(v=>v.map(x=>x.userId===user.userId?{...x,...patch}:x));setSelectedUser(v=>v?.userId===user.userId?{...v,...patch}:v);if(action==='update'&&payload?.role)signalDemoStep('users_roles','role');notify(tx('Η πρόσβαση ενημερώθηκε.','Access was updated.'),'success')}catch(e){notify((e as Error)?.message||tx('Η ενέργεια απέτυχε.','The action failed.'),'error')}finally{setBusy(false)}
 }
 // Totals beside the search (owner, 8/11/2026): active, paused and invited, each a filter; search and role.
 const statusOf=(u: UserRow)=>u.status==='active'?'active':u.status==='disabled'?'disabled':'invited'
 const roleOptions=[...new Set(rows.map(u=>u.role).filter(Boolean))]
 const totalsCount=(key: string)=>rows.filter(u=>statusOf(u)===key).length
 const totalItem=(key: string,label: string)=>({key,value:totalsCount(key),label,active:statusFilter===key,onClick:()=>setStatusFilter(current=>current===key?null:key)})
 const totals=<RegistryTotals label={tx('Σύνολα','Totals')} items={[
  {key:'all',always:true,value:rows.length,label:tx('χρήστες','users'),active:!statusFilter,onClick:()=>setStatusFilter(null)},
  totalItem('active',tx('ενεργοί','active')),
  totalItem('disabled',tx('σε παύση','paused')),
  totalItem('invited',tx('εκκρεμείς προσκλήσεις','pending invitations')),
 ]}/>
 const needle=query.trim().toLocaleLowerCase('el')
 const shown=rows.filter(u=>(!statusFilter||statusOf(u)===statusFilter)&&(roleFilter==='all'||u.role===roleFilter)&&(!needle||`${u.name||''} ${u.nameEn||''} ${u.email||''} ${u.username||''}`.toLocaleLowerCase('el').includes(needle)))
 // A user, or a new user, opens in place of the list (not as a window).
 if(selectedUser)return <><UserAccessView key={selectedUser.userId} user={selectedUser} departments={departments} t={t} busy={busy} readOnly={!canManageRow(selectedUser)} selfProtected={isSelfRow(selectedUser)} previewProtected={isPreviewProtectedRow(selectedUser)} organizationId={tenant?.id} ownerTools={isPlatformOwner&&!isRolePreview} onBack={()=>setSelectedUser(null)} onAction={(a: string,p?: AnyRecord)=>runAction(selectedUser,a,p)}/>{invitationLink&&<InvitationLinkDialog link={invitationLink.link} name={invitationLink.name} onClose={()=>setInvitationLink(null)}/>}</>
 if(createOpen)return <CreateUserView tenantId={tenant?.id} t={t} busy={busy} isDemo={isDemo} departments={departments} onClose={()=>setCreateOpen(false)} onCreate={createUser}/>
 return <section className="management-section management-scroll-section">{view==='roster'&&<div className="section-toolbar"><div><h2>{t('organizationUsers')}</h2></div>{canManageUsers&&<Button variant="secondary" onClick={()=>setView('accounts')}><ArrowLeft size={15}/>{tx('Λογαριασμοί','Accounts')}</Button>}</div>}{view==='roster'?<BulkAccountsPanel organization={tenant} language={language} roster={roster} loading={rosterLoading} onReload={loadRoster} onAccountsChanged={()=>setRevision(x=>x+1)}/>:<><FilterBar query={query} onQueryChange={setQuery} placeholder={tx('Αναζήτηση ονόματος, email ή ονόματος χρήστη…','Search name, email or username…')} activeAdvancedCount={roleFilter!=='all'?1:0} end={<>{totals}{canManageUsers&&<div className="row-actions"><Button variant="secondary" onClick={openRoster}><UsersRound size={15}/>{tx('Μαζική δημιουργία','Bulk creation')}</Button><Button onClick={()=>setCreateOpen(true)}><Plus size={15}/>{t('managementPanel.createUser')}</Button></div>}</>} onClear={()=>{setQuery('');setRoleFilter('all');setStatusFilter(null)}}><FilterSelect label={t('roleLabel')} value={roleFilter} onChange={setRoleFilter}><option value="all">{tx('Όλοι οι ρόλοι','All roles')}</option>{roleOptions.map(role=><option key={role} value={role}>{t(managementRoleNames[role]??role)}</option>)}</FilterSelect></FilterBar><RegistryTable
  wrapperClassName="table-wrap scroll-table"
  columns={[{key:'user',label:t('users')},{key:'username',label:t('managementPanel.generatedUsernameLabel')},{key:'role',label:t('roleLabel')},{key:'status',label:t('status')}]}
  rowProps={u=>({className:'registry-row-clickable',tabIndex:0,onClick:()=>setSelectedUser(u),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedUser(u)}}})}
  rows={shown}
  rowKey={u=>u.id}
  renderRow={u=>{const self=isSelfRow(u),previewProtected=isPreviewProtectedRow(u);return <><td><strong>{language==='en'&&u.nameEn?u.nameEn:u.name}</strong><small>{u.email||'—'}</small>{self&&<span className="management-self-account"><ShieldCheck size={13}/>{language==='en'?'Your account':'Ο λογαριασμός σας'}</span>}{previewProtected&&!self&&<span className="management-self-account"><ShieldCheck size={13}/>{language==='en'?'Administrator account':'Λογαριασμός Διαχειριστή'}</span>}</td><td>{u.username}</td><td><span className="role-badge">{t(managementRoleNames[u.role]??u.role)}</span>{needsDepartment(u.role)&&<small>{u.departmentName||tx('Χωρίς τμήμα','No department')}</small>}</td><td><span className={`status-badge ${u.status==='active'?'active':u.status==='disabled'?'danger':'temporary'}`}>{managementMemberStatusLabel(u.status,language)}</span></td></>}}
/>{loading&&<TableSkeleton/>}</>} {invitationLink&&<InvitationLinkDialog link={invitationLink.link} name={invitationLink.name} onClose={()=>setInvitationLink(null)}/>}{createdUser&&<CreatedUserDialog data={createdUser} onClose={()=>setCreatedUser(null)}/>}</section>
}

function CreateUserView({tenantId,t,busy,isDemo,departments=[],onClose,onCreate}: {tenantId?: string,t: T,busy: boolean,isDemo: boolean,departments?: LibraryDepartment[],onClose: ()=>void,onCreate: (payload: AnyRecord,screenGuides: string)=>void}){const tx=useTx();
 const [mode,setMode]=useState('existing'),[employees,setEmployees]=useState<AnyRecord[]>([]),[employeesLoading,setEmployeesLoading]=useState(false),[form,setForm]=useState({fullName:'',role:'',departmentId:'',email:'',phone:'',jobTitle:'',employeeDbId:'',employeeCode:'',employmentStatus:'active',screenGuides:'default'})
 const set=(k: string,v: string)=>setForm(x=>({...x,[k]:v}))
 useEffect(()=>{
  if(isDemo){setEmployees(demoEmployeeRows.map(row=>({id:row.id,user_id:null,employee_code:row.id,first_name:row.firstName,last_name:row.lastName,email:row.email,phone:row.phone,profession_name:row.profession,employment_status:row.employmentStatus,department_id:row.department||null})));setEmployeesLoading(false);return}
  if(!supabase||!tenantId)return
  let alive=true;setEmployeesLoading(true);cloudClient().from('employees').select('id,user_id,employee_code,first_name,last_name,email,phone,profession_name,employment_status,department_id').eq('organization_id',tenantId).order('last_name').then(({data,error})=>{if(alive){if(!error)setEmployees((data||[]).filter(x=>!x.user_id));setEmployeesLoading(false)}});return()=>{alive=false}
 },[tenantId,isDemo])
 const selectEmployee=(id: string)=>{const e=employees.find(x=>x.id===id);setForm(x=>({...x,employeeDbId:id,fullName:e?`${e.first_name||''} ${e.last_name||''}`.trim():x.fullName,email:e?.email||x.email,phone:e?.phone||x.phone,jobTitle:e?.profession_name||x.jobTitle,departmentId:e?.department_id||x.departmentId}))}
 const parts=form.fullName.trim().split(/\s+/),valid=Boolean(form.fullName.trim()&&form.email.trim()&&form.role&&(!needsDepartment(form.role)||form.departmentId)&&(mode!=='existing'||form.employeeDbId)&&(mode!=='new'||(form.employeeCode.trim()&&parts.length>1)))
 const payload={fullName:form.fullName.trim(),role:form.role,departmentId:needsDepartment(form.role)?form.departmentId:null,email:form.email.trim(),phone:form.phone.trim(),jobTitle:form.jobTitle.trim(),employeeDbId:mode==='existing'?form.employeeDbId||null:null,employee:mode==='new'?{create:true,employeeCode:form.employeeCode.trim(),firstName:parts[0]||'',lastName:parts.slice(1).join(' '),employmentStatus:form.employmentStatus}:undefined}
 return <EntityRecordShell className="management-user-shell" avatar={<UserPlus size={19}/>} title={tx('Νέος χρήστης','New user')} subtitle={tx('Δημιουργία πρόσβασης και σύνδεση με το μητρώο εργαζομένων.','Create access and link it to the staff registry.')} onBack={onClose}><RecordTabPanel title={tx('Στοιχεία','Details')} footer={<div className="inline-edit-footer"><Button variant="secondary" onClick={onClose}>{tx('Ακύρωση','Cancel')}</Button><SaveButton disabled={busy||!valid} onClick={()=>onCreate(payload,form.screenGuides)}>{busy?tx('Αποστολή…','Sending…'):isDemo?tx('Δημιουργία demo χρήστη','Create demo user'):tx('Αποστολή πρόσκλησης','Send invitation')}</SaveButton></div>}><div className="management-user-body"><div className="entry-form-grid management-user-fields"><label className="field"><span>{tx('Καρτέλα εργαζομένου','Employee record')}</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="existing">{tx('Υπάρχων εργαζόμενος','Existing employee')}</option><option value="new">{tx('Νέα καρτέλα εργαζομένου','New employee record')}</option><option value="none">{tx('Χωρίς καρτέλα εργαζομένου','No employee record')}</option></select></label></div>{mode==='existing'&&<div className="management-create-employee-picker"><label className="field"><span>{tx('Εργαζόμενος','Employee')}</span><select value={form.employeeDbId} onChange={e=>selectEmployee(e.target.value)}><option value="">{employeesLoading?tx('Φόρτωση…','Loading…'):tx('Επιλέξτε εργαζόμενο…','Choose an employee…')}</option>{employees.map(e=><option key={e.id} value={e.id}>{e.last_name} {e.first_name} · {e.employee_code}</option>)}</select></label></div>}<CreateSection title={tx('Στοιχεία λογαριασμού','Account details')} hint={tx('Το όνομα χρήστη δημιουργείται αυτόματα.','The username is created automatically.')}><div className="entry-form-grid"><Field label={t('name')} value={form.fullName} disabled={mode==='existing'&&!!form.employeeDbId} onChange={v=>set('fullName',v)}/><Field label="Email" type="email" value={form.email} onChange={v=>set('email',v)}/><label className="field"><span>{t('roleLabel')}</span><select value={form.role} onChange={e=>set('role',e.target.value)}><option value="">{tx('Επιλέξτε ρόλο…','Choose a role…')}</option>{creatableManagementRoles.map(r=><option key={r} value={r}>{t(managementRoleNames[r]??r)}</option>)}</select></label>{needsDepartment(form.role)&&<DepartmentField departments={departments} value={form.departmentId} onChange={v=>set('departmentId',v)}/>}<Field label={tx('Τηλέφωνο','Phone')} value={form.phone} onChange={v=>set('phone',v)}/><Field label={tx('Θέση / Ιδιότητα','Position / title')} value={form.jobTitle} onChange={v=>set('jobTitle',v)}/><ScreenGuideField value={form.screenGuides} onChange={v=>set('screenGuides',v)}/></div></CreateSection>{mode==='new'&&<CreateSection title={tx('Καρτέλα εργαζομένου','Employee record')} hint={tx('Μόνο τα στοιχεία που αφορούν το μητρώο προσωπικού.','Only the details of the staff registry.')}><div className="entry-form-grid"><Field label={tx('Κωδικός εργαζομένου','Employee code')} value={form.employeeCode} onChange={v=>set('employeeCode',v)}/><label className="field"><span>{tx('Κατάσταση εργασίας','Employment status')}</span><select value={form.employmentStatus} onChange={e=>set('employmentStatus',e.target.value)}><option value="active">{tx('Ενεργός','Active')}</option><option value="inactive">{tx('Ανενεργός','Inactive')}</option></select></label></div></CreateSection>}<div className="management-create-invite-note"><KeyRound size={16}/><span>{isDemo?tx('Στο Demo η πρόσκληση προσομοιώνεται τοπικά και δεν αποστέλλεται email.','In the Demo the invitation is simulated locally and no email is sent.'):tx('Ο χρήστης θα λάβει πρόσκληση ενεργοποίησης στο email του. Ο διαχειριστής δεν βλέπει ούτε διαμοιράζει κωδικό πρόσβασης.','The user will receive an activation invitation by email. The administrator never sets their password.')}</span></div></div></RecordTabPanel></EntityRecordShell>
}
function CreateSection({title,hint,children}: {title: ReactNode,hint?: ReactNode,children?: ReactNode}){return <div className="management-create-section"><div className="management-create-section-title"><strong>{title}</strong><span>{hint}</span></div>{children}</div>}
// The department a department role sees (organization_member_scopes); required for those roles.
function DepartmentField({departments,value,onChange,disabled=false}: {departments: LibraryDepartment[],value: string,onChange: (value: string)=>void,disabled?: boolean}){const tx=useTx(),{language}=useLanguage();return <label className="field"><span>{tx('Τμήμα','Department')}</span><select value={value} disabled={disabled} required onChange={e=>onChange(e.target.value)}><option value="">{tx('Επιλέξτε τμήμα…','Choose a department…')}</option>{departments.map(d=><option key={d.id} value={d.id}>{language==='en'?d.nameEn||d.name:d.name}</option>)}</select></label>}
function Field({label,value,onChange,type='text',disabled=false}: {label: ReactNode,value: string,onChange: (value: string)=>void,type?: string,disabled?: boolean}){return <label className="field"><span>{label}</span><input type={type} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label>}
function CreatedUserDialog({data,onClose}: {data: AnyRecord,onClose: ()=>void}){const tx=useTx();return <ObserverDialog width="compact" title={data.demo?tx('Ο demo χρήστης δημιουργήθηκε','Demo user created'):tx('Η πρόσκληση ολοκληρώθηκε','Invitation complete')} onClose={onClose}><div className="management-invite-result"><ShieldCheck size={28}/><strong>{data.demo?tx('Τοπικός demo λογαριασμός','Local demo account'):data.emailSent===false?tx('Ο λογαριασμός συνδέθηκε','The account was linked'):tx('Η πρόσκληση στάλθηκε','The invitation was sent')}</strong><p>{data.demo?tx('Η ενέργεια χρησιμοποιεί μόνο demo δεδομένα και δεν δημιούργησε πραγματικό λογαριασμό ή email.','This used demo data only and created no real account or email.'):data.emailSent===false?tx('Υπάρχων λογαριασμός συνδέθηκε με τον οργανισμό.','An existing account was linked to the organization.'):tx('Ο χρήστης θα ενεργοποιήσει την πρόσβασή του από την πρόσκληση που έλαβε στο email.','The user will activate their access from the invitation in their email.')}</p><small>Username: {data.username||'—'}</small>{data.employeeLinked&&<small>{tx('Η καρτέλα εργαζομένου συνδέθηκε.','The employee record was linked.')}</small>}</div><DialogActions><Button onClick={onClose}>{tx('Κλείσιμο','Close')}</Button></DialogActions></ObserverDialog>}
// One user, in place of the list: the role (and the department of a department role) and the screen guides with
// one «Save»; the account actions (invitation link, password reset, suspension, deletion) in the «…».
function UserAccessView({user,departments=[],t,busy,readOnly=false,selfProtected=false,previewProtected=false,organizationId,ownerTools=false,onBack,onAction}: {user: UserRow,departments?: LibraryDepartment[],t: T,busy: boolean,readOnly?: boolean,selfProtected?: boolean,previewProtected?: boolean,organizationId?: string,ownerTools?: boolean,onBack: ()=>void,onAction: (action: string,payload?: AnyRecord)=>unknown}){const tx=useTx(),{language}=useLanguage()
 const [role,setRole]=useState(user.role),[departmentId,setDepartmentId]=useState(user.departmentId||''),[guides,setGuides]=useState(user.screenGuides||'default')
 const scoped=needsDepartment(role),active=user.status==='active',rightsLocked=readOnly||selfProtected
 const roleChanged=role!==user.role||(scoped&&departmentId!==(user.departmentId||'')),guidesChanged=guides!==(user.screenGuides||'default')
 async function save(){if(roleChanged)await onAction('update',{role,departmentId:scoped?departmentId:null});if(guidesChanged)await onAction('screen_guides',{screenGuides:guides})}
 const actions=readOnly?null:<div className="row-actions">
  {user.status==='invited'&&!selfProtected&&<Button recordMenu variant="secondary" onClick={()=>onAction('invitation_link')}><Link2 size={15}/>{tx('Σύνδεσμος πρόσκλησης','Invitation link')}</Button>}
  <Button recordMenu variant="secondary" onClick={()=>onAction('reset_password')}><KeyRound size={15}/>{tx('Επαναφορά κωδικού','Reset password')}</Button>
  {!selfProtected&&<Button recordMenu variant="secondary" onClick={()=>onAction(active?'suspend':'reactivate')}>{active?<CirclePause size={15}/>:<RotateCcw size={15}/>}{active?tx('Παύση πρόσβασης','Suspend access'):tx('Ενεργοποίηση πρόσβασης','Reactivate access')}</Button>}
  {!selfProtected&&<Button recordMenu variant="secondary" onClick={()=>onAction('delete')}><Trash2 size={15}/>{tx('Διαγραφή λογαριασμού σύνδεσης','Delete sign-in account')}</Button>}
 </div>
 return <EntityRecordShell className="management-user-shell" avatar={<UserRound size={19}/>} eyebrow={user.username} title={language==='en'&&user.nameEn?user.nameEn:user.name} subtitle={user.email||'—'}
  status={<span className={`status-badge ${active?'active':user.status==='disabled'?'danger':'temporary'}`}>{managementMemberStatusLabel(user.status,language)}</span>} headerActions={actions} onBack={onBack}>
  <RecordTabPanel title={tx('Πρόσβαση','Access')} subtitle={tx('Τι βλέπει και τι διαχειρίζεται ο χρήστης σε αυτό το νοσοκομείο.','What the user sees and manages in this hospital.')}
   footer={!readOnly&&<div className="inline-edit-footer"><Button variant="secondary" onClick={onBack}>{tx('Ακύρωση','Cancel')}</Button><SaveButton disabled={busy||!(roleChanged&&!rightsLocked||guidesChanged)||(scoped&&!departmentId)} onClick={save}>{tx('Αποθήκευση','Save')}</SaveButton></div>}>
   <div className="management-user-body">
    {(readOnly||selfProtected)&&<div className="management-user-preserve-note"><ShieldCheck size={15}/><span>{previewProtected?tx('Βλέπετε την εφαρμογή ως Διαχειριστής Νοσοκομείου. Ο λογαριασμός του Διαχειριστή είναι μόνο για προβολή στην προεπισκόπηση ρόλου.','You are viewing the app as Hospital Administrator. The administrator account is view-only in the role preview.'):tx('Ο δικός σας ρόλος και τα δικαιώματα πρόσβασης είναι κλειδωμένα. Μπορούν να αλλάξουν μόνο από άλλον εξουσιοδοτημένο διαχειριστή ή τον Ιδιοκτήτη πλατφόρμας.','Your own role and access rights are locked. Only another authorized administrator or the Platform Owner can change them.')}</span></div>}
    <div className="entry-form-grid">
     <label className="field"><span>{t('roleLabel')}</span><select value={role} disabled={rightsLocked} onChange={e=>setRole(e.target.value)}>{creatableManagementRoles.map(r=><option key={r} value={r}>{t(managementRoleNames[r]??r)}</option>)}</select></label>
     {scoped&&<DepartmentField departments={departments} value={departmentId} disabled={rightsLocked} onChange={setDepartmentId}/>}
     {!readOnly&&<ScreenGuideField value={guides} disabled={busy} onChange={setGuides}/>}
    </div>
    {ownerTools&&<SupplierRenewalSenderField organizationId={organizationId} membershipId={user.id} userId={user.userId} disabled={busy}/>}
   </div>
  </RecordTabPanel>
 </EntityRecordShell>
}
// Screen guides for this user in this hospital: as the hospital, or on / off.
function ScreenGuideField({value,onChange,disabled=false}: {value: string,onChange: (value: string)=>void,disabled?: boolean}){const tx=useTx();return <label className="field"><span>{tx('Οδηγοί οθονών','Screen guides')}</span><select value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="default">{tx('Όπως το νοσοκομείο','As the hospital')}</option><option value="on">{tx('Ναι, να εμφανίζονται','Yes, show them')}</option><option value="off">{tx('Όχι','No')}</option></select></label>}
