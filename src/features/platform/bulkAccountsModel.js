// N1 · «Εργαζόμενοι χωρίς λογαριασμό» (Platform Owner): the rules of the screen,
// without React, so that they are unit tested. A row is one active employee of the
// hospital with its account state (platform_employee_accounts). The owner selects
// rows, gives each a role (required, empty at first, never suggested) and, for the
// department roles, a department; nothing is written before the confirmation.

// The roles that need a department (organization_member_scopes).
export const DEPARTMENT_ROLES = Object.freeze(['department_manager', 'link_nurse', 'department_user'])
// The roles offered in bulk, in the order of the design. The Hospital Admin is
// given only one by one («Νέος χρήστης»), never in bulk.
export const BULK_ROLES = Object.freeze([
  'department_user',
  'department_manager',
  'link_nurse',
  'infection_control_member',
  'infection_control_lead',
  'laboratory',
  'pharmacy',
  'doctor_reviewer',
  'occupational_physician',
  'hr_office',
  'quality_manager',
  'committee_secretariat',
  'hospital_director',
  'staff_user',
])
export const MAX_RUN = 200
// The server takes at most 25 people per call: the screen sends the run in chunks.
export const CHUNK_SIZE = 25
export const RESEND_CHUNK_SIZE = 50
export const ACCOUNT_FILTERS = Object.freeze(['none', 'pending', 'active', 'all'])

export const needsDepartment = role => DEPARTMENT_ROLES.includes(role)

// The RPC row (snake_case) as the screen uses it.
export function normalizeRosterRow(raw = {}) {
  return {
    employeeId: raw.employee_id,
    name: raw.full_name || '—',
    profession: raw.profession_name || '',
    departmentId: raw.department_id || null,
    departmentName: raw.department_name || '',
    email: raw.email || '',
    userId: raw.user_id || null,
    username: raw.username || '',
    memberRole: raw.member_role || null,
    accountState: raw.account_state || 'none',
    blockedReason: raw.blocked_reason || null,
    existing: raw.existing_user_id
      ? {
          userId: raw.existing_user_id,
          name: raw.existing_name || '',
          isDemo: Boolean(raw.existing_is_demo),
          organizations: Array.isArray(raw.existing_organizations) ? raw.existing_organizations : [],
        }
      : null,
    itemStatus: raw.item_status || null,
    itemError: raw.item_error || null,
    itemRole: raw.item_role || null,
    itemBatchId: raw.item_batch_id || null,
    itemCreatedAt: raw.item_created_at || null,
    sendCount: Number(raw.send_count || 0),
    lastSentAt: raw.last_sent_at || null,
    invitationCreatedAt: raw.invitation_created_at || null,
    invitationExpiresAt: raw.invitation_expires_at || null,
    invitationAcceptedAt: raw.invitation_accepted_at || null,
    invitationRevokedAt: raw.invitation_revoked_at || null,
    invitationOpened: Boolean(raw.invitation_opened),
    emailStatus: raw.email_status || null,
    emailError: raw.email_error || null,
  }
}

// Which chip a row belongs to.
export function accountGroup(row) {
  if (row.accountState === 'none') return 'none'
  if (row.accountState === 'invited') return 'pending'
  if (row.accountState === 'active') return 'active'
  return 'other'
}

// A row can be ticked: in «Χωρίς λογαριασμό» an employee with no account and a
// usable e-mail; in «Έχει λογαριασμό – δεν ενεργοποίησε» a pending account
// (for «Ξαναστείλε»), never a Hospital Admin's.
export function rowSelectable(row, filter) {
  if (filter === 'pending') return row.accountState === 'invited' && row.memberRole !== 'hospital_admin'
  return row.accountState === 'none' && !row.blockedReason && !(row.existing && row.existing.isDemo)
}

export function chipCounts(rows) {
  const counts = { none: 0, pending: 0, active: 0, all: rows.length }
  for (const row of rows) {
    const group = accountGroup(row)
    if (group in counts) counts[group]++
  }
  return counts
}

// The latest run, for its chip «Δημιουργία <ημερομηνία>» and its result view.
export function latestBatch(rows) {
  let latest = null
  for (const row of rows) {
    if (!row.itemBatchId || !row.itemCreatedAt) continue
    if (!latest || row.itemCreatedAt > latest.createdAt) latest = { id: row.itemBatchId, createdAt: row.itemCreatedAt }
  }
  if (!latest) return null
  return { ...latest, count: rows.filter(row => row.itemBatchId === latest.id).length }
}

