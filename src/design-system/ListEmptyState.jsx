import { useLanguage } from '../core/i18n/LanguageContext'

// One empty-list message for every registry (docs/OBSERVER_UI_CONTRACT.md):
// either nothing matches the search or filters, or nothing is recorded yet —
// then `hint` (e.g. «Πατήστε Δημιουργία…») shows only to those who can create.
// Use the copy with RegistryTable's emptyTitle/emptyText, or the component
// below for tables that render their own empty line.
export function listEmptyCopy({ t, filtered, title, text = '', hint = '', canCreate = false }) {
  if (filtered) return { title: t('listEmptyFiltered'), text: t('listEmptyFilteredHint') }
  return { title, text: [text, canCreate ? hint : ''].filter(Boolean).join(' ') }
}

export function ListEmptyState(props) {
  const { t } = useLanguage()
  const copy = listEmptyCopy({ ...props, t })
  return (
    <div className="inline-empty" role="status">
      <strong>{copy.title}</strong>
      {copy.text && <span>{copy.text}</span>}
    </div>
  )
}
