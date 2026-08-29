import fs from 'node:fs'
const m=fs.readFileSync('src/features/management/ManagementPage.jsx','utf8')
const l=fs.readFileSync('src/features/management/LibrariesPanel.jsx','utf8')
const e=fs.readFileSync('src/features/management/EnvironmentalStandardsPanel.jsx','utf8')
const b=fs.readFileSync('src/features/management/BundleLibraryPanel.jsx','utf8')
const tests=[
 ['bundles top tab',m.includes("id:'bundles'")&&m.includes('<BundleLibraryPanel/>')],
 ['no environment top tab',!m.includes("id:'environmentalProtocols'")],
 ['environment in libraries',l.includes("['environmentalProtocols','environmentalProtocols']")&&l.includes('<EnvironmentalStandardsPanel embedded/>')],
 ['bundles removed from libraries',!l.includes("['bundles'")&&!l.includes('BundleLibraryPanel')],
 ['overview summary cards',m.includes('management-overview-cards')&&m.includes('publishedBundles')],
 ['organization real settings',m.includes('OrganizationPanel')&&m.includes('Τύπος μονάδας')&&m.includes('Ζώνη ώρας')&&m.includes('Κεφαλίδα αναφορών')],
 ['no mode in organization',!m.includes("t('modeLabel')")],
 ['environment shared confirm',e.includes('const {notify,confirm}=useFeedback()')&&e.includes('danger:true')],
 ['bundle feedback fixed',b.includes('function BundleEditor')&&b.includes('const {notify,confirm}=useFeedback()')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.33 management IA smoke passed: ${tests.length}/${tests.length}`)
