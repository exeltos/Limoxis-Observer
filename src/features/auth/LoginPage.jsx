import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Building2, CheckCircle2, Eye, EyeOff, Info, Languages, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { userFacingError } from '../../core/feedback/userFacingError'
import { APP_VERSION } from '../../core/version'
import { BrandMark } from '../../design-system/BrandMark'
import { loadLoginNotice } from './loginNoticeService'

export function LoginPage() {
  const { isAuthenticated, loading:authLoading, login, hasSupabaseConfig } = useAuth()
  const { loading:tenantLoading } = useTenant()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const [notice,setNotice]=useState(null)
  useEffect(()=>{let live=true;loadLoginNotice().then(value=>{if(live)setNotice(value)});return()=>{live=false}},[])
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const requestedReturnTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'
  const returnTo = requestedReturnTo.startsWith('/platform') ? '/platform' : requestedReturnTo

  if (authLoading || (isAuthenticated && tenantLoading)) {
    return <div className="boot-screen" role="status" aria-live="polite"><BrandMark size={50}/><span>Limoxis Observer</span></div>
  }
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const greek=language==='el'
  const maintenance=notice?(greek?(notice.noticeEl||notice.noticeEn):(notice.noticeEn||notice.noticeEl)):null
  async function handleSubmit(event){
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try{
      await login(identifier.trim(),password)
    }catch(nextError){
      setError(userFacingError(nextError,{language,context:'login'}))
    }finally{
      setSubmitting(false)
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-brand-panel" aria-label="Limoxis Observer">
        <div className="auth-brand">
          <BrandMark size={42} tone="light" className="auth-logo-mark"/>
          <div>
            <strong>Limoxis Observer</strong>
            <span>{greek?'Πλατφόρμα λειτουργίας νοσοκομείου':'Hospital Operations Platform'} · v{APP_VERSION}</span>
          </div>
        </div>

        <div className="auth-value">
          <span className="eyebrow">{greek?'ΕΝΙΑΙΑ ΠΛΑΤΦΟΡΜΑ ΝΟΣΟΚΟΜΕΙΟΥ':'UNIFIED HOSPITAL PLATFORM'}</span>
          <h1>{greek?'Ασφαλής επιτήρηση και καθημερινή λειτουργία, χωρίς περιττή πολυπλοκότητα.':'Secure surveillance and daily operations, without unnecessary complexity.'}</h1>
          <p>{greek?'Επιτήρηση λοιμώξεων, εργαστήριο, πρόληψη, ποιότητα και διακυβέρνηση σε ένα ενιαίο κλινικό περιβάλλον.':'Infection surveillance, laboratory, prevention, quality and governance in one clinical workspace.'}</p>
        </div>

        <div className="auth-trust">
          <span><ShieldCheck size={16}/>{greek?'Πρόσβαση βάσει ρόλου':'Role-based access'}</span>
          <span><Building2 size={16}/>{greek?'Απομόνωση ανά οργανισμό':'Tenant isolation'}</span>
          <span><CheckCircle2 size={16}/>{greek?'Πλήρης ιχνηλασιμότητα':'Full traceability'}</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <button type="button" className="auth-language" onClick={()=>setLanguage(greek?'en':'el')}>
          <Languages size={16}/>{greek?'EN':'EL'}
        </button>

        <div className="auth-form-column">
        <div className="auth-mobile-brand"><BrandMark size={34}/><strong>Limoxis Observer</strong></div>
        {maintenance&&<div className="login-notice" role="status"><Info size={16}/><div><strong>{greek?'Ανακοίνωση':'Notice'}</strong><p>{maintenance}</p></div></div>}
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span>{greek?'Καλώς ήρθατε':'Welcome back'}</span>
            <h2>{greek?'Σύνδεση':'Sign in'}</h2>
            <p>{greek?'Χρησιμοποιήστε τα στοιχεία του λογαριασμού σας για πρόσβαση στο Limoxis Observer.':'Use your account credentials to access Limoxis Observer.'}</p>
          </div>

          <Field label={greek?'Όνομα χρήστη':'Username'}>
            <input className="input" type="text" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required />
          </Field>

          <Field label={greek?'Κωδικός πρόσβασης':'Password'}>
            <div className="password-input-wrap">
              <input className="input" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="button" className="password-visibility" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?(greek?'Απόκρυψη κωδικού':'Hide password'):(greek?'Εμφάνιση κωδικού':'Show password')}>
                {showPassword?<EyeOff size={17}/>:<Eye size={17}/>}
              </button>
            </div>
          </Field>

          <div className="login-recovery-links">
            <Link to="/forgot-access">{greek?'Ξέχασα τον κωδικό πρόσβασης':'Forgot password'}</Link>
          </div>

          {error&&<div className="form-error" role="alert">{error}</div>}
          <Button type="submit" disabled={submitting||!hasSupabaseConfig}>
            {submitting?(greek?'Σύνδεση…':'Signing in…'):(greek?'Σύνδεση':'Sign in')}
          </Button>
          {!hasSupabaseConfig&&<div className="setup-note">{greek?'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη σε αυτό το περιβάλλον.':'The sign-in service is not available in this environment.'}</div>}
          <p className="login-security-note"><Lock size={13}/>{greek?'Πρόσβαση μόνο για εξουσιοδοτημένους χρήστες. Οι συνδέσεις και οι ενέργειες καταγράφονται.':'Authorised users only. Sign-ins and actions are logged.'}</p>
        </form>
        <footer className="auth-footer">
          <nav><Link to="/privacy">{greek?'Πολιτική απορρήτου':'Privacy policy'}</Link><Link to="/terms">{greek?'Όροι χρήσης':'Terms of use'}</Link>{notice?.supportEmail&&<a href={`mailto:${notice.supportEmail}`}>{greek?'Υποστήριξη':'Support'}</a>}</nav>
          <span>© {new Date().getFullYear()} Limoxis Observer · v{APP_VERSION}</span>
        </footer>
        </div>
      </section>
    </div>
  )

}
