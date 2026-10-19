import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, MailCheck, RefreshCw, Send, X } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
import { MetricCard } from '../../../design-system/MetricCard'
import { CheckboxField } from '../../../design-system/CheckboxField'
import { SectionHeader } from '../../../design-system/SectionHeader'
import { ObserverDialog, DialogActions } from '../../../design-system/ObserverDialog'
import { Field } from '../../../design-system/Field'
import { useLanguage } from '../../../core/i18n/LanguageContext'
import { useFeedback } from '../../../core/feedback/FeedbackContext'
import { useTenant } from '../../../core/tenant/TenantContext'
import { formatDay } from '../../../core/i18n/formatDay'
import { exportRegistry } from '../../../core/export/registryExports'
import { getAttachmentUrl } from '../../../core/attachments/attachmentService'
import { isDemoDataEnvironment } from '../../../core/data/dataEnvironment'
import { useContextualNavigation } from '../../../core/navigation/useContextualNavigation'
import { useResources, useResourceAccess } from './ResourcesPanel'
import { certificationStateLabel, certificationStateTone } from './resourceModel'
import { filterRenewals, isEmail, isOpenRequest, linkState, renewalCounts, renewalQueue, requestStatusLabel, requestStatusTone, sendItems } from './supplierRenewalModel'
import { certificateRequestAction, createCertificateRequests, loadCertificateRequests } from './supplierRenewalService'
import '../quality.css'
import './resources.css'

const NO_FILTERS = { query: '', state: 'expired', request: 'all' }

// The renewal requests of the organization (Quality reads them).
export function useCertificateRequests(enabled = true) {
  const { tenant } = useTenant()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(enabled)
  const reload = useCallback(() => {
    if (!enabled) { setLoading(false); return Promise.resolve() }
    setLoading(true)
    return loadCertificateRequests(tenant?.id).then(setRequests).catch(error => { console.error(error); setRequests([]) }).finally(() => setLoading(false))
  }, [tenant?.id, enabled])
  useEffect(() => { void reload() }, [reload])
  return { requests, loading, reload }
}

const certificateText = certification => [certification.type, certification.title && certification.title !== certification.type ? certification.title : '', certification.number].filter(Boolean).join(' · ')

