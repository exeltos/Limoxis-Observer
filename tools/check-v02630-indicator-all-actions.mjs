import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const e=fs.readFileSync('src/features/indicators/indicatorEngine.js','utf8')
const st=fs.readFileSync('src/features/indicators/indicatorStore.js','utf8')
const tests=[
 ['icon imports',p.includes('Pencil')&&p.includes('Trash2')],
 ['common icon actions',p.includes('record-inline-actions indicator-dialog-icon-actions')],
 ['all manageable',p.includes('canManage&&<div className="record-inline-actions indicator-dialog-icon-actions"')&&!p.includes('isCustom&&canManage')],
 ['system override',p.includes('saveIndicatorOverride(def.id,def)')&&st.includes('limoxis.indicatorOverrides.v1')],
 ['system delete config',p.includes('markIndicatorDeleted(item.id)')&&st.includes('limoxis.deletedIndicators.v1')],
 ['engine applies config',e.includes('loadIndicatorOverrides')&&e.includes('loadDeletedIndicatorIds')],
 ['confirm delete',p.includes("title:'Διαγραφή δείκτη'")&&p.includes('danger:true')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.30 indicator all-actions smoke passed: ${tests.length}/${tests.length}`)
