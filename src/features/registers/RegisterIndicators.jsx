import { useMemo, useRef, useState } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Minus, Target } from 'lucide-react'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { IconButton } from '../../design-system/IconButton'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Sparkline } from '../../design-system/MiniCharts'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { exportRegistry } from '../../core/export/registryExports'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { PERIODS, breakdown, sheetBreakdowns, filterText, indicatorReport, monthlySeries, optionsOf, periodLabel, periodOf, shiftPeriod, textOf } from './registerEngine'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone } from './registerText'

const PERIOD_MONTHS = { month: 1, quarter: 3, half: 6, year: 12 }
const lastMonth = () => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7) }

// The report of a register: every indicator for a period, compared with the
// previous period and the same period last year, its trend month by month
// (with the target line) and its split by the register's list fields.
// onDefineTarget(indicatorId): opens the indicator in «Definition» (for those who may define the register).
export function RegisterIndicators({ register, entries, onDefineTarget = null }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const { notifyError } = useFeedback()
  const reportRef = useRef(null)
  const [kind, setKind] = useState('month')
  const [month, setMonth] = useState(lastMonth)
  const [openId, setOpenId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const period = periodOf(kind, `${month}-01`)
  const report = useMemo(() => indicatorReport(register, entries, period), [register, entries, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = report.find(row => row.indicator.id === openId) || null
  // First the indicators that are judged (better higher or lower), then the ones shown for context.
  const judged = report.filter(row => row.indicator.direction === 'higher' || row.indicator.direction === 'lower')
  const context = report.filter(row => !judged.includes(row))
  const groups = [{ key: 'judged', label: en ? 'With a direction or target' : 'Με στόχο ή κατεύθυνση', rows: judged }, { key: 'context', label: en ? 'For context' : 'Πληροφοριακοί', rows: context }].filter(group => group.rows.length)
  const title = `${en ? register.nameEn : register.name} · ${periodLabel(period, language)}`
  // The detail steps through the indicators in the table's order.
  const ordered = groups.flatMap(group => group.rows)
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
  return <RecordTabPanel className="register-indicators" title={en ? 'Indicators' : 'Δείκτες'} subtitle={en ? 'Computed from the entries; names never leave the department.' : 'Υπολογίζονται από τις καταχωρίσεις· τα ονόματα δεν φεύγουν από το τμήμα.'}
    actions={<div className="register-indicator-actions">
      <SearchableSelect hideLabel className="register-period-select" label={en ? 'Period' : 'Περίοδος'} value={kind} onChange={next=>next&&(setKind)(next)} options={optionsOf(PERIODS, language)}/>
      <PeriodStepper label={periodLabel(period, language)} onPrevious={() => step(-1)} onNext={() => step(1)} nextDisabled={shiftPeriod(period, PERIOD_MONTHS[kind]).from > new Date().toISOString().slice(0, 10)} />
      <ExportMenu disabled={!report.length} onExcel={exportCsv} onPdf={exportPdf} pdfBusy={exporting} />
    </div>}>
    <div ref={reportRef} className="register-indicator-report">
      {exporting && <h3 className="register-report-title">{title}</h3>}
      {open && <IndicatorDetail register={register} entries={entries} row={open} period={period} language={language} order={ordered} onOpen={setOpenId} onClose={() => setOpenId(null)} onDefineTarget={onDefineTarget} />}
      {!open && report.length > 0 && <table className="data-table register-indicator-table">
        <thead><tr><th>{en ? 'Indicator' : 'Δείκτης'}</th><th className="register-num">{en ? 'Value' : 'Τιμή'}</th><th>{en ? 'Target' : 'Στόχος'}</th><th>{en ? 'Last 12 months' : 'Τάση 12 μηνών'}</th><th>{en ? 'vs previous' : 'Έναντι προηγ.'}</th><th>{en ? 'vs last year' : 'Έναντι πέρσι'}</th></tr></thead>
        {groups.map(group => <tbody key={group.key}>
          {groups.length > 1 && <tr className="register-indicator-group"><th colSpan={6}>{group.label}</th></tr>}
          {group.rows.map(row => <IndicatorRow key={row.indicator.id} row={row} register={register} entries={entries} period={period} language={language} active={row.indicator.id === openId} onOpen={() => setOpenId(row.indicator.id)} onDefineTarget={onDefineTarget} />)}
        </tbody>)}
      </table>}
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

function IndicatorRow({ row, register, entries, period, language, active, onOpen, onDefineTarget }) {
  const en = language === 'en'
  const { indicator, current, previous, lastYear } = row
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  const trend = useMemo(() => lastTwelveMonths(register, indicator, entries, period), [register, indicator, entries, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // How the indicator is counted reads on hover, so the row stays short.
  const rule = register.kind === 'case' && indicator.filters?.length > 0 ? indicator.filters.map(filter => filterText(register, filter, language)).join(' · ') : ''
  const ratio = (indicator.aggregation === 'percent' || indicator.aggregation === 'rate') && current.denominator != null ? `${current.numerator} / ${current.denominator}${indicator.aggregation === 'rate' ? (en ? ' days' : ' ημ.') : ''}` : ''
  return <tr className={`registry-row-clickable register-indicator-row is-${current.status} ${active ? 'active' : ''}`} onClick={onOpen} tabIndex={0} aria-expanded={active} title={rule || undefined} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
    <td><strong>{textOf(indicator, language)}</strong>{current.small && <small className="register-indicator-small"><AlertTriangle size={12} />{en ? 'Few cases: read with caution' : 'Λίγα περιστατικά: με επιφύλαξη'}</small>}</td>
    <td className="register-num register-indicator-value"><strong>{formatIndicatorValue(current.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}{current.value != null && unit && unit !== '%' && <small> {shortUnit(unit)}</small>}</strong>{ratio && <small>{ratio}</small>}</td>
    <td>{current.status !== 'context' && <StatusBadge tone={indicatorStatusTone(current.status)}>{indicatorStatusLabel(current.status, language)}</StatusBadge>}{target != null && <small>{indicator.direction === 'higher' ? '≥' : '≤'} {formatIndicatorValue(target, { ...indicator, unit: shortUnit(indicator.unit) }, language)}</small>}{target == null && (onDefineTarget ? <button type="button" className="register-define-target" onClick={event => { event.stopPropagation(); onDefineTarget(indicator.id) }}><Target size={12} />{en ? 'Set a target' : 'Ορισμός στόχου'}</button> : current.status === 'context' && <span className="register-muted">—</span>)}</td>
    <td><Sparkline width={110} height={28} points={trend} target={target} label={en ? `${textOf(indicator, language)}: the last 12 months` : `${textOf(indicator, language)}: οι τελευταίοι 12 μήνες`} /></td>
    <td><Change now={current.value} before={previous.value} indicator={indicator} language={language} /></td>
    <td><Change now={current.value} before={lastYear.value} indicator={indicator} language={language} /></td>
  </tr>
}

function IndicatorDetail({ register, entries, row, period, language, order, onOpen, onClose, onDefineTarget }) {
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
    <header><h4>{textOf(indicator, language)}</h4>{(en ? indicator.noteEn || indicator.note : indicator.note) && <p>{en ? indicator.noteEn || indicator.note : indicator.note}</p>}</header>
    <div className="register-indicator-detail-figures">
      <span><small>{periodLabel(period, language)}</small><strong>{formatIndicatorValue(current.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}{current.value != null && unit && unit !== '%' && <em> {shortUnit(unit)}</em>}</strong>{(indicator.aggregation === 'percent' || indicator.aggregation === 'rate') && current.denominator != null && <small>{current.numerator} / {current.denominator}</small>}</span>
      <span><small>{en ? 'Target' : 'Στόχος'}</small><strong>{target == null ? '—' : `${indicator.direction === 'higher' ? '≥' : '≤'} ${formatIndicatorValue(target, { ...indicator, unit: unit === '%' ? '%' : '' }, language)}`}</strong>{target == null && onDefineTarget && <button type="button" className="register-define-target" onClick={() => onDefineTarget(indicator.id)}><Target size={12} />{en ? 'Set a target' : 'Ορισμός στόχου'}</button>}{current.status !== 'context' && <StatusBadge tone={indicatorStatusTone(current.status)}>{indicatorStatusLabel(current.status, language)}</StatusBadge>}</span>
      <span><small>{en ? 'vs previous' : 'Έναντι προηγ.'}</small><strong><Change now={current.value} before={previous.value} indicator={indicator} language={language} /></strong></span>
      <span><small>{en ? 'vs last year' : 'Έναντι πέρσι'}</small><strong><Change now={current.value} before={lastYear.value} indicator={indicator} language={language} /></strong></span>
    </div>
    <div className="register-trend" role="img" aria-label={en ? `Trend ${year}` : `Τάση ${year}`}>
      {target != null && <span className="register-trend-target" style={{ bottom: `${(target / top) * 100}%` }}><em>{en ? 'target' : 'στόχος'}</em></span>}
      {series.map(point => <span key={point.month} className={`register-trend-bar is-${point.status}`}>
        <i style={{ height: point.value == null ? 0 : `${Math.max(2, (point.value / top) * 100)}%` }} title={formatIndicatorValue(point.value, indicator, language)} />
        <b>{point.value == null ? '·' : formatIndicatorValue(point.value, { ...indicator, unit: indicator.unit === '%' ? '%' : '' }, language)}</b>
        <small>{short(point.month)}</small>
      </span>)}
    </div>
    {split && <div className="register-split">
      {splits.length > 1 ? <CanonicalTabs className="lo-subtabs" items={splits.map(item => ({ value: item.key, label: item.label }))} value={split.key} onChange={setSplitKey} ariaLabel={en ? 'Breakdown of the period' : 'Κατανομή της περιόδου'} /> : <h5>{split.label}</h5>}
      <table className="data-table"><tbody>{split.rows.map(item => <tr key={item.option.value || 'none'}><td className="register-row-label">{textOf(item.option, language)}</td><td className="register-num">{item.count}</td><td className="register-num">{item.share == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(item.share)}%`}</td><td className="register-split-bar"><i style={{ width: `${item.share || 0}%` }} /></td></tr>)}</tbody></table>
    </div>}
  </section>
}
