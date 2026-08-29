import fs from 'node:fs'
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['fixed preview viewport',c.includes('width:1440px!important')&&c.includes('height:900px!important')],
 ['scaled whole viewport',c.includes('transform:scale(var(--help-zoom-scale,.86))')],
 ['centered preview',c.includes('transform-origin:center center!important')],
 ['responsive scaling',c.includes('@media(max-width:1300px)')&&c.includes('@media(max-height:720px)')],
 ['read only retained',c.includes('pointer-events:none!important')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.54 focused smoke passed: ${tests.length}/${tests.length}`)
