import { useMemo, useState } from 'react'
import { ObserverDialog } from '../../../../design-system/ObserverDialog'
import { useLanguage } from '../../../../core/i18n/LanguageContext'
import { EODY_CATALOGUE, EODY_DEADLINES, EODY_FOOTNOTES, deadlineGroupWords, deadlineWords, eodyLabel } from '../../../reporting/eodyCatalogue'

// Matches without accents or case, so «ιλαρα» finds «Ιλαρά».
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The picker of «Νέα δήλωση»: the 57 diseases of the ΕΟΔΥ catalogue, grouped by deadline,
// with a search box. Choosing one calls onPick(entry).
export function NotifiablePicker({ busy = false, onPick, onClose }) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const needle = fold(query)
    const matches = EODY_CATALOGUE.filter(entry => !needle || fold(`${entry.el} ${entry.en}`).includes(needle))
    return EODY_DEADLINES.map(deadline => ({ deadline, entries: matches.filter(entry => entry.deadline === deadline) })).filter(group => group.entries.length)
  }, [query])
  return (
    <ObserverDialog width="standard" title={t('episodeForms.notifiable.pickerTitle')} subtitle={t('episodeForms.notifiable.pickerSubtitle')} onClose={onClose}>
      <input type="search" className="notifiable-picker-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('episodeForms.notifiable.pickerSearch')} aria-label={t('episodeForms.notifiable.pickerSearch')} autoFocus />
      <p className="episode-form-empty">{EODY_FOOTNOTES.biothreat[language === 'en' ? 'en' : 'el']}</p>
      {groups.length === 0 && <p className="episode-form-empty">{t('episodeForms.notifiable.pickerNone')}</p>}
      {groups.map(group => (
        <section key={group.deadline} className="notifiable-picker-group" aria-label={deadlineWords(group.deadline, language)}>
          <h4>{deadlineGroupWords(group.deadline, language)}</h4>
          <ul>
            {group.entries.map(entry => (
              <li key={entry.id}>
                <button type="button" disabled={busy} onClick={() => onPick(entry)}>
                  <span>
                    <b>{entry.n}.</b> {eodyLabel(entry, language)}
                  </span>
                  {entry.notes.map(note => (
                    <small key={note}>{EODY_FOOTNOTES[note][language === 'en' ? 'en' : 'el']}</small>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ObserverDialog>
  )
}
