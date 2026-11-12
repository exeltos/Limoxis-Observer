import { DEMO_REPORT_MARK_EL, isDemoReport } from '../organization/branding'

// A real Excel file (.xlsx) without a library: the workbook is a zip of small XML parts, written uncompressed.
// One sheet per list: a dark header row, column widths that fit the text, wrapped cells, the header frozen and a filter on it.

const encoder = new TextEncoder()
const xml = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[ch]).replace(/[^\t\n\r\u0020-\uffff]/g, '')

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array) {
  if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0 } }
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// A file of the zip: its path and its content (text is written as UTF-8).
export interface ZipFile { name: string; data: string | Uint8Array }

// The zip container: every file stored as it is (no compression), with the central directory at the end.
export function zipStore(files: ZipFile[]) {
  const parts: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  const u16 = (value: number) => [value & 0xff, (value >>> 8) & 0xff]
  const u32 = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
  for (const file of files) {
    const name = encoder.encode(file.name), data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data, crc = crc32(data)
    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)])
    parts.push(local, name, data)
    central.push(new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name)
    offset += local.length + name.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)])
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) { out.set(part, at); at += part.length }
  return out
}

const columnName = (index: number) => { let n = index + 1, name = ''; while (n > 0) { const rest = (n - 1) % 26; name = String.fromCharCode(65 + rest) + name; n = Math.floor((n - 1) / 26) } return name }
const sheetName = (name: unknown, taken: Set<string>) => {
  const base = String(name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let candidate = base, n = 2
  while (taken.has(candidate.toLowerCase())) { candidate = `${base.slice(0, 28)} ${n}`; n += 1 }
  taken.add(candidate.toLowerCase())
  return candidate
}

// A cell is a value, or { v, s } with one of the styles below (XLSX_STYLE) for a laid-out sheet such as a roster.
export interface XlsxStyledCell { v?: unknown; s?: number }
const valueOf = (cell: unknown) => (cell && typeof cell === 'object' ? (cell as XlsxStyledCell).v : cell)
// A sheet may also carry `top` (title lines above the header), `widths` (column widths), `freezeColumns`,
// `filter: false` and `fit: true` (the whole sheet on one page).
export interface XlsxSheet { name?: string; headers?: unknown[]; rows?: unknown[][]; top?: unknown[][]; widths?: number[]; freezeColumns?: number; filter?: boolean; fit?: boolean }
function sheetXml({ headers = [], rows = [], mark = '', top = [], widths: fixedWidths, freezeColumns = 0, filter = true, fit = false }: XlsxSheet & { mark?: string }) {
  const all = [...(mark ? [[mark]] : []), ...top, headers, ...rows]
  const headerRow = (mark ? 1 : 0) + top.length + 1
  const columns = Math.max(headers.length, ...rows.map(row => row.length), 1)
  const widths = Array.from({ length: columns }, (_, c) => {
    if (fixedWidths?.[c]) return fixedWidths[c]
    const longest = Math.max(...[headers[c], ...rows.map(row => row[c])].map(value => String(valueOf(value) ?? '').split('\n').reduce((max, line) => Math.max(max, line.length), 0)), 0)
    return Math.min(60, Math.max(10, Math.ceil(longest * 1.15) + 2))
  })
  const body = all.map((row, r) => {
    const style = r + 1 === headerRow ? 1 : 0
    const cells = row.map((cell, c) => {
      const ref = `${columnName(c)}${r + 1}`
      const value = valueOf(cell)
      const own = cell && typeof cell === 'object' && Number.isInteger((cell as XlsxStyledCell).s) ? (cell as XlsxStyledCell).s as number : null
      if (mark && r === 0) return `<c r="${ref}" t="inlineStr" s="2"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
      if (typeof value === 'number' && Number.isFinite(value) && (own !== null || style === 0)) return `<c r="${ref}" s="${own ?? 3}"><v>${value}</v></c>`
      return `<c r="${ref}" t="inlineStr" s="${own ?? style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}"${style === 1 ? ' ht="22" customHeight="1"' : ''}>${cells}</row>`
  }).join('')
  const last = `${columnName(columns - 1)}${all.length}`
  const pane = freezeColumns
    ? `<pane xSplit="${freezeColumns}" ySplit="${headerRow}" topLeftCell="${columnName(freezeColumns)}${headerRow + 1}" activePane="bottomRight" state="frozen"/>`
    : `<pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${fit ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : ''}<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${rows.length && filter ? `<autoFilter ref="A${headerRow}:${last}"/>` : ''}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${fit ? 1 : 0}"/></worksheet>`
}

// The styles a laid-out sheet may give its cells (index into cellXfs).
export const XLSX_STYLE = { center: 4, dayHead: 5, weekendHead: 6, morning: 7, afternoon: 8, night: 9, rest: 10, leave: 11, intermediate: 12, total: 13, title: 14, subtitle: 15, weekend: 16, name: 17 }

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="6"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF9A3412"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF17324A"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF17324A"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF5D7083"/><name val="Calibri"/></font></fonts><fills count="11"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17324A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE9C8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4DC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EAFF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFF3E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFBE0E0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F5F8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC9D4DE"/></left><right style="thin"><color rgb="FFC9D4DE"/></right><top style="thin"><color rgb="FFC9D4DE"/></top><bottom style="thin"><color rgb="FFC9D4DE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="18"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

// sheets: [{ name, headers, rows }] — returns the bytes of the .xlsx file.
export function buildXlsx(sheets?: XlsxSheet[] | null, { mark = '' }: { mark?: string } = {}) {
  const list: XlsxSheet[] = (sheets?.length ? sheets : [{ name: 'Sheet1', headers: [], rows: [] }])
  const taken = new Set<string>()
  const named = list.map(sheet => ({ ...sheet, name: sheetName(sheet.name, taken) }))
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...named.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml({ ...sheet, mark }) })),
  ]
  return zipStore(files)
}

export function downloadXlsx(filename: string, sheets?: XlsxSheet[] | null) {
  // A Demo organization's files start with the DEMO mark and are named DEMO_….
  const demo = isDemoReport()
  if (demo && !String(filename).startsWith('DEMO_')) filename = `DEMO_${filename}`
  const bytes = buildXlsx(sheets, { mark: demo ? DEMO_REPORT_MARK_EL : '' })
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
