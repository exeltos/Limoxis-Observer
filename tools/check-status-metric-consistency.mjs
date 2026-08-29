import fs from 'node:fs'
const theme=fs.readFileSync('src/styles/theme.css','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')
const checks=[
 [theme,'--lo-status-success-bg'],[theme,'--lo-status-warning-bg'],[theme,'--lo-status-danger-bg'],
 [theme,'--lo-status-neutral-bg'],[theme,'--lo-metric-value'],
 [css,'canonical status badges + KPI visual hierarchy'],[css,'.status-badge.warning,.status-badge.temporary'],
 [css,'.status-badge.danger,.status-badge.risk'],[css,'.kpi-card,.module-summary-metric'],
 [css,'.environmental-summary-strip>div,.indicator-summary-strip>div,.bundle-summary-card>div']
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Status/metric consistency passed: ${checks.length}/${checks.length}`)
