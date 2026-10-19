import { useMemo, useRef, useState } from 'react'
import { SearchableSelect } from '../../design-system/SearchableSelect'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { PeriodStepper } from '../../design-system/PeriodStepper'
import { StatusBadge } from '../../design-system/StatusBadge'
import { Sparkline } from '../../design-system/MiniCharts'
import { ExportMenu } from '../../design-system/ExportMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { exportRegistry } from '../../core/export/registryExports'
import { exportElementAsPdf } from '../../core/export/pdfReportExport'
import { PERIODS, breakdown, filterText, indicatorReport, monthlySeries, optionsOf, periodLabel, periodOf, shiftPeriod, textOf } from './registerEngine'
import { formatIndicatorValue, indicatorStatusLabel, indicatorStatusTone } from './registerText'

const PERIOD_MONTHS = { month: 1, quarter: 3, half: 6, year: 12 }
const lastMonth = () => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7) }

// The report of a register: every indicator for a period, compared with the
// previous period and the same period last year, its trend month by month
// (with the target line) and its split by the register's list fields.
export function RegisterIndicators({ register, entries }) {
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
  const title = `${en ? register.nameEn : register.name} · ${periodLabel(period, language)}`
  // A step moves by the period shown: a month, a quarter, a half-year or a year.
  const step = direction => setMonth(shiftPeriod(period, direction * PERIOD_MONTHS[kind]).from.slice(0, 7))
  function exportCsv() {
    exportRegistry({ name: `${register.code}_${period.from}_${period.to}`, headers: en ? ['Indicator', 'Value', 'Numerator', 'Denominator', 'Previous period', 'Same period last year', 'Target', 'Limit', 'Status'] : ['Δείκτης', 'Τιμή', 'Αριθμητής', 'Παρονομαστής', 'Προηγούμενη περίοδος', 'Ίδια περίοδος πέρσι', 'Στόχος', 'Όριο', 'Κατάσταση'], rows: report.map(({ indicator, current, previous, lastYear }) => [textOf(indicator, language), current.value ?? '', current.numerator ?? '', current.denominator ?? '', previous.value ?? '', lastYear.value ?? '', indicator.target ?? '', indicator.threshold ?? '', indicatorStatusLabel(current.status, language)]) })
  }
  async function exportPdf() {
    if (!reportRef.current) return
    setExporting(true)
    try { await exportElementAsPdf({ element: reportRef.current, filename: `${register.code}_${period.from}_${period.to}` }) } catch (error) { notifyError(error, 'export', { operation: 'register_indicators_pdf' }) } finally { setExporting(false) }
  }
  return <RecordTabPanel className="register-indicators" title={en ? 'Indicators' : 'Δείκτες'} subtitle={en ? 'Computed from the entries; names never leave the department.' : 'Υπολογίζονται από τις καταχωρίσεις· τα ονόματα δεν φεύγουν από το τμήμα.'}
    actions={<div className="register-indicator-actions">
      <SearchableSelect hideLabel className="register-period-select" label={en ? 'Period' : 'Περίοδος'} value={kind} onChange={next=>next&&(setKind)(next)} options={optionsOf(PERIODS, language)}/>
      <PeriodStepper label={periodLabel(period, language)} onPrevious={() => step(-1)} onNext={() => step(1)} nextDisabled={shiftPeriod(period, PERIOD_MONTHS[kind]).from > new Date().toISOString().slice(0, 10)} />
      <ExportMenu disabled={!report.length} onExcel={exportCsv} onPdf={exportPdf} pdfBusy={exporting} />
    </div>}>
    <div ref={reportRef} className="register-indicator-report">
      <h3 className="register-report-title">{title}</h3>
      <div className="register-indicator-grid">{report.map(row => <IndicatorCard key={row.indicator.id} row={row} register={register} entries={entries} period={period} language={language} active={row.indicator.id === openId} onOpen={() => setOpenId(current => (current === row.indicator.id ? null : row.indicator.id))} />)}</div>
      {!report.length && <div className="inline-empty">{en ? 'This register has no indicators yet. Add them in «Definition».' : 'Το μητρώο δεν έχει ακόμη δείκτες. Προσθέστε τους στον «Ορισμό».'}</div>}
      {open && <IndicatorDetail register={register} entries={entries} row={open} period={period} language={language} />}
    </div>
  </RecordTabPanel>
}

function Change({ now, before, indicator, language }) {
  const en = language === 'en'
  if (now == null || before == null) return <span className="register-change">—</span>
  const diff = Number((now - before).toFixed(2))
  const better = indicator.direction === 'higher' ? diff > 0 : indicator.direction === 'lower' ? diff < 0 : null
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus
  return <span className={`register-change ${better == null || diff === 0 ? '' : better ? 'is-better' : 'is-worse'}`} title={en ? 'Change' : 'Μεταβολή'}><Icon size={13} />{diff > 0 ? '+' : diff < 0 ? '−' : ''}{formatIndicatorValue(Math.abs(diff), indicator, language)}</span>
}

// The twelve months up to the end of the period, for the card's sparkline.
function lastTwelveMonths(register, indicator, entries, period) {
  const year = Number(period.to.slice(0, 4)), month = Number(period.to.slice(5, 7))
  const months = [...monthlySeries(register, indicator, entries, year - 1), ...monthlySeries(register, indicator, entries, year)]
  return months.slice(month, month + 12).map(point => point.value)
}

