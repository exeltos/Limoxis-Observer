import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, BriefcaseBusiness, FileCheck2, GraduationCap, HeartPulse, KeyRound, Pencil, ShieldCheck, Syringe, Trash2, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { SaveButton } from '../../design-system/SaveButton'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { ObserverDialog, DialogActions } from '../../design-system/ObserverDialog'
import { AttachmentField } from '../../design-system/AttachmentField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { loadOccupationalVisitsAsync, loadVaccinationsAsync, loadEmployeeTrainingAsync, loadEvaluationsAsync } from './employeeSubRecordsService'
import { createEmployeeAccountAsync, updateEmployeeAsync } from './employeeService'
import { useEmployeeSubRecords } from './useEmployeeSubRecords'
import { useEmployeesData } from './useEmployeesData'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { ManualDateField } from '../../design-system/ManualDateField'
import { EmployeeSurveillanceFlow } from '../surveillance/EmployeeSurveillanceFlow'
import { getEmployeeSurveillanceForEmployee } from '../surveillance/employeeSurveillanceData'
import { useAuth } from '../../core/auth/AuthContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { loadDepartments } from '../management/departmentsService'
import { loadManagementLibraries } from '../management/managementCloudService'

export function EmployeeRecordPage({selfMode=false}){
  const {employeeId}=useParams()
  const navigate=useNavigate()
  const {data:employeeRows,loading:employeesLoading,error:employeesError,reload:reloadEmployees}=useEmployeesData()
  const {goBack,restored}=useContextualNavigation('/employees')
  const {t,language,locale}=useLanguage()
  const {confirm,notify}=useFeedback()
  const {role,membership,canAccessRecord,canSeeSensitiveEmployeeHealth,isDemo,tenant}=useTenant()
  const {user,profile}=useAuth()
  const [accountOpen,setAccountOpen]=useState(false)
  const [accountSaving,setAccountSaving]=useState(false)
  const [departments,setDepartments]=useState([])
  const [professionalCategories,setProfessionalCategories]=useState([])

  useEffect(()=>{
    let active=true
    if(!tenant?.id){setDepartments([]);setProfessionalCategories([]);return()=>{active=false}}
    Promise.all([loadDepartments(tenant.id),loadManagementLibraries(tenant.id)]).then(([departmentRows,libraries])=>{
      if(!active)return
      setDepartments((departmentRows||[]).filter(row=>row.is_active!==false))
      setProfessionalCategories(libraries?.professionalCategories||[])
    }).catch(()=>{if(active){setDepartments([]);setProfessionalCategories([])}})
    return()=>{active=false}
  },[tenant?.id])

  const selfEmployee=useMemo(()=>{
    if(!selfMode)return null
    const explicitId=membership?.employeeId||membership?.employee_id||membership?.profile?.employeeId||profile?.employeeId||profile?.employee_id
    if(explicitId){const exact=employeeRows.find(x=>x.id===explicitId);if(exact)return exact}
    const linkedUserId=profile?.id||user?.id
    if(linkedUserId){const byUser=employeeRows.find(x=>x.userId===linkedUserId);if(byUser)return byUser}
    const identityEmail=(profile?.email||user?.email||'').trim().toLowerCase()
    if(identityEmail){const byEmail=employeeRows.find(x=>(x.email||'').trim().toLowerCase()===identityEmail);if(byEmail)return byEmail}
    const platformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)
    if(platformOwner){
      const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'Platform Owner'
      const parts=String(fullName).trim().split(/\s+/).filter(Boolean)
      const firstName=parts[0]||'Platform'
      const lastName=parts.slice(1).join(' ')||'Owner'
      return {id:'PLATFORM-OWNER',dbId:null,userId:profile?.id||user?.id||null,firstName,lastName,firstNameEn:firstName,lastNameEn:lastName,email:profile?.contactEmail||profile?.email||user?.email||'',profession:'Platform Owner',professionEn:'Platform Owner',department:'Πλατφόρμα',departmentEn:'Platform',employmentStatus:'active',hireDate:'',employeeCode:'PLATFORM-OWNER'}
    }
    if(isDemo)return employeeRows.find(x=>x.id==='EMP-001')||employeeRows[0]||null
    return null
  },[selfMode,membership,profile,user?.id,user?.email,isDemo,employeeRows])

  const id=selfMode?selfEmployee?.id:(employeeId||null)
  const employee=selfMode?selfEmployee:employeeRows.find(x=>x.id===id)||null
  const currentUserId=profile?.id||user?.id||null
  const currentEmail=(profile?.contactEmail||profile?.email||user?.email||'').trim().toLowerCase()
  const isOwnEmployee=Boolean(employee&&((currentUserId&&employee.userId===currentUserId)||(currentEmail&&String(employee.email||'').trim().toLowerCase()===currentEmail)))
  const selfReadOnly=Boolean(selfMode||isOwnEmployee)
  const recordNavigation=useRecordSequenceNavigation({registry:'employees',currentId:id,pathForId:nextId=>`/employees/${nextId}`})
  const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
  const canAdmin=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,addOns,custom)&&!selfReadOnly
  const canManageUsers=can(role,CAPABILITIES.MANAGE_USERS,addOns,custom)&&!selfReadOnly
  const canOccupational=(can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,custom)||can(role,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,addOns,custom))&&canSeeSensitiveEmployeeHealth
  const canTraining=can(role,CAPABILITIES.VIEW_TRAINING,addOns,custom)
  const tabs=useMemo(()=>[
    {id:'details',label:t('employeesRecords.employeeDetailsTab'),icon:UserRound,show:true},
    {id:'occupational',label:t('occupationalHealth'),icon:HeartPulse,show:canOccupational||selfMode},
    {id:'vaccinations',label:t('vaccinations'),icon:Syringe,show:canOccupational||selfMode},
    {id:'surveillance',label:t('surveillance'),icon:Activity,show:canSeeSensitiveEmployeeHealth&&(canOccupational||selfMode)},
    {id:'training',label:t('training'),icon:GraduationCap,show:canTraining||selfMode},
    {id:'evaluations',label:t('evaluations'),icon:FileCheck2,show:canAdmin||selfMode},
    {id:'certificates',label:t('employeesRecords.certificatesDocuments'),icon:BriefcaseBusiness,show:true},
    {id:'history',label:t('history'),icon:ShieldCheck,show:canOccupational||canAdmin},
  ].filter(x=>x.show),[t,canAdmin,canOccupational,canTraining,canSeeSensitiveEmployeeHealth,selfMode])
  const [tab,setTab]=useState(()=>restored?.tab||'details'),[surveillanceOpen,setSurveillanceOpen]=useState(false),[surveillanceVersion,setSurveillanceVersion]=useState(0)
  const selfProfileTabs=useMemo(()=>[
    {id:'details',label:t('employeesRecords.employeeDetailsTab'),icon:UserRound},
    {id:'occupational',label:t('occupationalHealth'),icon:HeartPulse},
    {id:'vaccinations',label:t('vaccinations'),icon:Syringe},
    {id:'surveillance',label:t('surveillance'),icon:Activity},
    {id:'training',label:t('training'),icon:GraduationCap},
    {id:'evaluations',label:t('evaluations'),icon:FileCheck2},
    {id:'certificates',label:t('employeesRecords.certificatesDocuments'),icon:BriefcaseBusiness},
  ],[t])

  if(employeesLoading)return <RouteLoading/>
  if(employeesError)return <Page title={t('employees')}><div className="data-access-state error" role="alert"><span>{language==='en'?'Could not load employees.':'Δεν ήταν δυνατή η φόρτωση του προσωπικού.'}</span><Button variant="secondary" onClick={reloadEmployees}>{language==='en'?'Retry':'Επανάληψη'}</Button></div></Page>
  if(!employee){
    const platformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)
    const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'—'
    const email=profile?.contactEmail||profile?.email||user?.email||'—'
    const initials=String(fullName||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'L'
    return <Page fill title={selfMode?t('employeesRecords.myProfile'):t('employees')} subtitle={selfMode?(platformOwner?(language==='en'?'Platform account identity and access context.':'Στοιχεία λογαριασμού πλατφόρμας και πλαισίου πρόσβασης.'):(language==='en'?'Account identity and personal employee record.':'Στοιχεία λογαριασμού και προσωπική καρτέλα εργαζομένου.')):undefined}>
      <EntityRecordShell className="employee-record-shell workspace-fill my-profile-unlinked-shell" avatar={initials} eyebrow={platformOwner?(language==='en'?'PLATFORM ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'):(language==='en'?'MY PROFILE':'ΤΟ ΠΡΟΦΙΛ ΜΟΥ')} title={fullName} subtitle={email} status={<span className="status-badge active">{language==='en'?'Active':'Ενεργός'}</span>} tabs={selfProfileTabs} activeTab={tab} onTabChange={setTab} onBack={()=>navigate('/')} backLabel={t('back')}>
        {tab==='details'&&<><SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/><UnlinkedProfileTab tab="details" platformOwner={platformOwner} language={language}/></>}
        {tab!=='details'&&<UnlinkedProfileTab tab={tab} platformOwner={platformOwner} language={language}/>} 
      </EntityRecordShell>
    </Page>
  }
  const employeeInScope=selfMode||canAccessRecord({...employee,department:employee.department})
  if(!employeeInScope)return <Page title={t('employees')}><div className="inline-empty">{language==='en'?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>
  const name=language==='el'?`${employee.lastName} ${employee.firstName}`:`${employee.firstNameEn} ${employee.lastNameEn}`
  const fmt=v=>v?new Intl.DateTimeFormat(locale).format(new Date(`${v}T12:00:00`)):'—'
  async function deleteEmployee(){if(selfReadOnly)return;const ok=await confirm({title:t('employeesRecords.deleteEmployee'),message:t('employeesRecords.confirmEmployeeDelete'),confirmLabel:t('delete'),danger:true});if(ok){notify(t('employeesRecords.employeeDeleted'),'success');navigate('/employees')}}
  async function createAccount(values){if(selfReadOnly)return;setAccountSaving(true);try{await createEmployeeAccountAsync(tenant?.id,employee,values);notify(language==='en'?'User account created and linked to this employee.':'Ο λογαριασμός χρήστη δημιουργήθηκε και συνδέθηκε με τον εργαζόμενο.','success');setAccountOpen(false);await reloadEmployees()}catch(error){notify(error?.message||(language==='en'?'Could not create the account.':'Δεν ήταν δυνατή η δημιουργία του λογαριασμού.'),'error')}finally{setAccountSaving(false)}}
  const departmentOptions=departments.map(row=>[row.name,row.nameEn||row.name])
  const headerActions=!selfReadOnly&&canSeeSensitiveEmployeeHealth&&canOccupational?<ActionButton tone="primary" label={t('newSurveillance')} onClick={()=>setSurveillanceOpen(true)}><span>+ {t('newSurveillance')}</span></ActionButton>:null
  return <Page fill title={name} subtitle={t('employeesRecords.employeeFullRecordSubtitle')}>
    <EntityRecordShell className={`employee-record-shell workspace-fill${selfReadOnly?' employee-self-readonly':''}`} avatar={`${employee.firstName?.[0]||''}${employee.lastName?.[0]||''}`} eyebrow={employee.id} title={name} subtitle={`${language==='el'?employee.profession:employee.professionEn} · ${language==='el'?employee.department:employee.departmentEn}`} status={<span className={`status-badge ${employee.employmentStatus==='active'?'active':''}`}>{t(employee.employmentStatus)}</span>} recordNavigation={selfMode?null:recordNavigation} headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={selfMode?()=>navigate('/'):goBack} backLabel={t('back')}>
      {selfReadOnly&&<div className="source-truth-note"><ShieldCheck size={16}/><div><strong>{language==='en'?'Your employee record is read-only':'Η προσωπική σας καρτέλα είναι μόνο για προβολή'}</strong><span>{language==='en'?'You cannot edit, delete or perform administrative actions on your own employee record.':'Δεν μπορείτε να επεξεργαστείτε, να διαγράψετε ή να εκτελέσετε διοικητικές ενέργειες στη δική σας καρτέλα.'}</span></div></div>}
      {tab==='details'&&<Details employee={employee} t={t} language={language} fmt={fmt} canAdmin={canAdmin} canManageUsers={canManageUsers} onCreateAccount={()=>!selfReadOnly&&setAccountOpen(true)} deleteEmployee={deleteEmployee} notify={notify} organizationId={tenant?.id} departmentOptions={departmentOptions} professionOptions={professionalCategories} reloadEmployees={reloadEmployees} onCodeChanged={newCode=>navigate(`/employees/${encodeURIComponent(newCode)}`,{replace:true})}/>} 
      {tab==='occupational'&&<Occupational employee={employee} t={t} fmt={fmt} organizationId={tenant?.id} readOnly={selfReadOnly}/>} 
      {tab==='vaccinations'&&<Vaccinations employee={employee} t={t} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='surveillance'&&<EmployeeSurveillance employee={employee} t={t} language={language} fmt={fmt} version={surveillanceVersion} readOnly={selfReadOnly} onNew={()=>!selfReadOnly&&setSurveillanceOpen(true)}/>} 
      {tab==='training'&&<Training employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='evaluations'&&<Evaluations employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='certificates'&&<Certificates employee={employee} t={t} language={language} selfMode={selfReadOnly} canAdmin={canAdmin} organizationId={tenant?.id}/>} 
      {tab==='history'&&<History employee={employee} t={t} language={language}/>} 
    </EntityRecordShell>
    {surveillanceOpen&&!selfReadOnly&&<EmployeeSurveillanceFlow employee={employee} onClose={()=>setSurveillanceOpen(false)} onCreated={()=>setSurveillanceVersion(v=>v+1)}/>} 
    {accountOpen&&!selfReadOnly&&<EmployeeAccountDialog employee={employee} language={language} saving={accountSaving} onClose={()=>setAccountOpen(false)} onCreate={createAccount}/>} 
  </Page>
}

