// The formatted text of a regulation is kept as HTML, so it is cleaned on the
// way in (paste, editing, import) and on the way out (reading): only the tags a
// regulation needs survive, with no styles, scripts or event attributes. Links
// keep only http(s) and mailto addresses.

const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h3', 'h4', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'blockquote', 'hr', 'sub', 'sup'])
const RENAME = { b: 'strong', i: 'em', h1: 'h3', h2: 'h3', h5: 'h4', h6: 'h4', div: 'p' }
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'head', 'title', 'meta', 'link', 'svg', 'math', 'img', 'video', 'audio', 'form', 'input', 'button', 'select', 'textarea'])
const CLASSES = new Set(['reg-fill', 'reg-note'])

function cleanNode(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.nodeValue)
  if (node.nodeType !== 1) return null
  const tag = node.tagName.toLowerCase()
  if (DROP_WITH_CONTENT.has(tag)) return null
  const name = RENAME[tag] || tag
  const children = [...node.childNodes].map(child => cleanNode(child, doc)).filter(Boolean)
  if (!ALLOWED.has(name)) { const fragment = doc.createDocumentFragment(); children.forEach(child => fragment.append(child)); return fragment }
  const element = doc.createElement(name)
  if (name === 'a') {
    const href = String(node.getAttribute('href') || '').trim()
    if (/^(https?:|mailto:)/i.test(href)) { element.setAttribute('href', href); element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer') }
  }
  if (name === 'p') { const kept = String(node.getAttribute('class') || '').split(/\s+/).filter(item => CLASSES.has(item)); if (kept.length) element.setAttribute('class', kept.join(' ')) }
  if ((name === 'td' || name === 'th')) for (const attribute of ['colspan', 'rowspan']) { const value = Number(node.getAttribute(attribute)); if (value > 1 && value < 50) element.setAttribute(attribute, String(value)) }
  children.forEach(child => element.append(child))
  return element
}

export function sanitizeHtml(html) {
  if (typeof DOMParser === 'undefined') return String(html || '').replace(/<[^>]+>/g, '')
  const doc = new DOMParser().parseFromString(`<body>${String(html || '')}</body>`, 'text/html')
  const out = doc.createElement('div')
  ;[...doc.body.childNodes].map(child => cleanNode(child, doc)).filter(Boolean).forEach(child => out.append(child))
  // Loose text and inline runs at the top level go into paragraphs.
  const blocks = new Set(['P', 'H3', 'H4', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE', 'HR'])
  let paragraph = null
  for (const child of [...out.childNodes]) {
    if (child.nodeType === 1 && blocks.has(child.tagName)) { paragraph = null; continue }
    if (child.nodeType === 3 && !child.nodeValue.trim() && !paragraph) { child.remove(); continue }
    if (!paragraph) { paragraph = doc.createElement('p'); out.insertBefore(paragraph, child) }
    paragraph.append(child)
  }
  for (const element of [...out.querySelectorAll('p,h3,h4,li')]) if (!element.textContent.trim() && !element.querySelector('br')) element.remove()
  return out.innerHTML
}
