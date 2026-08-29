import fs from 'node:fs'
const checks=[
 ['src/features/management/BundleLibraryPanel.jsx','hiddenById:actor.id'],
 ['src/features/management/BundleLibraryPanel.jsx',"x=>!x.hidden"],
 ['src/features/management/BundleLibraryPanel.jsx','publishedById:actor.id'],
 ['src/features/management/BundleLibraryPanel.jsx','retiredById:actor.id'],
 ['src/features/prevention/WasteEntryModal.jsx',"lifecycleStatus:'finalized'"],
 ['src/features/prevention/WasteEntryModal.jsx','finalizedById:initialRecord?.finalizedById||actor.id'],
 ['src/features/prevention/AntisepticEntryModal.jsx',"lifecycleStatus:'finalized'"],
 ['src/features/prevention/BundleExecutionModal.jsx',"lifecycleStatus:'finalized'"],
]
let failed=0
for(const [file,needle] of checks){const text=fs.readFileSync(file,'utf8');if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}}
if(failed)process.exit(1)
console.log(`Governance foundation audit passed: ${checks.length}/${checks.length}`)
