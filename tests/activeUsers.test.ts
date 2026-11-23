// «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο» (Platform Owner): accounts
// created active with a temporary password, changed at the first sign-in.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MAX_ACTIVE_USERS_PER_CALL,
  TEMPORARY_PASSWORD_ALPHABET,
  activeUserFailureCode,
  generateTemporaryPassword,
  indexEmployees,
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
import type { PlanContext } from '../supabase/functions/_shared/activeUsers.ts'
import { strongPassword } from '../supabase/functions/_shared/bulkAccounts.ts'
import { accountReadyEmail } from '../supabase/functions/_shared/accountCreatedEmail.ts'
import { isValidMobile as clientIsValidMobile, normalizeMobile as clientNormalizeMobile, splitNames } from '../src/features/platform/activeUsersModel'
import { LIST_ROLES, checkPerson, latinize, ruleUsername, employeeIssue, errorText, mapHeaders, markDuplicates, planEmployees, suggestRole, mergeVerdicts, planFile, previewCounts, requestUser, resolveRole, resultsSheet, templateSheet } from '../src/features/platform/activeUsersModel'
import { readSource } from './helpers/readSource'

type ValidRequest = Extract<ReturnType<typeof validateActiveUsersRequest>, { ok: true }>

const root = path.resolve(__dirname, '..')
const read = file => readSource(path.join(root, file))
const ORG = '11111111-0000-4000-8000-000000000001'
const DEP = '22222222-0000-4000-8000-000000000002'
const departments = [{ id: DEP, name: 'ΜΕΘ', name_en: 'ICU', is_active: true }, { id: '33333333-0000-4000-8000-000000000003', name: 'Παλιό', is_active: false }]
const emptyCtx = (): PlanContext => ({ departments, existingEmails: new Set(), takenUsernames: new Set(), employeesByCode: new Map() })

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
    }) as ValidRequest
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
    const server = users => (validateActiveUsersRequest({ organizationId: ORG, passwordMode: 'phone', users }) as ValidRequest).rows.map(row => row.errors)
    expect(server([{ ...base }])).toEqual([['PHONE_REQUIRED']])
    expect(server([{ ...base, phone: '12345' }])).toEqual([['PHONE_INVALID']])
    expect(server([{ ...base, phone: '+30 6912345678' }])).toEqual([[]])
    expect((validateActiveUsersRequest({ organizationId: ORG, users: [{ ...base }] }) as ValidRequest).rows[0].errors).toEqual([])
    expect((validateActiveUsersRequest({ organizationId: ORG, users: [{ ...base, phone: '12' }] }) as ValidRequest).rows[0].errors).toEqual(['PHONE_INVALID'])
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
  const ctx = (): PlanContext => ({ ...emptyCtx(), departments: deps, divisions: [{ id: DIV, name: 'Νοσηλευτική Υπηρεσία' }] })
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
    // departments has no name_en column: asking for it failed every request (CONTEXT_FAILED).
    expect(fn).toContain("from('departments').select('id,name,is_active')")
    expect(fn).not.toContain('name,name_en')
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

describe('Νέος προσωρινός κωδικός (reissue) και φραγή μέχρι την πρώτη αλλαγή', () => {
  const read = file => readSource(path.resolve(__dirname, '..', file))
  it('η συνάρτηση: μόνο ο owner, ban_duration none, νέα λήξη, ξεκλείδωμα, audit, κωδικός μία φορά', () => {
    const src = read('supabase/functions/platform-create-active-users/index.ts')
    expect(src).toContain("body?.action==='reissue'")
    expect(src).toContain("ban_duration:'none'")
    expect(src).toContain('temporary_password_locked_at:null')
    expect(src).toContain('organization.user.temporary_password_reissued')
    expect(src).toContain('is_platform_owner')
    expect(src).not.toMatch(/temporaryPassword[^\n]*console\./)
  })
  it('η οθόνη: μενού «Νέος προσωρινός κωδικός» και τηλέφωνο μόνο όταν επιλεγεί κινητό', () => {
    expect(read('src/features/platform/PlatformOrganizationUserRecord.jsx')).toContain('Νέος προσωρινός κωδικός')
    expect(read('src/features/platform/ReissuePasswordDialog.jsx')).toContain('isValidMobile(phone)')
  })
  it('το SQL φραγής αλλάζει τις 4 συναρτήσεις και δεν έχει drop/alter policy', () => {
    const sql = read('supabase/manual/20261231320000_password_change_gate.sql')
    for (const name of ['is_org_member', 'has_org_role', 'current_user_has_department_scope', 'current_user_has_capability']) expect(sql).toContain(`public.${name}`)
    expect(sql).toContain('private.password_change_pending()')
    expect(sql).not.toMatch(/\b(drop |delete from|alter policy)/i)
  })
})

