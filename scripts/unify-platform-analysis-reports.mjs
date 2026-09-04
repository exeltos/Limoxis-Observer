import fs from 'node:fs'

const pagePath='src/features/workspaces/PlatformCenterPage.jsx'
let page=fs.readFileSync(pagePath,'utf8')
const oldChange=`  function changeOrgTab(tab) {\n    nav(\`/platform#organizations?organization=\${selectedOrg.id}&tab=\${tab}\`, {\n      replace: true,\n      state: location.state,\n    })\n  }`
const newChange=`  function changeOrgTab(tab) {\n    if (tab === 'analysis') {\n      openOrganizationAnalysis()\n      return\n    }\n    nav(\`/platform#organizations?organization=\${selectedOrg.id}&tab=\${tab}\`, {\n      replace: true,\n      state: location.state,\n    })\n  }`
if(!page.includes(oldChange)) throw new Error('changeOrgTab anchor not found')
page=page.replace(oldChange,newChange)
fs.writeFileSync(pagePath,page)

const recordPath='src/features/platform/PlatformOrganizationRecord.jsx'
let record=fs.readFileSync(recordPath,'utf8')
const oldPlaceholder=`    {initialTab==='analysis'&&<div className="platform-org-analysis-link"><div><strong>{tx('Ανάλυση οργανισμού','Organization analytics')}</strong><span>{tx('Άνοιξε την ενιαία οθόνη Analysis για δείκτες, τάσεις και report του συγκεκριμένου οργανισμού.','Open the unified Analysis workspace for indicators, trends and report for this organization.')}</span></div><Button onClick={onOpenAnalysis}><BarChart3 size={15}/>{tx('Άνοιγμα Analysis / Report','Open Analysis / Report')}</Button></div>}\n`
if(record.includes(oldPlaceholder)) record=record.replace(oldPlaceholder,'')
fs.writeFileSync(recordPath,record)

const testPath='tests/platformAnalysisReportsRouting.test.js'
fs.writeFileSync(testPath,`import { describe,it,expect } from 'vitest'\nimport fs from 'node:fs'\n\nconst center=fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx','utf8')\nconst record=fs.readFileSync('src/features/platform/PlatformOrganizationRecord.jsx','utf8')\n\ndescribe('Platform Analysis and Reports routing',()=>{\n it('routes the organization Analysis tab directly to platform reports',()=>{\n  expect(center).toContain("if (tab === 'analysis')")\n  expect(center).toContain('openOrganizationAnalysis()')\n  expect(center).toContain('/platform#reports?organization=')\n })\n it('does not render a second intermediary analysis screen inside the organization record',()=>{\n  expect(record).not.toContain('platform-org-analysis-link')\n  expect(record).not.toContain('Άνοιγμα Analysis / Report')\n })\n it('renders platform reports with the canonical AnalysisPage workspace',()=>{\n  expect(center).toContain('<AnalysisPage platform organizations={organizations} />')\n })\n})\n`)
