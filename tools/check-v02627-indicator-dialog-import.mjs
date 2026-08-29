import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const od=fs.readFileSync('src/design-system/ObserverDialog.jsx','utf8')
const tests=[
 ['correct import',p.includes("import { ObserverDialog,DialogActions } from '../../design-system/ObserverDialog'")&&!p.includes("design-system/DialogActions")],
 ['export exists',od.includes('export function DialogActions')],
 ['new dialog footer',p.includes('footer={<DialogActions onCancel={onClose} onSave={save}')],
 ['detail footer',p.includes('footer={<><Button variant="secondary" onClick={onClose}>Κλείσιμο</Button>')],
 ['no stray dialog actions body',!p.includes('<DialogActions><Button')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.27 indicator dialog import smoke passed: ${tests.length}/${tests.length}`)
