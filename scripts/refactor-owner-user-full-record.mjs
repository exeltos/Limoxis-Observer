import fs from 'node:fs'

const jsxPath='src/features/platform/PlatformOrganizationRecord.jsx'
const cssPath='src/styles/design-system-layouts.css'
const edgePath='supabase/functions/manage-organization-user/index.ts'

let s=fs.readFileSync(jsxPath,'utf8')

// Add user record edit state.
s=s.replace("  const [selectedUserId,setSelectedUserId]=useState('')\n  const [editing,setEditing]=useState(false)","  const [selectedUserId,setSelectedUserId]=useState('')\n  const [editing,setEditing]=useState(false)\n  const [userEditing,setUserEditing]=useState(false)\n  const [userDraft,setUserDraft]=useState({fullName:'',email:'',phone:'',jobTitle:'',role:''})")

const selectedNeedle="  const selectedUser=useMemo(()=>users.find(user=>user.userId===selectedUserId)||null,[users,selectedUserId])\n  const selectedEmployee=useMemo(()=>selectedUser?employees.find(employee=>employee.userId===selectedUser.userId)||null:null,[employees,selectedUser])"
const selectedInsert="  const selectedUser=useMemo(()=>users.find(user=>user.userId===selectedUserId)||null,[users,selectedUserId])\n  const selectedEmployee=useMemo(()=>selectedUser?employees.find(employee=>employee.userId===selectedUser.userId)||null:null,[employees,selectedUser])"
if(!s.includes(selectedNeedle)) throw new Error('selected user block not found')
s=s.replace(selectedNeedle,selectedInsert)

const canSaveNeedle="  const canSave=Boolean(draft.name.trim()&&draft.code.trim())"
const canSaveInsert=`  const canSave=Boolean(draft.name.trim()&&draft.code.trim())

  useEffect(()=>{
    if(!selectedUser){setUserEditing(false);return}
    setUserDraft({fullName:selectedUser.name||'',email:selectedUser.email||'',phone:selectedUser.phone||'',jobTitle:selectedUser.jobTitle||'',role:selectedUser.role||''})
    setUserEditing(false)
  },[selectedUserId,selectedUser?.name,selectedUser?.email,selectedUser?.phone,selectedUser?.jobTitle,selectedUser?.role])`
if(!s.includes(canSaveNeedle)) throw new Error('canSave block not found')
s=s.replace(canSaveNeedle,canSaveInsert)

const resetNeedle="  async function resetUserAccess(user){if(!user||working)return;const invited=user.status==='invited';"
const resetIndex=s.indexOf(resetNeedle)
if(resetIndex<0) throw new Error('resetUserAccess not found')
const resetEnd=s.indexOf("\n\n  const tabs=",resetIndex)
if(resetEnd<0) throw new Error('tabs anchor not found')
const extraFns=`

  async function saveSelectedUser(){
    if(!selectedUser||working)return
    const fullName=userDraft.fullName.trim(),email=userDraft.email.trim().toLowerCase()
    if(fullName.length<2||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){notify(tx('Συμπλήρωσε έγκυρο ονοματεπώνυμο και email.','Enter a valid full name and email.'),'error');return}
    setWorking(true)
    try{
      await manageOrganizationUser({organizationId:record.id,userId:selectedUser.userId,action:'update',fullName,email,phone:userDraft.phone.trim()||null,jobTitle:userDraft.jobTitle.trim()||null,role:userDraft.role||selectedUser.role})
      await loadUsers();setUserEditing(false)
      notify(tx('Τα στοιχεία του χρήστη ενημερώθηκαν.','User details updated.'),'success',{operation:'platform_user_update'})
    }catch(error){notifyError(error,'save',{operation:'platform_user_update'})}finally{setWorking(false)}
  }

  async function deleteSelectedUser(){
    if(!selectedUser||working)return
    const ok=await confirm({title:tx('Διαγραφή χρήστη','Delete user'),message:tx(\`Ο χρήστης ${selectedUser.name} θα διαγραφεί οριστικά από το Limoxis Observer. Η ενέργεια δεν αναιρείται.\`,\`User ${selectedUser.name} will be permanently deleted from Limoxis Observer. This action cannot be undone.\`),confirmLabel:tx('Διαγραφή','Delete'),danger:true})
    if(!ok)return
    setWorking(true)
    try{await manageOrganizationUser({organizationId:record.id,userId:selectedUser.userId,action:'delete'});setSelectedUserId('');await loadUsers();notify(tx('Ο χρήστης διαγράφηκε.','User deleted.'),'success',{operation:'platform_user_delete'})}
    catch(error){notifyError(error,'delete',{operation:'platform_user_delete'})}finally{setWorking(false)}
  }

  async function toggleSelectedUserStatus(){
    if(!selectedUser||working)return
    const action=selectedUser.status==='disabled'?'reactivate':'suspend'
    const ok=await confirm({title:action==='suspend'?tx('Παύση χρήστη','Suspend user'):tx('Ενεργοποίηση χρήστη','Reactivate user'),message:action==='suspend'?tx('Ο χρήστης δεν θα μπορεί να συνδεθεί μέχρι να ενεργοποιηθεί ξανά.','The user will not be able to sign in until reactivated.'):tx('Να ενεργοποιηθεί ξανά ο χρήστης;','Reactivate this user?'),confirmLabel:action==='suspend'?tx('Παύση','Suspend'):tx('Ενεργοποίηση','Reactivate')})
    if(!ok)return
    setWorking(true)
    try{await manageOrganizationUser({organizationId:record.id,userId:selectedUser.userId,action});await loadUsers();notify(action==='suspend'?tx('Ο χρήστης τέθηκε σε παύση.','User suspended.'):tx('Ο χρήστης ενεργοποιήθηκε.','User reactivated.'),'success',{operation:'platform_user_status'})}
    catch(error){notifyError(error,'action',{operation:'platform_user_status'})}finally{setWorking(false)}
  }`
