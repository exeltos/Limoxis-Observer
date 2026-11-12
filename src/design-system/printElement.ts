import { DEMO_REPORT_MARK_EL, DEMO_REPORT_MARK_EN, getReportBranding } from '../core/organization/branding'
import { formatDateTime } from '../core/i18n/formatDay'
import type { ReportBranding } from './types'
// Prints one part of the screen (a report inside a dialog) on its own: the
// element is copied, with the app's stylesheets, into a new window that prints
// itself. Printing the app page would carry the page behind the dialog along.
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c])

// The hospital band of the printed documents (reportDocument): logo, hospital, report header line, the date printed and,
// in a Demo, the demo mark — so a printed screen carries the same identity as every other report (owner, 2/11/2026).
export function brandBandHtml(branding: ReportBranding | null = getReportBranding(), { language = 'el', now = new Date() }: { language?: string; now?: Date } = {}) {
  if (!branding || !(branding.name || branding.logo || branding.reportHeader)) return ''
  const en = language === 'en'
  const printed = `${en ? 'Printed' : 'Εκτύπωση'} ${formatDateTime(now.toISOString(), language)}`
  const logo = branding.logo ? `<td style="width:1%;padding-right:12px;vertical-align:middle"><img src="${esc(branding.logo)}" alt="" style="max-height:46px;max-width:150px;display:block"></td>` : ''
  const org = `<td style="vertical-align:middle"><strong style="display:block;font-size:14px;color:#17324a">${esc(branding.name || '')}</strong>${branding.reportHeader ? `<span style="display:block;font-size:11px;color:#5d7083">${esc(branding.reportHeader)}</span>` : ''}</td>`
  const date = `<td style="text-align:right;vertical-align:middle;font-size:10.5px;color:#5d7083;white-space:nowrap">${esc(printed)}</td>`
  const demo = branding.demo ? `<p style="margin:6px 0 0;font-size:10.5px;font-weight:700;color:#8a5a00">${esc(en ? DEMO_REPORT_MARK_EN : DEMO_REPORT_MARK_EL)}</p>` : ''
  return `<div class="print-brand-band" style="margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid #1d3a52;font-family:Arial,sans-serif"><table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse"><tr>${logo}${org}${date}</tr></table>${demo}</div>`
}

// `heading` lines go above the copy: what the printed page is and whom it concerns.
interface PrintElementOptions {
  title?: string
  // The lines above the copy: what the page is, then whom it concerns.
  heading?: Array<string | null | false | undefined>
  branding?: ReportBranding | null
}

export function printElement(element: Element | null | undefined, { title = document.title, heading = [], branding = getReportBranding() }: PrintElementOptions = {}) {
  if (!element) return false
  const win = window.open('', '_blank')
  if (!win) return false
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(node => node.outerHTML).join('')
  const band = brandBandHtml(branding, { language: document.documentElement.lang === 'en' ? 'en' : 'el' })
  const head = heading.filter(Boolean).length
    ? `<header style="margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #cbd8e3;font-family:Arial,sans-serif;color:#17324a">${heading.filter(Boolean).map((line, i) => (i ? `<div style="font-size:12px;color:#5d7083">${esc(line)}</div>` : `<h1 style="font-size:18px;margin:0 0 4px">${esc(line)}</h1>`)).join('')}</header>`
    : ''
  win.document.open()
  win.document.write(
    `<!doctype html><html lang="${esc(document.documentElement.lang || 'el')}"><head><meta charset="utf-8"><base href="${esc(document.baseURI)}"><title>${esc(title)}</title>${styles}<style>html,body{height:auto;overflow:visible;background:#fff}body{margin:0;padding:18px}@media print{body{padding:0}}</style></head><body>${band}${head}${element.outerHTML}</body></html>`,
  )
  win.document.close()
  win.focus()
  // The copied stylesheets load before the print dialog takes its snapshot.
  setTimeout(() => win.print(), 400)
  return true
}
