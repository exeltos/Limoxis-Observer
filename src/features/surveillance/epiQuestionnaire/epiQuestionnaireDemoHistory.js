// Demo only, read on demand by epiQuestionnaireService.js: the questionnaires of the year's other
// surveillance episodes (demoInfectionHistory.js), answered the day after each episode started.
// Every fifth episode was left without one, so «Ερωτηματολόγιο: εκκρεμεί» still shows in the lists.
// Written in the Demo's authored frame and moved to today like the other fixtures.
import { shiftDemoDatesInPlace } from '../../../core/data/demoClock'
import { addDays } from '../../../core/data/demoSeed'
import { isEmptyPreview } from '../../../core/preview/emptyPreview'
import { deviceFor, historyCases } from '../demoInfectionHistory'
import { EPI_ANSWER, EPI_SOURCE } from './epiQuestionnaireModel'

const ANSWERED_BY = ['Μαρία Κ.', 'Α. Νικολάου', 'Δ. Παπαδάκη']
const answer = (yes, detail = '', src = EPI_SOURCE.PREFILL) => (yes ? { a: EPI_ANSWER.YES, detail, src } : { a: EPI_ANSWER.NO, detail: '', src: EPI_SOURCE.MANUAL })

export function demoHistoryQuestionnaires() {
  if (isEmptyPreview()) return []
  const rows = historyCases
    .filter((item, index) => index % 5 !== 4)
    .map((item, index) => {
      const number = Number(item.id.slice(-3)), stay = (Date.parse(item.startedAt) - Date.parse(item.admissionDate)) / 86_400_000
      const device = deviceFor(item.device)
      const by = ANSWERED_BY[number % ANSWERED_BY.length], at = `${addDays(item.startedAt, 1)}T10:${String(10 + (index % 40)).padStart(2, '0')}:00Z`
      const answers = {
        antibiotics_90d: answer(number % 3 === 0 || Boolean(item.resistance), number % 3 === 0 ? 'Ceftriaxone' : 'Piperacillin/tazobactam', EPI_SOURCE.MANUAL),
        icu_stay: answer(item.department === 'ΜΕΘ'),
        transfer_from_facility: number % 7 === 0 ? { a: EPI_ANSWER.UNKNOWN, detail: '', src: EPI_SOURCE.MANUAL } : answer(number % 4 === 1, 'Γ.Ν. Πατρών', EPI_SOURCE.MANUAL),
        ...(index % 3 === 2 ? {} : {
          other_admission_90d: answer(number % 5 === 0, '', EPI_SOURCE.MANUAL),
          invasive_device_48h: answer(Boolean(device) && stay >= 2, device?.[0] || ''),
          surgery_30d: answer(['Χειρουργική', 'Ορθοπαιδική'].includes(item.department)),
          known_mdro: answer(item.resistance && number % 2 === 0, item.resistance ? `${item.resistance}, ${item.admissionDate.slice(0, 4)}` : '', EPI_SOURCE.MANUAL),
          ltcf_residence: answer(false),
        }),
      }
      return { id: `EPQ-${item.id}`, caseId: item.id, definitionVersion: 1, answers, prefilled: {}, coreComplete: true, answeredBy: by, answeredAt: at, updatedBy: by, updatedAt: at }
    })
  return shiftDemoDatesInPlace(rows)
}
