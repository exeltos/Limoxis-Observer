import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hospitalInitials, supplierCertificateRenewalEmail } from '../supabase/functions/_shared/supplierCertificateEmail.ts'

const NOW = new Date('2026-10-20T09:00:00Z')
const base = {
  organizationName: 'Γενικό Νοσοκομείο Αθηνών', supplierName: 'Ιατροτεχνική Α.Ε.', actionUrl: 'https://limoxis.example/supplier-certificate/SCR-1', expiresAt: '2026-11-03T09:00:00Z', now: NOW,
  certificates: [{ type: 'ISO 22000', number: 'FS-1', expiresOn: '2026-09-01' }, { type: 'HACCP', title: 'Σύστημα HACCP', number: 'HC-2', expiresOn: '2026-11-15', reviewComment: 'Λείπει η σελίδα 2' }],
}

describe('supplier certificate renewal e-mail', () => {
  it('leads with the hospital in the subject, the header and the sign-off', () => {
    const mail = supplierCertificateRenewalEmail(base)
    expect(mail.subject).toBe('Γενικό Νοσοκομείο Αθηνών · Ανανέωση πιστοποιητικών προμηθευτή (2)')
    expect(mail.html).toContain('class="lo-hospital" style="font-size:21px;font-weight:700;line-height:1.25;color:#172b43;')
    expect(mail.html).toContain('>ΓΝΑ</div>')
    expect(mail.html).toContain('Με εκτίμηση,<br>Γραφείο Ποιότητας<br><strong>Γενικό Νοσοκομείο Αθηνών</strong>')
    expect(mail.text).toContain('Γενικό Νοσοκομείο Αθηνών\nΓραφείο Ποιότητας · μέσω Limoxis Observer')
  })

  it('explains who writes, why, what and how, until when and what happens next', () => {
    const mail = supplierCertificateRenewalEmail(base)
    expect(mail.html).toContain('Σας γράφει το Γραφείο Ποιότητας του νοσοκομείου «Γενικό Νοσοκομείο Αθηνών» μέσω της πλατφόρμας Limoxis Observer.')
    expect(mail.html).toContain('ISO 22000 / HACCP')
    expect(mail.html).toContain('Πώς θα τα στείλετε')
    for (const step of ['Πατήστε το κουμπί «Ανέβασμα πιστοποιητικών»', 'συμπληρώστε αριθμό, φορέα έκδοσης και ημερομηνίες', 'κάποια τώρα και τα υπόλοιπα αργότερα']) expect(mail.html).toContain(step)
    expect(mail.text).toMatch(/\n1\. .*\n2\. .*\n3\. /)
    expect(mail.html).toContain('Ο σύνδεσμος ισχύει έως 03/11/2026.')
    expect(mail.html).toContain('Τι γίνεται μετά')
    expect(mail.html).toContain('Ο σύνδεσμος είναι προσωπικός: μην τον προωθήσετε. Δεν χρειάζεται λογαριασμός ή κωδικός.')
    expect(mail.html).toContain('Για απορίες επικοινωνήστε με το Γραφείο Ποιότητας του νοσοκομείου.')
    expect(mail.html).toContain('>English</div>')
    expect(mail.replyTo).toBeUndefined()
  })

  it('lists each certificate with its expiry and an «Έληξε» or «Λήγει» pill, in a bulletproof layout', () => {
    const { html, text } = supplierCertificateRenewalEmail(base)
    expect(html).toContain('<span style="color:#a23f46;font-weight:700">01/09/2026</span>')
    expect(html).toContain('<span style="color:#8a641d;font-weight:700">15/11/2026</span>')
    expect(html.match(/>Έληξε<\/span>/g)).toHaveLength(1)
    expect(html.match(/>Λήγει<\/span>/g)).toHaveLength(1)
    expect(html).toContain('HACCP · Σύστημα HACCP')
    expect(html).toContain('Σχόλιο Γραφείου Ποιότητας: Λείπει η σελίδα 2')
    expect(html).toContain('<v:roundrect')
    expect(html).toContain('max-width:600px')
    expect(html).toContain('display:none;max-height:0;overflow:hidden')
    expect(html).not.toMatch(/<link|<script/i)
    expect(text).toContain('- ISO 22000 · αρ. FS-1 · έληξε 01/09/2026')
  })

  it('the reminder has a banner with the days since the first e-mail', () => {
    const mail = supplierCertificateRenewalEmail({ ...base, kind: 'reminder', firstSentAt: '2026-10-08T09:00:00Z' })
    expect(mail.subject).toBe('Υπενθύμιση · Γενικό Νοσοκομείο Αθηνών · Ανανέωση πιστοποιητικών προμηθευτή (2)')
    expect(mail.html).toContain('<strong style="color:#8a641d">Υπενθύμιση</strong><br>Σας στείλαμε το πρώτο email πριν από 12 ημέρες')
    expect(supplierCertificateRenewalEmail(base).html).not.toContain('>Υπενθύμιση</strong>')
  })

  it('shows the hospital contact and replies to it when there is one', () => {
    const mail = supplierCertificateRenewalEmail({ ...base, organizationEmail: 'quality@hospital.gr', organizationPhone: '210 1234567' })
    expect(mail.html).toContain('<a href="mailto:quality@hospital.gr" style="color:#256b9b">quality@hospital.gr</a> · τηλ. 210 1234567')
    expect(mail.replyTo).toBe('quality@hospital.gr')
  })

  it('escapes every value', () => {
    const mail = supplierCertificateRenewalEmail({ ...base, organizationName: 'Νοσ. <b>"Α"</b>', supplierName: '<script>x</script>', certificates: [{ type: '<img src=x>', number: '"1"', expiresOn: '2026-09-01' }], actionUrl: 'https://x.example/a?b="c"' })
    expect(mail.html).not.toContain('<script>x')
    expect(mail.html).not.toContain('<img src=x>')
    expect(mail.html).not.toContain('<b>"Α"</b>')
    expect(mail.html).toContain('&lt;img src=x&gt;')
    expect(mail.html).toContain('href="https://x.example/a?b=&quot;c&quot;"')
  })

  it('initials for the badge, and the single-certificate fields of the first version', () => {
    expect(hospitalInitials('Γενικό Νοσοκομείο (δείγμα)')).toBe('ΓΝ')
    expect(hospitalInitials('Ιπποκράτειο')).toBe('Ι')
    expect(hospitalInitials('')).toBe('LO')
    const mail = supplierCertificateRenewalEmail({ organizationName: 'Νοσοκομείο', certificateType: 'ISO 9001', certificateNumber: 'Q-1', certificateExpiresOn: '2026-09-01', actionUrl: 'https://x', now: NOW })
    expect(mail.subject).toBe('Νοσοκομείο · Ανανέωση πιστοποιητικών προμηθευτή (1)')
    expect(mail.html).toContain('Ανανέωση πιστοποιητικού προμηθευτή')
  })

  it('the database sets the same subject and passes the hospital contact and the first e-mail date', () => {
    const sql = fs.readFileSync('supabase/migrations/20261130100000_quality_supplier_certificate_email_identity.sql', 'utf8')
    expect(sql).toContain("|| coalesce(nullif(v_org_name, ''), 'Limoxis Observer') || ' · Ανανέωση πιστοποιητικών προμηθευτή (' || v_count || ')';")
    expect(sql).toContain("'firstSentAt', v_row.first_sent_at);")
    expect(sql).toContain("'organizationLogo', (select case when coalesce(o.branding ->> 'logo', '') like 'data:image/%'")
    for (const fn of ['process-notification-outbox', 'platform-scheduled-tasks']) expect(fs.readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8')).toContain("...('replyTo' in message&&message.replyTo?{replyTo:message.replyTo}:{})")
  })
})
