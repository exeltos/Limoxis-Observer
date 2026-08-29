import fs from 'node:fs'
const p=fs.readFileSync('src/features/lira/LiraPage.jsx','utf8')
const dl=fs.readFileSync('src/features/lira/liraDataLayer.js','utf8')
const tests=[
 ['ask default',p.includes("useState('assistant')")],
 ['exact product tabs',p.includes('Ρώτησε τη LIRA')&&p.includes('LIRA Briefing')&&!p.includes('>Επισκόπηση</button>')&&!p.includes('>Σήματα κινδύνου')],
 ['briefing',p.includes('function Briefing')&&p.includes('LIRA Briefing')],
 ['signals retained as intelligence',p.includes('buildAnalysis()')&&p.includes('analysis.signals')],
 ['ask over Limoxis data',p.includes('answerQuestion')&&p.includes('δεδομένα του Limoxis')],
 ['scope contract',dl.includes('tenant + role + department scope/RLS')&&dl.includes('assertLiraScope')],
 ['primary record traceability',p.includes("to:'/surveillance'")&&p.includes("to:'/laboratory'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.22 LIRA two-entry smoke passed: ${tests.length}/${tests.length}`)
