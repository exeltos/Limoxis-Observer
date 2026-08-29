import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/design-system/Page.jsx','utf8')
const checks=[
 [page,'className="page-header"'],[page,'className="page-actions"'],
 [css,'canonical page and section hierarchy'],[css,'.page-header h1{'],
 [css,'.section-head,.section-header'],[css,'.eyebrow{'],[css,'.workspace-summary{']
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Page hierarchy consistency passed: ${checks.length}/${checks.length}`)
