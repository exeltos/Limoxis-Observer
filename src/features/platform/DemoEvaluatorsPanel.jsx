import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Link2, Mail, Send, Trash2, UserPlus } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { listOrganizationMembersDetailed, manageOrganizationUser } from '../../core/tenant/tenantService'
import { addPlatformDemoEvaluator, getPlatformDemoAccessLink } from './platformDemoService'
import { DEMO_DEPARTMENTS, DEMO_DEPARTMENT_ROLES, DEMO_EVALUATOR_ROLES } from './DemoCreateWizard'
import { AccessLinkDialog } from './DemoAccessLinkDialog'
import './demoWizard.css'

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Demo record: the people evaluating this Demo. The Owner re-sends an
// invitation, sends a password-reset email, adds or removes an evaluator.
// With no users yet (e.g. the invitation failed when the Demo was created),
// the contact person can be invited from here in one step.
export function DemoEvaluatorsPanel({organizationId,entitlementId,language,maxUsers=5,disabled=false,contactName='',contactEmail=''}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const {notify,notifyError,confirm}=useFeedback()
  const [members,setMembers]=useState([])
  const [loading,setLoading]=useState(true)
  const [working,setWorking]=useState('')
  const [adding,setAdding]=useState(false)
  const [created,setCreated]=useState(null)
  const [accessLink,setAccessLink]=useState(null)

  const reload=useCallback(async()=>{
    if(!organizationId)return
    setLoading(true)
    try{setMembers(await listOrganizationMembersDetailed(organizationId))}catch(error){notifyError(error,'load',{operation:'demo_evaluators_load'})}finally{setLoading(false)}
  },[organizationId,notifyError])
  useEffect(()=>{void reload()},[reload])

  async function run(member,action){
    const labels={
      resend_invitation:[tx('Επαναποστολή πρόσκλησης','Resend invitation'),tx(`Θα σταλεί νέα πρόσκληση στο ${member.email}.`,`A new invitation will be sent to ${member.email}.`),tx('Η πρόσκληση στάλθηκε.','Invitation sent.')],
      reset_password:[tx('Επαναφορά κωδικού','Reset password'),tx(`Θα σταλεί email ορισμού νέου κωδικού στο ${member.email}.`,`A password-reset email will be sent to ${member.email}.`),tx('Στάλθηκε email επαναφοράς κωδικού.','Password-reset email sent.')],
      delete:[tx('Αφαίρεση χρήστη','Remove user'),tx(`Ο/Η ${member.name} δεν θα έχει πια πρόσβαση στο Demo.`,`${member.name} will no longer have access to the Demo.`),tx('Ο χρήστης αφαιρέθηκε.','User removed.')],
    }[action]
    const ok=await confirm({title:labels[0],message:labels[1],confirmLabel:labels[0],danger:action==='delete'})
    if(!ok)return
    setWorking(member.userId)
    try{await manageOrganizationUser({organizationId,userId:member.userId,action});notify(labels[2],'success',{operation:`demo_evaluator_${action}`});await reload()}
    catch(error){notifyError(error,'save',{operation:`demo_evaluator_${action}`})}
    finally{setWorking('')}
  }

  // A fresh sign-in link for the Owner to pass on when the email does not arrive.
  async function showLink(member){
    setWorking(member.id)
    try{setAccessLink({name:member.name,email:member.email,link:await getPlatformDemoAccessLink({entitlementId,userId:member.userId})})}
    catch(error){notifyError(error,'load',{operation:'demo_access_link'})}
    finally{setWorking('')}
  }

  async function add(evaluator){
    setWorking('new')
    try{
      const result=await addPlatformDemoEvaluator({entitlementId,evaluator})
      setAdding(false)
      const added=result?.evaluator||{}
      if(added.temporaryPassword)setCreated(added)
      else if(added.accessLink)setAccessLink({name:added.fullName,email:added.email,link:added.accessLink,emailSent:added.emailSent})
      if(added.temporaryPassword||added.emailSent)notify(added.emailSent?tx(`Στάλθηκε πρόσκληση στο ${added.email}.`,`Invitation sent to ${added.email}.`):tx('Ο χρήστης προστέθηκε.','User added.'),'success',{operation:'demo_evaluator_add'})
      else notify(tx(`Ο χρήστης προστέθηκε, αλλά η πρόσκληση δεν στάλθηκε${added.emailError?`: ${added.emailError}`:'.'}`,`The user was added, but the invitation was not sent${added.emailError?`: ${added.emailError}`:'.'}`),'warning',{operation:'demo_evaluator_add'})
      await reload()
    }catch(error){notifyError(error,'save',{operation:'demo_evaluator_add'})}
    finally{setWorking('')}
  }

  const admins=members.filter(m=>m.role==='hospital_admin').length
  return <section className="platform-form-section demo-evaluators-panel">
    <header>
      <div><strong>{tx('Χρήστες αξιολόγησης','Evaluators')}</strong><span>{tx('Οι λογαριασμοί του πελάτη μέσα σε αυτό το Demo.','The customer\'s accounts in this Demo.')}</span></div>
      <div className="platform-form-section-actions"><span className="demo-wizard-count">{members.length} / {maxUsers}</span><Button variant="secondary" disabled={disabled||loading||members.length>=maxUsers||Boolean(working)} onClick={()=>setAdding(true)}><UserPlus size={15}/>{tx('Προσθήκη χρήστη','Add user')}</Button></div>
    </header>
    {loading?<p className="demo-evaluators-empty">{tx('Φόρτωση…','Loading…')}</p>:!members.length?<div className="demo-evaluators-empty"><p>{tx('Δεν υπάρχουν χρήστες αξιολόγησης.','No evaluators yet.')}</p>{contactEmail&&<Button disabled={disabled||Boolean(working)} loading={working==='new'} onClick={()=>add({fullName:contactName||contactEmail,email:contactEmail,role:'hospital_admin',departmentCode:null,access:'invite'})}><Send size={15}/>{tx(`Αποστολή πρόσκλησης στο ${contactEmail}`,`Send invitation to ${contactEmail}`)}</Button>}</div>:
    <table className="demo-wizard-review-users">
      <thead><tr><th>{tx('Χρήστης','User')}</th><th>Username</th><th>{tx('Ρόλος','Role')}</th><th>{tx('Κατάσταση','Status')}</th><th className="demo-evaluators-actions-head">{tx('Ενέργειες','Actions')}</th></tr></thead>
      <tbody>{members.map(member=>{
        const invited=member.status==='invited'
        const lastAdmin=member.role==='hospital_admin'&&admins<2
        return <tr key={member.id}>
          <td><strong>{member.name}</strong><small>{member.email||'—'}</small></td>
          <td><code>{member.username}</code></td>
          <td>{roleLabel(member.role,language)}</td>
          <td><span className={`status-badge ${member.status==='active'?'active':invited?'temporary':'danger'}`}>{member.status==='active'?tx('Ενεργός','Active'):invited?tx('Πρόσκληση σε αναμονή','Invitation pending'):tx('Ανενεργός','Inactive')}</span></td>
          <td><div className="demo-evaluators-actions">
            {invited
              ?<IconButton tone="neutral" label={tx('Επαναποστολή πρόσκλησης','Resend invitation')} disabled={disabled||Boolean(working)||!member.email} onClick={()=>run(member,'resend_invitation')}><Send size={16}/></IconButton>
              :<IconButton tone="neutral" label={tx('Επαναφορά κωδικού','Reset password')} disabled={disabled||Boolean(working)||!member.email} onClick={()=>run(member,'reset_password')}><KeyRound size={16}/></IconButton>}
            <IconButton tone="neutral" label={tx('Σύνδεσμος πρόσβασης','Access link')} disabled={disabled||Boolean(working)||!member.email} onClick={()=>showLink(member)}><Link2 size={16}/></IconButton>
            <IconButton tone="danger" label={lastAdmin?tx('Ο τελευταίος Διαχειριστής δεν αφαιρείται','The last Hospital Admin cannot be removed'):tx('Αφαίρεση χρήστη','Remove user')} disabled={disabled||Boolean(working)||lastAdmin} onClick={()=>run(member,'delete')}><Trash2 size={16}/></IconButton>
          </div></td>
        </tr>
      })}</tbody>
    </table>}
    {adding&&<AddEvaluatorDialog language={language} working={working==='new'} takenEmails={members.map(m=>String(m.email||'').toLowerCase()).filter(Boolean)} onAdd={add} onClose={()=>setAdding(false)}/>}
    {accessLink&&<AccessLinkDialog language={language} {...accessLink} onClose={()=>setAccessLink(null)}/>}
    {created&&<ObserverDialog width="standard" eyebrow={tx('Νέος χρήστης','New user')} title={created.fullName} subtitle={tx('Ο κωδικός εμφανίζεται μόνο τώρα.','The password is shown only now.')} onClose={()=>setCreated(null)} footer={<Button onClick={()=>setCreated(null)}>{tx('Τέλος','Done')}</Button>}>
      <dl className="demo-wizard-summary"><div><dt>Username</dt><dd><code>{created.username}</code></dd></div><div><dt>{tx('Προσωρινός κωδικός','Temporary password')}</dt><dd><code>{created.temporaryPassword}</code></dd></div></dl>
    </ObserverDialog>}
  </section>
}

