// Words the register screens share.
export const registerKindLabel = (kind: string, language = 'el') => ((language === 'en' ? { case: 'Per case', sheet: 'Daily sheet' } : { case: 'Ανά περιστατικό', sheet: 'Ημερήσιο φύλλο' }) as Record<string, string>)[kind] || kind
export const registerStatusLabel = (status: string, language = 'el') => ((language === 'en' ? { draft: 'Draft', active: 'Active', archived: 'Archived' } : { draft: 'Πρόχειρο', active: 'Ενεργό', archived: 'Αρχειοθετημένο' }) as Record<string, string>)[status] || status
export const indicatorStatusLabel = (status: string | undefined, language = 'el') => ((language === 'en' ? { onTarget: 'On target', attention: 'Below target', breach: 'Past the limit', context: 'No target' } : { onTarget: 'Εντός στόχου', attention: 'Εκτός στόχου', breach: 'Πέρα από το όριο', context: 'Χωρίς στόχο' }) as Record<string, string>)[status ?? ''] || ''
export const indicatorStatusTone = (status: string | undefined) => ({ onTarget: 'success', attention: 'warning', breach: 'danger' } as Record<string, string>)[status ?? ''] || 'neutral'

export function formatIndicatorValue(value: number | null | undefined, indicator: { unit?: string, unitEn?: string } | null | undefined, language = 'el') {
  if (value == null) return '—'
  const en = language === 'en'
  const text = new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(value)
  const unit = en ? indicator?.unitEn || indicator?.unit : indicator?.unit
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text
}
