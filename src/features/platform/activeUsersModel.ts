// «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο» (Platform Owner): the rules
// of the screen, without React, so that they are unit tested. The file has one row per
// person; the same checks run on the server (platform-create-active-users), which
// also knows the existing accounts, usernames and employee codes.
import { ROLE_LABELS, SYSTEM_ROLE_KEYS } from '../../core/permissions/roleLabels'

const ROLE_NAMES = ROLE_LABELS as Record<string, { el: string, en: string }>
// Τμήμα όπως το δίνει η οθόνη ή η βάση: [{id, name, nameEn?}].
export type DepartmentChoice = { id: string, name: string, nameEn?: string | null, is_active?: boolean | null }
export type PasswordMode = 'random' | 'phone'
// Ένα πρόσωπο όπως το δίνει η φόρμα ή μια γραμμή του αρχείου (πριν τον έλεγχο).
export type PersonInput = {
  line?: number
  fullName?: string
  email?: string
  username?: string
  role?: string | null
  department?: string
  departmentId?: string | null
  employeeCode?: string
  phone?: string
  passwordMode?: string
  divisionName?: string
  departmentIds?: string[]
  divisionDepartments?: string
}
// Το πρόσωπο μετά τον έλεγχο χωρίς βάση (checkPerson).
export type CheckedPerson = {
  line: number
  fullName: string
  email: string
  username: string
  roleText: string
  role: string | null
  departmentName: string
  departmentId: string | null
  employeeCode: string
  phone: string
  passwordMode: PasswordMode
  divisionName: string
  departmentIds: string[]
  errors: string[]
}
// Η απάντηση του server για μία γραμμή του ελέγχου (dryRun).
export type ActiveUserVerdict = { line: number, status?: string, code?: string | null }
// Το πρόσωπο με την τελική κρίση της προεπισκόπησης (mergeVerdicts).
export type PreviewPerson = CheckedPerson & { status: 'ok' | 'error', code: string | null }
// Το αποτέλεσμα του server για έναν λογαριασμό που δημιουργήθηκε (ή απέτυχε).
export type ActiveUserResult = { line: number, status: string, code: string | null, username?: string, temporaryPassword?: string, temporaryPasswordExpiresAt?: string | null, welcomeEmail?: boolean }
// Γραμμή των αποτελεσμάτων: το πρόσωπο μαζί με το αποτέλεσμα του server.
export type CreatedActiveUser = Partial<CheckedPerson> & ActiveUserResult & { email: string }
// Όσα διαβάζει το Excel των αποτελεσμάτων.
export type ResultSheetRow = { fullName?: string, username?: string, temporaryPassword?: string, temporaryPasswordExpiresAt?: string | null, role?: string | null, roleText?: string, divisionName?: string, departmentName?: string, email?: string, status?: string, code?: string | null }
export type FilePlan = { missingColumns: string[], people: CheckedPerson[], tooMany: boolean }

export const DEPARTMENT_ROLES = Object.freeze(['department_manager', 'link_nurse', 'department_user'])
export const ACTIVE_USERS_CHUNK = 25
export const MAX_FILE_ROWS = 500
export const needsDepartment = (role: string | null | undefined) => DEPARTMENT_ROLES.includes(role as string)
// The roles that see several departments of a division, chosen one by one (not a single department).
export const DIVISION_ROLES = Object.freeze(['division_director'])
export const isDivisionRole = (role: string | null | undefined) => DIVISION_ROLES.includes(role as string)
export const TEMPORARY_PASSWORD_DAYS = 7

