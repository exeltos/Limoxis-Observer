import fs from 'node:fs'
const files=[
 'src/features/patients/PatientsPage.jsx',
 'src/features/employees/EmployeesPage.jsx',
 'src/features/laboratory/LaboratoryPage.jsx',
 'src/features/quality/QualityPage.jsx',
 'src/features/controls/ControlsPage.jsx',
 'src/features/committees/CommitteesPage.jsx',
 'src/features/documents/DocumentsPage.jsx',
 'src/features/training/TrainingPage.jsx',
 'src/features/occupational-health/OccupationalHealthPage.jsx',
 'src/features/indicators/IndicatorsPage.jsx',
 'src/features/prevention/PreventionPage.jsx',
]
let failed=0
for(const file of files){
 const text=fs.readFileSync(file,'utf8')
 for(const needle of ['FilterBar','scroll-table']){
  if(!text.includes(needle)){console.error(`${file}: missing ${needle}`);failed++}
 }
}
const css=fs.readFileSync('src/styles/global.css','utf8')
for(const needle of ['canonical registry workspace','scrollbar-gutter:stable','.scroll-table table thead th']){
 if(!css.includes(needle)){console.error(`global.css: missing ${needle}`);failed++}
}
if(failed)process.exit(1)
console.log(`Registry UX consistency passed: ${files.length} registries + canonical scroll contract`)
