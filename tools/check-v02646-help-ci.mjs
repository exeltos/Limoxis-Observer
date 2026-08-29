import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8')
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8')
const shots=['surveillance','prevention','quality','controls','committees','lira']
const tests=[
 ['real screenshot map',shots.every(x=>h.includes(`/help/screens/${x}.png`))],
 ['no schematic renderer',!h.includes('function ManualPreview')],
 ['lightbox image',h.includes('manual-image-lightbox')&&h.includes('<img src={realScreens[current.preview]}')],
 ['live fallback',h.includes('<iframe src={selected}')],
 ['ci main triggers',ci.includes('branches: [main]')&&ci.includes('workflow_dispatch')],
 ['ci node22 npmci',ci.includes('node-version: 22')&&ci.includes('npm ci')],
 ['ci quality gates',ci.includes('npm run lint')&&ci.includes('npm run test')&&ci.includes('npm run build')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.46 focused smoke passed: ${tests.length}/${tests.length}`)
