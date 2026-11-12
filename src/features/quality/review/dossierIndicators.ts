import { escapeHtml } from '../../../core/export/reportDocument'
import { calculateCloudDefinition, collectCloudIndicatorMetrics, loadIndicatorSnapshots } from '../../indicators/indicatorCloudService'
import { loadEntries, loadRegisters } from '../../registers/registerService'
import { computeIndicator, textOf as registerText } from '../../registers/registerEngine'
import { hospitalToday } from '../../../core/dates/hospitalDate'

// The indicators of the year's file: each with how it was computed (numerator / denominator, or the value entered by hand)
// and, where it has no value, why: the data the platform does not record. The same reasons make the file's last page.

const yearEnd = year => { const end = `${year}-12-31`, today = hospitalToday(); return end < today ? end : today }

// What is missing, by the metric that is empty. Each reason is one line of the «missing data» page.
const MISSING = {
  central_line_days: ['Δεν καταγράφονται ημέρες κεντρικού καθετήρα', 'Central-line days are not recorded'],
  urinary_catheter_days: ['Δεν καταγράφονται ημέρες ουροκαθετήρα', 'Urinary-catheter days are not recorded'],
  ventilator_days: ['Δεν καταγράφονται ημέρες αναπνευστήρα', 'Ventilator days are not recorded'],
  patient_days: ['Δεν καταγράφονται ημέρες νοσηλείας', 'Patient days are not recorded'],
  hh_opportunities: ['Δεν καταγράφηκαν παρατηρήσεις υγιεινής χεριών', 'No hand-hygiene observations were recorded'],
  bundle_executions: ['Δεν καταγράφηκαν εφαρμογές δεσμών μέτρων', 'No care-bundle checks were recorded'],
  amr_tested: ['Δεν καταγράφονται αντιβιογράμματα ανά αντιβιοτικό', 'Susceptibility results per antibiotic are not recorded'],
  active_surveillance: ['Δεν υπάρχουν περιστατικά επιτήρησης', 'There are no surveillance cases'],
  active_staff: ['Δεν υπάρχει καταγεγραμμένο προσωπικό', 'No staff are recorded'],
  training_assignments: ['Δεν υπάρχουν αναθέσεις εκπαίδευσης', 'There are no training assignments'],
  pps_patients_total: ['Δεν έγινε μελέτη επιπολασμού', 'No point-prevalence survey was done'],
  antibiotic_ddd_total: ['Δεν καταγράφονται χορηγήσεις αντιβιοτικών', 'Antibiotic dispensing is not recorded'],
  surgical_procedures: ['Δεν καταγράφονται χειρουργικές επεμβάσεις', 'Surgical procedures are not recorded'],
  manual: ['Δεν έχει καταχωριστεί τιμή για το έτος', 'No value has been entered for the year'],
  register: ['Δεν υπάρχουν καταχωρίσεις στο μητρώο για το έτος', 'The register has no entries for the year'],
  register_field: ['Το πεδίο δεν καταγράφεται στο μητρώο', 'The field is not recorded in the register'],
  microbiology_results_in_period: ['Δεν υπάρχουν αποτελέσματα μικροβιολογίας στο έτος', 'There are no microbiology results in the year'],
  audit_answers_applicable: ['Δεν ολοκληρώθηκε εσωτερικός έλεγχος στο έτος', 'No internal audit was completed in the year'],
  source: ['Η πηγή του δείκτη δεν καταγράφεται ακόμα', 'The indicator’s source is not recorded yet'],
  zero: ['Ο παρονομαστής είναι μηδέν', 'The denominator is zero'],
}
const missingKey = metric => {
  if (!metric) return 'zero'
  if (metric.startsWith('amr_tested')) return 'amr_tested'
  if (metric.startsWith('central_line_days')) return 'central_line_days'
  if (/^(bacteremia_|mdr_isolation_|mdro_bsi)/.test(metric)) return 'microbiology_results_in_period'
  if (metric === 'audit_major_findings') return 'audit_answers_applicable'
  return MISSING[metric] ? metric : 'zero'
}
// Metrics that read 0 when their source is not recorded at all: a value of 0 from them is no value.
const SOURCE_METRICS = new Set(['antibiotic_ddd_total', 'aware_access_ddd_total'])

export const missingText = (key, en) => (MISSING[key] || MISSING.zero)[en ? 1 : 0]

