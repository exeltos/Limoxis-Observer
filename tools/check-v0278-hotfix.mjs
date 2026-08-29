import fs from 'node:fs'

const lab=fs.readFileSync('src/features/laboratory/LaboratorySampleRecordPage.jsx','utf8')
const employee=fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const laboratoryPage=fs.readFileSync('src/features/laboratory/LaboratoryPage.jsx','utf8')
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8')

const checks=[
  [lab,'function ResultPanel({sample,persist,syncValidatedResult,t,language,fmt,canManage,canValidate,canClassify,notify,actor,actorName,onNext})'],
  [lab,'function EmployeeScreeningLaboratoryRecord({sample,persist,t,language,fmt,canManage,canValidate,canAttach,canReopen,canPrint,canExport,notify,recordNavigation,actor,actorName})'],
  [lab,'function EnvironmentalLaboratoryRecord({sample,persist,t,language,fmt,canManage,canValidate,canAttach,canReopen,canPrint,canExport,notify,recordNavigation,actor,actorName})'],
  [lab,'function EnvironmentalFinalization({sample,isPlate,persist,t,fmt,canFinalize,notify,actor,actorName,onFinalized})'],
  [lab,'function FinalizationPanel({sample,persist,syncValidatedResult,t,fmt,canFinalize,notify,actor,actorName,onFinalized})'],
  [employee,'function InlineDateDetail({editing,l,v,display,onChange})'],
  [employee,'<div className="detail-item"><span>{l}</span><strong>{display||\'—\'}</strong></div>'],
  [app,'path="surveillance/:caseId" element={<Suspense fallback={<RouteLoading/>}><PatientClinicalRecordPage /></Suspense>}'],
  [app,'path="employees/:employeeId" element={<Suspense fallback={<RouteLoading/>}><EmployeeRecordPage /></Suspense>}'],
  [laboratoryPage,"return <MetricCard icon={Icon} value={value} label={label} tone={danger?'danger':'neutral'}/>"],
  [ci,'run: npm run check'],
]

let failed=0
for(const [text,needle] of checks){
  if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}
}

if(/<Field\b/.test(employee)){console.error('Undefined Field JSX still exists in EmployeeRecordPage');failed++}

const actorUsingFunctions=[
  'ResultPanel','EmployeeScreeningLaboratoryRecord','EnvironmentalLaboratoryRecord','EnvironmentalFinalization','FinalizationPanel'
]
for(const fn of actorUsingFunctions){
  const rx=new RegExp(`function ${fn}\\(\\{[^}]*actor[^}]*\\}\\)`)
  if(!rx.test(lab)){console.error(`${fn} does not receive actor`);failed++}
}

if(failed)process.exit(1)
console.log(`v0.27.8 hotfix regression passed: ${checks.length}/${checks.length} + actor/Field scan`)
