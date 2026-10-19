// Wording of a period's progress: «3/4 σήμερα» and the message shown when the
// required entries are complete.
const PERIOD = {
  el: { day: 'σήμερα', week: 'αυτή την εβδομάδα', month: 'αυτόν τον μήνα', year: 'φέτος' },
  en: { day: 'today', week: 'this week', month: 'this month', year: 'this year' },
}
const PERIOD_FOR = {
  el: { day: 'για σήμερα', week: 'για αυτή την εβδομάδα', month: 'για αυτόν τον μήνα', year: 'για φέτος' },
  en: { day: 'for today', week: 'for this week', month: 'for this month', year: 'for this year' },
}
const lang = (language) => (language === 'en' ? 'en' : 'el')

export function progressText(progress, language = 'el') {
  if (!progress) return ''
  return `${progress.done}/${progress.required} ${PERIOD[lang(language)][progress.unit] || PERIOD[lang(language)].day}`
}

export function progressCompleteMessage(progress, language = 'el') {
  const period = PERIOD_FOR[lang(language)][progress?.unit] || PERIOD_FOR[lang(language)].day
  const count = `${progress?.done ?? 0}/${progress?.required ?? 1}`
  return lang(language) === 'en'
    ? `The required entries ${period} (${count}) are complete.`
    : `Οι απαιτούμενες καταχωρήσεις ${period} (${count}) έχουν ολοκληρωθεί.`
}