// One platform indicator for the year: its value, the numerator and denominator it came from, and the reason when it has no value.
export function dossierIndicatorResult(def, metrics, manual = null) {
  if (def.calculation === 'manual') {
    const value = manual && Number.isFinite(Number(manual.value)) ? Number(manual.value) : null
    return { value, manual, evidence: null, missing: value == null ? 'manual' : null }
  }
  // Surgical-site infections are counted per surgical procedure; the platform records no procedures, so no rate is shown.
  if (def.numerator === 'ssi_episodes') {
    const numerator = Number(metrics?.ssi_episodes ?? 0)
    return { value: null, numerator, denominator: null, evidence: null, ssi: numerator, missing: 'surgical_procedures' }
  }
  const result = calculateCloudDefinition(def, metrics || {})
  if (SOURCE_METRICS.has(def.numerator) && !Number(result.numerator)) return { value: null, numerator: result.numerator, evidence: null, missing: 'antibiotic_ddd_total' }
  if (def.denominator && !Number(result.denominator)) return { value: null, numerator: result.numerator, denominator: result.denominator, evidence: null, missing: missingKey(def.denominator) }
  return { value: result.value, numerator: result.numerator, denominator: result.denominator, evidence: def.denominator ? [result.numerator ?? 0, result.denominator] : null, missing: result.value == null ? (result.numerator == null ? 'source' : missingKey(def.numerator)) : null }
}

// The value entered by hand for a manual indicator in the year: the whole year if entered so, else the latest period of the year.
export function manualForYear(snapshots, key, year) {
  const inYear = (snapshots || []).filter(row => row.indicator_key === key && row.calculation_type === 'manual' && !row.department_id && String(row.period_start || '').startsWith(String(year)) && row.value != null)
  if (!inYear.length) return null
  const whole = inYear.find(row => row.period_start === `${year}-01-01` && String(row.period_end) >= `${year}-12-31`)
  const row = whole || [...inYear].sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)))[0]
  return { value: Number(row.value), from: row.period_start, to: row.period_end }
}

// The platform's indicators of the year, computed once from the year's data, with the values entered by hand.
export async function loadDossierIndicators(organizationId, year, definitions = []) {
  if (year > new Date().getFullYear()) return definitions.map(def => ({ def, value: null, missing: null }))
  const [metrics, snapshots] = await Promise.all([
    collectCloudIndicatorMetrics(organizationId, { from: `${year}-01-01`, to: yearEnd(year) }).catch(() => null),
    definitions.some(def => def.calculation === 'manual') ? loadIndicatorSnapshots(organizationId, {}).catch(() => []) : [],
  ])
  return definitions.map(def => ({ def, ...(metrics || def.calculation === 'manual' ? dossierIndicatorResult(def, metrics, manualForYear(snapshots, def.id, year)) : { value: null, missing: null }) }))
}

// Every indicator of the active registers for the year, computed from their entries.
export async function loadRegisterIndicators(organizationId, year) {
  const registers = (await loadRegisters(organizationId).catch(() => [])).filter(register => register.status === 'active' && (register.indicators || []).some(indicator => !indicator.archived))
  const lists = await Promise.all(registers.map(register => loadEntries(organizationId, register.id, { register }).catch(() => [])))
  const period = { from: `${year}-01-01`, to: yearEnd(year), key: `range:${year}-01-01:${yearEnd(year)}` }
  return registers.flatMap((register, index) => (register.indicators || []).filter(indicator => !indicator.archived).map(indicator => {
    const result = computeIndicator(register, indicator, lists[index], period)
    return {
      register: { id: register.id, name: register.name, nameEn: register.nameEn || register.name },
      titleEl: registerText(indicator, 'el'), titleEn: registerText(indicator, 'en'),
      unit: indicator.unit || '', unitEn: indicator.unitEn || indicator.unit || '',
      target: indicator.target === '' || indicator.target == null ? null : Number(indicator.target), direction: indicator.direction,
      value: result.value, evidence: result.denominator != null && result.value != null ? [result.numerator ?? 0, result.denominator] : null,
      status: result.status, missing: result.value == null ? (result.notRecorded ? 'register_field' : 'register') : null,
    }
  }))
}

const decimal = (value, en) => String(value).replace('.', en ? '.' : ',')
const thousands = (value, en) => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(Number(value))
export const evidenceText = (row, language) => {
  const en = language === 'en'
  if (row.manual) return en ? `Entered by hand (${row.manual.from} – ${row.manual.to})` : `Καταχώριση (${row.manual.from.split('-').reverse().join('/')} – ${row.manual.to.split('-').reverse().join('/')})`
  if (row.ssi != null) return en ? `${row.ssi} infections` : `${row.ssi} λοιμώξεις`
  return row.evidence ? `${thousands(row.evidence[0], en)} / ${thousands(row.evidence[1], en)}` : '—'
}
export const valueText = (value, unit, language) => {
  const en = language === 'en'
  if (value == null) return '—'
  return `${decimal(value, en)}${unit && unit !== '%' ? `${unit.startsWith('/') ? '' : ' '}${unit}` : unit || ''}`
}
const targetText = (target, direction, unit) => (target == null ? '—' : `${direction === 'lower' ? '≤' : '≥'} ${target}${unit === '%' ? '%' : ''}`)
const judged = (value, target, direction) => (value == null || target == null || !['higher', 'lower'].includes(direction) ? null : direction === 'lower' ? value <= target : value >= target)
const stateCell = (row, met, en) => (row.value == null
  ? { text: row.missing ? missingText(row.missing, en) : en ? 'Not started yet' : 'Δεν έχει ξεκινήσει ο υπολογισμός', className: 'rd-muted' }
  : met == null ? { text: en ? 'No target' : 'Χωρίς στόχο', className: '' } : { text: met ? (en ? 'On target' : 'Εντός στόχου') : (en ? 'Off target' : 'Εκτός στόχου'), className: met ? 'rd-good' : 'rd-bad' })

