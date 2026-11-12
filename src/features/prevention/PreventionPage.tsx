import { useCallback, useEffect, useMemo, useState } from 'react'
import { Page } from '../../design-system/Page'
import { RecordActions } from '../../design-system/RecordActions'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTableSort } from '../../design-system/useTableSort'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { CAPABILITIES, can } from '../../core/permissions/roles'
import { UI_ACTIONS } from '../../core/actions/actionPolicy'
import { useTenant } from '../../core/tenant/TenantContext'
import { useEmployeesData } from '../employees/useEmployeesData'
import { loadAllVaccinationsAsync } from '../occupational-health/vaccinationService'
import { antisepticMethodLabel } from './antisepticMethods'
import { loadHandHygieneDepartments, loadHandHygieneSessions } from './handHygieneCloudService'
import { loadAntisepticRecords, loadAntisepticSupportData } from './antisepticCloudService'
import { loadBundleAssessments, loadBundleSupportData } from './bundleCloudService'
import { loadWasteMeasurements, loadWasteSupportData } from './wasteCloudService'
import { readRegistryViewState, useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { AntisepticTable, BundleTable, HandTable, PreventionEmpty, PreventionKpis, VaccinationTable, WasteTable, dayLabel, fmtMonth, tabIcons } from './PreventionTables'

const tabs = [
  ['handHygiene', 'handHygiene'],
  ['waste', 'wasteManagement'],
  ['antiseptics', 'antisepticConsumption'],
  ['bundles', 'preventionBundles'],
  ['vaccinations', 'vaccinations'],
]
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
  const { notifyError } = useFeedback()
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
    [vaccinationLoading, setVaccinationLoading] = useState(true)
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
  // The arrows in the headers sort the whole filtered list of the tab; the page is cut afterwards.
  const departmentOf = x => (language === 'el' ? x.departmentEl : x.departmentEn)
  const sortAccessors = {
    date: x => x.date || x.period,
    department: departmentOf,
    profession: x => (x.profession ? t(x.profession) : ''),
    observations: x => Number(x.observations),
    compliant: x => Number(x.compliant),
    compliance: x => Number(x.rate),
    observer: x => x.observer,
    period: x => x.period || x.date,
    category: x => x.wasteType || x.type,
    weight: x => Number(x.weight),
    containers: x => Number(x.containers),
    indicator: x => (x.indicator == null ? null : Number(x.indicator)),
    document: x => x.documentNumber,
    product: x => (language === 'el' ? x.product : x.productEn || x.product),
    litres: x => Number(x.litres),
    patientDays: x => Number(x.patientDays),
    source: x => x.method,
    bundle: x => x.templateName || x.bundle,
    context: x => x.shift,
    score: x => (x.score == null ? null : Number(x.score)),
    allOrNone: x => (x.allOrNone ? 1 : 0),
    deviations: x => x.failedCount ?? x.findings?.length ?? 0,
    employee: x => { const e = employeeMap[x.employeeId]; return e ? `${e.lastName ?? ''} ${e.firstName ?? ''}` : '' },
    vaccine: x => x.vaccine,
    dose: x => x.dose,
    validUntil: x => x.validUntil,
    status: x => x.status,
  }
  const { sorted: sortedRows, sort, onSort } = useTableSort(rows, sortAccessors, { key: null, dir: 'asc' }, tab)
  useEffect(() => { setPage(1) }, [sort])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)),
    safePage = Math.min(page, totalPages),
    pagedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
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
    registry.saveViewState({ tab: 'vaccinations', query, department, period, product, method, status })
    registry.openRecord(navigate, `/prevention/vaccinations/${row.id}?fromTab=vaccinations`, row.id, rows.map(x => x.id), { returnState: { tab: 'vaccinations' } })
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
      navigate('/prevention/vaccinations/new?fromTab=vaccinations')
      return
    }
    navigate(`/prevention/${tab}/new?fromTab=${tab}`)
  }
  function pageAction(action) {
    if (action === UI_ACTIONS.CREATE) createRecord()
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
      <div className="surface registry-workspace prevention-workspace workspace-fill">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={tab === 'vaccinations' ? t('searchEmployees') : t('searchPrevention')}
          end={<PreventionKpis
            tab={tab}
            language={language}
            hand={{ rows: handRows, loading: handLoading && !handRows.length }}
            waste={{ rows: wasteRows, loading: wasteLoading && !wasteRows.length }}
            antiseptic={{ rows: antisepticRows, loading: antisepticLoading && !antisepticRows.length }}
            bundle={{ rows: bundleRows, loading: bundleLoading && !bundleRows.length }}
          />}
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
              sort={sort}
              onSort={onSort}
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
              sort={sort}
              onSort={onSort}
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
              sort={sort}
              onSort={onSort}
              t={t}
              language={language}
              onOpen={id => openPreventionRecord(id, 'antiseptics')}
              registry={registry}
            />
          )}{' '}
          {tab === 'bundles' && !loading && (
            <BundleTable
              rows={pagedRows}
              sort={sort}
              onSort={onSort}
              t={t}
              language={language}
              onOpen={id => openPreventionRecord(id, 'bundles')}
              registry={registry}
            />
          )}{' '}
          {tab === 'vaccinations' && !loading && (
            <VaccinationTable
              rows={pagedRows}
              sort={sort}
              onSort={onSort}
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
    </Page>
  )
}
