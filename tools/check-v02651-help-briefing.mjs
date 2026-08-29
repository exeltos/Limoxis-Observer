import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const n=fs.readFileSync('src/core/notifications/NotificationCenter.jsx','utf8')
const c=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['context section resolver',h.includes('currentSection=visible.find')&&h.includes('setSelected(currentSection)')],
 ['help resets to manual',h.includes("setMode('manual')")&&h.includes('setImageOpen(false)')],
 ['desktop sidebar stop',c.includes('inset:auto 0 0 244px!important')],
 ['slide animation',c.includes('@keyframes helpSlideIn')],
 ['larger manual typography',c.includes('.manual-copy>p{font-size:11.5px!important')],
 ['briefing top close',n.includes('briefing-close-v2')&&n.includes('aria-label="Κλείσιμο ενημέρωσης"')],
 ['briefing new structure',n.includes('briefing-summary-v2')&&n.includes('briefing-sections-v2')],
 ['redundant briefing footer actions removed',!n.includes('>Dashboard</button>')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.51 focused smoke passed: ${tests.length}/${tests.length}`)
