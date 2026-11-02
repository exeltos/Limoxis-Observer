// @vitest-environment jsdom
// The printed record is a report: sections built from a description, plain words for
// statuses and results, empty sections left out or saying «Δεν υπάρχουν καταγραφές»,
// and no colour classes, tables or controls in the printed output.
import fs from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const { LanguageProvider, translate } = await import('../src/core/i18n/LanguageContext')
const { normalizeReport, parseSusceptibility, sirWord, eventLine } = await import('../src/design-system/recordReport')
const { RecordReportPrint } = await import('../src/design-system/RecordReportPrint')
const { EntityRecordShell } = await import('../src/design-system/EntityRecordShell')
const { ExportMenu } = await import('../src/design-system/ExportMenu')
const { buildSurveillanceReport } = await import('../src/features/surveillance/surveillanceReport')
const { buildLaboratorySampleReport } = await import('../src/features/laboratory/laboratorySampleReport')
const { clinicalCases } = await import('../src/features/surveillance/clinicalDemoData')
const { formatDay, formatDateTime } = await import('../src/core/i18n/formatDay')

afterEach(() => { cleanup(); vi.useRealTimers() })
const read = path => fs.readFileSync(path, 'utf8')
const branding = { name: 'Γενικό Νοσοκομείο Δοκιμής', reportHeader: '', logo: '', demo: false, printedBy: 'Α. Νικολάου' }
const printedAt = new Date('2026-10-20T12:21:00')
const renderReport = (report, language = 'el') => render(<RecordReportPrint report={report} branding={branding} printedAt={printedAt} printedBy="Α. Νικολάου" language={language} fmtDateTime={value => formatDateTime(value, language)} />)

describe('normalizeReport', () => {
  it('numbers the sections, drops blank values and leaves out empty sections', () => {
    const doc = normalizeReport({
      title: 'Εγγραφή',
      summaryPairs: [['Τμήμα', 'ΜΕΘ'], ['Κενό', ''], ['Παύλα', '—'], ['Αριθμός', 0]],
      sections: [
        { id: 'a', title: 'Στοιχεία', pairs: [['Όνομα', 'Ελένη'], ['Τηλέφωνο', null]] },
        { id: 'b', title: 'Κενή ενότητα', pairs: [['Χ', '']] },
        { id: 'c', title: 'Ιστορικό', events: [], keep: true },
        { id: 'd', title: 'Λίστα', list: ['ένα', '', 'δύο'] },
      ],
    })
    expect(doc.summaryPairs).toEqual([['Τμήμα', 'ΜΕΘ'], ['Αριθμός', '0']])
    expect(doc.sections.map(section => [section.number, section.title])).toEqual([[1, 'Στοιχεία'], [2, 'Ιστορικό'], [3, 'Λίστα']])
    expect(doc.sections[0].pairs).toEqual([['Όνομα', 'Ελένη']])
    expect(doc.sections[1].empty).toBe('Δεν υπάρχουν καταγραφές')
    expect(doc.sections[2].list).toEqual(['ένα', 'δύο'])
  })

  it('says the empty text in English too, and accepts a custom one', () => {
    const doc = normalizeReport({ sections: [{ title: 'History', keep: true }, { title: 'Result', keep: true, emptyText: 'No result yet' }] }, { en: true })
    expect(doc.sections.map(section => section.empty)).toEqual(['No records.', 'No result yet'])
  })

  it('puts history in chronological order, one line per event', () => {
    const doc = normalizeReport({ sections: [{ title: 'Ιστορικό', events: [
      { when: '02/02/2025', sort: '2025-02-02', title: 'Έξοδος', detail: 'Σπίτι' },
      { when: '30/01/2025', sort: '2025-01-30', title: 'Εισαγωγή', detail: 'ΜΕΘ', by: 'Α. Νικολάου' },
    ] }] })
    expect(doc.sections[0].events.map(eventLine)).toEqual(['30/01/2025 · Εισαγωγή · ΜΕΘ (Α. Νικολάου)', '02/02/2025 · Έξοδος · Σπίτι'])
  })

  it('writes antibiogram results as words, not letters', () => {
    expect(sirWord('R', false)).toBe('Ανθεκτικό')
    expect(sirWord('S', true)).toBe('Susceptible')
    expect(parseSusceptibility('Meropenem R · Colistin S', false)).toEqual([['Meropenem', 'Ανθεκτικό'], ['Colistin', 'Ευαίσθητο']])
  })
})