const fold = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function filterRows(rows, { filter = 'none', batchId = null, query = '', departmentId = '', profession = '' } = {}) {
  const q = fold(query.trim())
  return rows.filter(row => {
    if (filter === 'batch') {
      if (row.itemBatchId !== batchId) return false
    } else if (filter !== 'all' && accountGroup(row) !== filter) return false
    if (departmentId && row.departmentId !== departmentId) return false
    if (profession && row.profession !== profession) return false
    if (q && ![row.name, row.profession, row.email, row.departmentName, row.username].some(value => fold(value).includes(q))) return false
    return true
  })
}

// A role chosen for one row: the department roles take the employee's own
// department unless one was chosen; the other roles have no department.
export function setRowRole(drafts, row, role) {
  const current = drafts[row.employeeId] || {}
  const departmentId = needsDepartment(role) ? current.departmentId || row.departmentId || null : null
  return { ...drafts, [row.employeeId]: { role, departmentId } }
}

export function setRowDepartment(drafts, row, departmentId) {
  const current = drafts[row.employeeId] || {}
  return { ...drafts, [row.employeeId]: { ...current, departmentId: departmentId || null } }
}

// «Ορισμός ρόλου σε όλους τους επιλεγμένους»: only the selected rows without a
// role, unless «Αντικατάσταση και όσων έχουν ήδη ρόλο» is ticked. scope 'own'
// gives each department role the employee's own department, 'one' the chosen one.
export function applyRoleToSelected(drafts, selectedIds, rowsById, { role, replace = false, scope = 'own', departmentId = null }) {
  const next = { ...drafts }
  for (const id of selectedIds) {
    const row = rowsById.get(id)
    if (!row) continue
    if (next[id]?.role && !replace) continue
    next[id] = {
      role,
      departmentId: needsDepartment(role) ? (scope === 'one' ? departmentId : row.departmentId) || null : null,
    }
  }
  return next
}

// The selected rows the bulk role would change.
export function bulkRoleTargets(drafts, selectedIds, replace) {
  return [...selectedIds].filter(id => replace || !drafts[id]?.role)
}

export function selectionSummary(selectedIds, drafts, rowsById) {
  let missingRole = 0
  let missingDepartment = 0
  const missingNames = []
  for (const id of selectedIds) {
    const draft = drafts[id]
    if (!draft?.role) {
      missingRole++
      const row = rowsById.get(id)
      if (row) missingNames.push(row.name)
      continue
    }
    if (needsDepartment(draft.role) && !draft.departmentId) missingDepartment++
  }
  const selected = [...selectedIds].length
  return { selected, missingRole, missingDepartment, missingNames, ready: selected > 0 && selected <= MAX_RUN && !missingRole && !missingDepartment }
}

export function buildItems(selectedIds, drafts) {
  return [...selectedIds].map(id => ({ employeeId: id, role: drafts[id].role, departmentId: needsDepartment(drafts[id].role) ? drafts[id].departmentId || null : null }))
}

export function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// The result of one person, from the roster row:
//   activated  the account is active (password set);
//   linked     an existing account (another hospital) got this hospital;
//   sent       created, e-mail sent or waiting, link still valid;
//   expired    created, the link expired or was revoked without a newer one;
//   failed     the creation failed (item_error), or the e-mail was rejected.
export function resultStatus(row, now = new Date()) {
  if (row.accountState === 'active') return row.itemStatus === 'linked_existing' ? 'linked' : 'activated'
  if (row.accountState === 'invited') {
    if (row.emailStatus === 'failed') return 'failed'
    if (row.invitationRevokedAt || (row.invitationExpiresAt && new Date(row.invitationExpiresAt) <= now)) return 'expired'
    return 'sent'
  }
  if (row.itemStatus === 'failed') return 'failed'
  return 'none'
}

// The order of the result view: what needs attention first.
const RESULT_ORDER = ['failed', 'expired', 'sent', 'linked', 'activated', 'none']
export const sortByResult = (rows, now = new Date()) =>
  [...rows].sort((a, b) => RESULT_ORDER.indexOf(resultStatus(a, now)) - RESULT_ORDER.indexOf(resultStatus(b, now)) || a.name.localeCompare(b.name, 'el'))

export function resultTotals(rows, now = new Date()) {
  const totals = { createdOrLinked: 0, activated: 0, pending: 0, failed: 0 }
  for (const row of rows) {
    const status = resultStatus(row, now)
    if (row.accountState !== 'none') totals.createdOrLinked++
    if (status === 'activated' || status === 'linked') totals.activated++
    else if (status === 'sent' || status === 'expired') totals.pending++
    else if (status === 'failed') totals.failed++
  }
  return totals
}

