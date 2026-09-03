import fs from 'node:fs'

const p='src/features/employees/EmployeeRecordPage.jsx'
let s=fs.readFileSync(p,'utf8')

if(!s.includes("import { roleLabel } from '../../core/permissions/roleLabels'")){
  s=s.replace("import { useAuth } from '../../core/auth/AuthContext'", "import { useAuth } from '../../core/auth/AuthContext'\nimport { roleLabel } from '../../core/permissions/roleLabels'")
}

const oldNoEmployee="if(!employee)return <Page title={selfMode?t('employeesRecords.myProfile'):t('employees')}><div className=\"surface\"><div className=\"inline-empty\">{language==='en'?'No employee record is linked to this account.':'Δεν έχει συνδεθεί καρτέλα εργαζομένου με αυτόν τον λογαριασμό.'}</div></div></Page>"
const newNoEmployee="if(!employee)return <Page title={selfMode?t('employeesRecords.myProfile'):t('employees')} subtitle={selfMode?(language==='en'?'Account identity and personal employee record.':'Στοιχεία λογαριασμού και προσωπική καρτέλα εργαζομένου.'):undefined}>{selfMode&&<SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/>}<div className=\"my-profile-employee-card\"><div className=\"my-profile-employee-card-copy\"><strong>{language==='en'?'Employee record':'Καρτέλα εργαζομένου'}</strong><span>{language==='en'?'No employee record is linked to this account. Vaccinations, Occupational Health, training, evaluations and certificates will appear here once the account is linked to an employee.':'Δεν έχει συνδεθεί καρτέλα εργαζομένου με αυτόν τον λογαριασμό. Οι εμβολιασμοί, ο Ιατρός Εργασίας, οι εκπαιδεύσεις, οι αξιολογήσεις και οι πιστοποιήσεις θα εμφανιστούν εδώ μόλις ο λογαριασμός συνδεθεί με εργαζόμενο.'}</span></div></div></Page>"
if(!s.includes(oldNoEmployee)) throw new Error('No-employee self profile branch not found')
s=s.replace(oldNoEmployee,newNoEmployee)

const oldReturn="return <Page fill title={selfMode?t('employeesRecords.myProfile'):name} subtitle={selfMode?t('employeesRecords.myEmployeeRecordSubtitle'):t('employeesRecords.employeeFullRecordSubtitle')}>\n    {selfMode&&pendingCommitteeApprovals.length>0&&"
const newReturn="return <Page fill title={selfMode?t('employeesRecords.myProfile'):name} subtitle={selfMode?t('employeesRecords.myEmployeeRecordSubtitle'):t('employeesRecords.employeeFullRecordSubtitle')}>\n    {selfMode&&<SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/>}\n    {selfMode&&pendingCommitteeApprovals.length>0&&"
if(!s.includes(oldReturn)) throw new Error('Self profile Page opening not found')
s=s.replace(oldReturn,newReturn)

const marker="function RecordFact({label,value,kind=''})"
if(!s.includes('function SelfAccountSummary(')){
  const helper=`function SelfAccountSummary({profile,user,role,membership,tenant,language}){\n  const en=language==='en'\n  const fullName=profile?.fullName||profile?.full_name||user?.user_metadata?.full_name||user?.email||'—'\n  const email=profile?.contactEmail||profile?.email||user?.email||'—'\n  const username=profile?.username||user?.user_metadata?.username||'—'\n  const organization=tenant?.name||tenant?.organization_name||(profile?.isPlatformOwner?(en?'Platform account':'Λογαριασμός πλατφόρμας'):'—')\n  const membershipStatus=membership?.status||'active'\n  const active=membershipStatus!=='disabled'&&membershipStatus!=='suspended'\n  return <section className=\"my-profile-account-card\" aria-label={en?'Account details':'Στοιχεία λογαριασμού'}><div className=\"my-profile-account-heading\"><div><span>{en?'ACCOUNT':'ΛΟΓΑΡΙΑΣΜΟΣ'}</span><strong>{fullName}</strong><small>{email}</small></div><span className={\`status-badge \${active?'active':'danger'}\`}>{active?(en?'Active':'Ενεργός'):(en?'Suspended':'Σε παύση')}</span></div><div className=\"my-profile-account-grid\"><div><span>{en?'Username':'Username'}</span><strong>{username}</strong></div><div><span>{en?'Role':'Ρόλος'}</span><strong>{roleLabel(role,language)}</strong></div><div><span>{en?'Organization':'Οργανισμός'}</span><strong>{organization}</strong></div><div><span>Email</span><strong>{email}</strong></div></div></section>\n}\n`
  s=s.replace(marker,helper+marker)
}
fs.writeFileSync(p,s)

const lang='src/core/i18n/LanguageContext.jsx'
let l=fs.readFileSync(lang,'utf8')
l=l.replace("myProfile:'Η καρτέλα μου'","myProfile:'Το προφίλ μου'")
fs.writeFileSync(lang,l)
