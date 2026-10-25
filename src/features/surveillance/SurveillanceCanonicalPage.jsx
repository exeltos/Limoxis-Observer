import { DueDate } from '../../design-system/DueDate'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { exportRegistry, surveillanceListExport } from '../../core/export/registryExports'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { RegistryPagination } from '../../design-system/RegistryPagination'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDay } from '../../core/i18n/formatDay'
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
import { loadClinicalCases } from './clinicalCloudService'
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
} from './EnvironmentalSurveillanceFlow'
import { isEnvironmentalSample } from './environmentalSurveillanceData'
import { PERIOD_DAYS, employeeScreeningLabel, inPeriod, statusTone } from './surveillanceOptions'
import { surveillanceTabAccess } from './surveillanceTabAccess'
import { ProtocolBadge } from './protocols/ProtocolViews'
import { loadOpenProtocolRuns } from './protocols/protocolService'
import { EpiReminder } from './epiQuestionnaire/EpiQuestionnaireViews'
import { epiPending, useEpiIndex } from './epiQuestionnaire/useEpiIndex'
import { canWriteEpi } from './epiQuestionnaire/epiQuestionnaireText'
import { useSamplesAwaitingReview } from '../laboratory/hooks/useSamplesAwaitingReview'
import { canReviewSamples, sampleEpisodeTarget } from '../laboratory/sampleReviewModel'
import { SampleReviewWorklist, worklistTexts } from './SampleReviewWorklist'

const latestOrganism = row => row.samples?.find(x => x.organism)?.organism || row.organism || null
const latestResistance = row =>
  row.samples?.find(x => x.resistance)?.resistance || row.resistance || null
const reviewState = row =>
  row.status !== 'active'
    ? 'completed'
    : row.reviewDue && new Date(`${String(row.reviewDue).slice(0, 10)}T23:59:59`) < new Date()
      ? 'overdue'
      : 'inProgress'
