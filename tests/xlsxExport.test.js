import { describe, expect, it } from 'vitest'
import { buildXlsx, zipStore } from '../src/core/export/xlsxExport'

const text = bytes => new TextDecoder().decode(bytes)
const names = bytes => { const out = []; for (let i = 0; i < bytes.length - 4; i += 1) if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02) { const len = bytes[i + 28] | (bytes[i + 29] << 8); out.push(text(bytes.slice(i + 46, i + 46 + len))) } return out }

describe('xlsx export', () => {
  it('is a zip with the workbook parts, one sheet per group, the text readable and escaped', () => {
    const bytes = buildXlsx([{ name: 'ΜΕΘ', headers: ['Όνομα', 'Τιμή'], rows: [['Α & Β <1>', 12], ['Γ', 'x']] }, { name: 'ΜΕΘ', headers: ['Όνομα'], rows: [] }])
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
    expect(names(bytes)).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'])
    const all = text(bytes)
    expect(all).toContain('Α &amp; Β &lt;1&gt;')
    expect(all).toContain('<v>12</v>')
    expect(all).toContain('name="ΜΕΘ"')
    expect(all).toContain('name="ΜΕΘ 2"')
  })
  it('puts the Demo mark above the header when there is one', () => {
    const all = text(buildXlsx([{ name: 'A', headers: ['x'], rows: [['1']] }], { mark: 'DEMO' }))
    expect(all).toContain('DEMO')
    expect(all).toContain('ySplit="2"')
  })
  it('stores files unchanged', () => {
    const zip = zipStore([{ name: 'a.txt', data: 'hello' }])
    expect(text(zip)).toContain('hello')
  })
})
