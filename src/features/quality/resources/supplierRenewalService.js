import { supabase } from '../../../core/supabase/client'
import { hasSupabaseConfig } from '../../../core/config/env'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { isOwnerPreview } from '../../../core/preview/ownerPreview'
import { loadSnapshot, saveSnapshot } from '../../../core/data/repository'
import { processNotificationOutboxAsync } from '../../../core/notifications/notificationEmailService'
import { loadResourcesLocal, replaceCertificationLocal } from './resourceService'
import { requestFromRow } from './supplierRenewalModel'

// Renewal requests for expired supplier certificates
// (20261129100000_quality_supplier_certificate_request_items.sql): one request per
// supplier with one item per certificate. Every change goes through the database
// functions; sending queues the e-mail in the outbox and asks
// process-notification-outbox to deliver it. The demo keeps its requests in the
// browser and only simulates the e-mail.

const KEY = 'quality_local_supplier_certificate_requests'
const isLocal = () => isDemoDataEnvironment() || isOwnerPreview()
const must = ({ data, error }) => { if (error) throw error; return data }
const localId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const SELECT = '*,items:quality_supplier_certificate_request_items(*,attachment:attachments(id,file_name,storage_path,mime_type,size_bytes))'
const day = offset => { const date = new Date(); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }
const at = offset => new Date(Date.now() + offset * 86400000).toISOString()
const deliver = organizationId => { void processNotificationOutboxAsync(organizationId).catch(() => {}) }
const EMPTY = { type: '', number: '', issuer: '', issuedOn: '', expiresOn: '', note: '' }
const item = (id, requestId, supplierId, certificationId, status, snapshot, extra = {}) => ({ id, requestId, supplierId, certificationId, status, snapshot, submittedAt: '', submitted: { ...EMPTY }, attachment: null, reviewedAt: '', reviewComment: '', previous: null, history: [], ...extra })
const request = (id, supplierId, recipientEmail, status, items, extra = {}) => ({ id, supplierId, recipientEmail, status, requestedAt: '', approvedAt: '', sentAt: '', firstSentAt: '', sendCount: 0, reminderCount: 0, lastReminderAt: '', history: [], tokenExpiresAt: '', reviewComment: '', items, ...extra })

