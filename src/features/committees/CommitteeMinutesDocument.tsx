import { compositionLabel, controlTeamName, fmtDate, statusLabel } from './committeeRecordFormat'
import type { ReportDoc } from '../../core/export/reportDocument'
import type { AnyRecord } from '../../types/featureTypes'

const ATTENDANCE: Record<string, string[]> = {
  present: ['Παρών/ούσα', 'Present'],
  absent: ['Απών/ούσα', 'Absent'],
  excused: ['Δικαιολογημένη απουσία', 'Excused'],
  not_recorded: ['—', '—'],
}
const APPROVAL: Record<string, string[]> = {
  approved: ['Εγκρίθηκε', 'Approved'],
  rejected: ['Ζητήθηκαν διορθώσεις', 'Changes requested'],
  pending: ['Σε αναμονή', 'Pending'],
}

// The minutes as a document on the shared layout (printReport / downloadReportWord):
// the committee, the meeting, who attended, each topic with its decision, the
// notes, the approvals and a signature line for the chair and the secretary.
export function committeeMinutesReport({ committeeName = '', minutes, en }: { committeeName?: string, minutes: AnyRecord, en: boolean }): ReportDoc {
  const L = (el: string, enText: string) => (en ? enText : el)
  const pick = (map: Record<string, string[]>, key: string) => (map[key] || [key, key])[en ? 1 : 0]
  const attendance: AnyRecord[] = (minutes.attendanceRecords || []).filter((x: AnyRecord) => x.name)
  const topics: AnyRecord[] = (minutes.topics || []).filter((t: AnyRecord) => t.subject || t.decision)
  const approvals: AnyRecord[] = (minutes.approvals || []).filter((x: AnyRecord) => x.status !== 'cancelled')
  const team = minutes.composition === 'control_team'
  const time =
    minutes.time ||
    (minutes.scheduledAt
      ? new Date(minutes.scheduledAt).toLocaleTimeString(en ? 'en-GB' : 'el-GR', {
          hour: '2-digit',
          minute: '2-digit', hourCycle: 'h23',
        })
      : '')
  return {
    language: en ? 'en' : 'el',
    // The paper says first and plainly what it is: the minutes of a meeting, its number, the committee and who met.
    kind: committeeName || minutes.title,
    code: '',
    title: `${L('ΠΡΑΚΤΙΚΟ ΣΥΝΕΔΡΙΑΣΗΣ', 'MEETING MINUTES')}${minutes.minutesNo ? ` ${L('αρ.', 'no.')} ${minutes.minutesNo}` : ''}`,
    subtitle: team
      ? L(`Συνεδρίαση της ${controlTeamName(committeeName, false).replace(/^Ομάδα/, 'Ομάδας')}`, `Meeting of the ${controlTeamName(committeeName, true)}`)
      : L('Συνεδρίαση της ολομέλειας της επιτροπής', 'Meeting of the whole committee'),
    meta: [
      [L('Επιτροπή', 'Committee'), committeeName || '—'],
      [L('Συνεδρίαση', 'Meeting'), minutes.title || '—'],
      [L('Ημερομηνία', 'Date'), [fmtDate(minutes.date), time].filter(Boolean).join(' · ')],
      [L('Χώρος', 'Location'), minutes.location || '—'],
      [L('Σύνθεση', 'Who met'), compositionLabel(team ? 'control_team' : 'plenary', controlTeamName(committeeName, en), en)],
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
      L('Πρακτικό', 'Minutes'),
      committeeName,
      minutes.minutesNo,
      String(minutes.date || '').slice(0, 10),
    ]
      .filter(Boolean)
      .join('_'),
  }
}

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c],
  )