// The table of the platform's indicators: the hospital's objective, where it has one, is the target.
export function platformIndicatorsTable(indicatorRows, objectives, language) {
  const en = language === 'en'
  return {
    columns: [en ? 'Indicator' : 'Δείκτης', en ? 'Value' : 'Τιμή', en ? 'Computed from' : 'Υπολογισμός', en ? 'Target' : 'Στόχος', en ? 'Status' : 'Κατάσταση'],
    rows: indicatorRows.map(row => {
      const base = row.def
      const own = (objectives || []).find(objective => objective.platformIndicatorKey === base.id && objective.target !== '' && objective.target != null)
      const def = own ? { ...base, target: Number(own.target), direction: own.direction } : base
      const unit = en ? def.unitEn || def.unit : def.unit
      return [en ? def.titleEn || def.titleEl : def.titleEl, valueText(row.value, unit, language), evidenceText(row, language), targetText(def.target, def.direction, def.unit), stateCell(row, judged(row.value, def.target, def.direction), en)]
    }),
  }
}

// The registers' indicators with a target, one table per register (the same four columns as the indicators' print);
// the ones without a target only inform and stay in their register.
export function registerIndicatorSections(registerRows, language) {
  const en = language === 'en'
  const columns = [{ text: en ? 'Indicator' : 'Δείκτης', width: '52%' }, { text: en ? 'Value' : 'Τιμή', align: 'right', width: '18%' }, { text: en ? 'Target' : 'Στόχος', width: '9%' }, { text: en ? 'Status' : 'Κατάσταση', width: '21%' }]
  const groups = []
  for (const row of registerRows.filter(item => item.target != null && item.target !== '')) {
    const name = (en ? row.register.nameEn : row.register.name) || row.register.name
    const group = groups.find(item => item.name === name)
    if (group) group.rows.push(row); else groups.push({ name, rows: [row] })
  }
  return groups.map(({ name, rows }) => ({ title: `${name} (${rows.length})`, table: { columns, rows: rows.map(row => {
    const evidence = evidenceText(row, language)
    return [en ? row.titleEn || row.titleEl : row.titleEl, { align: 'right', html: `${escapeHtml(valueText(row.value, en ? row.unitEn : row.unit, language))}${evidence && evidence !== '—' ? `<small>${escapeHtml(evidence)}</small>` : ''}` }, targetText(row.target, row.direction, row.unit), stateCell(row, judged(row.value, row.target, row.direction), en)]
  }) } }))
}

// The file's last page: what is missing, grouped by reason, with the indicators and objectives it leaves without a value.
export function missingDataTable({ indicatorRows = [], registerRows = [], objectives = [] }, language) {
  const en = language === 'en'
  const groups = new Map()
  const add = (key, name) => { const list = groups.get(key) || []; if (!list.includes(name)) list.push(name); groups.set(key, list) }
  for (const row of indicatorRows) if (row.value == null && row.missing) add(row.missing, en ? row.def.titleEn || row.def.titleEl : row.def.titleEl)
  for (const row of registerRows) if (row.value == null) add(row.missing || 'register', `${en ? row.titleEn || row.titleEl : row.titleEl} (${en ? row.register.nameEn : row.register.name})`)
  const noValue = (objectives || []).filter(objective => objective.current?.value == null)
  const rows = [...groups.entries()].map(([key, names]) => [missingText(key, en), String(names.length), names.join(' · ')])
  if (noValue.length) rows.push([en ? 'Objectives with no value yet' : 'Στόχοι χωρίς τιμή ακόμα', String(noValue.length), noValue.map(objective => objective.code).join(' · ')])
  return rows.length ? { columns: [en ? 'What is missing' : 'Τι λείπει', en ? 'Affected' : 'Πλήθος', en ? 'Indicators and objectives without a value' : 'Δείκτες και στόχοι χωρίς τιμή'], rows } : null
}
