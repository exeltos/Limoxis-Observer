import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['direct panel markup',h.includes('<aside className="help-panel-shell"')],
 ['legacy backdrop removed from HelpCenter',!h.includes('help-center-backdrop')],
 ['fixed desktop bounds',c.includes('.help-panel-shell{')&&c.includes('left:244px!important')],
 ['independent z index',c.includes('z-index:1200!important')],
 ['slide animation',c.includes('@keyframes helpPanelEnter')],
 ['manual content preserved',h.includes('manual-sidebar')&&h.includes('netlifyPreviewUrl(selected,role)')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.53 focused smoke passed: ${tests.length}/${tests.length}`)