s=s.slice(0,resetEnd)+extraFns+s.slice(resetEnd)

const actionsAnchor="  const actions=<div className=\"platform-org-actions\""
const actionsIndex=s.indexOf(actionsAnchor)
if(actionsIndex<0) throw new Error('actions anchor not found')
const returnIndex=s.indexOf("  return <EntityRecordShell",actionsIndex)
if(returnIndex<0) throw new Error('main return not found')

const fullRecord=`  if(initialTab==='users'&&selectedUser){
    const initials=(selectedUser.name||'').split(/\\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'U'
    return <EntityRecordShell className="platform-user-record-shell workspace-fill" avatar={initials} eyebrow={tx('ΧΡΗΣΤΗΣ ΟΡΓΑΝΙΣΜΟΥ','ORGANIZATION USER')} title={selectedUser.name} subtitle={\`${'${selectedUser.email||\'—\'}'} · ${'${selectedUser.username||\'—\'}'}\`} status={<span className={\`status-badge ${'${selectedUser.status===\'active\'?\'active\':selectedUser.status===\'disabled\'?\'danger\':\'temporary\'}'}\`}>{selectedUser.status==='active'?tx('Ενεργός','Active'):selectedUser.status==='disabled'?tx('Σε παύση','Suspended'):tx('Εκκρεμής','Pending')}</span>} onBack={()=>setSelectedUserId('')} backLabel={tx('Πίσω','Back')} headerActions={<div className="platform-user-record-header-actions">{!userEditing?<Button variant="secondary" onClick={()=>setUserEditing(true)}><Pencil size={15}/>{tx('Επεξεργασία','Edit')}</Button>:<><Button variant="secondary" onClick={()=>{setUserDraft({fullName:selectedUser.name||'',email:selectedUser.email||'',phone:selectedUser.phone||'',jobTitle:selectedUser.jobTitle||'',role:selectedUser.role||''});setUserEditing(false)}}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button disabled={working} onClick={saveSelectedUser}><Save size={15}/>{tx('Αποθήκευση','Save')}</Button></>}<Button variant="danger" disabled={working} onClick={deleteSelectedUser}><Trash2 size={15}/>{tx('Διαγραφή','Delete')}</Button></div>}>
      <div className="platform-user-record-workspace">
        <section className="platform-user-record-section">
          <div className="platform-user-record-section-heading"><div><strong>{tx('Στοιχεία χρήστη','User details')}</strong><span>{tx('Στοιχεία ταυτότητας και επικοινωνίας του λογαριασμού.','Identity and contact details for this account.')}</span></div></div>
          <div className="platform-user-record-grid">
            <label className="field"><span>{tx('Ονοματεπώνυμο','Full name')}</span><input value={userDraft.fullName} readOnly={!userEditing} onChange={e=>setUserDraft(x=>({...x,fullName:e.target.value}))}/></label>
            <label className="field"><span>Email</span><input type="email" value={userDraft.email} readOnly={!userEditing} onChange={e=>setUserDraft(x=>({...x,email:e.target.value}))}/></label>
            <label className="field"><span>Username</span><input value={selectedUser.username||'—'} readOnly /></label>
            <label className="field"><span>{tx('Τηλέφωνο','Phone')}</span><input value={userDraft.phone} readOnly={!userEditing} onChange={e=>setUserDraft(x=>({...x,phone:e.target.value}))}/></label>
            <label className="field"><span>{tx('Θέση / Ιδιότητα','Job title')}</span><input value={userDraft.jobTitle} readOnly={!userEditing} onChange={e=>setUserDraft(x=>({...x,jobTitle:e.target.value}))}/></label>
            <label className="field"><span>{tx('Ρόλος','Role')}</span><select value={userDraft.role||selectedUser.role} disabled={!userEditing} onChange={e=>setUserDraft(x=>({...x,role:e.target.value}))}>{ROLES.map(role=><option key={role} value={role}>{roleLabel(role,language)}</option>)}</select></label>
          </div>
        </section>
        <section className="platform-user-record-section">
          <div className="platform-user-record-section-heading"><div><strong>{tx('Καρτέλα εργαζομένου','Employee record')}</strong><span>{selectedEmployee?tx(\`Συνδεδεμένη με ${selectedEmployee.lastName} ${selectedEmployee.firstName} (${selectedEmployee.id}).\`,\`Linked to ${selectedEmployee.firstName} ${selectedEmployee.lastName} (${selectedEmployee.id}).\`):tx('Δεν έχει συνδεθεί καρτέλα εργαζομένου.','No employee record is linked.')}</span></div></div>
          <div className="platform-user-record-link-row"><select className="platform-role-select" value={employeeLinkDrafts[selectedUser.userId]||''} disabled={!userEditing} onChange={e=>setEmployeeLinkDrafts(x=>({...x,[selectedUser.userId]:e.target.value}))}><option value="">{tx('Επιλογή εργαζομένου…','Select employee…')}</option>{employeeOptions.map(employee=><option key={employee.dbId} value={employee.dbId}>{\`${'${employee.lastName} ${employee.firstName} · ${employee.id}${employee.department?` · ${employee.department}`:\'\'}'}\`}</option>)}</select><Button variant="secondary" disabled={!userEditing||working||!employeeLinkDrafts[selectedUser.userId]||selectedEmployee?.dbId===employeeLinkDrafts[selectedUser.userId]} onClick={()=>linkUserEmployee(selectedUser)}>{tx(selectedEmployee?'Αλλαγή σύνδεσης':'Σύνδεση καρτέλας',selectedEmployee?'Change link':'Link record')}</Button></div>
        </section>
        <section className="platform-user-record-section platform-user-record-security">
          <div className="platform-user-record-section-heading"><div><strong>{tx('Πρόσβαση & ασφάλεια','Access & security')}</strong><span>{tx('Διαχείριση κατάστασης λογαριασμού και ανάκτησης πρόσβασης.','Manage account status and access recovery.')}</span></div></div>
          <div className="platform-user-record-actions"><Button variant="secondary" disabled={working} onClick={()=>resetUserAccess(selectedUser)}><KeyRound size={15}/>{selectedUser.status==='invited'?tx('Επαναποστολή πρόσκλησης','Resend invitation'):tx('Επαναφορά κωδικού','Reset password')}</Button><Button variant="secondary" disabled={working} onClick={toggleSelectedUserStatus}>{selectedUser.status==='disabled'?<PlayCircle size={15}/>:<PauseCircle size={15}/>} {selectedUser.status==='disabled'?tx('Ενεργοποίηση','Reactivate'):tx('Παύση','Suspend')}</Button></div>
        </section>
      </div>
    </EntityRecordShell>
  }

`
s=s.slice(0,returnIndex)+fullRecord+s.slice(returnIndex)

