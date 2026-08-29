import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const checks=[
 'canonical table density & information hierarchy',
 '.data-table thead th,',
 '.data-table tbody td,',
 '.data-table td strong,',
 '.data-table td small,',
 '.data-table tbody tr.selected',
 'min-width:720px',
]
let failed=0
for(const needle of checks){if(!css.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Table UX consistency passed: ${checks.length}/${checks.length}`)
