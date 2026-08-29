import fs from 'node:fs'
const h=fs.readFileSync('src/core/help/HelpCenter.jsx','utf8'),m=fs.readFileSync('src/core/help/helpManual.js','utf8'),c=fs.readFileSync('src/styles/global.css','utf8')
const t=[
['role filtered contents',h.includes('navigationFor')&&h.includes('visible=nav.map')],
['context open',h.includes('setSelected(pathname)')&&h.includes('ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ')],
['manual search',h.includes('Αναζήτηση στο εγχειρίδιο')],
['detailed chapters',m.includes("'/surveillance'")&&m.includes('Κλινική αξιολόγηση')&&m.includes('Επανεκτίμηση & outcome')],
['18 manual areas',(m.match(/audience:/g)||[]).length>=18],
['visual preview',h.includes('ManualPreview')&&h.includes('ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΟΘΟΝΗΣ')],
['image explanations',h.includes('Τι βλέπετε στην εικόνα')&&h.includes('mp-callout')],
['role note',h.includes('Προσαρμοσμένο στον λογαριασμό σας')],
['glossary and about',h.includes("mode==='glossary'")&&h.includes("mode==='about'")],
['manual workspace css',c.includes('.manual-center')&&c.includes('.manual-preview-pane')]
]
for(const [n,ok] of t){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}console.log(`v0.26.44 focused smoke passed: ${t.length}/${t.length}`)
