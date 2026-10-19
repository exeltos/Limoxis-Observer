import { certificationState, daysBetween, todayIso } from './resourceModel'

// Renewal of expired supplier certificates by e-mail
// (20261129100000_quality_supplier_certificate_request_items.sql): one request (one
// e-mail, one link) per supplier, with one item per certificate; the queue of
// certificates to renew grouped by supplier, the states, who may send, and the
// checks of the supplier's form. Pure functions.

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
const toneOf = (list, value) => list.find(item => item.value === value)?.tone || 'neutral'

// The request (the supplier's e-mail).
export const REQUEST_STATUSES = [
  { value: 'proposed', label: ['Προτάθηκε, αναμένει έγκριση', 'Proposed, awaiting approval'], tone: 'neutral' },
  { value: 'sent', label: ['Στάλθηκε, αναμένεται', 'Sent, awaiting'], tone: 'info' },
  { value: 'closed', label: ['Ολοκληρώθηκε', 'Completed'], tone: 'success' },
  { value: 'cancelled', label: ['Ακυρώθηκε', 'Cancelled'], tone: 'neutral' },
]
export const requestStatusLabel = (value, language) => pick(REQUEST_STATUSES, value, language)
export const requestStatusTone = value => toneOf(REQUEST_STATUSES, value)
export const OPEN_REQUEST_STATUSES = ['proposed', 'sent']
export const isOpenRequest = request => OPEN_REQUEST_STATUSES.includes(request?.status)

// One certificate of a request.
export const ITEM_STATUSES = [
  { value: 'pending', label: ['Αναμένεται', 'Awaiting'], tone: 'info' },
  { value: 'submitted', label: ['Υποβλήθηκε, προς έλεγχο', 'Submitted, to review'], tone: 'warning' },
  { value: 'accepted', label: ['Έγινε αποδεκτό', 'Accepted'], tone: 'success' },
  { value: 'rejected', label: ['Απορρίφθηκε', 'Rejected'], tone: 'danger' },
  { value: 'cancelled', label: ['Ακυρώθηκε', 'Cancelled'], tone: 'neutral' },
]
export const itemStatusLabel = (value, language) => pick(ITEM_STATUSES, value, language)
export const itemStatusTone = value => toneOf(ITEM_STATUSES, value)
// A certificate in progress: it has at most one such item.
export const OPEN_ITEM_STATUSES = ['pending', 'submitted']
export const isOpenItem = item => OPEN_ITEM_STATUSES.includes(item?.status)

// A sent request with nothing submitted after this many days has no answer yet.
export const NO_RESPONSE_DAYS = 7
export const SENDER_ONLY_HINT = ['Μόνο ο Platform Owner ή όσοι έχει ορίσει', 'Only the Platform Owner or the people they designate']
export const senderOnlyHint = language => SENDER_ONLY_HINT[language === 'en' ? 1 : 0]

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const isEmail = value => EMAIL.test(String(value || '').trim())

// The addresses a request can go to: the supplier's e-mail, then its contacts'.
export function recipientsFor(supplier = {}) {
  const all = [supplier.email, ...(supplier.contacts || []).map(item => item.email)].map(value => String(value || '').trim().toLowerCase()).filter(isEmail)
  return [...new Set(all)]
}

