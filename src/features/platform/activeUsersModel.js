// «Νέος ενεργός χρήστης» / «Εισαγωγή χρηστών από αρχείο» (Platform Owner): the rules
// of the screen, without React, so that they are unit tested. The file has one row per
// person; the same checks run on the server (platform-create-active-users), which
// also knows the existing accounts, usernames and employee codes.
import { ROLE_LABELS, SYSTEM_ROLE_KEYS } from '../../core/permissions/roleLabels'

export const DEPARTMENT_ROLES = Object.freeze(['department_manager', 'link_nurse', 'department_user'])
export const ACTIVE_USERS_CHUNK = 25
export const MAX_FILE_ROWS = 500
export const needsDepartment = role => DEPARTMENT_ROLES.includes(role)

// [key, Greek header, English header, other accepted headers]
const COLUMNS = [
  ['fullName', 'Ονοματεπώνυμο', 'Full name', ['ονομα', 'name', 'ονοματεπωνυμο χρηστη']],
  ['email', 'Email', 'Email', ['e-mail', 'ηλεκτρονικο ταχυδρομειο']],
  ['username', 'Όνομα χρήστη', 'Username', ['user name', 'χρηστης']],
  ['role', 'Ρόλος', 'Role', []],
  ['department', 'Τμήμα', 'Department', ['κλινικη', 'τμημα / κλινικη']],
  ['employeeCode', 'Κωδικός εργαζομένου', 'Employee code', ['κωδικος', 'code']],
]
const REQUIRED_COLUMNS = ['fullName', 'role']

export const fold = value => String(value ?? '').trim().toLocaleLowerCase('el').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/

// The role from its code, its Greek or its English name (any case or accents).
export function resolveRole(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (SYSTEM_ROLE_KEYS.includes(text)) return text
  const folded = fold(text)
  return SYSTEM_ROLE_KEYS.find(role => fold(role) === folded || fold(ROLE_LABELS[role]?.el) === folded || fold(ROLE_LABELS[role]?.en) === folded) || null
}

// departments: [{id, name, nameEn?}] — by Greek or English name.
export function matchDepartment(departments = [], name) {
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
          ['Maria Papadopoulou', 'm.papadopoulou@example.org', '', 'Department User', 'ICU', '1001'],
          ['Georgios Nikolaou', '', 'GNikolaou', 'Laboratory', '', ''],
        ]
      : [
          ['Μαρία Παπαδοπούλου', 'm.papadopoulou@example.org', '', 'Χρήστης Τμήματος', 'ΜΕΘ', '1001'],
          ['Γεώργιος Νικολάου', '', 'GNikolaou', 'Εργαστήριο', '', ''],
        ],
  }
}

// Column index per key, from the header row (Greek or English, any case or accents).
export function mapHeaders(header = []) {
  const map = {}
  header.forEach((cell, index) => {
    const value = fold(cell)
    if (!value) return
    const column = COLUMNS.find(([key, el, en, aliases]) => map[key] == null && [el, en, ...aliases].some(name => fold(name) === value))
    if (column) map[column[0]] = index
  })
  return map
}

// One person as the form or the file gives it, checked without the database.
export function checkPerson(raw, departments = []) {
  const fullName = String(raw.fullName ?? '').trim().replace(/\s+/g, ' ')
  const email = String(raw.email ?? '').trim().toLowerCase()
  const username = String(raw.username ?? '').trim()
  const roleText = String(raw.role ?? '').trim()
  const role = resolveRole(roleText)
  const departmentName = String(raw.department ?? '').trim()
  const department = raw.departmentId ? departments.find(row => row.id === raw.departmentId) || null : matchDepartment(departments, departmentName)
  const employeeCode = String(raw.employeeCode ?? '').trim()
  const errors = []
  if (!fullName) errors.push('FULL_NAME_REQUIRED')
  if (!email && !username) errors.push('EMAIL_OR_USERNAME_REQUIRED')
  if (email && (!EMAIL.test(email) || /\.invalid$/.test(email))) errors.push('INVALID_EMAIL')
  if (username && !USERNAME.test(username)) errors.push('INVALID_USERNAME')
  if (!roleText) errors.push('ROLE_REQUIRED')
  else if (!role) errors.push('ROLE_NOT_ALLOWED')
  if ((departmentName || raw.departmentId) && !department) errors.push('DEPARTMENT_NOT_FOUND')
  else if (role && needsDepartment(role) && !department && !employeeCode) errors.push('DEPARTMENT_REQUIRED')
  return {
    line: raw.line || 1,
    fullName,
    email,
    username,
    roleText,
    role,
    departmentName: department?.name || departmentName,
    departmentId: department?.id || null,
    employeeCode,
    errors,
  }
}

