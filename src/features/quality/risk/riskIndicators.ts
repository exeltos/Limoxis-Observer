// Indicators that measure a risk. A risk keeps the keys of indicators from the
// Indicators module (indicator_definitions.indicator_key); their current value
// and trend come from the same calculation the Indicators page uses.
import { calculateCloudDefinition, collectCloudIndicatorMetrics, loadOperationalIndicatorDefinitions } from '../../indicators/indicatorCloudService'
import { hospitalDate } from '../../../core/dates/hospitalDate'
import type { AnyRecord } from '../../../types/featureTypes'

const fold = (value: unknown) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Risk 2025 is a risk register, not an indicator generator. Only risks with a
// meaningful, repeatable measure get suggestions here. In particular, the
// generic source value "Δείκτης Συμβάντος" must NOT turn every incident risk
// into a KPI; incident-specific indicators are added only when a reliable
// numerator/denominator exists in the Indicators module.
const RULES: [RegExp, string[]][] = [
  [/κεντρικ\S* (φλεβικ\S* )?(καθετηρ|γραμμ)|clabsi/, ['clabsi-per-1000-cvc-days', 'bundle-compliance', 'hh-compliance']],
  [/αναπνευστηρ|μηχανικ\S* αερισμ|(^|\W)vap(\W|$)/, ['vap-per-1000-ventilator-days', 'bundle-compliance', 'hh-compliance']],
  [/πολυανθεκτ|mdr|xdr|pdr|(^|\W)pam(\W|$)|kpc|(^|\W)cre(\W|$)/, ['mdro-bsi-rate', 'mdr-active-share', 'hh-compliance']],
  [/βακτηριαιμ|σηψ/, ['bacteremia-incidence-rate']],
  [/υγιειν\S* χεριων/, ['hh-compliance']],
  [/bundle|δεσμ\S* μετρ/, ['bundle-compliance']],
  [/ενδονοσοκομειακ|νοσοκομειακ\S* λοιμωξ|λοιμογον|(^|\s)εελ(\s|$)|επιδημ/, ['hai-prevalence-pps', 'hh-compliance', 'bundle-compliance']],
  [/πτωσ\S* (ασθεν|νοσηλευ)|patient fall/, ['patient-falls-per-1000-patient-days']],
  [/(λανθασμεν|λαθος|σφαλμ|ανεπιθυμητ)\S*.*φαρμακ|φαρμακ\S*.*(λανθασμεν|λαθος|σφαλμ|ανεπιθυμητ)/, ['medication-incidents-per-1000-patient-days']],
  [/αντιβιοτ|αντιμικροβ/, ['antibiotic-ddd-per-100-patient-days']],
  [/εμβολιασ/, ['vaccination-coverage']],
  [/ικανοποιησ\S* (\S+ ){0,4}(ασθεν|ενδιαφερομεν)|patient satisfaction/, ['patient-satisfaction']],
]

// Indicators to propose for a risk, among those the organization has; the
// ones already linked are left out.
export function suggestIndicators(risk: AnyRecord, available: string[] = [], limit = 3) {
  const have = new Set(available)
  const linked = new Set(risk.indicatorKeys || [])
  const text = fold([risk.hazard, risk.process, risk.scope, risk.indicator].join(' '))
  const out: string[] = []
  for (const [pattern, keys] of RULES) {
    if (!pattern.test(text)) continue
    for (const key of keys) if (have.has(key) && !linked.has(key) && !out.includes(key)) out.push(key)
  }
  return out.slice(0, limit)
}

const iso = (date: Date) => hospitalDate(date)
// The indicators service is still JavaScript: its range parameter reads as { departmentId?: null }.
const collectMetrics = collectCloudIndicatorMetrics as (organizationId: string | null | undefined, range: { from: string, to: string }) => ReturnType<typeof collectCloudIndicatorMetrics>

// Current value (last 90 days) and the 90 days before, per indicator key.
export async function loadIndicatorValues(organizationId: string | null | undefined, now = new Date()) {
  const day = 86400000
  const to = iso(now), from = iso(new Date(now.getTime() - 90 * day)), prevTo = iso(new Date(now.getTime() - 91 * day)), prevFrom = iso(new Date(now.getTime() - 181 * day))
  const [definitions, current, previous] = await Promise.all([
    loadOperationalIndicatorDefinitions(organizationId, { from, to }),
    collectMetrics(organizationId, { from, to }),
    collectMetrics(organizationId, { from: prevFrom, to: prevTo }),
  ])
  const values = new Map<string, AnyRecord>()
  for (const def of definitions) {
    const now90 = calculateCloudDefinition(def, current), before = calculateCloudDefinition(def, previous)
    values.set(def.id, { key: def.id, titleEl: def.titleEl, titleEn: def.titleEn || def.titleEl, category: def.category, unit: def.unit, unitEn: def.unitEn, target: def.target, direction: def.direction, value: now90.value, previous: before.value, status: now90.status, trend: indicatorTrend(now90.value, before.value, def.direction) })
  }
  return values
}

// better / worse / steady, read with the indicator's direction.
export function indicatorTrend(value: number | null | undefined, previous: number | null | undefined, direction: string | null | undefined) {
  if (value == null || previous == null || value === previous) return 'steady'
  if (direction !== 'higher' && direction !== 'lower') return 'steady'
  const up = value > previous
  return (direction === 'higher') === up ? 'better' : 'worse'
}
