const cultureLabels = {
  el: { one: 'θετική καλλιέργεια συνολικά', many: 'θετικές καλλιέργειες συνολικά' },
  en: { one: 'positive culture total', many: 'positive cultures total' },
}

export function formatSurveillanceCultureCount(value, language = 'el') {
  const count = Number(value) || 0
  const labels = cultureLabels[language === 'en' ? 'en' : 'el']
  return `${count} ${count === 1 ? labels.one : labels.many}`
}
