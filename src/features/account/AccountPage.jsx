import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { Button } from '../../design-system/Button'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { supabase } from '../../core/supabase/client'

export function AccountPage(){
 const {profile}=useAuth(),{tenant,role}=useTenant(),[password,setPassword]=useState(''),[show,setShow]=useState(false),[message,setMessage]=useState('')
 const email=profile?.contactEmail||profile?.email||(String(profile?.username||'').includes('@')?profile.username:'')
 const name=profile?.fullName||profile?.name||profile?.username||'—'
 async function changePassword(){if(password.length<12)return setMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες.');const {error}=await supabase.auth.updateUser({password});setMessage(error?error.message:'Ο κωδικός ενημερώθηκε.');if(!error)setPassword('')}
 return <Page title="Ο λογαριασμός μου" subtitle="Ταυτότητα και ασφάλεια λογαριασμού."><div className="account-shell">
  <section className="account-identity"><div className="account-avatar"><UserRound size={22}/></div><div className="account-identity-main"><span>Λογαριασμός</span><h2>{name}</h2><p>{email||'Δεν έχει δηλωθεί email'}</p></div><span className="status-badge active">Ενεργός</span></section>
  <div className="account-info-grid"><section><Mail size={17}/><div><span>Username</span><strong>{profile?.username||'—'}</strong></div></section><section><ShieldCheck size={17}/><div><span>Πρόσβαση</span><strong>{tenant?.name||'Platform'} · {role?.replaceAll('_',' ')||'—'}</strong></div></section></div>
  <section className="account-security"><header><KeyRound size={18}/><div><strong>Ασφάλεια</strong><span>Αλλαγή προσωπικού κωδικού πρόσβασης</span></div></header><div className="account-password-row"><label><span>Νέος κωδικός</span><div className="password-input-wrap"><input className="input" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="password-visibility" onClick={()=>setShow(v=>!v)} aria-label={show?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><small>Τουλάχιστον 12 χαρακτήρες.</small></label><Button onClick={changePassword} disabled={!password}>Ενημέρωση κωδικού</Button></div>{message&&<div className="account-message">{message}</div>}</section>
 </div></Page>
}
