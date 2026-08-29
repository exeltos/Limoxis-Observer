import fs from 'node:fs'
const r=p=>fs.readFileSync(p,'utf8')
const shell=r('src/app/AppShell.jsx'),ctx=r('src/core/notifications/NotificationContext.jsx'),ui=r('src/core/notifications/NotificationCenter.jsx'),ann=r('src/features/management/AnnouncementsPanel.jsx'),dash=r('src/features/dashboard/DashboardPage.jsx')
const tests=[
 ['separate birthday popup',ui.includes('BirthdayGreeting')&&ui.includes('birthday-popup')],
 ['birthday before briefing',shell.includes('closeBirthday')&&shell.includes("setBriefingOpen(true)")],
 ['reopen controls',ui.includes('Σημερινή ενημέρωση')&&ui.includes('Σημερινή ευχή')],
 ['unread-only bell',ctx.includes('unreadItems')&&ui.includes('n.unreadItems.map')],
 ['owner test center',shell.includes('canUseTestCenter')&&shell.includes('Δοκιμές ιδιοκτήτη')],
 ['no birthday in dashboard',!dash.includes('dashboard-birthday')],
 ['multi recipient',ann.includes('audienceValues')&&ann.includes('toggleRecipient')],
 ['schedule dates times',ann.includes('startDate')&&ann.includes('startTime')&&ann.includes('endDate')&&ann.includes('endTime')],
 ['active schedule filter',ctx.includes('withinWindow(a,clock)')],
 ['info sidebar access',shell.includes('Πληροφορίες Limoxis')&&shell.includes("navigate('/about')")],
 ['netlify spa redirect',r('public/_redirects').includes('/index.html')&&r('netlify.toml').includes('from = "/*"')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.38 focused smoke passed: ${tests.length}/${tests.length}`)
