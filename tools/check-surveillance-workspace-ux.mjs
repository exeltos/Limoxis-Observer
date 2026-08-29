import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/features/surveillance/SurveillancePage.jsx','utf8')
const checks=[
 [page,'surveillance-domain-tabs canonical-module-tabs'],
 [page,'surveillance-registry scroll-list'],
 [page,'registry.rowProps(item.id)'],
 [css,'Surveillance daily workspace refinement'],
 [css,'.surveillance-registry-head,'],
 [css,'position:sticky'],
 [css,'.surveillance-registry-row.registry-row-returned'],
 [css,'.surv-status{'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Surveillance workspace UX passed: ${checks.length}/${checks.length}`)