// Replace users tab with registry only; selecting a row opens full record via early return.
const usersStart=s.indexOf("    {initialTab==='users'&&<div className=\"platform-owner-users\">")
if(usersStart<0) throw new Error('users tab start not found')
const usersEnd=s.indexOf("\n\n    {initialTab==='diagnostics'",usersStart)
if(usersEnd<0) throw new Error('users tab end not found')
const usersBlock=`    {initialTab==='users'&&<div className="platform-owner-users"><div className="platform-user-role-help"><strong>{tx('Ρόλοι χρηστών','User roles')}</strong><span>{tx('Επίλεξε έναν χρήστη για να ανοίξεις την πλήρη καρτέλα διαχείρισης.','Select a user to open the full management record.')}</span></div>{loadingUsers?<div className="inline-empty">{tx('Φόρτωση χρηστών…','Loading users…')}</div>:users.length?<div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{tx('Χρήστης','User')}</th><th>Username</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Κατάσταση','Status')}</th></tr></thead><tbody>{users.map(user=><tr key={user.userId} tabIndex={0} className="platform-owner-clickable-row" onClick={()=>setSelectedUserId(user.userId)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedUserId(user.userId)}}}><td><strong>{user.name}</strong><small>{user.email||'—'}</small></td><td>{user.username}</td><td>{roleLabel(user.role,language)}</td><td><span className={\`status-badge ${'${user.status===\'active\'?\'active\':user.status===\'disabled\'?\'danger\':\'temporary\'}'}\`}>{user.status==='active'?tx('Ενεργός','Active'):user.status==='disabled'?tx('Σε παύση','Suspended'):tx('Εκκρεμής','Pending')}</span></td></tr>)}</tbody></table></div>:<div className="inline-empty">{tx('Δεν υπάρχουν χρήστες. Δημιούργησε Hospital Admin από την καρτέλα Στοιχεία.','No users. Create a Hospital Admin from the Details tab.')}</div>}</div>}`
s=s.slice(0,usersStart)+usersBlock+s.slice(usersEnd)

