// The shared document layout for every printed or downloaded report: the
// hospital band (logo, name, report header line), the document title and code,
// a grid of facts, numbered sections with real tables, a signature block and a
// footer on every page (document code, printed-on date, page X / Y and the DEMO
// mark in a Demo organization).
//
// One description of the document gives two outputs:
// - printReport(doc): the page is built in a new window and printed, so «Save
//   as PDF» keeps real, selectable text (no screenshots);
// - downloadReportWord(doc): the same HTML as a .doc file that Word opens.
//
// doc = {
//   language: 'el' | 'en',
//   kind: 'Πρακτικό συνεδρίασης',        // small line above the title
//   title, code, subtitle,
//   orientation: 'portrait' | 'landscape',
//   meta: [[label, value], …],           // the facts grid under the title
//   sections: [{ title, text, html, facts, list, table: { columns, rows, foot }, note }],
//   signatures: ['Συντάχθηκε', …] or [{ role, name, date, signed }],
//   body: '<html>',                      // a layout of its own (e.g. a certificate)
//   filename,                            // without extension
//   footer: 'text'                       // left footer text (defaults to code · title)
// }
// Table cells are text, or { text | html, className, colSpan, align }.
import {
  DEMO_REPORT_MARK_EL,
  DEMO_REPORT_MARK_EN,
  getReportBranding,
} from '../organization/branding'
import { formatDateTime } from '../i18n/formatDay'

export const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
// A CSS string for the page margin boxes. «<» is escaped too, so no text can close the <style>.
const cssString = value =>
  `"${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\3c ')
    .replace(/[\r\n]+/g, ' ')}"`
const text = (value, fallback = '—') => {
  const v = value == null ? '' : String(value)
  return v.trim() ? escapeHtml(v).replace(/\n/g, '<br>') : fallback
}

export function reportFileName(doc, branding = getReportBranding()) {
  const base =
    String(doc?.filename || [doc?.code, doc?.title].filter(Boolean).join('_') || 'report')
      .trim()
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^_+|_+$/g, '') || 'report'
  return branding?.demo && !base.startsWith('DEMO_') ? `DEMO_${base}` : base
}

function cell(value, tag = 'td') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const attrs = [
      value.className && `class="${escapeHtml(value.className)}"`,
      value.colSpan > 1 && `colspan="${Number(value.colSpan)}"`,
      value.align &&
        `style="text-align:${value.align === 'right' ? 'right' : value.align === 'center' ? 'center' : 'left'}"`,
    ]
      .filter(Boolean)
      .join(' ')
    return `<${tag}${attrs ? ` ${attrs}` : ''}>${value.html != null ? value.html : text(value.text, '')}</${tag}>`
  }
  return `<${tag}>${text(value, '')}</${tag}>`
}

export function reportTableHtml({ columns = [], rows = [], foot = null, empty } = {}, en = false) {
  if (!rows.length)
    return `<p class="rd-empty">${escapeHtml(empty || (en ? 'No entries.' : 'Δεν υπάρχουν εγγραφές.'))}</p>`
  const head = columns.length
    ? `<thead><tr>${columns.map(column => cell(typeof column === 'object' ? column : { text: column }, 'th')).join('')}</tr></thead>`
    : ''
  const body = rows.map(row => `<tr>${row.map(value => cell(value)).join('')}</tr>`).join('')
  const footer = foot ? `<tfoot><tr>${foot.map(value => cell(value)).join('')}</tr></tfoot>` : ''
  return `<table class="rd-table" border="1" cellspacing="0" cellpadding="4">${head}<tbody>${body}</tbody>${footer}</table>`
}

function factsHtml(facts = [], columns = 2) {
  const items = facts.filter(Boolean).filter(([label]) => label)
  if (!items.length) return ''
  const rows = []
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns))
  return `<table class="rd-facts" cellspacing="0" cellpadding="0">${rows.map(row => `<tr>${row.map(([label, value]) => `<th>${escapeHtml(label)}</th><td>${text(value)}</td>`).join('')}${'<th></th><td></td>'.repeat(columns - row.length)}</tr>`).join('')}</table>`
}

