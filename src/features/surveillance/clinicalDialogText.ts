// Text helpers shared by the clinical record dialogs (ClinicalRecordDialogs.tsx, ClinicalCareDialogs.tsx).
import { translate } from '../../core/i18n/LanguageContext'

export const copy = language => key =>
  translate(`copy.clinicalRecordCopy.${key}`, language === 'el' ? 'el' : 'en')
// A library row ([el, en, meta]) by the screen's language.
export const rowLabel = (row, language) => row?.[language === 'el' ? 0 : 1] || row?.[0] || ''
export const NEW_ITEM = '__new__'
