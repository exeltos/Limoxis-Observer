const cultureLabels = {
  el: { one: 'καλλιέργεια', many: 'καλλιέργειες' },
  en: { one: 'culture', many: 'cultures' },
}

export function formatSurveillanceCultureCount(value, language = 'el') {
  const count = Number(value) || 0
  const labels = cultureLabels[language === 'en' ? 'en' : 'el']
  return `${count} ${count === 1 ? labels.one : labels.many}`
}
