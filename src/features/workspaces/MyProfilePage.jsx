import { BadgeCheck,Building2,BriefcaseBusiness,IdCard,Mail,ShieldCheck,UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'

function Value({label,value,icon}){
 return <div className="my-profile-value"><div className="my-profile-value-label">{icon}{label}</div><strong>{value||'—'}</strong></div>
}

export function MyProfilePage(){
 const {language}=useLanguage();const en=language==='en'
 const {user,profile}=useAuth()
 const {tenant,role,membership}=useTenant()
 const {data:employees=[],loading}=useEmployeesData()
 const linkedUserId=profile?.id||user?.id||''
 const employee=employees.find(row=>row.userId===linkedUserId)||null
 const fullName=profile?.fullName||user?.user_metadata?.full_name||user?.email||'—'
 const email=profile?.contactEmail||profile?.email||user?.email||'—'
 const username=profile?.username||user?.user_metadata?.username||'—'
 const organizationName=tenant?.name||tenant?.organizationName||(profile?.isPlatformOwner?(en?'Platform account':'Λογαριασμός πλατφόρμας'):'—')
 const accountStatus=membership?.status==='disabled'?(en?'Suspended':'Σε παύση'):(en?'Active':'Ενεργός')
 const employeeName=employee?[employee.firstName,employee.lastName].filter(Boolean).join(' '):''

 return <Page title={en?'My profile':'Το προφίλ μου'} subtitle={en?'Your account identity, organization access and linked employee record in one place.':'Τα στοιχεία λογαριασμού, η πρόσβαση στον οργανισμό και η συνδεδεμένη καρτέλα εργαζομένου σε μία ενιαία προβολή.'}>
  <div className="my-profile-shell">
   <section className="my-profile-hero surface">
    <div className="my-profile-avatar" aria-hidden="true"><UserRound size={25}/></div>
    <div className="my-profile-identity"><span>{en?'ACCOUNT PROFILE':'ΠΡΟΦΙΛ ΛΟΓΑΡΙΑΣΜΟΥ'}</span><h2>{fullName}</h2><p>{email}</p></div>
    <span className={`status-badge ${accountStatus===(en?'Active':'Ενεργός')?'active':'danger'}`}>{accountStatus}</span>
   </section>

   <section className="my-profile-section surface">
    <header><div><h3>{en?'Account & access':'Λογαριασμός & πρόσβαση'}</h3><p>{en?'These details describe the signed-in account and are available regardless of employee-record linkage.':'Τα στοιχεία αυτά αφορούν τον συνδεδεμένο λογαριασμό και εμφανίζονται ανεξάρτητα από το αν υπάρχει καρτέλα εργαζομένου.'}</p></div></header>
    <div className="my-profile-grid">
     <Value label={en?'Full name':'Ονοματεπώνυμο'} value={fullName} icon={<UserRound size={15}/>}/>
     <Value label="Email" value={email} icon={<Mail size={15}/>}/>
     <Value label="Username" value={username} icon={<IdCard size={15}/>}/>
     <Value label={en?'Role':'Ρόλος'} value={roleLabel(role,language)} icon={<ShieldCheck size={15}/>}/>
     <Value label={en?'Organization':'Οργανισμός'} value={organizationName} icon={<Building2 size={15}/>}/>
     <Value label={en?'Account status':'Κατάσταση λογαριασμού'} value={accountStatus} icon={<BadgeCheck size={15}/>}/>
    </div>
   </section>

   <section className="my-profile-section surface">
    <header><div><h3>{en?'Employee record':'Καρτέλα εργαζομένου'}</h3><p>{en?'Shown only when this account is explicitly linked to an employee record in the current organization.':'Εμφανίζεται μόνο όταν ο λογαριασμός έχει συνδεθεί ρητά με καρτέλα εργαζομένου στον ενεργό οργανισμό.'}</p></div></header>
    {loading?<div className="inline-empty">{en?'Loading employee linkage…':'Έλεγχος σύνδεσης με καρτέλα εργαζομένου…'}</div>:employee?<div className="my-profile-employee-card">
      <div className="my-profile-employee-icon"><BriefcaseBusiness size={20}/></div>
      <div><strong>{employeeName||employee.id}</strong><span>{[employee.department,employee.profession].filter(Boolean).join(' · ')||employee.id}</span></div>
      <span className={`status-badge ${employee.employmentStatus==='inactive'?'danger':'active'}`}>{employee.employmentStatus==='inactive'?(en?'Inactive':'Ανενεργός'):(en?'Active employee':'Ενεργός εργαζόμενος')}</span>
     </div>:<div className="my-profile-unlinked"><div className="my-profile-unlinked-icon"><BriefcaseBusiness size={20}/></div><div><strong>{en?'No employee record linked':'Δεν έχει συνδεθεί καρτέλα εργαζομένου'}</strong><span>{profile?.isPlatformOwner?(en?'This is expected for a Platform Owner account.':'Αυτό είναι αναμενόμενο για λογαριασμό Platform Owner.'):(en?'The account remains fully valid. HR or an authorized administrator can link it to the correct employee record when required.':'Ο λογαριασμός παραμένει κανονικά ενεργός. Το HR ή εξουσιοδοτημένος διαχειριστής μπορεί να τον συνδέσει με τη σωστή καρτέλα εργαζομένου όταν απαιτείται.')}</span></div></div>}
   </section>
  </div>
 </Page>
}
