import { useState } from 'react'
import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'
import { ManualDateField } from '../../design-system/ManualDateField'
import { demoLibrarySeed } from '../management/managementData'
import { nextEmployeeId } from './employeeStore'
import { useLanguage } from '../../core/i18n/LanguageContext'

export function EmployeeCreateDialog({rows,actor,onClose,onSave}){
 const {language}=useLanguage();const en=language==='en'
 const [v,setV]=useState({firstName:'',lastName:'',fatherName:'',department:'',profession:'',employmentStatus:'active',email:'',phone:'',hireDate:''})
 const set=(k,x)=>setV(s=>({...s,[k]:x}))
 const valid=v.firstName.trim()&&v.lastName.trim()&&v.department&&v.profession
 function submit(){
   if(!valid)return
   const id=nextEmployeeId(rows),now=new Date().toISOString()
   const dep=demoLibrarySeed.departments.find(([el])=>el===v.department)
   const prof=demoLibrarySeed.professionalCategories.find(([el])=>el===v.profession)
   onSave({...v,id,firstNameEn:v.firstName,lastNameEn:v.lastName,fatherNameEn:v.fatherName,departmentEn:dep?.[1]||v.department,professionEn:prof?.[1]||v.profession,createdAt:now,createdBy:actor.name,createdById:actor.id,updatedAt:now,updatedBy:actor.name,updatedById:actor.id})
 }
 return <ObserverDialog width="wide" eyebrow={en?'Staff':'Προσωπικό'} title={en?'New employee':'Νέος εργαζόμενος'} subtitle={en?'Create employee record':'Δημιουργία καρτέλας προσωπικού'} onClose={onClose} footer={<DialogActions onCancel={onClose} disabled={!valid} onSave={submit} saveLabel={en?'Save':'Αποθήκευση'}/>}>
  <div className="observer-form-section"><div className="observer-form-section-title"><div><strong>{en?'Basic details':'Βασικά στοιχεία'}</strong><span>{en?'Department and professional category are selected from the shared libraries.':'Τμήμα και επαγγελματική κατηγορία επιλέγονται από τις κοινές βιβλιοθήκες.'}</span></div></div><div className="entry-grid compact">
   <label className="field"><span>{en?'First name *':'Όνομα *'}</span><input value={v.firstName} onChange={e=>set('firstName',e.target.value)}/></label>
   <label className="field"><span>{en?'Last name *':'Επώνυμο *'}</span><input value={v.lastName} onChange={e=>set('lastName',e.target.value)}/></label>
   <label className="field"><span>{en?'Father’s name':'Πατρώνυμο'}</span><input value={v.fatherName} onChange={e=>set('fatherName',e.target.value)}/></label>
   <label className="field"><span>{en?'Status':'Κατάσταση'}</span><select value={v.employmentStatus} onChange={e=>set('employmentStatus',e.target.value)}><option value="active">{en?'Active':'Ενεργός'}</option><option value="inactive">{en?'Inactive':'Ανενεργός'}</option></select></label>
   <label className="field"><span>{en?'Department *':'Τμήμα *'}</span><select value={v.department} onChange={e=>set('department',e.target.value)}><option value="">{en?'Select department':'Επιλογή τμήματος'}</option>{demoLibrarySeed.departments.map(([el,enLabel])=><option key={el} value={el}>{en?(enLabel||el):el}</option>)}</select></label>
   <label className="field"><span>{en?'Professional category *':'Επαγγελματική κατηγορία *'}</span><select value={v.profession} onChange={e=>set('profession',e.target.value)}><option value="">{en?'Select category':'Επιλογή κατηγορίας'}</option>{demoLibrarySeed.professionalCategories.map(([el,enLabel])=><option key={el} value={el}>{en?(enLabel||el):el}</option>)}</select></label>
   <ManualDateField className="field" label={en?'Hire date':'Ημερομηνία πρόσληψης'} value={v.hireDate} onChange={x=>set('hireDate',x)} optional/>
   <label className="field"><span>Email</span><input type="email" value={v.email} onChange={e=>set('email',e.target.value)}/></label>
   <label className="field"><span>{en?'Phone':'Τηλέφωνο'}</span><input value={v.phone} onChange={e=>set('phone',e.target.value)}/></label>
  </div></div>
 </ObserverDialog>
}
