import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/features/laboratory/LaboratoryPage.jsx','utf8')
const checks=[
 [page,'surface workspace-fill lab-registry-shell'],
 [page,'data-table lab-table sticky-table'],
 [page,'registry.rowProps(sample.id)'],
 [page,'lab-result-cell'],
 [css,'Laboratory daily workspace refinement'],
 [css,'.lab-registry-shell>.filter-system'],
 [css,'.lab-registry-shell>.scroll-table'],
 [css,'.critical-mini{'],
 [css,'.linked-case-chip,.amr-chip'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Laboratory workspace UX passed: ${checks.length}/${checks.length}`)
