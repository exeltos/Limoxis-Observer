import { useEffect,useMemo,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { Activity,BriefcaseBusiness,FileCheck2,GraduationCap,HeartPulse,KeyRound,Pencil,ShieldCheck,Syringe,Trash2,UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { PrintExportActions } from '../../design-system/PrintExportActions'
import { downloadRecordJson } from '../../core/export/recordExport'
import { Button } from '../../design-system/Button'
import { ActionButton } from '../../design-system/ActionButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { SaveButton } from '../../design-system/SaveButton'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { useContextualNavigation } from '../../core/navigation/useContextualNavigation'
import { useRecordSequenceNavigation } from '../../core/navigation/useRecordSequenceNavigation'
import { useAuth } from '../../core/auth/AuthContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { createEmployeeAccountAsync,updateEmployeeAsync } from './employeeService'
import { useEmployeesData } from './useEmployeesData'
import { loadDepartments } from '../management/departmentsService'
import { loadManagementLibraries } from '../management/managementCloudService'
import { demoLibrarySeed } from '../management/managementData'
import { EmployeeSurveillanceFlow } from '../surveillance/EmployeeSurveillanceFlow'
import {
  EmployeeOccupationalTab,
  EmployeeVaccinationsTab,
  EmployeeTrainingTab,
  EmployeeEvaluationsTab,
  EmployeeCertificatesTab,
  EmployeeSurveillanceTab,
  EmployeeHistoryTab,
} from './EmployeeRecordTabs'

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
  const [surveillanceOpen,setSurveillanceOpen]=useState(false)
  const [surveillanceVersion,setSurveillanceVersion]=useState(0)

  useEffect(()=>{
    let active=true
    // Demo mode's tenant.id is the literal string 'demo-hospital', not a real
    // UUID — calling the live loadDepartments/loadManagementLibraries cloud
    // services with it fails with a Postgres invalid-UUID 400. Use the same
    // demoLibrarySeed fixture NewSurveillanceFlow/PatientClinicalCanonicalPage
    // already use for demo departments/libraries instead.
    if(isDemo){
      setDepartments(demoLibrarySeed.departments.map(([elName,enName])=>({id:elName,name:elName,nameEn:enName})))
      setProfessionalCategories(demoLibrarySeed.professionalCategories||[])
      return()=>{active=false}
    }
    if(!tenant?.id){setDepartments([]);setProfessionalCategories([]);return()=>{active=false}}
    Promise.all([loadDepartments(tenant.id),loadManagementLibraries(tenant.id)]).then(([departmentRows,libraries])=>{
      if(!active)return
      setDepartments((departmentRows||[]).filter(row=>row.is_active!==false))
      setProfessionalCategories(libraries?.professionalCategories||[])
    }).catch(()=>{if(active){setDepartments([]);setProfessionalCategories([])}})
    return()=>{active=false}
  },[isDemo,tenant?.id])

  const selfEmployee=useMemo(()=>{
    if(!selfMode)return null
    const explicitId=membership?.employeeId||membership?.employee_id||membership?.profile?.employeeId||profile?.employeeId||profile?.employee_id
    if(explicitId){const exact=employeeRows.find(row=>row.id===explicitId);if(exact)return exact}
    const linkedUserId=profile?.id||user?.id
    if(linkedUserId){const byUser=employeeRows.find(row=>row.userId===linkedUserId);if(byUser)return byUser}
    const identityEmail=(profile?.email||user?.email||'').trim().toLowerCase()
    if(identityEmail){const byEmail=employeeRows.find(row=>(row.email||'').trim().toLowerCase()===identityEmail);if(byEmail)return byEmail}
    const platformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)
    if(platformOwner){
      const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'Platform Owner'
      const parts=String(fullName).trim().split(/\s+/).filter(Boolean)
      const firstName=parts[0]||'Platform',lastName=parts.slice(1).join(' ')||'Owner'
      return {id:'PLATFORM-OWNER',dbId:null,userId:profile?.id||user?.id||null,firstName,lastName,firstNameEn:firstName,lastNameEn:lastName,email:profile?.contactEmail||profile?.email||user?.email||'',profession:'Platform Owner',professionEn:'Platform Owner',department:'Πλατφόρμα',departmentEn:'Platform',employmentStatus:'active',hireDate:'',employeeCode:'PLATFORM-OWNER'}
    }
    if(isDemo)return employeeRows.find(row=>row.id==='EMP-001')||employeeRows[0]||null
    return null
  },[selfMode,membership,profile,user?.id,user?.email,user?.user_metadata?.full_name,isDemo,employeeRows])

  const id=selfMode?selfEmployee?.id:(employeeId||null)
  const employee=selfMode?selfEmployee:employeeRows.find(row=>row.id===id)||null
  const currentUserId=profile?.id||user?.id||null
  const currentEmail=(profile?.contactEmail||profile?.email||user?.email||'').trim().toLowerCase()
  const isOwnEmployee=Boolean(employee&&((currentUserId&&employee.userId===currentUserId)||(currentEmail&&String(employee.email||'').trim().toLowerCase()===currentEmail)))
  const selfReadOnly=Boolean(selfMode||isOwnEmployee)
  const recordNavigation=useRecordSequenceNavigation({registry:'employees',currentId:id,pathForId:nextId=>`/employees/${nextId}`})
  const addOns=membership?.capabilities??[],custom=membership?.customCapabilities??[]
  const canAdmin=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,addOns,custom)&&!selfReadOnly
  const canManageUsers=can(role,CAPABILITIES.MANAGE_USERS,addOns,custom)&&!selfReadOnly
  const canOccupational=(can(role,CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,addOns,custom)||can(role,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,addOns,custom))&&canSeeSensitiveEmployeeHealth
  const canManageEmployeeFollowup=(isDemo||can(role,CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,addOns,custom))&&!selfReadOnly
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
  ].filter(item=>item.show),[t,canAdmin,canOccupational,canTraining,canSeeSensitiveEmployeeHealth,selfMode])
  const [tab,setTab]=useState(()=>restored?.tab||'details')
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
    const initials=String(fullName||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'L'
    return <Page fill title={selfMode?t('employeesRecords.myProfile'):t('employees')} subtitle={selfMode?(platformOwner?(language==='en'?'Platform account identity and access context.':'Στοιχεία λογαριασμού πλατφόρμας και πλαισίου πρόσβασης.'):(language==='en'?'Account identity and personal employee record.':'Στοιχεία λογαριασμού και προσωπική καρτέλα εργαζομένου.')):undefined}>
      <EntityRecordShell className="employee-record-shell workspace-fill my-profile-unlinked-shell" avatar={initials} eyebrow={platformOwner?(language==='en'?'PLATFORM ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'):(language==='en'?'MY PROFILE':'ΤΟ ΠΡΟΦΙΛ ΜΟΥ')} title={fullName} subtitle={email} status={<span className="status-badge active">{language==='en'?'Active':'Ενεργός'}</span>} tabs={selfProfileTabs} activeTab={tab} onTabChange={setTab} onBack={()=>navigate('/')} backLabel={t('back')}>
        {tab==='details'&&<><SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/><UnlinkedProfileTab tab="details" platformOwner={platformOwner} language={language}/></>}
        {tab!=='details'&&<UnlinkedProfileTab tab={tab} platformOwner={platformOwner} language={language}/>} 
      </EntityRecordShell>
    </Page>
  }

  if(!(selfMode||canAccessRecord({...employee,department:employee.department})))return <Page title={t('employees')}><div className="inline-empty">{language==='en'?'You do not have access to this record.':'Δεν έχετε πρόσβαση σε αυτή την εγγραφή.'}</div></Page>
  const name=language==='el'?`${employee.lastName} ${employee.firstName}`:`${employee.firstNameEn||employee.firstName} ${employee.lastNameEn||employee.lastName}`
  const fmt=value=>value?new Intl.DateTimeFormat(locale).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'—'
  async function deleteEmployee(){if(selfReadOnly)return;const ok=await confirm({title:t('employeesRecords.deleteEmployee'),message:t('employeesRecords.confirmEmployeeDelete'),confirmLabel:t('delete'),danger:true});if(ok){notify(t('employeesRecords.employeeDeleted'),'success');navigate('/employees')}}
  async function createAccount(values){if(selfReadOnly)return;setAccountSaving(true);try{await createEmployeeAccountAsync(tenant?.id,employee,values);notify(language==='en'?'User account created and linked to this employee.':'Ο λογαριασμός χρήστη δημιουργήθηκε και συνδέθηκε με τον εργαζόμενο.','success');setAccountOpen(false);await reloadEmployees()}catch(error){notify(error?.message||(language==='en'?'Could not create the account.':'Δεν ήταν δυνατή η δημιουργία του λογαριασμού.'),'error')}finally{setAccountSaving(false)}}
  const departmentOptions=departments.map(row=>[row.name,row.nameEn||row.name])
  const headerActions=<>{!selfReadOnly&&canOccupational&&<ActionButton tone="primary" label={t('newSurveillance')} onClick={()=>setSurveillanceOpen(true)}><span>+ {t('newSurveillance')}</span></ActionButton>}<PrintExportActions onExport={()=>downloadRecordJson(employee,{filename:employee?.id})}/></>

  return <Page fill title={name} subtitle={t('employeesRecords.employeeFullRecordSubtitle')}>
    <EntityRecordShell className={`employee-record-shell workspace-fill${selfReadOnly?' employee-self-readonly':''}`} avatar={`${employee.firstName?.[0]||''}${employee.lastName?.[0]||''}`} eyebrow={employee.id} title={name} subtitle={`${language==='el'?employee.profession:(employee.professionEn||employee.profession)} · ${language==='el'?employee.department:(employee.departmentEn||employee.department)}`} status={<span className={`status-badge ${employee.employmentStatus==='active'?'active':''}`}>{t(employee.employmentStatus)}</span>} recordNavigation={selfMode?null:recordNavigation} headerActions={headerActions} tabs={tabs} activeTab={tab} onTabChange={setTab} onBack={selfMode?()=>navigate('/'):goBack} backLabel={t('back')}>
      {selfReadOnly&&<div className="source-truth-note"><ShieldCheck size={16}/><div><strong>{language==='en'?'Your employee record is read-only':'Η προσωπική σας καρτέλα είναι μόνο για προβολή'}</strong><span>{language==='en'?'You cannot edit, delete or perform administrative actions on your own employee record.':'Δεν μπορείτε να επεξεργαστείτε, να διαγράψετε ή να εκτελέσετε διοικητικές ενέργειες στη δική σας καρτέλα.'}</span></div></div>}
      {tab==='details'&&<Details employee={employee} t={t} language={language} fmt={fmt} canAdmin={canAdmin} canManageUsers={canManageUsers} onCreateAccount={()=>setAccountOpen(true)} deleteEmployee={deleteEmployee} notify={notify} organizationId={tenant?.id} departmentOptions={departmentOptions} professionOptions={professionalCategories} reloadEmployees={reloadEmployees} onCodeChanged={newCode=>navigate(`/employees/${encodeURIComponent(newCode)}`,{replace:true})}/>} 
      {tab==='occupational'&&<EmployeeOccupationalTab employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='vaccinations'&&<EmployeeVaccinationsTab employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='surveillance'&&<EmployeeSurveillanceTab employee={employee} t={t} language={language} fmt={fmt} version={surveillanceVersion} readOnly={selfReadOnly} isDemo={isDemo} organizationId={tenant?.id} canManageFollowup={canManageEmployeeFollowup} onNew={()=>setSurveillanceOpen(true)}/>} 
      {tab==='training'&&<EmployeeTrainingTab employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id} canOpenProgram={canTraining}/>} 
      {tab==='evaluations'&&<EmployeeEvaluationsTab employee={employee} t={t} language={language} fmt={fmt} organizationId={tenant?.id}/>} 
      {tab==='certificates'&&<EmployeeCertificatesTab employee={employee} language={language} fmt={fmt} organizationId={tenant?.id} canEdit={canAdmin} isDemo={isDemo}/>} 
      {tab==='history'&&<EmployeeHistoryTab employee={employee} language={language}/>} 
    </EntityRecordShell>
    {surveillanceOpen&&!selfReadOnly&&<EmployeeSurveillanceFlow employee={employee} onClose={()=>setSurveillanceOpen(false)} onCreated={()=>setSurveillanceVersion(version=>version+1)}/>} 
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
  const initials=String(fullName||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'L'
  return <section className="surface my-profile-hero" aria-label={en?'Account details':'Στοιχεία λογαριασμού'}><div className="my-profile-avatar">{initials}</div><div className="my-profile-identity"><span>{isPlatformOwner?(en?'PLATFORM ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ ΠΛΑΤΦΟΡΜΑΣ'):(en?'ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ')}</span><h2>{fullName}</h2><p>{email}</p></div><span className={`status-badge ${active?'active':'danger'}`}>{active?(en?'Active':'Ενεργός'):(en?'Suspended':'Σε παύση')}</span><div className="my-profile-grid my-profile-account-grid"><div className="my-profile-value"><span className="my-profile-value-label">Username</span><strong>{username}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">{en?'Role':'Ρόλος'}</span><strong>{roleLabel(role,language)}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">{en?'Organization':'Οργανισμός'}</span><strong>{organization}</strong></div><div className="my-profile-value"><span className="my-profile-value-label">Email</span><strong>{email}</strong></div></div></section>
}

