import { describe, expect, it } from 'vitest'
import { committeeMinutesReport } from '../src/features/committees/CommitteeMinutesDocument'
import { buildReportHtml } from '../src/core/export/reportDocument'
import type { ReportBranding } from '../src/core/organization/branding'

describe('Committee minutes as a document (PDF export)', () => {
  it('lists the meeting, attendance, topics with decisions, notes and approvals', () => {
    const minutes = {
      title: 'Μηνιαία συνεδρίαση ΕΝΛ', date: '2026-08-12', minutesNo: '8/2026', location: 'Αίθουσα Διοίκησης', status: 'finalized',
      attendanceRecords: [{ memberId: 'm1', name: 'Κώστας Σταθόπουλος', status: 'present' }, { memberId: 'm2', name: 'Μαρία Αντωνίου', status: 'excused' }],
      topics: [{ id: 't1', subject: 'Δείκτες ΛΣΦΥ', decision: 'Συνεχίζεται η επιτήρηση στη ΜΕΘ.' }, { id: 't2', subject: '', decision: '' }],
      generalNotes: 'Επόμενη συνεδρίαση τον Σεπτέμβριο.',
      approvals: [{ id: 'a1', approverName: 'Σπύρος Βασιλείου', status: 'approved', decidedAt: '2026-08-14T10:00:00Z' }],
    }
    const doc = committeeMinutesReport({ committeeName: 'Επιτροπή Νοσοκομειακών Λοιμώξεων', minutes, en: false })
    const text = buildReportHtml(doc, { branding: { name: 'Demo Hospital' } as ReportBranding })
    for (const part of ['Επιτροπή Νοσοκομειακών Λοιμώξεων', 'Μηνιαία συνεδρίαση ΕΝΛ', '8/2026', 'Αίθουσα Διοίκησης', 'Κώστας Σταθόπουλος', 'Παρών/ούσα', 'Δικαιολογημένη απουσία', 'Δείκτες ΛΣΦΥ', 'Συνεχίζεται η επιτήρηση στη ΜΕΘ.', 'Επόμενη συνεδρίαση τον Σεπτέμβριο.', 'Σπύρος Βασιλείου', 'Εγκρίθηκε'])
      expect(text).toContain(part)
    // An empty topic is left out.
    expect(doc.sections.find(section => section.title === 'Θέματα & συμπεράσματα').table.rows).toHaveLength(1)
    // Signature lines for the chair and the secretary close the minutes.
    expect(text).toContain('Ο/Η Πρόεδρος')
    // It says plainly that it is the minutes, with their number, and that the whole committee met.
    expect(doc.title).toBe('ΠΡΑΚΤΙΚΟ ΣΥΝΕΔΡΙΑΣΗΣ αρ. 8/2026')
    expect(doc.subtitle).toBe('Συνεδρίαση της ολομέλειας της επιτροπής')
  })
  it('names the working and intervention team when only the team met', () => {
    const doc = committeeMinutesReport({ committeeName: 'Επιτροπή Νοσοκομειακών Λοιμώξεων', minutes: { title: 'Ομάδα', date: '2026-09-03', composition: 'control_team', attendanceRecords: [], topics: [] }, en: false })
    expect(doc.subtitle).toBe('Συνεδρίαση της Ομάδας Εργασίας και Επέμβασης (ΟΕΕ)')
    expect(doc.meta.find(row => row[0] === 'Σύνθεση')[1]).toBe('Ομάδα Εργασίας και Επέμβασης (ΟΕΕ)')
  })
})
