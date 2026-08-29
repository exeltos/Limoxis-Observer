import fs from 'node:fs'
const p=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const block=p.slice(p.indexOf('function BundleEditor'),p.indexOf('function defaultElement'))
const count=(block.match(/const \{notify,confirm\}=useFeedback\(\)/g)||[]).length
const tests=[
 ['single feedback hook',count===1],
 ['bundle editor present',p.includes('function BundleEditor({draft,onClose,onSave})')],
 ['bundle edit preserved',p.includes('function editBundle(item)')],
 ['bundle delete preserved',p.includes('function removeBundle(item)')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.35 bundle editor smoke passed: ${tests.length}/${tests.length}`)
