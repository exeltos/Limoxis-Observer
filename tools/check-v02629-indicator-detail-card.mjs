import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const tests=[
 ['form-like card',p.includes('indicator-view-form')&&p.includes('indicator-view-grid')],
 ['calculation fields',p.includes('Αριθμητής')&&p.includes('Παρονομαστής')&&p.includes('Πολλαπλασιαστής')],
 ['custom edit',p.includes("isCustom&&canManage&&<Button variant=\"secondary\" onClick={onEdit}>Επεξεργασία</Button>")],
 ['custom delete',p.includes("isCustom&&canManage&&<Button className=\"danger\"")&&p.includes('>Διαγραφή</Button>')],
 ['system read only note',p.includes('Βασικός δείκτης Limoxis')&&p.includes('δεν διαγράφεται')],
 ['row interaction retained',p.includes('onClick={()=>setSelected(x)}')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.29 indicator detail card smoke passed: ${tests.length}/${tests.length}`)
