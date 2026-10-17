import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Search, X, ZoomIn, ZoomOut } from 'lucide-react'
import { chaptersOf, searchContent } from './regulationModel'
import { sanitizeHtml } from './regulationHtml'

// A regulation read as a book: a cover, the page of the controlled document,
// the contents with page numbers, then the chapters laid out on real pages. The
// text is measured into pages (never cut); a page turns like paper. On a narrow
// screen one page shows at a time. The contents beside the book find a chapter,
// a section or any word.

// A printed page (560 × 792, shown scaled) on a computer or a tablet; on a
// phone the page takes the screen's width and the text keeps a reading size.
const BOOK = { pageW: 560, pageH: 792, padX: 52, top: 64, bottom: 58, phone: false }
const TURN_MS = 720

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const keyOf = (chapterIndex, sectionIndex) => `${chapterIndex}:${sectionIndex}`
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Splits the chapters into pages by measuring them in a page-sized box. Each
// chapter starts a page; a heading never ends one; a list or a table that does
// not fit goes on item by item; a single block taller than a page keeps its own.
function paginate(measure, chapters, labels, geo) {
  const BODY_H = geo.pageH - geo.top - geo.bottom
  const pages = []
  let nodes = []
  let chapterIndex = 0
  const fits = () => measure.scrollHeight <= BODY_H + 1
  const isHeading = node => /^H[1-4]$/.test(node.tagName) || node.classList?.contains('reg-chapter-kicker')
  const flush = () => { if (nodes.length) pages.push({ chapterIndex, html: nodes.map(node => node.outerHTML).join('') }); nodes = []; measure.innerHTML = '' }
  const place = node => { measure.append(node); nodes.push(node) }
  const tryPlace = node => { measure.append(node); if (fits()) { nodes.push(node); return true } node.remove(); return false }
  // A new page, taking along the headings the old one ended with.
  const newPage = () => {
    const carried = []
    while (nodes.length && isHeading(nodes.at(-1))) carried.unshift(nodes.pop())
    if (!nodes.length) { nodes = carried; return }
    flush()
    carried.forEach(place)
  }
  const split = (node, rowsOf, shellOf) => {
    let count = 0
    let part = shellOf(count)
    place(part)
    for (const row of rowsOf(node)) {
      const holder = part.tagName === 'TABLE' ? part.querySelector('tbody') : part
      holder.append(row)
      if (fits()) { count += 1; continue }
      row.remove()
      if (!holder.children.length) { part.remove(); nodes.pop() }
      newPage()
      part = shellOf(count)
      place(part)
      ;(part.tagName === 'TABLE' ? part.querySelector('tbody') : part).append(row)
      count += 1
    }
  }
  const add = node => {
    if (tryPlace(node)) return
    if (/^(UL|OL)$/.test(node.tagName) && node.children.length > 1) {
      return split(node, list => [...list.children], count => { const shell = node.cloneNode(false); if (node.tagName === 'OL' && count) shell.setAttribute('start', String(Number(node.getAttribute('start') || 1) + count)); return shell })
    }
    if (node.tagName === 'TABLE' && node.querySelectorAll('tr').length > 2) {
      const head = node.querySelector('thead')
      return split(node, table => [...table.querySelectorAll('tbody > tr, :scope > tr')], () => { const shell = node.cloneNode(false); if (head) shell.append(head.cloneNode(true)); shell.append(document.createElement('tbody')); return shell })
    }
    if (nodes.length && !nodes.every(isHeading)) { newPage(); if (tryPlace(node)) return }
    place(node)
  }
  chapters.forEach((chapter, index) => {
    chapterIndex = index
    const kicker = document.createElement('div'); kicker.className = 'reg-chapter-kicker'; kicker.textContent = `${labels.chapter} ${index + 1}`
    const title = document.createElement('h1'); title.textContent = chapter.title || ''
    add(kicker); add(title)
    ;(chapter.sections || []).forEach((section, sectionIndex) => {
      const heading = document.createElement('h2'); heading.textContent = section.title || ''; heading.dataset.sec = keyOf(index, sectionIndex)
      add(heading)
      const holder = document.createElement('div')
      holder.innerHTML = sanitizeHtml(section.html)
      for (const child of [...holder.children]) add(child)
    })
    flush()
  })
  measure.innerHTML = ''
  // Where each section begins: the page that holds its heading.
  const sectionPage = new Map()
  pages.forEach((page, index) => { for (const match of page.html.matchAll(/data-sec="(\d+:\d+)"/g)) if (!sectionPage.has(match[1])) sectionPage.set(match[1], index) })
  return { pages, sectionPage }
}

