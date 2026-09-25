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
  it('routes the legal pages publicly', () => {
    expect(app).toContain('<Route path="/privacy" element={<LegalPage kind="privacy"/>}/>')
    expect(app).toContain('<Route path="/terms" element={<LegalPage kind="terms"/>}/>')
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