// A Greek mobile number as digits only: +30 / 0030, spaces and dashes are dropped; 10 digits starting with 69.
export function normalizeMobile(value: unknown) {
  const digits = String(value ?? '').replace(/[^\d+]/g, '')
  return digits.replace(/^\+?30(?=69)/, '').replace(/^0030(?=69)/, '').replace(/\D/g, '')
}
export const isValidMobile = (value: unknown) => /^69\d{8}$/.test(normalizeMobile(value))
// The departments of a division director in a file cell: «ΜΕΘ; Χειρουργική» (or separated by commas or lines).
export const splitNames = (value: unknown) => [...new Set(String(value ?? '').split(/[;,\n\r]+/).map(name => name.trim()).filter(Boolean))]

// [key, Greek header, English header, other accepted headers]
const COLUMNS: [string, string, string, string[]][] = [
  ['fullName', 'Ονοματεπώνυμο', 'Full name', ['ονομα', 'name', 'ονοματεπωνυμο χρηστη']],
  ['email', 'Email', 'Email', ['e-mail', 'ηλεκτρονικο ταχυδρομειο']],
  ['username', 'Όνομα χρήστη', 'Username', ['user name', 'χρηστης']],
  ['role', 'Ρόλος', 'Role', []],
  ['department', 'Τμήμα', 'Department', ['κλινικη', 'τμημα / κλινικη']],
  ['employeeCode', 'Κωδικός εργαζομένου', 'Employee code', ['κωδικος', 'code']],
  ['phone', 'Κινητό', 'Mobile', ['κινητο τηλεφωνο', 'τηλεφωνο', 'mobile phone', 'phone']],
  ['division', 'Διεύθυνση', 'Division', ['διευθυνση διευθυντη']],
  ['divisionDepartments', 'Τμήματα που βλέπει', 'Departments seen', ['τμηματα διευθυνσης', 'τμηματα διευθυντη']],
]
const REQUIRED_COLUMNS = ['fullName', 'role']

export const fold = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('el').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/

// The role from its code, its Greek or its English name (any case or accents).
export function resolveRole(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (SYSTEM_ROLE_KEYS.includes(text)) return text
  const folded = fold(text)
  return SYSTEM_ROLE_KEYS.find(role => fold(role) === folded || fold(ROLE_NAMES[role]?.el) === folded || fold(ROLE_NAMES[role]?.en) === folded) || null
}

// departments: [{id, name, nameEn?}] — by Greek or English name.
export function matchDepartment(departments: DepartmentChoice[] = [], name: string) {
  const folded = fold(name)
  if (!folded) return null
  return departments.find(row => fold(row.name) === folded || (row.nameEn && fold(row.nameEn) === folded)) || null
}

export function templateSheet(en = false) {
  return {
    name: en ? 'Users' : 'Χρήστες',
    headers: COLUMNS.map(column => (en ? column[2] : column[1])),
    rows: en
      ? [
          ['Maria Papadopoulou', 'm.papadopoulou@example.org', '', 'Department User', 'ICU', '1001', '6912345678', '', ''],
          ['Georgios Nikolaou', '', 'GNikolaou', 'Laboratory', '', '', '', '', ''],
          ['Eleni Ioannou', '', 'EIoannou', 'Division Director', '', '', '6987654321', 'Nursing Service', 'ICU; Surgery'],
        ]
      : [
          ['Μαρία Παπαδοπούλου', 'm.papadopoulou@example.org', '', 'Χρήστης Τμήματος', 'ΜΕΘ', '1001', '6912345678', '', ''],
          ['Γεώργιος Νικολάου', '', 'GNikolaou', 'Εργαστήριο', '', '', '', '', ''],
          ['Ελένη Ιωάννου', '', 'EIoannou', 'Διευθυντής Διεύθυνσης', '', '', '6987654321', 'Νοσηλευτική Υπηρεσία', 'ΜΕΘ; Χειρουργική'],
        ],
  }
}

// Column index per key, from the header row (Greek or English, any case or accents).
export function mapHeaders(header: unknown[] = []) {
  const map: Record<string, number> = {}
  header.forEach((cell, index) => {
    const value = fold(cell)
    if (!value) return
    const column = COLUMNS.find(([key, el, en, aliases]) => map[key] == null && [el, en, ...aliases].some(name => fold(name) === value))
    if (column) map[column[0]] = index
  })
  return map
}

