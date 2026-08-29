import fs from 'node:fs'
const a=fs.readFileSync('src/core/auth/AuthContext.jsx','utf8')
const t=fs.readFileSync('src/core/tenant/TenantContext.jsx','utf8')
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const s=fs.readFileSync('src/app/AppShell.jsx','utf8')
const tests=[
 ['iframe-only preview auth',a.includes("helpPreviewMode")&&a.includes("window.self!==window.top")&&a.includes("access_token:'help-preview'")],
 ['preview skips Supabase auth',a.includes('if (helpPreviewMode) return undefined')],
 ['role sent to iframe',h.includes("helpRole")&&h.includes('netlifyPreviewUrl(selected,role)')],
 ['preview role initialized',t.includes("params.get('helpRole')")&&t.includes("params.get('helpPreview')==='1'")],
 ['briefing suppressed',s.includes('helpPreviewMode||!profile')],
 ['nested help suppressed',s.includes('!helpPreviewMode&&<HelpCenter')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.50 focused smoke passed: ${tests.length}/${tests.length}`)
