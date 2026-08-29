import fs from 'node:fs'
const a=fs.readFileSync('src/app/AppShell.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['global search removed',!a.includes('className="search-box"')],
 ['unused Search import removed',!a.includes('LogOut, Search, X')],
 ['utility card class',a.includes('topbar-utility-group topbar-utility-card')],
 ['utility/user matched height',c.includes('.topbar-utility-card{')&&c.includes('height:42px!important')&&c.includes('.user-chip{')],
 ['help search smaller',c.includes('.help-panel-shell .manual-search')&&c.includes('height:34px!important')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.56 focused smoke passed: ${tests.length}/${tests.length}`)
