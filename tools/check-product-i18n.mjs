import fs from 'node:fs'
const files=[
  'src/app/AppShell.jsx','src/features/management/ManagementPage.jsx','src/features/management/LibrariesPanel.jsx','src/features/management/BedDaysPanel.jsx','src/features/indicators/IndicatorsPage.jsx',
  'src/features/patients/PatientsPage.jsx','src/features/surveillance/SurveillancePage.jsx','src/design-system/RecordActions.jsx','src/design-system/AttachmentField.jsx','src/core/feedback/FeedbackContext.jsx','src/design-system/FilterBar.jsx','src/features/prevention/PreventionPage.jsx','src/features/employees/EmployeesPage.jsx','src/features/occupational-health/OccupationalHealthPage.jsx'
]
const greek=/[Α-Ωα-ωΆ-ώ]/u
const violations=[]
for(const file of files){const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);lines.forEach((line,index)=>{if(greek.test(line))violations.push(`${file}:${index+1}: ${line.trim()}`)})}
if(violations.length){console.error(`Product i18n audit failed (${violations.length})`);console.error(violations.join('\n'));process.exit(1)}
console.log(`Product i18n audit passed: ${files.length} UI files, 0 hard-coded Greek strings.`)
