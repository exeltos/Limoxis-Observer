import { Languages } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

// «Automatic translation»: shown next to an English text the system translated, so nobody takes it for the department's own wording.
export function AutoTranslatedMark() {
  const { language } = useLanguage()
  const en = language === 'en'
  return <span className="auto-translated-mark" title={en ? 'Translated automatically from the Greek text. Edit the item in English to correct it.' : 'Μεταφράστηκε αυτόματα από το ελληνικό κείμενο. Διορθώνεται από την επεξεργασία στα αγγλικά.'}><Languages size={12} aria-hidden="true" />{en ? 'Automatic translation' : 'Αυτόματη μετάφραση'}</span>
}