const attachmentFrom = row => (row ? { id: row.id, name: row.file_name, storagePath: row.storage_path, type: row.mime_type || '', size: row.size_bytes || 0 } : null)
export const itemFromRow = row => ({
  id: row.id, requestId: row.request_id, supplierId: row.supplier_id, certificationId: row.certification_id, status: row.status, snapshot: row.certificate_snapshot || {},
  submittedAt: row.submitted_at || '',
  submitted: { type: row.certificate_type || '', number: row.certificate_number || '', issuer: row.issuer || '', issuedOn: row.issued_on || '', expiresOn: row.expires_on || '', note: row.note || '' },
  attachment: attachmentFrom(row.attachment), reviewedAt: row.reviewed_at || '', reviewComment: row.review_comment || '', previous: row.previous_values || null, history: row.history || [], updatedAt: row.updated_at || '',
})
export const requestFromRow = row => ({
  id: row.id, supplierId: row.supplier_id, recipientEmail: row.recipient_email || '', status: row.status,
  requestedAt: row.requested_at || row.created_at || '', approvedAt: row.approved_at || '', sentAt: row.sent_at || '', firstSentAt: row.first_sent_at || row.sent_at || '',
  sendCount: row.send_count || 0, reminderCount: row.reminder_count || 0, lastReminderAt: row.last_reminder_at || '', history: row.send_history || [],
  tokenExpiresAt: row.token_expires_at || '', reviewComment: row.review_comment || '', updatedAt: row.updated_at || '',
  items: (row.items || []).map(item => itemFromRow({ ...item, supplier_id: item.supplier_id || row.supplier_id })),
})

// Every item of every request, with its request.
export const requestItems = (requests = []) => requests.flatMap(request => (request.items || []).map(item => ({ ...item, request })))

// The latest item of each certificate (one in progress first).
export function latestItemByCertificate(requests = []) {
  const map = new Map()
  for (const item of requestItems(requests)) {
    const current = map.get(item.certificationId)
    const newer = !current || String(item.request.requestedAt) > String(current.request.requestedAt)
    if (!current || (isOpenItem(item) && !isOpenItem(current)) || (isOpenItem(item) === isOpenItem(current) && newer)) map.set(item.certificationId, item)
  }
  return map
}

// Days since a sent request went out with nothing submitted on it yet (null when it
// is answered, not sent, or younger than NO_RESPONSE_DAYS).
export function noResponseDays(request, now = new Date()) {
  if (!request || request.status !== 'sent' || !request.firstSentAt) return null
  if ((request.items || []).some(item => item.submittedAt || ['submitted', 'accepted'].includes(item.status))) return null
  const days = Math.floor((now.getTime() - new Date(request.firstSentAt).getTime()) / 86400000)
  return days >= NO_RESPONSE_DAYS ? days : null
}

// Whether the link of a request is still usable by the supplier.
export function linkState(request, now = new Date()) {
  if (!request) return 'none'
  if (request.status !== 'sent') return request.status
  return request.tokenExpiresAt && new Date(request.tokenExpiresAt) < now ? 'expired' : 'open'
}

// The certificates to renew: expired ones (and, with `expiring`, those expiring within
// 60 days) of the active suppliers, with their addresses, their latest item and its
// request. A certificate can be selected when no item is in progress (the address can
// be typed in the approval when the supplier has none).
export function renewalQueue(suppliers = [], requests = [], { expiring = false, today = todayIso() } = {}) {
  const latest = latestItemByCertificate(requests)
  const rows = []
  for (const supplier of suppliers) {
    if (supplier.status === 'inactive') continue
    const recipients = recipientsFor(supplier)
    for (const certification of supplier.certifications || []) {
      const state = certificationState(certification, today)
      const item = latest.get(certification.id) || null
      const request = item?.request || null
      const pending = isOpenItem(item)
      if (state !== 'expired' && !(expiring && state === 'expiring') && !pending) continue
      rows.push({
        key: certification.id, supplierId: supplier.id, supplierCode: supplier.code || '', supplierName: supplier.name || '', certification, state,
        days: certification.expiresOn ? daysBetween(today, certification.expiresOn) : null, recipients, recipient: (pending && request?.recipientEmail) || recipients[0] || '', item, request,
        selectable: !pending,
      })
    }
  }
  return rows.sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || a.supplierName.localeCompare(b.supplierName, 'el'))
}

