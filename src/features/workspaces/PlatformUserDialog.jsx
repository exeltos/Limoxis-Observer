import { KeyRound,PauseCircle,PlayCircle,Send,Trash2,Save } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { IconButton } from '../../design-system/IconButton'
import { SYSTEM_ROLE_KEYS,roleLabel } from '../../core/permissions/roleLabels'

export function PlatformUserDialog({organization,user,language='el',onChange,onAction,onDeleteConfirm}){
  if(!organization||!user)return null
  const en=language==='en'
  return <ObserverDialog width="wide" eyebrow={`Platform Owner · ${organization.name}`} title={user.name} subtitle={`${user.username} · ${user.email||(en?'no email':'χωρίς email')}`} onClose={()=>onChange(null)}>
    <div className="entry-grid compact">
      <label className="field"><span>{en?'Role':'Ρόλος'}</span><select value={user.role} onChange={e=>onChange({...user,role:e.target.value})}>{SYSTEM_ROLE_KEYS.map(key=><option key={key} value={key}>{roleLabel(key,language)}</option>)}</select></label>
      <label className="field"><span>{en?'Job title':'Ιδιότητα / τίτλος'}</span><input value={user.jobTitle||''} onChange={e=>onChange({...user,jobTitle:e.target.value})}/></label>
      <label className="field"><span>Email</span><input value={user.email||''} readOnly/></label>
      <label className="field"><span>{en?'Phone':'Τηλέφωνο'}</span><input value={user.phone||''} readOnly/></label>
    </div>
    <div className="user-management-actions lo-dialog-icon-actions" aria-label={en?'User actions':'Ενέργειες χρήστη'}>
      <IconButton tone="success" label={en?'Save changes':'Αποθήκευση αλλαγών'} onClick={()=>onAction('update',{role:user.role,jobTitle:user.jobTitle})}><Save size={17}/></IconButton>
      <IconButton label={en?'Reset password':'Επαναφορά κωδικού'} onClick={()=>onAction('reset_password')}><KeyRound size={17}/></IconButton>
      {user.status==='invited'&&<IconButton label={en?'Resend invitation':'Επαναποστολή πρόσκλησης'} onClick={()=>onAction('resend_invitation')}><Send size={17}/></IconButton>}
      <IconButton label={user.status==='disabled'?(en?'Reactivate':'Επανενεργοποίηση'):(en?'Suspend user':'Παύση χρήστη')} onClick={()=>onAction(user.status==='disabled'?'reactivate':'suspend')}>{user.status==='disabled'?<PlayCircle size={17}/>:<PauseCircle size={17}/>}</IconButton>
      <IconButton tone="danger" label={en?'Delete user':'Διαγραφή χρήστη'} onClick={onDeleteConfirm}><Trash2 size={17}/></IconButton>
    </div>
  </ObserverDialog>
}
