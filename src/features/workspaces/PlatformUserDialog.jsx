import { KeyRound,PauseCircle,PlayCircle,Send,Trash2 } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
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
    <div className="user-management-actions">
      <SaveButton onClick={()=>onAction('update',{role:user.role,jobTitle:user.jobTitle})}>{en?'Save changes':'Αποθήκευση αλλαγών'}</SaveButton>
      <Button variant="secondary" onClick={()=>onAction('reset_password')}><KeyRound size={15}/>{en?'Reset password':'Επαναφορά κωδικού'}</Button>
      {user.status==='invited'&&<Button variant="secondary" onClick={()=>onAction('resend_invitation')}><Send size={15}/>{en?'Resend invitation':'Επαναποστολή πρόσκλησης'}</Button>}
      <Button variant="secondary" onClick={()=>onAction(user.status==='disabled'?'reactivate':'suspend')}>{user.status==='disabled'?<PlayCircle size={15}/>:<PauseCircle size={15}/>} {user.status==='disabled'?(en?'Reactivate':'Επανενεργοποίηση'):(en?'Suspend user':'Παύση χρήστη')}</Button>
      <Button variant="secondary" className="button-destructive" onClick={onDeleteConfirm}><Trash2 size={15}/>{en?'Delete':'Διαγραφή'}</Button>
    </div>
  </ObserverDialog>
}
