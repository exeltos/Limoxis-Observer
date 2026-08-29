import fs from 'node:fs'
const help=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const notif=fs.readFileSync('src/core/notifications/NotificationCenter.jsx','utf8')
const ctx=fs.readFileSync('src/core/notifications/NotificationContext.jsx','utf8')
const dash=fs.readFileSync('src/features/dashboard/DashboardPage.jsx','utf8')
const work=fs.readFileSync('src/features/workspaces/workspaceConfig.js','utf8')
const about=fs.readFileSync('src/features/about/AboutPage.jsx','utf8')
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8')
const net=fs.readFileSync('netlify.toml','utf8')
const tests=[
 ['English help manual selected',help.includes("language==='en'?helpManualEn:helpManual")],
 ['Help analytics',help.includes('manual-check-section')&&help.includes('manual-good-practice')&&help.includes('manual-chapter-footer')],
 ['Help keyboard shortcuts',help.includes("event.key.toLowerCase()==='k'")&&help.includes("event.key==='Escape'")],
 ['Notifications bilingual',notif.includes('notificationText')&&notif.includes("language==='en'?'en':'el'")],
 ['Operational notifications bilingual',ctx.includes('operationalText')&&ctx.includes('demoAnnouncementText')],
 ['Dashboard bilingual',dash.includes("workspaceFor(role,language)")&&dash.includes("english?'Needs action'")],
 ['Role workspaces bilingual',work.includes('configsEn')&&work.includes("language==='en'")],
 ['About bilingual',about.includes("features[en?'en':'el']")],
 ['Canonical CI gate',ci.includes('run: npm run check')],
 ['Pinned CI Node',ci.includes('node-version: 22.22.2')],
 ['Pinned Netlify Node',net.includes('NODE_VERSION = "22.22.2"')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.60 focused smoke passed: ${tests.length}/${tests.length}`)
