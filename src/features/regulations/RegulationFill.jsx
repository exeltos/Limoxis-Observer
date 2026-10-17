import { useMemo, useState } from 'react'
import { CheckCircle2, FilePenLine, ListChecks } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { applyFill, fillItems } from './regulationModel'
import { sanitizeHtml } from './regulationHtml'

// Filling in a regulation that came from a template: every «Fill in» note of
// the draft, one under the other, with what it asks and where it is. What is
// written takes the note's place in the text; the rest of the section stays as
// the template has it.
export function RegulationFill({ content, onChange, total = 0, language = 'el', onOpenSection, disabled = false }) {
  const en = language === 'en'
  const items = useMemo(() => fillItems(content), [content])
  const [texts, setTexts] = useState({})
  const all = Math.max(total, items.length)
  const done = all - items.length

  const apply = item => {
    const text = texts[item.key] || ''
    if (!text.trim()) return
    onChange(applyFill(content, item, text))
    // The section's later notes move up one place: their texts move with them.
    setTexts(current => Object.fromEntries(Object.entries(current).flatMap(([key, value]) => {
      const [sectionId, nth] = [key.slice(0, key.lastIndexOf(':')), Number(key.slice(key.lastIndexOf(':') + 1))]
      if (sectionId !== item.sectionId || nth < item.nth) return [[key, value]]
      return nth === item.nth ? [] : [[`${sectionId}:${nth - 1}`, value]]
    })))
  }

  return <div className="reg-fill-area">
    <header className="reg-fill-head">
      <ListChecks size={20} />
      <div>
        <strong>{items.length ? (en ? `${items.length} points to fill in` : `${items.length} σημεία προς συμπλήρωση`) : (en ? 'Everything is filled in' : 'Όλα έχουν συμπληρωθεί')}</strong>
        <span>{en ? 'What the template leaves to your hospital. Write it here; it goes into the text where the note is.' : 'Ό,τι αφήνει το πρότυπο στο νοσοκομείο σας. Γράψτε το εδώ· μπαίνει στο κείμενο στη θέση της σημείωσης.'}</span>
      </div>
      {all > 0 && <span className="reg-fill-progress" aria-label={en ? `${done} of ${all}` : `${done} από ${all}`}><b>{done} / {all}</b><i><em style={{ width: `${Math.round((done / all) * 100)}%` }} /></i></span>}
    </header>
    {items.length ? <ol className="reg-fill-list">{items.map((item, index) => {
      const section = content.chapters[item.chapterIndex]?.sections?.[item.sectionIndex]
      return <li key={item.key}>
        <div className="reg-fill-where"><span>{index + 1}</span>{item.chapterIndex + 1}. {item.chapter} › {item.section}</div>
        <p className="reg-fill-prompt">{item.prompt}</p>
        <textarea rows={3} value={texts[item.key] || ''} disabled={disabled} onChange={event => setTexts(current => ({ ...current, [item.key]: event.target.value }))}
          placeholder={en ? 'Write the text… Lines starting with «-» become a list.' : 'Γράψτε το κείμενο… Γραμμές που ξεκινούν με «-» γίνονται λίστα.'} aria-label={item.prompt} />
        <div className="reg-fill-actions">
          <details><summary>{en ? 'See the section' : 'Δείτε την ενότητα'}</summary><div className="reg-page-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section?.html || '') }} /></details>
          <button type="button" className="reg-link" onClick={() => onOpenSection?.(item)}><FilePenLine size={13} /> {en ? 'Edit the section' : 'Επεξεργασία ενότητας'}</button>
          <Button variant="secondary" disabled={disabled || !String(texts[item.key] || '').trim()} onClick={() => apply(item)}><CheckCircle2 size={15} />{en ? 'Put in the text' : 'Καταχώριση'}</Button>
        </div>
      </li>
    })}</ol> : <div className="reg-empty"><CheckCircle2 size={28} /><strong>{en ? 'Nothing left to fill in' : 'Δεν απομένει κάτι για συμπλήρωση'}</strong><span>{en ? 'Review the text, save the draft and have it signed.' : 'Ελέγξτε το κείμενο, αποθηκεύστε το προσχέδιο και προχωρήστε στις υπογραφές.'}</span></div>}
  </div>
}
