import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock3, Search, Send, Users } from 'lucide-react'
import { ActionButton } from '../../design-system/ActionButton'
import { DownloadMenu } from '../../design-system/DownloadMenu'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { roleLabel, SYSTEM_ROLE_KEYS } from '../../core/permissions/roleLabels'
import { downloadCsv } from '../../core/export/csvExport'
import { createAnnouncement, loadAnnouncementByLinkPath, loadAnnouncementAcknowledgers } from '../management/announcementCloudService'
import { employeeRows } from '../employees/employeeDemoData'
import {
  DOCUMENT_LINK_PREFIX, acknowledgementLogRows, acknowledgementSummary, demoAcknowledgementMembers, demoDistributions,
  loadAcknowledgementMembers, loadAcknowledgements, memberDepartment, memberPosition, professionsOf, usersWithProfessions,
} from './acknowledgementLog'
import './documentAcknowledgements.css'

const fmtDateTime = (value, en) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Distribution of a published document for read acknowledgement, and the log of
// who confirmed reading it and who is still pending.
export function DocumentDistributionPanel({ record, organizationId, isDemo, departments, canManage, canPublish, en }) {
  const n = useNotifications()
  const { notify } = useFeedback()
  const linkPath = `${DOCUMENT_LINK_PREFIX}${record.id}`
  const canSend = canManage || canPublish
  const [distribution, setDistribution] = useState(null)
  const [loadingDistribution, setLoadingDistribution] = useState(!isDemo)
  const [members, setMembers] = useState(() => (isDemo ? demoAcknowledgementMembers(employeeRows) : []))
  const [acks, setAcks] = useState([])
  const [membersComplete, setMembersComplete] = useState(true)
  const [loadingLog, setLoadingLog] = useState(false)
  const [sending, setSending] = useState(false)
  const [audienceMode, setAudienceMode] = useState(record.departmentId ? 'department' : 'all')
  const [selected, setSelected] = useState(record.departmentId ? [record.departmentId] : [])
  const [query, setQuery] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    setAudienceMode(record.departmentId ? 'department' : 'all')
    setSelected(record.departmentId ? [record.departmentId] : [])
    setQuery('')
  }, [record.id, record.departmentId])

  // The audience is needed both to send by professional category and to show who is pending.
  useEffect(() => {
    if (isDemo || !canSend || !organizationId) return undefined
    let active = true
    loadAcknowledgementMembers(organizationId)
      .then((rows) => { if (active) { setMembers(rows); setMembersComplete(true) } })
      .catch(() => { if (active) { setMembers([]); setMembersComplete(false) } })
    return () => { active = false }
  }, [isDemo, canSend, organizationId])

  const demoSeed = useMemo(() => (isDemo ? demoDistributions([record], members) : null), [isDemo, record, members])

  useEffect(() => {
    if (isDemo) {
      setDistribution(n.announcements.find((a) => a.linkPath === linkPath) || demoSeed?.announcements[0] || null)
      setLoadingDistribution(false)
      return undefined
    }
    if (!organizationId) return undefined
    let active = true
    setLoadingDistribution(true)
    loadAnnouncementByLinkPath(organizationId, linkPath)
      .then((row) => { if (active) setDistribution(row) })
      .catch(() => { if (active) setDistribution(null) })
      .finally(() => { if (active) setLoadingDistribution(false) })
    return () => { active = false }
  }, [isDemo, n.announcements, organizationId, linkPath, demoSeed])

  useEffect(() => {
    if (!distribution?.id || !canSend) { setAcks([]); return undefined }
    if (isDemo) { setAcks((demoSeed?.acks || []).filter((row) => row.announcementId === distribution.id)); return undefined }
    let active = true
    setLoadingLog(true)
    // Without the member list (database function not installed yet) fall back to
    // the acknowledgers with their profile names, as before.
    const load = membersComplete ? loadAcknowledgements(organizationId, [distribution.id]) : loadAnnouncementAcknowledgers(organizationId, distribution.id)
    load
      .then((rows) => { if (active) setAcks(rows) })
      .catch(() => { if (active) setAcks([]) })
      .finally(() => { if (active) setLoadingLog(false) })
    return () => { active = false }
  }, [isDemo, distribution?.id, organizationId, canSend, membersComplete, demoSeed])

  const summary = useMemo(() => (distribution ? acknowledgementSummary(membersComplete ? members : [], distribution, acks) : null), [distribution, members, acks, membersComplete])
  const roleOptions = SYSTEM_ROLE_KEYS.filter((key) => !['platform_owner', 'demo'].includes(key))
  const professionOptions = useMemo(() => professionsOf(members), [members])

  const options = audienceMode === 'department'
    ? departments.map((d) => ({ id: d.id, label: d.name }))
    : audienceMode === 'role'
      ? roleOptions.map((key) => ({ id: key, label: roleLabel(key, en ? 'en' : 'el') }))
      : audienceMode === 'profession'
        ? professionOptions.map((name) => ({ id: name, label: name }))
        : []
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
  const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  const changeMode = (mode) => { setAudienceMode(mode); setSelected([]); setQuery('') }
  const professionUsers = audienceMode === 'profession' ? usersWithProfessions(members, selected) : []
  const cannotSend = sending || (audienceMode !== 'all' && selected.length === 0) || (audienceMode === 'profession' && professionUsers.length === 0)

  async function send() {
    if (cannotSend) return
    setSending(true)
    const labels = options.filter((option) => selected.includes(option.id)).map((option) => option.label)
    const scopeLabel = audienceMode === 'all' ? '' : labels.join(', ')
    // A professional category is sent as a snapshot of the people in it today.
    const audienceType = audienceMode === 'profession' ? 'user' : audienceMode
    const audienceValues = audienceMode === 'all' ? [] : audienceMode === 'profession' ? professionUsers : selected
    const title = en ? `Published document: ${record.title}` : `Δημοσιευμένο έγγραφο: ${record.title}`
    const message = en
      ? `"${record.title}" (${record.id} · v${record.version || '—'}) has been published${scopeLabel ? ` for ${scopeLabel}` : ''} and requires read acknowledgement.`
      : `Το έγγραφο «${record.title}» (${record.id} · v${record.version || '—'}) δημοσιεύτηκε${scopeLabel ? ` για ${scopeLabel}` : ''} και απαιτεί επιβεβαίωση ανάγνωσης.`
    const payload = { title, message, priority: 'normal', audienceType, audienceValues, requiresAck: true, linkPath }
    try {
      if (isDemo) {
        n.addAnnouncement(payload)
      } else {
        const created = await createAnnouncement(organizationId, payload)
        setDistribution(created)
        await n.reloadAnnouncements()
      }
      notify(en ? 'Distribution notice sent.' : 'Η κοινοποίηση εστάλη.', 'success')
    } catch (error) {
      notify(error?.message || (en ? 'Could not send the distribution notice.' : 'Δεν ήταν δυνατή η αποστολή της κοινοποίησης.'), 'danger')
    } finally {
      setSending(false)
    }
  }

  function audienceLabel(item) {
    const values = item?.audienceValues || []
    if (item?.audienceType === 'department') return values.map((id) => departments.find((d) => d.id === id)?.name).filter(Boolean).join(', ') || (en ? 'Department(s)' : 'Τμήματα')
    if (item?.audienceType === 'role') return values.map((key) => roleLabel(key, en ? 'en' : 'el')).join(', ')
    if (item?.audienceType === 'user') return en ? `${values.length} selected people` : `${values.length} επιλεγμένα άτομα`
    return en ? 'Whole hospital' : 'Όλο το νοσοκομείο'
  }

  function exportCsv() {
    const entry = { documentCode: record.id, documentTitle: record.title, version: record.version, sentAt: distribution.createdAt, summary }
    const rows = acknowledgementLogRows([entry], { departments, en })
    downloadCsv(`${record.id}_${en ? 'read-acknowledgements' : 'epivevaioseis-anagnosis'}.csv`,
      en ? ['Document', 'Title', 'Version', 'Sent', 'Person', 'Position', 'Department', 'Status', 'Read on'] : ['Έγγραφο', 'Τίτλος', 'Έκδοση', 'Απεστάλη', 'Άτομο', 'Θέση', 'Τμήμα', 'Κατάσταση', 'Διαβάστηκε'],
      rows.map((row) => [row.documentCode, row.documentTitle, row.version, fmtDateTime(row.sentAt, en), row.name, row.position, row.department, row.status === 'acknowledged' ? (en ? 'Read' : 'Διαβάστηκε') : (en ? 'Pending' : 'Εκκρεμεί'), row.acknowledgedAt ? fmtDateTime(row.acknowledgedAt, en) : '']))
  }

  async function exportPdf() {
    if (exportingPdf || !panelRef.current) return
    setExportingPdf(true)
    try { await exportElementAsPdf({ element: panelRef.current, filename: `${record.id}_${en ? 'read-acknowledgements' : 'epivevaioseis-anagnosis'}`, orientation: 'portrait' }) }
    catch (error) { notify(error?.message || (en ? 'Could not export the PDF.' : 'Δεν ήταν δυνατή η εξαγωγή του PDF.'), 'danger') }
    finally { setExportingPdf(false) }
  }

  const personName = (member) => (en ? member.nameEn : '') || member.name || '—'

  return <section className="record-section document-ack-panel" ref={panelRef}>
    <div className="record-section-header"><div>
      <span className="eyebrow">{en ? 'Governance' : 'Διακυβέρνηση'}</span>
      <h3>{en ? 'Distribution & read acknowledgement' : 'Κοινοποίηση & επιβεβαίωση ανάγνωσης'}</h3>
      <p>{en ? 'Notify the relevant staff that this version is published and keep proof of who has read it.' : 'Ενημερώστε το αρμόδιο προσωπικό ότι δημοσιεύτηκε αυτή η έκδοση και κρατήστε απόδειξη για το ποιος την έχει διαβάσει.'}</p>
    </div>{distribution && canSend && summary && <div className="record-actions"><DownloadMenu onExcel={exportCsv} onPdf={exportPdf} pdfBusy={exportingPdf} /></div>}</div>
    {record.status !== 'published' && <div className="inline-empty">{en ? 'Distribution is available once the document is published.' : 'Η κοινοποίηση είναι διαθέσιμη μόλις δημοσιευτεί το έγγραφο.'}</div>}
    {record.status === 'published' && (loadingDistribution
      ? <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div>
      : distribution
        ? <div className="document-ack-log">
            <div className="document-ack-meta">
              <span><strong>{en ? 'Sent' : 'Απεστάλη'}</strong>{fmtDateTime(distribution.createdAt, en)}</span>
              <span><strong>{en ? 'Audience' : 'Κοινό'}</strong>{audienceLabel(distribution)}</span>
            </div>
            {!canSend && <div className="document-ack-meta"><span><strong>{en ? 'Your acknowledgement' : 'Η δική σας επιβεβαίωση'}</strong>{n.visibleAnnouncements.find((a) => a.id === distribution.id)?.acknowledged ? (en ? 'Confirmed' : 'Επιβεβαιώθηκε') : (en ? 'Pending' : 'Εκκρεμεί')}</span></div>}
            {canSend && (loadingLog ? <div className="inline-empty">{en ? 'Loading…' : 'Φόρτωση…'}</div> : <>
              <div className="document-ack-progress" aria-label={en ? 'Read acknowledgement progress' : 'Πρόοδος επιβεβαιώσεων'}>
                <div className="document-ack-progress-figures">
                  <strong>{summary.acknowledged.length}<small> / {membersComplete ? summary.total : '—'}</small></strong>
                  <span>{en ? 'have confirmed reading' : 'επιβεβαίωσαν ότι διάβασαν'}</span>
                  {membersComplete && <em className={summary.rate >= 90 ? 'good' : summary.rate >= 60 ? 'fair' : 'low'}>{summary.rate}%</em>}
                </div>
                {membersComplete && <div className="document-ack-bar"><span style={{ width: `${summary.rate}%` }} /></div>}
                {!membersComplete && <p className="document-ack-note">{en ? 'The pending list needs the latest database update; until then only confirmations are shown.' : 'Η λίστα εκκρεμοτήτων χρειάζεται την τελευταία ενημέρωση της βάσης· μέχρι τότε φαίνονται μόνο οι επιβεβαιώσεις.'}</p>}
              </div>
              <div className="document-ack-columns">
                {membersComplete && <div className="document-ack-list pending">
                  <h4><Clock3 size={14} />{en ? 'Pending' : 'Εκκρεμούν'}<span>{summary.pending.length}</span></h4>
                  {summary.pending.length === 0
                    ? <div className="inline-empty">{en ? 'Everyone has confirmed.' : 'Όλοι έχουν επιβεβαιώσει.'}</div>
                    : <table className="record-table"><thead><tr><th>{en ? 'Person' : 'Άτομο'}</th><th>{en ? 'Position' : 'Θέση'}</th><th>{en ? 'Department' : 'Τμήμα'}</th></tr></thead>
                      <tbody>{summary.pending.map((member) => <tr key={member.userId}><td>{personName(member)}</td><td>{memberPosition(member, en)}</td><td>{memberDepartment(member, departments, en) || '—'}</td></tr>)}</tbody></table>}
                </div>}
                <div className="document-ack-list done">
                  <h4><Check size={14} />{en ? 'Confirmed' : 'Επιβεβαίωσαν'}<span>{summary.acknowledged.length}</span></h4>
                  {summary.acknowledged.length === 0
                    ? <div className="inline-empty">{en ? 'No acknowledgements yet.' : 'Δεν υπάρχουν ακόμη επιβεβαιώσεις.'}</div>
                    : <table className="record-table"><thead><tr><th>{en ? 'Person' : 'Άτομο'}</th><th>{en ? 'Position' : 'Θέση'}</th><th>{en ? 'Read on' : 'Διαβάστηκε'}</th></tr></thead>
                      <tbody>{summary.acknowledged.map((member) => <tr key={member.userId}><td>{personName(member)}</td><td>{member.role || member.profession ? memberPosition(member, en) : '—'}</td><td className="nowrap-cell">{fmtDateTime(member.acknowledgedAt, en)}</td></tr>)}</tbody></table>}
                </div>
              </div>
            </>)}
          </div>
        : canSend
          ? <div className="document-distribution-composer">
              <label className="field"><span>{en ? 'Send to' : 'Αποστολή σε'}</span><select value={audienceMode} onChange={(e) => changeMode(e.target.value)}>
                <option value="all">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>
                <option value="department">{en ? 'Specific department(s)' : 'Συγκεκριμένα τμήματα'}</option>
                <option value="profession" disabled={!professionOptions.length}>{en ? 'Professional category (e.g. nurses)' : 'Επαγγελματική κατηγορία (π.χ. νοσηλευτές)'}</option>
                <option value="role">{en ? 'User role' : 'Ρόλος χρήστη'}</option>
              </select></label>
              {audienceMode !== 'all' && <div className="recipient-picker">
                <label className="filter-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={en ? 'Search…' : 'Αναζήτηση…'} /></label>
                <div className="recipient-options">{filteredOptions.map((option) => <button type="button" key={option.id} className={selected.includes(option.id) ? 'selected' : ''} onClick={() => toggle(option.id)}><span className="recipient-check">{selected.includes(option.id) && <Check size={13} />}</span><span><strong>{option.label}</strong></span></button>)}</div>
                <div className="recipient-summary"><Users size={13} />{audienceMode === 'profession' ? (en ? `${professionUsers.length} people` : `${professionUsers.length} άτομα`) : `${selected.length} ${en ? 'selected' : 'επιλεγμένα'}`}</div>
              </div>}
              <div className="record-actions"><ActionButton tone="primary" label={en ? 'Send distribution notice' : 'Αποστολή κοινοποίησης'} onClick={send} disabled={cannotSend}><Send size={15} />{en ? 'Send distribution notice' : 'Αποστολή κοινοποίησης'}</ActionButton></div>
            </div>
          : <div className="inline-empty">{en ? 'This document has not been distributed yet.' : 'Το έγγραφο δεν έχει κοινοποιηθεί ακόμη.'}</div>)}
  </section>
}