function UnlinkedProfileTab({tab,platformOwner,language}){
  const en=language==='en'
  const labels={occupational:en?'Occupational Health':'Ιατρός Εργασίας',vaccinations:en?'Vaccinations':'Εμβολιασμοί',surveillance:en?'Surveillance':'Επιτήρηση',training:en?'Training':'Εκπαίδευση',evaluations:en?'Evaluations':'Αξιολογήσεις',certificates:en?'Certificates & documents':'Πιστοποιήσεις / Έγγραφα',details:en?'Employee record':'Καρτέλα εργαζομένου'}
  const title=labels[tab]||labels.details
  const message=platformOwner?(en?'This Platform Owner account is not a hospital employee identity. This tab remains visible for a consistent profile structure, but employee data does not apply to this account.':'Ο λογαριασμός Platform Owner δεν αποτελεί ταυτότητα εργαζομένου νοσοκομείου. Η καρτέλα παραμένει ορατή για σταθερή δομή του προφίλ, αλλά τα δεδομένα εργαζομένου δεν εφαρμόζονται σε αυτόν τον λογαριασμό.'):(en?'No employee record is linked to this account yet. Link the user from Organization → Users to load the real personal data in this tab.':'Δεν έχει συνδεθεί ακόμη καρτέλα εργαζομένου με αυτόν τον λογαριασμό. Συνδέστε τον χρήστη από Οργανισμός → Χρήστες για να φορτωθούν εδώ τα πραγματικά προσωπικά δεδομένα.')
  return <section className="my-profile-tab-state"><div className="my-profile-unlinked-icon">—</div><div><strong>{title}</strong><span>{message}</span></div></section>
}

