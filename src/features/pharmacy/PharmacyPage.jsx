import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { Activity, CalendarRange, Clock3, Building2, Pill, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { MetricCard } from '../../design-system/MetricCard'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { DialogActions, ObserverDialog } from '../../design-system/ObserverDialog'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { loadAntibioticDispensingRecords, loadPharmacySupportData, saveAntibioticDispensingRecord } from './pharmacyCloudService'
import { awareCategoryFor, awareCategoryLabel } from './whoAwareClassification'
import { PharmacyApprovals } from './PharmacyApprovals'
import { therapyAccess } from './pharmacyAccess'
import { PharmacyIndicators } from './PharmacyIndicators'
import { signalDemoStep } from '../demo/demoScenarioSignals'

// '2026-09' → 'Σεπτέμβριος 2026' / 'September 2026'
const formatPeriod = (period, en, month = 'long') => /^\d{4}-\d{2}$/.test(String(period || '')) ? new Intl.DateTimeFormat(en ? 'en-GB' : 'el-GR', { month, year: 'numeric' }).format(new Date(`${period}-15T12:00:00`)) : (period || '—')

const monthNow = () => new Date().toISOString().slice(0, 7)
const monthOf = row => String(row.periodStart || row.period || '').slice(0, 7)
const noFilters = () => ({ query: '', from: '', to: '', department: '' })

// Φαρμακείο: three tabs. «Κατανάλωση» (dispensing periods, filtered by period and department),
// «Εγκρίσεις αντιβιοτικών» (stewardship approvals of restricted antibiotics) and «Δείκτες» (the pharmacy indicators).
export function PharmacyPage() {
  const { language, t } = useLanguage()
  const en = language === 'en'
  const { notify, notifyError } = useFeedback()
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
  const [params, setParams] = useSearchParams()
  const tab = tabs.some(item => item.value === params.get('tab')) ? params.get('tab') : 'consumption'
  const setTab = next => setParams(current => { const copy = new URLSearchParams(current); copy.set('tab', next); return copy }, { replace: true })
  const [rows, setRows] = useState([])
  const [support, setSupport] = useState({ departments: [], products: [] })
  // True until the first read ends: placeholders, not «no periods» and 0 figures.
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState(false)
  const [filters, setFilters] = useState(noFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const reload = useCallback(async () => {
    if (!tenant?.id || !canRecord) { setRows([]); setSupport({ departments: [], products: [] }); setLoading(false); return }
    setLoading(true)
    try {
      const [records, supportData] = await Promise.all([loadAntibioticDispensingRecords(tenant.id), loadPharmacySupportData(tenant.id)])
      setRows(records)
      setSupport(supportData)
    } catch (error) {
      notifyError(error, 'load', { operation: 'antibiotic_dispensing_load' })
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, canRecord, notifyError])

  useEffect(() => { void reload() }, [reload])
  const firstLoad = loading && !rows.length

  async function save(draft) {
    try {
      await saveAntibioticDispensingRecord(tenant.id, draft)
      signalDemoStep('antimicrobial_consumption', 'save')
      setDialog(false)
      await reload()
      notify(en ? 'Dispensing period saved.' : 'Η περίοδος χορήγησης αποθηκεύτηκε.', 'success')
    } catch (error) {
      notifyError(error, 'save', { operation: 'antibiotic_dispensing_save' })
    }
  }

  // «Κατανάλωση»: period (from / to month) and department filters, a page of rows at a time.
  const periods = useMemo(() => [...new Set(rows.map(monthOf).filter(Boolean))].sort().reverse(), [rows])
  const departments = useMemo(() => [...new Map(rows.filter(row => row.departmentEl).map(row => [row.departmentEl, row])).values()].sort((a, b) => (a.departmentScope === 'hospital' ? -1 : b.departmentScope === 'hospital' ? 1 : a.departmentEl.localeCompare(b.departmentEl, 'el'))), [rows])
  const filtered = useMemo(() => {
    const needle = filters.query.trim().toLowerCase()
    return rows.filter(row => (!filters.from || monthOf(row) >= filters.from) && (!filters.to || monthOf(row) <= filters.to) && (!filters.department || row.departmentEl === filters.department) && (!needle || `${row.product} ${row.productEn} ${row.responsible} ${row.referenceNumber}`.toLowerCase().includes(needle)))
      .sort((a, b) => String(b.periodStart || b.period || '').localeCompare(String(a.periodStart || a.period || '')))
  }, [rows, filters])
  useEffect(() => setPage(1), [filters, pageSize])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)), safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const setFilter = key => value => setFilters(current => ({ ...current, [key]: value }))
  const clearFilters = () => setFilters(noFilters())
  const activeFilters = (filters.from ? 1 : 0) + (filters.to ? 1 : 0) + (filters.department ? 1 : 0)
  const consumption = tab === 'consumption'

  return (
    <Page fill title={en ? 'Pharmacy' : 'Φαρμακείο'} subtitle={en ? 'Antimicrobial stewardship, advanced antibiotics, approvals and consumption / DDD.' : 'Αντιμικροβιακή επιτήρηση, προωθημένα αντιβιοτικά, εγκρίσεις και κατανάλωση / DDD.'}
      actions={canRecord && consumption && <Button onClick={() => setDialog(true)}><Plus size={16} />{en ? 'Dispensing period' : 'Περίοδος χορήγησης'}</Button>}>
      {canRecord && consumption && (
        <div className="module-summary-strip">
          <MetricCard loading={firstLoad} icon={CalendarRange} value={filtered.length} label={en ? 'Dispensing records' : 'Καταχωρίσεις χορήγησης'} />
          <MetricCard loading={firstLoad} icon={Pill} value={new Set(filtered.map(row => row.productEn || row.product).filter(Boolean)).size} label={en ? 'Antibiotics' : 'Αντιβιοτικά'} />
          <MetricCard loading={firstLoad} icon={Building2} value={new Set(filtered.map(row => row.departmentEl).filter(Boolean)).size} label={en ? 'Departments' : 'Τμήματα'} />
          <MetricCard loading={firstLoad} icon={Clock3} value={formatPeriod(rows.reduce((latest, row) => (row.period > latest ? row.period : latest), ''), en, 'short')} label={en ? 'Latest period' : 'Τελευταία περίοδος'} />
        </div>
      )}
      {tabs.length > 1 && <CanonicalTabs items={tabs} value={tab} onChange={setTab} ariaLabel={en ? 'Pharmacy' : 'Φαρμακείο'} />}
      <section className={`surface registry-workspace workspace-column workspace-fill pharmacy-workspace pharmacy-tab-${tab}`}>
        {tab === 'approvals' && <PharmacyApprovals organizationId={tenant?.id} en={en} canDecide={canDecide} canOpenRecord={canOpenCase} />}
        {tab === 'indicators' && <PharmacyIndicators organizationId={tenant?.id} en={en} />}
        {consumption && !canRecord && <div className="inline-empty">{en ? 'You do not have access to record antibiotic consumption.' : 'Δεν έχετε πρόσβαση καταχώρισης κατανάλωσης αντιβιοτικών.'}</div>}
        {consumption && canRecord && <>
          <div className="inline-empty">
            {en
              ? 'Records here feed the ΥΑ 388/2014 antibiotic consumption indicator (DDD per 100 patient-days). DDD reference values per antibiotic must be verified by pharmacy staff against the current WHO ATC/DDD Index before this indicator is relied on for ΕΟΔΥ reporting.'
              : 'Οι καταχωρίσεις εδώ τροφοδοτούν τον δείκτη κατανάλωσης αντιβιοτικών της ΥΑ 388/2014 (DDD ανά 100 ασθενοημέρες). Οι τιμές αναφοράς DDD ανά αντιβιοτικό πρέπει να επαληθευτούν από το φαρμακείο έναντι του τρέχοντος επίσημου δείκτη WHO ATC/DDD πριν χρησιμοποιηθεί ο δείκτης για αναφορά στον ΕΟΔΥ.'}
          </div>
          <FilterBar query={filters.query} onQueryChange={setFilter('query')} placeholder={en ? 'Antibiotic, responsible, reference…' : 'Αντιβιοτικό, υπεύθυνος, αριθμός αναφοράς…'} activeAdvancedCount={activeFilters} onClear={clearFilters}>
            <FilterSelect label={en ? 'From' : 'Από'} value={filters.from} onChange={setFilter('from')}><option value="">{en ? 'Any period' : 'Οποιαδήποτε περίοδος'}</option>{periods.map(item => <option key={item} value={item}>{formatPeriod(item, en)}</option>)}</FilterSelect>
            <FilterSelect label={en ? 'To' : 'Έως'} value={filters.to} onChange={setFilter('to')}><option value="">{en ? 'Any period' : 'Οποιαδήποτε περίοδος'}</option>{periods.map(item => <option key={item} value={item}>{formatPeriod(item, en)}</option>)}</FilterSelect>
            <FilterSelect label={en ? 'Department' : 'Τμήμα'} value={filters.department} onChange={setFilter('department')}><option value="">{en ? 'All' : 'Όλα'}</option>{departments.map(row => <option key={row.departmentEl} value={row.departmentEl}>{en ? row.departmentEn : row.departmentEl}</option>)}</FilterSelect>
          </FilterBar>
          {firstLoad && <TableSkeleton />}
          {!loading && !rows.length && <div className="inline-empty">{en ? 'No dispensing periods recorded yet.' : 'Δεν έχουν καταχωριστεί περίοδοι χορήγησης.'}</div>}
          {!firstLoad && Boolean(rows.length) && (
            <div className="scroll-table" tabIndex={0} role="region" aria-label={t('pharmacy')}>
              <table className="data-table sticky-table">
                <thead><tr><th>{en ? 'Period' : 'Περίοδος'}</th><th>{en ? 'Department' : 'Τμήμα'}</th><th>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</th><th>{en ? 'WHO AWaRe' : 'WHO AWaRe'}</th><th>{en ? 'Quantity' : 'Ποσότητα'}</th><th>{en ? 'Responsible' : 'Υπεύθυνος'}</th></tr></thead>
                <tbody>{paged.map(row => { const category = awareCategoryFor(row.productEn || row.product); return <tr key={row.id}><td>{formatPeriod(row.period, en)}</td><td>{en ? row.departmentEn : row.departmentEl}</td><td>{en ? (row.productEn || row.product) : row.product}</td><td>{category ? <span className={`status-badge aware-${category}`}>{awareCategoryLabel(category, language)}</span> : '—'}</td><td>{row.quantityGrams} g</td><td>{row.responsible || '—'}</td></tr> })}</tbody>
              </table>
              {!filtered.length && <RegistryEmptyState filtered onClearFilters={clearFilters} language={language} />}
            </div>
          )}
          <RegistryPagination language={language} page={safePage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>}
      </section>
      {dialog && <DispensingDialog en={en} support={support} onClose={() => setDialog(false)} onSave={save} />}
    </Page>
  )
}

function DispensingDialog({ en, support, onClose, onSave }) {
  const [draft, setDraft] = useState({ period: monthNow(), departmentScope: 'hospital', departmentEl: '', antibioticItemId: support.products[0]?.id || '', product: support.products[0]?.el || '', quantityGrams: '', method: 'manual', referenceNumber: '', responsible: '', notes: '' })
  const chooseProduct = id => { const item = support.products.find(x => x.id === id); setDraft(d => ({ ...d, antibioticItemId: id, product: item?.el || '' })) }
  const chooseDepartment = value => { if (value === '') { setDraft(d => ({ ...d, departmentScope: 'hospital', departmentEl: '' })); return } setDraft(d => ({ ...d, departmentScope: 'department', departmentEl: value })) }
  const disabled = !draft.period || !draft.antibioticItemId || !draft.quantityGrams
  return (
    <ObserverDialog width="standard" title={en ? 'New dispensing period' : 'Νέα περίοδος χορήγησης'} subtitle={en ? 'Monthly antibiotic quantity for the consumption indicator (DDD).' : 'Μηνιαία ποσότητα αντιβιοτικού για τον δείκτη κατανάλωσης (DDD).'} onClose={onClose}
      footer={<DialogActions onCancel={onClose} onSave={() => onSave(draft)} disabled={disabled} />}>
        <div className="entry-grid">
          <label><span>{en ? 'Month' : 'Μήνας'}</span><input type="month" value={draft.period} onChange={e => setDraft(d => ({ ...d, period: e.target.value }))} /></label>
          <label><span>{en ? 'Department' : 'Τμήμα'}</span><select value={draft.departmentEl} onChange={e => chooseDepartment(e.target.value)}><option value="">{en ? 'Whole hospital' : 'Όλο το νοσοκομείο'}</option>{support.departments.map(x => <option key={x.id} value={x.el}>{en ? x.en : x.el}</option>)}</select></label>
          <label><span>{en ? 'Antibiotic' : 'Αντιβιοτικό'}</span><select value={draft.antibioticItemId} onChange={e => chooseProduct(e.target.value)}>{support.products.map(x => <option key={x.id} value={x.id}>{en ? (x.en || x.el) : x.el}</option>)}</select></label>
          <label><span>{en ? 'Quantity (grams)' : 'Ποσότητα (γραμμάρια)'}</span><input type="number" min="0" step="0.01" value={draft.quantityGrams} onChange={e => setDraft(d => ({ ...d, quantityGrams: e.target.value }))} /></label>
          <label><span>{en ? 'Responsible' : 'Υπεύθυνος'}</span><input value={draft.responsible} onChange={e => setDraft(d => ({ ...d, responsible: e.target.value }))} /></label>
          <label><span>{en ? 'Reference number' : 'Αριθμός αναφοράς'}</span><input value={draft.referenceNumber} onChange={e => setDraft(d => ({ ...d, referenceNumber: e.target.value }))} /></label>
          <label className="entry-span-2"><span>{en ? 'Notes' : 'Σημειώσεις'}</span><textarea rows={3} value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} /></label>
        </div>
    </ObserverDialog>
  )
}
