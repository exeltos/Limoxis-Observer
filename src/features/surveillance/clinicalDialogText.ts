// Text helpers shared by the clinical record dialogs (ClinicalRecordDialogs.tsx, ClinicalCareDialogs.tsx).
import { translate } from '../../core/i18n/LanguageContext'
import type { AnyRecord } from '../../types/featureTypes'

export const copy = (language: string) => (key: string) =>
  translate(`copy.clinicalRecordCopy.${key}`, language === 'el' ? 'el' : 'en')
// A library row ([el, en, meta]) by the screen's language.
export const rowLabel = (row: AnyRecord, language: string) => row?.[language === 'el' ? 0 : 1] || row?.[0] || ''
export const NEW_ITEM = '__new__'
