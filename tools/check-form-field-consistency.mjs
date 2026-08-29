import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const checks=['canonical form field contract','--lo-field-height:40px','--lo-field-radius:9px','textarea{','resize:vertical','.inline-empty{']
let failed=0
for(const needle of checks){if(!css.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Form/field consistency passed: ${checks.length}/${checks.length}`)
