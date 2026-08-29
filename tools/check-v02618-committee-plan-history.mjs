import fs from 'node:fs'
const p=fs.readFileSync('src/features/committees/CommitteeRecordPage.jsx','utf8')
const tests=[
 ['decision filters',p.includes('Αναζήτηση απόφασης, ενέργειας ή υπευθύνου')&&p.includes('function Decisions({rows,canManage,onEdit,onStatus})')],
 ['decision edit',p.includes("action:'Επεξεργασία απόφασης / ενέργειας'")&&p.includes('Επεξεργασία απόφασης')],
 ['annual plan filters',p.includes('Αναζήτηση στόχου, δείκτη ή υπευθύνου')&&p.includes('function AnnualPlan({rows,canManage,onAdd,onEdit,onStatus})')],
 ['objective edit',p.includes("action:'Επεξεργασία στόχου ετήσιου σχεδίου'")&&p.includes('Επεξεργασία στόχου')],
 ['history table',p.includes('function CommitteeHistory')&&p.includes('Αναζήτηση ενέργειας, χρήστη ή αιτιολογίας')],
 ['shared filters',p.includes('FilterBar')&&p.includes('FilterSelect')],
 ['overdue retained',p.includes('committee-row-overdue')&&p.includes('Εκπρόθεσμο')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.18 committee plan/history smoke passed: ${tests.length}/${tests.length}`)
