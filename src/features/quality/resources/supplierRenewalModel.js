import { certificationState, daysBetween, todayIso } from './resourceModel'

// Renewal of expired supplier certificates by e-mail
// (20261128200000_quality_supplier_certificate_requests.sql): the queue of
// certificates to renew, the requests and their states, and the checks of the
// supplier's form. Pure functions.

const pick = (list, value, language) => list.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || value || ''
const toneOf = (list, value) => list.find(item => item.value === value)?.tone || 'neutral'

export const REQUEST_STATUSES = [
  { value: 'proposed', label: ['Προτάθηκε, αναμένει έγκριση', 'Proposed, awaiting approval'], tone: 'neutral' },
  { value: 'approved', label: ['Εγκρίθηκε', 'Approved'], tone: 'info' },
  { value: 'sent', label: ['Στάλθηκε, αναμένεται', 'Sent, awaiting'], tone: 'info' },
  { value: 'submitted', label: ['Υποβλήθηκε, προς έλεγχο', 'Submitted, to review'], tone: 'warning' },
  { value: 'accepted', label: ['Έγινε αποδεκτό', 'Accepted'], tone: 'success' },
  { value: 'rejected', label: ['Απορρίφθηκε', 'Rejected'], tone: 'danger' },
  { value: 'cancelled', label: ['Ακυρώθηκε', 'Cancelled'], tone: 'neutral' },
]
export const requestStatusLabel = (value, language) => pick(REQUEST_STATUSES, value, language)
export const requestStatusTone = value => toneOf(REQUEST_STATUSES, value)
// A request still in progress: a certificate has at most one.
export const OPEN_STATUSES = ['proposed', 'approved', 'sent', 'submitted']
export const isOpenRequest = request => OPEN_STATUSES.includes(request?.status)

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

export const requestFromRow = row => ({
  id: row.id, supplierId: row.supplier_id, certificationId: row.certification_id, recipientEmail: row.recipient_email || '', status: row.status,
  snapshot: row.certificate_snapshot || {}, requestedAt: row.requested_at || row.created_at || '', approvedAt: row.approved_at || '', sentAt: row.sent_at || '', sendCount: row.send_count || 0,
  tokenExpiresAt: row.token_expires_at || '', submittedAt: row.submitted_at || '',
  submitted: { type: row.certificate_type || '', number: row.certificate_number || '', issuer: row.issuer || '', issuedOn: row.issued_on || '', expiresOn: row.expires_on || '', note: row.note || '' },
  attachment: row.attachment ? { id: row.attachment.id, name: row.attachment.file_name, storagePath: row.attachment.storage_path, type: row.attachment.mime_type || '', size: row.attachment.size_bytes || 0 } : null,
  reviewedAt: row.reviewed_at || '', reviewComment: row.review_comment || '', previous: row.previous_values || null, updatedAt: row.updated_at || '',
})

// The latest request of each certificate (an open one first).
export function latestRequestByCertificate(requests = []) {
  const map = new Map()
  for (const request of requests) {
    const current = map.get(request.certificationId)
    const newer = !current || String(request.requestedAt) > String(current.requestedAt)
    if (!current || (isOpenRequest(request) && !isOpenRequest(current)) || (isOpenRequest(request) === isOpenRequest(current) && newer)) map.set(request.certificationId, request)
  }
  return map
}

// The certificates to renew: expired ones (and, with `expiring`, those expiring within
// 60 days) of the active suppliers, with their addresses and their latest request.
// A row can be selected when no request is in progress (the address can be typed in
// the approval when the supplier has none).
export function renewalQueue(suppliers = [], requests = [], { expiring = false, today = todayIso() } = {}) {
  const latest = latestRequestByCertificate(requests)
  const rows = []
  for (const supplier of suppliers) {
    if (supplier.status === 'inactive') continue
    const recipients = recipientsFor(supplier)
    for (const certification of supplier.certifications || []) {
      const state = certificationState(certification, today)
      const request = latest.get(certification.id) || null
      const pending = request && ['submitted', 'proposed'].includes(request.status)
      if (state !== 'expired' && !(expiring && state === 'expiring') && !pending) continue
      rows.push({
        key: certification.id, supplierId: supplier.id, supplierCode: supplier.code || '', supplierName: supplier.name || '', certification, state,
        days: certification.expiresOn ? daysBetween(today, certification.expiresOn) : null, recipients, recipient: request?.recipientEmail || recipients[0] || '', request,
        selectable: !isOpenRequest(request),
      })
    }
  }
  return rows.sort((a, b) => (a.days ?? 0) - (b.days ?? 0) || a.supplierName.localeCompare(b.supplierName, 'el'))
}

