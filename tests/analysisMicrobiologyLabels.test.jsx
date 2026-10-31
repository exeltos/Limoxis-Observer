// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv } from '../src/core/export/csvExport'
import { LanguageProvider } from '../src/core/i18n/LanguageContext'
import { NationalSurveillance, exportNationalRowsCsv } from '../src/features/analysis/AnalysisPanels'
import { buildSectionModel } from '../src/features/analysis/analysisDomains'
import { categoryCounts,findingCategory, keepPerCategory, organismLabel, resistanceLabel, specimenLabel, specimenRows } from '../src/features/analysis/microbiologyLabels'

vi.mock('../src/core/export/csvExport', () => ({ downloadCsv: vi.fn() }))

const el = (elText) => elText
const en = (_elText, enText) => enText

// Rows as analysis_microbiology_findings groups them in the cloud data:
// [organism, resistance, department, source, count, lastDate, sampleType].
const ROWS = [
  ['Klebsiella pneumoniae', 'MDR', 'ΜΕΘ', 'centralLine', 3, '2026-10-01', 'bloodCulture'],
  ['Coagulase-negative staphylococci (CoNS)', '—', 'Παθολογική', 'peripheral', 5, '2026-09-20', 'bloodCulture'],
  ['Escherichia coli', '—', 'ΤΕΠ', 'Ορθικό επίχρισμα', 2, '2026-09-12', 'other'],
  ['—', '—', 'ΤΕΠ', 'urineCulture', 6, '2026-08-01', 'urineCulture'],
  ['—', '—', 'Χειρουργική', 'surface', 12, '2026-08-02', 'surface'],
  ['—', '—', 'Μεταφορείς Ασθενών', 'handSwab', 2, '2026-07-02', 'surveillance'],
  ['—', '—', 'Αποστείρωση', 'nasalSwab', 3, '2026-07-03', 'surveillance'],
]

describe('specimen labels: stored codes read as the laboratory names them, free text stays', () => {
  it('translates the source codes seen in the cloud line list (Greek and English)', () => {
    expect(specimenLabel('urineCulture', el)).toBe('Καλλιέργεια ούρων')
    expect(specimenLabel('trachealAspirate', el)).toBe('Τραχειακό αναρρόφημα')
    expect(specimenLabel('peripheral', el)).toBe('Περιφερική αιμοληψία')
    expect(specimenLabel('woundSwab', el)).toBe('Επίχρισμα τραύματος')
    expect(specimenLabel('surface', el)).toBe('Επιφάνεια')
    expect(specimenLabel('sputum', el)).toBe('Πτύελα')
    expect(specimenLabel('centralLine', el)).toBe('Κεντρική φλεβική γραμμή')
    expect(specimenLabel('bloodCulture', el)).toBe('Αιμοκαλλιέργεια')
    expect(specimenLabel('handSwab', el)).toBe('Επίχρισμα χεριών')
    expect(specimenLabel('nasalSwab', el)).toBe('Ρινικό επίχρισμα')
    expect(specimenLabel('urinaryCatheter', el)).toBe('Ουροκαθετήρας')
    expect(specimenLabel('water', el)).toBe('Νερό')
    expect(specimenLabel('peripheral', en)).toBe('Peripheral draw')
    expect(specimenLabel('handSwab', en)).toBe('Hand swab')
    expect(specimenLabel('urineCulture', en)).toBe('Urine culture')
  })

  it('keeps free text and shows a dash for an empty source', () => {
    expect(specimenLabel('Ορθικό επίχρισμα — screening CPE', el)).toBe('Ορθικό επίχρισμα — screening CPE')
    expect(specimenLabel('Κόπρανα', en)).toBe('Κόπρανα')
    expect(specimenLabel('', el)).toBe('—')
    expect(specimenLabel('—', el)).toBe('—')
  })

  it('merges chart rows that read the same once translated', () => {
    expect(specimenRows([['centralLine', 241], ['Κεντρική φλεβική γραμμή', 4], ['sputum', 215]], el)).toEqual([['Κεντρική φλεβική γραμμή', 245], ['Πτύελα', 215]])
  })
})

describe('findings without an identified organism', () => {
  it('read «Χωρίς ταυτοποίηση» and «Δεν ελέγχθηκε» instead of dashes', () => {
    expect(organismLabel('—', el)).toBe('Χωρίς ταυτοποίηση')
    expect(organismLabel('', en)).toBe('Not identified')
    expect(organismLabel(' Escherichia coli ', el)).toBe('Escherichia coli')
    expect(resistanceLabel('—', '—', el)).toBe('Δεν ελέγχθηκε')
    expect(resistanceLabel(null, '', en)).toBe('Not tested')
    expect(resistanceLabel('—', 'Escherichia coli', el)).toBe('—')
    expect(resistanceLabel('MDR', 'Klebsiella pneumoniae', el)).toBe('MDR')
  })
})

describe('clinical, environmental and staff findings are told apart by sample type', () => {
  it('classifies the cloud sample types', () => {
    expect(findingCategory('bloodCulture')).toBe('clinical')
    expect(findingCategory('other')).toBe('clinical')
    expect(findingCategory('surface')).toBe('environment')
    expect(findingCategory('water')).toBe('environment')
    expect(findingCategory('equipment')).toBe('environment')
    expect(findingCategory('surveillance')).toBe('staff')
  })

  it('counts positive findings per category', () => {
    expect(categoryCounts(ROWS)).toEqual({ clinical: 16, environment: 12, staff: 5 })
  })

  it('keeps the line-list limit per category, so environmental plates never push clinical rows out', () => {
    const rows = [...Array.from({ length: 5 }, () => ['—', '—', 'Χ', 'surface', 9, '2026-01-01', 'surface']), ['E. coli', '—', 'Χ', 'peripheral', 1, '2026-01-01', 'bloodCulture']]
    expect(rows.filter(keepPerCategory(2)).map(row => row[6])).toEqual(['surface', 'surface', 'bloodCulture'])
  })
})

