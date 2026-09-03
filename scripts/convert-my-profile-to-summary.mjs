import fs from 'node:fs'
const p='src/features/employees/EmployeeRecordPage.jsx'
let s=fs.readFileSync(p,'utf8')
// Unlinked/platform accounts: remove synthetic employee tabs; show account card + concise applicability notice.
const a=s.indexOf("  if(!employee){")
const b=s.indexOf("\n  const employeeInScope=",a)
if(a<0||b<0) throw new Error('unlinked branch not found')
const branch=`  if(!employee){
    const platformOwner=Boolean(profile?.isPlatformOwner||profile?.is_platform_owner)
    return <Page fill title={selfMode?t('employeesRecords.myProfile'):t('employees')} subtitle={selfMode?(language==='en'?'Account and personal profile summary.':'Συνοπτική εικόνα λογαριασμού και προσωπικών στοιχείων.'):undefined}>
      <div className="my-profile-summary-page">
        <SelfAccountSummary profile={profile} user={user} role={role} membership={membership} tenant={tenant} language={language}/>
        <section className="surface my-profile-summary-note"><strong>{platformOwner?(language==='en'?'Platform account':'Λογαριασμός πλατφόρμας'):(language==='en'?'Employee record not linked':'Δεν έχει συνδεθεί καρτέλα εργαζομένου')}</strong><span>{platformOwner?(language==='en'?'Employee health, vaccinations, training, evaluations and certifications do not apply to the Platform Owner account.':'Τα στοιχεία Ιατρού Εργασίας, εμβολιασμών, εκπαίδευσης, αξιολογήσεων και πιστοποιήσεων δεν εφαρμόζονται στον λογαριασμό Platform Owner.'):(language==='en'?'Link this account to the real employee record from Organization → Users to display the personal summary.':'Συνδέστε τον λογαριασμό με την πραγματική καρτέλα εργαζομένου από Οργανισμός → Χρήστες για να εμφανιστεί η προσωπική σύνοψη.')}</span></section>
      </div>
    </Page>
  }`
