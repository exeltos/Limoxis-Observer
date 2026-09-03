import fs from 'node:fs'

const recordPath='src/features/platform/PlatformOrganizationRecord.jsx'
let s=fs.readFileSync(recordPath,'utf8')
if(!s.includes("import { loadEmployeesAsync } from '../employees/employeeService'")){
  s=s.replace("import { HospitalDiagnosticsPanel } from './HospitalDiagnosticsPanel'", "import { HospitalDiagnosticsPanel } from './HospitalDiagnosticsPanel'\nimport { loadEmployeesAsync } from '../employees/employeeService'")
}
s=s.replace("  const [users,setUsers]=useState([])\n", "  const [users,setUsers]=useState([])\n  const [employees,setEmployees]=useState([])\n")
s=s.replace("  const [roleDrafts,setRoleDrafts]=useState({})\n", "  const [roleDrafts,setRoleDrafts]=useState({})\n  const [employeeLinkDrafts,setEmployeeLinkDrafts]=useState({})\n")
const loadOld="  async function loadUsers(){setLoadingUsers(true);try{const rows=await listOrganizationMembersDetailed(organization.id);setUsers(rows);setRoleDrafts(Object.fromEntries(rows.map(user=>[user.userId,user.role])));setSelectedUserId(current=>current&&rows.some(user=>user.userId===current)?current:'')}catch(error){notifyError(error,'load',{operation:'platform_organization_users_load'})}finally{setLoadingUsers(false)}}"
const loadNew="  async function loadUsers(){setLoadingUsers(true);try{const [rows,employeeRows]=await Promise.all([listOrganizationMembersDetailed(organization.id),loadEmployeesAsync(organization.id)]);setUsers(rows);setEmployees(employeeRows);setRoleDrafts(Object.fromEntries(rows.map(user=>[user.userId,user.role])));setEmployeeLinkDrafts(Object.fromEntries(rows.map(user=>[user.userId,employeeRows.find(employee=>employee.userId===user.userId)?.dbId||''])));setSelectedUserId(current=>current&&rows.some(user=>user.userId===current)?current:'')}catch(error){notifyError(error,'load',{operation:'platform_organization_users_load'})}finally{setLoadingUsers(false)}}"
if(!s.includes(loadOld)) throw new Error('loadUsers pattern not found')
s=s.replace(loadOld,loadNew)

const selectedOld="  const selectedUser=useMemo(()=>users.find(user=>user.userId===selectedUserId)||null,[users,selectedUserId])\n  const canSave=Boolean(draft.name.trim()&&draft.code.trim())"
const selectedNew="  const selectedUser=useMemo(()=>users.find(user=>user.userId===selectedUserId)||null,[users,selectedUserId])\n  const selectedEmployee=useMemo(()=>selectedUser?employees.find(employee=>employee.userId===selectedUser.userId)||null:null,[employees,selectedUser])\n  const employeeOptions=useMemo(()=>selectedUser?employees.filter(employee=>!employee.userId||employee.userId===selectedUser.userId):[],[employees,selectedUser])\n  const canSave=Boolean(draft.name.trim()&&draft.code.trim())"
if(!s.includes(selectedOld)) throw new Error('selected user pattern not found')
s=s.replace(selectedOld,selectedNew)

const fnMarker="  async function resetUserAccess(user){"
const linkFn="  async function linkUserEmployee(user){const employeeDbId=employeeLinkDrafts[user.userId]||'';if(!employeeDbId||working)return;const employee=employees.find(item=>item.dbId===employeeDbId);if(!employee)return;const ok=await confirm({title:tx('Σύνδεση καρτέλας εργαζομένου','Link employee record'),message:tx(`Ο χρήστης ${user.name} θα συνδεθεί με την καρτέλα ${employee.lastName} ${employee.firstName} (${employee.id}).`,`User ${user.name} will be linked to employee record ${employee.firstName} ${employee.lastName} (${employee.id}).`),confirmLabel:tx('Σύνδεση','Link')});if(!ok)return;setWorking(true);try{await manageOrganizationUser({organizationId:record.id,userId:user.userId,action:'link_employee',employeeDbId});await loadUsers();notify(tx('Η καρτέλα εργαζομένου συνδέθηκε με τον λογαριασμό.','Employee record linked to the account.'),'success',{operation:'platform_user_employee_link'})}catch(error){notifyError(error,'save',{operation:'platform_user_employee_link'})}finally{setWorking(false)}}\n\n"
if(!s.includes(linkFn.trim()) && s.includes(fnMarker)) s=s.replace(fnMarker,linkFn+fnMarker)

