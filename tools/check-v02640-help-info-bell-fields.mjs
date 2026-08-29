import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8')
const shell=r('src/app/AppShell.jsx'),help=r('src/core/help/HelpCenter.jsx'),ann=r('src/features/management/AnnouncementsPanel.jsx'),css=r('src/styles/global.css')
const tests=[
 ['bell present',shell.includes('<Bell size={19}/>')&&shell.includes('notification-count')],
 ['bell before help',shell.indexOf('notification-button')<shell.indexOf('help-button')],
 ['help title',help.includes('Κέντρο Βοήθειας & Πληροφοριών')],
 ['renamed section tab',help.includes('Οδηγίες ενότητας')],
 ['about tab integrated',help.includes('Σχετικά με το Limoxis')&&help.includes("tab==='info'")],
 ['shared announcement controls',ann.includes('announcement-control')&&ann.includes('announcement-textarea')],
 ['date controls normalized',ann.includes('className="announcement-control" type="date"')&&css.includes('input[type="date"].announcement-control')],
 ['select controls normalized',css.includes('select.announcement-control')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.40 focused smoke passed: ${tests.length}/${tests.length}`)
