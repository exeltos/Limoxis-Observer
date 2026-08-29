import fs from 'node:fs'
const read=p=>fs.readFileSync(p,'utf8')
const tests=[
 ['provider',read('src/main.jsx').includes('<NotificationProvider><App /></NotificationProvider>')],
 ['bell center',read('src/app/AppShell.jsx').includes('<NotificationCenter')&&read('src/app/AppShell.jsx').includes('notification-count')],
 ['login briefing',read('src/app/AppShell.jsx').includes('<LoginBriefing/>')],
 ['role operational',read('src/core/notifications/NotificationContext.jsx').includes('infection_control_lead')&&read('src/core/notifications/NotificationContext.jsx').includes('laboratory')],
 ['birthday',read('src/core/notifications/NotificationContext.jsx').includes('birthDate')&&read('src/features/dashboard/DashboardPage.jsx').includes('Χρόνια πολλά')],
 ['announcement targeting',read('src/features/management/AnnouncementsPanel.jsx').includes("audienceType:'all'")&&read('src/features/management/AnnouncementsPanel.jsx').includes('department')&&read('src/features/management/AnnouncementsPanel.jsx').includes('user')],
 ['announcement permission',read('src/core/permissions/roles.js').includes('MANAGE_ANNOUNCEMENTS')],
 ['info route',read('src/app/App.jsx').includes('AboutPage')&&read('src/features/about/AboutPage.jsx').includes('PRODUCT TOUR')],
 ['undo foundation',read('src/core/feedback/FeedbackContext.jsx').includes('notifyUndo')&&read('src/features/management/AnnouncementsPanel.jsx').includes("notifyUndo('Η ανακοίνωση διαγράφηκε.'")]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.37 focused smoke passed: ${tests.length}/${tests.length}`)
