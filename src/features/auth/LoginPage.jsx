import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Building2, CheckCircle2, Eye, EyeOff, Languages, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { useAuth } from '../../core/auth/AuthContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { userFacingError } from '../../core/feedback/userFacingError'
import { APP_VERSION } from '../../core/version'

export function LoginPage() {
  const { isAuthenticated, loading:authLoading, login, loginDemo, hasSupabaseConfig, allowDemo } = useAuth()
  const { loading:tenantLoading } = useTenant()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const requestedReturnTo = typeof location.state?.from === 'string' && location.state.from.startsWith('/') && !location.state.from.startsWith('//')
    ? location.state.from
    : '/'
  const returnTo = requestedReturnTo.startsWith('/platform') ? '/platform' : requestedReturnTo

  if (authLoading || (isAuthenticated && tenantLoading)) {
    return <div className="boot-screen" role="status" aria-live="polite"><div className="boot-mark">L+</div><span>Limoxis Observer</span></div>
  }
  if (isAuthenticated) return <Navigate to={returnTo} replace />

  const greek=language==='el'
  function handleDemo(){
    setError('')
    try{ loginDemo() }catch(nextError){ setError(userFacingError(nextError,{language,context:'login'})) }
  }
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
          <span className="auth-logo">L</span>
          <div>
            <strong>Limoxis Observer</strong>
            <span>Hospital Operations Platform · v{APP_VERSION}</span>
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
          {allowDemo&&<div className="login-demo-entry"><span>{greek?'ή δοκιμάστε την πλήρη πλατφόρμα':'or explore the full platform'}</span><Button type="button" variant="secondary" onClick={handleDemo}>{greek?'Είσοδος Demo':'Enter Demo'}</Button><small>{greek?'Πλήρη συνθετικά δεδομένα · οι αλλαγές επανέρχονται με ανανέωση της σελίδας':'Full synthetic dataset · changes reset when the page is refreshed'}</small></div>}
          {!hasSupabaseConfig&&<div className="setup-note">{greek?'Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη σε αυτό το περιβάλλον.':'The sign-in service is not available in this environment.'}</div>}
        </form>
      </section>
    </div>
  )

}
