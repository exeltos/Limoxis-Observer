// N1 · Bulk creation of accounts from the employee roster (Platform Owner only):
// the server rules, the e-mails, the screen's model and the wiring of the Edge
// Functions, the migration and both outbox drainers.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCESS_TOKEN_PATTERN,
  BULK_ROLES as SERVER_BULK_ROLES,
  accessLinkExpiry,
  duplicateEmails,
  failureCode,
  isDeliverableEmail,
  planItem,
  resendDecision,
  strongPassword,
  summarizeByRole,
  tokenState,
  validateBulkRequest,
} from '../supabase/functions/_shared/bulkAccounts.ts'
import { accountAccessAddedEmail, accountBatchSummaryEmail, accountCreatedEmail } from '../supabase/functions/_shared/accountCreatedEmail.ts'
import {
  BULK_ROLES,
  applyRoleToSelected,
  buildItems,
  bulkRoleTargets,
  chipCounts,
  chunk,
  emailFailureCode,
  filterRows,
  latestBatch,
  normalizeRosterRow,
  resultStatus,
  resultTotals,
  rowSelectable,
  selectionSummary,
  setRowRole,
} from '../src/features/platform/bulkAccountsModel.js'
import { passwordStrength } from '../src/features/auth/passwordStrength.js'

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const ORG = '02b241c0-a049-4e1f-a72c-67f6699f2d04'
const E1 = '11111111-1111-4111-8111-111111111111'
const E2 = '22222222-2222-4222-8222-222222222222'
const KEY = '33333333-3333-4333-8333-333333333333'

describe('bulk request validation', () => {
  it('needs an organization, a batch key (except the dry run) and 1–25 people per call', () => {
    expect(validateBulkRequest({})).toEqual({ ok: false, code: 'ORGANIZATION_REQUIRED' })
    expect(validateBulkRequest({ organizationId: ORG, items: [{ employeeId: E1, role: 'pharmacy' }] })).toEqual({ ok: false, code: 'BATCH_KEY_REQUIRED' })
    expect(validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: [] }).code).toBe('ITEMS_REQUIRED')
    const many = Array.from({ length: 26 }, (_, i) => ({ employeeId: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, role: 'pharmacy' }))
    expect(validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: many }).code).toBe('TOO_MANY_ITEMS')
    expect(validateBulkRequest({ organizationId: ORG, dryRun: true, items: many }).ok).toBe(true)
  })

  it('refuses the Hospital Admin role, unknown roles and the same employee twice', () => {
    expect(validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: [{ employeeId: E1, role: 'hospital_admin' }] }).code).toBe('ROLE_NOT_ALLOWED')
    expect(validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: [{ employeeId: E1, role: 'root' }] }).code).toBe('ROLE_NOT_ALLOWED')
    expect(validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: [{ employeeId: E1, role: 'pharmacy' }, { employeeId: E1.toUpperCase(), role: 'laboratory' }] }).code).toBe('DUPLICATE_EMPLOYEE')
    const ok = validateBulkRequest({ organizationId: ORG, batchKey: KEY, items: [{ employeeId: E1, role: 'department_user', departmentId: E2 }], confirmExisting: [E1, 'x'] })
    expect(ok).toEqual({ ok: true, request: { organizationId: ORG, batchKey: KEY, dryRun: false, items: [{ employeeId: E1, role: 'department_user', departmentId: E2 }], confirmExisting: [E1] } })
  })

  it('offers in bulk every role but the Hospital Admin, the same on screen and server', () => {
    expect(SERVER_BULK_ROLES).not.toContain('hospital_admin')
    expect(BULK_ROLES).not.toContain('hospital_admin')
    expect([...BULK_ROLES].sort()).toEqual([...SERVER_BULK_ROLES].sort())
  })
})

