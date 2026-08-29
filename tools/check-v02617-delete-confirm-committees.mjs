import fs from 'node:fs'
const committees=fs.readFileSync('src/features/committees/CommitteesPage.jsx','utf8')
const record=fs.readFileSync('src/features/committees/CommitteeRecordPage.jsx','utf8')
const therapy=fs.readFileSync('src/features/surveillance/PatientClinicalRecordPage.jsx','utf8')
const env=fs.readFileSync('src/features/surveillance/EnvironmentalSurveillanceFlow.jsx','utf8')
const bundles=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const tests=[
 ['committee typography',committees.includes('committee-create-dialog-content')&&fs.readFileSync('src/styles/global.css','utf8').includes('v0.26.17 Committees create typography')],
 ['committee common roles',committees.includes("'Πρόεδρος'")&&committees.includes("'Γραμματέας'")&&committees.includes("'Αναπληρωματικό μέλος'")],
 ['committee role free text',committees.includes('placeholder="π.χ. Πρόεδρος, Γραμματέας, Μέλος"')],
 ['committee draft remove confirm',committees.includes("title:'Αφαίρεση μέλους'")&&committees.includes('await confirm')],
 ['meeting topic remove confirm',record.includes("title:'Αφαίρεση θέματος'")&&record.includes('const removeTopic=async')],
 ['committee documents functional',record.includes('<AttachmentField')&&record.includes("action:'Ενημέρωση εγγράφων επιτροπής'")],
 ['therapy remove confirm',therapy.includes('async function remove(id)')&&therapy.includes("message:t('deleteConfirm')")],
 ['environment row remove confirm',env.includes("title:'Αφαίρεση σημείου'")],
 ['bundle element remove confirm',bundles.includes("title:'Αφαίρεση στοιχείου'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.17 focused smoke passed: ${tests.length}/${tests.length}`)
