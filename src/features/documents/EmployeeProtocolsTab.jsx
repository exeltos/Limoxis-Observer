import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../core/notifications/NotificationContext'
import { employeeRows } from '../employees/employeeDemoData'
import { loadDocuments } from './documentStore'
import { DOCUMENT_LINK_PREFIX, demoAcknowledgementMembers, demoDistributions, loadOrganizationAcknowledgementLog, summarizeDistributions } from './acknowledgementLog'
import './documentAcknowledgements.css'

const fmtDateTime = (value, en) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(en ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Employee record: the protocols sent to this person for read acknowledgement,
// which they have confirmed (and when) and which are still pending.
export function EmployeeProtocolsTab({ employee, language, organizationId, isDemo, selfMode }) {
  const en = language === 'en'
  const navigate = useNavigate()
  const n = useNotifications()
  const [log, setLog] = useState(null)
  const userId = isDemo ? employee.id : employee.userId

  useEffect(() => {
    if (selfMode) return undefined
    if (isDemo) {
      const members = demoAcknowledgementMembers(employeeRows)
      const seed = demoDistributions(loadDocuments(), members)
      setLog({ ...seed, members, complete: true, documents: loadDocuments() })
      return undefined
    }
    if (!organizationId || !userId) return undefined
    let active = true
    loadOrganizationAcknowledgementLog(organizationId)
      .then((value) => { if (active) setLog(value) })
      .catch(() => { if (active) setLog({ announcements: [], acks: [], members: [], complete: false }) })
    return () => { active = false }
  }, [selfMode, isDemo, organizationId, userId])

  const rows = useMemo(() => {
    if (selfMode) {
      return n.visibleAnnouncements.filter((a) => a.requiresAck && String(a.linkPath || '').startsWith(DOCUMENT_LINK_PREFIX))
        .map((a) => ({ id: a.id, documentId: String(a.linkPath).slice(DOCUMENT_LINK_PREFIX.length), title: a.title, sentAt: a.createdAt, acknowledgedAt: a.acknowledged ? (a.acknowledgedAt || true) : null }))
    }
    if (!log || !userId) return []
    return summarizeDistributions(log.announcements, log.complete ? log.members : [], log.acks, log.documents || []).flatMap((entry) => {
      const read = entry.summary.acknowledged.find((member) => String(member.userId) === String(userId))
      const pending = entry.summary.pending.find((member) => String(member.userId) === String(userId))
      if (!read && !pending) return []
      return [{ id: entry.announcement.id, documentId: entry.documentId, code: entry.documentCode, title: entry.documentTitle, version: entry.version, sentAt: entry.sentAt, acknowledgedAt: read?.acknowledgedAt || null }]
    })
  }, [selfMode, n.visibleAnnouncements, log, userId])

  const read = rows.filter((row) => row.acknowledgedAt).length
  if (!selfMode && !isDemo && !userId) return <section className="record-section"><div className="inline-empty">{en ? 'This employee has no user account, so there are no read acknowledgements to show.' : 'Ο εργαζόμενος δεν έχει λογαριασμό χρήστη, οπότε δεν υπάρχουν επιβεβαιώσεις ανάγνωσης.'}</div></section>

  return <section className="record-section document-ack-panel">
    <div className="record-section-header"><div>
      <span className="eyebrow">{en ? 'Controlled documents' : 'Ελεγχόμενα έγγραφα'}</span>
      <h3>{en ? 'Protocols read' : 'Πρωτόκολλα που διάβασε'}</h3>
      <p>{en ? 'Protocols sent to this person for read acknowledgement.' : 'Πρωτόκολλα που στάλθηκαν σε αυτό το άτομο για επιβεβαίωση ανάγνωσης.'}</p>
    </div></div>
    {rows.length > 0 && <div className="document-ack-progress"><div className="document-ack-progress-figures"><strong>{read}<small> / {rows.length}</small></strong><span>{en ? 'protocols confirmed as read' : 'πρωτόκολλα επιβεβαιωμένα ως διαβασμένα'}</span></div><div className="document-ack-bar"><span style={{ width: `${Math.round((read / rows.length) * 100)}%` }} /></div></div>}
    {rows.length
      ? <table className="record-table"><thead><tr><th>{en ? 'Document' : 'Έγγραφο'}</th><th>{en ? 'Sent' : 'Απεστάλη'}</th><th>{en ? 'Status' : 'Κατάσταση'}</th><th>{en ? 'Read on' : 'Διαβάστηκε'}</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="clickable-row" onClick={() => navigate(`/documents/${row.documentId}`)}>
          <td><strong>{row.code ? `${row.code} · ` : ''}{row.title}</strong>{row.version && <small> v{row.version}</small>}</td>
          <td className="nowrap-cell">{fmtDateTime(row.sentAt, en)}</td>
          <td><span className={`document-ack-status ${row.acknowledgedAt ? 'acknowledged' : 'pending'}`}>{row.acknowledgedAt ? (en ? 'Read' : 'Διαβάστηκε') : (en ? 'Pending' : 'Εκκρεμεί')}</span></td>
          <td className="nowrap-cell">{row.acknowledgedAt && row.acknowledgedAt !== true ? fmtDateTime(row.acknowledgedAt, en) : '—'}</td>
        </tr>)}</tbody></table>
      : <div className="inline-empty">{en ? 'No protocols have been sent to this person yet.' : 'Δεν έχουν σταλεί ακόμη πρωτόκολλα σε αυτό το άτομο.'}</div>}
  </section>
}
