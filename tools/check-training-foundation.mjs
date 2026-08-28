import fs from 'node:fs'
const page=fs.readFileSync(new URL('../src/features/training/TrainingPage.jsx',import.meta.url),'utf8')
const data=fs.readFileSync(new URL('../src/features/training/trainingData.js',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8')
const checks=[
 ['role-aware manage capability',page.includes('MANAGE_TRAINING')],
 ['programmes tab',page.includes('Προγράμματα')],
 ['assignments tab',page.includes('Αναθέσεις & συμμετοχές')],
 ['competence tab',page.includes('Ικανότητες & λήξεις')],
 ['employee self service',page.includes('Οι εκπαιδεύσεις μου')&&page.includes('Πιστοποιητικά')],
 ['assessment threshold',page.includes('passScore')],
 ['retraining signal',page.includes('επανεκπαίδευση')||page.includes('Επανεκπαίδευση')],
 ['expiry calculation',data.includes('validityUntil')],
 ['computed overdue',data.includes('computedAssignmentStatus')],
 ['certificate evidence',data.includes('certificates')],
 ['canonical module tabs',page.includes('canonical-module-tabs')&&page.includes('className={`tab ')],
 ['central summary metrics',page.includes('module-summary-strip')&&page.includes('module-summary-metric')],
 ['shared dialog/form primitives',page.includes('ObserverDialog')&&page.includes('entry-grid compact')&&page.includes('className="field"')],
 ['no feature-specific training CSS',!css.includes('.training-')&&!page.includes('className="training-')],
]
let failed=0
for(const [label,ok] of checks){console.log(`${ok?'✓':'✗'} ${label}`);if(!ok)failed++}
console.log(`\n${checks.length-failed}/${checks.length} checks passed`)
if(failed)process.exit(1)
