import { useCallback, useEffect, useMemo, useState } from 'react'
import { FigureCards } from '../../../design-system/FigureCards'
import { BellRing, CheckCircle2, FileText, Lock, Moon, RefreshCw, Send, X } from 'lucide-react'
import { Page } from '../../../design-system/Page'
import { BackButton } from '../../../design-system/BackButton'
import { RegistryTable } from '../../../design-system/RegistryTable'
import { RegistryPagination } from '../../../design-system/RegistryPagination'
import { FilterBar, FilterSelect } from '../../../design-system/FilterBar'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { ExportMenu } from '../../../design-system/ExportMenu'
import { Button } from '../../../design-system/Button'
import { IconButton } from '../../../design-system/IconButton'
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
import { filterRenewals, isEmail, isOpenItem, itemStatusLabel, itemStatusTone, renewalCounts, renewalGroups, renewalPermissions, renewalQueue, requestItems, requestStatusLabel, requestStatusTone, sendGroups, sendItems, senderOnlyHint } from './supplierRenewalModel'
import { certificateItemAction, certificateRequestAction, createCertificateRequests, DEFAULT_RENEWAL_SETTINGS, loadCertificateRequests, loadRenewalSettings, saveRenewalSettings } from './supplierRenewalService'
import '../quality.css'
import './resources.css'

const NO_FILTERS = { query: '', state: 'expired', request: 'all' }

// The renewal requests of the organization (Quality reads them), each with its certificates.
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

// A sending action for someone who may not send: shown disabled, with the reason.
function SenderLocked({ allowed, language, children }) {
  if (allowed) return children
  return <span className="supplier-renewal-locked" title={senderOnlyHint(language)}>{children}</span>
}

