import fs from 'node:fs'
const a=fs.readFileSync('src/app/AppShell.jsx','utf8')
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['logout confirmation',a.includes("t('logoutConfirmTitle')")&&a.includes("t('logoutFarewell')")&&a.includes('await confirm')],
 ['feedback hook',a.includes('useFeedback')],
 ['uniform 38px height',c.includes('.topbar-utility-card,')&&c.includes('height:38px!important')],
 ['floating preview markup',h.includes('manual-image-lightbox-floating')&&h.includes('manual-preview-floating-card')],
 ['blurred backdrop',c.includes('backdrop-filter:blur(7px)!important')],
 ['opening animation',c.includes('@keyframes helpPreviewCardIn')&&c.includes('scale(.965)')],
 ['close top right',c.includes('.manual-preview-floating-card .manual-lightbox-close')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.57 focused smoke passed: ${tests.length}/${tests.length}`)
