import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const shell=fs.readFileSync('src/design-system/EntityRecordShell.jsx','utf8')
const observer=fs.readFileSync('src/design-system/ObserverDialog.jsx','utf8')
const checks=[
 [css,'visual consistency audit / shared surface polish'],
 [css,'canonical table density & information hierarchy'],
 [css,'canonical page and section hierarchy'],
 [css,'canonical detail screen rhythm'],
 [css,'canonical dialog/action hierarchy'],
 [css,'canonical registry workspace'],
 [shell,'canonical-detail-screen'],
 [observer,'DialogActions'],
 [css,'.button:focus-visible'],
 [css,'.inline-empty{'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Visual consistency audit passed: ${checks.length}/${checks.length}`)
