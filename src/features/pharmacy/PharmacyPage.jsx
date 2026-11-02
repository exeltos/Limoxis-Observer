import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Building2, Info, Pill, Plus, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { IconButton } from '../../design-system/IconButton'
import { StatusCards } from '../../design-system/StatusCards'
import { KpiCard, KpiStrip } from '../../design-system/KpiCard'
import { kpiDelta } from '../../design-system/kpiDelta'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useTableSort } from '../../design-system/useTableSort'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { loadAntibioticDispensingRecords, loadDddReference } from './pharmacyCloudService'
import { awareCategoryFor, awareCategoryLabel, awareCategoryWhoName } from './whoAwareClassification'
import { PharmacyApprovals } from './PharmacyApprovals'
import { therapyAccess } from './pharmacyAccess'
import { PharmacyIndicators } from './PharmacyIndicators'
import { ACCESS_TARGET, pharmacyConsumptionKpis } from './pharmacyKpis'

// '2026-09' → 'Σεπτέμβριος 2026' / 'September 2026'
const formatPeriod = (period, en, month = 'long') => /^\d{4}-\d{2}$/.test(String(period || '')) ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month, year: 'numeric' }).format(new Date(`${period}-15T12:00:00`)) : (period || '—')

const monthOf = row => String(row.periodStart || row.period || '').slice(0, 7)
const noFilters = () => ({ query: '', from: '', to: '', department: '' })

