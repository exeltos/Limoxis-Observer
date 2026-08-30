import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const button=read('src/design-system/Button.jsx')
const dialog=read('src/design-system/ObserverDialog.jsx')
const occ=read('src/features/occupational-health/OccupationalHealthPage.jsx')
const clinical=read('src/features/surveillance/PatientClinicalRecordPage.jsx')
const training=read('src/features/training/TrainingPage.jsx')
const lab=read('src/features/laboratory/LaboratorySampleRecordPage.jsx')
const css=read('src/styles/global.css')
const checks=[
 [button,'loading=false'],[button,'button-spinner'],[dialog,'<Save size={15}/>'],[dialog,'await onSave?.()'],
 [occ,'clickable-table'],[occ,"onClick={()=>openEmployee(x.employeeId)}"],
 [clinical,"navigate(`/laboratory/${encodeURIComponent(s.id)}`)"],[clinical,"navigate('/pharmacy')"],
 [training,'canonical-section-help'],[lab,'lab-workflow-nav-button next'],
 [css,'.management-shell>.management-tabs{overflow:hidden!important'],[css,':has(.lucide-pencil)'],[css,'.canonical-section-help,.section-note'],[css,'.lab-workflow-nav-button.next'],
]
let failed=0
for(const [text,needle] of checks)if(!text.includes(needle)){console.error('Missing:',needle);failed++}
if(occ.includes('open-record-button')){console.error('Occupational Health still renders Open Employee button');failed++}
if(clinical.includes('openInLaboratory')||clinical.includes('openInPharmacy')){console.error('Clinical data still renders redundant open-module buttons');failed++}
const rawFileInputs=[]
for(const p of ['src/features/training/TrainingPage.jsx'])if(read(p).includes('type="file"'))rawFileInputs.push(p)
if(rawFileInputs.length!==1){console.error('Unexpected raw feature file inputs:',rawFileInputs);failed++}
if(failed)process.exit(1)
console.log(`Global UX interaction consistency passed: ${checks.length}/${checks.length} + navigation/action scans`)
