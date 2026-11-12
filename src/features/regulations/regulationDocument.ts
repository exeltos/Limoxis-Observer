import { chaptersOf } from './regulationModel'
import { sanitizeHtml } from './regulationHtml'

// The regulation as one document, for printing and for Word: the page of the
// controlled document, the contents, then every chapter on a new page.

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function regulationDocumentHtml(content, meta) {
  const chapters = chaptersOf(content)
  const rows = [
    ['Τίτλος', meta.title], ['Φορέας', meta.organization], ['Κωδικός', meta.code], ['Έκδοση', [meta.edition, meta.issued].filter(Boolean).join(' · ')],
    ['Έγκριση', meta.approvedBy], ['Κατάσταση', meta.status], ['Πρότυπο', meta.template],
  ].filter(([, value]) => value)
  const contents = chapters.map((chapter, index) => `<li><b>${index + 1}. ${esc(chapter.title)}</b>${chapter.sections?.length ? `<ul>${chapter.sections.map(section => `<li>${esc(section.title)}</li>`).join('')}</ul>` : ''}</li>`).join('')
  const body = chapters.map((chapter, index) => `<section class="reg-print-chapter"><p class="reg-print-kicker">ΚΕΦΑΛΑΙΟ ${index + 1}</p><h1>${esc(chapter.title)}</h1>${(chapter.sections || []).map(section => `<h2>${esc(section.title)}</h2>${sanitizeHtml(section.html)}`).join('')}</section>`).join('')
  return `<div class="reg-print">
<section class="reg-print-cover"><p class="reg-print-kicker">${esc(meta.organization)}</p><h1>${esc(meta.title)}</h1><table>${rows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')}</table>
${meta.signatures?.length ? `<table class="reg-print-signatures"><tr>${meta.signatures.map(slot => `<td><small>${esc(slot.label)}</small><div class="reg-print-ink">${slot.image && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(slot.image) ? `<img src="${slot.image}" alt="" height="60">` : ''}</div><b>${esc(slot.name || '……………………………')}</b>${slot.title ? `<br>${esc(slot.title)}` : ''}${slot.date ? `<br>${esc(slot.date)}` : ''}</td>`).join('')}</tr></table>` : ''}
<p class="reg-print-note">${meta.draft ? 'Προσχέδιο για έλεγχο: δεν έχει ακόμη ισχύ.' : 'Η ηλεκτρονική έκδοση είναι το ελεγχόμενο αντίγραφο· το έντυπο αυτό είναι μη ελεγχόμενο αντίγραφο.'}</p></section>
<section class="reg-print-contents"><h1>Περιεχόμενα</h1><ol>${contents}</ol></section>
${body}</div>`
}

export function downloadRegulationWord(content, meta) {
  const html = `<html><head><meta charset="utf-8"><title>${esc(meta.title)}</title><style>body{font-family:Calibri,Arial;font-size:11pt;line-height:1.4}h1{font-size:17pt;color:#14324a}h2{font-size:13pt;color:#1f5a80;margin-top:14pt;border-bottom:1px solid #1f5a80}h3{font-size:11.5pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #b9c6d0;padding:4pt;vertical-align:top}.reg-print-kicker{font-size:8pt;letter-spacing:1pt;color:#6b8193}.reg-print-chapter{page-break-before:always}.reg-fill{background:#fff7dc;font-style:italic}.reg-note{background:#eef5fa}</style></head><body>${regulationDocumentHtml(content, meta)}</body></html>`
  const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${meta.code || 'Kanonismos'}${meta.edition ? `_ekdosi_${meta.edition}` : '_prosxedio'}.doc`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
