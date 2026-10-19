import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Info, Languages, Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { userFacingError } from '../../core/feedback/userFacingError'
import { APP_VERSION } from '../../core/version'
import { BrandMark } from '../../design-system/BrandMark'
import { loadLoginNotice } from './loginNoticeService'

// Decorative product preview for the brand panel (pure CSS/SVG, hidden from assistive technology).
function LoginPreview({ greek }) {
  return (
    <div className="login-preview" aria-hidden="true">
      <div className="login-preview-window">
        <div className="login-preview-bar"><i/><i/><i/><span/></div>
        <div className="login-preview-body">
          <div className="login-preview-kpis">
            <div><small>{greek?'Λοιμώξεις ‰':'HAI ‰'}</small><b>1,8</b><em>−12%</em></div>
            <div><small>{greek?'Υγιεινή χεριών':'Hand hygiene'}</small><b>92%</b><em>+4%</em></div>
          </div>
          <svg className="login-preview-chart" viewBox="0 0 280 72" preserveAspectRatio="none">
            <defs><linearGradient id="login-preview-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8fc7bd" stopOpacity=".42"/><stop offset="1" stopColor="#8fc7bd" stopOpacity="0"/></linearGradient></defs>
            <path d="M0 50 C30 44 44 56 70 46 S118 22 140 30 S190 44 212 26 S256 14 280 18 V72 H0Z" fill="url(#login-preview-fill)"/>
            <path d="M0 50 C30 44 44 56 70 46 S118 22 140 30 S190 44 212 26 S256 14 280 18" fill="none" stroke="#8fc7bd" strokeWidth="2.2" strokeLinecap="round"/>
            <circle cx="212" cy="26" r="3.6" fill="#ffffff"/>
          </svg>
          <div className="login-preview-rows"><span/><span/><span/></div>
        </div>
      </div>
      <div className="login-preview-float"><CheckCircle2 size={14}/>{greek?'Έλεγχος ολοκληρώθηκε':'Audit completed'}</div>
    </div>
  )
}

