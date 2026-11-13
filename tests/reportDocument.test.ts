import { describe, expect, it } from 'vitest'
import { buildReportHtml, reportFileName } from '../src/core/export/reportDocument'
import type { ReportDoc } from '../src/core/export/reportDocument'
import type { ReportBranding } from '../src/core/organization/branding'

const doc = {
  language: 'el',
  kind: 'Πρακτικό',
  code: 'DOC-1',
  title: 'Τίτλος <b>',
  meta: [['Ημερομηνία', '1/1/2026'], ['Τμήμα', 'ΜΕΘ']],
  sections: [{ title: 'Παρόντες', table: { columns: ['Α/Α', 'Όνομα'], rows: [['1', 'Παπαδόπουλος']] } }, { title: 'Αποφάσεις', text: 'Κείμενο' }],
  signatures: ['Συντάχθηκε', 'Εγκρίθηκε'],
} as ReportDoc

describe('shared report document', () => {
  it('builds a page with the hospital band, numbered sections, a real table, signatures and page numbers', () => {
    const html = buildReportHtml(doc, { branding: { name: 'Νοσοκομείο', logo: '', reportHeader: 'Γραφείο Ποιότητας', demo: false } as ReportBranding, now: new Date('2026-10-19T09:00:00Z') })
    expect(html).toContain('Νοσοκομείο')
    expect(html).toContain('Γραφείο Ποιότητας')
    expect(html).toContain('Τίτλος &lt;b&gt;')
    expect(html).toContain('1. Παρόντες')
    expect(html).toContain('2. Αποφάσεις')
    expect(html).toContain('<td>Παπαδόπουλος</td>')
    expect(html).toContain('Συντάχθηκε')
    // Page margin 0: the browser adds no header or footer of its own; the document has its own footer line.
    expect(html).toContain('@page{size:A4;margin:0}')
    expect(html).toContain('class="rd-foot"')
    // The footer carries only the print date: no code · title line.
    expect(html).not.toMatch(/rd-foot"><span>[^<]*DOC-1/)
    expect(html).toContain('class="rd-gap-top"')
    expect(html).not.toContain('DEMO')
  })

  it('adds a third «Έλαβε γνώση» box next to the two signatures', () => {
    const html = buildReportHtml({ ...doc, signatures: ['Συντάχθηκε', 'Εγκρίθηκε', { role: 'Έλαβε γνώση', name: 'Α Β' }] }, { branding: { name: 'Ν', demo: false } as ReportBranding })
    expect(html).toContain('Έλαβε γνώση')
    expect(html).toContain('Ονοματεπώνυμο: Α Β')
  })

  it('marks a Demo organization’s document and file name', () => {
    const branding = { name: 'Demo Hospital', logo: '', reportHeader: '', demo: true } as ReportBranding
    const html = buildReportHtml(doc, { branding })
    expect(html).toContain('DEMO · Συνθετικά δεδομένα')
    expect(reportFileName(doc, branding)).toBe('DEMO_DOC-1_Τίτλος_b')
  })

  it('gives Word a page setup and a closing footer line instead of margin boxes', () => {
    const html = buildReportHtml({ ...doc, orientation: 'landscape' }, { branding: { name: 'Demo Hospital', demo: true } as ReportBranding, word: true })
    expect(html).toContain('mso-page-orientation:landscape')
    expect(html).toContain('rd-word-footer')
    expect(html).not.toContain('counter(pages)')
  })
})
