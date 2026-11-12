// Regulations: a hospital's controlled regulations, kept as chapters and
// sections of formatted text, written from the platform's templates and read
// as a book. Content is { chapters: [{ id, title, sections: [{ id, origin,
// title, html }] }] }; `origin` names the template section a section came from,
// so a new template version can be compared section by section.

export const REGULATION_CATEGORIES = [
  { value: 'infection', label: ['Πρόληψη λοιμώξεων', 'Infection prevention'] },
  { value: 'waste', label: ['Διαχείριση αποβλήτων', 'Waste management'] },
  { value: 'safety', label: ['Ασφάλεια', 'Safety'] },
  { value: 'food', label: ['Υγιεινή τροφίμων', 'Food hygiene'] },
  { value: 'other', label: ['Άλλο', 'Other'] },
]
export const categoryLabel = (value, language) => (REGULATION_CATEGORIES.find(item => item.value === value) || REGULATION_CATEGORIES.at(-1)).label[language === 'en' ? 1 : 0]

export const REGULATION_STATUSES = [
  { value: 'draft', label: ['Σε σύνταξη', 'Being written'], tone: 'neutral' },
  { value: 'approved', label: ['Σε ισχύ', 'In force'], tone: 'success' },
  { value: 'revision', label: ['Σε ισχύ · αναθεώρηση', 'In force · revising'], tone: 'info' },
  { value: 'archived', label: ['Αρχειοθετημένος', 'Archived'], tone: 'neutral' },
]
export const statusLabel = (value, language) => REGULATION_STATUSES.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || ''
export const statusTone = value => REGULATION_STATUSES.find(item => item.value === value)?.tone || 'neutral'

// Where a regulation stands: never approved, in force, in force with a revision being written, or archived.
export function regulationStatus(regulation) {
  if (regulation?.archived) return 'archived'
  if (!regulation?.edition) return 'draft'
  return regulation.hasDraft ? 'revision' : 'approved'
}

export const newId = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export const emptyContent = () => ({ chapters: [] })
export const chaptersOf = content => (Array.isArray(content?.chapters) ? content.chapters : [])

// A hospital's own copy of a template: {hospital} becomes its name, and every
// section keeps the template section it came from.
export function contentFromTemplate(template, { hospital = '' } = {}) {
  const name = escapeText(hospital || 'το νοσοκομείο')
  return {
    chapters: chaptersOf(template?.content).map(chapter => ({
      id: chapter.id, title: chapter.title.replaceAll('{hospital}', hospital || 'το νοσοκομείο'),
      sections: chapter.sections.map(section => ({ id: section.id, origin: section.id, title: section.title.replaceAll('{hospital}', hospital || 'το νοσοκομείο'), html: String(section.html || '').replaceAll('{hospital}', name) })),
    })),
  }
}

