// «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο» (Platform Owner): accounts
// created active with a temporary password, changed at the first sign-in.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MAX_ACTIVE_USERS_PER_CALL,
  TEMPORARY_PASSWORD_ALPHABET,
  activeUserFailureCode,
  generateTemporaryPassword,
  matchDepartment as serverMatchDepartment,
  isValidMobile,
  normalizeMobile,
  planActiveUser,
  temporaryPasswordExpiry,
  TEMPORARY_PASSWORD_DAYS,
  resolveRole as serverResolveRole,
  syntheticEmail,
  validateActiveUsersRequest,
} from '../supabase/functions/_shared/activeUsers.ts'
import { strongPassword } from '../supabase/functions/_shared/bulkAccounts.ts'
import { accountReadyEmail } from '../supabase/functions/_shared/accountCreatedEmail.ts'
import { isValidMobile as clientIsValidMobile, normalizeMobile as clientNormalizeMobile, splitNames } from '../src/features/platform/activeUsersModel.js'
import { checkPerson, errorText, mapHeaders, mergeVerdicts, planFile, previewCounts, requestUser, resolveRole, resultsSheet, templateSheet } from '../src/features/platform/activeUsersModel.js'

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const ORG = '11111111-0000-4000-8000-000000000001'
const DEP = '22222222-0000-4000-8000-000000000002'
const departments = [{ id: DEP, name: 'ΜΕΘ', name_en: 'ICU', is_active: true }, { id: '33333333-0000-4000-8000-000000000003', name: 'Παλιό', is_active: false }]
const emptyCtx = () => ({ departments, existingEmails: new Set(), takenUsernames: new Set(), employeesByCode: new Map() })

describe('temporary password', () => {
  it('is strong, 14 characters, without ambiguous characters', () => {
    for (let i = 0; i < 300; i += 1) {
      const password = generateTemporaryPassword()
      expect(password).toHaveLength(14)
      expect(strongPassword(password)).toBe(true)
      expect(password).not.toMatch(/[0O1lI5S2Zo]/)
      for (const ch of password) expect(TEMPORARY_PASSWORD_ALPHABET).toContain(ch)
    }
  })

  it('is different every time and keeps at least 12 characters', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()))
    expect(seen.size).toBe(200)
    expect(generateTemporaryPassword(4)).toHaveLength(12)
  })
})

