import fs from 'node:fs'
const help=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const lang=fs.readFileSync('src/core/i18n/LanguageContext.jsx','utf8')
const tests=[
 ['preview accepts language',help.includes('netlifyPreviewUrl=(path,role,language)')],
 ['preview sends helpLang',help.includes("url.searchParams.set('helpLang',language)")],
 ['preview calls include active language',help.includes('netlifyPreviewUrl(selected,role,language)')],
 ['provider reads helpLang',lang.includes("get('helpLang')")],
 ['provider initializes English preview',lang.includes("previewLanguage === 'en' ? 'en' : 'el'")]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.61 Help preview language smoke passed: ${tests.length}/${tests.length}`)