function SelfAccountSummary({profile,user,role,membership,tenant,language}){
  const en=language==='en'
  const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'—'
  const email=profile?.contactEmail||profile?.email||user?.email||'—'
  const username=profile?.username||user?.user_metadata?.username||'—'
  const isPlatformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)
  const organization=isPlatformOwner?(en?'Platform account':'Λογαριασμός πλατφόρμας'):(tenant?.name||tenant?.organization_name||'—')
  const membershipStatus=membership?.status||'active'
  const active=membershipStatus!=='disabled'&&membershipStatus!=='suspended'
  const initials=String(fullName||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'L'
  return <section className="surface my-profile-hero" aria-label={en?'Account details':'Στοιχεία λογαριασμού'}><div className="my-profile-avatar">{initials}</div><div className="my-profile-identity"><span>{isPlatformOwner?(en?'PLATFORM ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'):(en?'ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ')}</span><h2>{fullName}</h2><p>{email}</p></div><span className={`status-badge ${active?'active':'danger'}`}>{active?(en?'Active':'Ενεργός'):(en?'Suspended':'Σε παύση')}</span><div className="my-profile-grid my-profile-account-grid"><div className="my-profile-value"><span className="my-profile-value-label">Username</span><strong>{username}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">{en?'Role':'Ρόλος'}</span><strong>{roleLabel(role,language)}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">{en?'Organization':'Οργανισμός'}</span><strong>{organization}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">Email</span><strong>{email}</strong></div></div></section>
}

