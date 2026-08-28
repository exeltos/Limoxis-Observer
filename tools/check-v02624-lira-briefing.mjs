import fs from 'node:fs'
const p=fs.readFileSync('src/features/lira/LiraPage.jsx','utf8')
const b=p.slice(p.indexOf('function Briefing'),p.indexOf('function Assistant'))
const tests=[['briefing title',b.includes('Τι χρειάζεται την προσοχή σας')],['no metric strip',!b.includes('module-summary-strip')],['priorities',b.includes('lira-focus-list')],['pulse',b.includes('Σημερινή εικόνα')],['monitoring',b.includes('Παρακολούθηση')],['checks',b.includes('Προτεινόμενοι έλεγχοι')],['chat preserved',p.includes('lira-chat-composer-wrap')]]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.24 briefing smoke passed: ${tests.length}/${tests.length}`)
