import { useEffect, useRef, useState } from 'react'
import { Bold, Eraser, Heading3, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Redo2, Table2, Underline, Undo2 } from 'lucide-react'
import { sanitizeHtml } from './regulationHtml'

// Formatted text for a regulation's section: headings, emphasis, lists, tables,
// quotes and links, nothing else. What is pasted (from Word, a web page or a
// PDF) keeps its structure and loses its styles.

const exec = (command, value = null) => document.execCommand(command, false, value)

export function RichTextEditor({ value, onChange, language = 'el', disabled = false, label }) {
  const en = language === 'en'
  const area = useRef(null)
  const saved = useRef(null)
  const [link, setLink] = useState(null)
  const [active, setActive] = useState({})

  // The editor takes the value only when it changes from outside (another section).
  useEffect(() => {
    if (area.current && area.current.innerHTML !== (value || '')) area.current.innerHTML = value || ''
  }, [value])

  useEffect(() => {
    const onSelection = () => {
      if (!area.current?.contains(document.getSelection()?.anchorNode)) return
      setActive({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'), ul: document.queryCommandState('insertUnorderedList'), ol: document.queryCommandState('insertOrderedList'), block: String(document.queryCommandValue('formatBlock') || '').toLowerCase() })
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  const emit = () => onChange?.(area.current?.innerHTML || '')
  const run = (command, valueArg) => { area.current?.focus(); exec(command, valueArg); emit() }
  const block = tag => run('formatBlock', `<${tag}>`)
  const table = () => {
    const cells = count => Array.from({ length: count }, () => '<td><br></td>').join('')
    run('insertHTML', `<table><thead><tr><th>${en ? 'Heading' : 'Στήλη'}</th><th>${en ? 'Heading' : 'Στήλη'}</th><th>${en ? 'Heading' : 'Στήλη'}</th></tr></thead><tbody><tr>${cells(3)}</tr><tr>${cells(3)}</tr></tbody></table><p><br></p>`)
  }
  const openLink = () => {
    const selection = document.getSelection()
    saved.current = selection?.rangeCount && area.current?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null
    setLink('https://')
  }
  const applyLink = event => {
    event.preventDefault()
    const href = String(link || '').trim()
    setLink(null)
    if (!/^(https?:\/\/|mailto:)/i.test(href)) return
    area.current?.focus()
    if (saved.current) { const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(saved.current) }
    if (document.getSelection()?.isCollapsed) exec('insertHTML', `<a href="${href.replace(/"/g, '&quot;')}">${href.replace(/</g, '&lt;')}</a>`)
    else exec('createLink', href)
    emit()
  }
  const onPaste = event => {
    event.preventDefault()
    const html = event.clipboardData?.getData('text/html')
    const text = event.clipboardData?.getData('text/plain') || ''
    const clean = html ? sanitizeHtml(html) : text.split(/\r?\n\r?\n/).map(part => `<p>${part.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]).replace(/\r?\n/g, '<br>')}</p>`).join('')
    exec('insertHTML', clean)
    emit()
  }
  const onKeyDown = event => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openLink() }
  }

  const tool = (icon, title, onClick, isActive = false) => { const Icon = icon; return <button type="button" title={title} aria-label={title} aria-pressed={isActive} className={isActive ? 'active' : ''} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}><Icon size={15} /></button> }
  return <div className={`reg-rte ${disabled ? 'is-disabled' : ''}`}>
    <div className="reg-rte-tools" role="toolbar" aria-label={en ? 'Formatting' : 'Μορφοποίηση'}>
      {tool(Pilcrow, en ? 'Paragraph' : 'Κείμενο', () => block('p'), active.block === 'p')}
      {tool(Heading3, en ? 'Heading' : 'Επικεφαλίδα', () => block('h3'), active.block === 'h3')}
      <span className="reg-rte-sep" />
      {tool(Bold, en ? 'Bold (Ctrl+B)' : 'Έντονα (Ctrl+B)', () => run('bold'), active.bold)}
      {tool(Italic, en ? 'Italic (Ctrl+I)' : 'Πλάγια (Ctrl+I)', () => run('italic'), active.italic)}
      {tool(Underline, en ? 'Underline (Ctrl+U)' : 'Υπογράμμιση (Ctrl+U)', () => run('underline'), active.underline)}
      <span className="reg-rte-sep" />
      {tool(List, en ? 'Bulleted list' : 'Κουκκίδες', () => run('insertUnorderedList'), active.ul)}
      {tool(ListOrdered, en ? 'Numbered list' : 'Αρίθμηση', () => run('insertOrderedList'), active.ol)}
      {tool(Quote, en ? 'Quote' : 'Παράθεση', () => block('blockquote'), active.block === 'blockquote')}
      {tool(Table2, en ? 'Table' : 'Πίνακας', table)}
      {tool(Link2, en ? 'Link (Ctrl+K)' : 'Σύνδεσμος (Ctrl+K)', openLink)}
      <span className="reg-rte-sep" />
      {tool(Eraser, en ? 'Clear formatting' : 'Καθαρισμός μορφοποίησης', () => { run('removeFormat'); block('p') })}
      {tool(Undo2, en ? 'Undo (Ctrl+Z)' : 'Αναίρεση (Ctrl+Z)', () => run('undo'))}
      {tool(Redo2, en ? 'Redo' : 'Επανάληψη', () => run('redo'))}
      {link !== null && <form className="reg-rte-link" onSubmit={applyLink}>
        <input autoFocus value={link} onChange={event => setLink(event.target.value)} aria-label={en ? 'Link address' : 'Διεύθυνση συνδέσμου'} onKeyDown={event => { if (event.key === 'Escape') setLink(null) }} />
        <button type="submit">{en ? 'Add' : 'Προσθήκη'}</button>
        <button type="button" onClick={() => setLink(null)}>{en ? 'Cancel' : 'Άκυρο'}</button>
      </form>}
    </div>
    <div ref={area} className="reg-rte-area reg-page-body" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} spellCheck lang="el"
      onInput={emit} onBlur={emit} onPaste={onPaste} onKeyDown={onKeyDown} />
  </div>
}