function Details({employee,t,language,fmt,canAdmin,canManageUsers,onCreateAccount,deleteEmployee,notify,organizationId,departmentOptions,professionOptions,reloadEmployees,onCodeChanged}){
  const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[record,setRecord]=useState({...employee})
  useEffect(()=>setRecord({...employee}),[employee])
  const set=(k,v)=>setRecord(r=>({...r,[k]:v}))
  const cancel=()=>{setRecord({...employee});setEditing(false)}
  async function save(){
    if(saving)return
    const nextCode=String(record.id||'').trim()
    if(!nextCode){notify(language==='en'?'Employee / folder code is required.':'Ο κωδικός εργαζομένου / φακέλου είναι υποχρεωτικός.','danger');return}
    setSaving(true)
    try{
      const updated=await updateEmployeeAsync(organizationId,employee.dbId,{...record,id:nextCode},employee.id)
      await reloadEmployees?.()
      setEditing(false)
      notify(t('employeesRecords.employeeUpdated'),'success')
      if(updated.id!==employee.id)onCodeChanged?.(updated.id)
    }catch(error){
      if(error?.message==='DUPLICATE_EMPLOYEE_CODE')notify(language==='en'?'This employee / folder code is already in use.':'Ο κωδικός εργαζομένου / φακέλου χρησιμοποιείται ήδη.','danger')
      else notify(error?.message||(language==='en'?'Could not update the employee.':'Δεν ήταν δυνατή η ενημέρωση του εργαζομένου.'),'error')
    }finally{setSaving(false)}
  }
  const actions=canAdmin&&!editing?[{id:'edit',label:t('employeesRecords.editEmployee'),icon:Pencil,onClick:()=>setEditing(true)},{id:'delete',label:t('employeesRecords.deleteEmployee'),icon:Trash2,tone:'danger',separatorBefore:true,onClick:deleteEmployee}]:[]
  return <div className="record-section committee-overview employee-details-overview">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeesRecords.employeeAdministrativeData')}</span><h3>{t('employeesRecords.basicDetails')}</h3></div>{actions.length>0&&<OverflowMenu label={language==='en'?'Employee actions':'Ενέργειες εργαζομένου'} items={actions}/>}</div>
    <div className={`committee-detail-grid employee-full-grid ${editing?'employee-inline-edit':''}`}>
      <InlineDetail editing={editing} l={language==='en'?'Employee / folder code':'Κωδικός εργαζομένου / φακέλου'} v={record.id} onChange={v=>set('id',v)}/>
      <InlineDetail editing={editing} l={t('firstName')} v={record.firstName} onChange={v=>set('firstName',v)}/>
      <InlineDetail editing={editing} l={t('lastName')} v={record.lastName} onChange={v=>set('lastName',v)}/>
      <InlineDetail editing={editing} l={t('fatherName')} v={language==='el'?record.fatherName:record.fatherNameEn} onChange={v=>set(language==='el'?'fatherName':'fatherNameEn',v)}/>
      <InlineSelect editing={editing} l={t('department')} v={record.department} display={language==='el'?record.department:record.departmentEn} options={departmentOptions} language={language} onChange={v=>set('department',v)}/>
      <InlineSelect editing={editing} l={t('professionalCategory')} v={record.profession} display={language==='el'?record.profession:record.professionEn} options={professionOptions} language={language} onChange={v=>set('profession',v)}/>
      <InlineDateDetail editing={editing} l={t('employeesRecords.hireDate')} v={record.hireDate} display={fmt(record.hireDate)} onChange={v=>set('hireDate',v)}/>
      <InlineDetail editing={editing} l={t('employeesRecords.email')} v={record.email} onChange={v=>set('email',v)}/>
      <InlineDetail editing={editing} l={t('phone')} v={record.phone} onChange={v=>set('phone',v)}/>
    </div>
    {!editing&&canManageUsers&&<div className="source-truth-note"><KeyRound size={16}/><div><strong>{employee.accountLinked?(language==='en'?'Linked user account':'Συνδεδεμένος λογαριασμός χρήστη'):(language==='en'?'No user account':'Δεν υπάρχει λογαριασμός χρήστη')}</strong><span>{employee.accountLinked?(language==='en'?'This employee is linked to an authenticated Limoxis Observer account.':'Ο εργαζόμενος είναι συνδεδεμένος με πιστοποιημένο λογαριασμό Limoxis Observer.'):(language==='en'?'Create an account so personal training, approvals and self-service actions are tied to this employee.':'Δημιουργήστε λογαριασμό ώστε οι προσωπικές εκπαιδεύσεις, εγκρίσεις και self-service ενέργειες να συνδέονται με τον συγκεκριμένο εργαζόμενο.')}</span></div>{!employee.accountLinked&&<Button variant="secondary" onClick={onCreateAccount}>{language==='en'?'Create account':'Δημιουργία λογαριασμού'}</Button>}</div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" disabled={saving} onClick={cancel}>{t('cancel')}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{t('save')}</SaveButton></div>}
  </div>
}

function EmployeeAccountDialog({employee,language,saving,onClose,onCreate}){const [email,setEmail]=useState(employee.email||''),[phone,setPhone]=useState(employee.phone||''),[jobTitle,setJobTitle]=useState(employee.profession||''),[role,setRole]=useState('staff_user');const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());return <ObserverDialog width="wide" eyebrow={language==='en'?'Employee account':'Λογαριασμός εργαζομένου'} title={language==='en'?'Create and link account':'Δημιουργία και σύνδεση λογαριασμού'} subtitle={language==='en'?`${employee.firstName} ${employee.lastName} will be linked directly to this account.`:`Ο λογαριασμός θα συνδεθεί απευθείας με τον εργαζόμενο ${employee.firstName} ${employee.lastName}.`} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onCreate({email:email.trim(),phone:phone.trim(),jobTitle:jobTitle.trim(),role})} disabled={!valid||saving}/>}><div className="entry-grid"><label><span>Email *</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label><span>{language==='en'?'Phone':'Τηλέφωνο'}</span><input value={phone} onChange={e=>setPhone(e.target.value)}/></label><label><span>{language==='en'?'Job title':'Ιδιότητα'}</span><input value={jobTitle} onChange={e=>setJobTitle(e.target.value)}/></label><label><span>{language==='en'?'Account role':'Ρόλος λογαριασμού'}</span><select value={role} onChange={e=>setRole(e.target.value)}><option value="staff_user">{language==='en'?'Staff user':'Εργαζόμενος'}</option><option value="department_user">{language==='en'?'Department user':'Χρήστης τμήματος'}</option><option value="department_manager">{language==='en'?'Department manager':'Προϊστάμενος τμήματος'}</option><option value="link_nurse">Link Nurse</option><option value="laboratory">{language==='en'?'Laboratory':'Εργαστήριο'}</option></select></label></div></ObserverDialog>}
function InlineDetail({editing,l,v,display,onChange,type='text'}){if(editing&&type==='date')return <ManualDateField className="detail-item detail-field editable" label={l} value={v||''} onChange={onChange}/>;return <div className={`detail-item detail-field ${editing?'editable':''}`}><span>{l}</span>{editing?<input type={type} value={v||''} onChange={e=>onChange?.(e.target.value)}/>:<strong>{display??v??'—'}</strong>}</div>}
function InlineSelect({editing,l,v,display,options=[],language,onChange}){const rows=Array.isArray(options)?options:[];const hasCurrent=rows.some(row=>(row?.[0]??'')===v);return <div className={`detail-item detail-field ${editing?'editable':''}`}><span>{l}</span>{editing?<select value={v||''} onChange={e=>onChange(e.target.value)}>{v&&!hasCurrent&&<option value={v}>{display||v}</option>}{rows.map((row,index)=>{const el=row?.[0]??row?.name??'';const en=row?.[1]??row?.nameEn??el;return <option key={`${el}-${index}`} value={el}>{language==='el'?el:en}</option>})}</select>:<strong>{display||'—'}</strong>}</div>}
function InlineDateDetail(props){return <InlineDetail {...props} type="date"/>}

