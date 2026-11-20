import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Microscope,
  Plus,
  Users,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { useSectionTabs } from '../../design-system/SectionTabs'
import { Button } from '../../design-system/Button'
import { ExportMenu } from '../../design-system/ExportMenu'
import { registryMenu, surveillanceListExport } from '../../core/export/registryExports'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { RegistryTotals } from '../../design-system/RegistryTotals'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { useTableSort } from '../../design-system/useTableSort'
import { formatDateTime, formatDay } from '../../core/i18n/formatDay'
import { matchesSearch } from '../../core/i18n/searchMatch'
import { UI_ACTIONS, canPerform } from '../../core/actions/actionPolicy'
import { CAPABILITIES, ROLES } from '../../core/permissions/roles'
import { useRegistryMemory } from '../../core/navigation/useRegistryMemory'
import { useTenant } from '../../core/tenant/TenantContext'
import { useLanguage, translate } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuditActor } from '../../core/audit/useAuditActor'
import { loadPatients } from '../patients/patientsService'
import { useDepartments } from '../management/useLibraries'
import { useLaboratoryRegistry } from '../laboratory/hooks/useLaboratoryRegistry'
import {
  createLaboratorySample,
  getEnvironmentalKpis,
  loadLaboratorySamples,
} from '../laboratory/laboratoryCloudService'
import { NewSurveillanceFlow } from './NewSurveillanceFlow'
import { createClinicalRepository } from './clinicalRepository'
import { loadClinicalCases, loadHaiClassificationsByCase } from './clinicalCloudService'
import { demoSurveillanceList } from './clinicalDemoData'
import {
  employeeSurveillanceRecords,
  getEmployeeSurveillanceKpis as getDemoEmployeeSurveillanceKpis,
} from './employeeSurveillanceData'
import {
  getEmployeeSurveillanceKpis as getCloudEmployeeSurveillanceKpis,
  loadEmployeeSurveillanceRecords,
} from './employeeSurveillanceCloudService'
import { EmployeeSurveillanceFlow } from './EmployeeSurveillanceFlow'
import {
  EnvironmentalRegistry,
  EnvironmentalSurveillanceFlow,
  environmentalNeedsAction,
  environmentalResampleInitial,
  environmentalStatusDisplay,
} from './EnvironmentalSurveillanceFlow'
import { isEnvironmentalSample } from './environmentalSurveillanceData'
import { PERIOD_DAYS, employeeScreeningLabel, inPeriod } from './surveillanceOptions'
import { surveillanceTabAccess } from './surveillanceTabAccess'
import { loadOpenProtocolRuns } from './protocols/protocolService'
import { useEpiIndex } from './epiQuestionnaire/useEpiIndex'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import { canReviewSamples, sampleEpisodeTarget } from '../laboratory/sampleReviewModel'
import { SampleReviewWorklist, worklistTexts } from './SampleReviewWorklist'
import { bulkSampleActions } from './bulkSampleActions'
import { loadLateOnsetFlags } from './lateOnsetFlags'
import { loadSamplesAwaitingReviewByIds, sampleTypeLabel } from '../laboratory/laboratoryCloudService'
import { normalizeLaboratorySamples } from '../laboratory/model/laboratoryModel'
import { samplesAwaitingReview } from '../laboratory/sampleReviewModel'
import { latestOrganism, latestResistance, reviewState } from './surveillanceListModel'
import { InfectionReportDialog } from './InfectionReportDialog'
import type { InfectionPrintChoice } from './InfectionReportDialog'
import { infectionDocument, surveillanceItems, withHaiClassifications } from './infectionReport'
import type { PatientDaysEntry } from './infectionReport'
import { episodeTypeLabel } from './clinicalRecordLabels'
import { downloadReportWord, printReportLater } from '../../core/export/reportDocument'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { demoPatientDayPeriods } from '../management/managementData'
import { loadPatientDayPeriods } from '../management/patientDayPeriodsCloudService'
import { EmployeeRows, employeeFollowupState, groupByPatient, HIDDEN_CASE_STATUSES, matchesEmployeeQuick, matchesEnvironmentQuick, matchesQuick, PatientRows } from './SurveillanceListRows'
import type { ClinicalCase } from './clinicalTypes'
import type { LibraryDepartment } from '../management/useLibraries'
import type { EmployeeScreeningRow, EnvironmentalResample, EnvironmentalSampleRow, NewEpisodeDraft, OpenProtocolRun, ReviewSample, SurveillanceListRow, SurveillancePatient } from './surveillanceListTypes'