// One person as the form or the file gives it, checked without the database.
export function checkPerson(raw: PersonInput, departments: DepartmentChoice[] = []): CheckedPerson {
  const fullName = String(raw.fullName ?? '').trim().replace(/\s+/g, ' ')
  const email = String(raw.email ?? '').trim().toLowerCase()
  const username = String(raw.username ?? '').trim()
  const roleText = String(raw.role ?? '').trim()
  const role = resolveRole(roleText)
  const departmentName = String(raw.department ?? '').trim()
  const department = raw.departmentId ? departments.find(row => row.id === raw.departmentId) || null : matchDepartment(departments, departmentName)
  const employeeCode = String(raw.employeeCode ?? '').trim()
  const phoneText = String(raw.phone ?? '').trim()
  const phone = normalizeMobile(phoneText)
  const passwordMode: PasswordMode = raw.passwordMode === 'phone' ? 'phone' : 'random'
  const divisionName = String(raw.divisionName ?? '').trim().replace(/\s+/g, ' ')
  // A division director: the departments chosen in the form (ids) or named in the file.
  const chosenIds = Array.isArray(raw.departmentIds) ? raw.departmentIds : []
  const namedDepartments = splitNames(raw.divisionDepartments)
  const matchedByName = namedDepartments.map(name => matchDepartment(departments, name))
  const departmentIds: string[] = [...new Set<string>([...chosenIds, ...matchedByName.filter((row): row is DepartmentChoice => Boolean(row)).map(row => row.id)])].filter(id => departments.some(row => row.id === id))
  const errors: string[] = []
  if (!fullName) errors.push('FULL_NAME_REQUIRED')
  if (!email && !username) errors.push('EMAIL_OR_USERNAME_REQUIRED')
  if (email && (!EMAIL.test(email) || /\.invalid$/.test(email))) errors.push('INVALID_EMAIL')
  if (username && !USERNAME.test(username)) errors.push('INVALID_USERNAME')
  if (!roleText) errors.push('ROLE_REQUIRED')
  else if (!role) errors.push('ROLE_NOT_ALLOWED')
  if (isDivisionRole(role)) {
    if (!divisionName) errors.push('DIVISION_REQUIRED')
    if (matchedByName.some(row => !row) || chosenIds.some((id: string) => !departments.some(row => row.id === id))) errors.push('DEPARTMENT_NOT_FOUND')
    else if (!departmentIds.length) errors.push('DEPARTMENTS_REQUIRED')
  } else if ((departmentName || raw.departmentId) && !department) errors.push('DEPARTMENT_NOT_FOUND')
  else if (role && needsDepartment(role) && !department && !employeeCode) errors.push('DEPARTMENT_REQUIRED')
  if (passwordMode === 'phone' && !phoneText) errors.push('PHONE_REQUIRED')
  else if (phoneText && !isValidMobile(phoneText)) errors.push('PHONE_INVALID')
  return {
    line: raw.line || 1,
    fullName,
    email,
    username,
    roleText,
    role,
    departmentName: isDivisionRole(role) ? departments.filter(row => departmentIds.includes(row.id)).map(row => row.name).join(', ') : department?.name || departmentName,
    departmentId: department?.id || null,
    employeeCode,
    phone,
    passwordMode,
    divisionName,
    departmentIds: isDivisionRole(role) ? departmentIds : [],
    errors,
  }
}

// The same e-mail or username twice: both rows are refused.
export function markDuplicates(people: CheckedPerson[]) {
  const keys = (person: CheckedPerson) => [person.email && `e:${person.email}`, person.username && `u:${person.username.toLowerCase()}`].filter(Boolean)
  const count = new Map<string, number>()
  for (const person of people) for (const key of keys(person)) count.set(key, (count.get(key) || 0) + 1)
  return people.map((person: CheckedPerson) => (keys(person).some(key => (count.get(key) || 0) > 1) && !person.errors.includes('DUPLICATE_IN_FILE') ? { ...person, errors: [...person.errors, 'DUPLICATE_IN_FILE'] } : person))
}