function IndicatorCard({ row, register, entries, period, language, active, onOpen }) {
  const en = language === 'en'
  const { indicator, current, previous, lastYear } = row
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const unit = en ? indicator.unitEn || indicator.unit : indicator.unit
  const trend = useMemo(() => lastTwelveMonths(register, indicator, entries, period), [register, indicator, entries, period.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // How the indicator is counted reads on hover, so the card stays short.
  const rule = register.kind === 'case' && indicator.filters?.length > 0 ? indicator.filters.map(filter => filterText(register, filter, language)).join(' · ') : ''
  return <button type="button" className={`register-indicator-card ${active ? 'active' : ''} is-${current.status}`} onClick={onOpen} aria-expanded={active} title={rule || undefined}>
    <span className="register-indicator-title">{textOf(indicator, language)}</span>
    <span className="register-indicator-headline">
      <strong className="register-indicator-value">{formatIndicatorValue(current.value, { ...indicator, unit: unit === '%' ? '%' : '', unitEn: '' }, language)}{current.value != null && unit && unit !== '%' && <small> {unit}</small>}</strong>
      <Sparkline width={96} points={trend} target={target} label={en ? `${textOf(indicator, language)}: the last 12 months` : `${textOf(indicator, language)}: οι τελευταίοι 12 μήνες`} />
    </span>
    <span className="register-indicator-meta">
      {current.status !== 'context' && <StatusBadge tone={indicatorStatusTone(current.status)}>{indicatorStatusLabel(current.status, language)}</StatusBadge>}
      {target != null && <small>{en ? 'Target' : 'Στόχος'} {indicator.direction === 'higher' ? '≥' : '≤'} {formatIndicatorValue(target, indicator, language)}</small>}
      {(indicator.aggregation === 'percent' || indicator.aggregation === 'rate') && current.denominator != null && <small>{current.numerator} / {current.denominator}{indicator.aggregation === 'rate' ? (en ? ' days' : ' ημέρες') : ''}</small>}
    </span>
    {current.small && <small className="register-indicator-small"><AlertTriangle size={12} />{en ? 'Few cases: read with caution' : 'Λίγα περιστατικά: με επιφύλαξη'}</small>}
    <span className="register-indicator-compare"><span>{en ? 'vs previous' : 'έναντι προηγ.'} <Change now={current.value} before={previous.value} indicator={indicator} language={language} /></span><span>{en ? 'vs last year' : 'έναντι πέρσι'} <Change now={current.value} before={lastYear.value} indicator={indicator} language={language} /></span></span>
  </button>
}

function IndicatorDetail({ register, entries, row, period, language }) {
  const en = language === 'en'
  const { indicator } = row
  const year = period.from.slice(0, 4)
  const series = monthlySeries(register, indicator, entries, year)
  const values = series.map(point => point.value).filter(value => value != null)
  const target = indicator.target === '' || indicator.target == null ? null : Number(indicator.target)
  const top = Math.max(1, ...values, target ?? 0)
  const short = month => new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(year), month - 1, 1)))
  const splits = register.kind === 'case' ? (register.settings?.breakdowns || []).map(key => ({ field: register.fields.find(field => field.key === key), rows: breakdown(register, indicator, entries, period, key) })).filter(split => split.field && split.rows.length) : []
  return <section className="register-indicator-detail">
    <header><h4>{textOf(indicator, language)}</h4>{(en ? indicator.noteEn || indicator.note : indicator.note) && <p>{en ? indicator.noteEn || indicator.note : indicator.note}</p>}</header>
    <div className="register-trend" role="img" aria-label={en ? `Trend ${year}` : `Τάση ${year}`}>
      {target != null && <span className="register-trend-target" style={{ bottom: `${(target / top) * 100}%` }}><em>{en ? 'target' : 'στόχος'}</em></span>}
      {series.map(point => <span key={point.month} className={`register-trend-bar is-${point.status}`}>
        <i style={{ height: point.value == null ? 0 : `${Math.max(2, (point.value / top) * 100)}%` }} title={formatIndicatorValue(point.value, indicator, language)} />
        <b>{point.value == null ? '·' : formatIndicatorValue(point.value, { ...indicator, unit: indicator.unit === '%' ? '%' : '' }, language)}</b>
        <small>{short(point.month)}</small>
      </span>)}
    </div>
    {splits.map(split => <div key={split.field.key} className="register-split">
      <h5>{en ? 'Cases of the period by' : 'Περιστατικά της περιόδου ανά'} {textOf(split.field, language).toLowerCase()}</h5>
      <table className="data-table"><tbody>{split.rows.map(item => <tr key={item.option.value || 'none'}><td className="register-row-label">{textOf(item.option, language)}</td><td className="register-num">{item.count}</td><td className="register-num">{item.share == null ? '—' : `${new Intl.NumberFormat(en ? 'en-GB' : 'el-GR').format(item.share)}%`}</td><td className="register-split-bar"><i style={{ width: `${item.share || 0}%` }} /></td></tr>)}</tbody></table>
    </div>)}
  </section>
}