// REG-01, REG-02… within the hospital.
export function nextRegulationCode(codes = []) {
  const numbers = codes.map(code => Number(String(code || '').match(/^REG-(\d+)$/)?.[1] || 0))
  return `REG-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
}

// The text of formatted content, for search and counting.
export const plainText = html => String(html || '').replace(/<(br|\/p|\/li|\/h\d|\/tr)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()

export function contentStats(content) {
  const chapters = chaptersOf(content)
  const sections = chapters.flatMap(chapter => chapter.sections || [])
  const words = sections.reduce((sum, section) => sum + plainText(section.html).split(' ').filter(Boolean).length, 0)
  return { chapters: chapters.length, sections: sections.length, words }
}

// Sections whose title or text holds every word of the query, with a short excerpt around the first.
export function searchContent(content, query) {
  const words = String(query || '').toLocaleLowerCase('el').normalize('NFD').replace(/\p{M}/gu, '').split(/\s+/).filter(word => word.length > 1)
  if (!words.length) return []
  const fold = text => text.toLocaleLowerCase('el').normalize('NFD').replace(/\p{M}/gu, '')
  const hits = []
  chaptersOf(content).forEach((chapter, chapterIndex) => (chapter.sections || []).forEach((section, sectionIndex) => {
    const text = plainText(section.html)
    const haystack = fold(`${section.title} ${text}`)
    if (!words.every(word => haystack.includes(word))) return
    const at = Math.max(0, fold(text).indexOf(words[0]))
    const start = Math.max(0, at - 50)
    hits.push({ chapterIndex, sectionIndex, chapter: chapter.title, title: section.title, excerpt: `${start ? '…' : ''}${text.slice(start, start + 150)}${start + 150 < text.length ? '…' : ''}` })
  }))
  return hits
}

const sectionsByOrigin = content => {
  const map = new Map()
  chaptersOf(content).forEach(chapter => (chapter.sections || []).forEach(section => map.set(section.origin || section.id, { ...section, chapterId: chapter.id, chapterTitle: chapter.title })))
  return map
}
const sameText = (a, b) => plainText(a) === plainText(b)

// What a new template version changed since the version the regulation follows:
// new sections, sections whose text changed and sections the template removed,
// each with the hospital's own section beside it. Without the earlier version
// the template is compared with the regulation itself.
export function templateChanges({ base, latest, current }) {
  const before = base ? sectionsByOrigin(base) : null
  const after = sectionsByOrigin(latest)
  const own = sectionsByOrigin(current)
  const changes = []
  for (const [origin, section] of after) {
    const old = before?.get(origin)
    const mine = own.get(origin)
    if (before ? !old : !mine) changes.push({ origin, kind: 'new', title: section.title, chapterId: section.chapterId, chapterTitle: section.chapterTitle, templateHtml: section.html, currentHtml: mine?.html || '' })
    else if (before ? !sameText(old.html, section.html) || old.title !== section.title : !sameText(mine.html, section.html)) changes.push({ origin, kind: 'changed', title: section.title, chapterId: section.chapterId, chapterTitle: section.chapterTitle, templateHtml: section.html, previousHtml: old?.html || '', currentHtml: mine?.html || '' })
  }
  if (before) for (const [origin, section] of before) if (!after.has(origin)) changes.push({ origin, kind: 'removed', title: section.title, chapterId: section.chapterId, chapterTitle: section.chapterTitle, templateHtml: '', previousHtml: section.html, currentHtml: own.get(origin)?.html || '' })
  return changes
}

// Takes one template section into a draft: replaces the hospital's section that
// came from it, or adds it to its chapter (making the chapter if needed).
export function takeTemplateSection(draft, latest, origin, { hospital = '' } = {}) {
  const source = sectionsByOrigin(contentFromTemplate({ content: latest }, { hospital })).get(origin)
  if (!source) return draft
  const chapters = structuredClone(chaptersOf(draft))
  for (const chapter of chapters) {
    const index = chapter.sections.findIndex(section => (section.origin || section.id) === origin)
    if (index >= 0) { chapter.sections[index] = { ...chapter.sections[index], title: source.title, html: source.html }; return { ...draft, chapters } }
  }
  let target = chapters.find(chapter => chapter.id === source.chapterId)
  if (!target) {
    const templateOrder = chaptersOf(latest).map(chapter => chapter.id)
    target = { id: source.chapterId, title: source.chapterTitle, sections: [] }
    const after = templateOrder.indexOf(source.chapterId)
    const insertAt = chapters.findIndex(chapter => templateOrder.indexOf(chapter.id) > after)
    chapters.splice(insertAt < 0 ? chapters.length : insertAt, 0, target)
  }
  target.sections.push({ id: newId('sec'), origin, title: source.title, html: source.html })
  return { ...draft, chapters }
}

// What a regulation needs before it can be approved.
export function regulationProblems(regulation, content, language = 'el') {
  const en = language === 'en', problems = []
  if (!String(regulation?.title || '').trim()) problems.push(en ? 'A title' : 'Τίτλος')
  const chapters = chaptersOf(content)
  if (!chapters.some(chapter => chapter.sections?.length)) problems.push(en ? 'At least one section' : 'Τουλάχιστον μία ενότητα')
  if (chapters.some(chapter => !String(chapter.title || '').trim())) problems.push(en ? 'Every chapter needs a title' : 'Κάθε κεφάλαιο θέλει τίτλο')
  const unfilled = fillItems(content).length
  if (unfilled) problems.push(en ? `${unfilled} points still to fill in` : `${unfilled} σημεία ακόμη προς συμπλήρωση`)
  return problems
}

// The regulation of the earlier tool: chapters of sections of paragraphs and
// list items, made into formatted text (consecutive items form one list).
export function contentFromBlocks(chapters = []) {
  return {
    chapters: chapters.map((chapter, chapterIndex) => ({
      id: `ch-${chapterIndex + 1}`, title: String(chapter.title || '').trim(),
      sections: (chapter.sections || []).map((section, sectionIndex) => {
        let html = '', list = []
        const flush = () => { if (list.length) { html += `<ul>${list.map(item => `<li>${escapeText(item)}</li>`).join('')}</ul>`; list = [] } }
        for (const block of section.blocks || []) {
          const text = String(block.text || '').trim()
          if (!text) continue
          if (block.type === 'list') list.push(text)
          else { flush(); html += `<p>${escapeText(text)}</p>` }
        }
        flush()
        return { id: `sec-${chapterIndex + 1}-${sectionIndex + 1}`, origin: null, title: String(section.title || '').trim() || 'Γενικά', html }
      }),
    })),
  }
}

// --- Filling in ---------------------------------------------------------------------

// Every «Fill in» note of a draft, in reading order: what it asks, where it is.
const FILL = /<p class="reg-fill">([\s\S]*?)<\/p>/g
export function fillItems(content) {
  const items = []
  chaptersOf(content).forEach((chapter, chapterIndex) => (chapter.sections || []).forEach((section, sectionIndex) => {
    let nth = 0
    for (const match of String(section.html || '').matchAll(FILL)) {
      items.push({ key: `${section.id}:${nth}`, sectionId: section.id, nth, chapterIndex, sectionIndex, chapter: chapter.title, section: section.title, prompt: plainText(match[1]).replace(/^(Συμπληρώστε|Fill in)\s*:\s*/i, '') })
      nth += 1
    }
  }))
  return items
}

// Plain text as regulation text: blank lines part paragraphs, lines starting
// with «-» or «•» make a list.
export function textToHtml(text) {
  return String(text || '').trim().split(/\n\s*\n/).map(part => {
    const lines = part.split('\n').map(line => line.trim()).filter(Boolean)
    if (lines.length && lines.every(line => /^[-•*]\s*/.test(line))) return `<ul>${lines.map(line => `<li>${escapeText(line.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`
    return `<p>${lines.map(escapeText).join('<br>')}</p>`
  }).filter(html => html !== '<p></p>').join('')
}

