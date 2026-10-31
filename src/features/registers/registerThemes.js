import { Activity, Baby, ClipboardList, Heart, HeartPulse } from 'lucide-react'

// The look of a register's pages: the NICU and the ICU have their own (colour and icon), the rest the standard one.
// A register is recognised by its template, or by its name («ΜΕΝΝ», «ΜΕΘ») for the hospitals' own copies.
export function registerThemeKey(register) {
  if (!register) return ''
  if (register.templateKey === 'nicu' || register.templateKey === 'icu') return register.templateKey
  const text = `${register.name || ''} ${register.nameEn || ''} ${register.department || ''}`
  if (/ΜΕΝΝ|NICU/i.test(text)) return 'nicu'
  if (/(^|[^Α-Ωα-ωά-ώ])ΜΕΘ([^Α-Ωα-ωά-ώ]|$)|\bICU\b/.test(text)) return 'icu'
  return ''
}

export const themeIcon = key => ({ nicu: Baby, icu: HeartPulse })[key] || ClipboardList

// The ICU keeps General and Cardiac surgery patients in one register: each case wears its own colour and symbol.
const ICU_CATEGORIES = { cardiac: { Icon: Heart, tone: 'danger' }, general: { Icon: Activity, tone: 'info' } }
export function caseMarker(register, values, language = 'el') {
  if (registerThemeKey(register) !== 'icu') return null
  const field = (register.fields || []).find(item => item.key === 'category')
  const marker = ICU_CATEGORIES[values?.category]
  const option = field?.options?.find(item => item.value === values?.category)
  if (!marker || !option) return null
  return { value: values.category, label: language === 'en' ? option.labelEn || option.label : option.label, ...marker }
}
