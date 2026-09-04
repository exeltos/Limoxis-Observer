import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound, X } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { roleLabel } from '../../core/permissions/roleLabels'
import { supabase } from '../../core/supabase/client'

export function AccountDrawer({open,onClose}){
 const {profile}=useAuth(); const {tenant,role,isRolePreview,actualRole}=useTenant(); const {language}=useLanguage()
 const [password,setPassword]=useState(''); const [show,setShow]=useState(false); const [message,setMessage]=useState('')
 useEffect(()=>{if(!open){setPassword('');setShow(false);setMessage('')}},[open])
 if(!open)return null
 const email=profile?.contactEmail||profile?.email||(String(profile?.username||'').includes('@')?profile.username:'')
 const name=profile?.fullName||profile?.name||profile?.username||'—'
 const previewLabel=roleLabel(role,language)
 const actualLabel=roleLabel(actualRole,language)
 async function changePassword(){if(password.length<12)return setMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 12 χαρακτήρες.');const {error}=await supabase.auth.updateUser({password});setMessage(error?error.message:'Ο κωδικός ενημερώθηκε.');if(!error)setPassword('')}
 return <div className="account-drawer-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
  <aside className="account-drawer" role="dialog" aria-modal="true" aria-label={language==='en'?'My account':'Ο λογαριασμός μου'}>
   <header className="account-drawer-header"><div><span>{isRolePreview?(language==='en'?'ROLE PREVIEW':'ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΡΟΛΟΥ'):(language==='en'?'Account':'Λογαριασμός')}</span><h2>{isRolePreview?previewLabel:(language==='en'?'My account':'Ο λογαριασμός μου')}</h2></div><button type="button" className="platform-icon-action" onClick={onClose} aria-label={language==='en'?'Close':'Κλείσιμο'}><X size={18}/></button></header>
   <div className="account-drawer-body">
    {isRolePreview&&<section className="account-drawer-info"><Eye size={16}/><div><span>{language==='en'?'Preview context':'Πλαίσιο προεπισκόπησης'}</span><strong>{tenant?.name||'—'} · {previewLabel}</strong><small>{language==='en'?'The interface and available actions are being shown for this role. Your real account remains unchanged.':'Η εφαρμογή και οι διαθέσιμες ενέργειες προβάλλονται για αυτόν τον ρόλο. Ο πραγματικός λογαριασμός σας δεν αλλάζει.'}</small></div></section>}
    <section className="account-drawer-identity"><div className="account-avatar"><UserRound size={21}/></div><div className="account-identity-main"><span>{isRolePreview?(language==='en'?'Real signed-in account':'Πραγματικός συνδεδεμένος λογαριασμός'):(language==='en'?'Identity':'Ταυτότητα')}</span><h3>{name}</h3><p>{email||(language==='en'?'No email provided':'Δεν έχει δηλωθεί email')}</p></div><span className="status-badge active">{language==='en'?'Active':'Ενεργός'}</span></section>
    <section className="account-drawer-info"><Mail size={16}/><div><span>Username</span><strong>{profile?.username||'—'}</strong></div></section>
    <section className="account-drawer-info"><ShieldCheck size={16}/><div><span>{language==='en'?'Access':'Πρόσβαση'}</span><strong>{tenant?.name||'Platform'} · {isRolePreview?`${previewLabel} (${language==='en'?'preview':'προεπισκόπηση'})`:actualLabel}</strong></div></section>
    {!isRolePreview&&<section className="account-drawer-security"><header><KeyRound size={17}/><div><strong>{language==='en'?'Security':'Ασφάλεια'}</strong><span>{language==='en'?'Change personal password':'Αλλαγή προσωπικού κωδικού'}</span></div></header><label><span>{language==='en'?'New password':'Νέος κωδικός'}</span><div className="password-input-wrap"><input className="input" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="password-visibility" onClick={()=>setShow(v=>!v)} aria-label={show?(language==='en'?'Hide password':'Απόκρυψη κωδικού'):(language==='en'?'Show password':'Εμφάνιση κωδικού')}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div><small>{language==='en'?'At least 12 characters.':'Τουλάχιστον 12 χαρακτήρες.'}</small></label><Button onClick={changePassword} disabled={!password}>{language==='en'?'Update password':'Ενημέρωση κωδικού'}</Button>{message&&<div className="account-message">{message}</div>}</section>}
   </div>
  </aside>
 </div>
}
