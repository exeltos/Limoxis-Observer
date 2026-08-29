import fs from 'node:fs'
const docs=fs.readFileSync('src/features/documents/DocumentsPage.jsx','utf8')
const rec=fs.readFileSync('src/features/documents/DocumentRecordPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const employees=fs.readFileSync('src/features/employees/EmployeesPage.jsx','utf8')
const empCreate=fs.readFileSync('src/features/employees/EmployeeCreatePage.jsx','utf8')
const attach=fs.readFileSync('src/design-system/AttachmentField.jsx','utf8')
const tests=[
 ['documents registry',docs.includes('RecordActions')&&docs.includes('FilterBar')&&docs.includes('module-summary-strip')],
 ['document create card',docs.includes('DocumentCreateDialog')&&docs.includes('ObserverDialog width="wide"')],
 ['document detail route',app.includes('documents/:documentId')&&app.includes('DocumentRecordPage')],
 ['document lifecycle',rec.includes('Δημοσίευση εγγράφου')&&rec.includes('Αρχειοθέτηση εγγράφου')&&rec.includes('await confirm')],
 ['document audit',rec.includes('history:')&&rec.includes('Ενημέρωση συνημμένων')],
 ['employee create card',employees.includes('setCreateOpen(true)')&&employees.includes('<EmployeeCreateDialog')],
 ['no employee new route',!app.includes('employees/new')&&!app.includes('EmployeeCreatePage')],
 ['employee libraries',empCreate.includes('demoLibrarySeed.departments')&&empCreate.includes('demoLibrarySeed.professionalCategories')],
 ['durable local attachment preview',attach.includes('reader.readAsDataURL(file)')&&attach.includes('file.dataUrl||file.objectUrl||file.url')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.19 focused smoke passed: ${tests.length}/${tests.length}`)