const isEnvironmental = isEnvironmentalSample
const SECTION_MODES: Record<string, string> = { episodes: 'patients', employees: 'employees', environmental: 'environmental' }
const unique = <T,>(values: T[]) => [...new Set(values.filter(Boolean))]
// The three lists of the Surveillance page.
type ListMode = 'patients' | 'employees' | 'environmental'

export function SurveillanceCanonicalPage() {
  const actor = useAuditActor(),
    navigate = useNavigate(),
    location = useLocation()
  const {
    tenant,
    isDemo,
    role,
    actualRole,
    membership,
    memberships,
    setTenantByMembership,
    canAccessRecord,
    canSeeSensitiveEmployeeHealth,
    uxPolicy,
  } = useTenant()
  // A ward role sees only its own department: no department column or filter.
  const ownDepartmentOnly = uxPolicy?.scope === 'department'
  const { t, language } = useLanguage(),
    { notify, notifyError } = useFeedback()
  const restored = location.state?.surveillanceView || {}
  const restoredMode = restored.mode === 'batches' ? 'employees' : restored.mode
  const section = useSectionTabs()
  const sectionMode = section ? SECTION_MODES[section.value] || null : null
  const [patients, setPatients] = useState<SurveillancePatient[]>([]),
    [cases, setCases] = useState<ClinicalCase[]>([]),
    [employeeRows, setEmployeeRows] = useState<EmployeeScreeningRow[]>([]),
    [environmentRows, setEnvironmentRows] = useState<EnvironmentalSampleRow[]>([]),
    [loading, setLoading] = useState(true)
  const { departments }: { departments: LibraryDepartment[] } = useDepartments()
  const [quick, setQuick] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('review') === '1' ? 'review' : null,
  )
  const [mode, setMode] = useState<ListMode>((sectionMode || restoredMode || 'patients') as ListMode),
    [query, setQuery] = useState(restored.query || ''),
    [department, setDepartment] = useState(restored.department || 'all'),
    [status, setStatus] = useState(restored.status || 'all'),
    [period, setPeriod] = useState(restored.period || 'all'),
    [page, setPage] = useState(restored.page || 1),
    [pageSize, setPageSize] = useState(restored.pageSize || 15),
    [creation, setCreation] = useState<string | null>(null),
    [resample, setResample] = useState<EnvironmentalResample | null>(null)
  const [openRuns, setOpenRuns] = useState<OpenProtocolRun[]>([])
  const epiIndex = useEpiIndex({ organizationId: tenant?.id, isDemo, enabled: canWriteEpi(role) })
  useEffect(() => {
    let alive = true
    loadOpenProtocolRuns(tenant?.id, { isDemo })
      .then(rows => {
        if (alive) setOpenRuns(rows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [tenant?.id, isDemo])
  useEffect(() => {
    if (sectionMode) setMode(sectionMode as ListMode)
  }, [sectionMode])
  const registry = useRegistryMemory(`surveillance-${mode}`),
    laboratoryRegistry = useLaboratoryRegistry({ enabled: isDemo })
  const clinical = useMemo(
    () => createClinicalRepository({ isDemo, organizationId: tenant?.id, actor }),
    [isDemo, tenant?.id, actor],
  )
  const canReview = canReviewSamples(role || actualRole)
  // The Platform Owner sees the worklist too, read-only (owner 17/11/2026): what infection control sees, no decision.
  const canSeeReview = canReview || (actualRole === ROLES.PLATFORM_OWNER && Boolean(tenant?.id))
  const awaitingReview = useSamplesAwaitingReview({ enabled: canSeeReview && Boolean(tenant?.id || isDemo) })
  const [lateOnset, setLateOnset] = useState<Record<string, number>>({})
  const bulkReview = bulkSampleActions({ awaitingReview, clinical, language, t, notify })
  useEffect(() => { let live = true; loadLateOnsetFlags(tenant?.id, isDemo).then(flags => { if (live) setLateOnset(flags) }); return () => { live = false } }, [tenant?.id, isDemo])
  // NICU late-onset (N6b): the flagged blood cultures show whatever their date (also the ones the list has not read), first.
  const [lateOnsetRows, setLateOnsetRows] = useState<typeof awaitingReview.rows>([])
  useEffect(() => {
    const known = new Set(awaitingReview.rows.map(row => row.recordId))
    const missing = Object.keys(lateOnset).filter(id => !known.has(id))
    if (!missing.length || isDemo) { setLateOnsetRows([]); return undefined }
    let live = true
    loadSamplesAwaitingReviewByIds(tenant?.id, missing)
      .then(rows => { if (live) setLateOnsetRows(samplesAwaitingReview(normalizeLaboratorySamples(rows))) })
      .catch(() => { if (live) setLateOnsetRows([]) })
    return () => { live = false }
  }, [lateOnset, awaitingReview.rows, tenant?.id, isDemo])
  const reviewRows = useMemo(() => {
    const merged = [...lateOnsetRows, ...awaitingReview.rows.filter(row => !lateOnsetRows.some(extra => extra.recordId === row.recordId))]
    const flaggedFirst = [...merged].sort((a, b) => Number(lateOnset[String(b.recordId)] != null) - Number(lateOnset[String(a.recordId)] != null))
    return flaggedFirst
      .filter(canAccessRecord)
      .filter(x => matchesSearch(query, [x.patient, x.patientEn, x.patientId, x.department, x.departmentEn, x.organism, x.resistance, x.id, formatDateTime(x.collectedAt || x.requestedAt, language), sampleTypeLabel(x, t, language)]))
      .filter(x => department === 'all' || (language === 'el' ? x.department : x.departmentEn) === department)
  }, [awaitingReview.rows, lateOnsetRows, lateOnset, canAccessRecord, query, department, language, t])
  const showWorklist = canSeeReview && mode === 'patients' && quick === 'review'
  const platformOwnerNoTenant = !isDemo && actualRole === ROLES.PLATFORM_OWNER && !tenant?.id
  const productionOrganizations = (memberships || []).filter(
    item => item?.organization?.id && !item.organization.is_demo,
  )
  const { employees: canEmployees, environment: canEnvironment } = surveillanceTabAccess({
    role,
    actualRole,
    canSeeSensitiveEmployeeHealth,
  })
  // The environmental samples (the lighter list, every sample): only for who sees the Environment tab, once it is opened.
  const [environmentLoaded, setEnvironmentLoaded] = useState(false)
  const environmentLoadedRef = useRef(false)
  const loadEnvironment = useCallback(async () => {
    if (isDemo || !tenant?.id || !canEnvironment) return
    try {
      const rows = await loadLaboratorySamples(tenant.id, { environmental: true, since: null })
      setEnvironmentRows(rows.filter(isEnvironmental))
    } catch (error) {
      notifyError(error, 'load', { operation: 'surveillance_environment_load' })
    } finally {
      environmentLoadedRef.current = true
      setEnvironmentLoaded(true)
    }
  }, [isDemo, tenant?.id, canEnvironment, notifyError])
  useEffect(() => {
    if (mode === 'environmental' && !environmentLoaded) void loadEnvironment()
  }, [mode, environmentLoaded, loadEnvironment])
  const load = useCallback(async () => {
    try {
      const rest =
        !isDemo && tenant?.id
          ? Promise.allSettled([
              loadClinicalCases(tenant.id, { summary: true }),
              loadEmployeeSurveillanceRecords(tenant.id),
            ])
          : null
      if (isDemo) {
        setCases(demoSurveillanceList())
        setEmployeeRows(employeeSurveillanceRecords.map(x => ({ ...x })))
        setEnvironmentRows(laboratoryRegistry.rows.filter(isEnvironmental) as EnvironmentalSampleRow[])
      } else if (tenant?.id) {
        const results = (await rest)!
        // A surveillance without a sample is not listed (owner, 8/11/2026): every surveillance starts from a sample.
        const withSample = (row: ClinicalCase) => (row.caseSampleCount ?? (row.samples || []).length) > 0
        setCases(results[0].status === 'fulfilled' ? (results[0].value as ClinicalCase[]).filter(withSample) : [])
        setEmployeeRows(results[1].status === 'fulfilled' ? results[1].value : [])
        // The environmental samples are read when the Environment tab is open (below), not with every Surveillance tab.
        if (environmentLoadedRef.current) await loadEnvironment()
        results
          .filter(x => x.status === 'rejected')
          .forEach(x => notifyError(x.reason, 'load', { operation: 'surveillance_canonical_load' }))
      } else {
        setCases([])
        setEmployeeRows([])
        setEnvironmentRows([])
      }
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, isDemo, laboratoryRegistry.rows, notifyError, loadEnvironment])
  useEffect(() => {
    void load()
  }, [load, canEmployees])
  useEffect(() => {
    if (creation !== 'patient') return
    let alive = true
    loadPatients(tenant?.id, { isDemo })
      .then(roster => {
        if (alive) setPatients(roster)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [creation, tenant?.id, isDemo])
  useEffect(() => {
    setPage(1)
  }, [mode, query, department, status, period, pageSize, quick])
  useEffect(() => {
    setQuick(current => (current === 'review' && mode === 'patients' ? current : null))
  }, [mode])

  const fmt = (value: unknown) => formatDay(value, language)
  const filtered = useMemo((): SurveillanceListRow[] => {
    if (mode === 'patients')
      return groupByPatient(
        cases
          .filter(canAccessRecord)
          .filter(x => !quick || matchesQuick(x, quick))
          // Everything the row shows (owner, 19/11/2026: the searches find everything).
          .filter(x => matchesSearch(query, [x.patient, x.patientEn, x.patientId, x.id, x.department, x.departmentEn, formatDay(x.startedAt, language), latestOrganism(x), latestResistance(x), t(x.status as string)]))
          .filter(
            x =>
              department === 'all' ||
              (language === 'el' ? x.department : x.departmentEn) === department,
          )
          .filter(x => inPeriod(x.startedAt, period))
          .filter(x =>
            status === 'all' ? !HIDDEN_CASE_STATUSES.has(x.status as string) : x.status === status,
          ),
      )
    if (mode === 'employees')
      return employeeRows
        .filter(x => !quick || matchesEmployeeQuick(x, quick))
        .filter(x => matchesSearch(query, [x.employeeName, x.employeeNameEn, x.employeeId, x.department, x.departmentEn, formatDay(x.startedAt, language), ...(x.screeningTypes || []).map((id: string) => employeeScreeningLabel(id, language)), t(String(x.resultStatus || 'pending')), employeeFollowupState(x) === 'needsFollowup' ? t('surveillanceList.needsFollowup') : t(employeeFollowupState(x))]))
        .filter(
          x =>
            department === 'all' ||
            (language === 'el' ? x.department : x.departmentEn) === department,
        )
        .filter(x => inPeriod(x.startedAt, period))
        .filter(x => status === 'all' || x.resultStatus === status || x.status === status)
    return environmentRows
      .filter(x => !quick || matchesEnvironmentQuick(x, quick))
      .filter(x => matchesSearch(query, [x.id, x.code, sampleTypeLabel(x.type, t, language), x.department, x.location, x.point, x.environmentalBatchId, x.organism, formatDay(x.collectedAt || x.requestedAt, language), x.result ? t(String(x.result)) : '', environmentalStatusDisplay(x, t).label]))
      .filter(x => department === 'all' || x.department === department)
      .filter(x => inPeriod(x.collectedAt || x.requestedAt, period))
      .filter(x => status === 'all' || x.status === status)
  }, [
    mode,
    cases,
    employeeRows,
    environmentRows,
    query,
    department,
    status,
    period,
    language,
    canAccessRecord,
    quick,
    t,
  ])
  // The infection report (owner, 19/11/2026): the episodes the list's filters keep, at any date (the dialog sets the
  // period and the comparison), with the patient days entered for them.
  const [infectionPrint, setInfectionPrint] = useState(false)
  const reportCases = useMemo(() => {
    return cases
      .filter(canAccessRecord)
      .filter(x => !quick || matchesQuick(x, quick))
      .filter(x => matchesSearch(query, [x.patient, x.patientEn, x.patientId, x.id, x.department, x.departmentEn, formatDay(x.startedAt, language), latestOrganism(x), latestResistance(x), t(x.status as string)]))
      .filter(x => department === 'all' || (language === 'el' ? x.department : x.departmentEn) === department)
      .filter(x => (status === 'all' ? !HIDDEN_CASE_STATUSES.has(x.status as string) : x.status === status))
  }, [cases, canAccessRecord, quick, query, department, language, status, t])
  const printInfections = (choice: InfectionPrintChoice) => {
    setInfectionPrint(false)
    const en = language === 'en'
    const words = [
      department !== 'all' && `${t('department')}: ${department}`,
      status !== 'all' && `${t('svFilterStatus')}: ${t(status)}`,
      query.trim() && `${t('svFilterSearch')}: “${query.trim()}”`,
      quick && t('svFilterQuick'),
    ].filter(Boolean) as string[]
    const failed = (error: unknown) => notifyError(error, 'export', { operation: 'infection_report' })
    const build = async () => {
      const periods = isDemo ? demoPatientDayPeriods : tenant?.id ? await loadPatientDayPeriods(tenant.id).catch(() => []) : []
      const patientDays: PatientDaysEntry[] = periods.map(row => ({ from: row.from, to: row.to, value: Number(row.value) || 0, department: row.scope === 'department' ? (en ? row.departmentEn || row.departmentEl : row.departmentEl) || row.departmentId : '' }))
      // The production list reads summaries without the HAI classification: it is read here for these episodes;
      // if it cannot be read, the report shows «—» instead of a false «no» (owner, 19/11/2026).
      const hai = isDemo ? null : await loadHaiClassificationsByCase(tenant?.id, reportCases.map(x => String(x.recordId || '')).filter(Boolean)).catch(() => null)
      const withHai = isDemo ? reportCases : withHaiClassifications(reportCases, hai)
      return infectionDocument({ source: 'surveillance', items: surveillanceItems(withHai, { language, siteOf: x => { const site = episodeTypeLabel(x, t); return site === '—' ? '' : site } }), period: { from: choice.from, to: choice.to }, compare: choice.compare, custom: { from: choice.compareFrom, to: choice.compareTo }, detail: choice.detail, language, filters: words, department: department === 'all' ? '' : department, patientDays })
    }
    if (choice.word) { build().then(doc => downloadReportWord(doc)).catch(failed); return }
    if (!printReportLater(build, { language, onError: failed })) notify(t('indicatorsRecords.allowPopups'), 'error')
  }
  // The list's period filter (the last 7, 30, 90 or 365 days) comes into the dialog as dates.
  const periodFrom = period !== 'all' && Number(period) > 0 ? (() => { const day = new Date(`${hospitalToday()}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - Number(period) + 1); return day.toISOString().slice(0, 10) })() : ''

  // The arrows in the headers sort the whole filtered list; the page is cut afterwards.
  const { sorted: sortedRows, sort, onSort } = useTableSort(filtered, {
    patient: x => (language === 'el' ? x.patient : x.patientEn),
    name: x => (language === 'en' ? x.employeeNameEn : x.employeeName),
    department: x => (language === 'el' ? x.department : x.departmentEn),
    started: x => x.startedAt,
    date: x => (mode === 'environmental' ? x.collectedAt || x.requestedAt : x.startedAt),
    micro: x => (x.episodes || [x]).map(latestOrganism).find(Boolean),
    status: x => x.status,
    review: x => (x.status === 'active' ? x.groupReviewDue ?? x.reviewDue : null),
    screening: x => (x.screeningTypes || []).map((id: string) => employeeScreeningLabel(id, language)).join(', '),
    result: x => (mode === 'environmental' ? x.result : x.resultStatus),
    surveillance: x => x.code || x.id,
    point: x => [x.location, x.point].filter(Boolean).join(' · '),
    batch: x => x.environmentalBatchId,
  })
  useEffect(() => { setPage(1) }, [sort])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    safePage = Math.min(page, totalPages),
    rows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const departmentNames = useMemo(
    () =>
      unique(
        mode === 'patients'
          ? cases.map(x => (language === 'el' ? x.department : x.departmentEn))
          : mode === 'employees'
            ? employeeRows.map(x => (language === 'el' ? x.department : x.departmentEn))
            : environmentRows.map(x => x.department),
      ),
    [mode, cases, employeeRows, environmentRows, language],
  )
  const activeCases = cases.filter(x => x.status === 'active' && canAccessRecord(x)),
    active = activeCases.length,
    due = activeCases.filter(x => reviewState(x) === 'overdue').length,
    resistant = activeCases.filter(x => latestResistance(x)).length,
    isolation = activeCases.filter(
      x => x.isolation && !['ended', 'completed', 'closed'].includes(x.isolation.status as string),
    ).length
  const employeeKpis = isDemo
    ? getDemoEmployeeSurveillanceKpis()
    : getCloudEmployeeSurveillanceKpis(employeeRows)
  const environmentKpis = {
    ...getEnvironmentalKpis(environmentRows),
    // Points that need action (a result outside the acceptable limits) and the critical findings, apart.
    outside: environmentRows.filter(x => environmentalNeedsAction(x)).length,
    critical: environmentRows.filter(x => x.critical).length,
  }
  const environmentDepartmentOptions = departments.map(x => ({
    value: x.id,
    label: x.name,
    labelEn: x.nameEn || x.name,
  }))
  // «Resample» is started from inside the environmental sample's record, which sends the sample here.
  const resampleRequest = location.state?.resampleOf || null
  useEffect(() => {
    if (!resampleRequest || !canEnvironment || !environmentDepartmentOptions.length) return
    setMode('environmental')
    setResample(environmentalResampleInitial(resampleRequest, environmentDepartmentOptions))
    setCreation('environmental')
    navigate(`${location.pathname}${location.search}`, { replace: true, state: { ...location.state, resampleOf: undefined } })
  }, [resampleRequest, canEnvironment, environmentDepartmentOptions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const saveView = () => ({ mode, page: safePage, pageSize, query, department, status, period })
  const openCase = (item: SurveillanceListRow) =>
    registry.openRecord(
      navigate,
      `/surveillance/${item.id}`,
      String(item.id),
      rows.map(x => String(x.id)),
      { returnState: { surveillanceView: saveView() } },
    )
  const openEmployee = (item: SurveillanceListRow) =>
    registry.openRecord(
      navigate,
      `/surveillance/staff/${item.recordId || item.id}`,
      String(item.recordId || item.id),
      rows.map(x => String(x.recordId || x.id)),
      { returnState: { surveillanceView: saveView() } },
    )
  const recorded =
    {
      patients: cases.filter(canAccessRecord),
      employees: employeeRows,
      environmental: environmentRows,
    }[mode] || []
  const canCreate = canPerform({
    role: role || actualRole,
    addOns: membership?.capabilities ?? [],
    customCapabilities: membership?.customCapabilities ?? [],
    action: UI_ACTIONS.CREATE,
    resourceCapability: CAPABILITIES.CREATE_SURVEILLANCE,
  })
  const startCreation = (kind: string) => {
    if (kind === 'employees' || kind === 'employee') {
      if (canEmployees) setCreation('employee')
    } else if (kind === 'environmental' || kind === 'environment') {
      if (!canEnvironment) return
      setResample(null)
      setCreation('environmental')
    } else setCreation('patient')
  }
  const empty = recorded.length
    ? {
        title: t('svEmptyFiltered'),
        text: t('svEmptyFilteredHint'),
        filtered: true,
        onClear: () => {
          setQuery('')
          setDepartment('all')
          setStatus('all')
          setPeriod('all')
        },
      }
    : {
        title: t(
          {
            patients: 'svEmptyPatients',
            employees: 'svEmptyEmployees',
            environmental: 'svEmptyEnvironmental',
          }[mode],
        ),
        text: canCreate ? t('svEmptyHint') : '',
        icon: { patients: Activity, employees: Users, environmental: Microscope }[mode],
        action: canCreate ? { label: t({ patients: 'svCreateEpisode', employees: 'svCreateEmployee', environmental: 'svCreateEnvironmental' }[mode] || 'create'), icon: Plus, onClick: () => startCreation(mode) } : null,
      }
  const tabItems = [
    { value: 'patients', label: t('patients'), icon: Activity },
    ...(canEmployees ? [{ value: 'employees', label: t('employees'), icon: Users }] : []),
    ...(canEnvironment
      ? [{ value: 'environmental', label: t('clinicalRecords.environment'), icon: Microscope }]
      : []),
  ]

  async function createPatient(draft: NewEpisodeDraft, patient: SurveillancePatient) {
    // Here the patient's samples are not on hand: the surveillance opens and asks its sample right away (owner, 8/11/2026).
    const { sampleChoice = null, ...caseDraft } = draft
    const created = await clinical.createCase(patient, caseDraft)
    await load()
    notify(t('surveillanceCreated'), 'success')
    if (sampleChoice === 'new' && created?.id) navigate(`/surveillance/${encodeURIComponent(created.id)}`, { state: { askSampleFor: created.id } })
    return created
  }
  interface CreateEnvironmentOptions {
    patientRecordId: string
    draft: Parameters<typeof createLaboratorySample>[2]
  }
  async function createEnvironment({ patientRecordId, draft }: CreateEnvironmentOptions) {
    if (isDemo) return laboratoryRegistry.createSample({ patientRecordId, draft })
    return createLaboratorySample(tenant?.id as string, patientRecordId, draft)
  }

  // The totals beside the search (owner, 8/11/2026: no cards): each one filters the list, a second click clears it.
  // Short words in the line, the full name in the tooltip, so the totals stay on the search's line.
  const SHORT: Record<string, string> = { review: t('svShortReview'), active: t('svShortActive'), due: t('svShortDue'), isolation: t('svShortIsolation'), resistant: 'MDR / XDR' }
  const total = (key: string, label: string, value: number, show = true) => (show ? { key, value, label: mode === 'patients' || !mode ? SHORT[key] || label : label, title: label, active: quick === key, onClick: () => setQuick(quick === key ? null : key) } : null)
  const totals = <RegistryTotals label={t('svTotals')} items={(mode === 'employees' ? [
    total('active', t('clinicalRecords.activeEmployeeScreenings'), employeeKpis.active),
    total('positive', t('clinicalRecords.positiveEmployeeScreenings'), employeeKpis.positive),
    total('intervention', t('clinicalRecords.needsIntervention'), employeeKpis.needsIntervention),
    total('recheck', t('clinicalRecords.needsRecheck'), employeeKpis.needsRecheck),
  ] : mode === 'environmental' ? [
    total('active', t('clinicalRecords.activeEnvironmentalSampling'), environmentKpis.active),
    total('pending', t('clinicalRecords.pendingEnvironmentalLab'), environmentKpis.pendingLab),
    total('outside', t('clinicalRecords.outsideLimitsPoints'), environmentKpis.outside),
    total('critical', t('clinicalRecords.criticalEnvironmentalFindings'), environmentKpis.critical),
  ] : [
    total('review', worklistTexts(language).title, awaitingReview.rows.filter(canAccessRecord).length, canSeeReview),
    total('active', t('activeSurveillance'), active),
    total('due', t('clinicalRecords.needsReview'), due),
    total('isolation', t('clinicalRecords.activeIsolation'), isolation),
    total('resistant', t('clinicalRecords.mdrXdr'), resistant),
  ]).filter(Boolean)} />

  if (platformOwnerNoTenant)
  return (
      <Page
        fill
        title={t('clinicalRecords.surveillanceCenter')}
        subtitle={translate(
          'copy.surveillanceCopy.chooseAnOrganizationToOpenIts',
          language === 'en' ? 'en' : 'el',
        )}
      >
        <div className="surface surveillance-org-context">
          <div className="surveillance-org-context-copy">
            <span className="eyebrow">
              PLATFORM OWNER ·{' '}
              {translate(
                'copy.surveillanceCopy.organizationContext',
                language === 'en' ? 'en' : 'el',
              )}
            </span>
            <h2>
              {translate(
                'copy.surveillanceCopy.selectOrganization',
                language === 'en' ? 'en' : 'el',
              )}
            </h2>
            <p>
              {translate(
                'copy.surveillanceCopy.surveillanceDataAreIsolatedByOrganization',
                language === 'en' ? 'en' : 'el',
              )}
            </p>
          </div>
          <div className="surveillance-org-grid">
            {productionOrganizations.map(item => (
              <button
                key={item.id}
                type="button"
                className="surveillance-org-card"
                onClick={() => setTenantByMembership(item.id)}
              >
                <strong>{item.organization!.name}</strong>
                <span>
                  {item.organization!.code || '—'} · {item.organization!.type || '—'}
                </span>
                <small>
                  {translate(
                    'copy.surveillanceCopy.openLiveSurveillance',
                    language === 'en' ? 'en' : 'el',
                  )}
                </small>
              </button>
            ))}
            {!productionOrganizations.length && (
              <div className="registry-empty-state">
                <strong>
                  {translate(
                    'copy.surveillanceCopy.noOrganizationsAvailable',
                    language === 'en' ? 'en' : 'el',
                  )}
                </strong>
              </div>
            )}
          </div>
        </div>
      </Page>
    )

  return (
    <Page
      fill
      title={t('clinicalRecords.surveillanceCenter')}
      actions={
        <div className="record-actions">
            <ExportMenu {...registryMenu(() => surveillanceListExport(mode, filtered, { language, t, fmt, organism: x => (x.episodes || [x]).map(latestOrganism).find(Boolean) || '', resistance: x => (x.episodes || [x]).map(latestResistance).find(Boolean) || '', screening: id => employeeScreeningLabel(id, language) }), { language, kind: t('sidebarNav.surveillanceSection'), onBlocked: () => notify(t('indicatorsRecords.allowPopups'), 'error') })} disabled={!filtered.length && !(mode === 'patients' && cases.length)} items={mode === 'patients' ? [{ id: 'infection-report', kind: 'print', label: t('svInfectionReport'), onClick: () => setInfectionPrint(true) }] : []} />
            {canCreate && (
            <Button variant="primary" onClick={() => startCreation(mode)}>
              <Plus size={15} aria-hidden="true" />
              {t({ patients: 'svCreateEpisode', employees: 'svCreateEmployee', environmental: 'svCreateEnvironmental' }[mode] || 'create')}
            </Button>
            )}
          </div>
      }
    >
      {!section && (
        <CanonicalTabs items={tabItems} value={mode} onChange={value => setMode(value as ListMode)} ariaLabel={t('surveillanceCategoriesAria')} />
      )}
      <div className="surface registry-workspace workspace-fill">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={t('search')}
          activeAdvancedCount={(department !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0)}
          end={totals}
          onClear={() => {
            setQuery('')
            setDepartment('all')
            setStatus('all')
            setPeriod('all')
          }}
          advanced={
            <>
              {!ownDepartmentOnly && <FilterSelect label={t('department')} value={department} onChange={setDepartment}>
                <option value="all">{t('allDepartments')}</option>
                {departmentNames.map(x => <option key={x} value={x}>{x}</option>)}
              </FilterSelect>}
              <FilterSelect label={t('status')} value={status} onChange={setStatus}>
                <option value="all">{t('all')}</option>
                <option value="active">{t('active')}</option>
                <option value="completed">{t('completed')}</option>
                <option value="positive">{t('positive')}</option>
                <option value="negative">{t('negative')}</option>
                {mode === 'patients' && <option value="cancelled">{t('cancelled')}</option>}
              </FilterSelect>
              <FilterSelect label={t('svPeriod')} value={period} onChange={setPeriod}>
                <option value="all">{t('svPeriodAll')}</option>
                {PERIOD_DAYS.map(days => <option key={days} value={String(days)}>{t(`svPeriod${days}`)}</option>)}
              </FilterSelect>
            </>
          }
        />
        {showWorklist ? (
          awaitingReview.loading ? <TableSkeleton /> : (
            <SampleReviewWorklist
              rows={reviewRows as ReviewSample[]}
              lateOnset={lateOnset}
              readOnly={!canReview}
              empty={{ title: worklistTexts(language).emptyTitle, text: worklistTexts(language).emptyText }}
              language={language}
              t={t}
              canOpenEpisode={canCreate}
              onOpenEpisode={sample => {
                const target = sampleEpisodeTarget(sample)
                navigate(target.path, { state: target.state })
              }}
              onDecide={async (sample, decision) => {
                try {
                  await awaitingReview.review(sample, decision)
                  notify(worklistTexts(language).saved, 'success')
                  return true
                } catch (error) {
                  notifyError(error, 'save', { operation: 'sample_surveillance_review' })
                  return false
                }
              }}
              // Several at once (owner, 19/11/2026): the shared bulk actions (one episode per patient, or one reason for all).
              onBulkOpen={canReview && canCreate ? bulkReview.openEpisodes : undefined}
              onBulkDecide={canReview ? bulkReview.decide : undefined}
            />
          )
        ) : mode === 'patients' ? (
          <PatientRows loading={loading} rows={rows} showDepartment={!ownDepartmentOnly} openRuns={openRuns} epiIndex={epiIndex} empty={empty} registry={registry} t={t} language={language} fmt={fmt} onOpen={openCase} sort={sort} onSort={onSort} />
        ) : mode === 'employees' ? (
          <EmployeeRows loading={loading} rows={rows} empty={empty} registry={registry} language={language} fmt={fmt} t={t} onOpen={openEmployee} sort={sort} onSort={onSort} />
        ) : (
          <EnvironmentalRegistry
            loading={loading || (!isDemo && Boolean(tenant?.id) && canEnvironment && !environmentLoaded)}
            rows={rows}
            empty={empty}
            summaryRows={filtered}
            t={t}
            language={language}
            fmt={fmt}
            onOpenSample={id => registry.openRecord(navigate, `/surveillance/environment/${id}`, String(id), filtered.map(x => String(x.code || x.id)), { returnState: { surveillanceView: saveView() } })}
            highlightId={registry.highlightId}
            scrollRef={registry.scrollRef}
            sort={sort}
            onSort={onSort}
          />
        )}
        {filtered.length > 0 && !showWorklist && (
          <RegistryPagination
            language={language}
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={size => {
              setPageSize(size)
              setPage(1)
            }}
          />
        )}
      </div>
      {creation === 'patient' && <NewSurveillanceFlow patients={patients} onPatientsChange={setPatients} onClose={() => setCreation(null)} onCreate={createPatient} />}
      {creation === 'employee' && canEmployees && <EmployeeSurveillanceFlow onClose={() => setCreation(null)} onCreated={load} />}
      {creation === 'environmental' && canEnvironment && (
        <EnvironmentalSurveillanceFlow
          isDemo={isDemo}
          departmentOptions={environmentDepartmentOptions}
          initial={resample}
          createSample={createEnvironment}
          onClose={() => {
            setCreation(null)
            setResample(null)
          }}
          // The window stays open on its confirmation (print the recording sheet); «Close» closes it.
          onCreated={async () => {
            await load()
            setMode('environmental')
          }}
        />
      )}
      {infectionPrint && <InfectionReportDialog language={language} from={periodFrom} to={periodFrom ? hospitalToday() : ''} onPrint={printInfections} onClose={() => setInfectionPrint(false)} />}
    </Page>
  )
}
