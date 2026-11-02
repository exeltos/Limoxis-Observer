import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { FilterBar, FilterDate } from '../../design-system/FilterBar'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { calculateCloudDefinition, collectCloudIndicatorMetrics, loadIndicatorSnapshots, loadOperationalIndicatorDefinitions } from '../indicators/indicatorCloudService'

const yearStart = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().slice(0, 10)
const fmtDay = value => { const [y, m, d] = String(value || '').slice(0, 10).split('-'); return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : '—' }
const fmtNumber = (value, en) => (value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 2 }).format(Number(value)))
const STATUS = { onTarget: ['Εντός στόχου', 'On target', 'success'], attention: ['Χρειάζεται προσοχή', 'Needs attention', 'danger'], context: ['Παρακολούθηση', 'Monitoring', 'neutral'] }

// «Δείκτες»: the pharmacy indicators of the Indicators module (DDD per 100 patient-days, WHO AWaRe Access share…),
// calculated by the same engine for the chosen period, with their approved results over time.
export function PharmacyIndicators({ organizationId, en, onRows }) {
  const navigate = useNavigate()
  const { notifyError } = useFeedback()
  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(today)
  const [state, setState] = useState({ loading: true, rows: [], history: [] })

  const calculate = useCallback(async () => {
    if (!organizationId || !from || !to || to < from) { setState(current => ({ ...current, loading: false })); return }
    setState(current => ({ ...current, loading: true }))
    try {
      const [metrics, definitions, snapshots] = await Promise.all([collectCloudIndicatorMetrics(organizationId, { from, to }), loadOperationalIndicatorDefinitions(organizationId, { from, to }), loadIndicatorSnapshots(organizationId, {})])
      const rows = definitions.filter(def => def.category === 'pharmacy').map(def => calculateCloudDefinition(def, metrics || {}))
      const keys = new Set(rows.map(row => row.id))
      setState({ loading: false, rows, history: (snapshots || []).filter(s => keys.has(s.indicator_key) && s.status === 'approved').sort((a, b) => String(b.period_start).localeCompare(String(a.period_start))) })
    } catch (error) {
      setState({ loading: false, rows: [], history: [] })
      notifyError(error, 'load', { operation: 'pharmacy_indicators_load' })
    }
  }, [organizationId, from, to, notifyError])
  useEffect(() => { void calculate() }, [calculate])

  useEffect(() => { onRows?.({ loading: state.loading && !state.rows.length, rows: state.rows, from, to }) }, [onRows, state.loading, state.rows, from, to])
  const { sorted: sortedRows, sort, onSort } = useTableSort(state.rows, {
    indicator: row => (en ? row.titleEn || row.titleEl : row.titleEl),
    result: row => (row.value == null ? null : Number(row.value)),
    target: row => (row.target == null ? null : Number(row.target)),
    status: row => row.status,
  })
  const title = row => (en ? row.titleEn || row.titleEl : row.titleEl)
  const titleOf = key => { const row = state.rows.find(item => item.id === key); return row ? title(row) : key }
  return <>
    <FilterBar onClear={() => { setFrom(yearStart()); setTo(today()) }} activeAdvancedCount={(from !== yearStart() ? 1 : 0) + (to !== today() ? 1 : 0)}>
      <FilterDate label={en ? 'From' : 'Από'} value={from} onChange={setFrom} />
      <FilterDate label={en ? 'To' : 'Έως'} value={to} onChange={setTo} />
    </FilterBar>
    {to < from && <div className="inline-empty">{en ? 'The end date must be after the start date.' : 'Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.'}</div>}
    {state.loading && !state.rows.length ? <TableSkeleton /> : !state.rows.length ? <RegistryEmptyState icon={Activity} language={en ? 'en' : 'el'} title={en ? 'No active pharmacy indicators' : 'Δεν υπάρχουν ενεργοί δείκτες φαρμακείου'} text={en ? 'Pharmacy indicators are defined in Indicators.' : 'Οι δείκτες φαρμακείου ορίζονται στους Δείκτες.'} /> : <div className="scroll-table" tabIndex={0} role="region" aria-label={en ? 'Pharmacy indicators' : 'Δείκτες φαρμακείου'}>
      <RegistryTable bare sort={sort} onSort={onSort}
        columns={[
          { key: 'indicator', label: en ? 'Indicator' : 'Δείκτης', sortable: true },
          { key: 'result', label: en ? 'Result' : 'Αποτέλεσμα', sortable: true },
          { key: 'ratio', label: en ? 'Numerator / denominator' : 'Αριθμητής / παρονομαστής' },
          { key: 'target', label: en ? 'Target' : 'Στόχος', sortable: true },
          { key: 'status', label: en ? 'Status' : 'Κατάσταση', sortable: true },
        ]}
        rows={sortedRows}
        rowKey={row => row.definitionId || row.id}
        rowProps={row => (row.definitionId ? { className: 'clickable-row', onClick: () => navigate(`/indicators/${row.definitionId}`, { state: { indicatorPeriod: { from, to, departmentId: null } } }) } : {})}
        renderRow={row => { const badge = STATUS[row.status] || STATUS.context; return <>
          <td><strong>{title(row)}</strong><small>{fmtDay(from)} – {fmtDay(to)} · {row.source}</small></td>
          <td><strong>{fmtNumber(row.value, en)}</strong> {en ? row.unitEn : row.unit}</td>
          <td>{row.evidence === 'manual' ? row.evidence : `${fmtNumber(row.numerator, en)}${row.denominator == null ? '' : ` / ${fmtNumber(row.denominator, en)}`}`}</td>
          <td>{row.target == null ? '—' : `${row.direction === 'lower' ? '≤ ' : row.direction === 'higher' ? '≥ ' : ''}${fmtNumber(row.target, en)}`}</td>
          <td><StatusBadge tone={badge[2]}>{badge[en ? 1 : 0]}</StatusBadge></td>
        </> }} />
    </div>}
    {Boolean(state.history.length) && <div className="scroll-table" tabIndex={0} role="region" aria-label={en ? 'Approved results' : 'Εγκεκριμένα αποτελέσματα'}>
      <table className="data-table sticky-table">
        <thead><tr><th>{en ? 'Approved results by period' : 'Εγκεκριμένα αποτελέσματα ανά περίοδο'}</th><th>{en ? 'Period' : 'Περίοδος'}</th><th>{en ? 'Result' : 'Αποτέλεσμα'}</th><th>{en ? 'Numerator / denominator' : 'Αριθμητής / παρονομαστής'}</th></tr></thead>
        <tbody>{state.history.map(s => <tr key={s.id}><td>{titleOf(s.indicator_key)}</td><td>{fmtDay(s.period_start)} – {fmtDay(s.period_end)}</td><td><strong>{fmtNumber(s.value, en)}</strong> {s.unit || ''}</td><td>{s.denominator == null ? fmtNumber(s.numerator, en) : `${fmtNumber(s.numerator, en)} / ${fmtNumber(s.denominator, en)}`}</td></tr>)}</tbody>
      </table>
    </div>}
  </>
}
