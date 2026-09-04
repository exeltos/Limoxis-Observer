import fs from 'node:fs'

// One-off, idempotent refactor runner for the Platform Owner control-plane split.
const centerPath='src/features/workspaces/PlatformCenterPage.jsx'
const orgPath='src/features/platform/PlatformOrganizationRecord.jsx'
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

let org=fs.readFileSync(orgPath,'utf8')

if(!org.includes("import { FilterBar } from '../../design-system/FilterBar'")){
  org=org.replace(
    "import { IconButton } from '../../design-system/IconButton'",
    "import { IconButton } from '../../design-system/IconButton'\nimport { FilterBar } from '../../design-system/FilterBar'"
  )
}

if(!org.includes("const [userQuery,setUserQuery]=useState('')")){
  org=org.replace(
    "const [userDraft,setUserDraft]=useState({fullName:'',email:'',phone:'',jobTitle:'',role:''})",
    "const [userDraft,setUserDraft]=useState({fullName:'',email:'',phone:'',jobTitle:'',role:''})\n  const [userQuery,setUserQuery]=useState('')"
  )
}

org=org.replace(
  /\n  async function saveUserRole\(user\)\{[\s\S]*?\}\n\n  async function linkUserEmployee/,
  '\n  async function linkUserEmployee'
)

if(!org.includes('const filteredUsers=useMemo')){
  org=org.replace(
    "const employeeOptions=useMemo(()=>selectedUser?employees.filter(employee=>!employee.userId||employee.userId===selectedUser.userId):[],[employees,selectedUser])",
    "const employeeOptions=useMemo(()=>selectedUser?employees.filter(employee=>!employee.userId||employee.userId===selectedUser.userId):[],[employees,selectedUser])\n  const filteredUsers=useMemo(()=>{const locale=language==='el'?'el-GR':'en-US',query=userQuery.trim().toLocaleLowerCase(locale);if(!query)return users;return users.filter(user=>[user.name,user.email,user.username,roleLabel(user.role,language)].some(value=>String(value||'').toLocaleLowerCase(locale).includes(query)))},[users,userQuery,language])"
  )
}

org=org.replace(
  "const tabs=[{id:'details',label:tx('Στοιχεία','Details'),icon:Building2},{id:'users',label:`${tx('Χρήστες','Users')} (${users.length})`,icon:Users},{id:'diagnostics',label:tx('Λειτουργία & συμβάντα','Activity & events'),icon:Activity}]",
  "const tabs=[{id:'details',label:tx('Στοιχεία & Ρυθμίσεις','Details & Settings'),icon:Building2},{id:'users',label:`${tx('Χρήστες & Ρόλοι','Users & Roles')} (${users.length})`,icon:Users},{id:'diagnostics',label:tx('Λειτουργία & Συμβάντα','Activity & Events'),icon:Activity}]"
)

if(!org.includes('platform-organization-summary-strip')){
  org=org.replace(
    "{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><div className={`platform-record-edit-fieldset ${editing?'is-editing':'is-locked'}`}>",
    "{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><div className=\"platform-organization-summary-strip\"><div><span>{tx('Τύπος','Type')}</span><strong>{record.type||'hospital'}</strong></div><div><span>{tx('Χρήστες','Users')}</span><strong>{users.length}</strong></div><div><span>Hospital Admin</span><strong>{admins.length||0}</strong></div><div><span>{tx('Κλίνες','Beds')}</span><strong>{record.bed_capacity??'—'}</strong></div></div><div className={`platform-record-edit-fieldset ${editing?'is-editing':'is-locked'}`}>"
  )
}

if(!org.includes("placeholder={tx('Αναζήτηση χρήστη")){
  org=org.replace(
    "<div className=\"platform-user-role-help\"><strong>{tx('Ρόλοι χρηστών','User roles')}</strong><span>{tx('Επίλεξε έναν χρήστη για να ανοίξεις την πλήρη καρτέλα διαχείρισης.','Select a user to open the full management record.')}</span></div>",
    "<div className=\"platform-user-role-help\"><strong>{tx('Χρήστες & Ρόλοι','Users & Roles')}</strong><span>{tx('Επίλεξε έναν χρήστη για πλήρη διαχείριση λογαριασμού, ρόλου και σύνδεσης με εργαζόμενο.','Select a user to manage the account, role and employee link.')}</span></div><FilterBar query={userQuery} onQueryChange={setUserQuery} placeholder={tx('Αναζήτηση χρήστη, email ή ρόλου…','Search user, email or role…')} />"
  )
}

org=org.replace(":users.length?<div className=\"scroll-table\">",":filteredUsers.length?<div className=\"scroll-table\">")
org=org.replace("<tbody>{users.map(user=>", "<tbody>{filteredUsers.map(user=>")
org=org.replace(
  "<div className=\"inline-empty\">{tx('Δεν υπάρχουν χρήστες. Δημιούργησε Hospital Admin από την καρτέλα Στοιχεία.','No users. Create a Hospital Admin from the Details tab.')}</div>",
  "<div className=\"inline-empty\">{users.length?tx('Δεν βρέθηκαν χρήστες για την αναζήτηση.','No users match the search.'):tx('Δεν υπάρχουν χρήστες. Δημιούργησε Hospital Admin από την καρτέλα Στοιχεία & Ρυθμίσεις.','No users. Create a Hospital Admin from Details & Settings.')}</div>"
)

fs.writeFileSync(orgPath,org)

let css=fs.readFileSync(cssPath,'utf8')
if(!css.includes('.platform-control-grid{')){
  css += `\n/* Platform Owner control-plane primitives */\n.platform-control-plane{display:grid;gap:14px}\n.platform-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}\n.platform-control-card{appearance:none;border:1px solid var(--lo-color-border);background:var(--lo-color-surface);border-radius:var(--lo-radius-card);padding:14px;text-align:left;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;min-height:88px;color:inherit}\n.platform-control-card-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--lo-color-surface-subtle);color:var(--lo-color-primary)}\n.platform-control-card-copy{display:grid;gap:4px;min-width:0}\n.platform-control-card-copy strong{font-size:13px}\n.platform-control-card-copy small{font-size:11px;line-height:1.45;color:var(--lo-color-muted)}\n.platform-control-card-meta{font-size:11px;font-weight:700;color:var(--lo-color-primary);white-space:nowrap}\n@media (max-width:1180px){.platform-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media (max-width:720px){.platform-control-grid{grid-template-columns:1fr}.platform-control-card{grid-template-columns:auto minmax(0,1fr)}}\n`
}
if(!css.includes('.platform-organization-summary-strip{')){
  css += `\n.platform-organization-summary-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}\n.platform-organization-summary-strip>div{border:1px solid var(--lo-color-border);background:var(--lo-color-surface);border-radius:var(--lo-radius-card);padding:11px 12px;display:grid;gap:4px}\n.platform-organization-summary-strip span{font-size:11px;color:var(--lo-color-muted)}\n.platform-organization-summary-strip strong{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n@media (max-width:900px){.platform-organization-summary-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}\n`
}
fs.writeFileSync(cssPath,css)

console.log('Platform Owner control-plane and organization workspace refactor applied.')
