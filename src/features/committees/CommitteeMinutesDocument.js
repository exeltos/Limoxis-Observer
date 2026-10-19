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

// The minutes as a document on the shared layout (printReport / downloadReportWord):
// the committee, the meeting, who attended, each topic with its decision, the
// notes, the approvals and a signature line for the chair and the secretary.
export function committeeMinutesReport({ committeeName = '', minutes, en }) {
  const L = (el, enText) => (en ? enText : el)
  const pick = (map, key) => (map[key] || [key, key])[en ? 1 : 0]
  const attendance = (minutes.attendanceRecords || []).filter(x => x.name)
  const topics = (minutes.topics || []).filter(t => t.subject || t.decision)
  const approvals = (minutes.approvals || []).filter(x => x.status !== 'cancelled')
  const time =
    minutes.time ||
    (minutes.scheduledAt
      ? new Date(minutes.scheduledAt).toLocaleTimeString(en ? 'en-GB' : 'el-GR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '')
  return {
    language: en ? 'en' : 'el',
    kind: L('Πρακτικά συνεδρίασης', 'Meeting minutes'),
    code: minutes.minutesNo ? `${L('Πρακτικό', 'Minutes')} ${minutes.minutesNo}` : '',
    title: committeeName || minutes.title,
    subtitle: committeeName ? minutes.title : '',
    meta: [
      [L('Αρ. πρακτικού', 'Minutes no.'), minutes.minutesNo || '—'],
      [L('Ημερομηνία', 'Date'), [fmtDate(minutes.date), time].filter(Boolean).join(' · ')],
      [L('Χώρος', 'Location'), minutes.location || '—'],
      [L('Κατάσταση', 'Status'), statusLabel(minutes.status, en)],
    ],
    sections: [
      {
        title: L('Παρουσίες', 'Attendance'),
        table: {
          columns: [L('Α/Α', 'No.'), L('Μέλος', 'Member'), L('Κατάσταση', 'Status')],
          rows: attendance.map((x, i) => [
            String(i + 1),
            x.name,
            pick(ATTENDANCE, x.status || 'not_recorded'),
          ]),
        },
      },
      {
        title: L('Θέματα & συμπεράσματα', 'Agenda & conclusions'),
        table: {
          // Each topic, with its decision / conclusion below it (not side by side).
          columns: [L('Α/Α', 'No.'), L('Θέμα · απόφαση / συμπέρασμα', 'Topic · decision / conclusion')],
          rows: topics.map((t, i) => [
            String(i + 1),
            {
              html: `<strong>${escape(t.subject || '—')}</strong><span class="rd-topic-decision">${escape(t.decision || '—').replace(/\n/g, '<br>')}</span>`,
            },
          ]),
        },
      },
      minutes.generalNotes && {
        title: L('Γενικές σημειώσεις', 'General notes'),
        text: minutes.generalNotes,
      },
      approvals.length > 0 && {
        title: L('Εγκρίσεις', 'Approvals'),
        table: {
          columns: [L('Εγκριτής', 'Approver'), L('Κατάσταση', 'Status'), L('Ημερομηνία', 'Date')],
          rows: approvals.map((x, i) => [
            x.approverName || `${L('Εγκριτής', 'Approver')} ${i + 1}`,
            pick(APPROVAL, x.status),
            x.decidedAt ? fmtDate(x.decidedAt) : '—',
          ]),
        },
      },
    ].filter(Boolean),
    signatures: [L('Ο/Η Πρόεδρος', 'Chair'), L('Ο/Η Γραμματέας', 'Secretary')],
    filename: [
      L('Πρακτικά', 'Minutes'),
      committeeName,
      minutes.minutesNo,
      String(minutes.date || '').slice(0, 10),
    ]
      .filter(Boolean)
      .join('_'),
  }
}

const escape = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
