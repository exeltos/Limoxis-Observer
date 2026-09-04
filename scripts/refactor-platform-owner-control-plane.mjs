import fs from 'node:fs'

// One-off, idempotent refactor runner for the Platform Owner control-plane split.
const centerPath='src/features/workspaces/PlatformCenterPage.jsx'
const cssPath='src/styles/platform-owner-polish.css'

let center=fs.readFileSync(centerPath,'utf8')

center=center.replace(
  "import {\n  Building2,\n  Clock3,\n  FlaskConical,\n  LogIn,\n  ShieldCheck,\n  Trash2,\n} from 'lucide-react'",
  "import {\n  FlaskConical,\n  LogIn,\n  ShieldCheck,\n  Trash2,\n} from 'lucide-react'"
)

if(!center.includes("import { PlatformDashboardView } from '../platform/PlatformDashboardView'")){
  center=center.replace(
    "import { PlatformOrganizationRecord } from '../platform/PlatformOrganizationRecord'",
    "import { PlatformOrganizationRecord } from '../platform/PlatformOrganizationRecord'\nimport { PlatformDashboardView } from '../platform/PlatformDashboardView'\nimport { PlatformOrganizationsRegistry } from '../platform/PlatformOrganizationsRegistry'"
  )
}

center=center.replace(
  /  if \(!activeKey\) \{[\s\S]*?\n  \}\n\n  if \(activeKey === 'organizations'\) \{/,
  `  if (!activeKey) {\n    return (\n      <PlatformDashboardView\n        tx={tx}\n        organizations={organizations}\n        activeOrganizations={activeOrganizations}\n        members={members}\n        activeDemos={activeDemos}\n        expiringDemos={expiringDemos}\n        loadingStats={loadingStats}\n        demoProgress={demoProgress}\n        onOpenDemo={openDemoRecord}\n        onNavigate={nav}\n      />\n    )\n  }\n\n  if (activeKey === 'organizations') {`
)

const orgRegistryPattern=/    return \(\n      <>\n        <Page\n          title=\{tx\('Οργανισμοί', 'Organizations'\)\}[\s\S]*?\n        \{createDialog\}\n      <\/>\n    \)\n  \}\n\n  if \(activeKey === 'demo'\) \{/

if(orgRegistryPattern.test(center)){
  center=center.replace(orgRegistryPattern,`    return (\n      <>\n        <PlatformOrganizationsRegistry\n          tx={tx}\n          query={organizationQuery}\n          onQueryChange={setOrganizationQuery}\n          organizations={filteredOrganizations}\n          memberCountByOrg={memberCountByOrg}\n          hospitalAdminStatusByOrg={hospitalAdminStatusByOrg}\n          onBack={() => nav('/platform')}\n          onCreate={openCreate}\n          onOpenOrganization={openOrganization}\n        />\n        {createDialog}\n      </>\n    )\n  }\n\n  if (activeKey === 'demo') {`)
}

fs.writeFileSync(centerPath,center)

let css=fs.readFileSync(cssPath,'utf8')
if(!css.includes('.platform-control-grid{')){
  css += `\n/* Platform Owner control-plane primitives */\n.platform-control-plane{display:grid;gap:14px}\n.platform-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}\n.platform-control-card{appearance:none;border:1px solid var(--lo-color-border);background:var(--lo-color-surface);border-radius:var(--lo-radius-card);padding:14px;text-align:left;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;min-height:88px;color:inherit}\n.platform-control-card-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--lo-color-surface-subtle);color:var(--lo-color-primary)}\n.platform-control-card-copy{display:grid;gap:4px;min-width:0}\n.platform-control-card-copy strong{font-size:13px}\n.platform-control-card-copy small{font-size:11px;line-height:1.45;color:var(--lo-color-muted)}\n.platform-control-card-meta{font-size:11px;font-weight:700;color:var(--lo-color-primary);white-space:nowrap}\n@media (max-width:1180px){.platform-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media (max-width:720px){.platform-control-grid{grid-template-columns:1fr}.platform-control-card{grid-template-columns:auto minmax(0,1fr)}}\n`
}
fs.writeFileSync(cssPath,css)

console.log('Platform Owner control-plane refactor applied.')