export function RegulationBook({ content, meta, language = 'el', initialSection = null }) {
  const en = language === 'en'
  const labels = useMemo(() => ({ chapter: en ? 'CHAPTER' : 'ΚΕΦΑΛΑΙΟ' }), [en])
  const chapters = useMemo(() => chaptersOf(content), [content])
  const measure = useRef(null)
  const stage = useRef(null)
  const root = useRef(null)
  const [layout, setLayout] = useState({ pages: [], sectionPage: new Map() })
  const [geo, setGeo] = useState(BOOK)
  const [narrow, setNarrow] = useState(false)
  const [scale, setScale] = useState(1)
  const [docked, setDocked] = useState(true)
  const [zoom, setZoom] = useState('fit')
  const [at, setAt] = useState(0)
  const [turn, setTurn] = useState(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(() => new Set([0]))
  const [tocOpen, setTocOpen] = useState(false)

  // Measures the chapters into pages (again once the fonts have loaded, and when the page size changes).
  useLayoutEffect(() => {
    if (!measure.current) return undefined
    let alive = true
    const run = () => { if (alive && measure.current) setLayout(paginate(measure.current, chapters, labels, geo)) }
    run()
    document.fonts?.ready?.then(run)
    return () => { alive = false }
  }, [chapters, labels, geo])

  // Front matter: cover, document page, contents (as many pages as it needs).
  const tocPerPage = geo.phone ? Math.max(10, Math.floor((geo.pageH - geo.top - geo.bottom - 60) / 30)) : 26
  const tocEntries = useMemo(() => chapters.flatMap((chapter, chapterIndex) => [{ level: 1, chapterIndex, title: chapter.title }, ...(chapter.sections || []).map((section, sectionIndex) => ({ level: 2, chapterIndex, sectionIndex, title: section.title }))]), [chapters])
  const tocPages = Math.max(1, Math.ceil(tocEntries.length / tocPerPage))
  const front = 2 + tocPages
  const total = front + layout.pages.length
  const pageOfSection = useCallback((chapterIndex, sectionIndex) => front + (layout.sectionPage.get(keyOf(chapterIndex, sectionIndex)) ?? layout.pages.findIndex(page => page.chapterIndex === chapterIndex)), [front, layout])

  // Fits the book to the space it has: two pages when there is room, one page
  // (scaled) on a tablet, a screen-wide page on a phone. The contents dock
  // beside the book only on a wide screen.
  useEffect(() => {
    if (!stage.current) return undefined
    const fit = () => {
      const readerWidth = root.current?.clientWidth || 0
      setDocked(readerWidth >= 1380)
      const width = stage.current?.clientWidth || 0
      const top = stage.current?.getBoundingClientRect().top || 0
      const height = Math.max(420, (window.innerHeight || 900) - top - 78)
      if (width < 700) {
        const pageW = Math.round(Math.max(300, width - 8) / 10) * 10
        const pageH = Math.round(Math.min(Math.max(480, height), pageW * 1.75) / 10) * 10
        setGeo(current => (current.phone && current.pageW === pageW && current.pageH === pageH ? current : { pageW, pageH, padX: 22, top: 44, bottom: 40, phone: true }))
        setNarrow(true)
        setScale(1)
        return
      }
      setGeo(current => (current.phone ? BOOK : current))
      const single = width < 1000
      setNarrow(single)
      const byWidth = (width - 24) / (single ? BOOK.pageW : BOOK.pageW * 2)
      setScale(zoom === 'width' ? Math.min(1.25, byWidth) : Math.min(1.15, byWidth, height / BOOK.pageH))
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(stage.current)
    if (root.current) observer?.observe(root.current)
    window.addEventListener('resize', fit)
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit) }
  }, [zoom])

  // In a spread the cover stands alone on the right; then pages go in pairs.
  const spreadOf = page => (page <= 0 ? 0 : Math.ceil(page / 2) * 2 - 1)
  const view = narrow ? { left: null, right: at } : (() => { const start = spreadOf(at); return start === 0 ? { left: -1, right: 0 } : { left: start, right: start + 1 } })()
  const step = narrow ? 1 : 2

  const go = useCallback((target, animate = true) => {
    if (turn) return
    const clamp = Math.max(0, Math.min(total - 1, target))
    const from = narrow ? at : spreadOf(at)
    const to = narrow ? clamp : spreadOf(clamp)
    if (to === from) { setAt(clamp); return }
    if (!animate || reducedMotion() || Math.abs(to - from) > step) { setAt(clamp); return }
    setTurn({ dir: to > from ? 1 : -1, from, to, target: clamp })
  }, [turn, total, narrow, at, step])
  useEffect(() => {
    if (!turn) return undefined
    const timer = setTimeout(() => { setAt(turn.target); setTurn(null) }, TURN_MS)
    return () => clearTimeout(timer)
  }, [turn])
  const next = useCallback(() => go((narrow ? at : spreadOf(at)) + (narrow ? 1 : (spreadOf(at) === 0 ? 1 : 2))), [go, narrow, at])
  const previous = useCallback(() => go(narrow ? at - 1 : spreadOf(at) - (spreadOf(at) <= 1 ? 1 : 2)), [go, narrow, at])

  useEffect(() => {
    const onKey = event => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); next() }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); previous() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, previous])

  // Opens at a section when asked (a link from elsewhere, a search result).
  useEffect(() => {
    if (!initialSection || !layout.pages.length) return
    setAt(pageOfSection(initialSection.chapterIndex, initialSection.sectionIndex))
  }, [initialSection, layout, pageOfSection])

  // A swipe turns the page on a touch screen.
  const touch = useRef(null)
  const onPointerDown = event => { touch.current = { x: event.clientX, y: event.clientY } }
  const onPointerUp = event => {
    const start = touch.current; touch.current = null
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next : previous)()
  }

  const current = view.right >= 0 ? view.right : 0
  const activeChapter = current >= front ? layout.pages[current - front]?.chapterIndex : null
  const results = useMemo(() => searchContent(content, query), [content, query])

  const pageNode = (index, side) => <Page key={`${side}-${index}`} index={index} side={side} front={front} total={total} meta={meta} en={en} tocEntries={tocEntries} tocPerPage={tocPerPage} pageOfSection={pageOfSection} layout={layout} chapters={chapters} onJump={page => go(page, false)} />

  // During a turn the pages underneath are those of the next view; the leaf carries the turning page.
  let leftIndex = view.left, rightIndex = view.right, leaf = null
  if (turn) {
    if (narrow) {
      if (turn.dir > 0) { rightIndex = turn.to; leaf = { side: 'single next', front: turn.from, back: null } }
      else { rightIndex = turn.from; leaf = { side: 'single prev', front: turn.to, back: null } }
    } else {
      const toView = turn.to === 0 ? { left: -1, right: 0 } : { left: turn.to, right: turn.to + 1 }
      const fromView = turn.from === 0 ? { left: -1, right: 0 } : { left: turn.from, right: turn.from + 1 }
      if (turn.dir > 0) { leftIndex = fromView.left; rightIndex = toView.right; leaf = { side: 'next', front: fromView.right, back: toView.left } }
      else { leftIndex = toView.left; rightIndex = fromView.right; leaf = { side: 'prev', front: fromView.left, back: toView.right } }
    }
  }

  const label = narrow ? (current === 0 ? (en ? 'Cover' : 'Εξώφυλλο') : `${current + 1} / ${total}`) : (view.right === 0 ? (en ? 'Cover' : 'Εξώφυλλο') : `${view.left + 1}–${Math.min(total, view.right + 1)} / ${total}`)

  return <div ref={root} className={`reg-reader ${docked ? 'is-docked' : 'is-drawer'} ${tocOpen ? 'toc-open' : ''} ${geo.phone ? 'is-phone' : ''}`} style={{ '--reg-pad-x': `${geo.padX}px`, '--reg-pad-top': `${geo.top}px`, '--reg-pad-bottom': `${geo.bottom}px` }}>
    {!docked && tocOpen && <button type="button" className="reg-toc-backdrop" aria-label={en ? 'Close the contents' : 'Κλείσιμο περιεχομένων'} onClick={() => setTocOpen(false)} />}
    <aside className="reg-toc" aria-label={en ? 'Contents' : 'Περιεχόμενα'}>
      <div className="reg-toc-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? 'Search the regulation…' : 'Αναζήτηση στον κανονισμό…'} aria-label={en ? 'Search' : 'Αναζήτηση'} />{query && <button type="button" onClick={() => setQuery('')} aria-label={en ? 'Clear' : 'Καθαρισμός'}><X size={14} /></button>}</div>
      {query.trim().length > 1 ? <div className="reg-toc-results">
        <small>{results.length ? (en ? `${results.length} sections` : `${results.length} ενότητες`) : (en ? 'Nothing found' : 'Δεν βρέθηκε τίποτα')}</small>
        {results.slice(0, 60).map(hit => <button type="button" key={keyOf(hit.chapterIndex, hit.sectionIndex)} onClick={() => { go(pageOfSection(hit.chapterIndex, hit.sectionIndex), false); setTocOpen(false) }}>
          <strong>{hit.title}</strong><span>{hit.excerpt}</span><em>{(en ? 'p. ' : 'σ. ') + (pageOfSection(hit.chapterIndex, hit.sectionIndex) + 1)}</em>
        </button>)}
      </div> : <nav className="reg-toc-list">
        <button type="button" className={`reg-toc-cover ${current < front ? 'active' : ''}`} onClick={() => { go(0, false); setTocOpen(false) }}><BookOpen size={14} />{en ? 'Cover and contents' : 'Εξώφυλλο και περιεχόμενα'}</button>
        {chapters.map((chapter, chapterIndex) => <div key={chapter.id || chapterIndex} className={`reg-toc-chapter ${activeChapter === chapterIndex ? 'active' : ''}`}>
          <button type="button" className="reg-toc-chapter-title" aria-expanded={open.has(chapterIndex)} onClick={() => { setOpen(set => { const copy = new Set(set); copy.has(chapterIndex) ? copy.delete(chapterIndex) : copy.add(chapterIndex); return copy }); go(pageOfSection(chapterIndex, 0), false) }}>
            <span>{String(chapterIndex + 1).padStart(2, '0')}</span><strong>{chapter.title}</strong><ChevronDown size={14} />
          </button>
          {open.has(chapterIndex) && <div className="reg-toc-sections">{(chapter.sections || []).map((section, sectionIndex) => <button type="button" key={section.id || sectionIndex} onClick={() => { go(pageOfSection(chapterIndex, sectionIndex), false); setTocOpen(false) }}><span>{section.title}</span><em>{pageOfSection(chapterIndex, sectionIndex) + 1}</em></button>)}</div>}
        </div>)}
      </nav>}
    </aside>
    <div className="reg-stage" ref={stage}>
      <div className="reg-stage-bar">
        <button type="button" className="reg-toc-toggle" onClick={() => setTocOpen(value => !value)}><BookOpen size={15} />{en ? 'Contents' : 'Περιεχόμενα'}</button>
        <div className="reg-pager">
          <button type="button" onClick={previous} disabled={current <= 0 || Boolean(turn)} aria-label={en ? 'Previous page' : 'Προηγούμενη σελίδα'}><ChevronLeft size={18} /></button>
          <span>{label}</span>
          <button type="button" onClick={next} disabled={(narrow ? current : view.right) >= total - 1 || Boolean(turn)} aria-label={en ? 'Next page' : 'Επόμενη σελίδα'}><ChevronRight size={18} /></button>
        </div>
        {!geo.phone && <button type="button" className="reg-zoom" onClick={() => setZoom(value => (value === 'fit' ? 'width' : 'fit'))} title={zoom === 'fit' ? (en ? 'Larger text' : 'Μεγαλύτερα γράμματα') : (en ? 'Whole page' : 'Ολόκληρη η σελίδα')}>{zoom === 'fit' ? <ZoomIn size={15} /> : <ZoomOut size={15} />}{zoom === 'fit' ? (en ? 'Zoom' : 'Μεγέθυνση') : (en ? 'Fit' : 'Ολόκληρη')}</button>}
      </div>
      <div className="reg-book-frame" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <div className="reg-book-sizer" style={{ width: (narrow ? geo.pageW : geo.pageW * 2) * scale, height: geo.pageH * scale }}>
        <div className={`reg-book ${narrow ? 'is-single' : ''} ${turn ? 'is-turning' : ''}`} style={{ width: (narrow ? geo.pageW : geo.pageW * 2), height: geo.pageH, transform: scale === 1 ? undefined : `scale(${scale})` }}>
          {!narrow && <div className="reg-slot reg-slot-left" onClick={previous}>{leftIndex >= 0 ? pageNode(leftIndex, 'left') : <div className="reg-page reg-page-empty" />}</div>}
          <div className="reg-slot reg-slot-right" onClick={next}>{pageNode(rightIndex, narrow ? 'single' : 'right')}</div>
          {leaf && <div className={`reg-leaf ${leaf.side}`} style={{ animationDuration: `${TURN_MS}ms` }}>
            <div className="reg-leaf-face reg-leaf-front">{pageNode(leaf.front, narrow ? 'single' : (turn.dir > 0 ? 'right' : 'left'))}<i className="reg-leaf-shade" /></div>
            <div className="reg-leaf-face reg-leaf-back">{leaf.back != null && leaf.back >= 0 ? pageNode(leaf.back, turn.dir > 0 ? 'left' : 'right') : <div className="reg-page reg-page-paper" />}<i className="reg-leaf-shade" /></div>
          </div>}
          {!narrow && <i className="reg-spine" aria-hidden="true" />}
        </div>
        </div>
      </div>
      <div className="reg-measure-host" aria-hidden="true"><div className="reg-page-body" ref={measure} style={{ width: geo.pageW - geo.padX * 2 }} /></div>
    </div>
  </div>
}