const REASONS = {
  missing_email: ['Λείπει email · συμπληρώστε το στην καρτέλα εργαζομένου', 'Missing e-mail · add it in the employee record'],
  invalid_email: ['Μη έγκυρο email · διορθώστε το στην καρτέλα εργαζομένου', 'Invalid e-mail · correct it in the employee record'],
  duplicate_email: ['Το ίδιο email σε δύο εργαζόμενους · διορθώστε στην καρτέλα', 'Same e-mail on two employees · correct it in the record'],
  email_in_this_org: ['Το email ανήκει ήδη σε χρήστη του νοσοκομείου · συνδέστε από τους Λογαριασμούς', 'The e-mail already belongs to a user here · link it from Accounts'],
  account_in_use: ['Το email χρησιμοποιείται ήδη σε άλλον οργανισμό · μόνο ο Owner το συνδέει', 'The e-mail is already used in another organization · only the Owner links it'],
  MISSING_EMAIL: ['λείπει email', 'missing e-mail'],
  INVALID_EMAIL: ['μη έγκυρο email', 'invalid e-mail'],
  DUPLICATE_EMAIL: ['το ίδιο email σε δύο εργαζόμενους', 'same e-mail on two employees'],
  EMAIL_IN_THIS_ORG: ['το email ανήκει ήδη σε χρήστη του νοσοκομείου', 'the e-mail already belongs to a user here'],
  EMPLOYEE_ALREADY_LINKED: ['ο εργαζόμενος συνδέθηκε στο μεταξύ με λογαριασμό', 'the employee was linked to an account meanwhile'],
  EMPLOYEE_NOT_FOUND: ['ο εργαζόμενος δεν βρέθηκε', 'employee not found'],
  EMPLOYEE_INACTIVE: ['ο εργαζόμενος δεν είναι ενεργός', 'the employee is not active'],
  DEPARTMENT_REQUIRED: ['λείπει τμήμα για τον ρόλο', 'the role needs a department'],
  ALREADY_IN_PROGRESS: ['βρίσκεται ήδη σε άλλη δημιουργία', 'already in another run'],
  ALREADY_MEMBER: ['έχει ήδη λογαριασμό στο νοσοκομείο', 'already has an account here'],
  EXISTING_ACCOUNT_CONFLICT: ['υπάρχων λογαριασμός Demo με το ίδιο email · χειροκίνητη επίλυση', 'an existing Demo account uses this e-mail · resolve manually'],
  EXISTING_ACCOUNT_NEEDS_CONFIRMATION: ['το email έχει ήδη λογαριασμό · χρειάζεται επιβεβαίωση', 'the e-mail already has an account · confirmation needed'],
  ACCOUNT_IN_USE: ['το email χρησιμοποιείται ήδη σε άλλον οργανισμό · μόνο ο Owner το συνδέει', 'the e-mail is used in another organization · only the Owner links it'],
  EMAIL_REJECTED: ['ο διακομιστής απέρριψε το email (η διεύθυνση δεν υπάρχει)', 'the mail server rejected the e-mail (no such address)'],
  AUDIT_FAILED: ['δεν καταγράφηκε στο Ιστορικό · δεν ολοκληρώθηκε', 'not recorded in the history · not completed'],
  EMAIL_FAILED: ['το email δεν στάλθηκε ακόμη · θα ξαναδοκιμαστεί', 'the e-mail was not sent yet · it will be retried'],
  INTERRUPTED: ['η δημιουργία διακόπηκε · δοκιμάστε ξανά', 'the run was interrupted · try again'],
  ACCOUNT_REMOVED: ['ο λογαριασμός διαγράφηκε στο μεταξύ', 'the account was deleted meanwhile'],
  PROFILE_FAILED: ['δεν αποθηκεύτηκε το προφίλ · δοκιμάστε ξανά', 'the profile was not saved · try again'],
  INVITATION_FAILED: ['δεν δημιουργήθηκε ο σύνδεσμος · δοκιμάστε ξανά', 'the link was not created · try again'],
  OUTBOX_FAILED: ['δεν μπήκε το email στην ουρά · δοκιμάστε ξανά', 'the e-mail was not queued · try again'],
  ITEM_FAILED: ['δεν καταχωρίστηκε · δοκιμάστε ξανά', 'not recorded · try again'],
  AUTH_ERROR: ['σφάλμα δημιουργίας λογαριασμού', 'account creation error'],
}
export function reasonText(code, language = 'el') {
  const entry = REASONS[code]
  if (entry) return entry[language === 'en' ? 1 : 0]
  return code ? String(code) : ''
}
// An SMTP rejection (5xx) of the e-mail of a created account.
export const emailFailureCode = error => (/\b5\d\d\b|reject|not exist|unknown user|mailbox/i.test(String(error || '')) ? 'EMAIL_REJECTED' : 'EMAIL_FAILED')
