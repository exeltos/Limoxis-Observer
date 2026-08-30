import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Languages, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { Field } from '../../design-system/Field'
import { useAuth } from '../../core/auth/AuthContext'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { APP_VERSION } from '../../core/version'

export function LoginPage() {
  const { isAuthenticated, login, loginDemo, allowDemo, hasSupabaseConfig } = useAuth()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />
  const greek = language === 'el'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const trimmed = identifier.trim()
      // Only the platform owner signs in with a real email; every other
      // account uses a username, resolved to its internal synthetic address.
      const authEmail = trimmed.includes('@') ? trimmed : `${trimmed}@users.limoxis.local`
      await login(authEmail, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (nextError) {
      setError(nextError.message === 'SUPABASE_NOT_CONFIGURED'
        ? (greek ? 'Δεν έχει συνδεθεί ακόμη Supabase. Χρησιμοποίησε το Demo ή πρόσθεσε τα environment keys.' : 'Supabase is not configured yet. Use Demo or add the environment keys.')
        : (greek ? 'Η σύνδεση απέτυχε. Έλεγξε το όνομα χρήστη και τον κωδικό.' : 'Sign in failed. Check your username and password.'))
    } finally { setSubmitting(false) }
  }

  return <div className="auth-layout">
    <section className="auth-brand-panel">
      <div className="auth-brand"><span className="auth-logo">L+</span><div><strong>Limoxis Observer</strong><span>Hospital Operations Platform · v{APP_VERSION}</span></div></div>
      <div className="auth-value">
        <span className="eyebrow">{greek ? 'ΕΝΙΑΙΑ ΠΛΑΤΦΟΡΜΑ ΝΟΣΟΚΟΜΕΙΟΥ' : 'UNIFIED HOSPITAL PLATFORM'}</span>
        <h1>{greek ? 'Η καθημερινή λειτουργία, σε ένα καθαρό και ασφαλές περιβάλλον.' : 'Daily hospital operations, in one clean and secure workspace.'}</h1>
        <p>{greek ? 'Επιτήρηση λοιμώξεων, εργαστήριο, πρόληψη, ποιότητα και governance με ενιαία λογική.' : 'Infection surveillance, laboratory, prevention, quality and governance with one consistent workflow.'}</p>
      </div>
      <div className="auth-trust"><span><ShieldCheck size={17}/>{greek ? 'Role-based access' : 'Role-based access'}</span><span><Building2 size={17}/>{greek ? 'Απομόνωση ανά οργανισμό' : 'Tenant isolation'}</span><span><CheckCircle2 size={17}/>{greek ? 'Audit-ready βάση' : 'Audit-ready foundation'}</span></div>
    </section>
    <section className="auth-form-panel">
      <button className="auth-language" onClick={() => setLanguage(greek ? 'en' : 'el')}><Languages size={16}/>{greek ? 'EN' : 'EL'}</button>
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-heading"><span>{greek ? 'Καλώς ήρθατε' : 'Welcome back'}</span><h2>{greek ? 'Σύνδεση στο Limoxis Observer' : 'Sign in to Limoxis Observer'}</h2><p>{greek ? 'Χρησιμοποιήστε τον λογαριασμό του οργανισμού σας.' : 'Use your organization account.'}</p></div>
        <Field label={greek ? 'Όνομα χρήστη' : 'Username'}><input className="input" type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></Field>
        <Field label={greek ? 'Κωδικός πρόσβασης' : 'Password'}><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {error && <div className="form-error">{error}</div>}
        <Button type="submit" disabled={submitting || !hasSupabaseConfig}>{submitting ? (greek ? 'Σύνδεση…' : 'Signing in…') : (greek ? 'Σύνδεση' : 'Sign in')}</Button>
        {allowDemo && <><div className="auth-separator"><span>{greek ? 'ή' : 'or'}</span></div><Button variant="secondary" onClick={loginDemo}>{greek ? 'Είσοδος στο Demo' : 'Open Demo'}</Button></>}
        {!hasSupabaseConfig && <div className="setup-note">{greek ? 'Development mode: δεν έχουν οριστεί ακόμη Supabase keys.' : 'Development mode: Supabase keys are not configured yet.'}</div>}
      </form>
    </section>
  </div>
}