function signaturesHtml(signatures = [], en) {
  if (!signatures.length) return ''
  const list = signatures.map(item => (typeof item === 'string' ? { role: item } : item))
  const per = Math.min(3, list.length)
  const rows = []
  for (let i = 0; i < list.length; i += per) rows.push(list.slice(i, i + per))
  const L = (el, enText) => (en ? enText : el)
  return `<table class="rd-signatures" cellspacing="0" cellpadding="0">${rows.map(row => `<tr>${row.map(item => `<td><strong>${escapeHtml(item.role || '')}</strong><span>${L('Ονοματεπώνυμο', 'Name')}: ${item.name ? escapeHtml(item.name) : ''}</span><span>${L('Ημερομηνία', 'Date')}: ${item.date ? escapeHtml(item.date) : ''}</span><span>${L('Υπογραφή', 'Signature')}: ${item.signed ? escapeHtml(item.signed) : ''}</span></td>`).join('')}${'<td></td>'.repeat(per - row.length)}</tr>`).join('')}</table>`
}

function sectionHtml(section, number, en) {
  const parts = []
  if (section.text)
    parts.push(
      String(section.text)
        .split(/\n{2,}/)
        .map(p => `<p>${text(p, '')}</p>`)
        .join(''),
    )
  if (section.facts) parts.push(factsHtml(section.facts, section.factColumns || 2))
  if (section.list?.length)
    parts.push(`<ul>${section.list.map(item => `<li>${text(item, '')}</li>`).join('')}</ul>`)
  if (section.table) parts.push(reportTableHtml(section.table, en))
  if (section.tables)
    section.tables.forEach(table =>
      parts.push(
        `${table.title ? `<h3>${escapeHtml(table.title)}</h3>` : ''}${reportTableHtml(table, en)}`,
      ),
    )
  if (section.html) parts.push(section.html)
  if (section.note) parts.push(`<p class="rd-note">${text(section.note, '')}</p>`)
  const title = section.title
    ? `<h2>${number ? `${number}. ` : ''}${escapeHtml(section.title)}</h2>`
    : ''
  return `<section class="rd-section${section.keepTogether ? ' rd-keep' : ''}">${title}${parts.join('')}</section>`
}