function Occupational({employee,t,fmt,organizationId,readOnly=false}){const {data:rows}=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id);const [attachments,setAttachments]=useState(()=>employee.occupationalAttachments||[]);return <div className="record-section"><SectionTitle t={t} title="occupationalHealth"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{fmt(x.date)}</strong><span>{t(x.type)}</span><small>{t('fitnessStatus')}: {t(x.fitStatus)} · {t('followUp')}: {fmt(x.followUpDate)}</small></article>):<Empty t={t}/>}</div><AttachmentField disabled={readOnly} value={attachments} onChange={setAttachments}/></div>}
function Vaccinations({employee,t,fmt,organizationId}){const {data:rows}=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id);return <div className="record-section"><SectionTitle t={t} title="vaccinations"/><div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard"><strong>{x.vaccine}</strong><span>{t('dose')}: {x.dose}</span><small>{fmt(x.date)} · {t('validUntil')}: {fmt(x.validUntil)} · {t(x.status)}</small></article>):<Empty t={t}/>}</div></div>}

function Training({employee,t,language,fmt,organizationId}){
  const {data:rows}=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id)
  const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  useEffect(()=>{if(page!==safePage)setPage(safePage)},[page,safePage])
  return <div className="record-section employee-secondary-registry"><SectionTitle t={t} title="training"/>{rows.length?<><div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{t('employeesRecords.trainingTitle')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead><tbody>{pagedRows.map(x=><tr key={x.id}><td><strong>{language==='el'?x.titleEl:x.titleEn}</strong></td><td>{fmt(x.date)}</td><td><span className="status-badge active">{t(x.status)}</span></td></tr>)}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/></>:<RegistryEmpty language={language} title={language==='en'?'No training records':'Δεν υπάρχουν εκπαιδεύσεις'}/>}</div>
}

