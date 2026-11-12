import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, FilePlus2, FolderPlus, Trash2 } from 'lucide-react'
import { IconButton } from '../../design-system/IconButton'
import { RichTextEditor } from './RichTextEditor'
import { chaptersOf, newId, plainText } from './regulationModel'

// Writing a regulation: its chapters and sections on the left, in order, with
// the formatted text of the chosen one on the right. Chapters and sections move
// up and down; a section that came from a template keeps its origin, so later
// template versions can still be compared with it.

const move = (list, index, by) => { const copy = [...list]; const [item] = copy.splice(index, 1); copy.splice(Math.max(0, Math.min(copy.length, index + by)), 0, item); return copy }

export function RegulationEditor({ content, onChange, language = 'el', disabled = false, onConfirm, initialSelection = null }) {
  const en = language === 'en'
  const chapters = chaptersOf(content)
  const [selected, setSelected] = useState(initialSelection || { chapter: 0, section: 0 })
  const chapter = chapters[selected.chapter]
  const section = selected.section >= 0 ? chapter?.sections?.[selected.section] : null
  const words = useMemo(() => (section ? plainText(section.html).split(' ').filter(Boolean).length : 0), [section])

  const setChapters = next => onChange({ ...content, chapters: next })
  const updateChapter = (index, changes) => setChapters(chapters.map((item, at) => (at === index ? { ...item, ...changes } : item)))
  const updateSection = changes => updateChapter(selected.chapter, { sections: chapter.sections.map((item, at) => (at === selected.section ? { ...item, ...changes } : item)) })

  const addChapter = () => {
    const next = [...chapters, { id: newId('ch'), title: en ? 'New chapter' : 'Νέο κεφάλαιο', sections: [{ id: newId('sec'), origin: null, title: en ? 'General' : 'Γενικά', html: '' }] }]
    setChapters(next)
    setSelected({ chapter: next.length - 1, section: -1 })
  }
  const addSection = chapterIndex => {
    const target = chapters[chapterIndex]
    const sections = [...(target.sections || []), { id: newId('sec'), origin: null, title: en ? 'New section' : 'Νέα ενότητα', html: '' }]
    updateChapter(chapterIndex, { sections })
    setSelected({ chapter: chapterIndex, section: sections.length - 1 })
  }
  const removeChapter = async index => {
    if (!(await onConfirm?.({ title: en ? 'Remove the chapter?' : 'Αφαίρεση κεφαλαίου;', message: en ? 'The chapter and all its sections leave this draft.' : 'Το κεφάλαιο και όλες οι ενότητές του φεύγουν από το προσχέδιο.' }))) return
    setChapters(chapters.filter((_, at) => at !== index))
    setSelected({ chapter: Math.max(0, index - 1), section: 0 })
  }
  const removeSection = async (chapterIndex, index) => {
    if (!(await onConfirm?.({ title: en ? 'Remove the section?' : 'Αφαίρεση ενότητας;', message: en ? 'Its text leaves this draft.' : 'Το κείμενό της φεύγει από το προσχέδιο.' }))) return
    updateChapter(chapterIndex, { sections: chapters[chapterIndex].sections.filter((_, at) => at !== index) })
    setSelected({ chapter: chapterIndex, section: Math.max(-1, index - 1) })
  }

  return <div className="reg-editor">
    <aside className="reg-outline" aria-label={en ? 'Chapters and sections' : 'Κεφάλαια και ενότητες'}>
      <header><strong>{en ? 'Structure' : 'Δομή'}</strong>{!disabled && <button type="button" className="reg-link" onClick={addChapter}><FolderPlus size={13} /> {en ? 'Chapter' : 'Κεφάλαιο'}</button>}</header>
      <ol>
        {chapters.map((item, chapterIndex) => <li key={item.id || chapterIndex} className={selected.chapter === chapterIndex ? 'is-open' : ''}>
          <div className={`reg-outline-row is-chapter ${selected.chapter === chapterIndex && selected.section === -1 ? 'active' : ''}`}>
            <button type="button" className="reg-outline-name" onClick={() => setSelected({ chapter: chapterIndex, section: -1 })}><span>{chapterIndex + 1}</span><strong>{item.title || (en ? 'Untitled chapter' : 'Κεφάλαιο χωρίς τίτλο')}</strong></button>
            {!disabled && <span className="reg-outline-tools">
              <IconButton size="sm" label={en ? 'Move up' : 'Μετακίνηση πάνω'} disabled={chapterIndex === 0} onClick={() => { setChapters(move(chapters, chapterIndex, -1)); setSelected({ chapter: chapterIndex - 1, section: -1 }) }}><ArrowUp size={13} /></IconButton>
              <IconButton size="sm" label={en ? 'Move down' : 'Μετακίνηση κάτω'} disabled={chapterIndex === chapters.length - 1} onClick={() => { setChapters(move(chapters, chapterIndex, 1)); setSelected({ chapter: chapterIndex + 1, section: -1 }) }}><ArrowDown size={13} /></IconButton>
              <IconButton size="sm" label={en ? 'Add a section' : 'Νέα ενότητα'} onClick={() => addSection(chapterIndex)}><FilePlus2 size={13} /></IconButton>
              <IconButton size="sm" tone="danger" label={en ? 'Remove the chapter' : 'Αφαίρεση κεφαλαίου'} onClick={() => removeChapter(chapterIndex)}><Trash2 size={13} /></IconButton>
            </span>}
          </div>
          <ol>{(item.sections || []).map((entry, sectionIndex) => <li key={entry.id || sectionIndex}>
            <div className={`reg-outline-row ${selected.chapter === chapterIndex && selected.section === sectionIndex ? 'active' : ''}`}>
              <button type="button" className="reg-outline-name" onClick={() => setSelected({ chapter: chapterIndex, section: sectionIndex })}><strong>{entry.title || (en ? 'Untitled section' : 'Ενότητα χωρίς τίτλο')}</strong>{/class="reg-fill"/.test(entry.html || '') && <em title={en ? 'Has «Fill in» notes' : 'Έχει σημειώσεις «Συμπληρώστε»'}>!</em>}</button>
              {!disabled && <span className="reg-outline-tools">
                <IconButton size="sm" label={en ? 'Move up' : 'Μετακίνηση πάνω'} disabled={sectionIndex === 0} onClick={() => { updateChapter(chapterIndex, { sections: move(item.sections, sectionIndex, -1) }); setSelected({ chapter: chapterIndex, section: sectionIndex - 1 }) }}><ArrowUp size={13} /></IconButton>
                <IconButton size="sm" label={en ? 'Move down' : 'Μετακίνηση κάτω'} disabled={sectionIndex === item.sections.length - 1} onClick={() => { updateChapter(chapterIndex, { sections: move(item.sections, sectionIndex, 1) }); setSelected({ chapter: chapterIndex, section: sectionIndex + 1 }) }}><ArrowDown size={13} /></IconButton>
                <IconButton size="sm" tone="danger" label={en ? 'Remove the section' : 'Αφαίρεση ενότητας'} onClick={() => removeSection(chapterIndex, sectionIndex)}><Trash2 size={13} /></IconButton>
              </span>}
            </div>
          </li>)}</ol>
        </li>)}
      </ol>
    </aside>
    <section className="reg-editor-main">
      {!chapter ? <div className="reg-editor-empty">{en ? 'Add a chapter to start writing.' : 'Προσθέστε ένα κεφάλαιο για να ξεκινήσετε.'}</div> : <>
        <label className="reg-editor-title"><span>{en ? 'Chapter' : 'Κεφάλαιο'} {selected.chapter + 1}</span><input value={chapter.title || ''} disabled={disabled} onChange={event => updateChapter(selected.chapter, { title: event.target.value })} placeholder={en ? 'Chapter title' : 'Τίτλος κεφαλαίου'} /></label>
        {section ? <>
          <label className="reg-editor-title is-section"><span>{en ? 'Section' : 'Ενότητα'}</span><input value={section.title || ''} disabled={disabled} onChange={event => updateSection({ title: event.target.value })} placeholder={en ? 'Section title' : 'Τίτλος ενότητας'} /></label>
          <RichTextEditor key={section.id} value={section.html} onChange={html => updateSection({ html })} language={language} disabled={disabled} label={section.title} />
          <p className="reg-editor-foot">{words} {en ? 'words' : 'λέξεις'}{section.origin ? ` · ${en ? 'from the template' : 'από το πρότυπο'}` : ''}</p>
        </> : <div className="reg-editor-empty">
          <p>{en ? `${chapter.sections?.length || 0} sections in this chapter.` : `${chapter.sections?.length || 0} ενότητες σε αυτό το κεφάλαιο.`}</p>
          {!disabled && <button type="button" className="reg-link" onClick={() => addSection(selected.chapter)}><FilePlus2 size={13} /> {en ? 'Add a section' : 'Νέα ενότητα'}</button>}
        </div>}
      </>}
    </section>
  </div>
}