// The demo: a supplier that submitted one of its three certificates (to review) and
// one that has not answered in 10 days.
export function demoRequests() {
  const cert = (type, number, expiresOn) => ({ certificate_type: type, certificate_number: number, issuer: 'Φορέας πιστοποίησης', expires_on: expiresOn })
  return [
    request('scr-demo-1', 'sup-demo-2', 'orders@example.com', 'sent', [
      item('scri-demo-1', 'scr-demo-1', 'sup-demo-2', 'c3', 'submitted', cert('ISO 9001', 'QM-2290', day(-20)), { submittedAt: at(-1), submitted: { type: 'ISO 9001', number: 'QM-2290/2', issuer: 'Φορέας πιστοποίησης', issuedOn: day(-15), expiresOn: day(1080), note: 'Ανανέωση μετά την επιθεώρηση επαναπιστοποίησης.' } }),
      item('scri-demo-2', 'scr-demo-1', 'sup-demo-2', 'c3b', 'pending', cert('ISO 14001', 'EM-2291', day(-45))),
      item('scri-demo-3', 'scr-demo-1', 'sup-demo-2', 'c3c', 'pending', cert('ISO 45001', 'OH-2292', day(-8))),
    ], { requestedAt: at(-9), approvedAt: at(-9), sentAt: at(-9), firstSentAt: at(-9), sendCount: 1, tokenExpiresAt: at(5), history: [{ kind: 'send', at: at(-9), expiresAt: at(5) }] }),
    request('scr-demo-2', 'sup-demo-7', 'orders-food@example.com', 'sent', [
      item('scri-demo-4', 'scr-demo-2', 'sup-demo-7', 'c8b', 'pending', { ...cert('Βεβαίωση καταχώρισης ΕΦΕΤ', 'EFET-4410', day(-12)), issuer: 'ΕΦΕΤ' }),
      item('scri-demo-5', 'scr-demo-2', 'sup-demo-7', 'c8', 'pending', cert('ISO 22000 / HACCP', 'FS-7781', day(25))),
    ], { requestedAt: at(-10), approvedAt: at(-10), sentAt: at(-10), firstSentAt: at(-10), sendCount: 1, tokenExpiresAt: at(4), history: [{ kind: 'send', at: at(-10), expiresAt: at(4) }] }),
  ]
}
function local() {
  const stored = loadSnapshot(KEY, null)
  if (Array.isArray(stored) && stored.every(row => Array.isArray(row?.items))) return stored
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

// Creates the requests for the selected certificates ([{certification_id, recipient_email}]);
// the certificates of one supplier and address go into one request (one e-mail).
// send: e-mailed now (Platform Owner or supplier_renewal_sender); otherwise only proposed.
export async function createCertificateRequests(organizationId, items, { send = true } = {}) {
  if (isLocal()) {
    const { suppliers } = loadResourcesLocal()
    const now = new Date().toISOString()
    let created = 0, requests = 0
    const next = local().map(row => ({ ...row, items: [...row.items] }))
    const touched = new Set()
    for (const entry of items) {
      if (next.some(row => row.items.some(part => part.certificationId === entry.certification_id && ['pending', 'submitted'].includes(part.status)))) continue
      const supplier = suppliers.find(candidate => (candidate.certifications || []).some(cert => cert.id === entry.certification_id))
      const cert = supplier?.certifications.find(candidate => candidate.id === entry.certification_id)
      if (!cert) continue
      let header = next.find(row => row.supplierId === supplier.id && row.recipientEmail === entry.recipient_email && (row.status === 'proposed' || (send && row.status === 'sent')))
      if (!header) { header = request(localId('scr'), supplier.id, entry.recipient_email, 'proposed', [], { requestedAt: now }); next.unshift(header); requests++ }
      header.items.push(item(localId('scri'), header.id, supplier.id, cert.id, 'pending', { certificate_type: cert.type, certificate_number: cert.number, issuer: cert.issuer, expires_on: cert.expiresOn }))
      touched.add(header.id)
      created++
    }
    const sent = send ? next.filter(row => touched.has(row.id)).map(row => Object.assign(row, { status: 'sent', approvedAt: row.approvedAt || now, sentAt: now, firstSentAt: row.firstSentAt || now, sendCount: row.sendCount + 1, tokenExpiresAt: at(14), history: [...row.history, { kind: row.status === 'sent' ? 'reminder' : 'send', at: now, expiresAt: at(14) }] })).length : 0
    saveLocal(next)
    return { created, requests, sent, skipped: [], simulated: true }
  }
  const result = must(await supabase.rpc('quality_supplier_certificate_requests_create', { p_organization_id: organizationId, p_items: items, p_send: send }))
  if (send && result?.sent) deliver(organizationId)
  return result
}

// The request (the supplier's e-mail): approve | resend (a new link) | remind (the
// same link, 14 more days) | cancel.
export async function certificateRequestAction(organizationId, target, action, { comment = '' } = {}) {
  if (isLocal()) {
    const now = new Date().toISOString()
    const rows = local().map(row => {
      if (row.id !== target.id) return row
      if (action === 'approve' || action === 'resend') return { ...row, status: 'sent', approvedAt: row.approvedAt || now, sentAt: now, firstSentAt: row.firstSentAt || now, sendCount: row.sendCount + 1, tokenExpiresAt: at(14), history: [...row.history, { kind: action === 'approve' ? 'send' : 'resend', at: now, expiresAt: at(14) }] }
      if (action === 'remind') { const until = new Date(Math.max(Date.parse(row.tokenExpiresAt || now), Date.now()) + 14 * 86400000).toISOString(); return { ...row, sentAt: now, sendCount: row.sendCount + 1, reminderCount: row.reminderCount + 1, lastReminderAt: now, tokenExpiresAt: until, history: [...row.history, { kind: 'reminder', at: now, expiresAt: until }] } }
      if (action === 'cancel') return { ...row, status: 'cancelled', reviewComment: comment, items: row.items.map(part => (part.status === 'pending' ? { ...part, status: 'cancelled', reviewedAt: now } : part)) }
      return row
    })
    saveLocal(rows)
    return { ok: true, action, simulated: true }
  }
  const result = must(await supabase.rpc('quality_supplier_certificate_request_action', { p_id: target.id, p_action: action, p_comment: comment || null, p_resend: false }))
  if (['approve', 'resend', 'remind'].includes(action)) deliver(organizationId)
  return result
}

// One certificate of a request: accept | reject (comment required; resend: asked
// again on the same link, with a reminder) | cancel.
export async function certificateItemAction(organizationId, target, action, { comment = '', resend = false } = {}) {
  if (isLocal()) {
    const now = new Date().toISOString()
    const rows = local().map(row => {
      if (row.id !== target.requestId) return row
      const items = row.items.map(part => {
        if (part.id !== target.id) return part
        if (action === 'accept') {
          replaceCertificationLocal(part.supplierId, part.certificationId, { type: part.submitted.type || part.snapshot.certificate_type, number: part.submitted.number, issuer: part.submitted.issuer, expiresOn: part.submitted.expiresOn })
          return { ...part, status: 'accepted', reviewedAt: now, reviewComment: comment, previous: { ...part.snapshot } }
        }
        if (action === 'reject' && resend) return { ...part, status: 'pending', reviewedAt: now, reviewComment: comment, history: [...part.history, { rejectedAt: now, comment, ...part.submitted }], submittedAt: '', submitted: { ...EMPTY }, attachment: null }
        if (action === 'reject') return { ...part, status: 'rejected', reviewedAt: now, reviewComment: comment }
        if (action === 'cancel') return { ...part, status: 'cancelled', reviewedAt: now }
        return part
      })
      const done = !items.some(part => ['pending', 'submitted'].includes(part.status))
      const reminded = action === 'reject' && resend ? { sentAt: now, sendCount: row.sendCount + 1, reminderCount: row.reminderCount + 1, lastReminderAt: now, tokenExpiresAt: at(14), history: [...row.history, { kind: 'reminder', at: now, expiresAt: at(14) }] } : {}
      return { ...row, ...reminded, items, status: done && ['proposed', 'sent'].includes(row.status) ? 'closed' : row.status }
    })
    saveLocal(rows)
    return { ok: true, action, simulated: true }
  }
  const result = must(await supabase.rpc('quality_supplier_certificate_request_item_action', { p_id: target.id, p_action: action, p_comment: comment || null, p_resend: Boolean(resend) }))
  if (action === 'reject' && resend) deliver(organizationId)
  return result
}

// --- The supplier's public page (no account) --------------------------------------------

// The sample the public page shows for /supplier-certificate/demo (help preview, the
// manual): invented names only, nothing is read from or sent to the database.
export const DEMO_ACCESS_TOKEN = 'demo'
export const isDemoAccessToken = token => token === DEMO_ACCESS_TOKEN
export function demoSupplierAccess() {
  return {
    status: 'sent', demo: true, organizationName: 'Γενικό Νοσοκομείο (δείγμα)', organizationLogo: null, organizationEmail: 'quality@hospital.example', organizationPhone: '210 000 0000', supplierName: 'Ιατροτεχνική Δείγμα Α.Ε.', expiresAt: at(14),
    items: [
      { id: 'demo-item-1', status: 'pending', type: 'ISO 9001', title: '', number: 'QM-2290', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-20), submittedAt: null, reviewComment: null },
      { id: 'demo-item-2', status: 'pending', type: 'ISO 14001', title: '', number: 'EM-2291', issuer: 'Φορέας πιστοποίησης', expiresOn: day(-45), submittedAt: null, reviewComment: null },
      { id: 'demo-item-3', status: 'pending', type: 'ISO 13485', title: 'Ιατροτεχνολογικά προϊόντα', number: 'MD-4471', issuer: 'Κοινοποιημένος οργανισμός', expiresOn: day(21), submittedAt: null, reviewComment: null },
    ],
  }
}

