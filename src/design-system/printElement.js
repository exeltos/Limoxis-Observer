// Prints one part of the screen (a report inside a dialog) on its own: the
// element is copied, with the app's stylesheets, into a new window that prints
// itself. Printing the app page would carry the page behind the dialog along.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// `heading` lines go above the copy: what the printed page is and whom it concerns.
export function printElement(element, { title = document.title, heading = [] } = {}) {
  if (!element) return false
  const win = window.open('', '_blank')
  if (!win) return false
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(node => node.outerHTML).join('')
  const head = heading.filter(Boolean).length
    ? `<header style="margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #cbd8e3;font-family:Arial,sans-serif;color:#17324a">${heading.filter(Boolean).map((line, i) => (i ? `<div style="font-size:12px;color:#5d7083">${esc(line)}</div>` : `<h1 style="font-size:18px;margin:0 0 4px">${esc(line)}</h1>`)).join('')}</header>`
    : ''
  win.document.open()
  win.document.write(
    `<!doctype html><html lang="${esc(document.documentElement.lang || 'el')}"><head><meta charset="utf-8"><base href="${esc(document.baseURI)}"><title>${esc(title)}</title>${styles}<style>html,body{height:auto;overflow:visible;background:#fff}body{margin:0;padding:18px}@media print{body{padding:0}}</style></head><body>${head}${element.outerHTML}</body></html>`,
  )
  win.document.close()
  win.focus()
  // The copied stylesheets load before the print dialog takes its snapshot.
  setTimeout(() => win.print(), 400)
  return true
}
