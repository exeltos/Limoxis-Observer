import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const e=fs.readFileSync('src/features/indicators/indicatorEngine.js','utf8')
const s=fs.readFileSync('src/features/indicators/indicatorStore.js','utf8')
const tests=[
 ['create action',p.includes('UI_ACTIONS.CREATE')&&p.includes('NewIndicatorDialog')],
 ['auto/manual modes',p.includes('Αυτόματος')&&p.includes('Χειροκίνητος')],
 ['metric catalog',e.includes('indicatorMetricCatalog')&&e.includes('hh_opportunities')],
 ['generic calculation',e.includes('calculateDefinition')&&e.includes('def.multiplier')],
 ['custom persistence',s.includes('limoxis.customIndicators.v1')&&p.includes('saveCustomIndicators')],
 ['simplified detail',p.includes('indicator-record-card')&&p.includes('Πώς υπολογίζεται')],
 ['traceability',p.includes('Ιχνηλασιμότητα')&&p.includes('Άνοιγμα πηγής')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.26 indicator builder smoke passed: ${tests.length}/${tests.length}`)
