import { describe, expect, it } from 'vitest'
import { buildReportHtml, reportFileName } from '../src/core/export/reportDocument'

const doc = {
  language: 'el',
  kind: 'Πρακτικό',
  code: 'DOC-1',
  title: 'Τίτλος <b>',
  meta: [['Ημερομηνία', '1/1/2026'], ['Τμήμα', 'ΜΕΘ']],
  sections: [{ title: 'Παρόντες', table: { columns: ['Α/Α', 'Όνομα'], rows: [['1', 'Παπαδόπουλος']] } }, { title: 'Αποφάσεις', text: 'Κείμενο' }],
  signatures: ['Συντάχθηκε', 'Εγκρίθηκε'],
}

describe('shared report document', () => {
  it('builds a page with the hospital band, numbered sections, a real table, signatures and page numbers', () => {
    const html = buildReportHtml(doc, { branding: { name: 'Νοσοκομείο', logo: '', reportHeader: 'Γραφείο Ποιότητας', demo: false }, now: new Date('2026-10-19T09:00:00Z') })
    expect(html).toContain('Νοσοκομείο')
    expect(html).toContain('Γραφείο Ποιότητας')
    expect(html).toContain('Τίτλος &lt;b&gt;')
    expect(html).toContain('1. Παρόντες')
    expect(html).toContain('2. Αποφάσεις')
    expect(html).toContain('<td>Παπαδόπουλος</td>')
    expect(html).toContain('Συντάχθηκε')
    expect(html).toContain('counter(pages)')
    expect(html).not.toContain('DEMO')
  })

  it('marks a Demo organization’s document and file name', () => {
    const branding = { name: 'Demo Hospital', logo: '', reportHeader: '', demo: true }
    const html = buildReportHtml(doc, { branding })
    expect(html).toContain('DEMO · Συνθετικά δεδομένα')
    expect(reportFileName(doc, branding)).toBe('DEMO_DOC-1_Τίτλος_b')
  })

  it('gives Word a page setup and a closing footer line instead of margin boxes', () => {
    const html = buildReportHtml({ ...doc, orientation: 'landscape' }, { branding: { name: 'Demo Hospital', demo: true }, word: true })
    expect(html).toContain('mso-page-orientation:landscape')
    expect(html).toContain('rd-word-footer')
    expect(html).not.toContain('counter(pages)')
  })
})