// «Ενεργοί με προσωρινό κωδικό»: one window with three tabs (one user, the employee list, Excel),
// no duplicate people and the owner's choice of the invitation e-mail.
describe('no duplicates and the employee list', () => {
  const EMP = '44444444-0000-4000-8000-000000000004'
  const EMP2 = '55555555-0000-4000-8000-000000000005'
  const row = (user, errors = []) => ({ user: { line: 1, fullName: 'Μαρία Παπαδοπούλου', email: '', username: '', role: 'department_user', roleText: 'x', departmentId: null, departmentName: '', employeeCode: '', employeeId: null, sendInvite: true, ...user }, errors })
  const ctxWith = () => {
    const index = indexEmployees([
      { id: EMP, employee_code: '1001', user_id: null, department_id: DEP, first_name: 'Μαρία', last_name: 'Παπαδοπούλου' },
      { id: EMP2, employee_code: '1002', user_id: 'u2', department_id: DEP, first_name: 'Γιώργος', last_name: 'Νικολάου' },
    ])
    return { ...emptyCtx(), employeesByCode: index.byCode, employeesById: index.byId, employeesByName: index.byName, memberNames: new Set<string>() }
  }

  it('links the employee of the list and takes the department from it', () => {
    expect(planActiveUser(row({ employeeId: EMP }), ctxWith())).toMatchObject({ code: null, employeeId: EMP, departmentId: DEP })
    expect(planActiveUser(row({ employeeId: EMP2 }), ctxWith()).code).toBe('EMPLOYEE_ALREADY_LINKED')
    expect(planActiveUser(row({ employeeId: '66666666-0000-4000-8000-000000000006' }), ctxWith()).code).toBe('EMPLOYEE_NOT_FOUND')
  })

  it('links by name when the code is missing and the name is one employee (either order)', () => {
    expect(planActiveUser(row({ fullName: 'Παπαδοπουλου  Μαρια' }), ctxWith())).toMatchObject({ code: null, employeeId: EMP })
    expect(planActiveUser(row({ fullName: 'Γιώργος Νικολάου', email: 'g@n.gr' }), ctxWith()).code).toBe('EMPLOYEE_ALREADY_LINKED')
  })

  it('refuses a second account for a name that is already a user, unless code and e-mail are typed', () => {
    const ctx = ctxWith()
    ctx.memberNames.add('μαρια παπαδοπουλου')
    expect(planActiveUser(row({ employeeId: EMP }), ctx).code).toBe('NAME_TAKEN')
    expect(planActiveUser(row({ email: 'm@p.gr' }), ctx).code).toBe('NAME_TAKEN')
    expect(planActiveUser(row({ employeeCode: '1001', email: 'm@p.gr' }), ctx).code).toBe(null)
  })

  it('refuses the same name twice in one request unless the employee codes differ', () => {
    const same = validateActiveUsersRequest({ organizationId: ORG, users: [{ fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory' }, { fullName: 'α  β', email: 'b@x.gr', role: 'laboratory' }] }) as ValidRequest
    expect(same.rows.map(item => item.errors)).toEqual([['DUPLICATE_IN_FILE'], ['DUPLICATE_IN_FILE']])
    const coded = validateActiveUsersRequest({ organizationId: ORG, users: [{ fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory', employeeCode: '1' }, { fullName: 'Α Β', email: 'b@x.gr', role: 'laboratory', employeeCode: '2' }] }) as ValidRequest
    expect(coded.rows.map(item => item.errors)).toEqual([[], []])
  })

  it('needs no e-mail or username for an employee of the list and keeps the invitation choice', () => {
    const request = validateActiveUsersRequest({ organizationId: ORG, users: [{ fullName: 'Α Β', role: 'laboratory', employeeId: EMP, sendInvite: false }, { fullName: 'Γ Δ', email: 'g@d.gr', role: 'laboratory' }] }) as ValidRequest
    expect(request.rows[0].errors).toEqual([])
    expect(request.rows[0].user).toMatchObject({ employeeId: EMP, sendInvite: false })
    expect(request.rows[1].user.sendInvite).toBe(true)
  })

  it('plans the list on the screen: suggested role, issues and the request', () => {
    expect(suggestRole('Μικροβιολόγος', 'department_user')).toBe('laboratory')
    expect(suggestRole('Νοσηλεύτρια', 'link_nurse')).toBe('link_nurse')
    const choices = [
      { employeeId: EMP, name: 'Μαρία Παπαδοπούλου', profession: 'Νοσηλεύτρια', departmentId: DEP, departmentName: 'ΜΕΘ', email: '', phone: '' },
      { employeeId: EMP2, name: 'Γιώργος Νικολάου', profession: 'Ιατρός', departmentId: null, departmentName: 'Άγνωστο', email: 'g@n.gr', phone: '6912345678' },
    ]
    const people = planEmployees(choices, { [EMP2]: { role: 'department_user' } }, [{ id: DEP, name: 'ΜΕΘ' }], 'random', false)
    expect(people[0]).toMatchObject({ employeeId: EMP, departmentId: DEP, errors: [], sendInvite: false })
    expect(employeeIssue(people[0], new Set())).toBe(null)
    expect(employeeIssue(people[0], new Set(['μαρια παπαδοπουλου']))).toBe('NAME_TAKEN')
    expect(employeeIssue(people[1], new Set())).toBe('DEPARTMENT_REQUIRED')
    expect(employeeIssue(planEmployees(choices, {}, [{ id: DEP, name: 'ΜΕΘ' }], 'phone')[0], new Set())).toBe('PHONE_REQUIRED')
    expect(requestUser(people[0])).toMatchObject({ employeeId: EMP, sendInvite: false })
    expect(errorText('NAME_TAKEN')).toBe('Υπάρχει ήδη χρήστης με αυτό το όνομα')
  })

  it('checks duplicates among the people sent, not the whole list, and keeps the division role out of the list', () => {
    const twins = [
      { employeeId: EMP, name: 'Α Β', profession: '', departmentId: DEP, departmentName: 'ΜΕΘ', email: 'same@x.gr', phone: '' },
      { employeeId: EMP2, name: 'Γ Δ', profession: '', departmentId: DEP, departmentName: 'ΜΕΘ', email: 'same@x.gr', phone: '' },
    ]
    const people = planEmployees(twins, {}, [{ id: DEP, name: 'ΜΕΘ' }])
    expect(people.map(person => person.errors)).toEqual([[], []])
    expect(markDuplicates(people).map(person => person.errors)).toEqual([['DUPLICATE_IN_FILE'], ['DUPLICATE_IN_FILE']])
    expect(LIST_ROLES(['department_user', 'division_director', 'laboratory'])).toEqual(['department_user', 'laboratory'])
    const dialog = read('src/features/platform/ActiveUsersDialog.tsx')
    expect(dialog).toContain('const list = markDuplicates(listState.people)')
    expect(dialog).not.toContain('onChange={event => setPasswordMode(event.target.value)}')
  })

  it('accepts the owner\'s own temporary password only when it is strong, on the server and on the screen', () => {
    const request = validateActiveUsersRequest({ organizationId: ORG, users: [
      { fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory', passwordMode: 'custom', password: 'Kalimera-2026' },
      { fullName: 'Γ Δ', email: 'g@x.gr', role: 'laboratory', passwordMode: 'custom', password: 'short' },
      { fullName: 'Ε Ζ', email: 'e@x.gr', role: 'laboratory', passwordMode: 'custom' },
    ] }) as ValidRequest
    expect(request.rows.map(row => row.errors)).toEqual([[], ['PASSWORD_WEAK'], ['PASSWORD_REQUIRED']])
    expect(request.rows[0].user).toMatchObject({ passwordMode: 'custom', password: 'Kalimera-2026' })
    expect(read('supabase/functions/platform-create-active-users/index.ts')).toContain("user.passwordMode==='custom'?user.password:")
    const person = checkPerson({ fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory', passwordMode: 'custom', password: 'Kalimera-2026' })
    expect(person.errors).toEqual([])
    expect(requestUser(person)).toMatchObject({ passwordMode: 'custom', password: 'Kalimera-2026' })
    expect(checkPerson({ fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory', passwordMode: 'custom', password: 'abc' }).errors).toEqual(['PASSWORD_WEAK'])
    expect(requestUser(checkPerson({ fullName: 'Α Β', email: 'a@x.gr', role: 'laboratory', password: 'Kalimera-2026' })).password).toBeUndefined()
    // Excel: a password per row, or the one typed in the window for an empty cell.
    const plan = planFile([['Ονοματεπώνυμο', 'Email', 'Ρόλος', 'Προσωρινός κωδικός'], ['Α Β', 'a@x.gr', 'Εργαστήριο', 'Diko-mou-2026!'], ['Γ Δ', 'g@x.gr', 'Εργαστήριο', '']], [], false, 'custom', true, 'Koinos-2026!!')
    expect(plan.people.map(row => row.password)).toEqual(['Diko-mou-2026!', 'Koinos-2026!!'])
    expect(templateSheet().headers).toContain('Προσωρινός κωδικός')
    // In the list a weak password typed for all does not grey every row (the create button waits instead).
    const listed = planEmployees([{ employeeId: EMP, name: 'Α Β', profession: '', departmentId: DEP, departmentName: 'ΜΕΘ', email: '', phone: '' }], {}, [{ id: DEP, name: 'ΜΕΘ' }], 'custom', true, '')
    expect(listed[0].errors).toEqual(['PASSWORD_REQUIRED'])
    expect(employeeIssue(listed[0], new Set())).toBe(null)
  })

  it('lets the owner give a username to an employee of the list, or leaves it to the system', () => {
    const choice = { employeeId: EMP, name: 'Α Β', profession: '', departmentId: DEP, departmentName: 'ΜΕΘ', email: '', phone: '' }
    const typed = planEmployees([choice], { [EMP]: { role: 'department_user', username: 'MPapadopoulou' } }, [{ id: DEP, name: 'ΜΕΘ' }])[0]
    expect(typed).toMatchObject({ username: 'MPapadopoulou', errors: [] })
    expect(requestUser(typed).username).toBe('MPapadopoulou')
    const automatic = planEmployees([choice], {}, [{ id: DEP, name: 'ΜΕΘ' }])[0]
    expect(requestUser(automatic).username).toBeUndefined()
    const wrong = planEmployees([choice], { [EMP]: { role: 'department_user', username: 'Μαρία' } }, [{ id: DEP, name: 'ΜΕΘ' }])[0]
    expect(employeeIssue(wrong, new Set())).toBe('INVALID_USERNAME')
  })

  it('sends the welcome e-mail only when the owner asked for it', () => {
    const source = read('supabase/functions/platform-create-active-users/index.ts')
    expect(source).toContain('const sendInvite=Boolean(realEmail)&&user.sendInvite')
    expect(source).toContain('if(sendInvite){')
  })
})

describe('«Όνομα χρήστη όταν λείπει» (owner, 23/11/2026)', () => {
  const header = ['Ονοματεπώνυμο', 'Email', 'Όνομα χρήστη', 'Ρόλος', 'Τμήμα', 'Κωδικός εργαζομένου']
  const rows = [header, ['Μαρία Παπαδοπούλου', '', '', 'Εργαστήριο', '', '1001'], ['Γιώργος Χατζής', 'g@example.org', 'GChatzis', 'Εργαστήριο', '', '1002']]
  it('turns Greek names into Latin usernames and reads the employee code', () => {
    expect(latinize('Παπαδοπούλου')).toBe('papadopoulou')
    expect(ruleUsername('surnameInitial', 'Μαρία Παπαδοπούλου', '')).toBe('PapadopoulouM')
    expect(ruleUsername('employeeCode', 'Μαρία Παπαδοπούλου', '1001')).toBe('1001')
    expect(ruleUsername('employeeCode', 'Μαρία', 'A')).toBe('')
    expect(ruleUsername('auto', 'Μαρία Παπαδοπούλου', '1001')).toBe('')
  })
  it('fills only the empty usernames of the file, and says where each one came from', () => {
    const byRule = planFile(rows, [], false, 'random', true, '', 'surnameInitial').people
    expect(byRule.map(person => [person.username, person.usernameSource])).toEqual([['PapadopoulouM', 'rule'], ['GChatzis', 'file']])
    expect(byRule[0].errors).toEqual([])
    const auto = planFile(rows, [], false, 'random', true, '', 'auto').people
    expect(auto[0].username).toBe('')
    expect(auto[0].errors).toContain('EMAIL_OR_USERNAME_REQUIRED')
  })
  it('recognises the username column as other programs name it', () => {
    for (const name of ['Login', 'User ID', 'sAMAccountName', 'Κωδικός χρήστη']) expect(mapHeaders([name]).username).toBe(0)
  })
})