// The queue by supplier: one row per supplier with its certificates and its request in
// progress (a sent one before a proposed one), most overdue first.
export function renewalGroups(rows = [], now = new Date()) {
  const map = new Map()
  for (const row of rows) {
    const group = map.get(row.supplierId) || { key: row.supplierId, supplierId: row.supplierId, supplierCode: row.supplierCode, supplierName: row.supplierName, recipients: row.recipients, rows: [], requests: [] }
    group.rows.push(row)
    if (row.request && isOpenItem(row.item) && !group.requests.some(item => item.id === row.request.id)) group.requests.push(row.request)
    map.set(row.supplierId, group)
  }
  return [...map.values()].map(group => {
    const requests = group.requests.sort((a, b) => (a.status === 'sent' ? 0 : 1) - (b.status === 'sent' ? 0 : 1) || String(b.requestedAt).localeCompare(String(a.requestedAt)))
    const request = requests[0] || null
    const selectable = group.rows.filter(row => row.selectable)
    return {
      ...group, requests, request, selectable, recipient: request?.recipientEmail || group.recipients[0] || '',
      days: Math.min(...group.rows.map(row => row.days ?? 0)), expired: group.rows.filter(row => row.state === 'expired').length,
      submitted: group.rows.filter(row => row.item?.status === 'submitted').length, noResponse: noResponseDays(request, now), link: linkState(request, now),
    }
  }).sort((a, b) => a.days - b.days || a.supplierName.localeCompare(b.supplierName, 'el'))
}

// request: all | none (something to send) | proposed | sent | no_response | submitted.
export function filterRenewals(groups = [], { query = '', state = 'all', request = 'all' } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase('el')
  return groups.map(group => (state === 'all' ? group : { ...group, rows: group.rows.filter(row => row.state === state || isOpenItem(row.item)) }))
    .map(group => ({ ...group, selectable: group.rows.filter(row => row.selectable) }))
    .filter(group => {
      if (!group.rows.length) return false
      if (request === 'none' && !group.selectable.length) return false
      if (request === 'no_response' && group.noResponse == null) return false
      if (request === 'submitted' && !group.submitted) return false
      if (['proposed', 'sent'].includes(request) && group.request?.status !== request) return false
      if (!needle) return true
      return [group.supplierName, group.supplierCode, group.recipient, ...group.rows.flatMap(row => [row.certification.type, row.certification.title, row.certification.number])].some(value => String(value || '').toLocaleLowerCase('el').includes(needle))
    })
}

export function renewalCounts(groups = [], requests = [], now = new Date()) {
  const rows = groups.flatMap(group => group.rows)
  const sent = requests.filter(item => item.status === 'sent')
  return {
    expired: rows.filter(row => row.state === 'expired').length,
    suppliers: groups.filter(group => group.rows.some(row => row.state === 'expired')).length,
    toSend: groups.filter(group => group.selectable.length && group.recipients.length).length,
    noEmail: groups.filter(group => !group.recipients.length && group.selectable.length).length,
    proposed: requests.filter(item => item.status === 'proposed').length,
    sent: sent.length,
    noResponse: sent.filter(item => noResponseDays(item, now) != null).length,
    submitted: requestItems(requests).filter(item => item.status === 'submitted').length,
  }
}

// The items the approval sends: one per selected certificate without an item in
// progress, with the address of its supplier (as typed in the approval, else the
// supplier's). The database puts a supplier's certificates into one request.
export function sendItems(rows = [], selected = [], recipients = {}) {
  const keys = new Set(selected)
  return rows.filter(row => keys.has(row.key) && row.selectable).map(row => ({ certification_id: row.certification.id, recipient_email: String(recipients[row.supplierId] ?? row.recipient).trim().toLowerCase() }))
}

// The selected certificates by supplier, for the approval (one e-mail each).
export function sendGroups(rows = [], selected = []) {
  const keys = new Set(selected)
  const map = new Map()
  for (const row of rows) {
    if (!keys.has(row.key) || !row.selectable) continue
    const group = map.get(row.supplierId) || { supplierId: row.supplierId, supplierName: row.supplierName, recipient: row.recipient, recipients: row.recipients, rows: [] }
    group.rows.push(row)
    map.set(row.supplierId, group)
  }
  return [...map.values()]
}

