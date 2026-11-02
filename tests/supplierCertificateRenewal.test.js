import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { accessComplete, filterRenewals, latestItemByCertificate, linkState, noResponseDays, pendingItems, recipientsFor, renewalCounts, renewalGroups, renewalPermissions, renewalQueue, requestFromRow, sendGroups, sendItems, senderOnlyHint, submissionProblems, submissionProblemText, submitErrorMessage } from '../src/features/quality/resources/supplierRenewalModel'
import { demoRequests, demoSupplierAccess, isDemoAccessToken } from '../src/features/quality/resources/supplierRenewalService'
import { demoResources } from '../src/features/quality/resources/resourceDemoData'
import { ADD_ON_CAPABILITIES, CAPABILITIES, ROLES, can, isCustomRoleEligible } from '../src/core/permissions/roles'

const TODAY = '2026-10-19'
const NOW = new Date('2026-10-19T12:00:00Z')
const read = path => fs.readFileSync(path, 'utf8')
const supplier = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: `Supplier ${id}`, status: 'active', email: '', contacts: [], certifications: [], ...extra })
const cert = (id, expiresOn, extra = {}) => ({ id, type: 'ISO 9001', title: '', number: `N-${id}`, issuer: 'Body', expiresOn, ...extra })
const item = (id, certificationId, status, extra = {}) => ({ id, certificationId, status, submittedAt: '', ...extra })
const request = (id, supplierId, status, items, extra = {}) => ({ id, supplierId, status, requestedAt: '2026-10-01T10:00:00Z', recipientEmail: 'a@b.gr', tokenExpiresAt: '', firstSentAt: '', items, ...extra })

