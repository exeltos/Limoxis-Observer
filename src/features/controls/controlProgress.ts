import { zonedParts } from './controlDueRules'
import type { AnyRecord } from '../../types/featureTypes'
// Wording of a period's progress: «3/4 σήμερα» and the message shown when the
// required entries are complete.
const PERIOD: Record<string, Record<string, string>> = {
  el: { day: 'σήμερα', week: 'αυτή την εβδομάδα', month: 'αυτόν τον μήνα', year: 'φέτος' },
  en: { day: 'today', week: 'this week', month: 'this month', year: 'this year' },
}
const PERIOD_FOR: Record<string, Record<string, string>> = {
  el: { day: 'για σήμερα', week: 'για αυτή την εβδομάδα', month: 'για αυτόν τον μήνα', year: 'για φέτος' },
  en: { day: 'for today', week: 'for this week', month: 'for this month', year: 'for this year' },
}
const lang = (language: string) => (language === 'en' ? 'en' : 'el')

export function progressText(progress: AnyRecord | null | undefined, language = 'el') {
  if (!progress) return ''
  return `${progress.done}/${progress.required} ${PERIOD[lang(language)][progress.unit] || PERIOD[lang(language)].day}`
}

export function progressCompleteMessage(progress: AnyRecord | null | undefined, language = 'el') {
  const period = PERIOD_FOR[lang(language)][progress?.unit] || PERIOD_FOR[lang(language)].day
  const count = `${progress?.done ?? 0}/${progress?.required ?? 1}`
  return lang(language) === 'en'
    ? `The required entries ${period} (${count}) are complete.`
    : `Οι απαιτούμενες καταχωρήσεις ${period} (${count}) έχουν ολοκληρωθεί.`
}

// A deadline as people say it: «σήμερα έως 21:59», «αύριο έως 09:00», otherwise the date
// and time; a passed one says so («έληξε 26/10, 21:59»). Wall-clock in Athens.
export function deadlineText(nextDueAt: string | Date | null | undefined, language = 'el', now: Date | string = new Date()) {
  if (!nextDueAt) return '—'
  const en = language === 'en'
  const at = zonedParts(nextDueAt), today = zonedParts(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(at.hour)}:${pad(at.minute)}`
  const dayNumber = (p: AnyRecord) => Date.UTC(p.year, p.month - 1, p.day) / 86400000
  const offset = dayNumber(at) - dayNumber(today)
  const date = `${pad(at.day)}/${pad(at.month)}/${at.year}`
  if (new Date(nextDueAt) < new Date(now)) return en ? `passed ${date}, ${time}` : `έληξε ${date}, ${time}`
  if (offset === 0) return en ? `today by ${time}` : `σήμερα έως ${time}`
  if (offset === 1) return en ? `tomorrow by ${time}` : `αύριο έως ${time}`
  return en ? `by ${date}, ${time}` : `έως ${date}, ${time}`
}
