import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Eye, EyeOff, Languages, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { userFacingError } from '../../core/feedback/userFacingError'
import { APP_VERSION } from '../../core/version'

export function LoginPage() {
  const { isAuthenticated, login, hasSupabaseConfig } = useAuth()
  const { language, setLanguage } = useLanguage()
  const location = useLocation(), navigate = useNavigate()
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const requestedReturnTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'
  // Platform Owner sessions always enter through the Platform Dashboard instead of
  // restoring a stale Platform sub-route such as #reports from a previous session.
  const returnTo = requestedReturnTo.startsWith('/platform') ? '/platform' : requestedReturnTo
  if (isAuthenticated) return <Navigate to={returnTo} replace />
  const greek=language==='el'
  async function handleSubmit(event){event.preventDefault();setError('');setSubmitting(true);try{await login(identifier.trim(),password);navigate(returnTo,{replace:true})}catch(nextError){setError(userFacingError(nextError,{language,context:'login'}))}finally{setSubmitting(false)}}
  return <div className="auth-layout"><section className="auth-brand-panel"><div className="auth-brand"><span className="auth-logo">L</span><div><strong>Limoxis Observer</strong><span>Hospital Operations Platform · v{APP_VERSION}</span></div></div><div className="auth-value"><span className="eyebrow">{greek?'ΕΝΙΑΙΑ ΠΛΑΤΦΟΡΜΑ ΝΟΣΟΚΟΜΕΙΟΥ':'UNIFIED HOSPITAL PLATFORM'}</span><h1>{greek?'Η καθημερινή λειτουργία, σε ένα καθαρό και ασφαλές περιβάλλον.':'Daily hospital operations, in one clean and secure workspace.'}</h1><p>{greek?'Επιτήρηση λοιμώξεων, εργαστήριο, πρόληψη, ποιότητα και διακυβέρνηση με ενιαία λογική.':'Infection surveillance, laboratory, prevention, quality and governance with one consistent workflow.'}</p></div><div className="auth-trust"><span><ShieldCheck size={17}/>{greek?'Πρόσβαση βάσει ρόλου':'Role-based access'}</span><span><Building2 size={17}/>{greek?'Απομόνωση ανά οργανισμό':'Tenant isolation'}</span><span><CheckCircle2 size={17}/>{greek?'Πλήρης ιχνηλασιμότητα':'Audit-ready foundation'}</span></div></section><section className="auth-form-panel"><button type="button" className="auth-language" onClick={()=>setLanguage(greek?'en':'el')}><Languages size={16}/>{greek?'EN':'EL'}</button><form className="login-card" onSubmit={handleSubmit}><div className="login-heading"><span>{greek?'Καλώς ήρθατε':'Welcome back'}</span><h2>{greek?'Σύνδεση στο Limoxis Observer':'Sign in to Limoxis Observer'}</h2><p>{greek?'Συνδεθείτε με το όνομα χρήστη του λογαριασμού σας.':'Sign in with your account username.'}</p></div><Field label={greek?'Όνομα χρήστη':'Username'}><input className="input" type="text" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required /></Field><Field label={greek?'Κωδικός πρόσβασης':'Password'}><div className="password-input-wrap"><input className="input" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /><button type="button" className="password-visibility" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?(greek?'Απόκρυψη κωδικού':'Hide password'):(greek?'Εμφάνιση κωδικού':'Show password')}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></Field><div className="login-recovery-links"><Link to="/forgot-access">{greek?'Ξέχασα τον κωδικό πρόσβασης':'Forgot password'}</Link></div>{error&&<div className="form-error" role="alert">{error}</div>}<Button type="submit" disabled={submitting||!hasSupabaseConfig}>{submitting?(greek?'Σύνδεση…':'Signing in…'):(greek?'Σύνδεση':'Sign in')}</Button>{!hasSupabaseConfig&&<div className="setup-note">{greek?'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη σε αυτό το περιβάλλον.':'The sign-in service is not available in this environment.'}</div>}</form></section></div>
}