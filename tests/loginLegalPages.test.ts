import { describe, expect, it } from 'vitest'
import { legalContent } from '../src/features/legal/legalContent'
import { readSource } from './helpers/readSource'

const login = readSource('src/features/auth/LoginPage.jsx')
const app = readSource('src/app/App.jsx')
const migration = readSource('supabase/migrations/20260925180000_public_login_notice.sql')

describe('login page and public legal pages', () => {
  it('uses the brand mark and links privacy, terms and support', () => {
    expect(login).toContain('<BrandMark')
    expect(login).not.toContain('className="auth-logo">L<')
    expect(login).toContain('to="/privacy"')
    expect(login).toContain('to="/terms"')
    expect(login).toContain('mailto:${notice.supportEmail}')
  })
  it('keeps username sign-in (an email still works, unannounced), recovery, caps lock and an announced error', () => {
    expect(login).toContain("{greek?'Όνομα χρήστη':'Username'}")
    expect(login).not.toContain('email\'')
    expect(login).toContain('autoComplete="username"')
    expect(login).toContain("getModifierState?.('CapsLock')")
    expect(login).toContain('to="/forgot-access"')
    expect(login).toContain('id="login-error" className="login-error" role="alert"')
    expect(login).toContain('disabled={submitting||!hasSupabaseConfig}')
    // Το CSS των σελίδων σύνδεσης φορτώνεται με τις σελίδες (src/features/auth/authPages.css).
    const loginCss = readSource('src/features/auth/authPages.css')
    expect(login).toContain("import './authPages.css'")
    // Η μείωση κίνησης μένει στο κοινό CSS (ισχύει πριν φορτώσει η σελίδα).
    const css = readSource('src/styles/features.css') + loginCss
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\s*\.login-layout \.auth-brand-panel::before,\.login-preview-float,\.login-error\{animation:none\}/)
    expect(loginCss).not.toContain('!important')
  })
  it('routes the legal pages publicly', () => {
    expect(app).toContain('<Route path="/privacy" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="privacy"/></Suspense>}/>')
    expect(app).toContain('<Route path="/terms" element={<Suspense fallback={<RouteLoading/>}><LegalPage kind="terms"/></Suspense>}/>')
  })
  it('has Greek and English texts for every legal page', () => {
    for (const kind of ['privacy', 'terms']) for (const lang of ['el', 'en']) {
      expect(legalContent[kind][lang].title).toBeTruthy()
      expect(legalContent[kind][lang].sections.length).toBeGreaterThan(3)
    }
  })
  it('exposes only the public notice fields to anonymous users', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('case when s.maintenance_notice_enabled')
    expect(migration).toContain('grant execute on function public.public_login_notice() to anon, authenticated')
    expect(migration).not.toMatch(/default_demo_duration_days|updated_by/)
  })
})