const isEnvironmental = isEnvironmentalSample
const SECTION_MODES = { episodes: 'patients', employees: 'employees', environmental: 'environmental' }
const unique = values => [...new Set(values.filter(Boolean))]

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
  const [patients, setPatients] = useState([]),
    [cases, setCases] = useState([]),
    [employeeRows, setEmployeeRows] = useState([]),
    [environmentRows, setEnvironmentRows] = useState([]),
    [loading, setLoading] = useState(true)
  const { departments } = useDepartments()
  const [quick, setQuick] = useState(() =>
    new URLSearchParams(location.search).get('review') === '1' ? 'review' : null,
  )
  const [mode, setMode] = useState(sectionMode || restoredMode || 'patients'),
    [query, setQuery] = useState(restored.query || ''),
    [department, setDepartment] = useState(restored.department || 'all'),
    [status, setStatus] = useState(restored.status || 'all'),
    [period, setPeriod] = useState(restored.period || 'all'),
    [page, setPage] = useState(restored.page || 1),
    [pageSize, setPageSize] = useState(restored.pageSize || 15),
    [creation, setCreation] = useState(null),
    [resample, setResample] = useState(null)
  const [openRuns, setOpenRuns] = useState([])
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
    if (sectionMode) setMode(sectionMode)
  }, [sectionMode])
  const registry = useRegistryMemory(`surveillance-${mode}`),
    laboratoryRegistry = useLaboratoryRegistry({ enabled: isDemo })
  const clinical = useMemo(
    () => createClinicalRepository({ isDemo, organizationId: tenant?.id, actor }),
    [isDemo, tenant?.id, actor],
  )
  const canReview = canReviewSamples(role || actualRole)
  const awaitingReview = useSamplesAwaitingReview({ enabled: canReview && Boolean(tenant?.id || isDemo) })
  const reviewRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return awaitingReview.rows
      .filter(canAccessRecord)
      .filter(x => !q || `${x.patient || ''} ${x.patientEn || ''} ${x.patientId || ''} ${x.organism || ''} ${x.id || ''}`.toLowerCase().includes(q))
      .filter(x => department === 'all' || (language === 'el' ? x.department : x.departmentEn) === department)
  }, [awaitingReview.rows, canAccessRecord, query, department, language])
  const showWorklist = canReview && mode === 'patients' && quick === 'review'
  const platformOwnerNoTenant = !isDemo && actualRole === ROLES.PLATFORM_OWNER && !tenant?.id
  const productionOrganizations = (memberships || []).filter(
    item => item?.organization?.id && !item.organization.is_demo,
  )
  const { employees: canEmployees, environment: canEnvironment } = surveillanceTabAccess({
    role,
    actualRole,
    canSeeSensitiveEmployeeHealth,
  })
  const load = useCallback(async () => {
    try {
      const rest =
        !isDemo && tenant?.id
          ? Promise.allSettled([
              loadClinicalCases(tenant.id, { summary: true }),
              loadEmployeeSurveillanceRecords(tenant.id),
              loadLaboratorySamples(tenant.id, { environmental: true }),
            ])
          : null
      if (isDemo) {
        setCases(demoSurveillanceList())
        setEmployeeRows(employeeSurveillanceRecords.map(x => ({ ...x })))
        setEnvironmentRows(laboratoryRegistry.rows.filter(isEnvironmental))
      } else if (tenant?.id) {
        const results = await rest
        setCases(results[0].status === 'fulfilled' ? results[0].value : [])
        setEmployeeRows(results[1].status === 'fulfilled' ? results[1].value : [])
        setEnvironmentRows(
          results[2].status === 'fulfilled' ? results[2].value.filter(isEnvironmental) : [],
        )
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
  }, [tenant?.id, isDemo, laboratoryRegistry.rows, notifyError])
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

  const fmt = value => formatDay(value, language)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (mode === 'patients')
      return groupByPatient(
        cases
          .filter(canAccessRecord)
          .filter(x => !quick || matchesQuick(x, quick))
          .filter(x =>
            `${x.patient || ''} ${x.patientEn || ''} ${x.patientId || ''} ${latestOrganism(x) || ''}`
              .toLowerCase()
              .includes(q),
          )
          .filter(
            x =>
              department === 'all' ||
              (language === 'el' ? x.department : x.departmentEn) === department,
          )
          .filter(x => inPeriod(x.startedAt, period))
          .filter(x =>
            status === 'all' ? !HIDDEN_CASE_STATUSES.has(x.status) : x.status === status,
          ),
      )
    if (mode === 'employees')
      return employeeRows
        .filter(x => !quick || matchesEmployeeQuick(x, quick))
        .filter(x =>
          `${x.employeeName || ''} ${x.employeeNameEn || ''} ${x.employeeId || ''}`
            .toLowerCase()
            .includes(q),
        )
        .filter(
          x =>
            department === 'all' ||
            (language === 'el' ? x.department : x.departmentEn) === department,
        )
        .filter(x => inPeriod(x.startedAt, period))
        .filter(x => status === 'all' || x.resultStatus === status || x.status === status)
    return environmentRows
      .filter(x => !quick || matchesEnvironmentQuick(x, quick))
      .filter(x =>
        `${x.type || ''} ${x.source || ''} ${x.department || ''} ${x.organism || ''}`
          .toLowerCase()
          .includes(q),
      )
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
  ])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    safePage = Math.min(page, totalPages),
    rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
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
      x => x.isolation && !['ended', 'completed', 'closed'].includes(x.isolation.status),
    ).length
  const employeeKpis = isDemo
    ? getDemoEmployeeSurveillanceKpis()
    : getCloudEmployeeSurveillanceKpis(employeeRows)
  const environmentKpis = {
    ...getEnvironmentalKpis(environmentRows),
    critical: environmentRows.filter(x => x.critical || environmentalNeedsAction(x)).length,
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
  const openCase = item =>
    registry.openRecord(
      navigate,
      `/surveillance/${item.id}`,
      String(item.id),
      rows.map(x => String(x.id)),
      { returnState: { surveillanceView: saveView() } },
    )
  const openEmployee = item =>
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
  const startCreation = kind => {
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

  async function createPatient(draft, patient) {
    const created = await clinical.createCase(patient, draft)
    await load()
    notify(t('surveillanceCreated'), 'success')
    return created
  }
  async function createEnvironment({ patientRecordId, draft }) {
    if (isDemo) return laboratoryRegistry.createSample({ patientRecordId, draft })
    return createLaboratorySample(tenant?.id, patientRecordId, draft)
  }

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
                <strong>{item.organization.name}</strong>
                <span>
                  {item.organization.code || '—'} · {item.organization.type || '—'}
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
      subtitle={t({ employees: 'svSubtitleEmployees', environmental: 'svSubtitleEnvironmental' }[mode] || 'surveillanceSubtitleV051')}
      actions={
        <div className="record-actions">
            <ExportMenu onExcel={() => exportRegistry(surveillanceListExport(mode, filtered, { language, t, fmt, organism: x => (x.episodes || [x]).map(latestOrganism).find(Boolean) || '', resistance: x => (x.episodes || [x]).map(latestResistance).find(Boolean) || '', screening: id => employeeScreeningLabel(id, language) }))} disabled={!filtered.length} />
            {canCreate && (
            <Button variant="primary" onClick={() => startCreation(mode)}>
              <Plus size={15} aria-hidden="true" />
              {t({ patients: 'svCreateEpisode', employees: 'svCreateEmployee', environmental: 'svCreateEnvironmental' }[mode] || 'create')}
            </Button>
            )}
          </div>
      }
    >
      <StatusChipsRow>
          {mode === 'employees' ? (
            <>
              <SummaryMetric loading={loading} label={t('clinicalRecords.activeEmployeeScreenings')} value={employeeKpis.active} quickKey="active" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.positiveEmployeeScreenings')} value={employeeKpis.positive} quickKey="positive" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.needsIntervention')} value={employeeKpis.needsIntervention} quickKey="intervention" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.needsRecheck')} value={employeeKpis.needsRecheck} quickKey="recheck" quick={quick} onQuick={setQuick} />
            </>
          ) : mode === 'environmental' ? (
            <>
              <SummaryMetric loading={loading} label={t('clinicalRecords.activeEnvironmentalSampling')} value={environmentKpis.active} quickKey="active" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.pendingEnvironmentalLab')} value={environmentKpis.pendingLab} quickKey="pending" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.positiveEnvironmentalPoints')} value={environmentKpis.positive} quickKey="positive" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.criticalEnvironmentalFindings')} value={environmentKpis.critical} quickKey="critical" quick={quick} onQuick={setQuick} />
            </>
          ) : (
            <>
              {canReview && (
                <SummaryMetric loading={awaitingReview.loading} label={worklistTexts(language).title} value={awaitingReview.rows.filter(canAccessRecord).length} quickKey="review" quick={quick} onQuick={setQuick} />
              )}
              <SummaryMetric loading={loading} label={t('activeSurveillance')} value={active} quickKey="active" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.needsReview')} value={due} quickKey="due" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.activeIsolation')} value={isolation} quickKey="isolation" quick={quick} onQuick={setQuick} />
              <SummaryMetric loading={loading} label={t('clinicalRecords.mdrXdr')} value={resistant} quickKey="resistant" quick={quick} onQuick={setQuick} />
            </>
          )}
      </StatusChipsRow>
      {!section && (
        <CanonicalTabs items={tabItems} value={mode} onChange={setMode} ariaLabel={t('surveillanceCategoriesAria')} />
      )}
      <div className="surface registry-workspace workspace-fill">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={t('search')}
          activeAdvancedCount={(department !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0)}
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
              rows={reviewRows}
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
            />
          )
        ) : loading ? <TableSkeleton /> : mode === 'patients' ? (
          <PatientRows rows={rows} showDepartment={!ownDepartmentOnly} openRuns={openRuns} epiIndex={epiIndex} empty={empty} registry={registry} t={t} language={language} fmt={fmt} onOpen={openCase} />
        ) : mode === 'employees' ? (
          <EmployeeRows rows={rows} empty={empty} registry={registry} language={language} fmt={fmt} t={t} onOpen={openEmployee} />
        ) : (
          <EnvironmentalRegistry
            rows={rows}
            empty={empty}
            summaryRows={filtered}
            t={t}
            language={language}
            fmt={fmt}
            onOpenSample={id => registry.openRecord(navigate, `/surveillance/environment/${id}`, String(id), filtered.map(x => String(x.code || x.id)), { returnState: { surveillanceView: saveView() } })}
            highlightId={registry.highlightId}
            scrollRef={registry.scrollRef}
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
          onCreated={async () => {
            setCreation(null)
            setResample(null)
            await load()
            setMode('environmental')
          }}
        />
      )}
    </Page>
  )
}

