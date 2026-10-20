// Words for the origin and the risk factors of an episode (header, episode row, report).
// Always words, never codes; the same sentence everywhere.
import { riskFactorWords } from './epiQuestionnaireModel'
import { ROLES } from '../../../core/permissions/systemRoleMatrix'

// The roles the database lets write the questionnaire (RLS of surveillance_case_questionnaires):
// the surveillance writers and the department's own managers and link nurses (inside their scope).
export const EPI_WRITE_ROLES = Object.freeze([
  ROLES.PLATFORM_OWNER,
  ROLES.INFECTION_CONTROL_LEAD,
  ROLES.INFECTION_CONTROL_MEMBER,
  ROLES.DOCTOR_REVIEWER,
  ROLES.DEPARTMENT_MANAGER,
  ROLES.LINK_NURSE,
])
export const canWriteEpi = role => EPI_WRITE_ROLES.includes(role)

export const fill = (text, values = {}) => Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), String(text || ''))

export const originWords = (origin, t) =>
  !origin ? t('epiQuestionnaire.originUnknown') : origin.kind === 'hospital' ? t('epiQuestionnaire.originHospital') : t('epiQuestionnaire.originCommunity')

export const factorCountWords = (count, t) => `${count} ${t(count === 1 ? 'epiQuestionnaire.factorOne' : 'epiQuestionnaire.factorMany')}`

// «πρόσφατα αντιβιοτικά · ΜΕΘ · μεταφορά από άλλο νοσοκομείο», or «κανένας».
export const riskWords = (row, language, t) => {
  const words = riskFactorWords(row?.answers || {}, language)
  return words.length ? words.join(' · ') : t('epiQuestionnaire.riskNone')
}

// The short line of an episode row: «Προέλευση: … · 3 παράγοντες κινδύνου».
export function rowLine(summary, t) {
  if (!summary.origin && !summary.hasRow) return ''
  const parts = [`${t('epiQuestionnaire.originLabel')}: ${originWords(summary.origin, t)}`]
  if (summary.hasRow && summary.factorCount) parts.push(factorCountWords(summary.factorCount, t))
  return parts.join(' · ')
}
