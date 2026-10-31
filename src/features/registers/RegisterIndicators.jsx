import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, ArrowUpDown, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Minus, Target } from 'lucide-react'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { IconButton } from '../../design-system/IconButton'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Sparkline } from '../../design-system/MiniCharts'
import { ExportMenu } from '../../design-system/ExportMenu'
import { KpiFigures } from '../../design-system/KpiCard'
import { FilterBar } from '../../design-system/FilterBar'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { exportRegistry } from '../../core/export/registryExports'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { PERIODS, breakdown, sheetBreakdowns, sheetCoverage, filterText, indicatorReport, monthlySeries, optionsOf, periodLabel, periodOf, shiftPeriod, textOf } from './registerEngine'
import { dailyFromOf } from './RegisterSheet'
import { caseMarker, registerThemeKey } from './registerThemes'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone } from './registerText'

const PERIOD_MONTHS = { month: 1, quarter: 3, half: 6, year: 12 }
// Worst first when sorting by status.
const STATUS_RANK = { breach: 0, attention: 1, onTarget: 2, context: 3 }
// The date an indicator counts on, in words («ανά ημερομηνία εξόδου»): shown when a register's indicators do not all count on the same one.
const basisOf = (register, indicator, language) => {
  const field = (register.fields || []).find(item => item.key === (indicator.dateField || register.settings?.entryDateField))
  return field ? `${language === 'en' ? 'by' : 'ανά'} ${textOf(field, language).toLowerCase()}` : ''
}
const lastMonth = () => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7) }

