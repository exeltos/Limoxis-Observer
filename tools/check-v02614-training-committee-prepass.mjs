import fs from 'node:fs'
const p=fs.readFileSync('src/features/training/TrainingPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const committee=fs.readFileSync('src/features/committees/CommitteeCreatePage.jsx','utf8')
const tests=[
 ['training create opens card',p.includes("setDialog({type:'program'})")&&p.includes("dialog?.type==='program'")&&!app.includes('training/new')],
 ['hybrid people kept',p.includes('StaffOrTextField label="Υπεύθυνος προγράμματος *"')&&p.includes('StaffOrTextField label="Εκπαιδευτής *"')],
 ['audience suggestions kept',p.includes('training-audience-options')&&p.includes('audienceOptions')],
 ['material clean view',p.includes("window.open(target,'_blank','noopener,noreferrer')")&&!p.includes('training-material-preview')],
 ['dataUrl blob reopen',p.includes('dataUrlToObjectUrl')&&p.includes('new Blob')],
 ['committee prepass',committee.includes('committee-create-card')&&committee.includes('committee-create-aside')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.14 focused smoke passed: ${tests.length}/${tests.length}`)