describe('Supplier certificate renewal: the queue by supplier', () => {
  const suppliers = [
    supplier('s1', { email: ' Quality@Supplier.GR ', contacts: [{ email: 'orders@supplier.gr' }, { email: 'quality@supplier.gr' }, { email: 'not-an-email' }], certifications: [cert('c1', '2026-09-30'), cert('c2', '2026-11-30'), cert('c3', '2028-01-01'), cert('c6', '2026-08-01')] }),
    supplier('s2', { certifications: [cert('c4', '2026-10-01')] }),
    supplier('s3', { status: 'inactive', email: 'x@y.gr', certifications: [cert('c5', '2026-01-01')] }),
  ]

  it('takes the supplier e-mail first, then the contacts, valid and once each', () => {
    expect(recipientsFor(suppliers[0])).toEqual(['quality@supplier.gr', 'orders@supplier.gr'])
    expect(recipientsFor(suppliers[1])).toEqual([])
  })

  it('lists the expired certificates of active suppliers (and the expiring ones), most overdue first, grouped by supplier', () => {
    expect(renewalQueue(suppliers, [], { today: TODAY }).map(row => row.key)).toEqual(['c6', 'c1', 'c4'])
    const rows = renewalQueue(suppliers, [], { expiring: true, today: TODAY })
    const groups = renewalGroups(rows, NOW)
    expect(groups.map(group => [group.supplierId, group.rows.map(row => row.key)])).toEqual([['s1', ['c6', 'c1', 'c2']], ['s2', ['c4']]])
    expect(groups[0]).toMatchObject({ recipient: 'quality@supplier.gr', expired: 2, request: null, noResponse: null })
    expect(groups[0].selectable.map(row => row.key)).toEqual(['c6', 'c1', 'c2'])
    // No address: still selectable, the address is typed in the approval; not counted as ready.
    expect(renewalCounts(groups, [], NOW)).toMatchObject({ expired: 3, suppliers: 2, toSend: 1, noEmail: 1 })
  })

  it('a certificate with an item in progress cannot be selected again; a submitted one stays listed', () => {
    const requests = [request('r1', 's1', 'sent', [item('i1', 'c1', 'pending'), item('i2', 'c3', 'submitted', { submittedAt: '2026-10-18' })], { recipientEmail: 'orders@supplier.gr', firstSentAt: '2026-10-15T10:00:00Z' })]
    const rows = renewalQueue(suppliers, requests, { today: TODAY })
    expect(rows.map(row => row.key)).toEqual(['c6', 'c1', 'c4', 'c3'])
    expect(rows[1]).toMatchObject({ selectable: false, recipient: 'orders@supplier.gr' })
    expect(rows[0]).toMatchObject({ selectable: true, recipient: 'quality@supplier.gr' })
    const groups = renewalGroups(rows, NOW)
    expect(groups[0]).toMatchObject({ supplierId: 's1', submitted: 1, recipient: 'orders@supplier.gr' })
    expect(groups[0].request.id).toBe('r1')
    expect(renewalCounts(groups, requests, NOW)).toMatchObject({ expired: 3, toSend: 1, sent: 1, submitted: 1, noResponse: 0 })
  })

  it('keeps the item in progress of a certificate over a newer closed one', () => {
    const latest = latestItemByCertificate([
      request('old', 's1', 'closed', [item('a', 'c1', 'rejected')], { requestedAt: '2026-10-05T00:00:00Z' }),
      request('open', 's1', 'sent', [item('b', 'c1', 'pending')], { requestedAt: '2026-10-02T00:00:00Z' }),
      request('x', 's1', 'closed', [item('c', 'c2', 'accepted')], { requestedAt: '2026-01-01T00:00:00Z' }),
      request('y', 's1', 'closed', [item('d', 'c2', 'rejected')], { requestedAt: '2026-02-01T00:00:00Z' }),
    ])
    expect(latest.get('c1').id).toBe('b')
    expect(latest.get('c1').request.id).toBe('open')
    expect(latest.get('c2').id).toBe('d')
  })

  it('shows «no answer» for a sent request with nothing submitted after 7 days', () => {
    const sent = days => request('r', 's1', 'sent', [item('i', 'c1', 'pending')], { firstSentAt: new Date(NOW.getTime() - days * 86400000).toISOString() })
    expect(noResponseDays(sent(6), NOW)).toBe(null)
    expect(noResponseDays(sent(7), NOW)).toBe(7)
    expect(noResponseDays(sent(12), NOW)).toBe(12)
    expect(noResponseDays({ ...sent(12), items: [item('i', 'c1', 'submitted', { submittedAt: '2026-10-10' })] }, NOW)).toBe(null)
    expect(noResponseDays({ ...sent(12), status: 'proposed' }, NOW)).toBe(null)
  })

  it('filters by text, certificate state, request and «no answer»', () => {
    const requests = [request('r1', 's2', 'sent', [item('i1', 'c4', 'pending')], { firstSentAt: '2026-10-05T10:00:00Z' })]
    const groups = renewalGroups(renewalQueue(suppliers, requests, { expiring: true, today: TODAY }), NOW)
    expect(filterRenewals(groups, { query: 's2' }).map(group => group.key)).toEqual(['s2'])
    expect(filterRenewals(groups, { query: 'N-c2' }).map(group => group.key)).toEqual(['s1'])
    expect(filterRenewals(groups, { state: 'expiring' }).map(group => [group.key, group.rows.map(row => row.key)])).toEqual([['s1', ['c2']], ['s2', ['c4']]])
    expect(filterRenewals(groups, { request: 'none' }).map(group => group.key)).toEqual(['s1'])
    expect(filterRenewals(groups, { request: 'sent' }).map(group => group.key)).toEqual(['s2'])
    expect(filterRenewals(groups, { request: 'no_response' }).map(group => [group.key, group.noResponse])).toEqual([['s2', 14]])
  })

  it('sends one item per selected certificate without an item in progress, with the address of its supplier', () => {
    const rows = renewalQueue(suppliers, [request('r1', 's2', 'proposed', [item('i', 'c4', 'pending')])], { expiring: true, today: TODAY })
    expect(sendItems(rows, ['c1', 'c4', 'c2'], { s1: ' New@Mail.gr ' })).toEqual([
      { certification_id: 'c1', recipient_email: 'new@mail.gr' },
      { certification_id: 'c2', recipient_email: 'new@mail.gr' },
    ])
    expect(sendGroups(rows, ['c6', 'c1', 'c2', 'c4']).map(group => [group.supplierId, group.rows.map(row => row.key)])).toEqual([['s1', ['c6', 'c1', 'c2']]])
  })

  it('tells an open link from an expired one', () => {
    expect(linkState(null, NOW)).toBe('none')
    expect(linkState({ status: 'sent', tokenExpiresAt: '2026-10-25T00:00:00Z' }, NOW)).toBe('open')
    expect(linkState({ status: 'sent', tokenExpiresAt: '2026-10-18T00:00:00Z' }, NOW)).toBe('expired')
    expect(linkState({ status: 'closed' }, NOW)).toBe('closed')
  })

  it('reads a request row with its items, submissions and files', () => {
    const value = requestFromRow({ id: 'r', supplier_id: 's', recipient_email: 'a@b.gr', status: 'sent', requested_at: '2026-10-01', sent_at: '2026-10-02', send_count: 2, reminder_count: 1, send_history: [{ kind: 'send' }, { kind: 'reminder' }],
      items: [{ id: 'i', request_id: 'r', certification_id: 'c', status: 'submitted', certificate_snapshot: { certificate_type: 'ISO 9001' }, certificate_type: 'ISO 9001', certificate_number: 'X-2', issuer: 'TÜV', issued_on: '2026-09-01', expires_on: '2029-09-01', note: 'n', attachment: { id: 'f', file_name: 'iso.pdf', storage_path: 'o/quality_supplier/s/1-iso.pdf', mime_type: 'application/pdf', size_bytes: 100 } }] })
    expect(value).toMatchObject({ supplierId: 's', sendCount: 2, reminderCount: 1, firstSentAt: '2026-10-02', history: [{ kind: 'send' }, { kind: 'reminder' }] })
    expect(value.items[0]).toMatchObject({ certificationId: 'c', supplierId: 's', submitted: { number: 'X-2', issuer: 'TÜV', expiresOn: '2029-09-01' }, attachment: { name: 'iso.pdf', storagePath: 'o/quality_supplier/s/1-iso.pdf' } })
  })
})

