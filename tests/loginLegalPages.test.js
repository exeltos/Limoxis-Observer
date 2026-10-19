import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { legalContent } from '../src/features/legal/legalContent'

const login = fs.readFileSync('src/features/auth/LoginPage.jsx', 'utf8')
const app = fs.readFileSync('src/app/App.jsx', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260925180000_public_login_notice.sql', 'utf8')

describe('login page and public legal pages', () => {
  it('uses the brand mark and links privacy, terms and support', () => {
    expect(login).toContain('<BrandMark')
    expect(login).not.toContain('className="auth-logo">L<')
    expect(login).toContain('to="/privacy"')
    expect(login).toContain('to="/terms"')
    expect(login).toContain('mailto:${notice.supportEmail}')
  })
  it('keeps username-or-email sign-in, recovery, caps lock and an announced error', () => {
    expect(login).toContain("'Σύνδεση με username ή email'")
    expect(login).toContain('autoComplete="username"')
    expect(login).toContain("getModifierState?.('CapsLock')")
    expect(login).toContain('to="/forgot-access"')
    expect(login).toContain('id="login-error" className="login-error" role="alert"')
    expect(login).toContain('disabled={submitting||!hasSupabaseConfig}')
    const css = fs.readFileSync('src/styles/features.css', 'utf8')
    const loginCss = css.slice(css.indexOf('.auth-layout.login-layout{'), css.indexOf('.training-material-list{'))
    expect(loginCss).toContain('@media (prefers-reduced-motion:reduce)')
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