// The rows of the file ([header, ...rows]) as people; empty rows are left out.
export function planFile(rows: unknown[][] = [], departments: DepartmentChoice[] = [], en = false, passwordMode = 'random'): FilePlan {
  const [header = [], ...body] = rows
  const columns = mapHeaders(header)
  const missing = REQUIRED_COLUMNS.filter(key => columns[key] == null)
  if (columns.email == null && columns.username == null) missing.push('email')
  if (missing.length) return { missingColumns: missing.map(key => COLUMNS.find(column => column[0] === key)![en ? 2 : 1]), people: [], tooMany: false }
  const cell = (row: unknown[], key: string) => (columns[key] == null ? '' : String(row[columns[key]] ?? '').trim())
  const filled = body.map((row, index) => ({ row, line: index + 2 })).filter(({ row }) => row.some(value => String(value ?? '').trim()))
  const people = filled.slice(0, MAX_FILE_ROWS).map(({ row, line }) =>
    checkPerson({ line, fullName: cell(row, 'fullName'), email: cell(row, 'email'), username: cell(row, 'username'), role: cell(row, 'role'), department: cell(row, 'department'), employeeCode: cell(row, 'employeeCode'), phone: cell(row, 'phone'), passwordMode, divisionName: cell(row, 'division'), divisionDepartments: cell(row, 'divisionDepartments') }, departments),
  )
  return { missingColumns: [], people: markDuplicates(people), tooMany: filled.length > MAX_FILE_ROWS }
}

// What the server receives for one person.
export const requestUser = (person: CheckedPerson) => ({
  line: person.line,
  fullName: person.fullName,
  email: person.email || undefined,
  username: person.username || undefined,
  role: person.role || person.roleText,
  departmentId: person.departmentId || undefined,
  departmentName: person.departmentId ? undefined : person.departmentName || undefined,
  employeeCode: person.employeeCode || undefined,
  phone: person.phone || undefined,
  passwordMode: person.passwordMode === 'phone' ? 'phone' : undefined,
  divisionName: person.divisionName || undefined,
  departmentIds: person.departmentIds?.length ? person.departmentIds : undefined,
})

// The person with the server's verdict (the first error found locally wins).
export function mergeVerdicts(people: CheckedPerson[], results: ActiveUserVerdict[] = []): PreviewPerson[] {
  const byLine = new Map(results.map(result => [result.line, result]))
  return people.map((person: CheckedPerson) => {
    const result = byLine.get(person.line)
    const code = person.errors[0] || result?.code || null
    return { ...person, status: code ? 'error' : 'ok', code }
  })
}

export function previewCounts(people: Pick<PreviewPerson, 'status'>[]) {
  const ok = people.filter(person => person.status === 'ok').length
  return { ok, error: people.length - ok }
}