function AddEvaluatorDialog({language,working=false,takenEmails=[],onAdd,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [draft,setDraft]=useState({fullName:'',email:'',role:'infection_control_lead',departmentCode:'ΜΕΘ',access:'invite'})
  const set=(key,value)=>setDraft(c=>({...c,[key]:value}))
  const email=draft.email.trim().toLowerCase()
  const taken=Boolean(email)&&takenEmails.includes(email)
  const ready=draft.fullName.trim()&&EMAIL.test(email)&&!taken&&!working
  const departmentRole=DEMO_DEPARTMENT_ROLES.has(draft.role)
  return <ObserverDialog width="standard" eyebrow="Demo" title={tx('Προσθήκη χρήστη αξιολόγησης','Add evaluator')} onClose={()=>!working&&onClose?.()} footer={<><Button loading={working} disabled={!ready} onClick={()=>onAdd?.({fullName:draft.fullName.trim(),email,role:draft.role,departmentCode:departmentRole?draft.departmentCode:null,access:draft.access})}><UserPlus size={15}/>{tx('Προσθήκη','Add')}</Button></>}>
    <div className="lifecycle-form demo-evaluator-form">
      <label className="field"><span>{tx('Ονοματεπώνυμο','Full name')} *</span><input autoFocus value={draft.fullName} onChange={e=>set('fullName',e.target.value)}/></label>
      <label className="field"><span>Email *</span><input type="email" value={draft.email} onChange={e=>set('email',e.target.value)}/>{taken&&<small className="field-error">{tx('Υπάρχει ήδη χρήστης με αυτό το email.','A user with this email already exists.')}</small>}</label>
      <label className="field"><span>{tx('Ρόλος','Role')}</span><select value={draft.role} onChange={e=>set('role',e.target.value)}>{DEMO_EVALUATOR_ROLES.map(role=><option key={role} value={role}>{roleLabel(role,language)}</option>)}</select></label>
      <label className="field"><span>{tx('Τμήμα','Department')}</span><select value={draft.departmentCode} disabled={!departmentRole} onChange={e=>set('departmentCode',e.target.value)}>{departmentRole?DEMO_DEPARTMENTS.map(([code,name])=><option key={code} value={code}>{name}</option>):<option value={draft.departmentCode}>{tx('Όλο το νοσοκομείο','Whole hospital')}</option>}</select></label>
      <label className="field lifecycle-wide"><span>{tx('Πρόσβαση','Access')}</span><select value={draft.access} onChange={e=>set('access',e.target.value)}><option value="invite">{tx('Πρόσκληση email','Email invitation')}</option><option value="password">{tx('Προσωρινός κωδικός','Temporary password')}</option></select></label>
    </div>
    <p className="demo-wizard-note">{draft.access==='password'?<KeyRound size={14}/>:<Mail size={14}/>}{draft.access==='password'?tx('Ο κωδικός εμφανίζεται μία φορά μετά την προσθήκη.','The password is shown once after the user is added.'):tx('Ο χρήστης λαμβάνει το email πρόσβασης στο Demo.','The user receives the Demo access email.')}</p>
  </ObserverDialog>
}

