import { AlertTriangle, Inbox, RefreshCw, SearchX, X } from 'lucide-react'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'
import { Button } from './Button'
import './RegistryEmptyState.css'

// The two empty lists look different on purpose:
// - filtered: the search or the filters hide every record → say so and offer
//   «Clear filters»;
// - error: the list could not be read (never shown as «nothing here»): say so and
//   offer «Try again» (`error`, `onRetry`);
// - none: nothing has been created yet → an icon, what the list will hold and
//   the primary action that creates the first record.
export function RegistryEmptyState({ filtered = false, error = false, onRetry, onClearFilters, title, text, icon: Icon, action, language, className = '' }) {
  const context = useOptionalLanguage()
  const en = (language || context?.language) === 'en'
  if (error) {
    return <div className={`registry-empty-state lo-empty-state lo-empty-error ${className}`.trim()} role="alert">
      <span className="lo-empty-icon" aria-hidden="true"><AlertTriangle size={22} /></span>
      <strong>{typeof error === 'string' ? error : (en ? 'The list could not be loaded' : 'Δεν φορτώθηκε η λίστα')}</strong>
      <span>{en ? 'This is not an empty list: the data could not be read. Check the connection and try again.' : 'Δεν είναι κενή λίστα: τα δεδομένα δεν διαβάστηκαν. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.'}</span>
      {onRetry && <Button variant="secondary" onClick={onRetry}><RefreshCw size={15} />{en ? 'Try again' : 'Ξαναδοκιμάστε'}</Button>}
    </div>
  }
  const Glyph = Icon || (filtered ? SearchX : Inbox)
  const heading = title || (filtered
    ? (en ? 'Nothing matches the search or the filters' : 'Δεν βρέθηκαν εγγραφές με αυτή την αναζήτηση ή τα φίλτρα')
    : (en ? 'Nothing has been created yet' : 'Δεν έχει δημιουργηθεί ακόμη καμία εγγραφή'))
  const body = text ?? (filtered ? (en ? 'Change the search or clear the filters to see every record.' : 'Αλλάξτε την αναζήτηση ή καθαρίστε τα φίλτρα για να δείτε όλες τις εγγραφές.') : '')
  const ActionIcon = action?.icon
  return <div className={`registry-empty-state lo-empty-state ${filtered ? 'lo-empty-filtered' : 'lo-empty-none'} ${className}`.trim()} role="status">
    <span className="lo-empty-icon" aria-hidden="true"><Glyph size={22} /></span>
    <strong>{heading}</strong>
    {body && <span>{body}</span>}
    {filtered && onClearFilters && <Button variant="secondary" onClick={onClearFilters}><X size={15} />{en ? 'Clear filters' : 'Καθαρισμός φίλτρων'}</Button>}
    {!filtered && action?.onClick && <Button onClick={action.onClick}>{ActionIcon && <ActionIcon size={15} />}{action.label}</Button>}
  </div>
}
