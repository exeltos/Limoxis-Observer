import fs from 'node:fs'
const a=fs.readFileSync('src/features/management/AnnouncementsPanel.jsx','utf8')
const n=fs.readFileSync('src/core/notifications/NotificationContext.jsx','utf8')
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const s=fs.readFileSync('src/app/AppShell.jsx','utf8')
const t=[
 ['schedule destructure removed',!a.includes('const {startDate,startTime,endDate,endTime,...rest}=editor')],
 ['notification empty catches removed',!n.includes('catch{}')],
 ['help unused map index removed',!h.includes('filtered.map((x,i)')],
 ['appshell empty catches removed',!s.includes('catch{}')]
]
for(const [name,ok] of t){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log('v0.26.48 focused smoke passed: 4/4')
