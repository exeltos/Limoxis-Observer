import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const tests=[
 ['netlify origin',h.includes("https://limoxis-observer.netlify.app")],
 ['route based preview',h.includes('netlifyPreviewUrl(selected)')],
 ['preview query flag',h.includes("helpPreview','1'")],
 ['live thumbnail iframe',h.includes('netlify-screen-thumb')&&h.includes('<iframe src={netlifyPreviewUrl(selected)}')],
 ['live zoom iframe',h.includes('netlify-live-large')&&h.includes('Netlify μεγέθυνση')],
 ['static screen map removed',!h.includes('const realScreens=')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.49 focused smoke passed: ${tests.length}/${tests.length}`)
