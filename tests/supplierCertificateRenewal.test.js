import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filterRenewals, latestRequestByCertificate, linkState, recipientsFor, renewalCounts, renewalQueue, requestFromRow, sendItems, submissionProblems, submissionProblemText, submitErrorMessage } from '../src/features/quality/resources/supplierRenewalModel'
import { demoRequests } from '../src/features/quality/resources/supplierRenewalService'
import { demoResources } from '../src/features/quality/resources/resourceDemoData'

const TODAY = '2026-10-19'
const read = path => fs.readFileSync(path, 'utf8')
const supplier = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: `Supplier ${id}`, status: 'active', email: '', contacts: [], certifications: [], ...extra })
const cert = (id, expiresOn, extra = {}) => ({ id, type: 'ISO 9001', title: '', number: `N-${id}`, issuer: 'Body', expiresOn, ...extra })
const request = (id, certificationId, status, extra = {}) => ({ id, certificationId, status, requestedAt: '2026-10-01T10:00:00Z', recipientEmail: 'a@b.gr', tokenExpiresAt: '', ...extra })

describe('Supplier certificate renewal: the queue', () => {
  const suppliers = [
    supplier('s1', { email: ' Quality@Supplier.GR ', contacts: [{ email: 'orders@supplier.gr' }, { email: 'quality@supplier.gr' }, { email: 'not-an-email' }], certifications: [cert('c1', '2026-09-30'), cert('c2', '2026-11-30'), cert('c3', '2028-01-01')] }),
    supplier('s2', { certifications: [cert('c4', '2026-10-01')] }),
    supplier('s3', { status: 'inactive', email: 'x@y.gr', certifications: [cert('c5', '2026-01-01')] }),
  ]

  it('takes the supplier e-mail first, then the contacts, valid and once each', () => {
    expect(recipientsFor(suppliers[0])).toEqual(['quality@supplier.gr', 'orders@supplier.gr'])
    expect(recipientsFor(suppliers[1])).toEqual([])
  })

  it('lists the expired certificates of active suppliers (and the expiring ones on request), most overdue first', () => {
    expect(renewalQueue(suppliers, [], { today: TODAY }).map(row => row.key)).toEqual(['c1', 'c4'])
    const all = renewalQueue(suppliers, [], { expiring: true, today: TODAY })
    expect(all.map(row => [row.key, row.state])).toEqual([['c1', 'expired'], ['c4', 'expired'], ['c2', 'expiring']])
    expect(all[0]).toMatchObject({ supplierName: 'Supplier s1', recipient: 'quality@supplier.gr', selectable: true, days: -19 })
    // No address: still selectable, the address is typed in the approval; not counted as ready.
    expect(all[1]).toMatchObject({ recipients: [], recipient: '', selectable: true })
  })

  it('a certificate with a request in progress cannot be selected again; a submitted one stays listed', () => {
    const requests = [request('r1', 'c1', 'sent', { recipientEmail: 'orders@supplier.gr' }), request('r2', 'c3', 'submitted')]
    const rows = renewalQueue(suppliers, requests, { today: TODAY })
    expect(rows.map(row => row.key)).toEqual(['c1', 'c4', 'c3'])
    expect(rows[0]).toMatchObject({ selectable: false, recipient: 'orders@supplier.gr' })
    expect(rows[2].request.id).toBe('r2')
    const counts = renewalCounts(rows, requests)
    expect(counts).toMatchObject({ expired: 2, toSend: 0, noEmail: 1, sent: 1, submitted: 1 })
  })

  it('keeps the open request of a certificate over a newer closed one', () => {
    const latest = latestRequestByCertificate([request('old', 'c1', 'rejected', { requestedAt: '2026-10-05T00:00:00Z' }), request('open', 'c1', 'sent', { requestedAt: '2026-10-02T00:00:00Z' }), request('a', 'c2', 'accepted', { requestedAt: '2026-01-01T00:00:00Z' }), request('b', 'c2', 'rejected', { requestedAt: '2026-02-01T00:00:00Z' })])
    expect(latest.get('c1').id).toBe('open')
    expect(latest.get('c2').id).toBe('b')
  })

  it('filters by text, certificate state and request', () => {
    const rows = renewalQueue(suppliers, [request('r1', 'c1', 'sent')], { expiring: true, today: TODAY })
    expect(filterRenewals(rows, { query: 's2' }).map(row => row.key)).toEqual(['c4'])
    expect(filterRenewals(rows, { state: 'expiring' }).map(row => row.key)).toEqual(['c2'])
    expect(filterRenewals(rows, { request: 'none' }).map(row => row.key)).toEqual(['c4', 'c2'])
    expect(filterRenewals(rows, { request: 'sent' }).map(row => row.key)).toEqual(['c1'])
  })

  it('sends one item per selected certificate without a request, with the typed address', () => {
    const rows = renewalQueue(suppliers, [request('r1', 'c4', 'proposed')], { expiring: true, today: TODAY })
    expect(sendItems(rows, ['c1', 'c4', 'c2'], { c2: ' New@Mail.gr ' })).toEqual([
      { certification_id: 'c1', recipient_email: 'quality@supplier.gr' },
      { certification_id: 'c2', recipient_email: 'new@mail.gr' },
    ])
  })

  it('tells an open link from an expired one', () => {
    const now = new Date('2026-10-19T12:00:00Z')
    expect(linkState(null, now)).toBe('none')
    expect(linkState({ status: 'sent', tokenExpiresAt: '2026-10-25T00:00:00Z' }, now)).toBe('open')
    expect(linkState({ status: 'sent', tokenExpiresAt: '2026-10-18T00:00:00Z' }, now)).toBe('expired')
    expect(linkState({ status: 'submitted' }, now)).toBe('submitted')
  })

  it('reads a request row with its submission and file', () => {
    const item = requestFromRow({ id: 'r', supplier_id: 's', certification_id: 'c', recipient_email: 'a@b.gr', status: 'submitted', certificate_snapshot: { certificate_type: 'ISO 9001' }, requested_at: '2026-10-01', send_count: 2, certificate_type: 'ISO 9001', certificate_number: 'X-2', issuer: 'TÜV', issued_on: '2026-09-01', expires_on: '2029-09-01', note: 'n', attachment: { id: 'f', file_name: 'iso.pdf', storage_path: 'o/quality_supplier/s/1-iso.pdf', mime_type: 'application/pdf', size_bytes: 100 } })
    expect(item).toMatchObject({ certificationId: 'c', sendCount: 2, submitted: { number: 'X-2', issuer: 'TÜV', expiresOn: '2029-09-01' }, attachment: { name: 'iso.pdf', storagePath: 'o/quality_supplier/s/1-iso.pdf' } })
  })
})

