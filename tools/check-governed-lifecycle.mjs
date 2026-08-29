import fs from 'node:fs'
const required=[
  ['src/core/audit/governedLifecycle.js','openCorrection'],
  ['src/core/audit/governedLifecycle.js','voidRecord'],
  ['src/core/audit/governedLifecycle.js','finalizeRecord'],
  ['src/core/audit/governedLifecycle.js','correctionOpenedById'],
  ['src/core/audit/governedLifecycle.js','voidedById'],
  ['src/core/audit/governedLifecycle.js','finalizedById'],
  ['src/design-system/GovernedReasonDialog.jsx','reason.trim()'],
  ['src/features/prevention/PreventionRecordPage.jsx','applyGovernedVoid'],
  ['src/features/prevention/PreventionPage.jsx','openCorrection'],
  ['src/features/quality/QualityRecordPage.jsx','applyGovernedVoid'],
  ['src/features/quality/QualityRecordPage.jsx','openCorrection'],
  ['src/features/laboratory/LaboratorySampleRecordPage.jsx','applyGovernedFinalize'],
  ['src/features/laboratory/LaboratorySampleRecordPage.jsx','openCorrection'],
]
let failed=0
for(const [file,needle] of required){
 const text=fs.readFileSync(file,'utf8')
 if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}
}
if(failed)process.exit(1)
console.log(`Governed lifecycle contract passed: ${required.length}/${required.length}`)
