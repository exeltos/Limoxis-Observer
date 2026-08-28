import fs from 'node:fs'
const app=fs.readFileSync('src/app/App.jsx','utf8')
const nav=fs.readFileSync('src/app/navigation.js','utf8')
const help=fs.readFileSync('src/core/help/helpContent.js','utf8')
const roles=fs.readFileSync('src/core/permissions/roles.js','utf8')
const tests=[
 ['no records route',!app.includes('path="records"')&&!app.includes('RecordsPage')],
 ['no records navigation',!nav.includes("to:'/records'")],
 ['no records help',!help.includes("'/records'")],
 ['compat capability retained',roles.includes("VIEW_RECORDS: 'view_records'")]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.20 remove records smoke passed: ${tests.length}/${tests.length}`)
