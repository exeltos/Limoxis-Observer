import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Building2, ClipboardCheck, Droplets, Plus, Recycle, ShieldCheck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { KpiCard, KpiStrip } from '../../design-system/KpiCard'
import { kpiDelta } from '../../design-system/kpiDelta'
import { ABHR_TARGET, HAND_HYGIENE_TARGET, antisepticKpis, bundleKpis, handHygieneKpis, wasteKpis } from './preventionKpis'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { translate, useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import {
  createVaccinationsBulkAsync,
  deleteVaccinationAsync,
  loadAllVaccinationsAsync,
  updateVaccinationAsync,
} from '../occupational-health/vaccinationService'
import { StaffVaccinationEditor, EMPTY_VACCINATION } from './StaffVaccinationEditor'
import { antisepticMethodLabel, antisepticPeriodLabel } from './antisepticMethods'
import { loadHandHygieneDepartments, loadHandHygieneSessions } from './handHygieneCloudService'
import { loadAntisepticRecords, loadAntisepticSupportData } from './antisepticCloudService'
import { loadBundleAssessments, loadBundleSupportData } from './bundleCloudService'
import { loadWasteMeasurements, loadWasteSupportData } from './wasteCloudService'
import { readRegistryViewState, useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { wasteCategoryTone, wastePeriodLabel } from './wasteVisuals'

const tabs = [
  ['handHygiene', 'handHygiene'],
  ['waste', 'wasteManagement'],
  ['antiseptics', 'antisepticConsumption'],
  ['bundles', 'preventionBundles'],
  ['vaccinations', 'vaccinations'],
]
// Numbers in the user's language (79,1% in Greek) and the antiseptic month
// as MM/YYYY instead of the stored YYYY-MM.
const fmtNumber = (value, language) =>
  new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(
    Number(value),
  )
// Every prevention date as dd/mm/yyyy (two-digit day and month), like the other registries.
const dayLabel = (value, language) => {
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDay(value, language)
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${text}T12:00:00`))
}
const fmtMonth = value => antisepticPeriodLabel(value)
const tabIcons = {
  handHygiene: ClipboardCheck,
  waste: Recycle,
  antiseptics: Droplets,
  bundles: ShieldCheck,
  vaccinations: ShieldCheck,
}
const tabCapabilities = {
  handHygiene: CAPABILITIES.RECORD_HAND_HYGIENE,
  waste: CAPABILITIES.RECORD_WASTE,
  antiseptics: CAPABILITIES.RECORD_ANTISEPTIC,
  bundles: CAPABILITIES.RECORD_PREVENTION_BUNDLE,
  vaccinations: CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH,
}
const createCapabilities = {
  handHygiene: CAPABILITIES.RECORD_HAND_HYGIENE,
  waste: CAPABILITIES.RECORD_WASTE,
  antiseptics: CAPABILITIES.RECORD_ANTISEPTIC,
  bundles: CAPABILITIES.RECORD_PREVENTION_BUNDLE,
  vaccinations: CAPABILITIES.MANAGE_OCCUPATIONAL_HEALTH,
}
const createLabelKeys = {
  handHygiene: 'preventionNewHandHygieneLabel',
  waste: 'preventionNewWasteLabel',
  antiseptics: 'preventionNewAntisepticsLabel',
  bundles: 'preventionNewBundlesLabel',
}

// The department filter keeps the Greek name (what records store); a view saved
// with the English name still matches.
const departmentOption = (el, en, language) => ({ value: el, label: language === 'el' ? el : en || el })
const inDepartment = (department, el, en) => department === 'all' || department === el || department === en
export function PreventionPage() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { notify, notifyError, confirm } = useFeedback()
  const { role, membership, canAccessRecord, tenant } = useTenant()
  const { data: employeeRows } = useEmployeesData()
  const addOns = useMemo(() => membership?.capabilities ?? [], [membership?.capabilities])
  const custom = useMemo(
    () => membership?.customCapabilities ?? [],
    [membership?.customCapabilities],
  )
  const broadPreventionView = can(role, CAPABILITIES.VIEW_PREVENTION, [], custom)
  const tabAccess = useMemo(
    () =>
      Object.fromEntries(
        tabs.map(([id]) => [
          id,
          id === 'vaccinations'
            ? can(role, CAPABILITIES.VIEW_OCCUPATIONAL_HEALTH, addOns, custom)
            : broadPreventionView || can(role, tabCapabilities[id], addOns, custom),
        ]),
      ),
    [role, broadPreventionView, addOns, custom],
  )
  const visibleTabs = useMemo(() => tabs.filter(([id]) => tabAccess[id]), [tabAccess])
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'handHygiene')
  const registry = useRegistryMemory(`prevention-${tab}`)
  const savedView = registry.loadViewState({
    query: '',
    department: 'all',
    period: 'all',
    product: 'all',
    method: 'all',
    status: 'all',
  })
  const [query, setQuery] = useState(savedView.query)
  const [department, setDepartment] = useState(savedView.department)
  const [period, setPeriod] = useState(savedView.period)
  const [product, setProduct] = useState(savedView.product)
  const [method, setMethod] = useState(savedView.method)
  const [status, setStatus] = useState(savedView.status)
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(15)
  const [handRows, setHandRows] = useState([]),
    [handDepartments, setHandDepartments] = useState([]),
    [handLoading, setHandLoading] = useState(true)
  const [wasteRows, setWasteRows] = useState([]),
    [wasteSupport, setWasteSupport] = useState({ departments: [], wasteTypes: [] }),
    [wasteLoading, setWasteLoading] = useState(true)
  const [antisepticRows, setAntisepticRows] = useState([]),
    [antisepticSupport, setAntisepticSupport] = useState({ departments: [], products: [] }),
    [antisepticLoading, setAntisepticLoading] = useState(true)
  const [bundleRows, setBundleRows] = useState([]),
    [bundleSupport, setBundleSupport] = useState({ departments: [], templates: [] }),
    [bundleLoading, setBundleLoading] = useState(true)
  const [vaccinationRows, setVaccinationRows] = useState([]),
    [vaccinationLoading, setVaccinationLoading] = useState(true),
    [vaccinationEditor, setVaccinationEditor] = useState(null)
  const employeeMap = useMemo(() => {
    const out = {}
    for (const x of employeeRows) {
      out[x.id] = x
      if (x.dbId) out[x.dbId] = x
    }
    return out
  }, [employeeRows])
  const createCapability = createCapabilities[tab]
  const canCreateRecord = Boolean(createCapability) && can(role, createCapability, addOns, custom)
  const source =
    tab === 'handHygiene'
      ? handRows
      : tab === 'waste'
        ? wasteRows
        : tab === 'antiseptics'
          ? antisepticRows
          : tab === 'bundles'
            ? bundleRows
            : vaccinationRows
  const departments = useMemo(() => {
    const support =
      tab === 'handHygiene'
        ? handDepartments
        : tab === 'waste'
          ? wasteSupport.departments
          : tab === 'antiseptics'
            ? antisepticSupport.departments
            : tab === 'bundles'
              ? bundleSupport.departments
              : null
    if (support) return support.map(x => departmentOption(x.el, x.en, language))
    const seen = new Map()
    for (const x of employeeRows)
      if (x.department && !seen.has(x.department))
        seen.set(x.department, departmentOption(x.department, x.departmentEn, language))
    return [...seen.values()]
  }, [
    tab,
    handDepartments,
    wasteSupport.departments,
    antisepticSupport.departments,
    bundleSupport.departments,
    employeeRows,
    language,
  ])
  const rows = useMemo(() => {
    if (tab === 'vaccinations')
      return source
        .filter(x => Boolean(employeeMap[x.employeeId]))
        .filter(x => canAccessRecord(employeeMap[x.employeeId]))
        .filter(x => {
          const e = employeeMap[x.employeeId]
          const hay =
            `${e?.id ?? ''} ${e?.firstName ?? ''} ${e?.firstNameEn ?? ''} ${e?.lastName ?? ''} ${e?.lastNameEn ?? ''} ${x.vaccine ?? ''}`.toLowerCase()
          return hay.includes(query.toLowerCase())
        })
        .filter(x =>
          inDepartment(
            department,
            employeeMap[x.employeeId]?.department,
            employeeMap[x.employeeId]?.departmentEn,
          ),
        )
        .filter(x => status === 'all' || x.status === status)
    return (
      source
        .filter(x => x.lifecycleStatus !== 'voided')
        .filter(x => canAccessRecord({ ...x, department: x.departmentEl }))
        .filter(x => JSON.stringify(x).toLowerCase().includes(query.toLowerCase()))
        .filter(x => inDepartment(department, x.departmentEl, x.departmentEn))
        .filter(x => period === 'all' || x.period === period)
        .filter(x => product === 'all' || x.product === product)
        .filter(x => method === 'all' || x.method === method)
        // Newest first, as the database returns them; demo/local rows arrive in seed order.
        // Monthly records (antiseptics) have a period, not a date.
        .sort((a, b) => String(b.date || b.periodStart || b.period || '').localeCompare(String(a.date || a.periodStart || a.period || '')))
    )
  }, [
    tab,
    source,
    employeeMap,
    query,
    department,
    period,
    product,
    method,
    status,
    canAccessRecord,
  ])

  const reloadHandHygiene = useCallback(async () => {
    if (!tenant?.id || !tabAccess.handHygiene) {
      setHandRows([])
      setHandDepartments([])
      setHandLoading(false)
      return
    }
    setHandLoading(true)
    try {
      const [records, depts] = await Promise.all([
        loadHandHygieneSessions(tenant.id),
        loadHandHygieneDepartments(tenant.id),
      ])
      setHandRows(records)
      setHandDepartments(depts)
    } catch (error) {
      notifyError(error, 'load', { operation: 'hand_hygiene_load' })
    } finally {
      setHandLoading(false)
    }
  }, [tenant?.id, tabAccess.handHygiene, notifyError])
  const reloadWaste = useCallback(async () => {
    if (!tenant?.id || !tabAccess.waste) {
      setWasteRows([])
      setWasteSupport({ departments: [], wasteTypes: [] })
      setWasteLoading(false)
      return
    }
    setWasteLoading(true)
    try {
      const [records, support] = await Promise.all([
        loadWasteMeasurements(tenant.id),
        loadWasteSupportData(tenant.id),
      ])
      setWasteRows(records)
      setWasteSupport(support)
    } catch (error) {
      notifyError(error, 'load', { operation: 'waste_load' })
    } finally {
      setWasteLoading(false)
    }
  }, [tenant?.id, tabAccess.waste, notifyError])
  const reloadAntiseptics = useCallback(async () => {
    if (!tenant?.id || !tabAccess.antiseptics) {
      setAntisepticRows([])
      setAntisepticSupport({ departments: [], products: [] })
      setAntisepticLoading(false)
      return
    }
    setAntisepticLoading(true)
    try {
      const [records, support] = await Promise.all([
        loadAntisepticRecords(tenant.id),
        loadAntisepticSupportData(tenant.id),
      ])
      setAntisepticRows(records)
      setAntisepticSupport(support)
    } catch (error) {
      notifyError(error, 'load', { operation: 'antiseptic_load' })
    } finally {
      setAntisepticLoading(false)
    }
  }, [tenant?.id, tabAccess.antiseptics, notifyError])
  const reloadBundles = useCallback(async () => {
    if (!tenant?.id || !tabAccess.bundles) {
      setBundleRows([])
      setBundleSupport({ departments: [], templates: [] })
      setBundleLoading(false)
      return
    }
    setBundleLoading(true)
    try {
      const [records, support] = await Promise.all([
        loadBundleAssessments(tenant.id),
        loadBundleSupportData(tenant.id),
      ])
      setBundleRows(records)
      setBundleSupport(support)
    } catch (error) {
      notifyError(error, 'load', { operation: 'bundle_load' })
    } finally {
      setBundleLoading(false)
    }
  }, [tenant?.id, tabAccess.bundles, notifyError])
  const reloadVaccinations = useCallback(async () => {
    if (!tenant?.id || !tabAccess.vaccinations) {
      setVaccinationRows([])
      setVaccinationLoading(false)
      return
    }
    setVaccinationLoading(true)
    try {
      setVaccinationRows(await loadAllVaccinationsAsync(tenant.id))
    } catch (error) {
      notifyError(error, 'load', { operation: 'staff_vaccinations_load' })
    } finally {
      setVaccinationLoading(false)
    }
  }, [tenant?.id, tabAccess.vaccinations, notifyError])
  const filtered =
    Boolean(query.trim()) ||
    [department, period, product, method, status].some(value => value !== 'all')
  useEffect(() => {
    setPage(1)
  }, [tab, query, department, period, product, method, status, pageSize])
  useEffect(() => {
    if (!visibleTabs.length) return
    if (visibleTabs.some(([id]) => id === tab)) return
    const nextTab = visibleTabs[0][0]
    setTab(nextTab)
    setSearchParams({ tab: nextTab }, { replace: true })
  }, [tab, visibleTabs, setSearchParams])
  useEffect(() => {
    if (!tenant?.id) return
    if (tabAccess.handHygiene) void reloadHandHygiene()
    else {
      setHandLoading(false)
      setHandRows([])
      setHandDepartments([])
    }
    if (tabAccess.waste) void reloadWaste()
    else {
      setWasteLoading(false)
      setWasteRows([])
      setWasteSupport({ departments: [], wasteTypes: [] })
    }
    if (tabAccess.antiseptics) void reloadAntiseptics()
    else {
      setAntisepticLoading(false)
      setAntisepticRows([])
      setAntisepticSupport({ departments: [], products: [] })
    }
    if (tabAccess.bundles) void reloadBundles()
    else {
      setBundleLoading(false)
      setBundleRows([])
      setBundleSupport({ departments: [], templates: [] })
    }
    if (tabAccess.vaccinations) void reloadVaccinations()
    else {
      setVaccinationLoading(false)
      setVaccinationRows([])
    }
  }, [
    tenant?.id,
    tabAccess.handHygiene,
    tabAccess.waste,
    tabAccess.antiseptics,
    tabAccess.bundles,
    tabAccess.vaccinations,
    reloadHandHygiene,
    reloadWaste,
    reloadAntiseptics,
    reloadBundles,
    reloadVaccinations,
  ])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)),
    safePage = Math.min(page, totalPages),
    pagedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const fmtDate = v => dayLabel(v, language)
  const createLabel =
    tab === 'vaccinations'
      ? t('newVaccinationRecord')
      : (createLabelKeys[tab] && t(createLabelKeys[tab])) || t('preventionNewRecordFallback')
  function changeTab(id) {
    if (!tabAccess[id]) return
    registry.saveViewState({ tab, query, department, period, product, method, status })
    const next = readRegistryViewState(`prevention-${id}`)
    setTab(id)
    setQuery(next?.query || '')
    setDepartment(next?.department || 'all')
    setPeriod(next?.period || 'all')
    setProduct(next?.product || 'all')
    setMethod(next?.method || 'all')
    setStatus(next?.status || 'all')
    setSearchParams({ tab: id }, { replace: true })
  }
  function openPreventionRecord(id, type) {
    if (!tabAccess[type]) return
    registry.saveViewState({ tab: type, query, department, period, product, method, status })
    registry.openRecord(
      navigate,
      `/prevention/${type}/${id}?fromTab=${type}`,
      id,
      rows.map(x => x.id),
      { returnState: { tab: type } },
    )
  }
  function openVaccinationRecord(row) {
    registry.saveViewState({
      tab: 'vaccinations',
      query,
      department,
      period,
      product,
      method,
      status,
    })
    setVaccinationEditor({
      mode: 'record',
      draft: { ...row },
      selectedEmployeeIds: [row.employeeId],
      selectedEmployee: employeeMap[row.employeeId] || null,
      readOnly: true,
    })
  }
  function clearFilters() {
    setQuery('')
    setDepartment('all')
    setPeriod('all')
    setProduct('all')
    setMethod('all')
    setStatus('all')
  }
  function createRecord() {
    if (!canCreateRecord) return
    if (tab === 'vaccinations') {
      setVaccinationEditor({
        mode: 'individual',
        draft: { ...EMPTY_VACCINATION },
        selectedEmployeeIds: [],
      })
      return
    }
    navigate(`/prevention/${tab}/new?fromTab=${tab}`)
  }
  function pageAction(action) {
    if (action === UI_ACTIONS.CREATE) createRecord()
  }
  async function saveVaccination(payload) {
    try {
      if (payload.mode === 'edit') {
        await updateVaccinationAsync(tenant.id, payload.draft.id, payload.draft)
        notify(language === 'en' ? 'Vaccination updated.' : t('vaccinationUpdated'), 'success')
      } else {
        const selected = employeeRows.filter(x => payload.selectedEmployeeIds.includes(x.id))
        await createVaccinationsBulkAsync(tenant.id, selected, payload.draft)
        notify(
          t(
            selected.length === 1
              ? 'copy.preventionCopy.vaccinationSavedOne'
              : 'copy.preventionCopy.vaccinationSavedMany',
          ).replace('{count}', selected.length),
          'success',
        )
      }
      setVaccinationEditor(null)
      await reloadVaccinations()
    } catch (error) {
      notifyError(error, 'save', {
        operation:
          payload.mode === 'edit' ? 'staff_vaccinations_update' : 'staff_vaccinations_create',
      })
    }
  }
  async function deleteVaccination(payload) {
    if (
      !(await confirm({
        title: language === 'en' ? 'Delete vaccination' : t('delete'),
        message:
          language === 'en'
            ? 'Delete this vaccination record? This action cannot be undone.'
            : t('vaccinationDeleteConfirm'),
        confirmLabel: language === 'en' ? 'Delete' : t('delete'),
        danger: true,
      }))
    )
      return
    try {
      await deleteVaccinationAsync(tenant.id, payload.draft.id)
      notify(language === 'en' ? 'Vaccination deleted.' : t('vaccinationDeleted'), 'success')
      setVaccinationEditor(null)
      await reloadVaccinations()
    } catch (error) {
      notifyError(error, 'delete', { operation: 'staff_vaccinations_delete' })
    }
  }
  // Placeholders only until the tab's first read ends: a reload after a save keeps the rows.
  const loading =
    !source.length &&
    (tab === 'handHygiene'
      ? handLoading
      : tab === 'waste'
        ? wasteLoading
        : tab === 'antiseptics'
          ? antisepticLoading
          : tab === 'bundles'
            ? bundleLoading
            : vaccinationLoading)
  const pageActions = canCreateRecord ? [UI_ACTIONS.CREATE] : []
  const actionCapabilities = { [UI_ACTIONS.CREATE]: createCapability }
  return (
    <Page
      fill
      className="prevention-registry-page"
      title={t('preventionCenter')}
      subtitle={t('preventionSubtitle')}
      actions={
        pageActions.length ? (
          <RecordActions
            actions={pageActions}
            actionCapabilities={actionCapabilities}
            actionLabels={{ [UI_ACTIONS.CREATE]: createLabel }}
            onAction={pageAction}
          />
        ) : null
      }
    >
      <CanonicalTabs
        items={visibleTabs.map(([id, key]) => ({ value: id, label: t(key), icon: tabIcons[id] }))}
        value={tab}
        onChange={changeTab}
        ariaLabel={t('preventionCenter')}
      />
      <PreventionKpis
        tab={tab}
        language={language}
        hand={{ rows: handRows, loading: handLoading && !handRows.length }}
        waste={{ rows: wasteRows, loading: wasteLoading && !wasteRows.length }}
        antiseptic={{ rows: antisepticRows, loading: antisepticLoading && !antisepticRows.length }}
        bundle={{ rows: bundleRows, loading: bundleLoading && !bundleRows.length }}
      />
      <div className="surface registry-workspace prevention-workspace workspace-fill">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={tab === 'vaccinations' ? t('searchEmployees') : t('searchPrevention')}
          onClear={clearFilters}
          advanced={
            tab === 'antiseptics' ? (
              <>
                <FilterSelect label={t('period')} value={period} onChange={setPeriod}>
                  <option value="all">{t('all')}</option>
                  {[...new Set(source.map(x => x.period).filter(Boolean))].map(x => (
                    <option key={x} value={x}>
                      {fmtMonth(x)}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect label={t('productFilter')} value={product} onChange={setProduct}>
                  <option value="all">{t('allProducts')}</option>
                  {[...new Set(source.map(x => x.product).filter(Boolean))].map(x => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect label={t('dataSource')} value={method} onChange={setMethod}>
                  <option value="all">{t('allDataSources')}</option>
                  {[...new Set(source.map(x => x.method).filter(Boolean))].map(x => (
                    <option key={x} value={x}>
                      {antisepticMethodLabel(x, language)}
                    </option>
                  ))}
                </FilterSelect>
              </>
            ) : tab === 'bundles' ? (
              <FilterSelect label={t('period')} value={period} onChange={setPeriod}>
                <option value="all">{t('all')}</option>
                {[...new Set(source.map(x => x.period).filter(Boolean))].map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </FilterSelect>
            ) : tab === 'vaccinations' ? (
              <FilterSelect label={t('status')} value={status} onChange={setStatus}>
                <option value="all">{t('all')}</option>
                <option value="complete">{t('complete')}</option>
                <option value="renewSoon">{t('renewSoon')}</option>
              </FilterSelect>
            ) : null
          }
          activeAdvancedCount={
            (department !== 'all' ? 1 : 0) +
            (period !== 'all' ? 1 : 0) +
            (product !== 'all' ? 1 : 0) +
            (method !== 'all' ? 1 : 0) +
            (status !== 'all' ? 1 : 0)
          }
        >
          <FilterSelect label={t('department')} value={department} onChange={setDepartment}>
            <option value="all">{t('allDepartments')}</option>
            {departments.map(x => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </FilterSelect>
        </FilterBar>
        <div className="scroll-table" ref={registry.scrollRef}>
          {loading && <TableSkeleton />}
          {tab === 'handHygiene' && !loading && (
            <HandTable
              rows={pagedRows}
              t={t}
              language={language}
              fmtDate={fmtDate}
              onOpen={id => openPreventionRecord(id, 'handHygiene')}
              registry={registry}
            />
          )}{' '}
          {tab === 'waste' && !loading && (
            <WasteTable
              rows={pagedRows}
              t={t}
              language={language}
              fmtDate={fmtDate}
              onOpen={id => openPreventionRecord(id, 'waste')}
              registry={registry}
            />
          )}{' '}
          {tab === 'antiseptics' && !loading && (
            <AntisepticTable
              rows={pagedRows}
              t={t}
              language={language}
              onOpen={id => openPreventionRecord(id, 'antiseptics')}
              registry={registry}
            />
          )}{' '}
          {tab === 'bundles' && !loading && (
            <BundleTable
              rows={pagedRows}
              t={t}
              language={language}
              onOpen={id => openPreventionRecord(id, 'bundles')}
              registry={registry}
            />
          )}{' '}
          {tab === 'vaccinations' && !loading && (
            <VaccinationTable
              rows={pagedRows}
              t={t}
              language={language}
              fmtDate={fmtDate}
              employeeMap={employeeMap}
              onOpen={openVaccinationRecord}
              registry={registry}
            />
          )}{' '}
          {!loading && !rows.length && (
            <PreventionEmpty
              t={t}
              tab={tab}
              filtered={filtered}
              createLabel={canCreateRecord ? createLabel : ''}
              onCreate={createRecord}
              onClearFilters={clearFilters}
            />
          )}
        </div>
        {rows.length > 0 && (
          <RegistryPagination
            language={language}
            page={safePage}
            totalPages={totalPages}
            totalItems={rows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
      {vaccinationEditor && (
        <StaffVaccinationEditor
          language={language}
          employees={employeeRows.filter(
            x => x.employmentStatus === 'active' && canAccessRecord(x),
          )}
          value={vaccinationEditor}
          canManage={canCreateRecord}
          onChange={setVaccinationEditor}
          onClose={() => setVaccinationEditor(null)}
          onSave={saveVaccination}
          onDelete={deleteVaccination}
        />
      )}
    </Page>
  )
}
// The key figures of the open tab, with their period and target (preventionKpis.js).
function PreventionKpis({ tab, language, hand, waste, antiseptic, bundle }) {
  const en = language === 'en'
  const tr = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translate(`preventionKpis.${key}`, language))
  const fmt = value => (value == null ? null : new Intl.NumberFormat(en ? 'en-GB' : 'el-GR', { maximumFractionDigits: 1 }).format(value))
  const days30 = tr('days30')
  if (tab === 'handHygiene') {
    const k = handHygieneKpis(hand.rows)
    return <KpiStrip label={tr('handHygiene')} columns={3}>
      <KpiCard loading={hand.loading} icon={ShieldCheck} label={tr('whoCompliance')} period={days30} value={fmt(k.rate)} unit="%" status={k.rate == null ? null : k.rate >= HAND_HYGIENE_TARGET ? 'good' : 'danger'} target={tr('handTarget', { value: HAND_HYGIENE_TARGET })} meter={k.rate} meterTarget={HAND_HYGIENE_TARGET} />
      <KpiCard loading={hand.loading} icon={ClipboardCheck} label={tr('opportunities')} period={days30} value={k.opportunities} hint={tr('handHint', { sessions: k.sessions, departments: k.departments })} />
      <KpiCard loading={hand.loading} icon={AlertTriangle} label={tr('belowTarget')} period={days30} value={k.below} status={k.departments ? (k.below ? 'warning' : 'good') : null} target={tr('ofObserved', { departments: k.departments })} />
    </KpiStrip>
  }
  if (tab === 'waste') {
    const k = wasteKpis(waste.rows)
    const period = k.month ? fmtMonth(k.month) : null
    return <KpiStrip label={tr('waste')} columns={3}>
      <KpiCard loading={waste.loading} icon={Recycle} label={tr('wasteMonth')} period={period} value={fmt(k.current?.total)} unit="kg" delta={kpiDelta(k.current?.total, k.before?.total, { lowerIsBetter: true, percent: true, language })} />
      <KpiCard loading={waste.loading} icon={Activity} label={tr('perThousand')} period={period} value={fmt(k.current?.perThousand)} unit="kg" delta={kpiDelta(k.current?.perThousand, k.before?.perThousand, { lowerIsBetter: true, percent: true, language })} />
      <KpiCard loading={waste.loading} icon={Building2} label={tr('departmentsRecorded')} period={period} value={k.current ? `${k.current.departments}/${k.allDepartments}` : null} status={k.current ? (k.current.departments >= k.allDepartments ? 'good' : 'warning') : null} target={tr('everyDepartment')} />
    </KpiStrip>
  }
  if (tab === 'antiseptics') {
    const k = antisepticKpis(antiseptic.rows)
    const period = k.month ? fmtMonth(k.month) : null
    const value = k.current?.perThousand
    return <KpiStrip label={tr('antiseptics')} columns={3}>
      <KpiCard loading={antiseptic.loading} icon={Droplets} label={tr('abhr')} period={period} value={fmt(value)} unit={tr('abhrUnit')} status={value == null ? null : value >= ABHR_TARGET ? 'good' : 'danger'} target={tr('abhrTarget', { value: ABHR_TARGET })} delta={kpiDelta(value, k.before?.perThousand, { percent: true, language })} />
      <KpiCard loading={antiseptic.loading} icon={Droplets} label={tr('useMonth')} period={period} value={fmt(k.current?.total)} unit="L" delta={kpiDelta(k.current?.total, k.before?.total, { percent: true, language })} />
      <KpiCard loading={antiseptic.loading} icon={Building2} label={tr('departmentsRecorded')} period={period} value={k.current ? `${k.current.departments}/${k.allDepartments}` : null} status={k.current ? (k.current.departments >= k.allDepartments ? 'good' : 'warning') : null} target={tr('everyDepartment')} />
    </KpiStrip>
  }
  if (tab === 'bundles') {
    const k = bundleKpis(bundle.rows)
    return <KpiStrip label={tr('bundles')} columns={3}>
      <KpiCard loading={bundle.loading} icon={ClipboardCheck} label={tr('fullCompliance')} period={days30} value={fmt(k.rate)} unit="%" status={k.rate == null ? null : k.rate >= 95 ? 'good' : k.rate >= 80 ? 'warning' : 'danger'} target={tr('allOrNone')} meter={k.rate} />
      <KpiCard loading={bundle.loading} icon={ShieldCheck} label={tr('assessments')} period={days30} value={k.assessments} />
      <KpiCard loading={bundle.loading} icon={AlertTriangle} label={tr('deviations')} period={days30} value={k.deviations} status={k.assessments ? (k.deviations ? 'danger' : 'good') : null} target={tr('zeroTarget')} />
    </KpiStrip>
  }
  return null
}
const preventionEmptyTitleKeys = {
  handHygiene: 'preventionEmptyHandHygieneTitle',
  waste: 'preventionEmptyWasteTitle',
  antiseptics: 'preventionEmptyAntisepticsTitle',
  bundles: 'preventionEmptyBundlesTitle',
}
// The empty list says what to do next: the filters when they hide everything,
// else the button that adds the first record.
function PreventionEmpty({ t, tab, filtered, createLabel, onCreate, onClearFilters }) {
  const text = filtered
    ? undefined
    : createLabel
      ? t('preventionEmptyCreateText').replace('{action}', createLabel)
      : t('preventionEmptyGenericText')
  return (
    <RegistryEmptyState
      filtered={filtered}
      onClearFilters={onClearFilters}
      title={tab === 'vaccinations' ? t('noVaccinationRecords') : t(preventionEmptyTitleKeys[tab])}
      text={text}
      icon={tabIcons[tab]}
      action={createLabel ? { label: createLabel, onClick: onCreate, icon: Plus } : undefined}
    />
  )
}
function rowPropsWithOpen(registry, id, onOpen) {
  const rp = registry.rowProps(id)
  return { ...rp, className: `${rp.className} clickable-row`, onClick: () => onOpen(id) }
}
function HandTable({ rows, t, language, fmtDate, onOpen, registry }) {
  return (
    <RegistryTable sortable={false}
      bare
      columns={[
        { key: 'date', label: t('date') },
        { key: 'department', label: t('department') },
        { key: 'profession', label: t('professionalCategory') },
        { key: 'observations', label: t('observations') },
        { key: 'compliant', label: t('compliant') },
        { key: 'compliance', label: t('compliance') },
        { key: 'observer', label: t('observer') },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{fmtDate(x.date)}</td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>{t(x.profession)}</td>
          <td>{x.observations}</td>
          <td>{x.compliant}</td>
          <td>
            <StatusBadge
              tone={Number(x.rate) < 80 ? 'danger' : 'success'}
              title={Number(x.rate) < 80 ? t('belowWhoHandHygieneTarget') : undefined}
            >
              {fmtNumber(x.rate, language)}%
            </StatusBadge>
          </td>
          <td>{x.observer}</td>
        </>
      )}
    />
  )
}
function WasteTable({ rows, t, language, fmtDate, onOpen, registry }) {
  return (
    <RegistryTable sortable={false}
      bare
      columns={[
        { key: 'period', label: t('period') },
        { key: 'department', label: t('department') },
        { key: 'category', label: t('exportCategory') },
        { key: 'weight', label: t('weight') },
        { key: 'containers', label: t('containers') },
        { key: 'indicator', label: t('preventionIndexWaste') },
        { key: 'document', label: t('documentNumber') },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => {
        const category = x.wasteType || x.type
        return (
          <>
            <td>{wastePeriodLabel(x, fmtDate)}</td>
            <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
            <td>
              <span className={`waste-category-badge ${wasteCategoryTone(category)}`}>
                {language === 'el' ? category : x.typeEn || category}
              </span>
            </td>
            <td>{Number(x.weight).toLocaleString(localeFromLanguage(language))} kg</td>
            <td>{x.containers}</td>
            <td>
              {x.indicator != null ? (
                <>
                  <strong>
                    {Number(x.indicator).toLocaleString(localeFromLanguage(language))}
                  </strong>
                </>
              ) : (
                '—'
              )}
            </td>
            <td>{x.documentNumber || '—'}</td>
          </>
        )
      }}
    />
  )
}
// The usual source (direct measurement) is not repeated on every row: the column appears only
// when some record has another one.
const DEFAULT_SOURCE = 'direct_measurement'
function AntisepticTable({ rows, t, language, onOpen, registry }) {
  const showSource = rows.some(x => x.method !== DEFAULT_SOURCE)
  return (
    <RegistryTable sortable={false}
      bare
      columns={[
        { key: 'period', label: t('period') },
        { key: 'department', label: t('department') },
        { key: 'product', label: t('product') },
        { key: 'litres', label: t('consumptionLitres') },
        { key: 'patientDays', label: t('patientDays') },
        { key: 'indicator', label: t('preventionIndexAbhr') },
        ...(showSource ? [{ key: 'source', label: t('dataSourceShort') }] : []),
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{fmtMonth(x.period)}</td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>
            <strong>{language === 'el' ? x.product : x.productEn || x.product}</strong>
            {x.indicatorEligible === false && (
              <small className="table-cell-unit">{t('notApplicable')} ABHR</small>
            )}
          </td>
          <td>
            <strong>{Number(x.litres).toLocaleString(localeFromLanguage(language))} L</strong>
          </td>
          <td>{x.patientDays || '—'}</td>
          <td>
            {x.indicator != null ? (
              <>
                <strong>{Number(x.indicator).toLocaleString(localeFromLanguage(language))}</strong>
              </>
            ) : (
              '—'
            )}
          </td>
          {showSource && (
            <td>
              {x.method === DEFAULT_SOURCE ? (
                '—'
              ) : (
                <span className={`antiseptic-method-badge ${x.method || 'other'}`}>
                  {antisepticMethodLabel(x.method, language)}
                </span>
              )}
            </td>
          )}
        </>
      )}
    />
  )
}
function BundleTable({ rows, t, language, onOpen, registry }) {
  return (
    <RegistryTable sortable={false}
      bare
      columns={[
        { key: 'date', label: t('date') },
        { key: 'bundle', label: t('bundle') },
        { key: 'department', label: t('department') },
        { key: 'context', label: t('context') },
        { key: 'score', label: t('score') },
        { key: 'allOrNone', label: t('allOrNone') },
        { key: 'deviations', label: t('deviations') },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => rowPropsWithOpen(registry, x.id, onOpen)}
      renderRow={x => (
        <>
          <td>{dayLabel(x.date || x.period, language)}</td>
          <td>
            <strong>
              {language === 'el'
                ? x.templateTitle || x.templateName || x.bundle
                : x.templateName || x.bundle}
            </strong>
            <small className="table-cell-unit">v{x.templateVersion || '1.0'}</small>
          </td>
          <td>{language === 'el' ? x.departmentEl : x.departmentEn}</td>
          <td>
            {t(`shift_${x.shift}`) !== `shift_${x.shift}` ? t(`shift_${x.shift}`) : x.shift || '—'}
          </td>
          <td>
            <strong>{x.score == null ? '—' : `${x.score}%`}</strong>
          </td>
          <td>
            <StatusBadge tone={x.allOrNone ? 'success' : 'danger'}>
              {x.allOrNone ? t('yes') : t('no')}
            </StatusBadge>
          </td>
          <td>
            {(x.failedCount ?? x.findings?.length ?? 0) > 0 ? (
              <span className="bundle-finding-count">{x.failedCount ?? x.findings?.length}</span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
    />
  )
}
function VaccinationTable({ rows, t, language, fmtDate, employeeMap, onOpen, registry }) {
  const name = e =>
    !e
      ? '—'
      : language === 'el'
        ? `${e.lastName} ${e.firstName}`
        : `${e.firstNameEn || e.firstName} ${e.lastNameEn || e.lastName}`
  return (
    <RegistryTable sortable={false}
      bare
      columns={[
        { key: 'employee', label: t('employee') },
        { key: 'vaccine', label: t('vaccine') },
        { key: 'dose', label: t('dose') },
        { key: 'date', label: t('date') },
        { key: 'validUntil', label: t('validUntil') },
        { key: 'status', label: t('status') },
      ]}
      rows={rows}
      rowKey={x => x.id}
      rowProps={x => {
        const rp = registry.rowProps(x.id)
        return { ...rp, className: `${rp.className} clickable-row`, onClick: () => onOpen(x) }
      }}
      renderRow={x => {
        const e = employeeMap[x.employeeId]
        return (
          <>
            <td>
              <strong>{name(e)}</strong>
              <small>{e?.id || '—'}</small>
            </td>
            <td>{x.vaccine || '—'}</td>
            <td>{x.dose || '—'}</td>
            <td>{fmtDate(x.date)}</td>
            <td>{fmtDate(x.validUntil)}</td>
            <td>
              <StatusBadge tone={x.status === 'complete' ? 'success' : 'neutral'}>
                {t(x.status)}
              </StatusBadge>
            </td>
          </>
        )
      }}
    />
  )
}
function localeFromLanguage(language) {
  return language === 'en' ? 'en-GB' : 'el-GR'
}
