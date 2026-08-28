import fs from 'node:fs'
const p=fs.readFileSync('src/features/lira/LiraPage.jsx','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')
const tests=[
 ['scrolling answer area',p.includes('className="lira-chat-scroll"')&&p.includes('className="lira-conversation"')],
 ['bottom composer order',p.indexOf('className="lira-chat-scroll"')<p.indexOf('className="lira-chat-composer-wrap"')],
 ['textarea composer',p.includes('<textarea')&&p.includes('Shift+Enter')],
 ['welcome state',p.includes('lira-chat-welcome')&&p.includes('Τι θέλετε να μάθετε')],
 ['answer provenance',p.includes('lira-ai-source-note')],
 ['internal flex layout',css.includes('.lira-chat-main{min-height:0;flex:1;display:flex;flex-direction:column')&&css.includes('.lira-chat-scroll{min-height:0;flex:1;overflow:auto')],
 ['two tabs preserved',p.includes('Ρώτησε τη LIRA')&&p.includes('LIRA Briefing')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)} console.log('✓',n)}
console.log(`v0.26.23 LIRA chat layout smoke passed: ${tests.length}/${tests.length}`)