describe('what happens to each person', () => {
  const employee = { id: E1, user_id: null, email: ' I.Pappa@Example.org ', department_id: 'dep-1', employment_status: 'active' }
  const item = role => ({ employeeId: E1, role, departmentId: null })

  it('creates an account for an active employee with a usable e-mail', () => {
    expect(planItem(item('department_user'), employee, null, false)).toEqual({ action: 'create', code: null, departmentId: 'dep-1', email: 'i.pappa@example.org' })
    expect(planItem(item('pharmacy'), employee, null, false).departmentId).toBeNull()
  })

  it('skips with a reason: linked meanwhile, no or invalid e-mail, no department', () => {
    expect(planItem(item('pharmacy'), { ...employee, user_id: 'u1' }, null, false).code).toBe('EMPLOYEE_ALREADY_LINKED')
    expect(planItem(item('pharmacy'), { ...employee, email: '' }, null, false).code).toBe('MISSING_EMAIL')
    expect(planItem(item('pharmacy'), { ...employee, email: 'person@demo.invalid' }, null, false).code).toBe('INVALID_EMAIL')
    expect(planItem(item('link_nurse'), { ...employee, department_id: null }, null, false).code).toBe('DEPARTMENT_REQUIRED')
    expect(planItem(item('pharmacy'), { ...employee, employment_status: 'left' }, null, false).code).toBe('EMPLOYEE_INACTIVE')
    expect(planItem(item('pharmacy'), null, null, false).code).toBe('EMPLOYEE_NOT_FOUND')
  })

  it('never makes a second account for an e-mail that has one: confirmed one by one, Demo accounts refused', () => {
    const existing = { userId: 'u9', fullName: 'Ευδοκία Σταμάτη', username: 'ES18452', isDemo: false, memberHere: false, organizations: ['Σισμανόγλειο'] }
    expect(planItem(item('pharmacy'), employee, existing, false).code).toBe('EXISTING_ACCOUNT_NEEDS_CONFIRMATION')
    expect(planItem(item('pharmacy'), employee, existing, true).action).toBe('link_existing')
    // A Hospital Admin never links it, confirmed or not.
    expect(planItem(item('pharmacy'), employee, existing, true, false).code).toBe('ACCOUNT_IN_USE')
    expect(planItem(item('pharmacy'), employee, { ...existing, isDemo: true }, true).code).toBe('EXISTING_ACCOUNT_CONFLICT')
    expect(planItem(item('pharmacy'), employee, { ...existing, memberHere: true }, true).code).toBe('EMAIL_IN_THIS_ORG')
  })

  it('locks an address used by two employees', () => {
    expect([...duplicateEmails([{ email: 'a@x.gr' }, { email: 'A@x.gr ' }, { email: 'b@x.gr' }, { email: null }])]).toEqual(['a@x.gr'])
    expect(isDeliverableEmail('a@x.gr')).toBe(true)
    expect(isDeliverableEmail('a@x')).toBe(false)
  })

  it('counts people per role with the departments of the department roles', () => {
    expect(summarizeByRole([{ role: 'department_user', departmentName: 'ΜΕΘ' }, { role: 'department_user', departmentName: 'ΤΕΠ' }, { role: 'pharmacy', departmentName: 'Φαρμακείο' }])).toEqual([
      { role: 'department_user', count: 2, departments: ['ΜΕΘ', 'ΤΕΠ'] },
      { role: 'pharmacy', count: 1, departments: [] },
    ])
  })

  it('keeps an error code per person', () => {
    expect(failureCode(new Error('EMPLOYEE_ALREADY_LINKED'))).toBe('EMPLOYEE_ALREADY_LINKED')
    expect(failureCode({ message: 'A user with this email address has already been registered' })).toBe('EMAIL_ALREADY_REGISTERED')
    expect(failureCode(new Error('boom'))).toBe('AUTH_ERROR')
  })
})

describe('the «Ορισμός κωδικού» link', () => {
  it('is valid until 23:59 (Athens) of the 7th day', () => {
    const expiry = accessLinkExpiry(new Date('2026-10-20T07:30:00Z'))
    expect(expiry.toISOString()).toBe('2026-10-27T21:59:59.000Z') // 23:59:59 EET (winter time from 25/10)
    expect(accessLinkExpiry(new Date('2026-07-01T09:00:00Z')).toISOString()).toBe('2026-07-08T20:59:59.000Z') // EEST
  })

  it('is single use: used, revoked or expired links are refused', () => {
    const now = new Date('2026-10-21T10:00:00Z')
    expect(tokenState(null, now)).toBe('not_found')
    expect(tokenState({ expires_at: '2026-10-27T21:59:59Z' }, now)).toBe('valid')
    expect(tokenState({ expires_at: '2026-10-27T21:59:59Z', accepted_at: '2026-10-21T09:00:00Z' }, now)).toBe('used')
    expect(tokenState({ expires_at: '2026-10-27T21:59:59Z', revoked_at: '2026-10-21T09:00:00Z' }, now)).toBe('revoked')
    expect(tokenState({ expires_at: '2026-10-20T21:59:59Z' }, now)).toBe('expired')
    expect(ACCESS_TOKEN_PATTERN.test(`ACT-${'a'.repeat(64)}`)).toBe(true)
    expect(ACCESS_TOKEN_PATTERN.test('SCR-' + 'a'.repeat(64))).toBe(false)
  })

  it('«Ξαναστείλε» at most 3 times in 24 hours, 10 minutes apart', () => {
    const now = new Date('2026-10-21T12:00:00Z')
    expect(resendDecision({ resentAt: [], lastSentAt: '2026-10-21T11:55:00Z' }, now)).toEqual({ ok: false, code: 'RESEND_TOO_SOON' })
    expect(resendDecision({ resentAt: ['2026-10-21T08:00:00Z', '2026-10-21T09:00:00Z', '2026-10-21T10:00:00Z'], lastSentAt: '2026-10-21T10:00:00Z' }, now).code).toBe('RESEND_DAILY_LIMIT')
    expect(resendDecision({ resentAt: ['2026-10-19T08:00:00Z'], lastSentAt: '2026-10-21T11:00:00Z' }, now)).toEqual({ ok: true, code: null })
  })

  it('uses the activation password policy', () => {
    expect(strongPassword('Kalimera2026')).toBe(false)
    expect(strongPassword('Kalimera2026!')).toBe(true)
  })
})

