import fs from 'node:fs'
const app=fs.readFileSync('src/app/AppShell.jsx','utf8')
const i18n=fs.readFileSync('src/core/i18n/LanguageContext.jsx','utf8')
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8')
const tests=[
 ['translated logout confirm',app.includes("t('logoutConfirmTitle')")&&app.includes("t('logoutConfirmMessage')")&&app.includes("t('logoutFarewell')")],
 ['no hard-coded Greek logout',!app.includes("title:'Αποσύνδεση'")&&!app.includes('Καλή συνέχεια!')],
 ['EL keys',i18n.includes("logoutConfirmTitle:'Αποσύνδεση'")&&i18n.includes("logoutFarewell:'Καλή συνέχεια!'")],
 ['EN keys',i18n.includes("logoutConfirmTitle:'Sign out'")&&i18n.includes("logoutFarewell:'Have a good day!'")],
 ['GitHub actions v5',ci.includes('actions/checkout@v5')&&ci.includes('actions/setup-node@v5')],
 ['Node22 app runtime',ci.includes('node-version: 22')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.58 focused smoke passed: ${tests.length}/${tests.length}`)