export function filterRenewals(rows = [], { query = '', state = 'all', request = 'all' } = {}) {
  const needle = String(query || '').trim().toLocaleLowerCase('el')
  return rows.filter(row => {
    if (state !== 'all' && row.state !== state) return false
    if (request === 'none' && row.request && isOpenRequest(row.request)) return false
    if (request !== 'all' && request !== 'none' && row.request?.status !== request) return false
    if (!needle) return true
    return [row.supplierName, row.supplierCode, row.certification.type, row.certification.title, row.certification.number, row.recipient].some(value => String(value || '').toLocaleLowerCase('el').includes(needle))
  })
}

export function renewalCounts(rows = [], requests = []) {
  return {
    expired: rows.filter(row => row.state === 'expired').length,
    toSend: rows.filter(row => row.selectable && row.recipients.length).length,
    noEmail: rows.filter(row => !row.recipients.length && !isOpenRequest(row.request)).length,
    proposed: requests.filter(item => item.status === 'proposed').length,
    sent: requests.filter(item => item.status === 'sent').length,
    submitted: requests.filter(item => item.status === 'submitted').length,
  }
}

// The items the approval sends: one per selected certificate without a request in
// progress, with its address (as typed in the approval, else the supplier's).
export function sendItems(rows = [], selected = [], recipients = {}) {
  const keys = new Set(selected)
  return rows.filter(row => keys.has(row.key) && row.selectable).map(row => ({ certification_id: row.certification.id, recipient_email: String(recipients[row.key] ?? row.recipient).trim().toLowerCase() }))
}

// Whether the link of a request is still usable by the supplier.
export function linkState(request, now = new Date()) {
  if (!request) return 'none'
  if (request.status !== 'sent') return request.status
  return request.tokenExpiresAt && new Date(request.tokenExpiresAt) < now ? 'expired' : 'open'
}

// The supplier's form: what is missing or wrong (codes, with their text).
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

// What the supplier's page says for an error code of the edge function.
export function submitErrorMessage(code, language = 'el') {
  const en = language === 'en'
  const map = {
    SUPPLIER_CERTIFICATE_ALREADY_SUBMITTED: ['Το πιστοποιητικό έχει ήδη υποβληθεί από αυτόν τον σύνδεσμο.', 'The certificate has already been submitted from this link.'],
    SUPPLIER_CERTIFICATE_ACCESS_EXPIRED: ['Ο σύνδεσμος έληξε. Ζητήστε νέο από το νοσοκομείο.', 'The link has expired. Ask the hospital for a new one.'],
    SUPPLIER_CERTIFICATE_ACCESS_NOT_AVAILABLE: ['Ο σύνδεσμος δεν είναι πια διαθέσιμος.', 'The link is no longer available.'],
    SUPPLIER_CERTIFICATE_EXPIRY_NOT_FUTURE: ['Η ημερομηνία λήξης πρέπει να είναι μελλοντική.', 'The expiry date must be in the future.'],
    SUPPLIER_CERTIFICATE_FILE_TYPE: ['Το αρχείο πρέπει να είναι PDF ή εικόνα (JPG, PNG, WebP).', 'The file must be a PDF or an image (JPG, PNG, WebP).'],
    SUPPLIER_CERTIFICATE_FILE_TOO_LARGE: ['Το αρχείο ξεπερνά τα 10 MB.', 'The file is larger than 10 MB.'],
  }
  return (map[code] || ['Η υποβολή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.', 'The submission did not go through. Please try again.'])[en ? 1 : 0]
}
