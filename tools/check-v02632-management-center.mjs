import fs from 'node:fs'
const p=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const tests=[
 ['overview default',p.includes("useState('overview')")&&p.includes('ManagementOverview')],
 ['canonical tabs',p.includes('canonical-module-tabs management-tabs')],
 ['overview areas',p.includes('Βιβλιοθήκες')&&p.includes('Ασθενείς-ημέρες')&&p.includes('Εξωτερικές πηγές')],
 ['permission-aware overview',p.includes('allowed(CAPABILITIES.MANAGE_LIBRARIES)')],
 ['governance wording',p.includes('Τα προστατευμένα βασικά δεδομένα του Limoxis δεν διαγράφονται')],
 ['reference scopes',p.includes('CDC Infection Control')&&p.includes('Transmission-Based Precautions')],
 ['roles still present',p.includes("id:'roles'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.32 management center smoke passed: ${tests.length}/${tests.length}`)