function Page({ index, side, front, total, meta, en, tocEntries, tocPerPage, pageOfSection, layout, chapters, onJump }) {
  if (index === 0) return <article className={`reg-page reg-cover ${side}`}>
    <div className="reg-cover-rule" />
    <div className="reg-cover-brand">{en ? 'CONTROLLED DOCUMENT' : 'ΕΛΕΓΧΟΜΕΝΟ ΕΓΓΡΑΦΟ'}{meta.code ? ` · ${meta.code}` : ''}</div>
    <div className="reg-cover-center">
      <small>{meta.category}</small>
      <h1>{meta.organization}</h1>
      <span />
      <h2>{meta.title}</h2>
    </div>
    <div className="reg-cover-meta">
      <span><b>{en ? 'Edition' : 'Έκδοση'}</b>{meta.edition ? String(meta.edition).padStart(2, '0') : '—'}</span>
      <span><b>{en ? 'Issued' : 'Ισχύει από'}</b>{meta.issued || '—'}</span>
      <span><b>{en ? 'Status' : 'Κατάσταση'}</b>{meta.status}</span>
    </div>
  </article>
  if (index === 1) return <article className={`reg-page reg-inside ${side}`}>
    <div>
      <div className="reg-inside-title">{en ? 'Controlled document' : 'Στοιχεία ελεγχόμενου εγγράφου'}</div>
      <table><tbody>
        <tr><td>{en ? 'Title' : 'Τίτλος'}</td><td>{meta.title}</td></tr>
        <tr><td>{en ? 'Organisation' : 'Φορέας'}</td><td>{meta.organization}</td></tr>
        <tr><td>{en ? 'Code' : 'Κωδικός'}</td><td>{meta.code || '—'}</td></tr>
        <tr><td>{en ? 'Edition' : 'Έκδοση'}</td><td>{meta.edition || '—'}{meta.issued ? ` · ${meta.issued}` : ''}</td></tr>
        <tr><td>{en ? 'Approved by' : 'Έγκριση'}</td><td>{meta.approvedBy || '—'}</td></tr>
        <tr><td>{en ? 'Status' : 'Κατάσταση'}</td><td>{meta.status}</td></tr>
        {meta.template && <tr><td>{en ? 'Based on' : 'Πρότυπο'}</td><td>{meta.template}</td></tr>}
      </tbody></table>
      {meta.signatures?.length > 0 && <div className="reg-signatures">{meta.signatures.map(slot => <div key={slot.role} className={slot.name ? '' : 'is-empty'}>
        <small>{slot.label}</small>
        <span className="reg-signature-ink">{slot.image ? <img src={slot.image} alt="" /> : slot.name ? <em>{en ? 'Signed electronically' : 'Υπογράφηκε ηλεκτρονικά'}</em> : null}</span>
        <strong>{slot.name || (en ? 'Not signed' : 'Δεν έχει υπογραφεί')}</strong>
        {slot.title && <span>{slot.title}</span>}
        {slot.date && <span>{slot.date}</span>}
      </div>)}</div>}
    </div>
    <p className="reg-inside-note">{meta.draft ? (en ? 'Draft for review: not yet in force.' : 'Προσχέδιο για έλεγχο: δεν έχει ακόμη ισχύ.') : (en ? 'The electronic edition is the controlled copy of the regulation; printed copies are uncontrolled.' : 'Η ηλεκτρονική έκδοση είναι το ελεγχόμενο αντίγραφο του κανονισμού· τα έντυπα αντίγραφα είναι μη ελεγχόμενα.')}</p>
    <div className="reg-page-no">{index + 1}</div>
  </article>
  if (index < front) {
    const part = index - 2
    const entries = tocEntries.slice(part * tocPerPage, (part + 1) * tocPerPage)
    return <article className={`reg-page reg-contents ${side}`}>
      <Running meta={meta} title={en ? 'Contents' : 'Περιεχόμενα'} />
      <div className="reg-page-body">
        {part === 0 && <h1>{en ? 'Contents' : 'Περιεχόμενα'}</h1>}
        <ol>{entries.map(entry => { const page = entry.level === 1 ? pageOfSection(entry.chapterIndex, 0) : pageOfSection(entry.chapterIndex, entry.sectionIndex); return <li key={`${entry.chapterIndex}-${entry.sectionIndex ?? 'c'}`} className={entry.level === 1 ? 'is-chapter' : ''}><button type="button" onClick={event => { event.stopPropagation(); onJump(page) }}><span>{entry.title}</span><i /><em>{page + 1}</em></button></li> })}</ol>
      </div>
      <div className="reg-page-no">{index + 1}</div>
    </article>
  }
  const page = layout.pages[index - front]
  if (!page) return <div className="reg-page reg-page-empty" />
  return <article className={`reg-page ${side}`}>
    <Running meta={meta} title={chapters[page.chapterIndex]?.title} />
    <div className="reg-page-body" dangerouslySetInnerHTML={{ __html: page.html }} />
    <div className="reg-page-no">{index + 1}<small> / {total}</small></div>
  </article>
}

function Running({ meta, title }) {
  return <div className="reg-running"><span>{title}</span><span>{[meta.organization, meta.edition ? `${meta.editionLabel} ${meta.edition}` : meta.status].filter(Boolean).join(' · ')}</span></div>
}

export { esc as escapeRegulationText }
