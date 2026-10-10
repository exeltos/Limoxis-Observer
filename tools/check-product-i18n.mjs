import fs from 'node:fs'

const files=[
  'src/app/AppShell.jsx','src/features/management/ManagementPage.jsx','src/features/management/LibrariesPanel.jsx','src/features/management/BedDaysPanel.jsx','src/features/indicators/IndicatorsPage.jsx',
  'src/features/patients/PatientsPage.jsx','src/features/surveillance/SurveillanceCanonicalPage.jsx','src/design-system/RecordActions.jsx','src/design-system/AttachmentField.jsx','src/core/feedback/FeedbackContext.jsx','src/design-system/FilterBar.jsx','src/features/prevention/PreventionPage.jsx','src/features/employees/EmployeesPage.jsx','src/features/occupational-health/OccupationalHealthPage.jsx'
]

// Existing product i18n debt is a regression baseline, not an exemption for new debt.
// Reduce these values as strings move into the translation layer; never increase them
// merely to make CI pass. The unit is Greek letters, not lines, so reformatting a file
// (which splits one line into several) neither hides nor adds debt.
const baseline={
  'src/app/AppShell.jsx':0,
  'src/features/management/ManagementPage.jsx':0,
  'src/features/management/LibrariesPanel.jsx':0,
  'src/features/management/BedDaysPanel.jsx':0,
  'src/features/indicators/IndicatorsPage.jsx':0,
  'src/features/patients/PatientsPage.jsx':0,
  'src/features/surveillance/SurveillanceCanonicalPage.jsx':22,
  'src/design-system/RecordActions.jsx':0,
  'src/design-system/AttachmentField.jsx':138,
  'src/core/feedback/FeedbackContext.jsx':0,
  'src/design-system/FilterBar.jsx':0,
  'src/features/prevention/PreventionPage.jsx':0,
  'src/features/employees/EmployeesPage.jsx':0,
  'src/features/occupational-health/OccupationalHealthPage.jsx':124,
}

const greek=/[Α-Ωα-ωΆ-ώ]/gu
const regressions=[]
let total=0
for(const file of files){
  const source=fs.readFileSync(file,'utf8')
  const count=(source.match(greek)||[]).length
  total+=count
  const allowed=baseline[file]??0
  if(count>allowed){
    const lines=source.split(/\r?\n/).map((line,index)=>[index+1,line]).filter(([,line])=>/[Α-Ωα-ωΆ-ώ]/u.test(line))
    regressions.push(`${file}: ${count} hard-coded Greek letters (baseline ${allowed})\n  ${lines.map(([n,line])=>`${n}: ${line.trim().slice(0,120)}`).join('\n  ')}`)
  }
}
if(regressions.length){
  console.error('Product i18n regression detected:')
  console.error(regressions.join('\n'))
  process.exit(1)
}
console.log(`Product i18n regression audit passed: ${files.length} UI files; ${total} pre-existing hard-coded Greek letters, no increase.`)
