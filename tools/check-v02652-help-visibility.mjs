import fs from 'node:fs'
const c=fs.readFileSync('src/styles/global.css','utf8')
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const tests=[
 ['fixed full height backdrop',c.includes('inset:0 0 0 244px!important')&&c.includes('min-height:100vh!important')],
 ['manual center pinned',c.includes('.help-center-backdrop .manual-center')&&c.includes('inset:0!important')],
 ['desktop sidebar retained',c.includes('244px!important')],
 ['mobile full viewport retained',c.includes('@media(max-width:1100px)')&&c.includes('inset:0!important')],
 ['help still renders',h.includes('help-center-backdrop')&&h.includes('manual-center')]
]
for(const [name,ok] of tests){
 if(!ok){console.error('FAIL',name);process.exit(1)}
 console.log('✓',name)
}
console.log(`v0.26.52 focused smoke passed: ${tests.length}/${tests.length}`)