function Evaluations({employee,t,language,fmt,organizationId}){
  const {data:rows}=useEmployeeSubRecords(loadEvaluationsAsync,organizationId,employee.dbId,employee.id)
  const [selected,setSelected]=useState(null),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(15)
  const titleOf=x=>language==='el'?(x.titleEl||x.titleEn):(x.titleEn||x.titleEl)
  const resultOf=x=>language==='el'?(x.resultEl||x.resultEn):(x.resultEn||x.resultEl)
  const totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),safePage=Math.min(page,totalPages),pagedRows=rows.slice((safePage-1)*pageSize,safePage*pageSize)
  useEffect(()=>{if(page!==safePage)setPage(safePage)},[page,safePage])
  return <div className="record-section employee-secondary-registry">
    <SectionTitle t={t} title="evaluations"/>
    {rows.length?<><div className="scroll-table"><table className="data-table sticky-table record-table-clickable"><thead><tr><th>{language==='en'?'Evaluation':'Αξιολόγηση'}</th><th>{t('date')}</th><th>{language==='en'?'Result':'Αποτέλεσμα'}</th></tr></thead><tbody>{pagedRows.map(x=><tr key={x.id} tabIndex={0} onClick={()=>setSelected(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(x)}}}><td><strong>{titleOf(x)||'—'}</strong></td><td>{fmt(x.date)}</td><td>{resultOf(x)||'—'}</td></tr>)}</tbody></table></div><RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1)}}/></>:<RegistryEmpty language={language} title={language==='en'?'No evaluations':'Δεν υπάρχουν αξιολογήσεις'}/>} 
    {selected&&<ObserverDialog width="wide" eyebrow={language==='en'?'Employee evaluation':'Αξιολόγηση εργαζομένου'} title={titleOf(selected)||'—'} subtitle={fmt(selected.date)} onClose={()=>setSelected(null)}><div className="detail-grid"><div className="detail-item"><span>{language==='en'?'Result':'Αποτέλεσμα'}</span><strong>{resultOf(selected)||'—'}</strong></div>{selected.status&&<div className="detail-item"><span>{t('status')}</span><strong>{t(selected.status)}</strong></div>}{selected.score!=null&&<div className="detail-item"><span>{language==='en'?'Score':'Βαθμολογία'}</span><strong>{selected.score}</strong></div>}{selected.evaluator&&<div className="detail-item"><span>{language==='en'?'Evaluator':'Αξιολογητής'}</span><strong>{selected.evaluator}</strong></div>}</div>{selected.notes&&<div className="source-truth-note"><div><strong>{t('notes')}</strong><span>{selected.notes}</span></div></div>}</ObserverDialog>}
  </div>
}

