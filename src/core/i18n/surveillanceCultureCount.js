const cultureLabels = {
  el: { one: 'εργαστηριακό δείγμα συνολικά', many: 'εργαστηριακά δείγματα συνολικά' },
  en: { one: 'laboratory sample total', many: 'laboratory samples total' },
}

export function formatSurveillanceCultureCount(value, language = 'el') {
  const count = Number(value) || 0
  const labels = cultureLabels[language === 'en' ? 'en' : 'el']
  return `${count} ${count === 1 ? labels.one : labels.many}`
}