describe('RecordReportPrint', () => {
  const report = {
    kind: 'Επεισόδιο επιτήρησης', code: 'SUR-1', title: 'Ελένη Παπαδοπούλου', subtitle: 'ΜΕΘ', statusLabel: 'Κατάσταση', status: 'Ενεργό',
    summaryText: 'Σύντομη περίληψη.', summaryPairs: [['Τμήμα', 'ΜΕΘ']],
    sections: [
      { id: 'patient', title: 'Στοιχεία ασθενούς', pairs: [['Ασθενής', 'Ελένη Παπαδοπούλου']] },
      { id: 'samples', title: 'Δείγματα και αποτελέσματα', items: [{ title: 'Αιμοκαλλιέργεια', meta: 'LAB-1', pairs: [['Αποτέλεσμα', 'Θετικό']], table: [['Meropenem', 'Ανθεκτικό']] }] },
      { id: 'history', title: 'Ιστορικό', keep: true },
    ],
  }

  it('lays the report out as a document: letterhead, title, status in words, summary, numbered sections, footer', () => {
    const { container } = renderReport(report)
    expect(screen.getByRole('heading', { level: 1, name: 'Ελένη Παπαδοπούλου' })).toBeInTheDocument()
    expect(container.querySelector('.record-report-org-name')).toHaveTextContent('Γενικό Νοσοκομείο Δοκιμής')
    expect(container.querySelector('.record-report-meta')).toHaveTextContent('Κωδικός:SUR-1')
    expect(container.querySelector('.record-report-meta')).toHaveTextContent('Εκτυπώθηκε από:Α. Νικολάου')
    expect(container.querySelector('.record-report-status')).toHaveTextContent('Κατάσταση: Ενεργό')
    expect(screen.getByRole('heading', { name: 'Περίληψη' })).toBeInTheDocument()
    expect([...container.querySelectorAll('h2')].map(heading => heading.textContent)).toEqual(['Περίληψη', '1. Στοιχεία ασθενούς', '2. Δείγματα και αποτελέσματα', '3. Ιστορικό'])
    expect(container.querySelector('[data-report-section="history"]')).toHaveTextContent('Δεν υπάρχουν καταγραφές')
    expect(container.querySelector('.record-report-item-title')).toHaveTextContent('Αιμοκαλλιέργεια · LAB-1')
    expect(container.querySelector('.record-report-antibiogram')).toHaveTextContent('MeropenemΑνθεκτικό')
    expect(container.querySelector('.record-report-end')).toHaveTextContent('Εμπιστευτικό — περιέχει δεδομένα υγείας')
    // «Σελίδα X από Y» and the repeated header live in the page boxes.
    const style = container.querySelector('style').textContent
    expect(style).toContain('counter(page)')
    expect(style).toContain('counter(pages)')
    expect(style).toContain('"Σελίδα"')
    expect(style).toContain('Γενικό Νοσοκομείο Δοκιμής · Επεισόδιο επιτήρησης SUR-1')
    expect(style).toContain('Εμπιστευτικό — περιέχει δεδομένα υγείας')
  })

  it('has the English variant', () => {
    const { container } = renderReport({ ...report, status: 'Active', statusLabel: 'Status' }, 'en')
    expect(container.querySelector('.record-report-status')).toHaveTextContent('Status: Active')
    expect(container.querySelector('.record-report-meta')).toHaveTextContent('Print date')
    expect(container.querySelector('.record-report-end')).toHaveTextContent('Confidential — contains health data')
    expect(container.querySelector('style').textContent).toContain('"Page"')
    expect(container.querySelector('[data-report-section="history"]')).toHaveTextContent('No records.')
  })

  it('has no colour classes, tables, buttons or inline colours', () => {
    const { container } = renderReport(report)
    const html = container.innerHTML
    expect(html).not.toMatch(/badge|chip|pill|tone-|danger|warning|success|status-/i)
    expect(container.querySelector('table,button,input,svg')).toBeNull()
    expect(html).not.toMatch(/style="[^"]*(color|background)/i)
    // The stylesheet: black on white, serif, no coloured values beyond black/grey rules.
    const css = read('src/styles/record-report.css')
    expect(css).toContain('Georgia,"Times New Roman"')
    expect(css).toContain('font:11pt/1.5')
    expect(css.match(/#[0-9a-f]{3,6}\b/gi).every(color => ['#000', '#fff', '#777'].includes(color.toLowerCase()))).toBe(true)
  })

  it('shows the demo mark as plain words and the logo only as a data URL', () => {
    const logo = 'data:image/png;base64,AAAA'
    const { container, rerender } = render(<RecordReportPrint report={report} branding={{ ...branding, demo: true, logo }} printedAt={printedAt} printedBy="Χ" language="el" fmtDateTime={String} />)
    expect(container.querySelector('.record-report-demo')).toHaveTextContent('DEMO')
    expect(container.querySelector('img')).toHaveAttribute('src', logo)
    rerender(<RecordReportPrint report={report} branding={{ ...branding, logo: 'https://example.test/logo.png' }} printedAt={printedAt} printedBy="Χ" language="el" fmtDateTime={String} />)
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('the shell prints the report instead of the screen', () => {
  it('replaces the tabs with the report while printing and returns afterwards', () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<MemoryRouter><LanguageProvider><EntityRecordShell title="Ελένη" eyebrow="PT-1" tabs={[{ id: 'one', label: 'Σύνοψη' }]} activeTab="one" renderTab={() => <p>Οθόνη</p>} printReport={() => ({ kind: 'Εγγραφή', code: 'PT-1', title: 'Ελένη', sections: [{ title: 'Στοιχεία', pairs: [['Τμήμα', 'ΜΕΘ']] }] })} headerActions={<ExportMenu onPrint={() => {}} />}><p>Οθόνη</p></EntityRecordShell></LanguageProvider></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Εξαγωγή' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Εκτύπωση/ }))
    expect(document.querySelector('[data-record-report]')).not.toBeNull()
    expect(document.querySelector('.record-print-section')).toBeNull()
    expect(screen.queryByRole('tab')).toBeNull()
    act(() => { vi.advanceTimersByTime(500) })
    expect(window.print).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new Event('afterprint')) })
    expect(document.querySelector('[data-record-report]')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Σύνοψη' })).toBeInTheDocument()
  })

  it('keeps the plain fallback for a record page without a description', () => {
    const css = read('src/styles/print.css')
    expect(css).toContain("font-family:Georgia,'Times New Roman',serif")
    expect(css).not.toMatch(/#17324a|#9a3412|#4f6477|#5d7083/)
    expect(css).toContain('[class*="badge"]')
  })

  it('is wired into the surveillance episode and the laboratory sample', () => {
    expect(read('src/features/surveillance/PatientClinicalCanonicalPage.jsx')).toContain('printReport={printReport}')
    expect(read('src/features/laboratory/LaboratorySampleRecordFunctionalView.jsx')).toContain('printReport={printReport}')
  })
})

const tEl = key => translate(key, 'el')
const tEn = key => translate(key, 'en')
const fmts = language => ({ fmtDate: value => formatDay(value, language), fmtDateTime: value => formatDateTime(value, language) })

describe('buildSurveillanceReport', () => {
  const record = clinicalCases['SUR-260041']
  const base = language => ({ language, t: language === 'en' ? tEn : tEl, ...fmts(language), record, patient: { id: record.patientId, name: record.patient, nameEn: record.patientEn }, samples: record.samples, department: record.department, status: record.status, sampleLabel: sample => (language === 'en' ? tEn : tEl)(sample.type) })

  it('has the patient, surveillance, samples, documents and history sections', () => {
    const doc = normalizeReport(buildSurveillanceReport(base('el')))
    expect(doc.sections.map(section => `${section.number}. ${section.title}`)).toEqual(['1. Στοιχεία ασθενούς', '2. Επιτήρηση', '3. Δείγματα και αποτελέσματα', '4. Έγγραφα', '5. Ιστορικό'])
    expect(doc.kind).toBe('Επεισόδιο επιτήρησης')
    expect(doc.code).toBe('SUR-260041')
    expect(doc.status).toBe(tEl('active'))
    expect(doc.summaryText).toContain('Ελένη Παπαδοπούλου')
  })

  it('writes each sample as an item with an antibiogram in words, not S/I/R letters', () => {
    const doc = normalizeReport(buildSurveillanceReport(base('el')))
    const samples = doc.sections.find(section => section.id === 'samples')
    expect(samples.items).toHaveLength(2)
    expect(samples.items[0].table).toEqual([['Meropenem', 'Ανθεκτικό'], ['Colistin', 'Ευαίσθητο'], ['Ceftazidime/avibactam', 'Ευαίσθητο']])
    expect(JSON.stringify(samples)).not.toMatch(/positive|pending|bloodCulture/)
    expect(samples.items[1].pairs.find(pair => pair[0] === 'Αποτέλεσμα')[1]).toBe('Εκκρεμεί')
  })

  it('lists the history chronologically and without raw keys', () => {
    const doc = normalizeReport(buildSurveillanceReport(base('el')))
    const history = doc.sections.find(section => section.id === 'history')
    const lines = history.events.map(eventLine)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('Κλινική αξιολόγηση')
    expect(lines[3]).toContain('Επανεκτίμηση')
    expect(lines.join('')).not.toMatch(/clinicalAssessment|criticalResult|contactPrecautions/)
  })

  it('leaves out what the user cannot see', () => {
    const doc = normalizeReport(buildSurveillanceReport({ ...base('el'), can: { lab: false, surveillance: false } }))
    expect(doc.sections.map(section => section.id)).toEqual(['patient', 'documents', 'history'])
  })

  it('has the English variant', () => {
    const doc = normalizeReport(buildSurveillanceReport(base('en')), { en: true })
    expect(doc.kind).toBe('Surveillance episode')
    expect(doc.sections[0].title).toBe('Patient details')
    expect(doc.sections.find(section => section.id === 'samples').items[0].table[0]).toEqual(['Meropenem', 'Resistant'])
  })

  it('says the empty text for a surveillance without samples or events', () => {
    const doc = normalizeReport(buildSurveillanceReport({ ...base('el'), record: { ...record, samples: [], timeline: [] }, samples: [] }))
    expect(doc.sections.find(section => section.id === 'samples').empty).toBe('Δεν υπάρχουν καταγραφές')
    expect(doc.sections.find(section => section.id === 'history').empty).toBe('Δεν υπάρχουν καταγραφές')
  })
})

describe('buildLaboratorySampleReport', () => {
  const sample = { id: 'LAB-1', type: 'bloodCulture', subjectType: 'patient', subjectName: 'Ελένη Παπαδοπούλου', subjectCode: 'PT-1', department: 'ΜΕΘ', status: 'completed', collectedAt: '2026-10-15T08:25:00', receivedAt: '2026-10-15T09:00:00', finalizedAt: '2026-10-17T10:00:00', requestedAt: '2026-10-15T08:00:00', microbiologyResults: [{ resultStatus: 'validated', resultedAt: '2026-10-16T11:40:00' }] }
  const progress = {
    result: { result: 'positive', resultStatus: 'validated', critical: true, organism: 'Klebsiella pneumoniae', method: 'culture' },
    ast: [{ organism: 'Klebsiella pneumoniae', drug: 'Meropenem', sir: 'R', mic: 16, operator: '>' }, { organism: 'Klebsiella pneumoniae', drug: 'Colistin', sir: 'S', mic: 0.5 }],
    amr: [{ organism: 'Klebsiella pneumoniae', classification: 'MDR', definitionSource: 'ECDC', definitionVersion: '2012' }],
    communications: [{ id: 'c1', to: 'Δρ Παπαδάκη', method: 'phone', at: '2026-10-16T12:00:00', readBack: true }],
    organisms: ['Klebsiella pneumoniae'],
  }
  const steps = [{ id: 'receive', label: 'Παραλαβή', state: 'done', meta: '15/10/2026' }, { id: 'ast', label: 'Αντιβιόγραμμα', state: 'na', meta: '' }, { id: 'finalize', label: 'Οριστικοποίηση', state: 'next', meta: '' }]
  const input = language => ({ sample, steps, progress, language, t: language === 'en' ? tEn : tEl, tx: key => key, fmt: value => formatDateTime(value, language), statusWord: 'Ολοκληρωμένο' })

  it('has sample details, progress, microbiology result, communication, documents and history', () => {
    const doc = normalizeReport(buildLaboratorySampleReport(input('el')))
    expect(doc.sections.map(section => section.title)).toEqual(['Στοιχεία δείγματος', 'Πρόοδος δείγματος', 'Μικροβιολογικό αποτέλεσμα', 'communicationTitle', 'Έγγραφα', 'Ιστορικό'])
    expect(doc.kind).toBe('Εργαστηριακό δείγμα')
    expect(doc.statusLabel).toBe('Κατάσταση')
    expect(doc.status).toBe('Ολοκληρωμένο')
    expect(doc.sections[1].list).toEqual(['Παραλαβή: Ολοκληρώθηκε · 15/10/2026', 'Αντιβιόγραμμα: Δεν απαιτείται', 'Οριστικοποίηση: Εκκρεμεί'])
  })

  it('writes the antibiogram per organism as antibiotic and result in words', () => {
    const doc = normalizeReport(buildLaboratorySampleReport(input('el')))
    const result = doc.sections.find(section => section.id === 'result')
    expect(result.items[0].title).toBe('Klebsiella pneumoniae')
    expect(result.items[0].table).toEqual([['Meropenem (MIC >16)', 'Ανθεκτικό'], ['Colistin (MIC 0.5)', 'Ευαίσθητο']])
    expect(result.items[0].pairs[0][1]).toBe('MDR · ECDC 2012')
  })

  it('says «Δεν υπάρχουν καταγραφές» for a sample without a result and keeps the history chronological', () => {
    const empty = normalizeReport(buildLaboratorySampleReport({ ...input('el'), progress: { organisms: [], ast: [], amr: [], communications: [] } }))
    expect(empty.sections.find(section => section.id === 'result').empty).toBe('noResult')
    expect(empty.sections.find(section => section.id === 'communication')).toBeUndefined()
    const history = empty.sections.find(section => section.id === 'history').events
    expect(history[0].sort < history[history.length - 1].sort).toBe(true)
  })
})