function Details({employee,t,language,fmt,canAdmin,canManageUsers,onCreateAccount,deleteEmployee,notify,organizationId,departmentOptions,professionOptions,reloadEmployees,onCodeChanged}){
  const [editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[record,setRecord]=useState({...employee})
  useEffect(()=>setRecord({...employee}),[employee])
  const set=(key,value)=>setRecord(current=>({...current,[key]:value}))
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
  return <section className="record-section committee-overview employee-details-overview">
    <div className="record-section-header"><div><span className="eyebrow">{t('employeesRecords.employeeAdministrativeData')}</span><h3>{t('employeesRecords.basicDetails')}</h3></div>{actions.length>0&&<OverflowMenu label={language==='en'?'Employee actions':'Ενέργειες εργαζομένου'} items={actions}/>}</div>
    <div className={`committee-detail-grid employee-full-grid ${editing?'employee-inline-edit':''}`}>
      <InlineDetail editing={editing} label={language==='en'?'Employee / folder code':'Κωδικός εργαζομένου / φακέλου'} value={record.id} onChange={value=>set('id',value)}/>
      <InlineDetail editing={editing} label={t('firstName')} value={record.firstName} onChange={value=>set('firstName',value)}/>
      <InlineDetail editing={editing} label={t('lastName')} value={record.lastName} onChange={value=>set('lastName',value)}/>
      <InlineDetail editing={editing} label={t('fatherName')} value={language==='el'?record.fatherName:record.fatherNameEn} onChange={value=>set(language==='el'?'fatherName':'fatherNameEn',value)}/>
      <InlineSelect editing={editing} label={t('department')} value={record.department} display={language==='el'?record.department:record.departmentEn} options={departmentOptions} language={language} onChange={value=>set('department',value)}/>
      <InlineSelect editing={editing} label={t('professionalCategory')} value={record.profession} display={language==='el'?record.profession:record.professionEn} options={professionOptions} language={language} onChange={value=>set('profession',value)}/>
      <InlineDateDetail editing={editing} label={t('employeesRecords.hireDate')} value={record.hireDate} display={fmt(record.hireDate)} onChange={value=>set('hireDate',value)}/>
      <InlineDetail editing={editing} label={t('employeesRecords.email')} value={record.email} onChange={value=>set('email',value)}/>
      <InlineDetail editing={editing} label={t('phone')} value={record.phone} onChange={value=>set('phone',value)}/>
    </div>
    {!editing&&canManageUsers&&<div className="source-truth-note"><KeyRound size={16}/><div><strong>{employee.accountLinked?(language==='en'?'Linked user account':'Συνδεδεμένος λογαριασμός χρήστη'):(language==='en'?'No user account':'Δεν υπάρχει λογαριασμός χρήστη')}</strong><span>{employee.accountLinked?(language==='en'?'This employee is linked to an authenticated Limoxis Observer account.':'Ο εργαζόμενος είναι συνδεδεμένος με πιστοποιημένο λογαριασμό Limoxis Observer.'):(language==='en'?'Create an account so personal training, approvals and self-service actions are tied to this employee.':'Δημιουργήστε λογαριασμό ώστε οι προσωπικές εκπαιδεύσεις, εγκρίσεις και self-service ενέργειες να συνδέονται με τον συγκεκριμένο εργαζόμενο.')}</span></div>{!employee.accountLinked&&<Button variant="secondary" onClick={onCreateAccount}>{language==='en'?'Create account':'Δημιουργία λογαριασμού'}</Button>}</div>}
    {editing&&<div className="inline-edit-footer"><Button variant="secondary" disabled={saving} onClick={cancel}>{t('cancel')}</Button><SaveButton loading={saving} disabled={saving} onClick={save}>{t('save')}</SaveButton></div>}
  </section>
}

function EmployeeAccountDialog({employee,language,saving,onClose,onCreate}){
  const [email,setEmail]=useState(employee.email||''),[phone,setPhone]=useState(employee.phone||''),[jobTitle,setJobTitle]=useState(employee.profession||''),[role,setRole]=useState('staff_user')
  const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  return <ObserverDialog width="wide" eyebrow={language==='en'?'Employee account':'Λογαριασμός εργαζομένου'} title={language==='en'?'Create and link account':'Δημιουργία και σύνδεση λογαριασμού'} subtitle={language==='en'?`${employee.firstName} ${employee.lastName} will be linked directly to this account.`:`Ο λογαριασμός θα συνδεθεί απευθείας με τον εργαζόμενο ${employee.firstName} ${employee.lastName}.`} onClose={onClose} footer={<DialogActions onCancel={onClose} onSave={()=>onCreate({email:email.trim(),phone:phone.trim(),jobTitle:jobTitle.trim(),role})} disabled={!valid||saving}/>}><div className="entry-grid"><label><span>Email *</span><input type="email" value={email} onChange={event=>setEmail(event.target.value)}/></label><label><span>{language==='en'?'Phone':'Τηλέφωνο'}</span><input value={phone} onChange={event=>setPhone(event.target.value)}/></label><label><span>{language==='en'?'Job title':'Ιδιότητα'}</span><input value={jobTitle} onChange={event=>setJobTitle(event.target.value)}/></label><label><span>{language==='en'?'Account role':'Ρόλος λογαριασμού'}</span><select value={role} onChange={event=>setRole(event.target.value)}><option value="staff_user">{language==='en'?'Staff user':'Εργαζόμενος'}</option><option value="department_user">{language==='en'?'Department user':'Χρήστης τμήματος'}</option><option value="department_manager">{language==='en'?'Department manager':'Προϊστάμενος τμήματος'}</option><option value="link_nurse">Link Nurse</option><option value="laboratory">{language==='en'?'Laboratory':'Εργαστήριο'}</option></select></label></div></ObserverDialog>
}

function InlineDetail({editing,label,value,display,onChange,type='text'}){if(editing&&type==='date')return <ManualDateField className="detail-item detail-field editable" label={label} value={value||''} onChange={onChange}/>;return <div className={`detail-item detail-field ${editing?'editable':''}`}><span>{label}</span>{editing?<input type={type} value={value||''} onChange={event=>onChange?.(event.target.value)}/>:<strong>{display??value??'—'}</strong>}</div>}
function InlineSelect({editing,label,value,display,options=[],language,onChange}){const rows=Array.isArray(options)?options:[],hasCurrent=rows.some(row=>(row?.[0]??row?.name??'')===value);return <div className={`detail-item detail-field ${editing?'editable':''}`}><span>{label}</span>{editing?<select value={value||''} onChange={event=>onChange(event.target.value)}>{value&&!hasCurrent&&<option value={value}>{display||value}</option>}{rows.map((row,index)=>{const el=row?.[0]??row?.name??String(row||''),en=row?.[1]??row?.nameEn??el;return <option key={`${el}-${index}`} value={el}>{language==='el'?el:en}</option>})}</select>:<strong>{display||'—'}</strong>}</div>}
function InlineDateDetail(props){return <InlineDetail {...props} type="date"/>}