const REPORT_CSS = `
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:#fff}
body{font-family:Arial,'Helvetica Neue',sans-serif;color:#17324a;font-size:10.5pt;line-height:1.4}
.rd-page{padding:0}
@media screen{body{background:#e9eef3}.rd-page{max-width:var(--rd-width);margin:18px auto;background:#fff;padding:14mm 13mm;box-shadow:0 2px 12px rgba(23,50,74,.15)}}
.rd-band{width:100%;border-collapse:collapse;border-bottom:2px solid #17324a;margin:0 0 10px}
.rd-band td{vertical-align:middle;padding:0 0 8px}
.rd-logo{width:1%;padding-right:12px!important}
.rd-logo img{max-height:46px;max-width:150px;display:block}
.rd-org strong{display:block;font-size:12.5pt}
.rd-org span{display:block;color:#5d7083;font-size:9pt}
.rd-doc{text-align:right;white-space:nowrap;color:#5d7083;font-size:9pt}
.rd-doc b{display:block;color:#17324a;font-size:11pt}
.rd-demo{margin:0 0 10px;padding:4px 8px;border:1px solid #c2410c;color:#9a3412;background:#fff7ed;font-size:8.5pt;font-weight:700;letter-spacing:.02em}
.rd-kind{margin:2px 0 0;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5d7083}
h1.rd-title{margin:2px 0 2px;font-size:17pt;line-height:1.25}
.rd-subtitle{margin:0 0 10px;color:#5d7083}
.rd-facts{width:100%;border-collapse:collapse;margin:8px 0 12px;font-size:9.5pt}
.rd-facts th,.rd-facts td{border:1px solid #cfdbe5;padding:4px 6px;text-align:left;vertical-align:top}
.rd-facts th{background:#f1f5f8;color:#4c6378;font-weight:600;width:18%}
.rd-facts td{font-weight:600}
.rd-section{margin:12px 0 0;break-inside:auto}
.rd-section h2{margin:0 0 6px;padding-bottom:3px;border-bottom:1px solid #cbd8e3;font-size:12pt;break-after:avoid}
.rd-section h3{margin:10px 0 4px;font-size:10.5pt;break-after:avoid}
.rd-section p{margin:4px 0}
.rd-section ul,.rd-section ol{margin:4px 0;padding-left:20px}
.rd-table{width:100%;border-collapse:collapse;font-size:9pt;margin:4px 0}
.rd-table th,.rd-table td{border:1px solid #c9d4de;padding:3px 5px;text-align:left;vertical-align:top}
.rd-table thead{display:table-header-group}
.rd-table th{background:#eef3f7;font-weight:700}
.rd-table tfoot td{font-weight:700;background:#f6f9fb}
.rd-table tr{break-inside:avoid}
.rd-table td small{display:block;color:#5d7083}
.rd-table .rd-num{text-align:right;white-space:nowrap}
.rd-table .rd-sub td{background:#fafcfd}
.rd-table .rd-sub td:first-child{padding-left:16px}
.rd-table .rd-bad{color:#b42318;font-weight:700}
.rd-table .rd-good{color:#067647;font-weight:700}
.rd-table .rd-warn{color:#b54708;font-weight:700}
.rd-empty,.rd-note{color:#5d7083;font-size:9pt}
.rd-keep{break-inside:avoid}
.rd-signatures{width:100%;border-collapse:separate;border-spacing:16px 0;margin:22px -16px 0;break-inside:avoid}
.rd-signatures td{vertical-align:top;border-top:1px solid #17324a;padding-top:6px;font-size:9.5pt;width:33%}
.rd-signatures strong,.rd-signatures span{display:block;margin-bottom:12px}
.rd-word-footer{margin-top:18px;padding-top:6px;border-top:1px solid #cbd8e3;color:#5d7083;font-size:8pt}
/* Certificate */
.rd-certificate{text-align:center;padding:10mm 14mm 0;border:3px double #1e4e79;min-height:150mm}
.rd-certificate .rd-cert-logo img{max-height:60px;max-width:220px}
.rd-certificate .rd-cert-org{font-size:13pt;font-weight:700;margin:6px 0 0}
.rd-certificate .rd-cert-sub{color:#5d7083;font-size:9.5pt;margin:2px 0 0}
.rd-certificate h1{font-size:26pt;letter-spacing:.08em;text-transform:uppercase;margin:14mm 0 4mm;color:#1e4e79}
.rd-certificate .rd-cert-lead{font-size:11pt;margin:0}
.rd-certificate .rd-cert-name{font-size:22pt;font-weight:700;margin:4mm 0;border-bottom:1px solid #9fb3c6;display:inline-block;padding:0 12mm 2mm}
.rd-certificate .rd-cert-programme{font-size:15pt;font-weight:700;margin:2mm 0}
.rd-certificate .rd-cert-facts{margin:6mm auto 0;border-collapse:collapse;font-size:10pt}
.rd-certificate .rd-cert-facts td{padding:2px 10px;text-align:left}
.rd-certificate .rd-cert-facts td:first-child{color:#5d7083;text-align:right}
.rd-certificate .rd-signatures{margin:14mm 0 0;border-spacing:30px 0}
.rd-certificate .rd-cert-number{margin-top:8mm;font-size:9pt;color:#5d7083}
`

function pageCss(doc, branding, printedOn, en) {
  const size = doc.orientation === 'landscape' ? 'A4 landscape' : 'A4'
  const left = doc.footer || [doc.code, doc.title].filter(Boolean).join(' · ')
  const demo = branding?.demo ? ` · ${en ? 'DEMO' : 'DEMO'}` : ''
  const center = `${en ? 'Printed' : 'Εκτύπωση'} ${printedOn}${demo}`
  const top = branding?.name || ''
  return `@page{size:${size};margin:12mm 11mm 14mm;@top-right{content:${cssString(top)};font:7.5pt Arial,sans-serif;color:#8296a8}@bottom-left{content:${cssString(left)};font:7.5pt Arial,sans-serif;color:#5d7083}@bottom-center{content:${cssString(center)};font:7.5pt Arial,sans-serif;color:${branding?.demo ? '#9a3412' : '#5d7083'}}@bottom-right{content:${cssString(en ? 'Page ' : 'Σελίδα ')} counter(page) " / " counter(pages);font:7.5pt Arial,sans-serif;color:#5d7083}}@page:first{@top-right{content:none}}`
}