// Who may e-mail suppliers: the Platform Owner, or a member with the add-on
// supplier_renewal_sender (capability send_supplier_renewals); everyone else in
// Quality may only propose.
export function renewalPermissions({ owner = false, canSend = false, canManage = false, canView = false } = {}) {
  const send = Boolean(owner || canSend)
  return { send, review: Boolean(owner || canManage), propose: Boolean(send || canManage || canView), cancel: Boolean(send || owner || canManage) }
}

// The supplier's form for one certificate: what is missing or wrong (codes, with their text).
export function submissionProblems(form = {}, file = null, today = todayIso()) {
  const problems = []
  const day = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  if (!String(form.type || '').trim()) problems.push('type')
  if (!String(form.number || '').trim()) problems.push('number')
  if (!day(form.expiresOn)) problems.push('expiresOn')
  else if (form.expiresOn <= today) problems.push('expiresFuture')
  if (form.issuedOn && (!day(form.issuedOn) || form.issuedOn > today || (day(form.expiresOn) && form.issuedOn >= form.expiresOn))) problems.push('issuedOn')
  if (!file) problems.push('file')
  else if (file.size > MAX_FILE_BYTES) problems.push('fileSize')
  else if (file.type && !FILE_TYPES.includes(file.type)) problems.push('fileType')
  return problems
}
export const SUBMISSION_PROBLEMS = {
  type: ['τύπος πιστοποιητικού', 'certificate type'],
  number: ['αριθμός πιστοποιητικού', 'certificate number'],
  expiresOn: ['ημερομηνία λήξης', 'expiry date'],
  expiresFuture: ['ημερομηνία λήξης στο μέλλον', 'an expiry date in the future'],
  issuedOn: ['ημερομηνία έκδοσης πριν από σήμερα και τη λήξη', 'an issue date before today and the expiry'],
  file: ['αρχείο του πιστοποιητικού', 'the certificate file'],
  fileSize: ['αρχείο έως 10 MB', 'a file up to 10 MB'],
  fileType: ['αρχείο PDF ή εικόνα (JPG, PNG, WebP)', 'a PDF or image file (JPG, PNG, WebP)'],
}
export const submissionProblemText = (codes, language = 'el') => codes.map(code => SUBMISSION_PROBLEMS[code]?.[language === 'en' ? 1 : 0] || code)

// The public page: the certificates still to submit, and whether anything is left.
export const pendingItems = access => (access?.items || []).filter(item => item.status === 'pending')
export const accessComplete = access => Boolean(access) && (access.status === 'closed' || ((access.items || []).length > 0 && !pendingItems(access).length))

// What the supplier's page says for an error code of the edge function.
export function submitErrorMessage(code, language = 'el') {
  const en = language === 'en'
  const map = {
    SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED: ['Το πιστοποιητικό έχει ήδη υποβληθεί από αυτόν τον σύνδεσμο.', 'The certificate has already been submitted from this link.'],
    SUPPLIER_CERTIFICATE_ACCESS_EXPIRED: ['Ο σύνδεσμος έληξε. Ζητήστε νέο από το νοσοκομείο.', 'The link has expired. Ask the hospital for a new one.'],
    SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE: ['Ο σύνδεσμος δεν είναι πια διαθέσιμος.', 'The link is no longer available.'],
    SUPPLIER_CERTIFICATE_ITEM_NOT_AVAILABLE: ['Το πιστοποιητικό αυτό δεν ζητείται πια.', 'This certificate is no longer requested.'],
    SUPPLIER_CERTIFICATE_EXPIRY_NOT_FUTURE: ['Η ημερομηνία λήξης πρέπει να είναι μελλοντική.', 'The expiry date must be in the future.'],
    SUPPLIER_CERTIFICATE_FILE_TYPE: ['Το αρχείο πρέπει να είναι PDF ή εικόνα (JPG, PNG, WebP).', 'The file must be a PDF or an image (JPG, PNG, WebP).'],
    SUPPLIER_CERTIFICATE_FILE_TOO_LARGE: ['Το αρχείο ξεπερνά τα 10 MB.', 'The file is larger than 10 MB.'],
  }
  return (map[code] || ['Η υποβολή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.', 'The submission did not go through. Please try again.'])[en ? 1 : 0]
}
