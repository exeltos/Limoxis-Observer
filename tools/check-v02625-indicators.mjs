import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const e=fs.readFileSync('src/features/indicators/indicatorEngine.js','utf8')
const d=fs.readFileSync('src/features/indicators/indicatorDefinitions.js','utf8')
const tests=[
 ['real engine',e.includes('surveillanceDemoData')&&e.includes('handHygieneRows')&&e.includes('loadTrainingState')],
 ['no static demo values',!p.includes('indicatorDemoValues')],
 ['registry table',p.includes('sticky-table')&&p.includes('Αποτέλεσμα')&&p.includes('Πηγή')],
 ['numerator denominator',p.includes('Αριθμητής')&&p.includes('Παρονομαστής')],
 ['detail dialog',p.includes('IndicatorDialog')&&p.includes('ObserverDialog')],
 ['source drilldown',p.includes('Άνοιγμα πηγής')&&p.includes('sourceRoutes')],
 ['targets',d.includes("target:85")&&p.includes('Εντός στόχου')],
 ['governed version',d.includes("version:'2026.2'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.25 indicators smoke passed: ${tests.length}/${tests.length}`)