export function LoginPage() {
  const { isAuthenticated, loading:authLoading, login, hasSupabaseConfig } = useAuth()
  const { loading:tenantLoading } = useTenant()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const [notice,setNotice]=useState(null)
  useEffect(()=>{let live=true;loadLoginNotice().then(value=>{if(live)setNotice(value)});return()=>{live=false}},[])
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[capsLock,setCapsLock]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
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
  const passwordDescribedBy=[capsLock&&'login-caps-lock',error&&'login-error'].filter(Boolean).join(' ')||undefined
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
    <div className="auth-layout login-layout">
      <section className="auth-brand-panel" aria-label="Limoxis Observer">
        <div className="auth-brand">
          <BrandMark size={42} tone="light" className="auth-logo-mark"/>
          <div>
            <strong>Limoxis Observer</strong>
            <span>{greek?'Πλατφόρμα λειτουργίας νοσοκομείου':'Hospital Operations Platform'}</span>
          </div>
        </div>

        <div className="auth-value">
          <span className="login-eyebrow">{greek?'ΕΝΙΑΙΑ ΠΛΑΤΦΟΡΜΑ ΝΟΣΟΚΟΜΕΙΟΥ':'UNIFIED HOSPITAL PLATFORM'}</span>
          <h1>{greek?'Ασφαλής επιτήρηση και καθημερινή λειτουργία, χωρίς περιττή πολυπλοκότητα.':'Secure surveillance and daily operations, without unnecessary complexity.'}</h1>
          <p>{greek?'Επιτήρηση λοιμώξεων, εργαστήριο, πρόληψη, ποιότητα και διακυβέρνηση σε ένα ενιαίο κλινικό περιβάλλον.':'Infection surveillance, laboratory, prevention, quality and governance in one clinical workspace.'}</p>
          <div className="auth-trust">
            <span><ShieldCheck size={15}/>{greek?'Πρόσβαση βάσει ρόλου':'Role-based access'}</span>
            <span><Building2 size={15}/>{greek?'Απομόνωση ανά οργανισμό':'Tenant isolation'}</span>
            <span><CheckCircle2 size={15}/>{greek?'Πλήρης ιχνηλασιμότητα':'Full traceability'}</span>
          </div>
        </div>

        <LoginPreview greek={greek}/>
      </section>

      <section className="auth-form-panel">
        <button type="button" className="auth-language" onClick={()=>setLanguage(greek?'en':'el')} aria-label={greek?'Switch to English':'Αλλαγή σε Ελληνικά'}>
          <Languages size={16}/>{greek?'EN':'EL'}
        </button>

        <div className="auth-form-column">
        <div className="auth-mobile-brand"><BrandMark size={34}/><strong>Limoxis Observer</strong></div>
        {maintenance&&<div className="login-notice" role="status"><Info size={16}/><div><strong>{greek?'Ανακοίνωση':'Notice'}</strong><p>{maintenance}</p></div></div>}
        <form className="login-card" onSubmit={handleSubmit} aria-labelledby="login-title">
          <div className="login-heading">
            <span>{greek?'Καλώς ήρθατε':'Welcome back'}</span>
            <h2 id="login-title">{greek?'Σύνδεση':'Sign in'}</h2>
            <p>{greek?'Χρησιμοποιήστε τα στοιχεία του λογαριασμού σας για πρόσβαση στο Limoxis Observer.':'Use your account credentials to access Limoxis Observer.'}</p>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-identifier">{greek?'Όνομα χρήστη ή email':'Username or email'}</label>
            <div className="login-input-wrap">
              <User size={18} className="login-input-icon" aria-hidden="true"/>
              <input id="login-identifier" className="login-input" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={e=>setIdentifier(e.target.value)} aria-describedby="login-identifier-hint" aria-invalid={error?true:undefined} required />
            </div>
            <span id="login-identifier-hint" className="login-hint">{greek?'Σύνδεση με username ή email':'Sign in with your username or email'}</span>
          </div>

          <div className="login-field">
            <div className="login-label-row">
              <label className="login-label" htmlFor="login-password">{greek?'Κωδικός πρόσβασης':'Password'}</label>
              <Link className="login-forgot" to="/forgot-access">{greek?'Ξέχασα τον κωδικό πρόσβασης':'Forgot password'}</Link>
            </div>
            <div className="login-input-wrap">
              <Lock size={18} className="login-input-icon" aria-hidden="true"/>
              <input id="login-password" className="login-input" type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyUp={e=>setCapsLock(Boolean(e.getModifierState?.('CapsLock')))} onBlur={()=>setCapsLock(false)} aria-describedby={passwordDescribedBy} aria-invalid={error?true:undefined} required />
              <button type="button" className="login-visibility" onClick={()=>setShowPassword(v=>!v)} aria-controls="login-password" aria-pressed={showPassword} aria-label={showPassword?(greek?'Απόκρυψη κωδικού':'Hide password'):(greek?'Εμφάνιση κωδικού':'Show password')}>
                {showPassword?<EyeOff size={18}/>:<Eye size={18}/>}
              </button>
            </div>
            {capsLock&&<span id="login-caps-lock" className="login-caps" role="status"><AlertCircle size={14} aria-hidden="true"/>{greek?'Το Caps Lock είναι ενεργό.':'Caps Lock is on.'}</span>}
          </div>

          {error&&<div id="login-error" className="login-error" role="alert" aria-live="assertive"><AlertCircle size={17} aria-hidden="true"/><span>{error}</span></div>}
          <button type="submit" className="login-submit" disabled={submitting||!hasSupabaseConfig} aria-busy={submitting||undefined}>
            {submitting?<span className="button-spinner" aria-hidden="true"/>:null}
            <span>{submitting?(greek?'Σύνδεση…':'Signing in…'):(greek?'Σύνδεση':'Sign in')}</span>
            {!submitting&&<ArrowRight size={17} aria-hidden="true"/>}
          </button>
          {!hasSupabaseConfig&&<div className="setup-note login-setup-note" role="note"><Info size={15} aria-hidden="true"/><span>{greek?'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη σε αυτό το περιβάλλον.':'The sign-in service is not available in this environment.'}</span></div>}
          <p className="login-security-note"><ShieldCheck size={14}/>{greek?'Πρόσβαση μόνο για εξουσιοδοτημένους χρήστες. Οι συνδέσεις και οι ενέργειες καταγράφονται.':'Authorised users only. Sign-ins and actions are logged.'}</p>
        </form>
        <footer className="auth-footer">
          <nav aria-label={greek?'Νομικά και υποστήριξη':'Legal and support'}><Link to="/privacy">{greek?'Πολιτική απορρήτου':'Privacy policy'}</Link><Link to="/terms">{greek?'Όροι χρήσης':'Terms of use'}</Link>{notice?.supportEmail&&<a href={`mailto:${notice.supportEmail}`}>{greek?'Υποστήριξη':'Support'}</a>}</nav>
          <span>© {new Date().getFullYear()} Limoxis Observer · v{APP_VERSION}</span>
        </footer>
        </div>
      </section>
    </div>
  )

}
