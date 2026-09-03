import fs from 'node:fs'

const pagePath='src/features/employees/EmployeeRecordPage.jsx'
const cssPath='src/styles/my-profile.css'
let page=fs.readFileSync(pagePath,'utf8')

page=page.replace("{selfMode&&<MyProfileEmployeeSummary employee={employee} language={language} t={t} fmt={fmt} organizationId={tenant?.id}/>}","{selfMode&&<MyProfileEmployeeSummary employee={employee} language={language} t={t} fmt={fmt} organizationId={tenant?.id} showSensitiveHealth={canSeeSensitiveEmployeeHealth}/>}")

const start=page.indexOf('function MyProfileEmployeeSummary(')
const end=page.indexOf('function RecordFact(',start)
if(start<0||end<0)throw new Error('MyProfileEmployeeSummary markers not found')

const replacement=`function MyProfileEmployeeSummary({employee,language,t,fmt,organizationId,showSensitiveHealth}){
  const en=language==='en'
  const {data:vaccinations}=useEmployeeSubRecords(loadVaccinationsAsync,organizationId,employee.dbId,employee.id)
  const {data:visits}=useEmployeeSubRecords(loadOccupationalVisitsAsync,organizationId,employee.dbId,employee.id)
  const {data:training}=useEmployeeSubRecords(loadEmployeeTrainingAsync,organizationId,employee.dbId,employee.id)
  const {data:evaluations}=useEmployeeSubRecords(loadEvaluationsAsync,organizationId,employee.dbId,employee.id)
  const {data:certificates}=useEmployeeSubRecords(loadCertificatesAsync,organizationId,employee.dbId,employee.id)
  const surveillance=showSensitiveHealth?(getEmployeeSurveillanceForEmployee(employee.id)||[]):[]
  const today=new Date();today.setHours(0,0,0,0)
  const asDate=value=>{if(!value)return null;const d=new Date(\\`\\${value}T12:00:00\\`);return Number.isNaN(d.getTime())?null:d}
  const latest=(rows,key='date')=>[...(rows||[])].filter(x=>asDate(x?.[key])).sort((a,b)=>asDate(b[key])-asDate(a[key]))[0]||null
  const soon=(value,days=90)=>{const d=asDate(value);return Boolean(d&&d>=today&&(d-today)<=days*86400000)}
  const expired=value=>{const d=asDate(value);return Boolean(d&&d<today)}
  const completed=row=>['completed','complete','done','passed','valid','active'].includes(String(row?.status||'').toLowerCase())

  const lastVisit=latest(visits)
  const followUps=(visits||[]).filter(x=>asDate(x.followUpDate)).sort((a,b)=>asDate(a.followUpDate)-asDate(b.followUpDate))
  const overdueFollowUp=followUps.find(x=>asDate(x.followUpDate)<today)
  const nextFollowUp=followUps.find(x=>asDate(x.followUpDate)>=today)
  const occupationalValue=overdueFollowUp?(en?'Action needed':'Απαιτείται ενέργεια'):(lastVisit?(en?'Up to date':'Ενήμερος'):(en?'No record':'Χωρίς καταγραφή'))
  const occupationalDetail=lastVisit?(en?\\`Last visit: \\${fmt(lastVisit.date)}\\${nextFollowUp?\\` · Next: \\${fmt(nextFollowUp.followUpDate)}\\`:''}\\`:\\`Τελευταία επίσκεψη: \\${fmt(lastVisit.date)}\\${nextFollowUp?\\` · Επόμενη: \\${fmt(nextFollowUp.followUpDate)}\\`:''}\\`):(en?'No occupational-health visit recorded.':'Δεν έχει καταχωριστεί επίσκεψη στον Ιατρό Εργασίας.')

  const expiredVaccines=(vaccinations||[]).filter(x=>expired(x.validUntil)).length
  const dueVaccines=(vaccinations||[]).filter(x=>soon(x.validUntil)&&!expired(x.validUntil)).length
  const vaccinationValue=expiredVaccines?(en?\\`\\${expiredVaccines} overdue\\`:\\`\\${expiredVaccines} ληγμένοι\\`):dueVaccines?(en?\\`\\${dueVaccines} due soon\\`:\\`\\${dueVaccines} λήγουν σύντομα\\`):(vaccinations.length?(en?'Up to date':'Ενήμερος'):(en?'No record':'Χωρίς καταγραφή'))
  const vaccinationDetail=vaccinations.length?(en?\\`\\${vaccinations.length} vaccination records\\`:\\`\\${vaccinations.length} καταχωρίσεις εμβολιασμών\\`):(en?'No vaccination data available.':'Δεν υπάρχουν διαθέσιμα στοιχεία εμβολιασμών.')

  const pendingTraining=(training||[]).filter(x=>!completed(x)).length
  const completedTraining=Math.max(0,(training||[]).length-pendingTraining)
  const trainingValue=pendingTraining?(en?\\`\\${pendingTraining} pending\\`:\\`\\${pendingTraining} εκκρεμείς\\`):(training.length?(en?'Complete':'Ολοκληρωμένες'):(en?'No record':'Χωρίς καταγραφή'))
  const trainingDetail=en?\\`\\${completedTraining} completed\\`:\\`\\${completedTraining} ολοκληρωμένες\\`

  const lastEvaluation=latest(evaluations)
  const evaluationValue=lastEvaluation?(language==='el'?(lastEvaluation.resultEl||'Καταχωρισμένη'):(lastEvaluation.resultEn||'Recorded')):(en?'No evaluation':'Χωρίς αξιολόγηση')
  const evaluationDetail=lastEvaluation?(en?\\`Latest: \\${fmt(lastEvaluation.date)}\\`:\\`Τελευταία: \\${fmt(lastEvaluation.date)}\\`):(en?'No evaluation has been recorded.':'Δεν έχει καταχωριστεί αξιολόγηση.')

  const expiredCertificates=(certificates||[]).filter(x=>expired(x.validUntil)).length
  const expiringCertificates=(certificates||[]).filter(x=>soon(x.validUntil)&&!expired(x.validUntil)).length
  const certificateValue=expiredCertificates?(en?\\`\\${expiredCertificates} expired\\`:\\`\\${expiredCertificates} ληγμένες\\`):expiringCertificates?(en?\\`\\${expiringCertificates} expiring soon\\`:\\`\\${expiringCertificates} λήγουν σύντομα\\`):(certificates.length?(en?'Active':'Ενεργές'):(en?'No record':'Χωρίς καταγραφή'))
  const certificateDetail=en?\\`\\${certificates.length} certificates / documents\\`:\\`\\${certificates.length} πιστοποιήσεις / έγγραφα\\`

  const latestSurveillance=latest(surveillance)
  const surveillanceValue=latestSurveillance?(en?'Recorded':'Καταχωρισμένη'):(en?'No active item':'Χωρίς ενεργή εκκρεμότητα')
  const surveillanceDetail=latestSurveillance?(en?\\`Last update: \\${fmt(latestSurveillance.date)}\\`:\\`Τελευταία ενημέρωση: \\${fmt(latestSurveillance.date)}\\`):(en?'Only information allowed for self-view is shown.':'Εμφανίζονται μόνο στοιχεία που επιτρέπονται για προσωπική προβολή.')

  const cards=[
    {icon:HeartPulse,label:en?'Occupational Health':'Ιατρός Εργασίας',value:occupationalValue,detail:occupationalDetail,tone:overdueFollowUp?'attention':'ok'},
    {icon:Syringe,label:en?'Vaccinations':'Εμβολιασμοί',value:vaccinationValue,detail:vaccinationDetail,tone:expiredVaccines?'danger':dueVaccines?'attention':'ok'},
    {icon:GraduationCap,label:en?'Training':'Εκπαίδευση',value:trainingValue,detail:trainingDetail,tone:pendingTraining?'attention':'ok'},
    {icon:FileCheck2,label:en?'Evaluations':'Αξιολογήσεις',value:evaluationValue,detail:evaluationDetail,tone:lastEvaluation?'neutral':'muted'},
    {icon:BriefcaseBusiness,label:en?'Certificates':'Πιστοποιήσεις',value:certificateValue,detail:certificateDetail,tone:expiredCertificates?'danger':expiringCertificates?'attention':'ok'},
    ...(showSensitiveHealth?[{icon:Activity,label:en?'Staff health / surveillance':'Επιτήρηση / υγεία προσωπικού',value:surveillanceValue,detail:surveillanceDetail,tone:'neutral'}]:[]),
  ]
  const name=language==='el'?\\`\\${employee.lastName} \\${employee.firstName}\\`:\\`\\${employee.firstNameEn||employee.firstName} \\${employee.lastNameEn||employee.lastName}\\`
  return <div className="my-profile-employee-summary">
    <section className="surface my-profile-employee-card"><div><span className="eyebrow">{en?'EMPLOYEE DETAILS':'ΣΤΟΙΧΕΙΑ ΕΡΓΑΖΟΜΕΝΟΥ'}</span><h2>{name}</h2><p>{language==='el'?employee.profession:employee.professionEn||employee.profession} · {language==='el'?employee.department:employee.departmentEn||employee.department}</p></div><span className={\\`status-badge \\${employee.employmentStatus==='active'?'active':''}\\`}>{employee.employmentStatus==='active'?(en?'Active':'Ενεργός'):t(employee.employmentStatus)}</span><div className="my-profile-employee-facts"><RecordFact label={en?'Employee code':'Κωδικός εργαζομένου'} value={employee.id}/><RecordFact label={t('department')} value={language==='el'?employee.department:employee.departmentEn}/><RecordFact label={t('professionalCategory')} value={language==='el'?employee.profession:employee.professionEn}/><RecordFact label={en?'Hire date':'Ημερομηνία πρόσληψης'} value={fmt(employee.hireDate)}/></div></section>
    <section className="my-profile-summary-grid" aria-label={en?'Personal status summary':'Προσωπική σύνοψη κατάστασης'}>{cards.map(({icon:Icon,label,value,detail,tone})=><article className={\\`surface my-profile-summary-card \\${tone||''}\\`} key={label}><div className="my-profile-summary-icon"><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>)}</section>
    {!showSensitiveHealth&&<section className="surface my-profile-privacy-note"><ShieldCheck size={17}/><span>{en?'Staff-health surveillance details are hidden because they are not available for this account’s self-view permissions.':'Τα στοιχεία επιτήρησης/υγείας προσωπικού αποκρύπτονται επειδή δεν επιτρέπονται στα δικαιώματα προσωπικής προβολής αυτού του λογαριασμού.'}</span></section>}
  </div>
}
`
page=page.slice(0,start)+replacement+page.slice(end)
fs.writeFileSync(pagePath,page)

let css=fs.readFileSync(cssPath,'utf8')
const marker='/* My Profile action-oriented status refinement. */'
if(!css.includes(marker))css+=`\n\n${marker}\n.my-profile-summary-card{align-items:flex-start;min-height:112px;border-left:3px solid transparent}.my-profile-summary-card>div:last-child{display:flex;flex-direction:column;align-items:flex-start;gap:5px}.my-profile-summary-card strong{font-size:14px;line-height:1.35}.my-profile-summary-card small{font-size:11.5px;line-height:1.45}.my-profile-summary-card.ok{border-left-color:var(--lo-color-success,#1f8f5f)}.my-profile-summary-card.attention{border-left-color:var(--lo-color-warning,#b7791f)}.my-profile-summary-card.danger{border-left-color:var(--lo-color-danger,#c43d4b)}.my-profile-summary-card.muted{opacity:.82}.my-profile-privacy-note{display:flex;align-items:flex-start;gap:9px;padding:13px 15px;color:var(--lo-color-text-muted);font-size:12px;line-height:1.5}.my-profile-privacy-note svg{flex:0 0 auto;color:var(--lo-color-primary)}\n`
fs.writeFileSync(cssPath,css)

console.log('My Profile action summary refinement applied.')