const rowOld="<tr><th>{tx('Νέος ρόλος','New role')}</th><td colSpan=\"3\"><select className=\"platform-role-select\" value={roleDrafts[selectedUser.userId]||selectedUser.role} onChange={e=>setRoleDrafts(x=>({...x,[selectedUser.userId]:e.target.value}))}>{ROLES.map(role=><option key={role} value={role}>{roleLabel(role,language)}</option>)}</select></td></tr>"
const rowNew="<tr><th>{tx('Καρτέλα εργαζομένου','Employee record')}</th><td colSpan=\"3\"><div className=\"platform-user-employee-link\"><select className=\"platform-role-select\" value={employeeLinkDrafts[selectedUser.userId]||''} onChange={e=>setEmployeeLinkDrafts(x=>({...x,[selectedUser.userId]:e.target.value}))}><option value=\"\">{tx('Επιλογή εργαζομένου…','Select employee…')}</option>{employeeOptions.map(employee=><option key={employee.dbId} value={employee.dbId}>{`${employee.lastName} ${employee.firstName} · ${employee.id}${employee.department?` · ${employee.department}`:''}`}</option>)}</select><Button variant=\"secondary\" disabled={working||!employeeLinkDrafts[selectedUser.userId]||selectedEmployee?.dbId===employeeLinkDrafts[selectedUser.userId]} onClick={()=>linkUserEmployee(selectedUser)}>{tx(selectedEmployee?'Αλλαγή σύνδεσης':'Σύνδεση καρτέλας',selectedEmployee?'Change link':'Link record')}</Button></div>{selectedEmployee&&<small className=\"platform-user-linked-employee\">{tx(`Συνδεδεμένη καρτέλα: ${selectedEmployee.lastName} ${selectedEmployee.firstName} (${selectedEmployee.id})`,`Linked record: ${selectedEmployee.firstName} ${selectedEmployee.lastName} (${selectedEmployee.id})`)}</small>}</td></tr>"+rowOld
if(!s.includes(rowOld)) throw new Error('new role row pattern not found')
s=s.replace(rowOld,rowNew)
fs.writeFileSync(recordPath,s)

const edgePath='supabase/functions/manage-organization-user/index.ts'
let e=fs.readFileSync(edgePath,'utf8')
const edgeMarker=" if(action==='suspend'||action==='reactivate'){"
const edgeBlock=" if(action==='link_employee'){const employeeDbId=String(b.employeeDbId||'').trim();if(!employeeDbId)return reply({error:'employeeDbId is required'},400);const {data:employee,error:employeeError}=await admin.from('employees').select('id,user_id').eq('organization_id',organizationId).eq('id',employeeDbId).maybeSingle();if(employeeError)return reply({error:employeeError.message},500);if(!employee)return reply({error:'EMPLOYEE_NOT_FOUND'},404);if(employee.user_id&&employee.user_id!==userId)return reply({error:'EMPLOYEE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT'},409);const {error:unlinkError}=await admin.from('employees').update({user_id:null,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('user_id',userId).neq('id',employeeDbId);if(unlinkError)return reply({error:unlinkError.message},500);const {error:linkError}=await admin.from('employees').update({user_id:userId,updated_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',employeeDbId);if(linkError)return reply({error:linkError.message},500);return reply({ok:true,employeeId:employeeDbId})}\n"
if(!e.includes("action==='link_employee'")){
  if(!e.includes(edgeMarker)) throw new Error('edge action marker not found')
  e=e.replace(edgeMarker,edgeBlock+edgeMarker)
}
fs.writeFileSync(edgePath,e)

const cssPath='src/styles/design-system-layouts.css'
let css=fs.readFileSync(cssPath,'utf8')
if(!css.includes('.platform-user-employee-link{')) css += `\n\n/* Platform Owner · user to employee record linkage */\n.platform-user-employee-link{display:flex;align-items:center;gap:10px;max-width:760px}\n.platform-user-employee-link .platform-role-select{flex:1;min-width:0}\n.platform-user-linked-employee{display:block;margin-top:7px;color:var(--lo-color-text-muted);font-size:11px}\n@media(max-width:760px){.platform-user-employee-link{align-items:stretch;flex-direction:column}.platform-user-employee-link .button{width:100%}}\n`
fs.writeFileSync(cssPath,css)
