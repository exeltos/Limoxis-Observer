import { supabase } from '../../../core/supabase/client'
import { hasSupabaseConfig } from '../../../core/config/env'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { processNotificationOutboxAsync } from '../../../core/notifications/notificationEmailService'
import { loadResourcesLocal, replaceCertificationLocal } from './resourceService'
import { requestFromRow } from './supplierRenewalModel'

// Renewal requests for expired supplier certificates
// (20261128200000_quality_supplier_certificate_requests.sql). Every change goes
// through the database functions; sending queues the e-mail in the outbox and asks
// process-notification-outbox to deliver it. The demo keeps its requests in the
// browser and only simulates the e-mail.

const KEY = 'quality_local_supplier_certificate_requests'
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const must = ({ data, error }) => { if (error) throw error; return data }
const localId = () => `scr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const SELECT = '*,attachment:attachments(id,file_name,storage_path,mime_type,size_bytes)'
const day = offset => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
const at = offset => new Date(Date.now() + offset * 86400000).toISOString()
const deliver = organizationId => { void processNotificationOutboxAsync(organizationId).catch(() => {}) }

// The demo: one renewal submitted by the supplier (to review) and one link sent.
export function demoRequests() {
  return [
    { id: 'scr-demo-1', supplierId: 'sup-demo-2', certificationId: 'c3', recipientEmail: 'orders@example.com', status: 'submitted', snapshot: { certificate_type: 'ISO 9001', certificate_number: 'QM-2290', issuer: 'Φορέας πιστοποίησης', expires_on: day(-20) },
      requestedAt: at(-9), approvedAt: at(-9), sentAt: at(-9), sendCount: 1, tokenExpiresAt: at(5), submittedAt: at(-1),
      submitted: { type: 'ISO 9001', number: 'QM-2290/2', issuer: 'Φορέας πιστοποίησης', issuedOn: day(-15), expiresOn: day(1080), note: 'Ανανέωση μετά την επιθεώρηση επαναπιστοποίησης.' }, attachment: null, reviewedAt: '', reviewComment: '', previous: null },
    { id: 'scr-demo-2', supplierId: 'sup-demo-7', certificationId: 'c8', recipientEmail: 'orders-food@example.com', status: 'sent', snapshot: { certificate_type: 'ISO 22000 / HACCP', certificate_number: 'FS-7781', issuer: 'Φορέας πιστοποίησης', expires_on: day(25) },
      requestedAt: at(-3), approvedAt: at(-3), sentAt: at(-3), sendCount: 1, tokenExpiresAt: at(11), submittedAt: '',
      submitted: { type: '', number: '', issuer: '', issuedOn: '', expiresOn: '', note: '' }, attachment: null, reviewedAt: '', reviewComment: '', previous: null },
  ]
}
function local() {
  const stored = loadSnapshot(KEY, null)
  if (Array.isArray(stored)) return stored
  const seeded = demoRequests()
  saveSnapshot(KEY, seeded)
  return seeded
}
const saveLocal = rows => saveSnapshot(KEY, rows)

export async function loadCertificateRequests(organizationId) {
  if (isLocal()) return local()
  if (!organizationId || !hasSupabaseConfig || !supabase) return []
  const rows = must(await supabase.from('quality_supplier_certificate_requests').select(SELECT).eq('organization_id', organizationId).order('requested_at', { ascending: false }).limit(1000)) || []
  return rows.map(requestFromRow)
}

// Creates the requests for the selected certificates ([{certification_id, recipient_email}]).
// send: approved and e-mailed now (Quality managers); otherwise only proposed.
export async function createCertificateRequests(organizationId, items, { send = true } = {}) {
  if (isLocal()) {
    const rows = local()
    const { suppliers } = loadResourcesLocal()
    const now = new Date().toISOString()
    let created = 0
    const next = [...rows]
    for (const item of items) {
      if (next.some(row => row.certificationId === item.certification_id && ['proposed', 'approved', 'sent', 'submitted'].includes(row.status))) continue
      const supplier = suppliers.find(entry => (entry.certifications || []).some(cert => cert.id === item.certification_id))
      const cert = supplier?.certifications.find(entry => entry.id === item.certification_id)
      if (!cert) continue
      next.unshift({ id: localId(), supplierId: supplier.id, certificationId: cert.id, recipientEmail: item.recipient_email, status: send ? 'sent' : 'proposed',
        snapshot: { certificate_type: cert.type, certificate_number: cert.number, issuer: cert.issuer, expires_on: cert.expiresOn }, requestedAt: now, approvedAt: send ? now : '', sentAt: send ? now : '', sendCount: send ? 1 : 0,
        tokenExpiresAt: send ? at(14) : '', submittedAt: '', submitted: { type: '', number: '', issuer: '', issuedOn: '', expiresOn: '', note: '' }, attachment: null, reviewedAt: '', reviewComment: '', previous: null })
      created++
    }
    saveLocal(next)
    return { created, sent: send ? created : 0, skipped: [], simulated: true }
  }
  const result = must(await supabase.rpc('quality_supplier_certificate_requests_create', { p_organization_id: organizationId, p_items: items, p_send: send }))
  if (send && result?.sent) deliver(organizationId)
  return result
}

// approve | resend | cancel | accept | reject (comment required; resend: a new link).
export async function certificateRequestAction(organizationId, request, action, { comment = '', resend = false } = {}) {
  if (isLocal()) {
    const now = new Date().toISOString()
    let rows = local()
    const update = changes => { rows = rows.map(row => (row.id === request.id ? { ...row, ...changes } : row)) }
    if (action === 'approve' || action === 'resend') update({ status: 'sent', approvedAt: request.approvedAt || now, sentAt: now, sendCount: (request.sendCount || 0) + 1, tokenExpiresAt: at(14) })
    else if (action === 'cancel') update({ status: 'cancelled', reviewedAt: now })
    else if (action === 'accept') {
      const values = { type: request.submitted.type || request.snapshot.certificate_type, number: request.submitted.number, issuer: request.submitted.issuer, expiresOn: request.submitted.expiresOn }
      replaceCertificationLocal(request.supplierId, request.certificationId, values)
      update({ status: 'accepted', reviewedAt: now, reviewComment: comment, previous: { ...request.snapshot } })
    } else if (action === 'reject') {
      update({ status: 'rejected', reviewedAt: now, reviewComment: comment })
      if (resend) rows = [{ ...request, id: localId(), status: 'sent', requestedAt: now, approvedAt: now, sentAt: now, sendCount: 1, tokenExpiresAt: at(14), submittedAt: '', submitted: { type: '', number: '', issuer: '', issuedOn: '', expiresOn: '', note: '' }, attachment: null, reviewedAt: '', reviewComment: comment, previous: null }, ...rows]
    }
    saveLocal(rows)
    return { ok: true, action, simulated: true }
  }
  const result = must(await supabase.rpc('quality_supplier_certificate_request_action', { p_id: request.id, p_action: action, p_comment: comment || null, p_resend: Boolean(resend) }))
  if (action === 'approve' || action === 'resend' || (action === 'reject' && resend)) deliver(organizationId)
  return result
}

// --- The supplier's public page (no account) --------------------------------------------

function client(operation) { if (!hasSupabaseConfig || !supabase) throw new Error(`SUPPLIER_CERTIFICATE_SUPABASE_REQUIRED:${operation}`); return supabase }

export async function loadSupplierCertificateAccess(token) {
  return must(await client('access').rpc('quality_supplier_certificate_access', { p_token: token }))
}

// Sends the form and the file to the edge function; resolves {ok} or throws an Error
// whose `code` is the function's answer (SUPPLIER_CERTIFICATE_*).
export async function submitSupplierCertificate(token, form, file) {
  const body = new FormData()
  body.set('token', token)
  body.set('certificate_type', form.type || '')
  body.set('certificate_number', form.number || '')
  body.set('issuer', form.issuer || '')
  body.set('issued_on', form.issuedOn || '')
  body.set('expires_on', form.expiresOn || '')
  body.set('note', form.note || '')
  body.set('file', file, file.name)
  const { data, error } = await client('submit').functions.invoke('supplier-certificate-submit', { body })
  if (error) {
    let code = ''
    try { code = (await error.context?.json?.())?.code || '' } catch { code = '' }
    const failure = new Error(code || error.message || 'SUPPLIER_CERTIFICATE_SUBMIT_FAILED')
    failure.code = code
    throw failure
  }
  return data
}
