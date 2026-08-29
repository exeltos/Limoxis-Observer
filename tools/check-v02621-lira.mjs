import fs from 'node:fs'
const p=fs.readFileSync('src/features/lira/LiraPage.jsx','utf8')
const tests=[
 ['no placeholder',!p.includes('Foundation ready')],
 ['domain synthesis',p.includes('surveillanceDemoData')&&p.includes('laboratorySamples')&&p.includes('handHygieneRows')&&p.includes('qualityIncidents')],
 ['canonical tabs',p.includes('canonical-module-tabs')&&p.includes('Σήματα κινδύνου')&&p.includes('Ρώτησε τη LIRA')],
 ['risk signals',p.includes('buildAnalysis()')&&p.includes('severityLabels')],
 ['source links',p.includes("to:'/surveillance'")&&p.includes("to:'/laboratory'")&&p.includes("to:'/prevention'")],
 ['safety guardrail',p.includes('όχι αυτόνομη κλινική απόφαση')&&p.includes('δεν δημιουργεί διάγνωση')],
 ['assistant',p.includes('answerQuestion')&&p.includes('Τι συμβαίνει στη ΜΕΘ;')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.21 LIRA smoke passed: ${tests.length}/${tests.length}`)
