import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const dialog=fs.readFileSync('src/design-system/ObserverDialog.jsx','utf8')
const card=fs.readFileSync('src/design-system/Card.jsx','utf8')
const checks=[
 [card,'export function Card('],
 [card,'lo-card lo-card-${size}'],
 [dialog,"new Set(['compact','standard','wide','workspace'])"],
 [css,'v0.27.3 — CANONICAL CARD + DIALOG GEOMETRY'],
 [css,'--lo-dialog-compact:520px'],
 [css,'--lo-dialog-standard:760px'],
 [css,'--lo-dialog-wide:1040px'],
 [css,'--lo-dialog-workspace:1280px'],
 [css,'.modal-backdrop>.observer-dialog-standard'],
 [css,'.modal-backdrop>.observer-dialog-wide'],
 [css,'.modal-backdrop>.observer-dialog-workspace'],
 [css,'.modal-backdrop>:is(.patient-entry-card,.surveillance-entry-card'],
 [css,'.modal-backdrop>:is(.control-editor-card,.control-execution-card-wide)'],
 [css,':is(.kpi-card,.module-summary-metric,.employee-kpi,.lab-kpi,.patient-summary-metric)'],
 [css,'height:96px!important'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Card/dialog geometry passed: ${checks.length}/${checks.length}`)
