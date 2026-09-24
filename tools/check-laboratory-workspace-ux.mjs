import fs from 'node:fs'
const css=fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.css','utf8')
const page=fs.readFileSync('src/features/laboratory/LaboratoryWorkspace.jsx','utf8')
const checks=[
 [page,'surface workspace-fill registry-workspace workspace-column canonical-paginated-registry'],
 [page,'data-table lab-table sticky-table'],
 [page,'registry.rowProps(sample.id)'],
 [page,'RegistryPagination'],
 [page,'pagedRows.map(sample =>'],
 [page,'registry-empty-state'],
 [page,'FilterBar'],
 [css,'/* Laboratory registry */'],
 [css,'.registry-workspace.canonical-paginated-registry'],
 [css,'.lab-table'],
 [css,'.linked-case-chip'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Laboratory workspace UX passed: ${checks.length}/${checks.length}`)