describe('Supplier certificate renewal: who may send', () => {
  it('the Platform Owner, Hospital Admin, Quality Manager and members with the add-on send; others propose', () => {
    expect(can(ROLES.PLATFORM_OWNER, CAPABILITIES.SEND_SUPPLIER_RENEWALS)).toBe(true)
    for (const role of [ROLES.HOSPITAL_ADMIN, ROLES.QUALITY_MANAGER]) expect(can(role, CAPABILITIES.SEND_SUPPLIER_RENEWALS)).toBe(true)
    for (const role of [ROLES.INFECTION_CONTROL_LEAD, ROLES.HOSPITAL_DIRECTOR]) expect(can(role, CAPABILITIES.SEND_SUPPLIER_RENEWALS)).toBe(false)
    expect(can(ROLES.QUALITY_MANAGER, CAPABILITIES.SEND_SUPPLIER_RENEWALS, [ADD_ON_CAPABILITIES.SUPPLIER_RENEWAL_SENDER])).toBe(true)
    expect(can(ROLES.DEPARTMENT_USER, CAPABILITIES.SEND_SUPPLIER_RENEWALS, [ADD_ON_CAPABILITIES.SUPPLIER_RENEWAL_SENDER])).toBe(true)
    expect(isCustomRoleEligible(CAPABILITIES.SEND_SUPPLIER_RENEWALS)).toBe(false)
    expect(renewalPermissions({ canManage: true, canView: true })).toEqual({ send: false, review: true, propose: true, cancel: true })
    expect(renewalPermissions({ canView: true })).toEqual({ send: false, review: false, propose: true, cancel: false })
    expect(renewalPermissions({ canSend: true, canView: true })).toMatchObject({ send: true, propose: true, cancel: true })
    expect(renewalPermissions({ owner: true })).toEqual({ send: true, review: true, propose: true, cancel: true })
    expect(senderOnlyHint('el')).toBe('Μόνο ο διαχειριστής, ο υπεύθυνος ποιότητας ή όσοι έχει ορίσει ο Ιδιοκτήτης')
  })

  it('the database checks the same: Platform Owner or the add-on, granted by the Platform Owner only', () => {
    const sql = read('supabase/migrations/20261129100000_quality_supplier_certificate_request_items.sql')
    const later = read('supabase/migrations/20261213100000_quality_supplier_renewals_auto.sql')
    expect(later).toContain("m.role = any (array['hospital_admin', 'quality_manager']::public.app_role[])")
    expect(later).toContain("and c.capability = 'supplier_renewal_sender' and c.effect = 'grant');")
    expect(later).toContain("auth.uid() is null and coalesce(current_setting('limoxis.supplier_renewal_auto', true), '') = 'on'")
    expect(later).toContain('auto_enabled boolean not null default false')
    expect(sql).toMatch(/if v_send then\s+if not private\.quality_supplier_renewal_can_send\(p_organization_id\)/)
    expect(sql).toMatch(/if p_action in \('approve', 'resend', 'remind'\) then\s+if not private\.quality_supplier_renewal_can_send\(v_row\.organization_id\)/)
    expect(sql).toMatch(/if coalesce\(p_resend, false\) then\s+if not private\.quality_supplier_renewal_can_send\(v_item\.organization_id\)/)
    expect(sql).toMatch(/set_member_supplier_renewal_sender[\s\S]*if auth\.uid\(\) is null or not public\.current_user_is_platform_owner\(\) then/)
    expect(read('src/features/management/ManagementUsersPanel.jsx')).toContain('ownerTools={isPlatformOwner&&!isRolePreview}')
    expect(read('src/features/platform/PlatformOrganizationUserRecord.jsx')).toContain('<SupplierRenewalSenderField')
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
  it('knows what is left on the link', () => {
    const access = { status: 'sent', items: [{ id: 'a', status: 'submitted' }, { id: 'b', status: 'pending' }] }
    expect(pendingItems(access).map(entry => entry.id)).toEqual(['b'])
    expect(accessComplete(access)).toBe(false)
    expect(accessComplete({ ...access, items: [{ id: 'a', status: 'submitted' }] })).toBe(true)
    expect(accessComplete({ status: 'closed', items: [] })).toBe(true)
  })
  it('explains the answers of the edge function', () => {
    expect(submitErrorMessage('SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED', 'en')).toMatch(/already been submitted/)
    expect(submitErrorMessage('SUPPLIER_CERTIFICATE_ITEM_NOT_AVAILABLE', 'el')).toMatch(/δεν ζητείται πια/)
    expect(submitErrorMessage('SOMETHING', 'el')).toMatch(/Δοκιμάστε ξανά/)
  })
  it('the demo link is a fixed invented sample, never the database', () => {
    expect(isDemoAccessToken('demo')).toBe(true)
    expect(isDemoAccessToken('SCR-' + 'a'.repeat(64))).toBe(false)
    const sample = demoSupplierAccess()
    expect(sample).toMatchObject({ demo: true, status: 'sent' })
    expect(sample.items).toHaveLength(3)
    expect(sample.supplierName).toMatch(/Δείγμα/)
  })
})

describe('Supplier certificate renewal: demo, database and e-mail', () => {
  it('the demo requests point at certificates of the demo suppliers, one request per supplier', () => {
    const certs = new Map(demoResources().suppliers.flatMap(entry => entry.certifications.map(c => [c.id, entry.id])))
    for (const value of demoRequests()) for (const part of value.items) expect(certs.get(part.certificationId)).toBe(value.supplierId)
    expect(demoRequests().map(value => [value.supplierId, value.items.map(part => part.status)])).toEqual([['sup-demo-2', ['submitted', 'pending', 'pending']], ['sup-demo-7', ['pending', 'pending']]])
    expect(noResponseDays(demoRequests()[1])).toBe(10)
    expect(noResponseDays(demoRequests()[0])).toBe(null)
  })

  it('one request per supplier, one item per certificate, only the token hash, the reminder keeps the link', () => {
    const sql = read('supabase/migrations/20261129100000_quality_supplier_certificate_request_items.sql')
    expect(sql).toContain('create table if not exists public.quality_supplier_certificate_request_items (')
    expect(sql).toContain("create unique index if not exists quality_supplier_certificate_request_items_open_idx on public.quality_supplier_certificate_request_items (certification_id)\n  where status in ('pending', 'submitted');")
    expect(sql).toContain("token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expires_at = now() + interval '14 days'")
    expect(sql).toContain("v_until := greatest(coalesce(v_row.token_expires_at, now()), now()) + interval '14 days';")
    expect(sql).toContain('reminder_count = r.reminder_count + 1')
    expect(sql).toContain("previous_values = jsonb_build_object('certificate_type', v_cert.certificate_type")
    expect(sql).toContain('grant execute on function public.quality_supplier_certificate_access(text) to anon, authenticated;')
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/i)
    const manifest = JSON.parse(read('supabase/security-definer-manifest.json')).functions
    expect(manifest.quality_supplier_certificate_access).toMatchObject({ category: 'public-token', anon: true })
    expect(manifest.quality_supplier_certificate_request_item_action).toMatchObject({ category: 'rpc', authenticated: true })
    expect(manifest.set_member_supplier_renewal_sender).toMatchObject({ category: 'rpc', authenticated: true })
  })

  it('the outbox lists the certificates and the public upload takes one item, without a JWT', () => {
    const outbox = read('supabase/functions/process-notification-outbox/index.ts')
    expect(outbox).toContain("'supplier_certificate_renewal'")
    expect(outbox).toContain('certificates:Array.isArray(payload.certificates)?payload.certificates:[]')
    expect(read('supabase/config.toml')).toMatch(/\[functions\.supplier-certificate-submit\]\s*verify_jwt = false/)
    const submit = read('supabase/functions/supplier-certificate-submit/index.ts')
    expect(submit).toContain(".eq('id',itemId).eq('request_id',request.id)")
    expect(submit).toContain(".eq('id',request.id).eq('token_hash',hash).eq('status','sent')")
    expect(submit).toContain(".eq('id',item.id).eq('request_id',request.id).eq('status','pending')")
    expect(submit).toContain("entity_type:'quality_supplier'")
    expect(submit).toContain("category:'certification'")
    const email = read('supabase/functions/_shared/supplierCertificateEmail.ts')
    expect(email).toContain('const rowsHtml=list.map(')
    expect(email).toContain("const reminder=kind==='reminder'")
  })
})
