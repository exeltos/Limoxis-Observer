import fs from 'node:fs'
const l=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const b=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const m=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['colored nav',l.includes('library-category-icon')&&c.includes('.tone-blue')&&c.includes('.tone-red')],
 ['library edit/remove',l.includes('onClick={()=>openEdit(row)}')&&l.includes('onClick={()=>remove(row)}')],
 ['hospital override',l.includes('Hospital override')&&l.includes('system:false')],
 ['environment in libraries',l.includes("['environmentalProtocols','environmentalProtocols'")&&l.includes('<EnvironmentalStandardsPanel embedded/>')],
 ['bundle edit/delete',b.includes('function editBundle(item)')&&b.includes('function removeBundle(item)')&&b.includes('Trash2')],
 ['published bundle override',b.includes("item.status==='published'||item.status==='retired'||item.system")&&b.includes('hospital override')],
 ['reference actions',m.includes('setReferenceEditor({...item})')&&m.includes('Διαγραφή εξωτερικής πηγής')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.34 management admin actions smoke passed: ${tests.length}/${tests.length}`)