const ERRORS: Record<string, [string, string]> = {
  FULL_NAME_REQUIRED: ['Λείπει το ονοματεπώνυμο', 'Full name is missing'],
  EMAIL_OR_USERNAME_REQUIRED: ['Χρειάζεται email ή όνομα χρήστη', 'An e-mail or a username is needed'],
  INVALID_EMAIL: ['Μη έγκυρο email', 'Invalid e-mail'],
  INVALID_USERNAME: ['Μη έγκυρο όνομα χρήστη (3–40 λατινικοί χαρακτήρες, αριθμοί, . _ -)', 'Invalid username (3–40 Latin letters, digits, . _ -)'],
  ROLE_REQUIRED: ['Λείπει ο ρόλος', 'Role is missing'],
  ROLE_NOT_ALLOWED: ['Άγνωστος ρόλος', 'Unknown role'],
  DEPARTMENT_INVALID: ['Μη έγκυρο τμήμα', 'Invalid department'],
  DEPARTMENT_NOT_FOUND: ['Το τμήμα δεν βρέθηκε στο νοσοκομείο', 'Department not found in the hospital'],
  DEPARTMENT_REQUIRED: ['Ο ρόλος χρειάζεται τμήμα', 'The role needs a department'],
  DUPLICATE_IN_FILE: ['Το email ή το όνομα χρήστη επαναλαμβάνεται', 'E-mail or username repeated'],
  ACCOUNT_EXISTS: ['Υπάρχει ήδη λογαριασμός με αυτό το email', 'An account with this e-mail already exists'],
  USERNAME_TAKEN: ['Το όνομα χρήστη χρησιμοποιείται ήδη', 'The username is already taken'],
  EMPLOYEE_NOT_FOUND: ['Ο κωδικός εργαζομένου δεν βρέθηκε', 'Employee code not found'],
  EMPLOYEE_ALREADY_LINKED: ['Ο εργαζόμενος έχει ήδη λογαριασμό', 'The employee already has an account'],
  PHONE_REQUIRED: ['Ο κωδικός είναι το κινητό: λείπει ο αριθμός', 'The password is the mobile number: the number is missing'],
  PHONE_INVALID: ['Μη έγκυρο κινητό (10 ψηφία, ξεκινά από 69)', 'Invalid mobile number (10 digits starting with 69)'],
  DIVISION_REQUIRED: ['Ο ρόλος χρειάζεται διεύθυνση', 'The role needs a division'],
  DIVISION_NOT_FOUND: ['Η διεύθυνση δεν βρέθηκε', 'Division not found'],
  DEPARTMENTS_REQUIRED: ['Επιλέξτε τα τμήματα που θα βλέπει', 'Choose the departments they will see'],
  DIVISION_SAVE_FAILED: ['Δεν αποθηκεύτηκε η διεύθυνση του χρήστη', 'The division could not be saved'],
  PASSWORD_REJECTED: ['Ο προσωρινός κωδικός απορρίφθηκε· δοκιμάστε ξανά', 'The temporary password was rejected; try again'],
  ORGANIZATION_PAUSED: ['Ο οργανισμός είναι σε παύση', 'The organization is suspended'],
}
export function errorText(code: string | null | undefined, en = false) {
  if (!code) return ''
  return ERRORS[code]?.[en ? 1 : 0] || (en ? 'The account could not be created' : 'Ο λογαριασμός δεν δημιουργήθηκε')
}

// The Excel of the results: who was created, with the username and the temporary password.
export function resultsSheet(results: ResultSheetRow[], en = false) {
  return {
    name: en ? 'Accounts' : 'Λογαριασμοί',
    headers: en
      ? ['Full name', 'Username', 'Temporary password', 'Valid until', 'Role', 'Division', 'Department', 'Email', 'Result']
      : ['Ονοματεπώνυμο', 'Όνομα χρήστη', 'Προσωρινός κωδικός', 'Ισχύει έως', 'Ρόλος', 'Διεύθυνση', 'Τμήμα', 'Email', 'Αποτέλεσμα'],
    rows: results.map((row: ResultSheetRow) => [
      row.fullName,
      row.username || '',
      row.temporaryPassword || '',
      row.temporaryPasswordExpiresAt ? String(row.temporaryPasswordExpiresAt).slice(0, 10).split('-').reverse().join('/') : '',
      row.role ? ROLE_NAMES[row.role]?.[en ? 'en' : 'el'] || row.role : row.roleText,
      row.divisionName || '',
      row.departmentName || '',
      row.email || '',
      row.status === 'created' ? (en ? 'Created · active' : 'Δημιουργήθηκε · ενεργός') : errorText(row.code, en),
    ]),
  }
}
