import { describe, expect, it } from 'vitest'
import { committeeMinutesReport } from '../src/features/committees/CommitteeMinutesDocument'
import { buildReportHtml } from '../src/core/export/reportDocument'

describe('Committee minutes as a document (PDF export)', () => {
  it('lists the meeting, attendance, topics with decisions, notes and approvals', () => {
    const minutes = {
      title: 'Μηνιαία συνεδρίαση ΕΝΛ', date: '2026-08-12', minutesNo: '8/2026', location: 'Αίθουσα Διοίκησης', status: 'finalized',
      attendanceRecords: [{ memberId: 'm1', name: 'Κώστας Σταθόπουλος', status: 'present' }, { memberId: 'm2', name: 'Μαρία Αντωνίου', status: 'excused' }],
      topics: [{ id: 't1', subject: 'Δείκτες HAI', decision: 'Συνεχίζεται η επιτήρηση στη ΜΕΘ.' }, { id: 't2', subject: '', decision: '' }],
      generalNotes: 'Επόμενη συνεδρίαση τον Σεπτέμβριο.',
      approvals: [{ id: 'a1', approverName: 'Σπύρος Βασιλείου', status: 'approved', decidedAt: '2026-08-14T10:00:00Z' }],
    }
    const doc = committeeMinutesReport({ committeeName: 'Επιτροπή Νοσοκομειακών Λοιμώξεων', minutes, en: false })
    const text = buildReportHtml(doc, { branding: { name: 'Demo Hospital' } })
    for (const part of ['Επιτροπή Νοσοκομειακών Λοιμώξεων', 'Μηνιαία συνεδρίαση ΕΝΛ', '8/2026', 'Αίθουσα Διοίκησης', 'Κώστας Σταθόπουλος', 'Παρών/ούσα', 'Δικαιολογημένη απουσία', 'Δείκτες HAI', 'Συνεχίζεται η επιτήρηση στη ΜΕΘ.', 'Επόμενη συνεδρίαση τον Σεπτέμβριο.', 'Σπύρος Βασιλείου', 'Εγκρίθηκε'])
      expect(text).toContain(part)
    // An empty topic is left out.
    expect(doc.sections.find(section => section.title === 'Θέματα & συμπεράσματα').table.rows).toHaveLength(1)
    // Signature lines for the chair and the secretary close the minutes.
    expect(text).toContain('Ο/Η Πρόεδρος')
  })
})
