import fs from 'node:fs'
const p=fs.readFileSync('src/features/indicators/IndicatorsPage.jsx','utf8')
const roles=fs.readFileSync('src/core/permissions/roles.js','utf8')
const tests=[
 ['no details button',!p.includes('Λεπτομέρειες')],
 ['row click',p.includes('onClick={()=>setSelected(x)}')&&p.includes('role="button"')],
 ['create permission',p.includes('[UI_ACTIONS.CREATE]:CAPABILITIES.MANAGE_INDICATORS')],
 ['custom edit delete',p.includes("startsWith('CUSTOM-')")&&p.includes('isCustom&&canManage')],
 ['delete confirm',p.includes("title:'Διαγραφή δείκτη'")&&p.includes('danger:true')],
 ['edit dialog',p.includes('IndicatorEditorDialog')&&p.includes("mode:'edit'")],
 ['lead permission',roles.includes('CAPABILITIES.MANAGE_LIBRARIES,CAPABILITIES.MANAGE_INDICATORS,CAPABILITIES.CREATE_PATIENT')],
 ['no open-source button',!p.includes('Άνοιγμα πηγής')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.28 indicator governance smoke passed: ${tests.length}/${tests.length}`)
