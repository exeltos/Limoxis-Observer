import { describe, expect, it } from 'vitest'
import { publicDemoRequestEmail } from '../supabase/functions/_shared/publicDemoRequestEmail.ts'

// Το email προς τον Ιδιοκτήτη Πλατφόρμας για ένα «Ζητήστε παρουσίαση»: όλα τα στοιχεία, απάντηση στον αιτούντα,
// και κανένα HTML από τη φόρμα του επισκέπτη.
describe('publicDemoRequestEmail', () => {
  it('carries the request, replies to the requester and escapes what the visitor typed', () => {
    const mail = publicDemoRequestEmail({ fullName: 'Μαρία <b>Π</b>', organizationName: 'Νοσοκομείο Άλφα', roleTitle: 'Ιατρός', email: 'maria@example.org', phone: '210 000 0000', message: '<script>x</script>', language: 'en', actionUrl: 'https://www.limoxis.com/platform/demo-requests' })
    expect(mail.subject).toBe('Αίτημα παρουσίασης: Νοσοκομείο Άλφα')
    expect(mail.replyTo).toBe('maria@example.org')
    expect(mail.html).toContain('Μαρία &lt;b&gt;Π&lt;/b&gt;')
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('https://www.limoxis.com/platform/demo-requests')
    expect(mail.text).toContain('Ιδιότητα: Ιατρός')
    expect(mail.text).toContain('Γλώσσα: Αγγλικά')
  })
  it('does not reply to an address that is not an email', () => {
    expect(publicDemoRequestEmail({ email: 'not an email', actionUrl: '/' }).replyTo).toBeUndefined()
  })
})
