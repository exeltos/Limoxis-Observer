import fs from 'node:fs'
const path='src/features/workspaces/PlatformCenterPage.jsx'
let s=fs.readFileSync(path,'utf8')
for(const line of [
"  Activity,\n","  BarChart3,\n","  Users,\n",
"import { EntityRecordShell } from '../../design-system/EntityRecordShell'\n",
"import { roleLabel } from '../../core/permissions/roleLabels'\n",
"import { HospitalDiagnosticsPanel } from '../platform/HospitalDiagnosticsPanel'\n",
"import { PlatformOrganizationActions } from './PlatformOrganizationActions'\n",
"import { PlatformUserDialog } from './PlatformUserDialog'\n",
"  listOrganizationMembersDetailed,\n","  manageOrganizationUser,\n","  setPlatformOrganizationStatus,\n","  updatePlatformOrganization,\n",
"  const [editOrg, setEditOrg] = useState(null)\n",
"  const [inviteSending, setInviteSending] = useState(false)\n",
"  const [editAdmin, setEditAdmin] = useState(null)\n",
"  const [orgUsers, setOrgUsers] = useState([])\n",
"  const [orgUsersLoading, setOrgUsersLoading] = useState(false)\n",
"  const [selectedUser, setSelectedUser] = useState(null)\n",
]) s=s.replace(line,'')
s=s.replace(/function InfoSection\([\s\S]*?\n}\n\nfunction InfoRow\([\s\S]*?\n}\n\nexport function PlatformCenterPage\(\) \{/m,'export function PlatformCenterPage() {')
s=s.replace(/\n  async function loadOrgUsers\([\s\S]*?\n  }\n\n  useEffect\(\(\) => \{/m,'\n  useEffect(() => {')
s=s.replace(/\n  useEffect\(\(\) => \{\n    if \(!selectedOrgId\)[\s\S]*?\n  }, \[selectedOrgId, notifyError\]\)\n/m,'\n')
s=s.replace('    setSelectedUser(null)\n','')
s=s.replace(/\n  async function togglePause\(org\) \{[\s\S]*?\n  }\n\n  function requestRemoveOrganization/m,'\n  function requestRemoveOrganization')
s=s.replace(/\n  async function beginEditOrg\(org\) \{[\s\S]*?\n  async function userAction/m,'\n  async function userAction')
s=s.replace(/\n  async function userAction\([\s\S]*?\n  async function createDemo/m,'\n  async function createDemo')
s=s.replace(/\n  const editDialog = editOrg \? \([\s\S]*?\n  const deleteDialog =/m,'\n  const deleteDialog =')
fs.writeFileSync(path,s)