s=s.slice(0,a)+branch+s.slice(b)
// Linked self profile: use summary dashboard instead of duplicating the full employee tab workspace.
const marker="  return <Page fill title={selfMode?t('employeesRecords.myProfile'):name}"
const start=s.indexOf(marker)
const shell=s.indexOf("    <EntityRecordShell",start)
if(start<0||shell<0) throw new Error('linked return not found')
const prefix=s.slice(start,shell)
const insert=`    {selfMode&&<MyProfileEmployeeSummary employee={employee} language={language} t={t} fmt={fmt} organizationId={tenant?.id}/>}\n    {!selfMode&&`
s=s.slice(0,shell)+insert+s.slice(shell)
// close !selfMode wrapper immediately after EntityRecordShell
const closeMarker="    </EntityRecordShell>\n    {surveillanceOpen&&"
if(!s.includes(closeMarker)) throw new Error('shell close not found')
s=s.replace(closeMarker,"    </EntityRecordShell>}\n    {surveillanceOpen&&")
// Add summary component before RecordFact.
const helperMarker='function RecordFact('
const helper=`function MyProfileEmployeeSummary({employee,language,t,fmt,organizationId}){
  const en=language==='en'
  const {data:vaccinations}=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id)
  const {data:visits}=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id)
  const {data:training}=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id)
  const {data:evaluations}=useEmployeeSubRecords(loadEvaluationsAsync,organizationId,employee.dbId,employee.id)
  const {data:certificates}=useEmployeeSubRecords(loadCertificatesAsync,organizationId,employee.dbId,employee.id)
  const surveillance=getEmployeeSurveillanceForEmployee(employee.id)||[]
  const cards=[
    {icon:HeartPulse,label:en?'Occupational Health':'Ιατρός Εργασίας',value:visits.length,detail:en?'recorded visits':'καταχωρισμένες επισκέψεις'},
    {icon:Syringe,label:en?'Vaccinations':'Εμβολιασμοί',value:vaccinations.length,detail:en?'vaccination records':'καταχωρίσεις εμβολιασμών'},
    {icon:Activity,label:en?'Surveillance':'Επιτήρηση',value:surveillance.length,detail:en?'surveillance records':'καταγραφές επιτήρησης'},
    {icon:GraduationCap,label:en?'Training':'Εκπαίδευση',value:training.length,detail:en?'training records':'καταγραφές εκπαίδευσης'},
    {icon:FileCheck2,label:en?'Evaluations':'Αξιολογήσεις',value:evaluations.length,detail:en?'evaluations':'αξιολογήσεις'},
    {icon:BriefcaseBusiness,label:en?'Certificates':'Πιστοποιήσεις',value:certificates.length,detail:en?'certificates / documents':'πιστοποιήσεις / έγγραφα'},
  ]
  const name=language==='el'?\`${'${employee.lastName} ${employee.firstName}'}\`:\`${'${employee.firstNameEn||employee.firstName} ${employee.lastNameEn||employee.lastName}'}\`
  return <div className="my-profile-employee-summary">
    <section className="surface my-profile-employee-card"><div><span className="eyebrow">{en?'EMPLOYEE RECORD':'ΚΑΡΤΕΛΑ ΕΡΓΑΖΟΜΕΝΟΥ'}</span><h2>{name}</h2><p>{language==='el'?employee.profession:employee.professionEn||employee.profession} · {language==='el'?employee.department:employee.departmentEn||employee.department}</p></div><span className=\"status-badge active\">{en?'Active':'Ενεργός'}</span><div className="my-profile-employee-facts"><RecordFact label={en?'Employee code':'Κωδικός εργαζομένου'} value={employee.id}/><RecordFact label={t('department')} value={language==='el'?employee.department:employee.departmentEn}/><RecordFact label={t('professionalCategory')} value={language==='el'?employee.profession:employee.professionEn}/><RecordFact label={en?'Hire date':'Ημερομηνία πρόσληψης'} value={fmt(employee.hireDate)}/></div></section>
    <section className="my-profile-summary-grid">{cards.map(({icon:Icon,label,value,detail})=><article className="surface my-profile-summary-card" key={label}><div className="my-profile-summary-icon"><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>)}</section>
  </div>
}
`
if(!s.includes(helperMarker)) throw new Error('helper marker missing')
s=s.replace(helperMarker,helper+helperMarker)
fs.writeFileSync(p,s)
const c='src/styles/my-profile.css'
let css=fs.readFileSync(c,'utf8')
css += `\n/* Canonical My Profile summary — account identity + concise employee overview. */\n.my-profile-summary-page,.my-profile-employee-summary{display:grid;gap:16px}.my-profile-summary-note{display:flex;flex-direction:column;gap:5px;padding:18px 20px}.my-profile-summary-note span{color:var(--lo-color-text-muted);font-size:13px;line-height:1.55}.my-profile-employee-card{display:grid;grid-template-columns:1fr auto;gap:14px;padding:20px}.my-profile-employee-card h2{margin:4px 0;font-size:20px}.my-profile-employee-card p{margin:0;color:var(--lo-color-text-muted)}.my-profile-employee-facts{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.my-profile-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.my-profile-summary-card{display:flex;align-items:center;gap:12px;padding:16px;min-height:92px}.my-profile-summary-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--lo-color-surface-soft,#f2f6f8);color:var(--lo-color-primary)}.my-profile-summary-card>div:last-child{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 10px;min-width:0;flex:1}.my-profile-summary-card span{font-weight:700;font-size:13px}.my-profile-summary-card strong{font-size:20px}.my-profile-summary-card small{grid-column:1/-1;color:var(--lo-color-text-muted)}@media(max-width:1050px){.my-profile-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.my-profile-employee-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.my-profile-summary-grid,.my-profile-employee-facts{grid-template-columns:1fr}}\n`
fs.writeFileSync(c,css)