// Quality → Resources → Suppliers → «Certificates to renew»: the expired certificates
// by supplier; one e-mail per supplier with a personal link to upload each renewed
// certificate, which Quality then accepts or rejects one by one. Only the Platform
// Owner and the members it designates send; everyone else in Quality proposes.
export function SupplierRenewalsPage() {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const access = useResourceAccess()
  const perms = renewalPermissions({ owner: access.owner, canSend: access.canSend, canManage: access.canManage, canView: access.canViewAll })
  const { goBack } = useContextualNavigation('/quality')
  const list = useResources()
  const { requests, loading, reload } = useCertificateRequests(access.canViewAll)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [selected, setSelected] = useState([])
  const [sending, setSending] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [autoOpen, setAutoOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const queue = useMemo(() => renewalQueue(list.suppliers, requests, { expiring: true }), [list.suppliers, requests])
  const groups = useMemo(() => renewalGroups(queue), [queue])
  const rows = useMemo(() => filterRenewals(groups, filters), [groups, filters])
  const counts = useMemo(() => renewalCounts(groups, requests), [groups, requests])
  const submitted = useMemo(() => requestItems(requests).filter(item => item.status === 'submitted'), [requests])
  const byCertificate = useMemo(() => new Map(queue.map(row => [row.certification.id, row])), [queue])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), safePage = Math.min(page, totalPages)
  const visible = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selectableVisible = visible.flatMap(group => group.selectable.map(row => row.key))
  const allVisible = selectableVisible.length > 0 && selectableVisible.every(key => selected.includes(key))
  const toggle = (keys, on) => setSelected(current => (on ? [...new Set([...current, ...keys])] : current.filter(item => !keys.includes(item))))
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const refresh = async () => { setSelected([]); await Promise.all([reload(), list.reload()]) }
  const lockedText = senderOnlyHint(language)

  async function act(request, action, message) {
    try { await certificateRequestAction(tenant?.id, request, action); notify(message, 'success'); await refresh() } catch (error) { console.error(error); notify(en ? 'The action could not be completed.' : 'Η ενέργεια δεν ολοκληρώθηκε.', 'error') }
  }
  const exportQueue = () => exportRegistry({
    name: en ? 'supplier-certificates-to-renew' : 'pistopoiitika-pros-ananeosi',
    headers: en ? ['Supplier code', 'Supplier', 'Certificate', 'Expires', 'State', 'E-mail', 'Request', 'Certificate request'] : ['Κωδικός', 'Προμηθευτής', 'Πιστοποιητικό', 'Λήξη', 'Κατάσταση', 'Email', 'Αίτημα', 'Πιστοποιητικό στο αίτημα'],
    rows: rows.flatMap(group => group.rows.map(row => [row.supplierCode, row.supplierName, certificateText(row.certification), row.certification.expiresOn, certificationStateLabel(row.state, language), row.recipient, row.request && isOpenItem(row.item) ? requestStatusLabel(row.request.status, language) : '', row.item ? itemStatusLabel(row.item.status, language) : ''])),
  })
  const selectedRows = queue.filter(row => selected.includes(row.key) && row.selectable)
  const selectedSuppliers = new Set(selectedRows.map(row => row.supplierId)).size
  // «Send to all»: every expired certificate with nothing open, of a supplier with an e-mail.
  const allExpired = queue.filter(row => row.state === 'expired' && row.selectable && row.recipients.length > 0)
  const allSuppliers = new Set(allExpired.map(row => row.supplierId)).size

  return <Page fill className="supplier-renewals-page" navigation={<BackButton onClick={goBack} label={en ? 'Back to suppliers' : 'Πίσω στους προμηθευτές'} />}
    title={en ? 'Certificates to renew' : 'Πιστοποιητικά προς ανανέωση'}
    subtitle={en ? 'Expired supplier certificates, by supplier. After approval each supplier gets one e-mail with a personal link listing all its certificates to replace; you then accept each one and it replaces the old one.' : 'Τα ληγμένα πιστοποιητικά, ανά προμηθευτή. Μετά την έγκριση κάθε προμηθευτής λαμβάνει ένα email με προσωπικό σύνδεσμο για όλα τα πιστοποιητικά του· όταν αποδεχθείτε το καθένα, αντικαθιστά το παλιό.'}
    actions={<div className="row-actions"><ExportMenu disabled={!rows.length} onExcel={exportQueue} />
      {perms.send && <Button variant="secondary" onClick={() => setAutoOpen(true)}><Moon size={15} />{en ? 'Automatic' : 'Αυτόματα'}</Button>}
      {perms.send && allExpired.length > 0 && !selectedRows.length && <Button onClick={() => setSending(allExpired)}><Send size={15} />{en ? `Send to all expired (${allSuppliers})` : `Αποστολή σε όλους τους ληγμένους (${allSuppliers})`}</Button>}
      {selectedRows.length > 0 && <Button onClick={() => setSending(selectedRows)}><Send size={15} />{perms.send ? (en ? `Approve & send (${selectedSuppliers} e-mails)` : `Έγκριση & αποστολή (${selectedSuppliers} email)`) : (en ? `Propose (${selectedRows.length})` : `Πρόταση για αποστολή (${selectedRows.length})`)}</Button>}</div>}>
    <FigureCards className="quality-summary-line">
      <button type="button" className={`${counts.expired ? 'is-late' : ''}${filters.state === 'expired' && filters.request === 'all' ? ' is-active' : ''}`.trim() || undefined} onClick={() => setFilters({ ...NO_FILTERS })}><b>{list.loading ? '—' : counts.expired}</b> {en ? `expired certificates · ${counts.suppliers} suppliers` : `ληγμένα πιστοποιητικά · ${counts.suppliers} προμηθευτές`}</button>
      <button type="button" className={filters.request === 'none' ? 'is-active' : undefined} onClick={() => setFilters(current => ({ ...current, state: 'all', request: 'none' }))}><b>{list.loading ? '—' : counts.toSend}</b> {en ? 'suppliers ready to send' : 'προμηθευτές για αποστολή'}</button>
      <button type="button" className={filters.request === 'sent' ? 'is-active' : undefined} onClick={() => setFilters(current => ({ ...current, state: 'all', request: 'sent' }))}><b>{loading ? '—' : counts.sent}</b> {en ? 'awaiting the supplier' : 'αναμένεται ο προμηθευτής'}</button>
      <button type="button" className={`${counts.noResponse ? 'is-late' : ''}${filters.request === 'no_response' ? ' is-active' : ''}`.trim() || undefined} onClick={() => setFilters(current => ({ ...current, state: 'all', request: 'no_response' }))}><b>{loading ? '—' : counts.noResponse}</b> {en ? 'no answer (7+ days)' : 'χωρίς απάντηση (7+ ημέρες)'}</button>
      <span><b>{loading ? '—' : counts.submitted}</b> {en ? 'submitted, to review' : 'υποβλήθηκαν, προς έλεγχο'}</span>
    </FigureCards>
    <section className="surface registry-workspace workspace-column workspace-fill">
      {!perms.send && <p className="supplier-renewal-locked-note"><Lock size={14} /><span>{en ? `Sending and reminders: ${lockedText.toLowerCase()}. You can propose requests for approval.` : `Αποστολή και υπενθυμίσεις: ${lockedText}. Μπορείτε να προτείνετε αιτήματα για έγκριση.`}</span></p>}
      {submitted.length > 0 && <div className="supplier-renewal-review">
        <SectionHeader title={en ? `Submitted certificates to review ${submitted.length}` : `Υποβολές προς έλεγχο ${submitted.length}`} subtitle={en ? 'Accept to replace the old certificate (its values are kept), or reject with a comment.' : 'Με την αποδοχή αντικαθίσταται το παλιό πιστοποιητικό (οι προηγούμενες τιμές κρατούνται)· ή απορρίψτε με σχόλιο.'} />
        <RegistryTable sortable={false} className="quality-table" rows={submitted} rowKey={item => item.id}
          columns={[{ key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'certificate', label: en ? 'New certificate' : 'Νέο πιστοποιητικό' }, { key: 'expires', label: en ? 'New expiry' : 'Νέα λήξη' }, { key: 'submitted', label: en ? 'Submitted' : 'Υποβλήθηκε' }, { key: 'actions', label: '' }]}
          renderRow={item => { const row = byCertificate.get(item.certificationId); return <>
            <td><strong>{row?.supplierName || '—'}</strong><small>{item.request.recipientEmail}</small></td>
            <td>{[item.submitted.type, item.submitted.number].filter(Boolean).join(' · ') || '—'}<small>{item.submitted.issuer || ''}</small></td>
            <td className="nowrap-cell">{formatDay(item.submitted.expiresOn, language) || '—'}</td>
            <td className="nowrap-cell">{formatDay(item.submittedAt, language) || '—'}</td>
            <td>{perms.review && <Button variant="secondary" onClick={() => setReviewing({ item, row })}><FileText size={15} />{en ? 'Review' : 'Έλεγχος'}</Button>}</td>
          </> }} />
      </div>}
      <FilterBar query={filters.query} onQueryChange={value => set('query', value)} placeholder={en ? 'Search supplier, certificate, e-mail…' : 'Αναζήτηση προμηθευτή, πιστοποιητικού, email…'} activeAdvancedCount={(filters.state !== 'expired' ? 1 : 0) + (filters.request !== 'all' ? 1 : 0)} onClear={() => setFilters({ ...NO_FILTERS })}>
        <FilterSelect label={en ? 'Certificate' : 'Πιστοποιητικό'} value={filters.state} onChange={value => set('state', value)}><option value="expired">{en ? 'Expired' : 'Ληγμένα'}</option><option value="expiring">{en ? 'Expiring within 60 days' : 'Λήγουν σε 60 ημέρες'}</option><option value="all">{en ? 'Expired or expiring' : 'Ληγμένα ή που λήγουν'}</option></FilterSelect>
        <FilterSelect label={en ? 'Request' : 'Αίτημα'} value={filters.request} onChange={value => set('request', value)}><option value="all">{en ? 'All' : 'Όλα'}</option><option value="none">{en ? 'Something to send' : 'Με πιστοποιητικά προς αποστολή'}</option><option value="proposed">{requestStatusLabel('proposed', language)}</option><option value="sent">{requestStatusLabel('sent', language)}</option><option value="no_response">{en ? 'No answer' : 'Χωρίς απάντηση'}</option><option value="submitted">{en ? 'Submitted, to review' : 'Υποβλήθηκαν, προς έλεγχο'}</option></FilterSelect>
      </FilterBar>
      <div className="scroll-table">
        <RegistryTable sortable={false} bare className="quality-table quality-register-table supplier-renewal-table" rows={visible} rowKey={group => group.key} empty={!list.loading && !rows.length} emptyFiltered={groups.length > 0} onClearFilters={() => setFilters({ ...NO_FILTERS })}
          columns={[{ key: 'select', label: <CheckboxField label="" ariaLabel={en ? 'Select all' : 'Επιλογή όλων'} checked={allVisible} disabled={!selectableVisible.length} onChange={on => toggle(selectableVisible, on)} /> }, { key: 'supplier', label: en ? 'Supplier' : 'Προμηθευτής' }, { key: 'certificates', label: en ? 'Certificates' : 'Πιστοποιητικά' }, { key: 'email', label: 'Email' }, { key: 'request', label: en ? 'Request' : 'Αίτημα' }, { key: 'actions', label: '' }]}
          emptyTitle={en ? 'No certificates to renew' : 'Δεν υπάρχουν πιστοποιητικά προς ανανέωση'} emptyText={en ? 'Every supplier certificate is in date.' : 'Όλα τα πιστοποιητικά των προμηθευτών είναι σε ισχύ.'}
          renderRow={group => { const request = group.request; const keys = group.selectable.map(row => row.key); return <>
            <td><CheckboxField label="" ariaLabel={`${group.supplierName} · ${group.rows.length}`} checked={keys.length > 0 && keys.every(key => selected.includes(key))} disabled={!keys.length} onChange={on => toggle(keys, on)} /></td>
            <td><strong>{group.supplierName}</strong><small>{group.supplierCode}{group.rows.length > 1 ? ` · ${en ? `${group.rows.length} certificates` : `${group.rows.length} πιστοποιητικά`}` : ''}</small></td>
            <td><ul className="supplier-renewal-certs">{group.rows.map(row => <li key={row.key}>
              <span>{certificateText(row.certification) || '—'}</span>
              <span className="nowrap-cell">{formatDay(row.certification.expiresOn, language) || '—'} <StatusBadge tone={certificationStateTone(row.state)}>{certificationStateLabel(row.state, language)}</StatusBadge>{isOpenItem(row.item) && <> <StatusBadge tone={itemStatusTone(row.item.status)}>{itemStatusLabel(row.item.status, language)}</StatusBadge></>}</span>
            </li>)}</ul></td>
            <td>{group.recipient || <StatusBadge tone="warning">{en ? 'No e-mail' : 'Χωρίς email'}</StatusBadge>}{group.recipients.length > 1 && <small>{en ? `+${group.recipients.length - 1} more` : `+${group.recipients.length - 1} ακόμη`}</small>}</td>
            <td>{request ? <>
              {group.noResponse != null ? <StatusBadge tone="warning">{en ? `No answer (${group.noResponse} days)` : `Χωρίς απάντηση (${group.noResponse} ημέρες)`}</StatusBadge>
                : <StatusBadge tone={group.link === 'expired' ? 'danger' : requestStatusTone(request.status)}>{group.link === 'expired' ? (en ? 'Link expired' : 'Ο σύνδεσμος έληξε') : requestStatusLabel(request.status, language)}</StatusBadge>}
              {request.sentAt && <small>{en ? 'sent' : 'στάλθηκε'} {formatDay(request.firstSentAt || request.sentAt, language)}{request.sendCount > 1 ? ` · ×${request.sendCount}` : ''}{request.reminderCount ? ` · ${en ? 'reminded' : 'υπενθύμιση'} ${formatDay(request.lastReminderAt, language)}` : ''}</small>}
              {request.tokenExpiresAt && group.link !== 'expired' && <small>{en ? 'link until' : 'σύνδεσμος έως'} {formatDay(request.tokenExpiresAt, language)}</small>}
            </> : '—'}</td>
            <td><div className="row-actions">
              {request?.status === 'proposed' && <SenderLocked allowed={perms.send} language={language}><IconButton size="sm" disabled={!perms.send} label={perms.send ? (en ? 'Approve & send' : 'Έγκριση & αποστολή') : lockedText} onClick={() => act(request, 'approve', en ? 'Approved; the e-mail is on its way.' : 'Εγκρίθηκε· το email στέλνεται.')}><Send size={14} /></IconButton></SenderLocked>}
              {request?.status === 'sent' && <SenderLocked allowed={perms.send} language={language}><Button variant="secondary" disabled={!perms.send} title={perms.send ? (en ? 'The same link again, valid 14 more days' : 'Ο ίδιος σύνδεσμος ξανά, ισχύει 14 ημέρες ακόμη') : lockedText} onClick={() => act(request, 'remind', en ? 'Reminder sent; the link is valid 14 more days.' : 'Στάλθηκε υπενθύμιση· ο σύνδεσμος ισχύει 14 ημέρες ακόμη.')}><BellRing size={14} />{en ? 'Reminder' : 'Υπενθύμιση'}</Button></SenderLocked>}
              {request?.status === 'sent' && <SenderLocked allowed={perms.send} language={language}><IconButton size="sm" disabled={!perms.send} label={perms.send ? (en ? 'Resend with a new link' : 'Επαναποστολή με νέο σύνδεσμο') : lockedText} onClick={() => act(request, 'resend', en ? 'A new link was sent; the previous one no longer works.' : 'Στάλθηκε νέος σύνδεσμος· ο προηγούμενος δεν ισχύει πια.')}><RefreshCw size={14} /></IconButton></SenderLocked>}
              {perms.cancel && request && <IconButton size="sm" tone="danger" label={en ? 'Cancel the request' : 'Ακύρωση αιτήματος'} onClick={() => act(request, 'cancel', en ? 'Request cancelled.' : 'Το αίτημα ακυρώθηκε.')}><X size={14} /></IconButton>}
            </div></td>
          </> }} />
      </div>
      {rows.length > 0 && <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
    </section>
    {autoOpen && <RenewalAutoDialog organizationId={tenant?.id} onClose={() => setAutoOpen(false)} />}
    {sending && <RenewalSendDialog rows={sending} canSend={perms.send} onClose={() => setSending(null)} onDone={async () => { setSending(null); await refresh() }} />}
    {reviewing && <RenewalReviewDialog item={reviewing.item} row={reviewing.row} canManage={perms.review} canSend={perms.send} onClose={() => setReviewing(null)} onDone={async () => { setReviewing(null); await refresh() }} />}
  </Page>
}

// The nightly automatic e-mailing of this hospital (off by default): requests for the
// expired certificates, a reminder after a few days, and a note to the Platform Owner
// when suppliers submit.
export function RenewalAutoDialog({ organizationId, onClose }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const [settings, setSettings] = useState(DEFAULT_RENEWAL_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { loadRenewalSettings(organizationId).then(setSettings).catch(error => console.error(error)).finally(() => setLoaded(true)) }, [organizationId])
  const set = (key, value) => setSettings(current => ({ ...current, [key]: value }))
  async function save() {
    if (busy) return
    setBusy(true)
    try { await saveRenewalSettings(organizationId, settings); notify(en ? 'Saved.' : 'Αποθηκεύτηκε.', 'success'); onClose() } catch (error) { console.error(error); notify(en ? 'It could not be saved.' : 'Δεν αποθηκεύτηκε.', 'error') } finally { setBusy(false) }
  }
  const last = settings.lastRunAt ? formatDay(settings.lastRunAt.slice(0, 10), language) : ''
  return <ObserverDialog title={en ? 'Automatic e-mails to suppliers' : 'Αυτόματα email στους προμηθευτές'}
    subtitle={isDemoDataEnvironment() ? (en ? 'Demo: nothing is actually e-mailed.' : 'Demo: δεν στέλνεται πραγματικό email.') : (en ? 'Every night the platform checks the supplier certificates.' : 'Κάθε βράδυ η πλατφόρμα ελέγχει τα πιστοποιητικά των προμηθευτών.')}
    onClose={onClose} footer={<DialogActions onSave={save} disabled={busy || !loaded} saveLabel={en ? 'Save' : 'Αποθήκευση'} />}>
    <div className="supplier-renewal-send">
      <CheckboxField label={en ? 'E-mail suppliers with expired certificates automatically' : 'Αυτόματη αποστολή email στους προμηθευτές με ληγμένα πιστοποιητικά'} checked={settings.autoEnabled} disabled={!loaded} onChange={value => set('autoEnabled', value)} />
      <small>{en ? 'Each supplier gets one e-mail with the link to the form. Suppliers without an e-mail, with a request in progress or asked in the last 30 days are skipped.' : 'Κάθε προμηθευτής παίρνει ένα email με τον σύνδεσμο της φόρμας. Παραλείπονται όσοι δεν έχουν email, έχουν ανοιχτό αίτημα ή τους ζητήθηκε τις τελευταίες 30 ημέρες.'}</small>
      <Field label={en ? 'Remind after (days)' : 'Υπενθύμιση μετά από (ημέρες)'}><input type="number" min="3" max="30" value={settings.remindAfterDays} disabled={!settings.autoEnabled} onChange={e => set('remindAfterDays', e.target.value)} /></Field>
      <Field label={en ? 'Reminders at most' : 'Το πολύ υπενθυμίσεις'}><input type="number" min="0" max="5" value={settings.maxReminders} disabled={!settings.autoEnabled} onChange={e => set('maxReminders', e.target.value)} /></Field>
      <small>{en ? 'The Platform Owner is notified by e-mail when suppliers submit new certificates.' : 'Ο Ιδιοκτήτης πλατφόρμας ειδοποιείται με email όταν οι προμηθευτές υποβάλλουν νέα πιστοποιητικά.'}</small>
      {last && <small>{en ? `Last check: ${last}` : `Τελευταίος έλεγχος: ${last}`}{settings.lastResult?.ok === false ? (en ? ' · failed' : ' · απέτυχε') : ''}</small>}
    </div>
  </ObserverDialog>
}

// The approval: the selected certificates by supplier, with the address of each
// supplier's single e-mail. Nothing is e-mailed before this confirmation; whoever may
// not send only proposes the requests for the Platform Owner or a designated sender.
export function RenewalSendDialog({ rows, canSend, onClose, onDone }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const groups = useMemo(() => sendGroups(rows, rows.map(row => row.key)), [rows])
  const [recipients, setRecipients] = useState(() => Object.fromEntries(groups.map(group => [group.supplierId, group.recipient])))
  const [busy, setBusy] = useState(false)
  const invalid = groups.filter(group => !isEmail(recipients[group.supplierId]))
  async function send() {
    if (invalid.length || busy) return
    setBusy(true)
    try {
      const result = await createCertificateRequests(tenant?.id, sendItems(rows, rows.map(row => row.key), recipients), { send: canSend })
      const done = Number(result?.created || 0), mails = Number(result?.sent || 0), skipped = (result?.skipped || []).length
      const demo = isDemoDataEnvironment() ? (en ? ' (demo: no e-mail is actually sent)' : ' (demo: δεν στέλνεται πραγματικό email)') : ''
      notify(canSend ? (en ? `${mails} e-mail${mails === 1 ? '' : 's'} sent for ${done} certificate${done === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.${demo}` : `Στάλθηκαν ${mails} email για ${done} πιστοποιητικά${skipped ? `· ${skipped} παραλείφθηκαν` : ''}.${demo}`) : (en ? `${done} certificate${done === 1 ? '' : 's'} proposed for approval.` : `Προτάθηκαν ${done} πιστοποιητικά για έγκριση.`), 'success')
      await onDone()
    } catch (error) { console.error(error); notify(en ? 'The requests could not be created.' : 'Δεν ήταν δυνατή η δημιουργία των αιτημάτων.', 'error') } finally { setBusy(false) }
  }
  return <ObserverDialog width="wide" title={canSend ? (en ? 'Approve & send renewal requests' : 'Έγκριση & αποστολή αιτημάτων ανανέωσης') : (en ? 'Propose renewal requests' : 'Πρόταση αιτημάτων ανανέωσης')}
    subtitle={canSend ? (en ? 'Each supplier gets one e-mail with a personal link, valid 14 days, listing all its certificates to upload.' : 'Κάθε προμηθευτής λαμβάνει ένα email με προσωπικό σύνδεσμο (ισχύει 14 ημέρες) με όλα τα πιστοποιητικά που πρέπει να ανεβάσει.') : (en ? `${senderOnlyHint(language)} approve them before anything is sent.` : `${senderOnlyHint(language)} τα εγκρίνουν πριν σταλεί οτιδήποτε.`)}
    onClose={onClose} footer={<DialogActions onSave={send} disabled={busy || Boolean(invalid.length)} saveLabel={busy ? (en ? 'Sending…' : 'Αποστολή…') : canSend ? (en ? `Approve & send (${groups.length} e-mails)` : `Έγκριση & αποστολή (${groups.length} email)`) : (en ? `Propose (${rows.length})` : `Πρόταση (${rows.length})`)} />}>
    <div className="supplier-renewal-send">
      {groups.map(group => <div key={group.supplierId} className="supplier-renewal-send-row">
        <div><strong>{group.supplierName}</strong>{group.rows.map(row => <small key={row.key}>{certificateText(row.certification)} · {en ? 'expiry' : 'λήξη'} {formatDay(row.certification.expiresOn, language) || '—'}</small>)}</div>
        <Field label={en ? 'E-mail *' : 'Email *'} error={recipients[group.supplierId] && !isEmail(recipients[group.supplierId]) ? (en ? 'Not a valid e-mail' : 'Μη έγκυρο email') : ''}><input type="email" value={recipients[group.supplierId] || ''} onChange={e => setRecipients(current => ({ ...current, [group.supplierId]: e.target.value }))} /></Field>
      </div>)}
    </div>
  </ObserverDialog>
}

// The review of one submitted certificate: the current and the submitted values, the
// file; «Accept» replaces the certificate, «Reject» needs a comment and may ask for it
// again on the same link (that sends a reminder: Platform Owner or a designated sender).
export function RenewalReviewDialog({ item, row, canManage, canSend, onClose, onDone }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notify } = useFeedback()
  const { tenant } = useTenant()
  const [comment, setComment] = useState('')
  const [resend, setResend] = useState(Boolean(canSend))
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const current = row?.certification || {}
  const old = item.snapshot || {}
  async function openFile() {
    try { const url = await getAttachmentUrl(item.attachment.storagePath); if (url) window.open(url, '_blank', 'noopener') } catch (error) { console.error(error); notify(en ? 'The file could not be opened.' : 'Δεν ήταν δυνατό το άνοιγμα του αρχείου.', 'error') }
  }
  async function decide(action) {
    if (busy || (action === 'reject' && !comment.trim())) return
    setBusy(true)
    try {
      await certificateItemAction(tenant?.id, item, action, { comment: comment.trim(), resend: action === 'reject' && canSend && resend })
      notify(action === 'accept' ? (en ? 'Accepted: the certificate was replaced.' : 'Έγινε αποδεκτό: το πιστοποιητικό αντικαταστάθηκε.') : (en ? 'Rejected.' : 'Απορρίφθηκε.'), 'success')
      await onDone()
    } catch (error) { console.error(error); notify(en ? 'The action could not be completed.' : 'Η ενέργεια δεν ολοκληρώθηκε.', 'error') } finally { setBusy(false) }
  }
  const lines = [
    [en ? 'Certificate' : 'Πιστοποιητικό', old.certificate_type || current.type, item.submitted.type],
    [en ? 'Number' : 'Αριθμός', old.certificate_number || current.number, item.submitted.number],
    [en ? 'Issued by' : 'Φορέας', old.issuer || current.issuer, item.submitted.issuer],
    [en ? 'Issued on' : 'Έκδοση', '', formatDay(item.submitted.issuedOn, language)],
    [en ? 'Expires' : 'Λήξη', formatDay(old.expires_on || current.expiresOn, language), formatDay(item.submitted.expiresOn, language)],
  ]
  return <ObserverDialog width="wide" title={en ? 'Review the renewed certificate' : 'Έλεγχος ανανεωμένου πιστοποιητικού'} subtitle={[row?.supplierName, item.request?.recipientEmail, item.submittedAt && `${en ? 'submitted' : 'υποβλήθηκε'} ${formatDay(item.submittedAt, language)}`].filter(Boolean).join(' · ')} onClose={onClose}
    footer={canManage && <DialogActions>{rejecting
      ? <><Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>{en ? 'Back' : 'Πίσω'}</Button><Button disabled={busy || !comment.trim()} onClick={() => decide('reject')}><X size={15} />{en ? 'Reject' : 'Απόρριψη'}</Button></>
      : <><Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}><X size={15} />{en ? 'Reject…' : 'Απόρριψη…'}</Button><Button disabled={busy} onClick={() => decide('accept')}><CheckCircle2 size={15} />{en ? 'Accept & replace' : 'Αποδοχή & αντικατάσταση'}</Button></>}</DialogActions>}>
    <div className="resource-evaluation">
      <table className="data-table quality-table">
        <thead><tr><th></th><th>{en ? 'On file' : 'Στο αρχείο'}</th><th>{en ? 'Submitted' : 'Υποβλήθηκε'}</th></tr></thead>
        <tbody>{lines.map(([label, before, after]) => <tr key={label}><td>{label}</td><td>{before || '—'}</td><td><strong>{after || '—'}</strong></td></tr>)}</tbody>
      </table>
      {item.submitted.note && <Field label={en ? 'Supplier note' : 'Σημείωση προμηθευτή'}><p className="supplier-renewal-note">{item.submitted.note}</p></Field>}
      {item.attachment ? <div className="row-actions"><Button variant="secondary" onClick={openFile}><FileText size={15} />{item.attachment.name}</Button><small>{en ? 'Also in the supplier’s Documents.' : 'Υπάρχει και στα Έγγραφα του προμηθευτή.'}</small></div>
        : <p className="inline-empty">{isDemoDataEnvironment() ? (en ? 'Demo: the file is not kept.' : 'Demo: το αρχείο δεν φυλάσσεται.') : (en ? 'No file.' : 'Χωρίς αρχείο.')}</p>}
      {rejecting && <>
        <Field label={en ? 'Why is it rejected? *' : 'Γιατί απορρίπτεται; *'}><textarea rows={3} autoFocus value={comment} onChange={e => setComment(e.target.value)} placeholder={en ? 'e.g. the certificate does not cover the products we buy' : 'π.χ. το πιστοποιητικό δεν καλύπτει τα προϊόντα που προμηθευόμαστε'} /></Field>
        <SenderLocked allowed={canSend} language={language}><CheckboxField label={en ? 'Ask for it again on the same link, with this comment (reminder e-mail)' : 'Νέο αίτημα στον ίδιο σύνδεσμο, με το σχόλιο (email υπενθύμισης)'} checked={canSend && resend} disabled={!canSend} onChange={setResend} /></SenderLocked>
      </>}
    </div>
  </ObserverDialog>
}

// The per-certificate request on the supplier's record: whether one can be sent.
export function canRequestRenewal(row) { return Boolean(row) && (row.state === 'expired' || row.state === 'expiring') && !isOpenItem(row.item) }