// Φαρμακείο: three tabs. «Κατανάλωση» (dispensing periods, filtered by period and department),
// «Εγκρίσεις αντιβιοτικών» (stewardship approvals of restricted antibiotics) and «Δείκτες» (the pharmacy indicators).
export function PharmacyPage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notifyError } = useFeedback()
  const { role, membership, tenant, isDemo } = useTenant()
  const addOns = useMemo(() => membership?.capabilities ?? [], [membership?.capabilities])
  const custom = useMemo(() => membership?.customCapabilities ?? [], [membership?.customCapabilities])
  const canRecord = can(role, CAPABILITIES.RECORD_PHARMACY_CONSUMPTION, addOns, custom)
  // The approvals tab follows the cloud RLS of antimicrobial_therapies (pharmacyAccess.js):
  // hidden for roles that cannot read the therapies; approve / reject needs the manage capability and the update policy.
  const therapies = therapyAccess({ role, demoOrganization: Boolean(tenant?.is_demo), sample: Boolean(isDemo) })
  const canDecide = therapies.update && can(role, CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY, addOns, custom)
  const canApprovals = therapies.read && (canDecide || can(role, CAPABILITIES.MANAGE_ANTIMICROBIAL_THERAPY, addOns, custom) || can(role, CAPABILITIES.REVIEW_CLINICAL, addOns, custom))
  const canIndicators = can(role, CAPABILITIES.VIEW_INDICATORS, addOns, custom)
  const canOpenCase = can(role, CAPABILITIES.VIEW_SURVEILLANCE, addOns, custom)
  const tabs = [
    { value: 'consumption', label: en ? 'Consumption' : 'Κατανάλωση', icon: Pill },
    canApprovals && { value: 'approvals', label: en ? 'Antibiotic approvals' : 'Εγκρίσεις αντιβιοτικών', icon: ShieldCheck },
    canIndicators && { value: 'indicators', label: en ? 'Indicators' : 'Δείκτες', icon: Activity },
  ].filter(Boolean)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = tabs.some(item => item.value === params.get('tab')) ? params.get('tab') : 'consumption'
  const setTab = next => setParams(current => { const copy = new URLSearchParams(current); copy.set('tab', next); return copy }, { replace: true })
  const [rows, setRows] = useState([])
  const [ddd, setDdd] = useState({})
  // True until the first read ends: placeholders, not «no periods» and 0 figures.
  const [loading, setLoading] = useState(true)
  const [showNote, setShowNote] = useState(false)
  const [approvalCounts, setApprovalCounts] = useState({ loading: true, pending: 0, approved: 0, rejected: 0 })
  const [approvalStatus, setApprovalStatus] = useState('pending')
  const [indicatorFigures, setIndicatorFigures] = useState({ loading: true, rows: [], from: '', to: '' })
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const reload = useCallback(async () => {
    if (!tenant?.id || !canRecord) { setRows([]); setLoading(false); return }
    setLoading(true)
    try {
      // Without DDD references the shares fall back to grams: a missing reference is not an error.
      const [records, dddReference] = await Promise.all([loadAntibioticDispensingRecords(tenant.id), loadDddReference(tenant.id).catch(() => ({}))])
      setRows(records)
      setDdd(dddReference)
    } catch (error) {
      notifyError(error, 'load', { operation: 'antibiotic_dispensing_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, canRecord, notifyError])

  useEffect(() => { void reload() }, [reload])
  const firstLoad = loading && !rows.length

  // «Κατανάλωση»: period (from / to month) and department filters, a page of rows at a time.
  const periods = useMemo(() => [...new Set(rows.map(monthOf).filter(Boolean))].sort().reverse(), [rows])
  const departments = useMemo(() => [...new Map(rows.filter(row => row.departmentEl).map(row => [row.departmentEl, row])).values()].sort((a, b) => (a.departmentScope === 'hospital' ? -1 : b.departmentScope === 'hospital' ? 1 : a.departmentEl.localeCompare(b.departmentEl, 'el'))), [rows])
  const filtered = useMemo(() => {
    const needle = filters.query.trim().toLowerCase()
    return rows.filter(row => (!filters.from || monthOf(row) >= filters.from) && (!filters.to || monthOf(row) <= filters.to) && (!filters.department || row.departmentEl === filters.department) && (!needle || `${row.product} ${row.productEn} ${row.responsible} ${row.referenceNumber}`.toLowerCase().includes(needle)))
      .sort((a, b) => String(b.periodStart || b.period || '').localeCompare(String(a.periodStart || a.period || '')))
  }, [rows, filters])
  // The arrows in the headers sort the whole filtered list (newest period first); then the page is cut.
  const { sorted: sortedRows, sort, onSort } = useTableSort(filtered, {
    period: row => row.periodStart || row.period,
    department: row => (en ? row.departmentEn : row.departmentEl),
    product: row => (en ? (row.productEn || row.product) : row.product),
    aware: row => awareCategoryFor(row.productEn || row.product) || '',
    quantity: row => Number(row.quantityGrams),
    responsible: row => row.responsible,
  }, { key: 'period', dir: 'desc' })
  useEffect(() => setPage(1), [filters, pageSize, sort])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const setFilter = key => value => setFilters(current => ({ ...current, [key]: value }))
  const clearFilters = () => setFilters(noFilters())
  const activeFilters = (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.department ? 1 : 0)
  const consumption = tab === 'consumption'
  // The key figures follow the filters: the latest month of the filtered rows against the month before.
  const kpis = useMemo(() => pharmacyConsumptionKpis(filtered, { ddd }), [filtered, ddd])
  const byDdd = kpis.current?.basis === 'ddd'
  const sameBasis = kpis.before?.basis === kpis.current?.basis
  const kpiPeriod = kpis.month ? formatPeriod(kpis.month, en, 'short') : null
  const number = value => new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value)
  const grams = value => number(value >= 1000 ? value / 1000 : value)
  const gramUnit = value => (value >= 1000 ? 'kg' : 'g')
  const change = (now, before, options = {}) => kpiDelta(now, before, { ...options, language })

  return (
    <Page fill title={en ? 'Pharmacy' : 'Φαρμακείο'} subtitle={en ? 'Antimicrobial stewardship, advanced antibiotics, approvals and consumption / DDD.' : 'Αντιμικροβιακή επιτήρηση, προωθημένα αντιβιοτικά, εγκρίσεις και κατανάλωση / DDD.'}
      actions={canRecord && consumption && <Button onClick={() => navigate('/pharmacy/dispensing/new')}><Plus size={16} />{en ? 'Dispensing period' : 'Περίοδος χορήγησης'}</Button>}>
      {tabs.length > 1 && <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={en ? 'Pharmacy' : 'Φαρμακείο'} />}
      {canRecord && consumption && (
        <KpiStrip label={en ? 'Consumption figures' : 'Δείκτες κατανάλωσης'}>
          <KpiCard loading={firstLoad} icon={Pill} label={en ? 'Consumption' : 'Κατανάλωση'} period={kpiPeriod} value={kpis.current ? grams(kpis.current.grams) : null} unit={kpis.current ? gramUnit(kpis.current.grams) : ''} delta={change(kpis.current?.grams, kpis.before?.grams, { lowerIsBetter: true, percent: true })} />
          <KpiCard loading={firstLoad} icon={ShieldCheck} label={en ? 'Access' : 'Πρόσβασης'} period={kpiPeriod} value={kpis.current?.access == null ? null : number(kpis.current.access)} unit="%" status={kpis.current?.access == null || !byDdd ? null : kpis.current.access >= ACCESS_TARGET ? 'good' : kpis.current.access >= ACCESS_TARGET - 10 ? 'warning' : 'danger'} target={en ? `WHO target ≥ ${ACCESS_TARGET}%` : `στόχος ΠΟΥ ≥ ${ACCESS_TARGET}%`} hint={kpis.current && !byDdd ? (en ? 'of grams (no DDD)' : 'επί g (χωρίς DDD)') : null} meter={kpis.current?.access} meterTarget={ACCESS_TARGET} delta={sameBasis ? change(kpis.current?.access, kpis.before?.access, { points: true }) : null} />
          <KpiCard loading={firstLoad} icon={AlertTriangle} label={en ? 'Reserve' : 'Εφεδρικά'} period={kpiPeriod} value={kpis.current?.reserve == null ? null : number(kpis.current.reserve)} unit="%" hint={byDdd ? (en ? 'share (DDD)' : 'μερίδιο (DDD)') : (en ? 'share (g)' : 'μερίδιο (g)')} delta={sameBasis ? change(kpis.current?.reserve, kpis.before?.reserve, { lowerIsBetter: true, points: true }) : null} />
          <KpiCard loading={firstLoad} icon={Building2} label={en ? 'Departments' : 'Τμήματα'} hint={en ? 'with a record' : 'με καταγραφή'} period={kpiPeriod} value={kpis.current ? `${kpis.current.departments}/${kpis.allDepartments}` : null} status={kpis.current ? (kpis.current.departments >= kpis.allDepartments ? 'good' : 'warning') : null} target={en ? 'every department, every month' : 'όλα τα τμήματα, κάθε μήνα'} />
        </KpiStrip>
      )}
      {canIndicators && tab === 'indicators' && indicatorFigures.rows.length > 0 && (
        <KpiStrip label={en ? 'Pharmacy indicators' : 'Δείκτες φαρμακείου'} columns={Math.min(indicatorFigures.rows.length, 3)}>
          {indicatorFigures.rows.slice(0, 3).map(row => {
            const key = String(row.id || '')
            const short = key.includes('aware-access') ? (en ? 'Access antibiotics' : 'Αντιβιοτικά Πρόσβασης') : key.includes('ddd-per-100') ? (en ? 'DDD / 100 patient-days' : 'DDD / 100 ασθενοημέρες') : (en ? row.titleEn || row.titleEl : row.titleEl)
            const target = row.target == null ? null : `${en ? 'target' : 'στόχος'} ${row.direction === 'lower' ? '≤' : row.direction === 'higher' ? '≥' : ''} ${number(row.target)}`
            return <KpiCard key={key} loading={indicatorFigures.loading} icon={Activity} label={short} period={en ? 'year to date' : 'από αρχή έτους'} value={row.value == null ? null : number(row.value)} unit={(en ? row.unitEn : row.unit) === 'DDD/100 ασθενοημέρες' ? '' : (en ? row.unitEn : row.unit)} status={row.status === 'onTarget' ? 'good' : row.status === 'attention' ? 'danger' : null} target={target} />
          })}
        </KpiStrip>
      )}
      {canApprovals && tab === 'approvals' && (
        <StatusCards label={en ? 'Antibiotic approvals' : 'Εγκρίσεις αντιβιοτικών'} loading={approvalCounts.loading} items={[
          { key: 'pending', icon: Clock3, label: en ? 'Pending' : 'Σε αναμονή', value: approvalCounts.pending, tone: approvalCounts.pending > 0 ? 'warning' : '', active: approvalStatus === 'pending', onToggle: () => setApprovalStatus(approvalStatus === 'pending' ? 'all' : 'pending') },
          { key: 'approved', icon: CheckCircle2, label: en ? 'Approved' : 'Εγκρίθηκαν', value: approvalCounts.approved, active: approvalStatus === 'approved', onToggle: () => setApprovalStatus(approvalStatus === 'approved' ? 'all' : 'approved') },
          { key: 'rejected', icon: XCircle, label: en ? 'Rejected' : 'Απορρίφθηκαν', value: approvalCounts.rejected, active: approvalStatus === 'rejected', onToggle: () => setApprovalStatus(approvalStatus === 'rejected' ? 'all' : 'rejected') },
        ]} />
      )}
      <section className={`surface registry-workspace workspace-column workspace-fill pharmacy-workspace pharmacy-tab-${tab}`}>
        {tab === 'approvals' && <PharmacyApprovals organizationId={tenant?.id} en={en} canDecide={canDecide} canOpenRecord={canOpenCase} onCounts={setApprovalCounts} status={approvalStatus} onStatusChange={setApprovalStatus} />}
        {tab === 'indicators' && <PharmacyIndicators organizationId={tenant?.id} en={en} onRows={setIndicatorFigures} />}
        {consumption && !canRecord && <div className="inline-empty">{en ? 'You do not have access to record antibiotic consumption.' : 'Δεν έχετε πρόσβαση καταχώρισης κατανάλωσης αντιβιοτικών.'}</div>}
        {consumption && canRecord && <>
          <FilterBar end={<IconButton label={en ? 'About this indicator' : 'Σχετικά με τον δείκτη'} onClick={() => setShowNote(value => !value)}><Info size={16} /></IconButton>} query={filters.query} onQueryChange={setFilter('query')} placeholder={en ? 'Antibiotic, responsible, reference…' : 'Αντιβιοτικό, υπεύθυνος, αριθμός αναφοράς…'} activeAdvancedCount={activeFilters} onClear={clearFilters}>
            <FilterSelect label={en ? 'From' : 'Από'} value={filters.from} onChange={setFilter('from')}><option value="">{en ? 'Any period' : 'Οποιαδήποτε περίοδος'}</option>{periods.map(item => <option key={item} value={item}>{formatPeriod(item, en)}</option>)}</FilterSelect>
            <FilterSelect label={en ? 'To' : 'Έως'} value={filters.to} onChange={setFilter('to')}><option value="">{en ? 'Any period' : 'Οποιαδήποτε περίοδος'}</option>{periods.map(item => <option key={item} value={item}>{formatPeriod(item, en)}</option>)}</FilterSelect>
            <FilterSelect label={en ? 'Department' : 'Τμήμα'} value={filters.department} onChange={setFilter('department')}><option value="">{en ? 'All' : 'Όλα'}</option>{departments.map(row => <option key={row.departmentEl} value={row.departmentEl}>{en ? row.departmentEn : row.departmentEl}</option>)}</FilterSelect>
          </FilterBar>
          {showNote && (
          <div className="inline-empty" role="note">
            {en
              ? 'Records here feed the ΥΑ 388/2014 antibiotic consumption indicator (DDD per 100 patient-days). DDD reference values per antibiotic must be verified by pharmacy staff against the current WHO ATC/DDD Index before this indicator is relied on for ΕΟΔΥ reporting.'
              : 'Οι καταχωρίσεις εδώ τροφοδοτούν τον δείκτη κατανάλωσης αντιβιοτικών της ΥΑ 388/2014 (DDD ανά 100 ασθενοημέρες). Οι τιμές αναφοράς DDD ανά αντιβιοτικό πρέπει να επαληθευτούν από το φαρμακείο έναντι του τρέχοντος επίσημου δείκτη WHO ATC/DDD πριν χρησιμοποιηθεί ο δείκτης για αναφορά στον ΕΟΔΥ.'}
          </div>
          )}
          {firstLoad && <TableSkeleton />}
          {!loading && !rows.length && (
            <RegistryEmptyState
              icon={Pill}
              language={language}
              title={en ? 'No dispensing periods recorded yet.' : 'Δεν έχουν καταχωριστεί περίοδοι χορήγησης.'}
              text={en ? 'Record the first period to start the consumption indicator.' : 'Καταχωρίστε την πρώτη περίοδο για να ξεκινήσει ο δείκτης κατανάλωσης.'}
              action={{ label: en ? 'Dispensing period' : 'Περίοδος χορήγησης', icon: Plus, onClick: () => navigate('/pharmacy/dispensing/new') }}
            />
          )}
          {!firstLoad && Boolean(rows.length) && (
            <div className="scroll-table" tabIndex={0} role="region" aria-label={t('pharmacy')}>
              <RegistryTable bare sort={sort} onSort={onSort}
                columns={[
                  { key: 'period', label: en ? 'Period' : 'Περίοδος', sortable: true },
                  { key: 'department', label: en ? 'Department' : 'Τμήμα', sortable: true },
                  { key: 'product', label: en ? 'Antibiotic' : 'Αντιβιοτικό', sortable: true },
                  { key: 'aware', label: 'WHO AWaRe', sortable: true },
                  { key: 'quantity', label: en ? 'Quantity' : 'Ποσότητα', sortable: true },
                  { key: 'responsible', label: en ? 'Responsible' : 'Υπεύθυνος', sortable: true },
                ]}
                rows={paged}
                rowKey={row => row.id}
                rowProps={row => ({ className: 'clickable-row', tabIndex: 0, onClick: () => navigate(`/pharmacy/dispensing/${row.id}`), onKeyDown: event => { if (event.key === 'Enter') navigate(`/pharmacy/dispensing/${row.id}`) } })}
                renderRow={row => { const category = awareCategoryFor(row.productEn || row.product); return <><td>{formatPeriod(row.period, en)}</td><td>{en ? row.departmentEn : row.departmentEl}</td><td>{en ? (row.productEn || row.product) : row.product}</td><td>{category ? <span className={`status-badge aware-${category}`} title={language === 'el' ? `WHO AWaRe: ${awareCategoryWhoName(category)}` : undefined}>{awareCategoryLabel(category, language)}</span> : '—'}</td><td>{row.quantityGrams} g</td><td>{row.responsible || '—'}</td></> }} />
              {!filtered.length && <RegistryEmptyState filtered onClearFilters={clearFilters} language={language} />}
            </div>
          )}
          <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>}
      </section>
    </Page>
  )
}