// Puts the hospital's text in place of one «Fill in» note.
export function applyFill(content, item, text) {
  const html = textToHtml(text)
  if (!html) return content
  return {
    ...content,
    chapters: chaptersOf(content).map(chapter => ({
      ...chapter,
      sections: (chapter.sections || []).map(section => {
        if (section.id !== item.sectionId) return section
        let nth = -1
        return { ...section, html: String(section.html || '').replace(FILL, match => { nth += 1; return nth === item.nth ? html : match }) }
      }),
    })),
  }
}

// --- Signatures ---------------------------------------------------------------------

// An edition is approved with two signatures, each for the text as it stands.
export const SIGNING_ROLES = [
  { value: 'administrator', label: ['Διαχειριστής Νοσοκομείου', 'Hospital administrator'], appRole: 'hospital_admin' },
  { value: 'infection_lead', label: ['Υπεύθυνος Ελέγχου Λοιμώξεων', 'Infection control lead'], appRole: 'infection_control_lead' },
]
export const signingRoleLabel = (value, language) => SIGNING_ROLES.find(item => item.value === value)?.label[language === 'en' ? 1 : 0] || ''

// The latest signature of each role given for this revision of the draft.
export function validSignatures(signatures = [], revision) {
  return SIGNING_ROLES.map(role => [...signatures].filter(item => item.role === role.value && (revision == null || item.revision === revision)).sort((a, b) => String(b.signedAt).localeCompare(String(a.signedAt)))[0]).filter(Boolean)
}

// Signatures given for an earlier text: the role needs to sign again.
export function staleSignatures(signatures = [], revision) {
  const valid = new Set(validSignatures(signatures, revision).map(item => item.role))
  return SIGNING_ROLES.map(role => role.value).filter(role => !valid.has(role) && signatures.some(item => item.role === role))
}