function client(operation) { if (!hasSupabaseConfig || !supabase) throw new Error(`SUPPLIER_CERTIFICATE_SUPABASE_REQUIRED:${operation}`); return supabase }

export async function loadSupplierCertificateAccess(token) {
  if (isDemoAccessToken(token)) return demoSupplierAccess()
  return must(await client('access').rpc('quality_supplier_certificate_access', { p_token: token }))
}

// Sends one certificate (the item of the request) and its file to the edge function;
// resolves {ok} or throws an Error whose `code` is the function's answer
// (SUPPLIER_CERTIFICATE_*). The demo link only simulates it.
export async function submitSupplierCertificate(token, itemId, form, file) {
  if (isDemoAccessToken(token)) return { ok: true, status: 'submitted', simulated: true }
  const body = new FormData()
  body.set('token', token)
  body.set('item_id', itemId)
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

// --- Who may e-mail suppliers (Platform Owner only designates) ------------------------

// Whether a member has the add-on supplier_renewal_sender (the Platform Owner reads
// every member's add-ons). The demo keeps the choice in the browser.
const SENDERS_KEY = 'limoxis.supplierRenewalSenders.demo'
const demoSenders = () => { try { return JSON.parse(window.localStorage.getItem(SENDERS_KEY) || '[]') } catch { return [] } }
export async function loadSupplierRenewalSender(membershipId) {
  if (isLocal()) return demoSenders().includes(membershipId)
  if (!membershipId || !hasSupabaseConfig || !supabase) return false
  const rows = must(await supabase.from('organization_member_capabilities').select('id,effect').eq('membership_id', membershipId).eq('capability', 'supplier_renewal_sender')) || []
  return rows.some(row => (row.effect || 'grant') === 'grant')
}
export async function setSupplierRenewalSender(organizationId, { membershipId, userId }, enabled) {
  if (isLocal()) {
    const next = demoSenders().filter(id => id !== membershipId)
    try { window.localStorage.setItem(SENDERS_KEY, JSON.stringify(enabled ? [...next, membershipId] : next)) } catch { /* the demo choice is not kept */ }
    return { ok: true, enabled, simulated: true }
  }
  return must(await client('sender').rpc('set_member_supplier_renewal_sender', { p_organization_id: organizationId, p_user_id: userId, p_enabled: Boolean(enabled) }))
}

// --- The nightly automatic e-mailing (quality_supplier_renewal_settings) ----------------

// Off by default. The demo keeps the choice in the browser and never e-mails.
export const DEFAULT_RENEWAL_SETTINGS = { autoEnabled: false, remindAfterDays: 7, maxReminders: 2, lastRunAt: '', lastResult: null }
const SETTINGS_KEY = 'limoxis.supplierRenewalSettings.demo'
export async function loadRenewalSettings(organizationId) {
  if (isLocal()) { try { return { ...DEFAULT_RENEWAL_SETTINGS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') } } catch { return { ...DEFAULT_RENEWAL_SETTINGS } } }
  if (!organizationId || !hasSupabaseConfig || !supabase) return { ...DEFAULT_RENEWAL_SETTINGS }
  const row = must(await supabase.from('quality_supplier_renewal_settings').select('*').eq('organization_id', organizationId).maybeSingle())
  return row ? { autoEnabled: Boolean(row.auto_enabled), remindAfterDays: row.remind_after_days, maxReminders: row.max_reminders, lastRunAt: row.last_run_at || '', lastResult: row.last_result || null } : { ...DEFAULT_RENEWAL_SETTINGS }
}
export async function saveRenewalSettings(organizationId, settings) {
  if (isLocal()) { try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* the demo choice is not kept */ } return { ok: true, simulated: true } }
  return must(await supabase.rpc('quality_supplier_renewal_settings_set', { p_organization_id: organizationId, p_auto_enabled: Boolean(settings.autoEnabled), p_remind_after_days: Number(settings.remindAfterDays) || 7, p_max_reminders: Number(settings.maxReminders) }))
}
