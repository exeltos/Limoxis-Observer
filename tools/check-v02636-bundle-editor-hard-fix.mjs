import fs from 'node:fs'
const p=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const start=p.indexOf('function BundleEditor')
const tail=p.slice(start)
const next=tail.indexOf('\nfunction ',1)
const block=next>0?tail.slice(0,next):tail
const count=(block.match(/const \{notify,confirm\}=useFeedback\(\)/g)||[]).length
if(count!==1){console.error(`FAIL BundleEditor feedback hook count=${count}`);process.exit(1)}
console.log('✓ BundleEditor contains exactly one useFeedback declaration')
console.log('v0.26.36 hard fix passed')
