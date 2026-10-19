import { fmtDate, statusLabel } from './committeeRecordFormat'

const ATTENDANCE = {
  present: ['Παρών/ούσα', 'Present'],
  absent: ['Απών/ούσα', 'Absent'],
  excused: ['Δικαιολογημένη απουσία', 'Excused'],
  not_recorded: ['—', '—'],
}
const APPROVAL = {
  approved: ['Εγκρίθηκε', 'Approved'],
  rejected: ['Ζητήθηκαν διορθώσεις', 'Changes requested'],
  pending: ['Σε αναμονή', 'Pending'],
}

// The minutes as a document, for "Export PDF": the committee, the meeting, who
// attended, each topic with its decision, the notes and the approvals. Rendered
// off screen and captured by exportElementAsPdf (which adds the hospital header).
export function CommitteeMinutesDocument({ committeeName = '', minutes, en, documentRef }) {
  const L = (el, enText) => (en ? enText : el)
  const pick = (map, key) => (map[key] || [key, key])[en ? 1 : 0]
  const attendance = (minutes.attendanceRecords || []).filter(x => x.name)
  const topics = (minutes.topics || []).filter(t => t.subject || t.decision)
  const approvals = (minutes.approvals || []).filter(x => x.status !== 'cancelled')
  const time = minutes.time || (minutes.scheduledAt ? new Date(minutes.scheduledAt).toLocaleTimeString(en ? 'en-GB' : 'el-GR', { hour: '2-digit', minute: '2-digit' }) : '')
  return (
    <div className="committee-minutes-document" ref={documentRef} aria-hidden="true">
      <p className="committee-minutes-eyebrow">{L('Πρακτικά συνεδρίασης', 'Meeting minutes')}</p>
      <h1>{committeeName || minutes.title}</h1>
      {committeeName && <h2>{minutes.title}</h2>}
      <dl className="committee-minutes-meta">
        <div><dt>{L('Αρ. πρακτικού', 'Minutes no.')}</dt><dd>{minutes.minutesNo || '—'}</dd></div>
        <div><dt>{L('Ημερομηνία', 'Date')}</dt><dd>{[fmtDate(minutes.date), time].filter(Boolean).join(' · ')}</dd></div>
        <div><dt>{L('Χώρος', 'Location')}</dt><dd>{minutes.location || '—'}</dd></div>
        <div><dt>{L('Κατάσταση', 'Status')}</dt><dd>{statusLabel(minutes.status, en)}</dd></div>
      </dl>
      <h3>{L('Παρουσίες', 'Attendance')}</h3>
      {attendance.length ? (
        <table>
          <thead><tr><th>{L('Μέλος', 'Member')}</th><th>{L('Κατάσταση', 'Status')}</th></tr></thead>
          <tbody>{attendance.map(x => <tr key={x.id || x.memberId}><td>{x.name}</td><td>{pick(ATTENDANCE, x.status || 'not_recorded')}</td></tr>)}</tbody>
        </table>
      ) : <p>—</p>}
      <h3>{L('Θέματα & συμπεράσματα', 'Agenda & conclusions')}</h3>
      {topics.length ? (
        <ol className="committee-minutes-topics">
          {topics.map(t => <li key={t.id}><strong>{t.subject || '—'}</strong><p>{t.decision || '—'}</p></li>)}
        </ol>
      ) : <p>—</p>}
      {minutes.generalNotes && <><h3>{L('Γενικές σημειώσεις', 'General notes')}</h3><p className="committee-minutes-notes">{minutes.generalNotes}</p></>}
      {approvals.length > 0 && <>
        <h3>{L('Εγκρίσεις', 'Approvals')}</h3>
        <table>
          <thead><tr><th>{L('Εγκριτής', 'Approver')}</th><th>{L('Κατάσταση', 'Status')}</th><th>{L('Ημερομηνία', 'Date')}</th></tr></thead>
          <tbody>{approvals.map((x, i) => <tr key={x.id || i}><td>{x.approverName || `${L('Εγκριτής', 'Approver')} ${i + 1}`}</td><td>{pick(APPROVAL, x.status)}</td><td>{x.decidedAt ? fmtDate(x.decidedAt) : '—'}</td></tr>)}</tbody>
        </table>
      </>}
    </div>
  )
}
