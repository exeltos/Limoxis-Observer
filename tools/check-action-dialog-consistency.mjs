import fs from 'node:fs'
const observer=fs.readFileSync('src/design-system/ObserverDialog.jsx','utf8')
const committee=fs.readFileSync('src/features/committees/CommitteeRecordPage.jsx','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')
const checks=[
 [observer,'cancelLabel'],
 [committee,'<DialogActions onCancel={onClose} onSave={()=>onSave(d)}'],
 [committee,"en?'Complete & send for approval':'Ολοκλήρωση & αποστολή έγκρισης'"],
 [css,'canonical dialog/action hierarchy'],
 [css,'.record-inline-actions>button.danger'],
 [css,'.observer-dialog>footer'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Action/dialog consistency passed: ${checks.length}/${checks.length}`)
