// Words the register screens share.
export const registerKindLabel = (kind, language = 'el') => (language === 'en' ? { case: 'Per case', sheet: 'Daily sheet' } : { case: 'Ανά περιστατικό', sheet: 'Ημερήσιο φύλλο' })[kind] || kind
export const registerStatusLabel = (status, language = 'el') => (language === 'en' ? { draft: 'Draft', active: 'Active', archived: 'Archived' } : { draft: 'Πρόχειρο', active: 'Ενεργό', archived: 'Αρχειοθετημένο' })[status] || status
export const indicatorStatusLabel = (status, language = 'el') => (language === 'en' ? { onTarget: 'On target', attention: 'Below target', breach: 'Past the limit', context: 'No target' } : { onTarget: 'Εντός στόχου', attention: 'Εκτός στόχου', breach: 'Πέρα από το όριο', context: 'Χωρίς στόχο' })[status] || ''
export const indicatorStatusTone = status => ({ onTarget: 'success', attention: 'warning', breach: 'danger' })[status] || 'neutral'

export function formatIndicatorValue(value, indicator, language = 'el') {
  if (value == null) return '—'
  const en = language === 'en'
  const text = new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(value)
  const unit = en ? indicator?.unitEn || indicator?.unit : indicator?.unit
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text
}