// The report of a register: every indicator for a period, compared with the
// previous period and the same period last year, its trend month by month
// (with the target line) and its split by the register's list fields.
// onDefineTarget(indicatorId): opens the indicator in «Definition» (for those who may define the register).
export function RegisterIndicators({ register, entries: allEntries, onDefineTarget = null, onExportApi = null }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notifyError } = useFeedback()
  const reportRef = useRef(null)
  // The NICU, the ICU and any register with rates per 1,000 days have few events a month: they open on the quarter. The ICU can be read for one kind of patient.
  const [kind, setKind] = useState(() => (registerThemeKey(register) || register.indicators.some(item => ['rate', 'smr'].includes(item.aggregation)) ? 'quarter' : 'month'))
  const [category, setCategory] = useState('all')
  const categories = registerThemeKey(register) === 'icu' ? (register.fields.find(field => field.key === 'category')?.options || []) : []
  const entries = useMemo(() => (category === 'all' ? allEntries : allEntries.filter(entry => entry.values?.category === category)), [allEntries, category])
  const [month, setMonth] = useState(lastMonth)
  const [openId, setOpenId] = useState(null)
  const [exporting, setExporting] = useState(false)
  // The cards above the table filter it by status; the search and the sort work on the shown rows.
  const [statusFilter, setStatusFilter] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const period = periodOf(kind, `${month}-01`)
  const report = useMemo(() => indicatorReport(register, entries, period), [register, entries, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = report.find(row => row.indicator.id === openId) || null
  // First the indicators that are judged (better higher or lower), then the ones shown for context.
  const count = status => report.filter(row => row.current.status === status).length
  const needle = query.trim().toLowerCase()
  const shown = report
    .filter(row => !statusFilter || row.current.status === statusFilter)
    .filter(row => !needle || textOf(row.indicator, language).toLowerCase().includes(needle))
  const sortValue = { name: row => textOf(row.indicator, language).toLowerCase(), value: row => row.current.value, status: row => STATUS_RANK[row.current.status] ?? 9 }[sort.key]
  const sorted = !sortValue ? shown : [...shown].sort((a, b) => {
    const x = sortValue(a), y = sortValue(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (typeof x === 'string' ? x.localeCompare(y, language) : x - y) * (sort.dir === 'asc' ? 1 : -1)
  })
  const toggleSort = key => setSort(current => current.key !== key ? { key, dir: 'asc' } : current.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' })
  const sortHead = (key, label, className) => <th className={className} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}><button type="button" className={`register-sort ${sort.key === key ? 'is-sorted' : ''}`} onClick={() => toggleSort(key)}>{label}<ArrowUpDown size={12} aria-hidden="true" /></button></th>
  const figure = (key, icon, status, label, tone) => ({ key, icon, value: count(status), label, status: tone && count(status) > 0 ? tone : null, active: statusFilter === status, go: () => setStatusFilter(current => current === status ? null : status) })
  const figures = [
    figure('onTarget', CheckCircle2, 'onTarget', en ? 'On target' : 'Εντός στόχου', 'good'),
    figure('attention', AlertTriangle, 'attention', en ? 'Below target' : 'Εκτός στόχου', 'warning'),
    figure('breach', AlertOctagon, 'breach', en ? 'Past the limit' : 'Πέρα από το όριο', 'danger'),
    figure('context', CircleDashed, 'context', en ? 'No target' : 'Χωρίς στόχο', null),
  ]
  // First the indicators that are judged (better higher or lower), then the ones shown for context.
  const judged = sorted.filter(row => row.indicator.direction === 'higher' || row.indicator.direction === 'lower')
  const context = sorted.filter(row => !judged.includes(row))
  const groups = [{ key: 'judged', label: en ? 'With a direction or target' : 'Με στόχο ή κατεύθυνση', rows: judged }, { key: 'context', label: en ? 'For context' : 'Πληροφοριακοί', rows: context }].filter(group => group.rows.length)
  // A sorted list is one list: the groups would break the order.
  const grouped = !sort.key ? groups : [{ key: 'all', label: '', rows: sorted }].filter(group => group.rows.length)
  const mixedBasis = register.kind === 'case' && new Set(register.indicators.map(item => item.dateField || register.settings?.entryDateField || '')).size > 1
  const title = `${en ? register.nameEn : register.name} · ${periodLabel(period, language)}`
  // The detail steps through the indicators in the table's order.
  const ordered = grouped.flatMap(group => group.rows)
  // A step moves by the period shown: a month, a quarter, a half-year or a year.
  const step = direction => setMonth(shiftPeriod(period, direction * PERIOD_MONTHS[kind]).from.slice(0, 7))
  function exportCsv() {
    exportRegistry({ name: `${register.code}_${period.from}_${period.to}`, headers: en ? ['Indicator', 'Value', 'Numerator', 'Denominator', 'Previous period', 'Same period last year', 'Target', 'Limit', 'Status'] : ['Δείκτης', 'Τιμή', 'Αριθμητής', 'Παρονομαστής', 'Προηγούμενη περίοδος', 'Ίδια περίοδος πέρσι', 'Στόχος', 'Όριο', 'Κατάσταση'], rows: report.map(({ indicator, current, previous, lastYear }) => [textOf(indicator, language), current.value ?? '', current.numerator ?? '', current.denominator ?? '', previous.value ?? '', lastYear.value ?? '', indicator.target ?? '', indicator.threshold ?? '', indicatorStatusLabel(current.status, language)]) })
  }
  async function exportPdf() {
    if (!reportRef.current) return
    setExporting(true)
    // The report's title shows in the file only: on screen the header and the period already say it.
    await new Promise(resolve => setTimeout(resolve, 0))
    try { await exportElementAsPdf({ element: reportRef.current, filename: `${register.code}_${period.from}_${period.to}` }) } catch (error) { notifyError(error, 'export', { operation: 'register_indicators_pdf' }) } finally { setExporting(false) }
  }
  // The record's header shows «Export ▾» for this tab too: the page gets the handlers.
  useEffect(() => { onExportApi?.({ excel: exportCsv, pdf: exportPdf, busy: exporting, disabled: !report.length }); return () => onExportApi?.(null) }, [report, exporting]) // eslint-disable-line react-hooks/exhaustive-deps
  return <RecordTabPanel className="register-indicators" title={en ? 'Indicators' : 'Δείκτες'} subtitle={en ? 'Computed from the entries; names never leave the department.' : 'Υπολογίζονται από τις καταχωρίσεις· τα ονόματα δεν φεύγουν από το τμήμα.'}
    actions={<div className="register-indicator-actions">
      <SearchableSelect hideLabel className="register-period-select" label={en ? 'Period' : 'Περίοδος'} value={kind} onChange={next=>next&&(setKind)(next)} options={optionsOf(PERIODS, language)}/>
      <PeriodStepper label={periodLabel(period, language)} onPrevious={() => step(-1)} onNext={() => step(1)} nextDisabled={shiftPeriod(period, PERIOD_MONTHS[kind]).from > new Date().toISOString().slice(0, 10)} />
      {!onExportApi && <ExportMenu disabled={!report.length} onExcel={exportCsv} onPdf={exportPdf} pdfBusy={exporting} />}
    </div>}>
    <div ref={reportRef} className="register-indicator-report">
      {exporting && <h3 className="register-report-title">{title}</h3>}
      {!open && categories.length > 0 && <div className="register-category-filter" role="group" aria-label={en ? 'Kind of patient' : 'Είδος ασθενούς'}>
        {[{ value: 'all', label: en ? 'All' : 'Όλοι' }, ...categories.map(option => { const marker = caseMarker(register, { category: option.value }, language); return { value: option.value, label: marker?.label || textOf(option, language), Icon: marker?.Icon } })].map(({ value, label, Icon }) => <button key={value} type="button" className={`is-${value}${category === value ? ' is-selected' : ''}`} aria-pressed={category === value} onClick={() => setCategory(value)}>{Icon && <Icon size={15} aria-hidden="true" />}{label}</button>)}
      </div>}
      {!open && report.length > 0 && <KpiFigures label={en ? 'Indicators by status' : 'Δείκτες ανά κατάσταση'} figures={figures} />}
      {!open && report.length > 0 && <FilterBar query={query} onQueryChange={setQuery} placeholder={en ? 'Search an indicator' : 'Αναζήτηση δείκτη'} activeAdvancedCount={statusFilter ? 1 : 0} onClear={() => { setQuery(''); setStatusFilter(null) }} />}
      {open && <IndicatorDetail basis={mixedBasis ? basisOf(register, open.indicator, language) : ''} register={register} entries={entries} onPickMonth={value => { setKind('month'); setMonth(value) }} row={open} period={period} language={language} order={ordered} onOpen={setOpenId} onClose={() => setOpenId(null)} onDefineTarget={onDefineTarget} />}
      {!open && report.length > 0 && <table className="data-table register-indicator-table">
        <thead><tr>{sortHead('name', en ? 'Indicator' : 'Δείκτης')}{sortHead('value', en ? 'Value' : 'Τιμή', 'register-num')}{sortHead('status', en ? 'Target' : 'Στόχος')}<th>{en ? 'Last 12 months' : 'Τάση 12 μηνών'}</th><th>{en ? 'Change' : 'Μεταβολή'}</th></tr></thead>
        {grouped.map(group => <tbody key={group.key}>
          {grouped.length > 1 && <tr className="register-indicator-group"><th colSpan={5}>{group.label}</th></tr>}
          {group.rows.map(row => <IndicatorRow key={row.indicator.id} basis={mixedBasis ? basisOf(register, row.indicator, language) : ''} row={row} register={register} entries={entries} period={period} language={language} active={row.indicator.id === openId} onOpen={() => setOpenId(row.indicator.id)} onDefineTarget={onDefineTarget} />)}
        </tbody>)}
      </table>}
      {!open && report.length > 0 && !shown.length && <div className="inline-empty">{en ? 'No indicator matches. Clear the filters to see all.' : 'Κανένας δείκτης δεν ταιριάζει. Καθαρίστε τα φίλτρα για να δείτε όλους.'}</div>}
      {!report.length && <div className="inline-empty">{en ? 'This register has no indicators yet. Add them in «Definition».' : 'Το μητρώο δεν έχει ακόμη δείκτες. Προσθέστε τους στον «Ορισμό».'}</div>}
    </div>
  </RecordTabPanel>
}

// A unit short enough to sit beside the value («/1.000 ημ. καθετήρα»).
const shortUnit = unit => String(unit || '').replace(/ημέρες/g, 'ημ.').replace(/ημέρα/g, 'ημ.').replace(/\bdays\b/g, 'd')

function Change({ now, before, indicator, language }) {
  const en = language === 'en'
  if (now == null || before == null) return <span className="register-change">—</span>
  const diff = Number((now - before).toFixed(2))
  const better = indicator.direction === 'higher' ? diff > 0 : indicator.direction === 'lower' ? diff < 0 : null
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
  return <span className={`register-change ${better == null || diff === 0 ? '' : better ? 'is-better' : 'is-worse'}`} title={en ? 'Change' : 'Μεταβολή'}><Icon size={13} />{diff > 0 ? '+' : diff < 0 ? '−' : ''}{formatIndicatorValue(Math.abs(diff), { ...indicator, unit: indicator.unit === '%' ? '%' : '', unitEn: indicator.unit === '%' ? '%' : '' }, language)}</span>
}

// The twelve months up to the end of the period, for the card's sparkline.
function lastTwelveMonths(register, indicator, entries, period) {
  const year = Number(period.to.slice(0, 4)), month = Number(period.to.slice(5, 7))
  const months = [...monthlySeries(register, indicator, entries, year - 1), ...monthlySeries(register, indicator, entries, year)]
  return months.slice(month, month + 12).map(point => point.value)
}

function IndicatorRow({ basis, row, register, entries, period, language, active, onOpen, onDefineTarget }) {
  const en = language === 'en'
  const { indicator, current, previous, lastYear } = row
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  const trend = useMemo(() => lastTwelveMonths(register, indicator, entries, period), [register, indicator, entries, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // How the indicator is counted reads on hover, so the row stays short.
  const rule = register.kind === 'case' && indicator.filters?.length > 0 ? indicator.filters.map(filter => filterText(register, filter, language)).join(' · ') : ''
  const ratio = (indicator.aggregation === 'percent' || indicator.aggregation === 'rate' || indicator.aggregation === 'smr') && current.denominator != null ? `${current.numerator} / ${current.denominator}${indicator.aggregation === 'rate' ? (en ? ' days' : ' ημ.') : ''}` : ''
  return <tr className={`registry-row-clickable register-indicator-row is-${current.status} ${active ? 'active' : ''}`} onClick={onOpen} tabIndex={0} aria-expanded={active} title={rule || undefined} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
    <td><strong>{textOf(indicator, language)}</strong>{basis && <small className="register-indicator-basis">{basis}</small>}{current.small && <small className="register-indicator-small"><AlertTriangle size={12} />{en ? 'Few cases: read with caution' : 'Λίγα περιστατικά: με επιφύλαξη'}</small>}</td>
    <td className="register-num register-indicator-value"><strong>{formatIndicatorValue(current.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}{current.value != null && unit && unit !== '%' && <small> {shortUnit(unit)}</small>}</strong>{ratio && <small>{ratio}</small>}</td>
    <td>{current.status !== 'context' && <StatusBadge tone={indicatorStatusTone(current.status)}>{indicatorStatusLabel(current.status, language)}</StatusBadge>}{target != null && <small>{indicator.direction === 'higher' ? '≥' : '≤'} {formatIndicatorValue(target, { ...indicator, unit: shortUnit(indicator.unit) }, language)}</small>}{target == null && (onDefineTarget ? <button type="button" className="register-define-target" onClick={event => { event.stopPropagation(); onDefineTarget(indicator.id) }}><Target size={12} />{en ? 'Set a target' : 'Ορισμός στόχου'}</button> : current.status === 'context' && <span className="register-muted">—</span>)}</td>
    <td><Sparkline width={110} height={28} points={trend} target={target} label={en ? `${textOf(indicator, language)}: the last 12 months` : `${textOf(indicator, language)}: οι τελευταίοι 12 μήνες`} /></td>
    <td className="register-change-cell"><span><Change now={current.value} before={previous.value} indicator={indicator} language={language} /><small>{en ? 'vs previous' : 'έναντι προηγ.'}</small></span><span><Change now={current.value} before={lastYear.value} indicator={indicator} language={language} /><small>{en ? 'vs last year' : 'έναντι πέρσι'}</small></span></td>
  </tr>
}

function IndicatorDetail({ basis, register, entries, onPickMonth, row, period, language, order, onOpen, onClose, onDefineTarget }) {
  const en = language === 'en'
  const { indicator, current, previous, lastYear } = row
  const year = period.from.slice(0, 4)
  const series = monthlySeries(register, indicator, entries, year)
  const values = series.map(point => point.value).filter(value => value != null)
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const top = Math.max(1, ...values, target ?? 0)
  const short = month => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), month - 1, 1)))
  // The breakdowns: a case register's list fields; a sheet's rows and measures (per procedure, per shift).
  const splits = register.kind === 'case'
    ? (register.settings?.breakdowns || []).map(key => { const field = register.fields.find(item => item.key === key); return field && { key, label: `${en ? 'By' : 'Ανά'} ${textOf(field, language).toLowerCase()}`, rows: breakdown(register, indicator, entries, period, key) } }).filter(split => split && split.rows.length)
    : sheetBreakdowns(register, indicator, entries, period).map(split => ({ ...split, label: en ? split.labelEn : split.label }))
  const [splitKey, setSplitKey] = useState(null)
  const split = splits.find(item => item.key === splitKey) || splits[0] || null
  const index = order.findIndex(item => item.indicator.id === indicator.id)
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  return <section className="register-indicator-detail">
    <nav className="register-indicator-detail-nav">
      <button type="button" className="register-indicator-back" onClick={onClose}><ArrowLeft size={14} />{en ? 'All indicators' : 'Όλοι οι δείκτες'}</button>
      <span className="register-indicator-detail-steps">
        <IconButton size="sm" label={en ? 'Previous indicator' : 'Προηγούμενος δείκτης'} disabled={index <= 0} onClick={() => onOpen(order[index - 1].indicator.id)}><ChevronLeft size={15} /></IconButton>
        <small>{index + 1} / {order.length}</small>
        <IconButton size="sm" label={en ? 'Next indicator' : 'Επόμενος δείκτης'} disabled={index >= order.length - 1} onClick={() => onOpen(order[index + 1].indicator.id)}><ChevronRight size={15} /></IconButton>
      </span>
    </nav>
    <header><h4>{textOf(indicator, language)}</h4>{basis && <small className="register-indicator-basis">{basis}</small>}{(en ? indicator.noteEn || indicator.note : indicator.note) && <p>{en ? indicator.noteEn || indicator.note : indicator.note}</p>}</header>
    <div className="register-indicator-detail-figures">
      <span><small>{periodLabel(period, language)}</small><strong>{formatIndicatorValue(current.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}{current.value != null && unit && unit !== '%' && <em> {shortUnit(unit)}</em>}</strong>{(indicator.aggregation === 'percent' || indicator.aggregation === 'rate' || indicator.aggregation === 'smr') && current.denominator != null && <small>{current.numerator} / {current.denominator}</small>}</span>
      <span><small>{en ? 'Target' : 'Στόχος'}</small><strong>{target == null ? '—' : `${indicator.direction === 'higher' ? '≥' : '≤'} ${formatIndicatorValue(target, { ...indicator, unit: unit === '%' ? '%' : '' }, language)}`}</strong>{target == null && onDefineTarget && <button type="button" className="register-define-target" onClick={() => onDefineTarget(indicator.id)}><Target size={12} />{en ? 'Set a target' : 'Ορισμός στόχου'}</button>}{current.status !== 'context' && <StatusBadge tone={indicatorStatusTone(current.status)}>{indicatorStatusLabel(current.status, language)}</StatusBadge>}</span>
      <span><small>{en ? 'vs previous' : 'Έναντι προηγ.'}</small><strong><Change now={current.value} before={previous.value} indicator={indicator} language={language} /></strong></span>
      <span><small>{en ? 'vs last year' : 'Έναντι πέρσι'}</small><strong><Change now={current.value} before={lastYear.value} indicator={indicator} language={language} /></strong></span>
    </div>
    <div className="register-trend" role="group" aria-label={en ? `Trend ${year}: pick a month to see it` : `Τάση ${year}: επιλέξτε μήνα για να τον δείτε`}>
      {target != null && <span className="register-trend-target" style={{ bottom: `${(target / top) * 100}%` }}><em>{en ? 'target' : 'στόχος'}</em></span>}
      {series.map(point => {
        const shownValue = formatIndicatorValue(point.value, { ...indicator, unit: indicator.unit === '%' ? '%' : '' }, language)
        const inPeriod = point.period.from >= period.from && point.period.to <= period.to
        return <button type="button" key={point.month} className={`register-trend-bar is-${point.status} ${point.value == null ? 'is-empty' : ''} ${inPeriod ? 'is-current' : ''}`} onClick={() => onPickMonth(`${year}-${String(point.month).padStart(2, '0')}`)} aria-label={`${short(point.month)} ${year}: ${point.value == null ? (en ? 'no data' : 'χωρίς στοιχεία') : formatIndicatorValue(point.value, indicator, language)}`} aria-pressed={inPeriod} title={point.value == null ? (en ? 'No data' : 'Χωρίς στοιχεία') : formatIndicatorValue(point.value, indicator, language)}>
          <i style={{ height: point.value == null ? undefined : `${Math.max(2, (point.value / top) * 100)}%` }} />
          <b>{point.value == null ? '' : shownValue}</b>
          <small>{short(point.month)}</small>
        </button>
      })}
    </div>
    {register.kind === 'sheet' && <SheetCoverage entries={entries} period={period} dailyFrom={dailyFromOf(register)} language={language} />}
    {split && <div className="register-split">
      {splits.length > 1 ? <CanonicalTabs className="lo-subtabs" items={splits.map(item => ({ value: item.key, label: item.label }))} value={split.key} onChange={setSplitKey} ariaLabel={en ? 'Breakdown of the period' : 'Κατανομή της περιόδου'} /> : <h5>{split.label}</h5>}
      <table className="data-table"><tbody>{split.rows.map(item => <tr key={item.option.value || 'none'}><td className="register-row-label">{textOf(item.option, language)}</td><td className="register-num">{item.count}</td><td className="register-num">{item.share == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(item.share)}%`}</td><td className="register-split-bar"><i style={{ width: `${item.share || 0}%` }} /></td></tr>)}</tbody></table>
    </div>}
  </section>
}

// How much of the period the sheet has: a value over few days is read with that in mind.
function SheetCoverage({ entries, period, dailyFrom, language }) {
  const en = language === 'en'
  const coverage = sheetCoverage(entries, period, new Date().toISOString().slice(0, 10), dailyFrom)
  if (!coverage) return null
  const missing = coverage.expected - coverage.recorded
  const unit = coverage.unit === 'day' ? (en ? 'days' : 'ημέρες') : (en ? 'months' : 'μήνες')
  const recordedLabel = coverage.unit === 'day' ? 'Καταχωρισμένες ημέρες' : 'Καταχωρισμένοι μήνες'
  return <p className={`register-coverage ${missing > 0 ? 'is-partial' : ''}`}>
    {missing > 0 ? <AlertTriangle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
    <span><strong>{en ? `Recorded ${unit}` : recordedLabel}: {coverage.recorded} / {coverage.expected}</strong>{missing > 0 ? (en ? ` — ${missing} missing, so the value rests on part of the period.` : ` — λείπουν ${missing}, η τιμή στηρίζεται σε μέρος της περιόδου.`) : ''}</span>
  </p>
}