fs.writeFileSync(jsxPath,s)

let css=fs.readFileSync(cssPath,'utf8')
const marker='/* Platform Owner · full-screen organization user record */'
if(!css.includes(marker))css+=`\n\n${marker}\n.platform-user-record-shell{width:100%;max-width:none}\n.platform-user-record-shell>.entity-record-body{min-height:0}\n.platform-user-record-header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.platform-user-record-workspace{display:grid;gap:14px;padding:4px 0 18px}\n.platform-user-record-section{padding:18px;border:1px solid var(--lo-color-border);border-radius:var(--lo-radius-card);background:var(--lo-color-surface)}\n.platform-user-record-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}\n.platform-user-record-section-heading>div{display:flex;flex-direction:column;gap:4px}\n.platform-user-record-section-heading strong{font-size:14px;color:var(--lo-color-text)}\n.platform-user-record-section-heading span{font-size:11px;line-height:1.45;color:var(--lo-color-muted)}\n.platform-user-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}\n.platform-user-record-grid .field{min-width:0}\n.platform-user-record-grid input,.platform-user-record-grid select{width:100%;min-height:40px}\n.platform-user-record-grid input[readonly],.platform-user-record-grid select:disabled{background:var(--lo-color-surface-soft,#f6f8fb);color:var(--lo-color-text);opacity:1;cursor:default}\n.platform-user-record-link-row{display:grid;grid-template-columns:minmax(260px,1fr) auto;gap:10px;align-items:center}\n.platform-user-record-link-row .platform-role-select{width:100%;min-height:40px}\n.platform-user-record-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}\n.platform-user-record-security{margin-bottom:4px}\n@media(max-width:760px){.platform-user-record-grid{grid-template-columns:1fr}.platform-user-record-link-row{grid-template-columns:1fr}.platform-user-record-link-row .button{width:100%}.platform-user-record-header-actions{width:100%}.platform-user-record-header-actions .button{flex:1}}\n`
fs.writeFileSync(cssPath,css)

let edge=fs.readFileSync(edgePath,'utf8')
const oldUpdate=" if(action==='update'){if(b.jobTitle!==undefined)await admin.from('profiles').update({job_title:b.jobTitle||null}).eq('id',userId);if(b.role)await admin.from('organization_members').update({role:b.role}).eq('organization_id',organizationId).eq('user_id',userId);return reply({ok:true})}"
const newUpdate=" if(action==='update'){const profilePatch:any={};if(b.fullName!==undefined)profilePatch.full_name=String(b.fullName||'').trim();if(b.email!==undefined)profilePatch.contact_email=String(b.email||'').trim().toLowerCase()||null;if(b.phone!==undefined)profilePatch.phone=b.phone||null;if(b.jobTitle!==undefined)profilePatch.job_title=b.jobTitle||null;if(Object.keys(profilePatch).length){const {error}=await admin.from('profiles').update(profilePatch).eq('id',userId);if(error)return reply({error:error.message},500)}if(b.email!==undefined){const email=String(b.email||'').trim().toLowerCase();if(email){const {error}=await admin.auth.admin.updateUserById(userId,{email});if(error)return reply({error:error.message},500)}}if(b.role)await admin.from('organization_members').update({role:b.role}).eq('organization_id',organizationId).eq('user_id',userId);return reply({ok:true})}"
if(!edge.includes(oldUpdate)) throw new Error('edge update action not found')
edge=edge.replace(oldUpdate,newUpdate)
fs.writeFileSync(edgePath,edge)
