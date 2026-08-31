import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { supabase } from '../../core/supabase/client'

export function AccountDrawer({open,onClose}){
 const {profile}=useAuth(); const {tenant,role}=useTenant()
 const [password,setPassword]=useState(''); const [show,setShow]=useState(false); const [message,setMessage]=useState('')
 useEffect(()=>{if(!open){setPassword('');setShow(false);setMessage('')}},[open])
 if(!open)return null
 const email=profile?.contactEmail||profile?.email||(String(profile?.username||'').includes('@')?profile.username:'')
 const name=profile?.fullName||profile?.name||profile?.username||'—'
 async function changePassword(){if(password.length<12)return setMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες.');const {error}=await supabase.auth.updateUser({password});setMessage(error?error.message:'Ο κωδικός ενημερώθηκε.');if(!error)setPassword('')}
 return <div className="account-drawer-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
  <aside className="account-drawer" role="dialog" aria-modal="true" aria-label="Ο λογαριασμός μου">
   <header className="account-drawer-header"><div><span>Λογαριασμός</span><h2>Ο λογαριασμός μου</h2></div><button type="button" className="platform-icon-action" onClick={onClose} aria-label="Κλείσιμο"><X size={18}/></button></header>
   <div className="account-drawer-body">
    <section className="account-drawer-identity"><div className="account-avatar"><UserRound size={21}/></div><div className="account-identity-main"><span>Ταυτότητα</span><h3>{name}</h3><p>{email||'Δεν έχει δηλωθεί email'}</p></div><span className="status-badge active">Ενεργός</span></section>
    <section className="account-drawer-info"><Mail size={16}/><div><span>Username</span><strong>{profile?.username||'—'}</strong></div></section>
    <section className="account-drawer-info"><ShieldCheck size={16}/><div><span>Πρόσβαση</span><strong>{tenant?.name||'Platform'} · {role?.replaceAll('_',' ')||'—'}</strong></div></section>
    <section className="account-drawer-security"><header><KeyRound size={17}/><div><strong>Ασφάλεια</strong><span>Αλλαγή προσωπικού κωδικού</span></div></header><label><span>Νέος κωδικός</span><div className="password-input-wrap"><input className="input" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="password-visibility" onClick={()=>setShow(v=>!v)} aria-label={show?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><small>Τουλάχιστον 12 χαρακτήρες.</small></label><Button onClick={changePassword} disabled={!password}>Ενημέρωση κωδικού</Button>{message&&<div className="account-message">{message}</div>}</section>
   </div>
  </aside>
 </div>
}
