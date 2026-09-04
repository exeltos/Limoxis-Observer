import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing expected source: ${label}`)
  return source.replace(before, after)
}

const centerPath = 'src/features/workspaces/PlatformCenterPage.jsx'
let center = fs.readFileSync(centerPath, 'utf8')

center = replaceOnce(
  center,
  "  const orgDetailTab = hashParams.get('tab') || 'details'",
  "  const requestedOrgDetailTab = hashParams.get('tab') || 'details'\n  const orgDetailTab = requestedOrgDetailTab === 'analysis' ? 'details' : requestedOrgDetailTab",
  'legacy organization analytics tab compatibility'
)

center = replaceOnce(
  center,
  `\n  function openOrganizationAnalysis() {\n    nav(\`/platform#reports?organization=\${selectedOrg.id}\`, {\n      state: {\n        returnTo: \`/platform#organizations?organization=\${selectedOrg.id}&tab=analysis\`,\n      },\n    })\n  }\n`,
  '\n',
  'organization analysis bridge function'
)

center = replaceOnce(
  center,
  '            onOpenAnalysis={openOrganizationAnalysis}\n',
  '',
  'organization analysis bridge prop'
)

const recordPath = 'src/features/platform/PlatformOrganizationRecord.jsx'
let record = fs.readFileSync(recordPath, 'utf8')

record = replaceOnce(
  record,
  "import { Activity,BarChart3,Building2,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Send,Trash2,Users,X } from 'lucide-react'",
  "import { Activity,Building2,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Send,Trash2,Users,X } from 'lucide-react'",
  'unused analytics icon import'
)

record = replaceOnce(
  record,
  "export function PlatformOrganizationRecord({organization,language='el',initialTab='details',onTabChange,onBack,onEnter,onDelete,onChanged,onOpenAnalysis}){",
  "export function PlatformOrganizationRecord({organization,language='el',initialTab='details',onTabChange,onBack,onEnter,onDelete,onChanged}){",
  'organization record analytics callback prop'
)

record = replaceOnce(
  record,
  "  const tabs=[{id:'details',label:tx('Στοιχεία','Details'),icon:Building2},{id:'users',label:`${tx('Χρήστες','Users')} (${users.length})`,icon:Users},{id:'diagnostics',label:tx('Λειτουργία & συμβάντα','Activity & events'),icon:Activity},{id:'analysis',label:tx('Ανάλυση','Analytics'),icon:BarChart3}]",
  "  const tabs=[{id:'details',label:tx('Στοιχεία','Details'),icon:Building2},{id:'users',label:`${tx('Χρήστες','Users')} (${users.length})`,icon:Users},{id:'diagnostics',label:tx('Λειτουργία & συμβάντα','Activity & events'),icon:Activity}]",
  'duplicate organization analytics tab'
)

record = replaceOnce(
  record,
  `    {initialTab==='analysis'&&<div className="platform-org-analysis-link"><div><strong>{tx('Ανάλυση οργανισμού','Organization analytics')}</strong><span>{tx('Δείκτες, μικροοργανισμοί, trends και report για τον συγκεκριμένο οργανισμό.','Indicators, microorganisms, trends and report for this organization.')}</span></div><Button onClick={onOpenAnalysis}><BarChart3 size={15}/>{tx('Άνοιγμα Analysis / Report','Open Analysis / Report')}</Button></div>}\n`,
  '',
  'duplicate organization analytics placeholder'
)

const cssPath = 'src/styles/platform-owner-polish.css'
let css = fs.readFileSync(cssPath, 'utf8')
const cssBlock = `.platform-org-analysis-link{\n  display:flex;\n  align-items:center;\n  justify-content:space-between;\n  gap:20px;\n  margin:12px 14px 14px;\n  padding:14px 15px;\n  border:1px solid var(--lo-color-border);\n  border-radius:var(--lo-radius-card);\n  background:var(--lo-color-surface);\n}\n.platform-org-analysis-link>div{display:grid;gap:4px}\n.platform-org-analysis-link strong{font-size:12px}\n.platform-org-analysis-link span{font-size:10.5px;color:var(--lo-color-muted);line-height:1.45}\n\n`
css = replaceOnce(css, cssBlock, '', 'obsolete organization analytics placeholder CSS')

const testPath = 'tests/platformOwnerCanonicalAnalytics.test.js'
fs.writeFileSync(testPath, `import { describe, expect, it } from 'vitest'\nimport fs from 'node:fs'\n\nconst center = fs.readFileSync('src/features/workspaces/PlatformCenterPage.jsx', 'utf8')\nconst record = fs.readFileSync('src/features/platform/PlatformOrganizationRecord.jsx', 'utf8')\nconst css = fs.readFileSync('src/styles/platform-owner-polish.css', 'utf8')\n\ndescribe('Platform Owner canonical analytics architecture', () => {\n  it('uses the shared AnalysisPage as the only Platform reports workspace', () => {\n    expect(center).toContain('<AnalysisPage platform organizations={organizations} />')\n    expect(center).not.toContain('openOrganizationAnalysis')\n    expect(center).not.toContain('onOpenAnalysis=')\n  })\n\n  it('does not keep a duplicate Analytics tab inside the organization record', () => {\n    expect(record).not.toContain("id:'analysis'")\n    expect(record).not.toContain("initialTab==='analysis'")\n    expect(record).not.toContain('platform-org-analysis-link')\n    expect(record).not.toContain('onOpenAnalysis')\n  })\n\n  it('removes obsolete styling for the deleted analytics placeholder', () => {\n    expect(css).not.toContain('.platform-org-analysis-link')\n  })\n\n  it('keeps legacy analysis-tab hashes from rendering an empty record tab', () => {\n    expect(center).toContain("requestedOrgDetailTab === 'analysis' ? 'details' : requestedOrgDetailTab")\n  })\n})\n`)

fs.writeFileSync(centerPath, center)
fs.writeFileSync(recordPath, record)
fs.writeFileSync(cssPath, css)

console.log('Platform Owner Phase 1 refactor applied.')
