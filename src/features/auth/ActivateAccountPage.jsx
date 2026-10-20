import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Languages, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../core/supabase/client'
import { Button } from '../../design-system/Button'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { BrandMark } from '../../design-system/BrandMark'
import { passwordRules, passwordStrength } from './passwordStrength'
import './activation.css'

// Two kinds of link open this page:
//  - ?token_hash= (a Supabase Auth invitation, or the link the admin copies): the
//    token is verified only on submit, then accept-account-invitation;
//  - ?access=ACT-… (the «Ορισμός κωδικού» e-mail of an account created from the
//    employee roster, valid 7 days, single use): redeem-access-token, which shows
//    the hospital, username, role and validity, and sets the password. No session.
const accessToken = () => new URLSearchParams(window.location.search).get('access') || ''

async function redeem(body) {
  if (!supabase) throw new Error('ACCESS_NOT_AVAILABLE')
  const { data, error } = await supabase.functions.invoke('redeem-access-token', { body })
  if (!error && data?.ok) return data
  let code = data?.code
  try {
    if (!code && error?.context && typeof error.context.json === 'function') code = (await error.context.json())?.code
  } catch {
    /* the generic message below */
  }
  throw new Error(code || 'ACCESS_NOT_AVAILABLE')
}

const when = (value, greek) =>
  value
    ? `${new Date(value).toLocaleDateString(greek ? 'el-GR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Athens' })}, ${new Date(value).toLocaleTimeString(greek ? 'el-GR' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Athens' })}`
    : ''

