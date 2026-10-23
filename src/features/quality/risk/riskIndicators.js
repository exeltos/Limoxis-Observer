// Indicators that measure a risk. A risk keeps the keys of indicators from the
// Indicators module (indicator_definitions.indicator_key); their current value
// and trend come from the same calculation the Indicators page uses.
import { calculateCloudDefinition, collectCloudIndicatorMetrics, loadOperationalIndicatorDefinitions } from '../../indicators/indicatorCloudService'

const fold = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// Risk 2025 is a risk register, not an indicator generator. Only risks with a
// meaningful, repeatable measure get suggestions here. In particular, the
// generic source value "Δείκτης Συμβάντος" must NOT turn every incident risk
// into a KPI; incident-specific indicators are added only when a reliable
// numerator/denominator exists in the Indicators module.
const RULES = [
  [/κεντρικ\S* (φλεβικ\S* )?(καθετηρ|γραμμ)|clabsi/, ['clabsi-per-1000-cvc-days', 'bundle-compliance', 'hh-compliance']],
  [/αναπνευστηρ|μηχανικ\S* αερισμ|(^|\W)vap(\W|$)/, ['vap-per-1000-ventilator-days', 'bundle-compliance', 'hh-compliance']],
  [/πολυανθεκτ|mdr|xdr|pdr|(^|\W)pam(\W|$)|kpc|(^|\W)cre(\W|$)/, ['mdro-bsi-rate', 'mdr-active-share', 'hh-compliance']],
  [/βακτηριαιμ|σηψ/, ['bacteremia-incidence-rate']],
  [/υγιειν\S* χεριων/, ['hh-compliance']],
  [/bundle|δεσμ\S* μετρ/, ['bundle-compliance']],
  [/ενδονοσοκομειακ|νοσοκομειακ\S* λοιμωξ|λοιμογον|(^|\s)εελ(\s|$)|επιδημ/, ['hai-prevalence-pps', 'hh-compliance', 'bundle-compliance']],
  [/αντιβιοτ|αντιμικροβ/, ['antibiotic-ddd-per-100-patient-days']],
  [/εμβολιασ/, ['vaccination-coverage']],
  [/ικανοποιησ\S* (ασθεν|ενδιαφερομεν)|patient satisfaction/, ['patient-satisfaction']],
]

// Indicators to propose for a risk, among those the organization has; the
// ones already linked are left out.
export function suggestIndicators(risk, available = [], limit = 3) {
  const have = new Set(available)
  const linked = new Set(risk.indicatorKeys || [])
  const text = fold([risk.hazard, risk.process, risk.scope, risk.indicator].join(' '))
  const out = []
  for (const [pattern, keys] of RULES) {
    if (!pattern.test(text)) continue
    for (const key of keys) if (have.has(key) && !linked.has(key) && !out.includes(key)) out.push(key)
  }
  return out.slice(0, limit)
}

const iso = (date) => date.toISOString().slice(0, 10)

// Current value (last 90 days) and the 90 days before, per indicator key.
export async function loadIndicatorValues(organizationId, now = new Date()) {
  const day = 86400000
  const to = iso(now), from = iso(new Date(now - 90 * day)), prevTo = iso(new Date(now - 91 * day)), prevFrom = iso(new Date(now - 181 * day))
  const [definitions, current, previous] = await Promise.all([
    loadOperationalIndicatorDefinitions(organizationId, { from, to }),
    collectCloudIndicatorMetrics(organizationId, { from, to }),
    collectCloudIndicatorMetrics(organizationId, { from: prevFrom, to: prevTo }),
  ])
  const values = new Map()
  for (const def of definitions) {
    const now90 = calculateCloudDefinition(def, current), before = calculateCloudDefinition(def, previous)
    values.set(def.id, { key: def.id, titleEl: def.titleEl, titleEn: def.titleEn || def.titleEl, category: def.category, unit: def.unit, unitEn: def.unitEn, target: def.target, direction: def.direction, value: now90.value, previous: before.value, status: now90.status, trend: indicatorTrend(now90.value, before.value, def.direction) })
  }
  return values
}

// better / worse / steady, read with the indicator's direction.
export function indicatorTrend(value, previous, direction) {
  if (value == null || previous == null || value === previous) return 'steady'
  if (direction !== 'higher' && direction !== 'lower') return 'steady'
  const up = value > previous
  return (direction === 'higher') === up ? 'better' : 'worse'
}
