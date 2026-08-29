import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['frameless markup',h.includes('manual-image-lightbox-frameless')&&h.includes('manual-live-fullscreen')],
 ['single close control',h.includes('manual-lightbox-close')&&h.includes('Κλείσιμο μεγέθυνσης')],
 ['old zoom card markup gone',!h.includes('manual-live-large netlify-live-large')],
 ['no frame styling',c.includes('.manual-image-lightbox-frameless')&&c.includes('padding:0!important')&&c.includes('background:#fff!important')],
 ['full preview fitted',c.includes('.manual-live-fullscreen iframe')&&c.includes('width:1440px!important')&&c.includes('height:900px!important')],
 ['read only retained',c.includes('pointer-events:none!important')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.55 focused smoke passed: ${tests.length}/${tests.length}`)