// The same e-mail or username twice: both rows are refused.
export function markDuplicates(people) {
  const keys = person => [person.email && `e:${person.email}`, person.username && `u:${person.username.toLowerCase()}`].filter(Boolean)
  const count = new Map()
  for (const person of people) for (const key of keys(person)) count.set(key, (count.get(key) || 0) + 1)
  return people.map(person => (keys(person).some(key => count.get(key) > 1) && !person.errors.includes('DUPLICATE_IN_FILE') ? { ...person, errors: [...person.errors, 'DUPLICATE_IN_FILE'] } : person))
}

// The rows of the file ([header, ...rows]) as people; empty rows are left out.
export function planFile(rows = [], departments = [], en = false) {
  const [header = [], ...body] = rows
  const columns = mapHeaders(header)
  const missing = REQUIRED_COLUMNS.filter(key => columns[key] == null)
  if (columns.email == null && columns.username == null) missing.push('email')
  if (missing.length) return { missingColumns: missing.map(key => COLUMNS.find(column => column[0] === key)[en ? 2 : 1]), people: [], tooMany: false }
  const cell = (row, key) => (columns[key] == null ? '' : String(row[columns[key]] ?? '').trim())
  const filled = body.map((row, index) => ({ row, line: index + 2 })).filter(({ row }) => row.some(value => String(value ?? '').trim()))
  const people = filled.slice(0, MAX_FILE_ROWS).map(({ row, line }) =>
    checkPerson({ line, fullName: cell(row, 'fullName'), email: cell(row, 'email'), username: cell(row, 'username'), role: cell(row, 'role'), department: cell(row, 'department'), employeeCode: cell(row, 'employeeCode') }, departments),
  )
  return { missingColumns: [], people: markDuplicates(people), tooMany: filled.length > MAX_FILE_ROWS }
}

// What the server receives for one person.
export const requestUser = person => ({
  line: person.line,
  fullName: person.fullName,
  email: person.email || undefined,
  username: person.username || undefined,
  role: person.role || person.roleText,
  departmentId: person.departmentId || undefined,
  departmentName: person.departmentId ? undefined : person.departmentName || undefined,
  employeeCode: person.employeeCode || undefined,
})

// The person with the server's verdict (the first error found locally wins).
export function mergeVerdicts(people, results = []) {
  const byLine = new Map(results.map(result => [result.line, result]))
  return people.map(person => {
    const result = byLine.get(person.line)
    const code = person.errors[0] || result?.code || null
    return { ...person, status: code ? 'error' : 'ok', code }
  })
}

export function previewCounts(people) {
  const ok = people.filter(person => person.status === 'ok').length
  return { ok, error: people.length - ok }
}

const ERRORS = {
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
  PASSWORD_REJECTED: ['Ο προσωρινός κωδικός απορρίφθηκε· δοκιμάστε ξανά', 'The temporary password was rejected; try again'],
  ORGANIZATION_PAUSED: ['Ο οργανισμός είναι σε παύση', 'The organization is suspended'],
}
export function errorText(code, en = false) {
  if (!code) return ''
  return ERRORS[code]?.[en ? 1 : 0] || (en ? 'The account could not be created' : 'Ο λογαριασμός δεν δημιουργήθηκε')
}

// The Excel of the results: who was created, with the username and the temporary password.
export function resultsSheet(results, en = false) {
  return {
    name: en ? 'Accounts' : 'Λογαριασμοί',
    headers: en
      ? ['Full name', 'Username', 'Temporary password', 'Role', 'Department', 'Email', 'Result']
      : ['Ονοματεπώνυμο', 'Όνομα χρήστη', 'Προσωρινός κωδικός', 'Ρόλος', 'Τμήμα', 'Email', 'Αποτέλεσμα'],
    rows: results.map(row => [
      row.fullName,
      row.username || '',
      row.temporaryPassword || '',
      row.role ? ROLE_LABELS[row.role]?.[en ? 'en' : 'el'] || row.role : row.roleText,
      row.departmentName || '',
      row.email || '',
      row.status === 'created' ? (en ? 'Created · active' : 'Δημιουργήθηκε · ενεργός') : errorText(row.code, en),
    ]),
  }
}
