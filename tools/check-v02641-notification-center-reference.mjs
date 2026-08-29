import fs from 'node:fs'
const ui=fs.readFileSync('src/core/notifications/NotificationCenter.jsx','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['header v2',ui.includes('notification-header-v2')&&ui.includes('μη αναγνωσμένες')],
 ['daily shortcuts',ui.includes('Σημερινή ενημέρωση')&&ui.includes('Σημερινή ευχή')&&ui.includes('Όλα αναγνωσμένα')],
 ['old recovery removed',!ui.includes('Χάσατε την ενημέρωση εισόδου;')],
 ['compact rows',ui.includes('notification-row-v2')&&ui.includes('notification-copy-v2')],
 ['reference styling',css.includes('.notification-shortcuts-v2')&&css.includes('.notification-row-v2')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.41 focused smoke passed: ${tests.length}/${tests.length}`)