// Quality → Resources → Suppliers → «Certificates to renew»: the expired certificates
// with the supplier's e-mail; Quality approves and the supplier gets a single-use link
// to upload the renewed certificate, which Quality then accepts or rejects.
export function SupplierRenewalsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const access = useResourceAccess()
  const { goBack } = useContextualNavigation('/quality')
  const list = useResources()
  const { requests, loading, reload } = useCertificateRequests(access.canViewAll)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selected, setSelected] = useState([])
  const [sending, setSending] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const queue = useMemo(() => renewalQueue(list.suppliers, requests, { expiring: true }), [list.suppliers, requests])
  const rows = useMemo(() => filterRenewals(queue, filters), [queue, filters])
  const counts = useMemo(() => renewalCounts(queue, requests), [queue, requests])
  const submitted = useMemo(() => requests.filter(item => item.status === 'submitted'), [requests])
  const byCertificate = useMemo(() => new Map(queue.map(row => [row.certification.id, row])), [queue])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selectableVisible = visible.filter(row => row.selectable).map(row => row.key)
  const allVisible = selectableVisible.length > 0 && selectableVisible.every(key => selected.includes(key))
  const toggle = (key, on) => setSelected(current => (on ? [...new Set([...current, key])] : current.filter(item => item !== key)))
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const refresh = async () => { setSelected([]); await Promise.all([reload(), list.reload()]) }

  async function act(request, action, message) {
    try { await certificateRequestAction(tenant?.id, request, action); notify(message, 'success'); await refresh() } catch (error) { console.error(error); notify(en ? 'The action could not be completed.' : 'Η ενέργεια δεν ολοκληρώθηκε.', 'error') }
  }
  const exportQueue = () => exportRegistry({
    name: en ? 'supplier-certificates-to-renew' : 'pistopoiitika-pros-ananeosi',
    headers: en ? ['Supplier code', 'Supplier', 'Certificate', 'Expires', 'State', 'E-mail', 'Request'] : ['Κωδικός', 'Προμηθευτής', 'Πιστοποιητικό', 'Λήξη', 'Κατάσταση', 'Email', 'Αίτημα'],
    rows: rows.map(row => [row.supplierCode, row.supplierName, certificateText(row.certification), row.certification.expiresOn, certificationStateLabel(row.state, language), row.recipient, row.request ? requestStatusLabel(row.request.status, language) : '']),
  })
  const selectedRows = queue.filter(row => selected.includes(row.key) && row.selectable)

  return <Page fill className="supplier-renewals-page" navigation={<BackButton onClick={goBack} label={en ? 'Back to suppliers' : 'Πίσω στους προμηθευτές'} />}
    title={en ? 'Certificates to renew' : 'Πιστοποιητικά προς ανανέωση'}
    subtitle={en ? 'Expired supplier certificates. After your approval the supplier gets an e-mail with a personal link to upload the renewed certificate; you then accept it and it replaces the old one.' : 'Τα ληγμένα πιστοποιητικά των προμηθευτών. Μετά την έγκρισή σας ο προμηθευτής λαμβάνει email με προσωπικό σύνδεσμο για να ανεβάσει το ανανεωμένο πιστοποιητικό· όταν το αποδεχθείτε, αντικαθιστά το παλιό.'}
    actions={<div className="row-actions"><ExportMenu disabled={!rows.length} onExcel={exportQueue} />
      {selectedRows.length > 0 && <Button onClick={() => setSending(selectedRows)}><Send size={15} />{access.canManage ? (en ? `Approve & send (${selectedRows.length})` : `Έγκριση & αποστολή (${selectedRows.length})`) : (en ? `Propose (${selectedRows.length})` : `Πρόταση για αποστολή (${selectedRows.length})`)}</Button>}</div>}>
    <div className="workspace-summary"><div className="module-summary-strip quality-kpis" style={{ '--quality-kpis': 4 }}>
      <MetricCard icon={AlertTriangle} value={list.loading ? '—' : counts.expired} label={en ? 'Expired certificates' : 'Ληγμένα πιστοποιητικά'} tone={counts.expired ? 'danger' : 'neutral'} active={filters.state === 'expired' && filters.request === 'all'} onClick={() => setFilters({ ...NO_FILTERS })} />
      <MetricCard icon={Send} value={list.loading ? '—' : counts.toSend} label={en ? 'Ready to send' : 'Έτοιμα για αποστολή'} active={filters.request === 'none'} onClick={() => setFilters(current => ({ ...current, state: 'all', request: 'none' }))} />
      <MetricCard icon={MailCheck} value={loading ? '—' : counts.sent} label={en ? 'Awaiting the supplier' : 'Αναμένεται ο προμηθευτής'} active={filters.request === 'sent'} onClick={() => setFilters(current => ({ ...current, state: 'all', request: 'sent' }))} />
      <MetricCard icon={FileCheck2} value={loading ? '—' : counts.submitted} label={en ? 'Submitted, to review' : 'Υποβλήθηκαν, προς έλεγχο'} tone={counts.submitted ? 'warning' : 'neutral'} />
    </div></div>
    <section className="surface registry-workspace workspace-column workspace-fill">
      {submitted.length > 0 && <div className="supplier-renewal-review">
        <SectionHeader title={en ? `Submitted certificates to review ${submitted.length}` : `Υποβολές προς έλεγχο ${submitted.length}`} subtitle={en ? 'Accept to replace the old certificate (its values are kept in the request), or reject with a comment.' : 'Με την αποδοχή αντικαθίσταται το παλιό πιστοποιητικό (οι προηγούμενες τιμές κρατούνται στο αίτημα)· ή απορρίψτε με σχόλιο.'} />
        <RegistryTable className="quality-table" rows={submitted} rowKey={item => item.id}
          columns={[{ key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'certificate', label: en ? 'New certificate' : 'Νέο πιστοποιητικό' }, { key: 'expires', label: en ? 'New expiry' : 'Νέα λήξη' }, { key: 'submitted', label: en ? 'Submitted' : 'Υποβλήθηκε' }, { key: 'actions', label: '' }]}
          renderRow={item => { const row = byCertificate.get(item.certificationId); return <>
            <td><strong>{row?.supplierName || '—'}</strong><small>{item.recipientEmail}</small></td>
            <td>{[item.submitted.type, item.submitted.number].filter(Boolean).join(' · ') || '—'}<small>{item.submitted.issuer || ''}</small></td>
            <td className="nowrap-cell">{formatDay(item.submitted.expiresOn, language) || '—'}</td>
            <td className="nowrap-cell">{formatDay(item.submittedAt, language) || '—'}</td>
            <td><Button variant="secondary" onClick={() => setReviewing({ request: item, row })}><FileText size={15} />{en ? 'Review' : 'Έλεγχος'}</Button></td>
          </> }} />
      </div>}
      <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search supplier, certificate, e-mail…' : 'Αναζήτηση προμηθευτή, πιστοποιητικού, email…'} activeAdvancedCount={(filters.state !== 'expired' ? 1 : 0) + (filters.request !== 'all' ? 1 : 0)} onClear={() => setFilters({ ...NO_FILTERS })}>
        <FilterSelect label={en ? 'Certificate' : 'Πιστοποιητικό'} value={filters.state} onChange={value => set('state', value)}><option value="expired">{en ? 'Expired' : 'Ληγμένα'}</option><option value="expiring">{en ? 'Expiring within 60 days' : 'Λήγουν σε 60 ημέρες'}</option><option value="all">{en ? 'Expired or expiring' : 'Ληγμένα ή που λήγουν'}</option></FilterSelect>
        <FilterSelect label={en ? 'Request' : 'Αίτημα'} value={filters.request} onChange={value => set('request', value)}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="none">{en ? 'No request in progress' : 'Χωρίς αίτημα σε εξέλιξη'}</option>{['proposed', 'sent', 'submitted', 'accepted', 'rejected', 'cancelled'].map(value => <option key={value} value={value}>{requestStatusLabel(value, language)}</option>)}</FilterSelect>
      </FilterBar>
      <div className="scroll-table">
        <RegistryTable bare className="quality-table quality-register-table supplier-renewal-table" rows={visible} rowKey={row => row.key} empty={!list.loading && !rows.length} emptyFiltered={queue.length > 0} onClearFilters={() => setFilters({ ...NO_FILTERS })}
          columns={[{ key: 'select', label: <CheckboxField label="" ariaLabel={en ? 'Select all' : 'Επιλογή όλων'} checked={allVisible} disabled={!selectableVisible.length} onChange={on => setSelected(current => (on ? [...new Set([...current, ...selectableVisible])] : current.filter(key => !selectableVisible.includes(key))))} /> }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'certificate', label: en ? 'Certificate' : 'Πιστοποιητικό' }, { key: 'expires', label: en ? 'Expiry' : 'Λήξη' }, { key: 'email', label: 'Email' }, { key: 'request', label: en ? 'Request' : 'Αίτημα' }, { key: 'actions', label: '' }]}
          emptyTitle={en ? 'No certificates to renew' : 'Δεν υπάρχουν πιστοποιητικά προς ανανέωση'} emptyText={en ? 'Every supplier certificate is in date.' : 'Όλα τα πιστοποιητικά των προμηθευτών είναι σε ισχύ.'}
          renderRow={row => { const request = row.request; const link = linkState(request); return <>
            <td><CheckboxField label="" ariaLabel={`${row.supplierName} · ${row.certification.type}`} checked={selected.includes(row.key)} disabled={!row.selectable} onChange={on => toggle(row.key, on)} /></td>
            <td><strong>{row.supplierName}</strong><small>{row.supplierCode}</small></td>
            <td>{certificateText(row.certification) || '—'}<small>{row.certification.issuer || ''}</small></td>
            <td className="nowrap-cell">{formatDay(row.certification.expiresOn, language) || '—'} <StatusBadge tone={certificationStateTone(row.state)}>{certificationStateLabel(row.state, language)}</StatusBadge></td>
            <td>{row.recipient || <StatusBadge tone="warning">{en ? 'No e-mail' : 'Χωρίς email'}</StatusBadge>}{row.recipients.length > 1 && <small>{en ? `+${row.recipients.length - 1} more` : `+${row.recipients.length - 1} ακόμη`}</small>}</td>
            <td>{request ? <><StatusBadge tone={link === 'expired' ? 'danger' : requestStatusTone(request.status)}>{link === 'expired' ? (en ? 'Link expired' : 'Ο σύνδεσμος έληξε') : requestStatusLabel(request.status, language)}</StatusBadge>{request.sentAt && <small>{en ? 'sent' : 'στάλθηκε'} {formatDay(request.sentAt, language)}{request.sendCount > 1 ? ` · ×${request.sendCount}` : ''}</small>}</> : '—'}</td>
            <td><div className="row-actions">
              {access.canManage && request?.status === 'proposed' && <IconButton size="sm" label={en ? 'Approve & send' : 'Έγκριση & αποστολή'} onClick={() => act(request, 'approve', en ? 'Approved; the e-mail is on its way.' : 'Εγκρίθηκε· το email στέλνεται.')}><Send size={14} /></IconButton>}
              {access.canManage && request?.status === 'sent' && <IconButton size="sm" label={en ? 'Send a new link' : 'Νέος σύνδεσμος'} onClick={() => act(request, 'resend', en ? 'A new link was sent; the previous one no longer works.' : 'Στάλθηκε νέος σύνδεσμος· ο προηγούμενος δεν ισχύει πια.')}><RefreshCw size={14} /></IconButton>}
              {access.canManage && request?.status === 'submitted' && <IconButton size="sm" label={en ? 'Review' : 'Έλεγχος'} onClick={() => setReviewing({ request, row })}><FileText size={14} /></IconButton>}
              {access.canManage && ['proposed', 'sent'].includes(request?.status) && <IconButton size="sm" tone="danger" label={en ? 'Cancel the request' : 'Ακύρωση αιτήματος'} onClick={() => act(request, 'cancel', en ? 'Request cancelled.' : 'Το αίτημα ακυρώθηκε.')}><X size={14} /></IconButton>}
            </div></td>
          </> }} />
      </div>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    </section>
    {sending && <RenewalSendDialog rows={sending} canManage={access.canManage} onClose={() => setSending(null)} onDone={async () => { setSending(null); await refresh() }} />}
    {reviewing && <RenewalReviewDialog request={reviewing.request} row={reviewing.row} canManage={access.canManage} onClose={() => setReviewing(null)} onDone={async () => { setReviewing(null); await refresh() }} />}
  </Page>
}