function Certificates({employee,t,language,selfMode,canAdmin,organizationId}){const [files,setFiles]=useState([]);const canEdit=canAdmin&&!selfMode;return <div className="record-section employee-certificates-attachments"><SectionTitle t={t} title="employeesRecords.certificatesDocuments"/><p className="employee-certificates-hint">{language==='en'?'Upload certificates, attestations or other supporting documents.':'Ανεβάστε πιστοποιήσεις, βεβαιώσεις ή άλλα υποστηρικτικά έγγραφα.'}</p><AttachmentField disabled={!canEdit} value={files} onChange={setFiles} organizationId={organizationId} entityType="employee-certificate" entityId={employee.dbId||employee.id}/></div>}

function EmployeeSurveillance({employee,t,language,fmt,version,onNew,readOnly=false}){
  void version
  const rows=getEmployeeSurveillanceForEmployee(employee.id)
  const [selected,setSelected]=useState(null)
  const value=(label,content)=><div className="detail-item"><span>{label}</span><strong>{content||'—'}</strong></div>
  return <div className="record-section">
    <div className="record-section-header"><SectionTitle t={t} title="surveillance"/>{!readOnly&&<ActionButton tone="primary" label={t('newSurveillance')} onClick={onNew}><span>+ {t('newSurveillance')}</span></ActionButton>}</div>
    <div className="record-card-list">{rows.length?rows.map(x=><article key={x.id} className="record-subcard registry-row-clickable" role="button" tabIndex={0} onClick={()=>setSelected(x)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(x)}}}><strong>{x.id}</strong><span>{fmt(x.startedAt)}</span><small>{x.screeningTypes?.map(type=>t(type)).join(', ')||t(x.status)}</small></article>):<Empty t={t}/>}</div>
    {selected&&<ObserverDialog eyebrow={t('employeeSurveillance')} title={language==='en'?selected.employeeNameEn:selected.employeeName} subtitle={`${selected.id} · ${language==='en'?selected.departmentEn:selected.department}`} width="wide" onClose={()=>setSelected(null)}><div className="detail-grid">{value(t('screeningDate'),fmt(selected.startedAt))}{value(t('screeningType'),selected.screeningTypes?.map(type=>t(type)).join(', '))}{value(t('result'),t(selected.resultStatus||'pending'))}{value(t('status'),t(selected.status||'active'))}{value(t('clinicalRecords.intervention'),selected.noIntervention?t('clinicalRecords.noInterventionPlanned'):(selected.interventionType||selected.intervention||'—'))}{value(t('clinicalRecords.recheck'),selected.noRecheck?t('clinicalRecords.noRecheckPlanned'):(selected.recheckDate?fmt(selected.recheckDate):'—'))}</div>{selected.notes&&<div className="source-truth-note"><div><strong>{t('notes')}</strong><span>{selected.notes}</span></div></div>}</ObserverDialog>}
  </div>
}

