import fs from 'node:fs'
const p=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const d=fs.readFileSync('src/features/management/managementData.js','utf8')
const tests=[
 ['protected metadata',d.includes('system:true')&&d.includes('locked:true')],
 ['WHO pathogens',d.includes('WHO BPPL 2024')&&d.includes('Acinetobacter baumannii')&&d.includes('Candida auris')],
 ['AWaRe antibiotics',d.includes('WHO AWaRe')&&d.includes('Ceftazidime/avibactam')],
 ['EODY diseases',d.includes('ΕΟΔΥ · υποχρεωτική δήλωση')&&d.includes('Μηνιγγιτιδοκοκκική νόσος')],
 ['CDC isolation',d.includes('CDC Transmission-Based Precautions')&&d.includes('Airborne precautions')],
 ['protected UI',p.includes('Προστατευμένη βασική βιβλιοθήκη')&&p.includes('meta.system')],
 ['no protected delete',p.includes("if(original[2]?.system)")],
 ['local extensibility',p.includes('newLocalLibraryItem')&&p.includes('Νοσοκομείο')],
 ['source column',p.includes('Πηγή / αναφορά')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.31 protected libraries smoke passed: ${tests.length}/${tests.length}`)