export function buildReportHtml(
  doc = {},
  { branding = getReportBranding(), word = false, now = new Date() } = {},
) {
  const en = doc.language === 'en'
  const printedOn = formatDateTime(now.toISOString(), doc.language || 'el')
  const demoMark = en ? DEMO_REPORT_MARK_EN : DEMO_REPORT_MARK_EL
  const band = `<table class="rd-band" cellspacing="0" cellpadding="0"><tr>${branding?.logo ? `<td class="rd-logo"><img src="${escapeHtml(branding.logo)}" alt=""></td>` : ''}<td class="rd-org"><strong>${escapeHtml(branding?.name || '')}</strong>${branding?.reportHeader ? `<span>${escapeHtml(branding.reportHeader)}</span>` : ''}</td><td class="rd-doc">${doc.kind ? escapeHtml(doc.kind) : ''}${doc.code ? `<b>${escapeHtml(doc.code)}</b>` : ''}</td></tr></table>`
  const demo = branding?.demo ? `<p class="rd-demo">${escapeHtml(demoMark)}</p>` : ''
  let main
  if (doc.body != null) main = doc.body
  else {
    let n = 0
    const sections = (doc.sections || [])
      .filter(Boolean)
      .map(section => sectionHtml(section, section.title && doc.numbered !== false ? ++n : 0, en))
      .join('')
    main = `<h1 class="rd-title">${escapeHtml(doc.title || '')}</h1>${doc.subtitle ? `<p class="rd-subtitle">${escapeHtml(doc.subtitle)}</p>` : ''}${factsHtml(doc.meta || [], doc.metaColumns || 2)}${sections}${signaturesHtml(doc.signatures || [], en)}`
  }
  const footerText = [
    doc.footer || [doc.code, doc.title].filter(Boolean).join(' · '),
    `${en ? 'Printed' : 'Εκτύπωση'} ${printedOn}`,
    branding?.demo ? demoMark : '',
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ')
  // Word ignores the page margin boxes: the footer line closes the document instead.
  const wordFooter = word ? `<p class="rd-word-footer">${footerText}</p>` : ''
  const wordPage = word
    ? `@page Section1{size:${doc.orientation === 'landscape' ? '841.9pt 595.3pt;mso-page-orientation:landscape' : '595.3pt 841.9pt'};margin:42pt 36pt 42pt 36pt}div.Section1{page:Section1}`
    : ''
  const width = doc.orientation === 'landscape' ? '297mm' : '210mm'
  const head = `<meta charset="utf-8"><title>${escapeHtml(reportFileName(doc, branding))}</title><style>${REPORT_CSS}:root{--rd-width:${width}}${word ? wordPage : pageCss(doc, branding, printedOn, en)}</style>`
  const html = word
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="${en ? 'en' : 'el'}"><head>${head}</head><body><div class="Section1">${band}${demo}${main}${wordFooter}</div></body></html>`
    : `<!doctype html><html lang="${en ? 'en' : 'el'}"><head>${head}</head><body><div class="rd-page ${doc.orientation === 'landscape' ? 'rd-landscape' : ''}">${band}${demo}${main}</div></body></html>`
  return html
}

// Opens the built page in a new window and prints it (the browser's «Save as
// PDF» keeps the text). Must run inside the click handler: popup blockers allow
// a window only there. Returns false when the window was blocked.
export function printReport(doc, options = {}) {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(buildReportHtml(doc, options))
  win.document.close()
  win.focus()
  // Images (the logo) load before the print dialog takes its snapshot.
  const go = () => {
    try {
      win.print()
    } catch {
      /* the window was closed */
    }
  }
  if (win.document.readyState === 'complete') setTimeout(go, 300)
  else win.addEventListener('load', () => setTimeout(go, 200), { once: true })
  return true
}

// The same document as a .doc file (HTML that Word opens).
export function downloadReportWord(doc, options = {}) {
  const html = buildReportHtml(doc, { ...options, word: true })
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportFileName(doc, options.branding === undefined ? getReportBranding() : options.branding)}.doc`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
