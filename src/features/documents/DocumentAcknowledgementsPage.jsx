import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpenCheck, Clock3, Send, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { IconButton } from '../../design-system/IconButton'
import { MetricCard } from '../../design-system/MetricCard'
import { ModuleTabs } from '../../design-system/ModuleTabs'
import { RouteLoading } from '../../design-system/RouteLoading'
import { useTenant } from '../../core/tenant/TenantContext'
import { can, CAPABILITIES } from '../../core/permissions/roles'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { downloadCsv } from '../../core/export/csvExport'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { loadDepartments } from '../management/departmentsService'
import { employeeRows } from '../employees/employeeDemoData'
import { useDocumentsData } from './useDocumentsData'
import {
  DOCUMENT_LINK_PREFIX, acknowledgementLogRows, demoAcknowledgementMembers, demoDistributions,
  loadOrganizationAcknowledgementLog, memberDepartment, memberPosition, summarizeDistributions,
} from './acknowledgementLog'
import './documentAcknowledgements.css'

const fmtDay = (value, en) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(en ? 'en-GB' : 'el-GR')
}
const fmtDateTime = (value, en) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const tone = (rate) => (rate >= 90 ? 'good' : rate >= 60 ? 'fair' : 'low')

// Organization-wide read-acknowledgement log: proof for an inspection of which
// staff have read which controlled document, and who is still pending.
export function DocumentAcknowledgementsPage() {
  const navigate = useNavigate()
  const { role, actualRole, isRolePreview, membership, tenant, isDemo } = useTenant()
  const { language } = useLanguage()
  const { notify } = useFeedback()
  const n = useNotifications()
  const en = language === 'en'
  const addOns = membership?.capabilities ?? [], custom = membership?.customCapabilities ?? []
  const permissionRole = isRolePreview ? role : (actualRole || role)
  const canSeeAll = can(permissionRole, CAPABILITIES.MANAGE_DOCUMENTS, addOns, custom) || can(permissionRole, CAPABILITIES.PUBLISH_DOCUMENT, addOns, custom)
  const organizationId = tenant?.id || null
  const { data: documents, loading: loadingDocuments } = useDocumentsData()
  const [view, setView] = useState('documents')
  const [log, setLog] = useState(null)
  const [departments, setDepartments] = useState([])
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    if (isDemo || !organizationId) return undefined
    let active = true
    loadDepartments(organizationId).then((rows) => { if (active) setDepartments(rows) }).catch(() => {})
    return () => { active = false }
  }, [isDemo, organizationId])

  useEffect(() => {
    if (!canSeeAll) return undefined
    if (isDemo) {
      const members = demoAcknowledgementMembers(employeeRows)
      const seed = demoDistributions(documents || [], members)
      const sentInDemo = n.announcements.filter((a) => a.requiresAck && String(a.linkPath || '').startsWith(DOCUMENT_LINK_PREFIX) && !seed.announcements.some((s) => s.linkPath === a.linkPath))
      setLog({ announcements: [...sentInDemo, ...seed.announcements], acks: seed.acks, members, complete: true })
      return undefined
    }
    if (!organizationId) return undefined
    let active = true
    loadOrganizationAcknowledgementLog(organizationId)
      .then((value) => { if (active) setLog(value) })
      .catch((error) => { if (active) { setLog({ announcements: [], acks: [], members: [], complete: false }); notify(error?.message || (en ? 'Could not load the acknowledgement log.' : 'Δεν ήταν δυνατή η φόρτωση των επιβεβαιώσεων.'), 'danger') } })
    return () => { active = false }
  }, [canSeeAll, isDemo, organizationId, documents, n.announcements, en, notify])

  const entries = useMemo(() => (log ? summarizeDistributions(log.announcements, log.complete ? log.members : [], log.acks, documents || []) : []), [log, documents])
  const people = useMemo(() => {
    const byUser = new Map()
    for (const entry of entries) {
      for (const member of entry.summary.acknowledged) {
        const row = byUser.get(member.userId) || { member, read: [], pending: [] }
        row.read.push(entry); byUser.set(member.userId, row)
      }
      for (const member of entry.summary.pending) {
        const row = byUser.get(member.userId) || { member, read: [], pending: [] }
        row.pending.push(entry); byUser.set(member.userId, row)
      }
    }
    return [...byUser.values()].sort((a, b) => b.pending.length - a.pending.length || String(a.member.name).localeCompare(String(b.member.name), 'el'))
  }, [entries])

  const totals = useMemo(() => {
    const read = entries.reduce((sum, entry) => sum + entry.summary.acknowledged.length, 0)
    const all = entries.reduce((sum, entry) => sum + entry.summary.total, 0)
    return { distributions: entries.length, rate: all ? Math.round((read / all) * 100) : 0, pending: all - read, complete: entries.filter((entry) => entry.summary.total && !entry.summary.pending.length).length }
  }, [entries])

  const personName = (member) => (en ? member.nameEn : '') || member.name || '—'

  function exportCsv() {
    const rows = acknowledgementLogRows(entries, { departments, en })
    downloadCsv(en ? 'read-acknowledgement-log.csv' : 'mitroo-epivevaioseon-anagnosis.csv',
      en ? ['Document', 'Title', 'Version', 'Sent', 'Person', 'Position', 'Department', 'Status', 'Read on'] : ['Έγγραφο', 'Τίτλος', 'Έκδοση', 'Απεστάλη', 'Άτομο', 'Θέση', 'Τμήμα', 'Κατάσταση', 'Διαβάστηκε'],
      rows.map((row) => [row.documentCode, row.documentTitle, row.version, fmtDay(row.sentAt, en), row.name, row.position, row.department, row.status === 'acknowledged' ? (en ? 'Read' : 'Διαβάστηκε') : (en ? 'Pending' : 'Εκκρεμεί'), fmtDateTime(row.acknowledgedAt, en)]))
  }
  async function exportPdf() {
    if (exporting || !reportRef.current) return
    setExporting(true)
    try { await exportElementAsPdf({ element: reportRef.current, filename: en ? 'read-acknowledgement-log' : 'mitroo-epivevaioseon-anagnosis', orientation: 'landscape' }) }
    catch (error) { notify(error?.message || (en ? 'Could not export the PDF.' : 'Δεν ήταν δυνατή η εξαγωγή του PDF.'), 'danger') }
    finally { setExporting(false) }
  }

  if (loadingDocuments) return <RouteLoading />
  const title = en ? 'Read acknowledgements' : 'Επιβεβαιώσεις ανάγνωσης'
  const back = <IconButton label={en ? 'Back to documents' : 'Πίσω στα έγγραφα'} onClick={() => navigate('/documents')}><ArrowLeft size={16} /></IconButton>

  if (!canSeeAll) {
    const mine = n.visibleAnnouncements.filter((a) => a.requiresAck && String(a.linkPath || '').startsWith(DOCUMENT_LINK_PREFIX))
    return <Page title={en ? 'My protocols to read' : 'Πρωτόκολλα προς ανάγνωση'} subtitle={en ? 'Documents sent to you for read acknowledgement.' : 'Έγγραφα που σας στάλθηκαν για επιβεβαίωση ανάγνωσης.'} actions={back}>
      <section className="surface record-section"><table className="record-table"><thead><tr><th>{en ? 'Document' : 'Έγγραφο'}</th><th>{en ? 'Sent' : 'Απεστάλη'}</th><th>{en ? 'Status' : 'Κατάσταση'}</th></tr></thead>
        <tbody>{mine.map((a) => <tr key={a.id} className="clickable-row" onClick={() => navigate(a.linkPath)}><td>{a.title}</td><td>{fmtDay(a.createdAt, en)}</td><td><span className={`document-ack-status ${a.acknowledged ? 'acknowledged' : 'pending'}`}>{a.acknowledged ? (en ? 'Read' : 'Διαβάστηκε') : (en ? 'Pending' : 'Εκκρεμεί')}</span></td></tr>)}</tbody></table>
        {!mine.length && <div className="inline-empty">{en ? 'Nothing has been sent to you.' : 'Δεν σας έχει σταλεί κάποιο έγγραφο.'}</div>}</section>
    </Page>
  }

  return <Page fill title={title} subtitle={en ? 'Who has read each published protocol and who is still pending: proof for inspections.' : 'Ποιος έχει διαβάσει κάθε δημοσιευμένο πρωτόκολλο και ποιος εκκρεμεί: απόδειξη για επιθεωρήσεις.'}
    actions={<div className="row-actions">{back}<DownloadMenu onExcel={exportCsv} onPdf={exportPdf} disabled={!entries.length} pdfBusy={exporting} /></div>}>
    <div className="module-summary-strip">
      <MetricCard icon={Send} value={totals.distributions} label={en ? 'Distributed documents' : 'Κοινοποιημένα έγγραφα'} />
      <MetricCard icon={BookOpenCheck} value={`${totals.rate}%`} label={en ? 'Overall read rate' : 'Συνολικό ποσοστό ανάγνωσης'} tone={totals.rate >= 90 ? 'active' : totals.rate >= 60 ? 'warning' : 'danger'} />
      <MetricCard icon={Clock3} value={totals.pending} label={en ? 'Pending acknowledgements' : 'Εκκρεμείς επιβεβαιώσεις'} tone={totals.pending ? 'warning' : 'neutral'} onClick={() => setView('people')} active={view === 'people'} />
      <MetricCard icon={Users} value={totals.complete} label={en ? 'Read by everyone' : 'Διαβάστηκαν από όλους'} />
    </div>
    <section className="surface registry-workspace workspace-column workspace-fill" ref={reportRef}>
      <ModuleTabs activeId={view} onChange={setView} ariaLabel={title} tabs={[{ id: 'documents', label: en ? 'By document' : 'Ανά έγγραφο', icon: BookOpenCheck }, { id: 'people', label: en ? 'By person' : 'Ανά άτομο', icon: Users }]} />
      {log && !log.complete && <div className="document-ack-note" style={{ padding: '10px 14px' }}>{en ? 'Pending lists need the latest database update; until then only confirmations are counted.' : 'Οι εκκρεμότητες χρειάζονται την τελευταία ενημέρωση της βάσης· μέχρι τότε μετρώνται μόνο οι επιβεβαιώσεις.'}</div>}
      <div className="scroll-table">
        {view === 'documents' && <table className="data-table sticky-table record-table-clickable"><thead><tr><th>{en ? 'Code' : 'Κωδικός'}</th><th>{en ? 'Document' : 'Έγγραφο'}</th><th>{en ? 'Version' : 'Έκδοση'}</th><th>{en ? 'Sent' : 'Απεστάλη'}</th><th>{en ? 'Read' : 'Διάβασαν'}</th><th>{en ? 'Pending' : 'Εκκρεμούν'}</th><th>{en ? 'Rate' : 'Ποσοστό'}</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.announcement.id} onClick={() => navigate(`/documents/${entry.documentId}?tab=distribution`)}>
            <td className="nowrap-cell"><strong>{entry.documentCode}</strong></td><td>{entry.documentTitle}</td><td>{entry.version ? `v${entry.version}` : '—'}</td><td className="nowrap-cell">{fmtDay(entry.sentAt, en)}</td>
            <td>{entry.summary.acknowledged.length} / {entry.summary.total}</td><td>{entry.summary.pending.length}</td>
            <td><span className={`document-ack-rate ${tone(entry.summary.rate)}`}>{entry.summary.rate}%</span><span className="document-ack-mini-bar"><span style={{ width: `${entry.summary.rate}%` }} /></span></td>
          </tr>)}</tbody></table>}
        {view === 'people' && <table className="data-table sticky-table"><thead><tr><th>{en ? 'Person' : 'Άτομο'}</th><th>{en ? 'Position' : 'Θέση'}</th><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Read' : 'Διάβασε'}</th><th>{en ? 'Still to read' : 'Εκκρεμούν'}</th></tr></thead>
          <tbody>{people.map(({ member, read, pending }) => <tr key={member.userId}>
            <td><strong>{personName(member)}</strong></td><td>{memberPosition(member, en)}</td><td>{memberDepartment(member, departments, en) || '—'}</td>
            <td>{read.length} / {read.length + pending.length}</td>
            <td>{pending.length ? pending.map((entry) => <span key={entry.announcement.id} className="document-ack-status pending" style={{ marginRight: 4 }}>{entry.documentCode}</span>) : <span className="document-ack-status acknowledged">{en ? 'Up to date' : 'Ενημερωμένος'}</span>}</td>
          </tr>)}</tbody></table>}
        {!entries.length && <div className="registry-empty-state"><strong>{en ? 'No documents distributed yet' : 'Δεν έχουν κοινοποιηθεί ακόμη έγγραφα'}</strong><span>{en ? 'Publish a document and send it from its Distribution tab.' : 'Δημοσιεύστε ένα έγγραφο και στείλτε το από την καρτέλα «Κοινοποίηση».'}</span></div>}
      </div>
    </section>
  </Page>
}
