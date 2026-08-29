import fs from 'node:fs'
const shell=fs.readFileSync('src/design-system/EntityRecordShell.jsx','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')
const checks=[
 [shell,'canonical-detail-screen'],
 [css,'canonical detail screen rhythm'],
 [css,'grid-template-rows:auto auto minmax(0,1fr)'],
 [css,'.entity-record-tabs>button.active'],
 [css,'.entity-record-body{'],
 [css,'scrollbar-gutter:stable'],
 [css,'.record-section+.record-section'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Detail screen consistency passed: ${checks.length}/${checks.length}`)
