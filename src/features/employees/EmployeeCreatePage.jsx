import { useEffect,useMemo,useState } from 'react'
import { Navigate,useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { ManualDateField } from '../../design-system/ManualDateField'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { can,CAPABILITIES } from '../../core/permissions/roles'
import { createEmployeeAsync } from './employeeService'
import { loadDepartments } from '../management/departmentsService'
import { loadManagementLibraries } from '../management/managementCloudService'

export function EmployeeCreatePage(){
 const {t,language}=useLanguage();const en=language==='en';const {notify}=useFeedback();const navigate=useNavigate();const {tenant,role,membership}=useTenant();const actor=useAuditActor()
 const [saving,setSaving]=useState(false);const [departments,setDepartments]=useState([]);const [professionalCategories,setProfessionalCategories]=useState([])
 const [v,setV]=useState({employeeCode:'',firstName:'',lastName:'',fatherName:'',department:'',profession:'',employmentStatus:'active',email:'',phone:'',hireDate:''})
 const addOns=membership?.capabilities??[];const custom=membership?.customCapabilities??[];const canCreate=can(role,CAPABILITIES.MANAGE_STAFF_ADMIN,addOns,custom)
 const set=(k,x)=>setV(s=>({...s,[k]:x}))
 const valid=Boolean(v.employeeCode.trim()&&v.firstName.trim()&&v.lastName.trim()&&v.department&&v.profession)

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

 const selectedDepartment=useMemo(()=>departments.find(row=>row.id===v.department||row.name===v.department),[departments,v.department])
 const selectedProfession=useMemo(()=>professionalCategories.find(row=>row?.[2]?.id===v.profession||row?.[0]===v.profession),[professionalCategories,v.profession])

 async function save(){
  if(!canCreate||!valid||saving)return
  setSaving(true)
  try{
   const now=new Date().toISOString();const id=v.employeeCode.trim()
   const row={...v,id,employeeCode:id,department:selectedDepartment?.name||v.department,departmentId:selectedDepartment?.id||null,departmentEn:selectedDepartment?.nameEn||selectedDepartment?.name||v.department,profession:selectedProfession?.[0]||v.profession,professionEn:selectedProfession?.[1]||selectedProfession?.[0]||v.profession,firstNameEn:v.firstName,lastNameEn:v.lastName,fatherNameEn:v.fatherName,createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id}
   const created=await createEmployeeAsync(tenant?.id??null,row)
   notify(t('employeeCreated'),'success')
   navigate(`/employees/${encodeURIComponent(created.id)}`,{replace:true})
  }catch(err){
   if(err?.message==='DUPLICATE_EMPLOYEE_CODE')notify(en?'This employee code is already in use.':'Αυτός ο κωδικός εργαζομένου χρησιμοποιείται ήδη.','danger')
   else notify(en?'Could not save the employee.':'Δεν ήταν δυνατή η αποθήκευση του εργαζομένου.','danger')
  }finally{setSaving(false)}
 }

 if(!canCreate)return <Navigate to="/employees" replace/>
 return <Page fill><EntityRecordShell className="employee-create-shell workspace-fill" avatar={<UserPlus size={19}/>} eyebrow={en?'Staff':'Προσωπικό'} title={en?'New employee':'Νέος εργαζόμενος'} subtitle={en?'Create employee record':'Δημιουργία καρτέλας προσωπικού'} tabs={[]} activeTab="" onTabChange={()=>{}} onBack={()=>navigate('/employees')}>
  <div className="record-section employee-create-form">
   <div className="entry-grid">
    <label><span>{en?'Employee code *':'Κωδικός εργαζομένου *'}</span><input autoFocus value={v.employeeCode} onChange={e=>set('employeeCode',e.target.value)}/></label>
    <label><span>{en?'Status':'Κατάσταση'}</span><select value={v.employmentStatus} onChange={e=>set('employmentStatus',e.target.value)}><option value="active">{en?'Active':'Ενεργός'}</option><option value="inactive">{en?'Inactive':'Ανενεργός'}</option></select></label>
    <label><span>{en?'First name *':'Όνομα *'}</span><input value={v.firstName} onChange={e=>set('firstName',e.target.value)}/></label>
    <label><span>{en?'Last name *':'Επώνυμο *'}</span><input value={v.lastName} onChange={e=>set('lastName',e.target.value)}/></label>
    <label><span>{en?'Father’s name':'Πατρώνυμο'}</span><input value={v.fatherName} onChange={e=>set('fatherName',e.target.value)}/></label>
    <ManualDateField label={en?'Hire date':'Ημερομηνία πρόσληψης'} value={v.hireDate} onChange={x=>set('hireDate',x)} optional/>
    <label><span>{en?'Department *':'Τμήμα *'}</span><select value={v.department} onChange={e=>set('department',e.target.value)}><option value="">{en?'Select department…':'Επιλέξτε τμήμα…'}</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label><span>{en?'Professional category *':'Επαγγελματική κατηγορία *'}</span><select value={v.profession} onChange={e=>set('profession',e.target.value)}><option value="">{en?'Select category…':'Επιλέξτε κατηγορία…'}</option>{professionalCategories.map(row=><option key={row?.[2]?.id||row?.[0]} value={row?.[2]?.id||row?.[0]}>{en?(row?.[1]||row?.[0]):row?.[0]}</option>)}</select></label>
    <label><span>Email</span><input type="email" value={v.email} onChange={e=>set('email',e.target.value)}/></label>
    <label><span>{en?'Phone':'Τηλέφωνο'}</span><input value={v.phone} onChange={e=>set('phone',e.target.value)}/></label>
   </div>
   <div className="inline-edit-footer"><Button variant="secondary" onClick={()=>navigate('/employees')}>{t('cancel')}</Button><SaveButton loading={saving} disabled={!valid||saving} onClick={save}>{t('save')}</SaveButton></div>
  </div>
 </EntityRecordShell></Page>
}