function History({employee,t,language}){const rows=[];if(employee.createdAt)rows.push({id:'created',at:employee.createdAt,event:language==='en'?'Employee record created':'Δημιουργία καρτέλας εργαζομένου'});if(employee.updatedAt&&employee.updatedAt!==employee.createdAt)rows.push({id:'updated',at:employee.updatedAt,event:language==='en'?'Employee record updated':'Τελευταία ενημέρωση καρτέλας'});if(employee.accountLinked)rows.push({id:'account',at:null,event:language==='en'?'Linked user account':'Συνδεδεμένος λογαριασμός χρήστη'});const formatDateTime=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat(language==='en'?'en-GB':'el-GR',{dateStyle:'medium',timeStyle:'short'}).format(d)};return <div className="record-section employee-secondary-registry"><SectionTitle t={t} title="history"/>{rows.length?<div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{language==='en'?'Event':'Ενέργεια'}</th><th>{language==='en'?'Date / time':'Ημερομηνία / ώρα'}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.event}</strong></td><td>{formatDateTime(row.at)}</td></tr>)}</tbody></table></div>:<RegistryEmpty language={language} title={language==='en'?'No lifecycle history is available for this record':'Δεν υπάρχουν διαθέσιμες εγγραφές ιστορικού για αυτή την καρτέλα'}/>}</div>}
function SectionTitle({t,title}){return <div className="employee-section-title"><span className="eyebrow">{t(title)}</span><h3>{t(title)}</h3></div>}
function RegistryEmpty({language,title,subtitle=''}){return <div className="registry-empty-state employee-registry-empty"><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div>}
function Empty({t}){return <div className="inline-empty">{t('noData')}</div>}