const HIDDEN_CASE_STATUSES = new Set(['cancelled', 'voided', 'void'])
function groupByPatient(list) {
  const groups = new Map()
  for (const item of list) {
    const key = String(item.patientRecordId || item.patientId || item.patient || item.id)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return [...groups.values()]
    .map(items => {
      const ordered = [...items].sort(
        (a, b) =>
          (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) ||
          String(b.startedAt || '').localeCompare(String(a.startedAt || '')),
      )
      const active = ordered.filter(x => x.status === 'active')
      const reviews = active.map(x => x.reviewDue).filter(Boolean).sort()
      const explicitSampleCounts = ordered
        .map(x => x.sampleCount)
        .filter(value => value != null && Number.isFinite(Number(value)))
      const linkedSampleCount = new Set(
        ordered.flatMap(x =>
          (x.samples || [])
            .map(sample => sample.recordId || sample.id)
            .filter(Boolean),
        ),
      ).size
      return {
        ...ordered[0],
        episodes: ordered,
        activeCount: active.length,
        sampleCount: explicitSampleCounts.length
          ? Math.max(...explicitSampleCounts.map(Number))
          : linkedSampleCount,
        groupReviewDue: reviews[0] || ordered[0].reviewDue,
      }
    })
    .sort(
      (a, b) =>
        (b.activeCount ? 1 : 0) - (a.activeCount ? 1 : 0) ||
        String(b.startedAt || '').localeCompare(String(a.startedAt || '')),
    )
}
function PatientRows({ rows, showDepartment = true, openRuns = [], epiIndex = null, empty, registry, t, language, fmt, onOpen }) {
  const openRunOf = x =>
    (x.episodes || [x])
      .map(ep => openRuns.find(run => String(run.caseId) === String(ep.recordId || ep.id)))
      .find(Boolean)
  return (
    <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable
        bare
        columns={[
          { key: 'patient', label: t('patient') },
          ...(showDepartment ? [{ key: 'department', label: t('department') }] : []),
          { key: 'started', label: t('clinicalRecords.startedAt') },
          { key: 'micro', label: t('microbiology') },
          { key: 'status', label: t('status') },
          { key: 'review', label: t('reassessment') },
        ]}
        rows={rows}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
        emptyFiltered={Boolean(empty?.filtered)}
        onClearFilters={empty?.onClear}
        emptyIcon={empty?.icon}
        emptyAction={empty?.action}
        rowKey={x => x.id}
        rowProps={x => {
          const rp = registry.rowProps(String(x.id), () => onOpen(x))
          return { ...rp, className: `${rp.className} clickable-row` }
        }}
        renderRow={x => (
          <>
            <td>
              <strong>{language === 'el' ? x.patient : x.patientEn}</strong>
              <small>{x.patientId || '—'}</small>
              <ProtocolBadge entry={openRunOf(x)} t={t} language={language} />
            </td>
            {showDepartment && <td>{language === 'el' ? x.department : x.departmentEn}</td>}
            <td>{fmt(x.startedAt)}</td>
            <td>
              <strong>{(x.episodes || [x]).map(latestOrganism).find(Boolean) || '—'}</strong>
              <small>{(x.episodes || [x]).map(latestResistance).find(Boolean) || ''}</small>
            </td>
            <td>
              <StatusBadge tone={statusTone(x.status)}>{t(x.status)}</StatusBadge>
              {(x.episodes || [x]).some(ep => epiPending(epiIndex, ep)) && (
                <small className="epi-row-line"><EpiReminder /></small>
              )}
            </td>
            <td>{x.status === 'active' ? <DueDate value={x.groupReviewDue ?? x.reviewDue} format={fmt} /> : '—'}</td>
          </>
        )}
      />
    </div>
  )
}
function EmployeeRows({ rows, empty, registry, language, fmt, t, onOpen }) {
  const rowId = x => String(x.recordId || x.id)
  return (
    <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable
        bare
        columns={[
          { key: 'name', label: translate('copy.surveillanceCopy.employee', language === 'en' ? 'en' : 'el') },
          { key: 'department', label: translate('copy.surveillanceCopy.department', language === 'en' ? 'en' : 'el') },
          { key: 'date', label: translate('copy.surveillanceCopy.started', language === 'en' ? 'en' : 'el') },
          { key: 'screening', label: translate('copy.surveillanceCopy.screening', language === 'en' ? 'en' : 'el') },
          { key: 'result', label: translate('copy.surveillanceCopy.result', language === 'en' ? 'en' : 'el') },
          { key: 'status', label: t('status') },
        ]}
        rows={rows}
        emptyTitle={empty?.title}
        emptyText={empty?.text}
        emptyFiltered={Boolean(empty?.filtered)}
        onClearFilters={empty?.onClear}
        emptyIcon={empty?.icon}
        emptyAction={empty?.action}
        rowKey={rowId}
        rowProps={x => {
          const rp = registry.rowProps(rowId(x), () => onOpen(x))
          return { ...rp, className: `${rp.className} clickable-row` }
        }}
        renderRow={x => (
          <>
            <td>
              <strong>{language === 'en' ? x.employeeNameEn : x.employeeName}</strong>
              <small>{x.employeeId || '—'}</small>
            </td>
            <td>{language === 'en' ? x.departmentEn : x.department}</td>
            <td>{fmt(x.startedAt)}</td>
            <td>{(x.screeningTypes || []).map(id => employeeScreeningLabel(id, language)).join(', ') || '—'}</td>
            <td><StatusBadge tone={statusTone(x.resultStatus || 'pending')}>{t(x.resultStatus || 'pending')}</StatusBadge></td>
            <td><EmployeeStatusBadge row={x} t={t} /></td>
          </>
        )}
      />
    </div>
  )
}
const POSITIVE_EMPLOYEE_RESULTS = ['positive', 'positive_recheck']
const CLOSED_EMPLOYEE_STATUSES = ['cancelled', 'voided', 'void']
function employeeFollowupState(row) {
  if (CLOSED_EMPLOYEE_STATUSES.includes(row.status)) return 'cancelled'
  const today = new Date().toISOString().slice(0, 10)
  const positive = POSITIVE_EMPLOYEE_RESULTS.includes(row.resultStatus)
  const interventionOpen = ['required', 'in_progress'].includes(row.interventionStatus)
  const interventionMissing =
    !row.intervention &&
    !row.noIntervention &&
    !['completed', 'recorded', 'in_progress'].includes(row.interventionStatus)
  const recheckMissing = !row.recheckDate && !row.recheckDue && !row.noRecheck
  const recheckDue = row.status === 'active' && row.recheckDue && String(row.recheckDue).slice(0, 10) <= today
  if ((positive && (interventionOpen || interventionMissing || recheckMissing)) || recheckDue) return 'needsFollowup'
  return row.status === 'active' ? 'active' : 'completed'
}
function EmployeeStatusBadge({ row, t }) {
  const state = employeeFollowupState(row)
  return <StatusBadge tone={statusTone(state)}>{state === 'needsFollowup' ? t('surveillanceList.needsFollowup') : t(state)}</StatusBadge>
}
// One count of the row of chips above the list; with a quick key it filters the list, pressing it again shows everything.
function SummaryMetric({ label, value, quickKey, quick, onQuick, loading = false }) {
  const active = Boolean(quickKey) && quick === quickKey
  return (
    <button type="button" className={`status-chip ${active ? 'is-active' : ''} ${quickKey ? '' : 'is-static'}`.replace(/\s+/g, ' ').trim()} aria-pressed={quickKey ? active : undefined} disabled={!quickKey} onClick={quickKey && onQuick ? () => onQuick(quick === quickKey ? null : quickKey) : undefined}>
      {label}
      <strong>{loading ? '…' : value}</strong>
    </button>
  )
}
function StatusChipsRow({ children }) {
  return <div className="status-chips">{children}</div>
}
const SAMPLE_PENDING_STATUSES = ['requested', 'collected', 'received', 'processing']
function matchesEmployeeQuick(row, quick) {
  const today = new Date().toISOString().slice(0, 10)
  if (quick === 'active') return row.status === 'active'
  if (quick === 'positive') return row.resultStatus === 'positive'
  if (quick === 'intervention') return ['required', 'in_progress'].includes(row.interventionStatus)
  if (quick === 'recheck') return Boolean(row.recheckDue) && row.recheckDue <= today && row.status === 'active'
  return true
}
function matchesEnvironmentQuick(row, quick) {
  if (quick === 'active') return SAMPLE_PENDING_STATUSES.includes(row.status)
  if (quick === 'pending') return SAMPLE_PENDING_STATUSES.includes(row.status) && !row.result
  if (quick === 'positive') return row.result === 'positive'
  if (quick === 'critical') return Boolean(row.critical) || environmentalNeedsAction(row)
  return true
}
function matchesQuick(x, quick) {
  const active = x.status === 'active'
  if (quick === 'active') return active
  if (quick === 'due') return active && reviewState(x) === 'overdue'
  if (quick === 'isolation') return active && Boolean(x.isolation) && !['ended', 'completed', 'closed'].includes(x.isolation.status)
  if (quick === 'resistant') return active && Boolean(latestResistance(x))
  return true
}