describe('Supplier certificate renewal: the supplier form', () => {
  const pdf = { name: 'iso.pdf', size: 2048, type: 'application/pdf' }
  const form = { type: 'ISO 9001', number: 'QM-1', issuer: '', issuedOn: '2026-10-01', expiresOn: '2029-10-01', note: '' }
  it('accepts a complete form with a PDF', () => { expect(submissionProblems(form, pdf, TODAY)).toEqual([]) })
  it('needs type, number, a future expiry and the file', () => {
    expect(submissionProblems({}, null, TODAY)).toEqual(['type', 'number', 'expiresOn', 'file'])
    expect(submissionProblems({ ...form, expiresOn: TODAY }, pdf, TODAY)).toEqual(['expiresFuture'])
    expect(submissionProblems({ ...form, issuedOn: '2026-12-01' }, pdf, TODAY)).toEqual(['issuedOn'])
  })
  it('takes a PDF or an image up to 10 MB', () => {
    expect(submissionProblems(form, { ...pdf, size: 11 * 1024 * 1024 }, TODAY)).toEqual(['fileSize'])
    expect(submissionProblems(form, { ...pdf, type: 'application/zip' }, TODAY)).toEqual(['fileType'])
    expect(submissionProblems(form, { ...pdf, type: 'image/png' }, TODAY)).toEqual([])
    expect(submissionProblemText(['type', 'fileSize'], 'en')).toEqual(['certificate type', 'a file up to 10 MB'])
  })
  it('explains the answers of the edge function', () => {
    expect(submitErrorMessage('SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED', 'en')).toMatch(/already been submitted/)
    expect(submitErrorMessage('SOMETHING', 'el')).toMatch(/Δοκιμάστε ξανά/)
  })
})

describe('Supplier certificate renewal: demo, database and e-mail', () => {
  it('the demo requests point at certificates of the demo suppliers', () => {
    const certs = new Map(demoResources().suppliers.flatMap(item => item.certifications.map(c => [c.id, item.id])))
    for (const item of demoRequests()) expect(certs.get(item.certificationId)).toBe(item.supplierId)
    expect(demoRequests().map(item => item.status)).toEqual(['submitted', 'sent'])
  })

  it('stores only the token hash, sends nothing without approval and keeps the replaced values', () => {
    const sql = read('supabase/migrations/20261128200000_quality_supplier_certificate_requests.sql')
    expect(sql).toContain("token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expires_at = now() + interval '14 days'")
    expect(sql).toContain("case when coalesce(p_send, true) then 'approved' else 'proposed' end")
    expect(sql).toMatch(/if coalesce\(p_send, true\) then\s+if not private\.quality_supplier_certificate_can_manage\(p_organization_id\)/)
    expect(sql).toContain("previous_values = jsonb_build_object('certificate_type', v_cert.certificate_type")
    expect(sql).toContain("'supplier_certificate_renewal', 'quality_supplier_certificate_request'")
    expect(sql).toContain('grant execute on function public.quality_supplier_certificate_access(text) to anon, authenticated;')
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/i)
    const manifest = JSON.parse(read('supabase/security-definer-manifest.json')).functions
    expect(manifest.quality_supplier_certificate_access).toMatchObject({ category: 'public-token', anon: true })
    expect(manifest.quality_supplier_certificate_requests_create).toMatchObject({ category: 'rpc', authenticated: true })
  })

  it('the outbox knows the renewal e-mail and the public upload runs without a JWT', () => {
    const outbox = read('supabase/functions/process-notification-outbox/index.ts')
    expect(outbox).toContain("'supplier_certificate_renewal'")
    expect(outbox).toContain('supplierCertificateRenewalEmail(')
    expect(read('supabase/config.toml')).toMatch(/\[functions\.supplier-certificate-submit\]\s*verify_jwt = false/)
    const submit = read('supabase/functions/supplier-certificate-submit/index.ts')
    expect(submit).toContain(".eq('token_hash',hash).eq('status','sent')")
    expect(submit).toContain("entity_type:'quality_supplier'")
    expect(submit).toContain("category:'certification'")
  })
})