describe('server request', () => {
  it('needs an organization and 1–25 people', () => {
    expect(validateActiveUsersRequest({ users: [{}] })).toEqual({ ok: false, code: 'ORGANIZATION_REQUIRED' })
    expect(validateActiveUsersRequest({ organizationId: ORG, users: [] })).toEqual({ ok: false, code: 'USERS_REQUIRED' })
    expect(validateActiveUsersRequest({ organizationId: ORG, users: Array.from({ length: MAX_ACTIVE_USERS_PER_CALL + 1 }, () => ({})) })).toEqual({ ok: false, code: 'TOO_MANY_USERS' })
  })

  it('checks each person and marks duplicates', () => {
    const result = validateActiveUsersRequest({
      organizationId: ORG,
      dryRun: true,
      users: [
        { fullName: 'Μαρία Π', email: 'M@Example.org', role: 'Χρήστης Τμήματος', departmentName: 'μεθ' },
        { fullName: 'Άλλη', email: 'm@example.org', role: 'laboratory' },
        { fullName: '', username: 'x', role: 'κάτι' },
        { fullName: 'Χωρίς στοιχεία', role: 'laboratory' },
        { fullName: 'Ψεύτικο', email: 'a@b.invalid', role: 'laboratory' },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.dryRun).toBe(true)
    const [first, second, third, fourth, fifth] = result.rows
    expect(first.user).toMatchObject({ email: 'm@example.org', role: 'department_user', line: 1 })
    expect(first.errors).toEqual(['DUPLICATE_IN_FILE'])
    expect(second.errors).toEqual(['DUPLICATE_IN_FILE'])
    expect(third.errors).toEqual(['FULL_NAME_REQUIRED', 'INVALID_USERNAME', 'ROLE_NOT_ALLOWED'])
    expect(fourth.errors).toEqual(['EMAIL_OR_USERNAME_REQUIRED'])
    expect(fifth.errors).toEqual(['INVALID_EMAIL'])
  })

  it('resolves roles by code or Greek name', () => {
    expect(serverResolveRole('department_manager')).toBe('department_manager')
    expect(serverResolveRole('προισταμενος τμηματος')).toBe('department_manager')
    expect(serverResolveRole('platform_owner')).toBe(null)
  })

  it('plans the department, the employee and the existing accounts', () => {
    const row = (user, errors = []) => ({ user: { line: 1, fullName: 'Α Β', email: '', username: '', role: 'department_user', roleText: 'x', departmentId: null, departmentName: '', employeeCode: '', ...user }, errors })
    expect(planActiveUser(row({ departmentName: 'ICU' }), emptyCtx())).toEqual({ code: null, departmentId: DEP, employeeId: null, divisionId: null, newDivisionName: null, departmentIds: [] })
    expect(planActiveUser(row({}), emptyCtx()).code).toBe('DEPARTMENT_REQUIRED')
    expect(planActiveUser(row({ departmentName: 'Παλιό' }), emptyCtx()).code).toBe('DEPARTMENT_NOT_FOUND')
    expect(planActiveUser(row({ role: 'laboratory', departmentName: 'ΜΕΘ' }), emptyCtx())).toEqual({ code: null, departmentId: null, employeeId: null, divisionId: null, newDivisionName: null, departmentIds: [] })
    const ctx = emptyCtx()
    ctx.existingEmails.add('a@b.gr')
    ctx.takenUsernames.add('ab12345')
    ctx.employeesByCode.set('1001', { id: 'e1', employee_code: '1001', user_id: null, department_id: DEP })
    ctx.employeesByCode.set('1002', { id: 'e2', employee_code: '1002', user_id: 'u', department_id: DEP })
    expect(planActiveUser(row({ email: 'a@b.gr' }), ctx).code).toBe('ACCOUNT_EXISTS')
    expect(planActiveUser(row({ username: 'AB12345' }), ctx).code).toBe('USERNAME_TAKEN')
    expect(planActiveUser(row({ employeeCode: '9999' }), ctx).code).toBe('EMPLOYEE_NOT_FOUND')
    expect(planActiveUser(row({ employeeCode: '1002' }), ctx).code).toBe('EMPLOYEE_ALREADY_LINKED')
    expect(planActiveUser(row({ employeeCode: '1001' }), ctx)).toMatchObject({ code: null, departmentId: DEP, employeeId: 'e1' })
    expect(planActiveUser(row({}, ['INVALID_EMAIL']), ctx).code).toBe('INVALID_EMAIL')
  })

  it('matches departments, gives username-only people a non-deliverable address and maps failures', () => {
    expect(serverMatchDepartment(departments, { departmentName: ' Μεθ ' })?.id).toBe(DEP)
    expect(syntheticEmail('GNikolaou')).toBe('gnikolaou@users.limoxis.invalid')
    expect(activeUserFailureCode(new Error('A user with this email address has already been registered'))).toBe('ACCOUNT_EXISTS')
    expect(activeUserFailureCode(new Error('PROFILE_FAILED'))).toBe('PROFILE_FAILED')
  })
})

describe('welcome e-mail', () => {
  it('names the user and never carries a password', () => {
    const message = accountReadyEmail({ organizationName: 'Νοσοκομείο Α', recipientName: 'Μαρία', username: 'MP12345', roleLabel: 'Εργαστήριο', actionUrl: 'https://www.limoxis.com/login' })
    expect(message.subject).toContain('είναι έτοιμος')
    expect(message.text).toContain('MP12345')
    expect(message.text).toContain('Ο διαχειριστής σας θα σας δώσει τον προσωρινό κωδικό')
    expect(message.html).toContain('https://www.limoxis.com/login')
    expect(message.text).not.toMatch(/Κωδικός:/)
  })
})

describe('screen model', () => {
  const clientDepartments = [{ id: DEP, name: 'ΜΕΘ' }]

  it('reads Greek or English headers and refuses a file without name and role', () => {
    expect(mapHeaders(['Ονοματεπώνυμο', 'EMAIL', 'Όνομα χρήστη', 'Ρόλος', 'Τμήμα', 'Κωδικός εργαζομένου'])).toEqual({ fullName: 0, email: 1, username: 2, role: 3, department: 4, employeeCode: 5 })
    expect(planFile([['Full name', 'Email']], clientDepartments, true).missingColumns).toEqual(['Role'])
    expect(planFile([['Ονοματεπώνυμο', 'Ρόλος']], clientDepartments).missingColumns).toEqual(['Email'])
  })

  it('checks every row and leaves empty rows out', () => {
    const { people } = planFile(
      [
        templateSheet().headers,
        ['Μαρία Παπαδοπούλου', 'm@example.org', '', 'Χρήστης Τμήματος', 'ΜΕΘ', '1001'],
        ['', '', '', '', '', ''],
        ['Γεώργιος', '', 'GNikolaou', 'Laboratory', '', ''],
        ['Νίκος', 'm@example.org', '', 'Άγνωστος', 'Χ', ''],
        ['Ελένη', 'e@example.org', '', 'Προϊστάμενος Τμήματος', '', ''],
      ],
      clientDepartments,
    )
    expect(people.map(person => person.line)).toEqual([2, 4, 5, 6])
    expect(people[0]).toMatchObject({ role: 'department_user', departmentId: DEP, errors: ['DUPLICATE_IN_FILE'] })
    expect(people[1]).toMatchObject({ role: 'laboratory', username: 'GNikolaou', errors: [] })
    expect(people[2].errors).toEqual(['ROLE_NOT_ALLOWED', 'DEPARTMENT_NOT_FOUND', 'DUPLICATE_IN_FILE'])
    expect(people[3].errors).toEqual(['DEPARTMENT_REQUIRED'])
    expect(requestUser(people[0])).toMatchObject({ line: 2, role: 'department_user', departmentId: DEP, employeeCode: '1001' })
  })

  it('merges the server verdicts and builds the results Excel', () => {
    const people = [checkPerson({ line: 2, fullName: 'Α', email: 'a@x.gr', role: 'laboratory' }), checkPerson({ line: 3, fullName: 'Β', role: 'laboratory' })]
    const merged = mergeVerdicts(people, [{ line: 2, status: 'failed', code: 'ACCOUNT_EXISTS' }])
    expect(merged.map(person => person.code)).toEqual(['ACCOUNT_EXISTS', 'EMAIL_OR_USERNAME_REQUIRED'])
    expect(previewCounts(mergeVerdicts([people[0]], [{ line: 2, status: 'ok' }]))).toEqual({ ok: 1, error: 0 })
    expect(resolveRole('Hospital Admin')).toBe('hospital_admin')
    expect(errorText('UNKNOWN', true)).toBe('The account could not be created')
    const sheet = resultsSheet([{ fullName: 'Α', username: 'AA12345', temporaryPassword: 'Xy#7abcdEFGhjk', role: 'laboratory', status: 'created' }])
    expect(sheet.headers).toContain('Προσωρινός κωδικός')
    expect(sheet.rows[0]).toEqual(['Α', 'AA12345', 'Xy#7abcdEFGhjk', '', 'Εργαστήριο', '', '', '', 'Δημιουργήθηκε · ενεργός'])
  })
})

describe('wiring', () => {
  it('requires a JWT at the gateway and the Platform Owner inside', () => {
    expect(read('supabase/config.toml')).toMatch(/\[functions\.platform-create-active-users\]\nverify_jwt = true/)
    const source = read('supabase/functions/platform-create-active-users/index.ts')
    expect(source).toContain("if(!profile?.is_platform_owner)return fail('NOT_AUTHORIZED',403)")
    expect(source).toContain('must_change_password:true')
    expect(source).toContain("status:'active'")
    expect(source).toContain('email_confirm:true')
    expect(source).toContain("notification_type:'account_ready'")
    expect(source).not.toMatch(/payload[^\n]*temporaryPassword/)
  })

  it('sends account_ready from both outbox drainers', () => {
    for (const file of ['supabase/functions/process-notification-outbox/index.ts', 'supabase/functions/platform-scheduled-tasks/index.ts']) {
      const source = read(file)
      expect(source).toContain("'account_ready'")
      expect(source).toContain('accountReadyEmail(')
    }
  })

  it('adds the flag and a self-only RPC to clear it', () => {
    const sql = read('supabase/migrations/20261231260400_profiles_must_change_password.sql')
    expect(sql).toContain('add column if not exists must_change_password boolean not null default false')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('where id = v_user')
    expect(sql).toContain('grant execute on function public.complete_password_change() to authenticated')
  })

  it('blocks the app until the temporary password is changed', () => {
    expect(read('src/core/auth/AuthContext.jsx')).toContain("select('must_change_password')")
    expect(read('src/core/auth/ProtectedRoute.jsx')).toContain('profile?.mustChangePassword && !profile?.isDemo')
    const page = read('src/features/auth/ForcePasswordChangePage.jsx')
    expect(page).toContain('supabase.auth.updateUser({password})')
    expect(page).toContain("supabase.rpc('complete_password_change')")
  })
})

describe('mobile number as the temporary password', () => {
  const base = { fullName: 'Α Β', email: 'a@b.gr', role: 'department_user', departmentId: DEP }
  it('reads a Greek mobile number the same way on the screen and on the server', () => {
    for (const text of ['6912345678', '69 1234 5678', '+30 691 234 5678', '0030-6912345678', '691-234-5678']) {
      expect(normalizeMobile(text)).toBe('6912345678')
      expect(clientNormalizeMobile(text)).toBe('6912345678')
      expect(isValidMobile(text)).toBe(true)
      expect(clientIsValidMobile(text)).toBe(true)
    }
    for (const text of ['', '2101234567', '691234567', '69123456789', 'abc']) {
      expect(isValidMobile(text)).toBe(false)
      expect(clientIsValidMobile(text)).toBe(false)
    }
  })

  it('needs the number only when it is the password, and checks it when it is given', () => {
    const server = users => validateActiveUsersRequest({ organizationId: ORG, passwordMode: 'phone', users }).rows.map(row => row.errors)
    expect(server([{ ...base }])).toEqual([['PHONE_REQUIRED']])
    expect(server([{ ...base, phone: '12345' }])).toEqual([['PHONE_INVALID']])
    expect(server([{ ...base, phone: '+30 6912345678' }])).toEqual([[]])
    expect(validateActiveUsersRequest({ organizationId: ORG, users: [{ ...base }] }).rows[0].errors).toEqual([])
    expect(validateActiveUsersRequest({ organizationId: ORG, users: [{ ...base, phone: '12' }] }).rows[0].errors).toEqual(['PHONE_INVALID'])
    expect(checkPerson({ ...base, line: 1, passwordMode: 'phone' }, departments).errors).toContain('PHONE_REQUIRED')
    expect(checkPerson({ ...base, line: 1, passwordMode: 'phone', phone: '69 1234 5678' }, departments)).toMatchObject({ phone: '6912345678', passwordMode: 'phone', errors: [] })
    expect(requestUser(checkPerson({ ...base, line: 1, passwordMode: 'phone', phone: '6912345678' }, departments))).toMatchObject({ phone: '6912345678', passwordMode: 'phone' })
  })

  it('expires in 7 days', () => {
    expect(TEMPORARY_PASSWORD_DAYS).toBe(7)
    expect(temporaryPasswordExpiry(new Date('2026-11-11T10:00:00Z'))).toBe('2026-11-18T10:00:00.000Z')
  })
})

describe('division director', () => {
  const DEP2 = '44444444-0000-4000-8000-000000000004'
  const DIV = '55555555-0000-4000-8000-000000000005'
  const deps = [...departments, { id: DEP2, name: 'Χειρουργική', name_en: 'Surgery', is_active: true }]
  const ctx = () => ({ ...emptyCtx(), departments: deps, divisions: [{ id: DIV, name: 'Νοσηλευτική Υπηρεσία' }] })
  const row = user => ({ user: { line: 1, fullName: 'Α Β', email: '', username: 'ab12345', role: 'division_director', roleText: 'x', departmentId: null, departmentName: '', employeeCode: '', phone: '', passwordMode: 'random', divisionId: null, divisionName: '', departmentIds: [], departmentNames: [], ...user }, errors: [] })

  it('needs a division and the departments they will see', () => {
    expect(planActiveUser(row({}), ctx()).code).toBe('DEPARTMENTS_REQUIRED')
    expect(planActiveUser(row({ departmentIds: [DEP] }), ctx()).code).toBe('DIVISION_REQUIRED')
    expect(planActiveUser(row({ divisionName: 'Λειτουργιών', departmentIds: ['99999999-0000-4000-8000-000000000009'] }), ctx()).code).toBe('DEPARTMENT_NOT_FOUND')
    expect(planActiveUser(row({ divisionId: '99999999-0000-4000-8000-000000000009', departmentIds: [DEP] }), ctx()).code).toBe('DIVISION_NOT_FOUND')
  })

  it('uses an existing division (by id or by name) or asks for a new one, with the departments chosen', () => {
    expect(planActiveUser(row({ divisionId: DIV, departmentIds: [DEP, DEP2] }), ctx())).toMatchObject({ code: null, divisionId: DIV, newDivisionName: null, departmentIds: [DEP, DEP2], departmentId: null })
    expect(planActiveUser(row({ divisionName: ' νοσηλευτικη  υπηρεσια ', departmentNames: ['ΜΕΘ', 'surgery'] }), ctx())).toMatchObject({ code: null, divisionId: DIV, departmentIds: [DEP, DEP2] })
    expect(planActiveUser(row({ divisionName: 'Διεύθυνση Λειτουργιών', departmentIds: [DEP] }), ctx())).toMatchObject({ code: null, divisionId: null, newDivisionName: 'Διεύθυνση Λειτουργιών', departmentIds: [DEP] })
  })

  it('is read from the screen and from the file like on the server', () => {
    expect(splitNames('ΜΕΘ; Χειρουργική, ΜΕΘ\nΤΕΠ')).toEqual(['ΜΕΘ', 'Χειρουργική', 'ΤΕΠ'])
    const person = checkPerson({ line: 1, fullName: 'Α Β', username: 'ab12345', role: 'division_director', divisionName: 'Νοσηλευτική Υπηρεσία', divisionDepartments: 'ΜΕΘ; Χειρουργική' }, deps)
    expect(person).toMatchObject({ errors: [], divisionName: 'Νοσηλευτική Υπηρεσία', departmentIds: [DEP, DEP2] })
    expect(requestUser(person)).toMatchObject({ divisionName: 'Νοσηλευτική Υπηρεσία', departmentIds: [DEP, DEP2] })
    expect(checkPerson({ line: 1, fullName: 'Α Β', username: 'ab12345', role: 'division_director' }, deps).errors).toEqual(['DIVISION_REQUIRED', 'DEPARTMENTS_REQUIRED'])
    expect(checkPerson({ line: 1, fullName: 'Α Β', username: 'ab12345', role: 'division_director', divisionName: 'Χ', divisionDepartments: 'Άγνωστο' }, deps).errors).toEqual(['DEPARTMENT_NOT_FOUND'])
  })

  it('is wired in the Edge Function: division, its members, the departments chosen, the expiry', () => {
    const fn = read('supabase/functions/platform-create-active-users/index.ts')
    expect(fn).toContain("from('hr_division_members').insert")
    expect(fn).toContain('setMemberDepartments')
    expect(fn).toContain('temporary_password_expires_at:expiresAt')
    expect(fn).toContain("user.passwordMode==='phone'?user.phone:generateTemporaryPassword()")
    expect(read('supabase/functions/_shared/organizationAccount.ts')).toContain('granted_by_division:false')
    const sql = read('supabase/migrations/20261231310000_temporary_password_expiry.sql')
    expect(sql).toContain("cron.schedule('lock-expired-temporary-passwords'")
    expect(sql).toContain("banned_until = 'infinity'")
    expect(sql).not.toMatch(/\b(drop table|delete from|alter policy)\b/i)
  })
})