// The approval: the selected certificates with the address each e-mail goes to.
// Nothing is e-mailed before this confirmation; a reader without manage_quality
// only proposes the requests for a Quality manager to approve.
export function RenewalSendDialog({ rows, canManage, onClose, onDone }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const [recipients, setRecipients] = useState(() => Object.fromEntries(rows.map(row => [row.key, row.recipient])))
  const [busy, setBusy] = useState(false)
  const invalid = rows.filter(row => !isEmail(recipients[row.key]))
  async function send() {
    if (invalid.length || busy) return
    setBusy(true)
    try {
      const result = await createCertificateRequests(tenant?.id, sendItems(rows, rows.map(row => row.key), recipients), { send: canManage })
      const done = Number(result?.created || 0), skipped = (result?.skipped || []).length
      const demo = isDemoDataEnvironment() ? (en ? ' (demo: no e-mail is actually sent)' : ' (demo: δεν στέλνεται πραγματικό email)') : ''
      notify(canManage ? (en ? `${done} request${done === 1 ? '' : 's'} approved and sent${skipped ? `, ${skipped} skipped` : ''}.${demo}` : `Εγκρίθηκαν και στάλθηκαν ${done} αιτήματα${skipped ? `· ${skipped} παραλείφθηκαν` : ''}.${demo}`) : (en ? `${done} request${done === 1 ? '' : 's'} proposed for approval.` : `Προτάθηκαν ${done} αιτήματα για έγκριση.`), 'success')
      await onDone()
    } catch (error) { console.error(error); notify(en ? 'The requests could not be created.' : 'Δεν ήταν δυνατή η δημιουργία των αιτημάτων.', 'error') } finally { setBusy(false) }
  }
  return <ObserverDialog width="wide" title={canManage ? (en ? 'Approve & send renewal requests' : 'Έγκριση & αποστολή αιτημάτων ανανέωσης') : (en ? 'Propose renewal requests' : 'Πρόταση αιτημάτων ανανέωσης')}
    subtitle={canManage ? (en ? 'Each supplier gets an e-mail with a personal link, valid 14 days, to upload the renewed certificate.' : 'Κάθε προμηθευτής λαμβάνει email με προσωπικό σύνδεσμο (ισχύει 14 ημέρες) για να ανεβάσει το ανανεωμένο πιστοποιητικό.') : (en ? 'A Quality manager approves them before anything is sent.' : 'Ένας υπεύθυνος Ποιότητας τα εγκρίνει πριν σταλεί οτιδήποτε.')}
    onClose={onClose} footer={<DialogActions onSave={send} disabled={busy || Boolean(invalid.length)} saveLabel={busy ? (en ? 'Sending…' : 'Αποστολή…') : canManage ? (en ? `Approve & send (${rows.length})` : `Έγκριση & αποστολή (${rows.length})`) : (en ? `Propose (${rows.length})` : `Πρόταση (${rows.length})`)} />}>
    <div className="supplier-renewal-send">
      {rows.map(row => <div key={row.key} className="supplier-renewal-send-row">
        <div><strong>{row.supplierName}</strong><small>{certificateText(row.certification)} · {en ? 'expiry' : 'λήξη'} {formatDay(row.certification.expiresOn, language) || '—'}</small></div>
        <Field label={en ? 'E-mail *' : 'Email *'} error={recipients[row.key] && !isEmail(recipients[row.key]) ? (en ? 'Not a valid e-mail' : 'Μη έγκυρο email') : ''}><input type="email" value={recipients[row.key] || ''} onChange={e => setRecipients(current => ({ ...current, [row.key]: e.target.value }))} /></Field>
      </div>)}
    </div>
  </ObserverDialog>
}

