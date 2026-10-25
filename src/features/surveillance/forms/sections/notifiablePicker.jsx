import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ObserverDialog } from '../../../../design-system/ObserverDialog'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { EODY_CATALOGUE, EODY_DEADLINES, EODY_FOOTNOTES, deadlineGroupWords, deadlineWords, eodyLabel } from '../../../reporting/eodyCatalogue'

// Matches without accents or case, so «ιλαρα» finds «Ιλαρά».
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The picker of «Νέα δήλωση»: the 57 diseases of the ΕΟΔΥ catalogue, grouped by deadline,
// with a search box. The groups start closed (a search opens the ones with matches); a disease
// with a note shows it first and continues on a second press. Choosing one calls onPick(entry).
export function NotifiablePicker({ busy = false, onPick, onClose }) {
  const { t, language } = useLanguage()
  const en = language === 'en' ? 'en' : 'el'
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState([])
  const [selected, setSelected] = useState(null)
  const searching = fold(query).length > 0
  const groups = useMemo(() => {
    const needle = fold(query)
    const matches = EODY_CATALOGUE.filter(entry => !needle || fold(`${entry.el} ${entry.en}`).includes(needle))
    return EODY_DEADLINES.map(deadline => ({ deadline, entries: matches.filter(entry => entry.deadline === deadline) })).filter(group => group.entries.length)
  }, [query])
  const toggle = deadline => setOpened(current => (current.includes(deadline) ? current.filter(item => item !== deadline) : [...current, deadline]))
  const choose = entry => {
    if (entry.notes.length && selected !== entry.id) return setSelected(entry.id)
    onPick(entry)
  }
  return (
    <ObserverDialog width="standard" title={t('episodeForms.notifiable.pickerTitle')} subtitle={t('episodeForms.notifiable.pickerSubtitle')} onClose={onClose}>
      <input type="search" className="notifiable-picker-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('episodeForms.notifiable.pickerSearch')} aria-label={t('episodeForms.notifiable.pickerSearch')} autoFocus />
      {groups.length === 0 && <p className="episode-form-empty">{t('episodeForms.notifiable.pickerNone')}</p>}
      {groups.map(group => {
        const open = searching || opened.includes(group.deadline)
        return (
          <section key={group.deadline} className="notifiable-picker-group" aria-label={deadlineWords(group.deadline, language)}>
            <h4>
              <button type="button" className="notifiable-picker-toggle" aria-expanded={open} onClick={() => toggle(group.deadline)}>
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                {deadlineGroupWords(group.deadline, language)} <span>({group.entries.length})</span>
              </button>
            </h4>
            {open && group.deadline === EODY_DEADLINES[0] && <p className="episode-form-empty">{EODY_FOOTNOTES.biothreat[en]}</p>}
            {open && (
              <ul>
                {group.entries.map(entry => (
                  <li key={entry.id}>
                    <button type="button" disabled={busy} onClick={() => choose(entry)}>
                      <span className="notifiable-picker-name">
                        {eodyLabel(entry, language)}
                        <i>{entry.n}</i>
                      </span>
                      {selected === entry.id && entry.notes.map(note => <small key={note}>{EODY_FOOTNOTES[note][en]}</small>)}
                      {selected === entry.id && <span className="notifiable-picker-continue">{t('episodeForms.notifiable.pickerContinue')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </ObserverDialog>
  )
}