describe('account e-mails', () => {
  const base = { organizationName: 'Γ.Ν. Θεσσαλονίκης «Παπανικολάου»', organizationEmail: 'ipc@papanikolaou.example', organizationPhone: '2313 307000', recipientName: 'Ιωάννα Παππά', username: 'IP40718', roleLabel: 'Χρήστης Τμήματος', departmentName: 'ΜΕΘ', expiresAt: '2026-10-27T21:59:59Z', actionUrl: 'https://www.limoxis.com/activate?access=ACT-abc' }

  it('«Δημιουργήθηκε λογαριασμός για εσάς στο <νοσοκομείο>» with username, button, validity and the hospital contact', () => {
    const mail = accountCreatedEmail(base)
    expect(mail.subject).toBe('Γ.Ν. Θεσσαλονίκης «Παπανικολάου» · Δημιουργήθηκε λογαριασμός για εσάς στο Limoxis Observer')
    expect(mail.replyTo).toBe('ipc@papanikolaou.example')
    for (const text of ['IP40718', 'Ορισμός κωδικού', '27/10/2026', 'Χρήστης Τμήματος · ΜΕΘ', 'mailto:ipc@papanikolaou.example', '2313 307000', 'v:roundrect', 'English', 'Πώς θα μπείτε']) expect(mail.html).toContain(text)
    expect(mail.html).toContain('href="https://www.limoxis.com/activate?access=ACT-abc"')
    expect(mail.text).toContain('Ορισμός κωδικού: https://www.limoxis.com/activate?access=ACT-abc')
    expect(accountCreatedEmail({ ...base, recipientName: '<b>x</b>' }).html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(accountCreatedEmail({ ...base, kind: 'resend' }).html).toContain('Νέος σύνδεσμος')
  })

  it('an existing account gets a notice without a password link', () => {
    const mail = accountAccessAddedEmail({ ...base, actionUrl: 'https://www.limoxis.com/login' })
    expect(mail.subject).toContain('Αποκτήσατε πρόσβαση και στο')
    expect(mail.html).not.toContain('Ορισμός κωδικού')
    expect(mail.html).toContain('δεν χρειάζεται νέος κωδικός')
  })

  it('the administrators get who got accounts and with which role', () => {
    const mail = accountBatchSummaryEmail({ organizationName: base.organizationName, people: [{ name: 'Ιωάννα Παππά', roleLabel: 'Χρήστης Τμήματος', departmentName: 'ΜΕΘ', username: 'IP40718', outcome: 'created' }, { name: 'Μιχάλης Τσιρίγος', roleLabel: 'Χρήστης Τμήματος', outcome: 'failed' }], actionUrl: 'https://www.limoxis.com/management' })
    expect(mail.subject).toContain('(1)')
    expect(mail.html).toContain('IP40718')
    expect(mail.html).toContain('Απέτυχε')
    expect(mail.text).toContain('Ιωάννα Παππά · Χρήστης Τμήματος · ΜΕΘ · IP40718')
  })
})

describe('the screen model', () => {
  const raw = [
    { employee_id: E1, full_name: 'Ιωάννα Παππά', profession_name: 'Νοσηλεύτρια ΤΕ', department_id: 'd1', department_name: 'ΜΕΘ', email: 'i@x.gr', account_state: 'none' },
    { employee_id: E2, full_name: 'Βασίλειος Ζερβός', department_id: 'd2', department_name: 'ΤΕΠ', email: null, account_state: 'none', blocked_reason: 'missing_email' },
    { employee_id: 'e3', full_name: 'Στέλλα Καραμανλή', account_state: 'invited', member_role: 'department_user', invitation_expires_at: '2026-10-09T21:00:00Z', item_batch_id: 'b1', item_created_at: '2026-10-02T08:00:00Z' },
    { employee_id: 'e4', full_name: 'Θεόδωρος Μαυρίδης', account_state: 'invited', member_role: 'doctor_reviewer', invitation_expires_at: '2026-10-27T21:00:00Z', item_batch_id: 'b2', item_created_at: '2026-10-20T08:00:00Z', item_status: 'created' },
    { employee_id: 'e5', full_name: 'Ευδοκία Σταμάτη', account_state: 'active', item_status: 'linked_existing', item_batch_id: 'b2', item_created_at: '2026-10-20T08:00:01Z' },
    { employee_id: 'e6', full_name: 'Μιχάλης Τσιρίγος', account_state: 'none', item_status: 'failed', item_error: 'INVALID_EMAIL', item_batch_id: 'b2', item_created_at: '2026-10-20T08:00:02Z', email: 'm@x.gr' },
  ].map(normalizeRosterRow)
  const byId = new Map(raw.map(row => [row.employeeId, row]))
  const now = new Date('2026-10-21T10:00:00Z')

  it('locks the rows without e-mail and counts the chips', () => {
    expect(rowSelectable(byId.get(E1), 'none')).toBe(true)
    expect(rowSelectable(byId.get(E2), 'none')).toBe(false)
    expect(rowSelectable(byId.get('e3'), 'pending')).toBe(true)
    expect(rowSelectable({ ...byId.get('e3'), memberRole: 'hospital_admin' }, 'pending')).toBe(false)
    expect(chipCounts(raw)).toEqual({ none: 3, pending: 2, active: 1, all: 6 })
    expect(filterRows(raw, { filter: 'none', query: 'παππα' }).map(row => row.employeeId)).toEqual([E1])
    expect(latestBatch(raw)).toEqual({ id: 'b2', createdAt: '2026-10-20T08:00:02Z', count: 3 })
  })

  it('needs a role for every selected person and a department for the department roles', () => {
    const selected = new Set([E1, 'e6'])
    let drafts = {}
    expect(selectionSummary(selected, drafts, byId)).toMatchObject({ selected: 2, missingRole: 2, ready: false })
    drafts = setRowRole(drafts, byId.get(E1), 'department_user')
    expect(drafts[E1]).toEqual({ role: 'department_user', departmentId: 'd1' })
    expect(selectionSummary(selected, drafts, byId)).toMatchObject({ missingRole: 1, missingNames: ['Μιχάλης Τσιρίγος'], ready: false })
    drafts = setRowRole(drafts, byId.get('e6'), 'link_nurse')
    expect(selectionSummary(selected, drafts, byId)).toMatchObject({ missingRole: 0, missingDepartment: 1, ready: false })
    drafts = setRowRole(drafts, byId.get('e6'), 'pharmacy')
    expect(selectionSummary(selected, drafts, byId).ready).toBe(true)
    expect(buildItems(selected, drafts)).toEqual([{ employeeId: E1, role: 'department_user', departmentId: 'd1' }, { employeeId: 'e6', role: 'pharmacy', departmentId: null }])
  })

  it('applies a role to the selected without one, or to all with «Αντικατάσταση»', () => {
    const selected = new Set([E1, 'e6'])
    const drafts = { [E1]: { role: 'pharmacy', departmentId: null } }
    expect(bulkRoleTargets(drafts, selected, false)).toEqual(['e6'])
    const kept = applyRoleToSelected(drafts, selected, byId, { role: 'department_user', scope: 'own' })
    expect(kept[E1]).toEqual({ role: 'pharmacy', departmentId: null })
    expect(kept.e6).toEqual({ role: 'department_user', departmentId: null })
    const replaced = applyRoleToSelected(drafts, selected, byId, { role: 'department_user', replace: true, scope: 'one', departmentId: 'd9' })
    expect(replaced[E1]).toEqual({ role: 'department_user', departmentId: 'd9' })
  })

  it('shows the result per person', () => {
    expect(resultStatus(byId.get('e3'), now)).toBe('expired')
    expect(resultStatus(byId.get('e4'), now)).toBe('sent')
    expect(resultStatus(byId.get('e5'), now)).toBe('linked')
    expect(resultStatus(byId.get('e6'), now)).toBe('failed')
    expect(resultStatus({ ...byId.get('e4'), accountState: 'active' }, now)).toBe('activated')
    expect(resultStatus({ ...byId.get('e4'), emailStatus: 'failed' }, now)).toBe('failed')
    expect(resultTotals([byId.get('e4'), byId.get('e5'), byId.get('e6')], now)).toEqual({ createdOrLinked: 2, activated: 1, pending: 1, failed: 1 })
    expect(emailFailureCode('550 5.1.1 mailbox does not exist')).toBe('EMAIL_REJECTED')
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('rates the password as the design shows', () => {
    expect(passwordStrength('Kalimera2026')).toMatchObject({ score: 3, level: 'fair', label: 'μέτρια', hint: 'προσθέστε ένα σύμβολο (π.χ. ! ή #)' })
    expect(passwordStrength('Kalimera2026!').level).toBe('strong')
  })
})

describe('server wiring', () => {
  const bulk = read('supabase/functions/platform-bulk-create-accounts/index.ts')
  const redeem = read('supabase/functions/redeem-access-token/index.ts')
  const migration = read('supabase/migrations/20261203100000_bulk_employee_accounts.sql')
  const config = read('supabase/config.toml')

  it('bulk creation is for the Platform Owner or the hospital\'s own active admin, with JWT verification at the gateway', () => {
    expect(bulk).toContain("if(member?.role!=='hospital_admin'||member?.status!=='active')return fail('NOT_AUTHORIZED',403)")
    expect(bulk).toContain(".eq('organization_id',body.organizationId).eq('user_id',callerData.user.id)")
    // Only the owner links an account that another organization uses.
    expect(bulk).toContain("canLinkExisting:isOwner")
    expect(bulk).toContain('planWithDuplicates(item,loaded,confirmed&&ctx.canLinkExisting,ctx.canLinkExisting)')
    expect(config).toMatch(/\[functions\.platform-bulk-create-accounts\]\s*verify_jwt = true/)
    expect(bulk).toContain("from '../_shared/organizationAccount.ts'")
    expect(read('supabase/functions/create-organization-user/index.ts')).toContain("from '../_shared/organizationAccount.ts'")
  })

  it('creates accounts without a Supabase e-mail, with our own hashed 7-day token, audit and outbox', () => {
    expect(bulk).toContain('admin.auth.admin.createUser({email:plan.email,email_confirm:false')
    expect(bulk).not.toContain('inviteUserByEmail')
    expect(bulk).toContain('token_hash:await sha256Hex(token)')
    expect(bulk).toContain("notification_type:'account_created'")
    expect(bulk).toContain("rpc('platform_account_item_link'")
    for (const event of ['platform.accounts.bulk_started', 'organization.user.created_from_employee', 'organization.user.linked_existing_account', 'organization.user.creation_failed', 'organization.user.access_resent', 'platform.accounts.bulk_finished']) expect(bulk).toContain(event)
    expect(bulk).toContain("notification_type:'account_batch_summary'")
  })

  it('the redeem endpoint is public, hashes the token, spends it once and limits attempts', () => {
    expect(config).toMatch(/\[functions\.redeem-access-token\]\s*verify_jwt = false/)
    expect(redeem).toContain(".eq('token_hash',await sha256Hex(token))")
    expect(redeem).toContain("rpc('platform_access_token_redeem'")
    expect(redeem).toContain('REDEEM_IP_LIMIT')
    expect(redeem).toContain('serveWithCors(')
    expect(redeem).toContain('email_confirm:true')
  })

  it('the database never holds two live items for one employee and locks the rows it links', () => {
    expect(migration).toMatch(/create unique index if not exists account_creation_items_employee_live\s+on public\.account_creation_items \(employee_id\) where status in \('queued', 'created', 'linked_existing'\)/)
    expect(migration).toContain('batch_key uuid not null unique')
    expect(migration).toContain('for update')
    expect(migration).toMatch(/revoke all on function public\.platform_account_item_link\(uuid, uuid, public\.member_status\) from public, anon, authenticated/)
    expect(migration).toContain("raise exception 'NOT_AUTHORIZED'")
  })

  it('both outbox drainers send the account e-mails and drop the raw token once sent', () => {
    for (const file of ['supabase/functions/process-notification-outbox/index.ts', 'supabase/functions/platform-scheduled-tasks/index.ts']) {
      const source = read(file)
      for (const type of ['account_created', 'account_access_added', 'account_batch_summary']) expect(source).toContain(`'${type}'`)
      expect(source).toContain("row.notification_type==='account_created'?{payload:")
    }
    expect(read('supabase/functions/platform-scheduled-tasks/index.ts')).toMatch(/const MAILED=\[[^\]]*'account_created'/)
  })
})
