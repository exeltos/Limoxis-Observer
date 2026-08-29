import fs from 'node:fs'
const training=fs.readFileSync('src/features/training/TrainingPage.jsx','utf8')
const employees=fs.readFileSync('src/features/employees/EmployeesPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const create=fs.readFileSync('src/features/employees/EmployeeCreatePage.jsx','utf8')
const tests=[
 ['training create one shared card',training.includes('record-section training-create-form')&&!training.includes('training-create-scroll')],
 ['material view action',training.includes('viewTrainingMaterial')&&training.includes('aria-label="Προβολή"')&&training.includes('URL.createObjectURL(f)')],
 ['employee create route',employees.includes("navigate('/employees/new')")&&app.includes('employees/new')&&app.includes('EmployeeCreatePage')],
 ['employee create shared shell',create.includes('EntityRecordShell')&&create.includes('record-section employee-create-form')],
 ['employee central libraries',create.includes('demoLibrarySeed.departments')&&create.includes('demoLibrarySeed.professionalCategories')],
 ['employee store',employees.includes('loadEmployees')&&training.includes("from '../employees/employeeStore'")]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.12 focused smoke passed: ${tests.length}/${tests.length}`)