describe('the line list on Μικροβιολογία & AMR', () => {
  afterEach(cleanup)
  const renderPanel = () => render(<LanguageProvider><NationalSurveillance details={{ nationalRows: ROWS, bySource: [['centralLine', 3], ['surface', 12]], bySite: [], resistance: [], monthly: [] }} clusters={[]} amr={[]} tx={el}/></LanguageProvider>)
  const lineList = () => screen.getByRole('radiogroup', { name: 'Είδος ευρημάτων' }).closest('article')

  it('opens on the clinical findings, with translated specimens and no raw keys', () => {
    renderPanel()
    const chips = within(screen.getByRole('radiogroup', { name: 'Είδος ευρημάτων' })).getAllByRole('radio')
    expect(chips.map(chip => chip.textContent)).toEqual(['Κλινικά · 16', 'Περιβάλλον · 12', 'Προσωπικό · 5'])
    expect(chips[0]).toHaveAttribute('aria-checked', 'true')
    const table = within(lineList())
    expect(table.getByText('Κεντρική φλεβική γραμμή')).toBeInTheDocument()
    expect(table.getByText('Περιφερική αιμοληψία')).toBeInTheDocument()
    expect(table.getByText('Χωρίς ταυτοποίηση')).toBeInTheDocument()
    expect(table.getByText('Δεν ελέγχθηκε')).toBeInTheDocument()
    expect(table.queryByText('Μεταφορείς Ασθενών')).not.toBeInTheDocument()
    expect(table.queryByText('Επιφάνεια')).not.toBeInTheDocument()
    for (const key of ['centralLine', 'peripheral', 'urineCulture', 'surface', 'handSwab', 'nasalSwab']) expect(document.body.textContent).not.toContain(key)
  })

  it('switches to the environmental and the staff findings', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('radio', { name: 'Περιβάλλον · 12' }))
    expect(within(lineList()).getByText('Επιφάνεια')).toBeInTheDocument()
    expect(within(lineList()).queryByText('Κεντρική φλεβική γραμμή')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Προσωπικό · 5' }))
    expect(within(lineList()).getByText('Μεταφορείς Ασθενών')).toBeInTheDocument()
    expect(within(lineList()).getByText('Ρινικό επίχρισμα')).toBeInTheDocument()
  })

  it('keeps unidentified findings out of the organism matrices', () => {
    renderPanel()
    const byDepartment = screen.getByText('Μικροοργανισμοί ανά τμήμα').closest('article')
    expect(within(byDepartment).getByText('Klebsiella pneumoniae')).toBeInTheDocument()
    expect(within(byDepartment).queryByText('Χωρίς ταυτοποίηση')).not.toBeInTheDocument()
    expect(within(byDepartment).queryByText('—')).not.toBeInTheDocument()
  })
})

describe('the CSV export carries the same labels', () => {
  it('writes translated organism, resistance and specimen cells', () => {
    downloadCsv.mockClear()
    exportNationalRowsCsv(ROWS.slice(3, 6), el, 'list')
    const [, , rows] = downloadCsv.mock.calls[0]
    expect(rows.map(row => [row[0], row[1], row[4]])).toEqual([
      ['Χωρίς ταυτοποίηση', 'Δεν ελέγχθηκε', 'Καλλιέργεια ούρων'],
      ['Χωρίς ταυτοποίηση', 'Δεν ελέγχθηκε', 'Περιβαλλοντικό δείγμα (επιφάνεια)'],
      ['Χωρίς ταυτοποίηση', 'Δεν ελέγχθηκε', 'Επιτήρηση προσωπικού'],
    ])
  })
})

describe('cloud status and type codes on the other Δείκτες tabs read in Greek', () => {
  const t = key => key
  const snapshot = { microbiology: {}, domains: { quality: { byStatus: [['under_review', 4], ['reported', 179]] }, surveillance: { byHaiType: [['CLABSI', 20], ['VAP', 12]] }, bundles: { byBundle: [['CLABSI', 36, 91], ['PIV', 72, 88], ['HD', 36, 95]] } } }
  const chart = (tab, title) => buildSectionModel(tab, snapshot, el, t).charts.find(item => item.title === title)
  it('an incident under review is «Υπό διερεύνηση», not under_review', () => {
    expect(chart('quality', 'Κατάσταση συμβάντων').rows).toEqual([['Υπό διερεύνηση', 4], ['Αναφέρθηκε', 179]])
  })
  it('HAI types keep their acronym, while the bundles of the same name read as bundles', () => {
    expect(chart('surveillance', 'Τύπος λοίμωξης (ΛΣΦΥ)').rows.map(row => row[0])).toEqual(['CLABSI', 'VAP'])
    expect(chart('prevention', 'Συμμόρφωση ανά δέσμη').rows.map(row => row[0])).toEqual(['Δέσμη CLABSI', 'Δέσμη PIV (περιφερικός φλεβικός καθετήρας)', 'Δέσμη HD (αιμοκάθαρση)'])
  })
})