export function ActivateAccountPage(){
 const nav=useNavigate(),{language,setLanguage}=useLanguage(),greek=language==='el'
 const [password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(null),[saving,setSaving]=useState(false)
 const [access]=useState(accessToken),[context,setContext]=useState(null),[linkError,setLinkError]=useState('')
 const rules=passwordRules(password,confirmPassword),valid=Object.values(rules).every(Boolean),strength=passwordStrength(password,language)
 const accessMessage=code=>code==='TOO_MANY_ATTEMPTS'?(greek?'Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.':'Too many attempts. Try again in a few minutes.'):code==='ORGANIZATION_PAUSED'?(greek?'Ο οργανισμός είναι σε παύση. Επικοινωνήστε με τον διαχειριστή.':'The organization is paused. Contact the administrator.'):code==='DEMO_CLOSED'?(greek?'Το Demo έχει λήξει ή είναι σε παύση.':'The Demo has ended or is paused.'):code==='WEAK_PASSWORD'?(greek?'Ο κωδικός δεν πληροί την πολιτική.':'The password does not meet the policy.'):(greek?'Ο σύνδεσμος δεν είναι πλέον ενεργός (έληξε ή χρησιμοποιήθηκε). Ζητήστε νέο από το νοσοκομείο.':'This link is no longer active (expired or already used). Ask the hospital for a new one.')
 useEffect(()=>{if(!access)return;let live=true;redeem({action:'inspect',token:access}).then(data=>{if(live)setContext(data)},err=>{if(live)setLinkError(accessMessage(err.message))});return()=>{live=false}// eslint-disable-next-line react-hooks/exhaustive-deps
 },[access])
 async function submitAccess(){const data=await redeem({action:'activate',token:access,password});window.history.replaceState(window.history.state,'',window.location.pathname);setDone({username:data.username||context?.username||''})}
 async function submit(e){e.preventDefault();if(!valid||saving)return;setSaving(true);setError('');try{if(access){await submitAccess();return}/* A link to this page with ?token_hash= (the email button, or the link the admin copies) is verified only here, on submit: mail scanners that open the link cannot use it up, and the address stays the app's own. */const query=new URLSearchParams(window.location.search),tokenHash=query.get('token_hash');if(tokenHash){const {error:otpError}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:query.get('type')==='magiclink'?'magiclink':'invite'});if(otpError)throw new Error('INVITATION_SESSION_MISSING');/* spent: a retry after a later failure goes on with the session it opened */window.history.replaceState(window.history.state,'',window.location.pathname)}const {data:sessionData}=await supabase.auth.getSession();if(!sessionData?.session)throw new Error('INVITATION_SESSION_MISSING');const {data,error:invokeError}=await supabase.functions.invoke('accept-account-invitation',{body:{password}});if(invokeError||data?.error)throw new Error(data?.error||invokeError?.message);await supabase.auth.signOut();setDone(data)}catch(err){if(access){setError(accessMessage(err?.message));return}const missing=String(err?.message||'').includes('INVITATION_SESSION_MISSING');setError(missing?(greek?'Η πρόσκληση δεν είναι πλέον ενεργή. Ανοίξτε ξανά τον σύνδεσμο από το email ή ζητήστε νέα πρόσκληση.':'This invitation is no longer active. Open the link from the email again or request a new invitation.'):(String(err?.message||'')||(greek?'Η ενεργοποίηση απέτυχε. Δοκιμάστε ξανά.':'Activation failed. Please try again.')))}finally{setSaving(false)}}
 const role=context?[context.roleLabel,context.departmentName].filter(Boolean).join(' · '):''
 return <div className="auth-layout activation-layout"><section className="auth-brand-panel"><div className="auth-brand"><BrandMark size={42} tone="light" className="auth-logo-mark"/><div><strong>Limoxis Observer</strong><span>{greek?'Ασφαλής ενεργοποίηση λογαριασμού':'Secure account activation'}</span></div></div><div className="auth-value"><span className="eyebrow">{greek?'ΑΣΦΑΛΗΣ ΕΝΕΡΓΟΠΟΙΗΣΗ':'SECURE ACTIVATION'}</span><h1>{greek?'Ο λογαριασμός σας ενεργοποιείται από εσάς.':'You activate your own account.'}</h1><p>{greek?'Ορίστε προσωπικό κωδικό πρόσβασης. Ούτε ο ιδιοκτήτης της πλατφόρμας ούτε ο διαχειριστής του νοσοκομείου έχουν πρόσβαση στον κωδικό σας.':'Set your personal password. Neither the platform owner nor the hospital administrator can see your password.'}</p></div></section><section className="auth-form-panel"><button type="button" className="auth-language" onClick={()=>setLanguage(greek?'en':'el')}><Languages size={16}/>{greek?'EN':'EL'}</button><form className="login-card" onSubmit={submit}>{done?<><CheckCircle2 size={34}/><div className="login-heading"><span>{greek?'Ολοκληρώθηκε':'Completed'}</span><h2>{greek?'Ο λογαριασμός ενεργοποιήθηκε':'Your account is active'}</h2>{done.username&&<p>{greek?'Όνομα χρήστη':'Username'}: <strong>{done.username}</strong></p>}</div><Button type="button" onClick={()=>nav('/login')}>{greek?'Μετάβαση στη σύνδεση':'Go to sign in'}</Button></>:<><div className="login-heading"><span>{greek?'Αποδοχή πρόσκλησης':'Accept invitation'}</span><h2>{greek?'Ορισμός κωδικού πρόσβασης':'Set your password'}</h2><p>{greek?'Ο κωδικός πρέπει να πληροί όλες τις απαιτήσεις ασφαλείας.':'Your password must meet all security requirements.'}</p></div>{access&&linkError&&<div className="form-error" role="alert">{linkError}</div>}{context&&<div className="activation-context"><div><span>{greek?'Νοσοκομείο':'Hospital'}</span><strong>{context.organizationName}</strong></div><div><span>{greek?'Όνομα χρήστη':'Username'}</span><strong><code>{context.username}</code></strong></div>{role&&<div><span>{greek?'Ρόλος':'Role'}</span><strong>{role}</strong></div>}<div><span>{greek?'Ο σύνδεσμος ισχύει έως':'The link is valid until'}</span><strong>{when(context.expiresAt,greek)}</strong></div></div>}<label className="field"><span>{greek?'Νέος κωδικός':'New password'}</span><div className="password-input-wrap"><input className="input" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" className="password-visibility" onClick={()=>setShow(v=>!v)} aria-label={show?(greek?'Απόκρυψη κωδικού':'Hide password'):(greek?'Εμφάνιση κωδικού':'Show password')}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><label className="field"><span>{greek?'Επιβεβαίωση κωδικού':'Confirm password'}</span><input className="input" type={show?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password"/></label>{password&&<div className={`password-strength is-${strength.level}`} aria-live="polite"><div className="password-strength-bar">{[1,2,3,4].map(step=><i key={step} className={step<=strength.score?'on':''}/>)}</div><small>{greek?'Ισχύς':'Strength'}: {strength.label}{strength.hint?` · ${strength.hint}`:''}</small></div>}<div className="password-policy"><ShieldCheck size={17}/><div><strong>{greek?'Πολιτική κωδικού':'Password policy'}</strong><span className={rules.length?'ok':''}>{greek?'12–128 χαρακτήρες':'12–128 characters'}</span><span className={rules.upper&&rules.lower?'ok':''}>{greek?'Κεφαλαίο και πεζό γράμμα':'Uppercase and lowercase letter'}</span><span className={rules.number?'ok':''}>{greek?'Τουλάχιστον ένας αριθμός':'At least one number'}</span><span className={rules.symbol?'ok':''}>{greek?'Τουλάχιστον ένα σύμβολο':'At least one symbol'}</span><span className={rules.match?'ok':''}>{greek?'Οι κωδικοί ταιριάζουν':'Passwords match'}</span></div></div>{error&&<div className="form-error" role="alert">{error}</div>}<Button type="submit" disabled={!valid||saving||Boolean(access&&!context)}>{saving?(greek?'Ενεργοποίηση…':'Activating…'):(greek?'Ενεργοποίηση λογαριασμού':'Activate account')}</Button></>}</form></section></div>
}