// The review of a submitted certificate: the current and the submitted values, the
// file; «Accept» replaces the certificate, «Reject» needs a comment and may send a new link.
export function RenewalReviewDialog({ request, row, canManage, onClose, onDone }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const [comment, setComment] = useState('')
  const [resend, setResend] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const current = row?.certification || {}
  const old = request.snapshot || {}
  async function openFile() {
    try { const url = await getAttachmentUrl(request.attachment.storagePath); if (url) window.open(url, '_blank', 'noopener') } catch (error) { console.error(error); notify(en ? 'The file could not be opened.' : 'Δεν ήταν δυνατό το άνοιγμα του αρχείου.', 'error') }
  }
  async function decide(action) {
    if (busy || (action === 'reject' && !comment.trim())) return
    setBusy(true)
    try {
      await certificateRequestAction(tenant?.id, request, action, { comment: comment.trim(), resend: action === 'reject' && resend })
      notify(action === 'accept' ? (en ? 'Accepted: the certificate was replaced.' : 'Έγινε αποδεκτό: το πιστοποιητικό αντικαταστάθηκε.') : (en ? 'Rejected.' : 'Απορρίφθηκε.'), 'success')
      await onDone()
    } catch (error) { console.error(error); notify(en ? 'The action could not be completed.' : 'Η ενέργεια δεν ολοκληρώθηκε.', 'error') } finally { setBusy(false) }
  }
  const lines = [
    [en ? 'Certificate' : 'Πιστοποιητικό', old.certificate_type || current.type, request.submitted.type],
    [en ? 'Number' : 'Αριθμός', old.certificate_number || current.number, request.submitted.number],
    [en ? 'Issued by' : 'Φορέας', old.issuer || current.issuer, request.submitted.issuer],
    [en ? 'Issued on' : 'Έκδοση', '', formatDay(request.submitted.issuedOn, language)],
    [en ? 'Expires' : 'Λήξη', formatDay(old.expires_on || current.expiresOn, language), formatDay(request.submitted.expiresOn, language)],
  ]
  return <ObserverDialog width="wide" title={en ? 'Review the renewed certificate' : 'Έλεγχος ανανεωμένου πιστοποιητικού'} subtitle={[row?.supplierName, request.recipientEmail, request.submittedAt && `${en ? 'submitted' : 'υποβλήθηκε'} ${formatDay(request.submittedAt, language)}`].filter(Boolean).join(' · ')} onClose={onClose}
    footer={canManage && <DialogActions>{rejecting
      ? <><Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>{en ? 'Back' : 'Πίσω'}</Button><Button disabled={busy || !comment.trim()} onClick={() => decide('reject')}><X size={15} />{en ? 'Reject' : 'Απόρριψη'}</Button></>
      : <><Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}><X size={15} />{en ? 'Reject…' : 'Απόρριψη…'}</Button><Button disabled={busy} onClick={() => decide('accept')}><CheckCircle2 size={15} />{en ? 'Accept & replace' : 'Αποδοχή & αντικατάσταση'}</Button></>}</DialogActions>}>
    <div className="resource-evaluation">
      <table className="data-table quality-table">
        <thead><tr><th></th><th>{en ? 'On file' : 'Στο αρχείο'}</th><th>{en ? 'Submitted' : 'Υποβλήθηκε'}</th></tr></thead>
        <tbody>{lines.map(([label, before, after]) => <tr key={label}><td>{label}</td><td>{before || '—'}</td><td><strong>{after || '—'}</strong></td></tr>)}</tbody>
      </table>
      {request.submitted.note && <Field label={en ? 'Supplier note' : 'Σημείωση προμηθευτή'}><p className="supplier-renewal-note">{request.submitted.note}</p></Field>}
      {request.attachment ? <div className="row-actions"><Button variant="secondary" onClick={openFile}><FileText size={15} />{request.attachment.name}</Button><small>{en ? 'Also in the supplier’s Documents.' : 'Υπάρχει και στα Έγγραφα του προμηθευτή.'}</small></div>
        : <p className="inline-empty">{isDemoDataEnvironment() ? (en ? 'Demo: the file is not kept.' : 'Demo: το αρχείο δεν φυλάσσεται.') : (en ? 'No file.' : 'Χωρίς αρχείο.')}</p>}
      {rejecting && <>
        <Field label={en ? 'Why is it rejected? *' : 'Γιατί απορρίπτεται; *'}><textarea rows={3} autoFocus value={comment} onChange={e => setComment(e.target.value)} placeholder={en ? 'e.g. the certificate does not cover the products we buy' : 'π.χ. το πιστοποιητικό δεν καλύπτει τα προϊόντα που προμηθευόμαστε'} /></Field>
        <CheckboxField label={en ? 'Send a new link with this comment' : 'Αποστολή νέου συνδέσμου με το σχόλιο'} checked={resend} onChange={setResend} />
      </>}
    </div>
  </ObserverDialog>
}

// The per-certificate request on the supplier's record: whether one can be sent.
export function canRequestRenewal(row) { return Boolean(row) && (row.state === 'expired' || row.state === 'expiring') && !isOpenRequest(row.request) }
