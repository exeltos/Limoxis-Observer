import { DueDate } from '../../design-system/DueDate'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock3,
  Microscope,
  Plus,
  UserRound,
  Users,
  UsersRound,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Page } from '../../design-system/Page'
import { CanonicalTabs } from '../../design-system/CanonicalTabs'
import { useSectionTabs } from '../../design-system/SectionTabs'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { FilterBar, FilterSelect } from '../../design-system/FilterBar'
import { MetricCard } from '../../design-system/MetricCard'
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
// The section tab (core/navigation/sectionTabs.js) that opens each list.
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
  } = useTenant()
  const { t, language } = useLanguage(),
    { notify, notifyError } = useFeedback()
  const restored = location.state?.surveillanceView || {}
  const restoredMode = restored.mode === 'batches' ? 'employees' : restored.mode
  // Inside the merged «Surveillance» section the section's tabs choose the list.
  const section = useSectionTabs()
  const sectionMode = section ? SECTION_MODES[section.value] || null : null
  const [patients, setPatients] = useState([]),
    [cases, setCases] = useState([]),
    [employeeRows, setEmployeeRows] = useState([]),
    [environmentRows, setEnvironmentRows] = useState([]),
    [loading, setLoading] = useState(true)
  const { departments } = useDepartments()
  // Clicking a summary card narrows the patient list to it; clicking it again clears it.
  const [quick, setQuick] = useState(null)
  const [mode, setMode] = useState(sectionMode || restoredMode || 'patients'),
    [query, setQuery] = useState(restored.query || ''),
    [department, setDepartment] = useState(restored.department || 'all'),
    [status, setStatus] = useState(restored.status || 'all'),
    [period, setPeriod] = useState(restored.period || 'all'),
    [page, setPage] = useState(restored.page || 1),
    [pageSize, setPageSize] = useState(restored.pageSize || 15),
    [creation, setCreation] = useState(null),
    [resample, setResample] = useState(null)
  useEffect(() => {
    if (sectionMode) setMode(sectionMode)
  }, [sectionMode])
  const registry = useRegistryMemory(`surveillance-${mode}`),
    // Only the demo reads its samples through the registry; in production the
    // environmental rows come from the one laboratory read in load() below.
    laboratoryRegistry = useLaboratoryRegistry({ enabled: isDemo })
  const clinical = useMemo(
    () => createClinicalRepository({ isDemo, organizationId: tenant?.id, actor }),
    [isDemo, tenant?.id, actor],
  )
  const platformOwnerNoTenant = !isDemo && actualRole === ROLES.PLATFORM_OWNER && !tenant?.id
  const productionOrganizations = (memberships || []).filter(
    item => item?.organization?.id && !item.organization.is_demo,
  )
  const { employees: canEmployees, environment: canEnvironment } = surveillanceTabAccess({
    role,
    actualRole,
    isDemo,
    canSeeSensitiveEmployeeHealth,
  })
  // Loading starts true; a reload (the laboratory list arriving, a save) keeps the
  // rows on screen instead of blinking back to the placeholders.
  const load = useCallback(async () => {
    try {
      // The episode, staff and laboratory reads start together: one line per
      // episode and only the environmental samples. The patient roster is read
      // when a new episode is started (below).
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
    setQuick(null)
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
  const activeCases = cases.filter(x => x.status === 'active'),
    active = activeCases.length,
    due = activeCases.filter(x => reviewState(x) === 'overdue').length,
    resistant = activeCases.filter(x => latestResistance(x)).length,
    isolation = activeCases.filter(
      x => x.isolation && !['ended', 'completed', 'closed'].includes(x.isolation.status),
    ).length
  const employeeKpis = isDemo
    ? getDemoEmployeeSurveillanceKpis()
    : getCloudEmployeeSurveillanceKpis(employeeRows)
  // Out-of-limit results count as critical findings, as the rows mark them "Action needed".
  const environmentKpis = {
    ...getEnvironmentalKpis(environmentRows),
    critical: environmentRows.filter(x => x.critical || environmentalNeedsAction(x)).length,
  }
  const environmentDepartmentOptions = departments.map(x => ({
    value: x.id,
    label: x.name,
    labelEn: x.nameEn || x.name,
  }))
  const saveView = () => ({ mode, page: safePage, pageSize, query, department, status, period })
  const openCase = item =>
    registry.openRecord(
      navigate,
      `/surveillance/${item.id}`,
      String(item.id),
      rows.map(x => String(x.id)),
      { returnState: { surveillanceView: saveView() } },
    )
  // A staff screening opens its record page (/surveillance/staff/:id), like the episodes.
  const openEmployee = item =>
    registry.openRecord(
      navigate,
      `/surveillance/staff/${item.recordId || item.id}`,
      String(item.recordId || item.id),
      rows.map(x => String(x.recordId || x.id)),
      { returnState: { surveillanceView: saveView() } },
    )
  // Empty lists say why: nothing recorded yet, or nothing matches the search
  // or filters (cancelled episodes, hidden by default, count as records). The
  // «press Create» hint shows only to those who see the Create button.
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
  // «Create» is a menu of what can be created; each entry opens its form directly.
  const startCreation = kind => {
    if (kind === 'employees' || kind === 'employee') {
      if (canEmployees) setCreation('employee')
    } else if (kind === 'environmental' || kind === 'environment') {
      if (!canEnvironment) return
      setResample(null)
      setCreation('environmental')
    } else setCreation('patient')
  }
  const createItems = [
    {
      id: 'patient',
      icon: UserRound,
      label: t('patient'),
      description: t('clinicalRecords.patientSurveillanceChoiceHelp'),
      onClick: () => startCreation('patient'),
    },
    canEmployees && {
      id: 'employee',
      icon: UsersRound,
      label: t('employee'),
      description: t('clinicalRecords.employeeSurveillanceChoiceHelp'),
      onClick: () => startCreation('employee'),
    },
    canEnvironment && {
      id: 'environment',
      icon: Building2,
      label: t('environmentalSurveillance'),
      description: t('clinicalRecords.environmentalSurveillanceChoiceHelp'),
      onClick: () => startCreation('environment'),
    },
  ].filter(Boolean)
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
        action: canCreate ? { label: t('create'), icon: Plus, onClick: () => startCreation(mode) } : null,
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
      subtitle={t('surveillanceSubtitleV051')}
      actions={
        canCreate && (
          <div className="record-actions">
            <OverflowMenu
              label={t('create')}
              triggerTone="primary"
              align="end"
              width={320}
              trigger={
                <>
                  <Plus size={15} aria-hidden="true" />
                  {t('create')}
                </>
              }
              items={createItems}
            />
          </div>
        )
      }
    >
      <div className="workspace-summary surveillance-summary">
        <div className="module-summary-strip">
          {mode === 'employees' ? (
            <>
              <SummaryMetric
                loading={loading}
                icon={Activity}
                label={t('clinicalRecords.activeEmployeeScreenings')}
                value={employeeKpis.active}
              />
              <SummaryMetric
                loading={loading}
                icon={Microscope}
                label={t('clinicalRecords.positiveEmployeeScreenings')}
                value={employeeKpis.positive}
              />
              <SummaryMetric
                loading={loading}
                icon={AlertTriangle}
                label={t('clinicalRecords.needsIntervention')}
                value={employeeKpis.needsIntervention}
              />
              <SummaryMetric
                loading={loading}
                icon={Clock3}
                label={t('clinicalRecords.needsRecheck')}
                value={employeeKpis.needsRecheck}
              />
            </>
          ) : mode === 'environmental' ? (
            <>
              <SummaryMetric
                loading={loading}
                icon={Activity}
                label={t('clinicalRecords.activeEnvironmentalSampling')}
                value={environmentKpis.active}
              />
              <SummaryMetric
                loading={loading}
                icon={Clock3}
                label={t('clinicalRecords.pendingEnvironmentalLab')}
                value={environmentKpis.pendingLab}
              />
              <SummaryMetric
                loading={loading}
                icon={Microscope}
                label={t('clinicalRecords.positiveEnvironmentalPoints')}
                value={environmentKpis.positive}
              />
              <SummaryMetric
                loading={loading}
                icon={AlertTriangle}
                label={t('clinicalRecords.criticalEnvironmentalFindings')}
                value={environmentKpis.critical}
              />
            </>
          ) : (
            <>
              <SummaryMetric
                loading={loading}
                icon={Activity}
                label={t('activeSurveillance')}
                value={active}
                quickKey="active"
                quick={quick}
                onQuick={setQuick}
              />
              <SummaryMetric
                loading={loading}
                icon={Clock3}
                label={t('clinicalRecords.needsReview')}
                value={due}
                quickKey="due"
                quick={quick}
                onQuick={setQuick}
              />
              <SummaryMetric
                loading={loading}
                icon={AlertTriangle}
                label={t('clinicalRecords.activeIsolation')}
                value={isolation}
                quickKey="isolation"
                quick={quick}
                onQuick={setQuick}
              />
              <SummaryMetric
                loading={loading}
                icon={Microscope}
                label={t('clinicalRecords.mdrXdr')}
                value={resistant}
                quickKey="resistant"
                quick={quick}
                onQuick={setQuick}
              />
            </>
          )}
        </div>
      </div>
      {!section && (
        <CanonicalTabs
          items={tabItems}
          value={mode}
          onChange={setMode}
          ariaLabel={t('surveillanceCategoriesAria')}
        />
      )}
      <div className="surface registry-workspace workspace-fill">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          placeholder={t('search')}
          activeAdvancedCount={
            (department !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (period !== 'all' ? 1 : 0)
          }
          onClear={() => {
            setQuery('')
            setDepartment('all')
            setStatus('all')
            setPeriod('all')
          }}
          advanced={
            <>
              <FilterSelect label={t('department')} value={department} onChange={setDepartment}>
                <option value="all">{t('allDepartments')}</option>
                {departmentNames.map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </FilterSelect>
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
                {PERIOD_DAYS.map(days => (
                  <option key={days} value={String(days)}>
                    {t(`svPeriod${days}`)}
                  </option>
                ))}
              </FilterSelect>
            </>
          }
        />
        {loading ? (
          <TableSkeleton />
        ) : mode === 'patients' ? (
          <PatientRows
            rows={rows}
            empty={empty}
            registry={registry}
            t={t}
            language={language}
            fmt={fmt}
            onOpen={openCase}
          />
        ) : mode === 'employees' ? (
          <EmployeeRows
            rows={rows}
            empty={empty}
            registry={registry}
            language={language}
            fmt={fmt}
            t={t}
            onOpen={openEmployee}
          />
        ) : (
          <EnvironmentalRegistry
            rows={rows}
            empty={empty}
            summaryRows={filtered}
            t={t}
            language={language}
            fmt={fmt}
            onOpenSample={id =>
              registry.openRecord(
                navigate,
                `/surveillance/environment/${id}`,
                String(id),
                filtered.map(x => String(x.code || x.id)),
                { returnState: { surveillanceView: saveView() } },
              )
            }
            onResample={
              canEnvironment
                ? row => {
                    setResample(environmentalResampleInitial(row, environmentDepartmentOptions))
                    setCreation('environmental')
                  }
                : undefined
            }
            highlightId={registry.highlightId}
            scrollRef={registry.scrollRef}
          />
        )}
        {filtered.length > 0 && (
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
      {creation === 'patient' && (
        <NewSurveillanceFlow
          patients={patients}
          onPatientsChange={setPatients}
          onClose={() => setCreation(null)}
          onCreate={createPatient}
        />
      )}
      {creation === 'employee' && canEmployees && (
        <EmployeeSurveillanceFlow onClose={() => setCreation(null)} onCreated={load} />
      )}
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

// One row per patient: cancelled/voided episodes are hidden unless explicitly
// filtered, and a patient with several episodes is summarised on a single line.
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
      const reviews = active
        .map(x => x.reviewDue)
        .filter(Boolean)
        .sort()
      return {
        ...ordered[0],
        episodes: ordered,
        activeCount: active.length,
        groupReviewDue: reviews[0] || ordered[0].reviewDue,
      }
    })
    .sort(
      (a, b) =>
        (b.activeCount ? 1 : 0) - (a.activeCount ? 1 : 0) ||
        String(b.startedAt || '').localeCompare(String(a.startedAt || '')),
    )
}
function episodeSummary(x, t) {
  const total = x.episodes?.length || 1
  const active = x.activeCount ?? (x.status === 'active' ? 1 : 0)
  return `${total} ${t(total === 1 ? 'svEpisodeOne' : 'svEpisodeMany')}${active ? ` · ${active} ${t(active === 1 ? 'svActiveOne' : 'svActiveMany')}` : ''}`
}
function PatientRows({ rows, empty, registry, t, language, fmt, onOpen }) {
  return (
    <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable
        bare
        columns={[
          { key: 'patient', label: t('patient') },
          { key: 'department', label: t('department') },
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
              <small>
                {x.patientId || '—'} · {episodeSummary(x, t)}
              </small>
            </td>
            <td>{language === 'el' ? x.department : x.departmentEn}</td>
            <td>{fmt(x.startedAt)}</td>
            <td>
              <strong>{(x.episodes || [x]).map(latestOrganism).find(Boolean) || '—'}</strong>
              <small>{(x.episodes || [x]).map(latestResistance).find(Boolean) || ''}</small>
            </td>
            <td>
              <StatusBadge tone={statusTone(x.status)}>{t(x.status)}</StatusBadge>
            </td>
            <td>
              {x.status === 'active' ? (
                <DueDate value={x.groupReviewDue ?? x.reviewDue} format={fmt} />
              ) : (
                '—'
              )}
            </td>
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
          {
            key: 'name',
            label: translate('copy.surveillanceCopy.employee', language === 'en' ? 'en' : 'el'),
          },
          {
            key: 'department',
            label: translate('copy.surveillanceCopy.department', language === 'en' ? 'en' : 'el'),
          },
          {
            key: 'date',
            label: translate('copy.surveillanceCopy.started', language === 'en' ? 'en' : 'el'),
          },
          {
            key: 'screening',
            label: translate('copy.surveillanceCopy.screening', language === 'en' ? 'en' : 'el'),
          },
          {
            key: 'result',
            label: translate('copy.surveillanceCopy.result', language === 'en' ? 'en' : 'el'),
          },
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
            <td>
              {(x.screeningTypes || []).map(id => employeeScreeningLabel(id, language)).join(', ') || '—'}
            </td>
            <td>
              <StatusBadge tone={statusTone(x.resultStatus || 'pending')}>
                {t(x.resultStatus || 'pending')}
              </StatusBadge>
            </td>
            <td>
              <EmployeeStatusBadge row={x} t={t} />
            </td>
          </>
        )}
      />
    </div>
  )
}
// The record's follow-up state, from the same fields as the employee summary counts:
// a positive screening without a recorded intervention or re-check (or a re-check
// that is due) still needs follow-up.
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
  const recheckDue =
    row.status === 'active' && row.recheckDue && String(row.recheckDue).slice(0, 10) <= today
  if ((positive && (interventionOpen || interventionMissing || recheckMissing)) || recheckDue)
    return 'needsFollowup'
  return row.status === 'active' ? 'active' : 'completed'
}
function EmployeeStatusBadge({ row, t }) {
  const state = employeeFollowupState(row)
  return (
    <StatusBadge tone={statusTone(state)}>
      {state === 'needsFollowup' ? t('surveillanceList.needsFollowup') : t(state)}
    </StatusBadge>
  )
}
function SummaryMetric({ icon: Icon, label, value, quickKey, quick, onQuick, loading = false }) {
  return (
    <MetricCard
      className="summary-metric"
      loading={loading}
      icon={Icon}
      label={label}
      value={value}
      onClick={
        quickKey && onQuick ? () => onQuick(quick === quickKey ? null : quickKey) : undefined
      }
      active={Boolean(quickKey) && quick === quickKey}
    />
  )
}
// The same rules as the summary counts above the list.
function matchesQuick(x, quick) {
  const active = x.status === 'active'
  if (quick === 'active') return active
  if (quick === 'due') return active && reviewState(x) === 'overdue'
  if (quick === 'isolation')
    return (
      active &&
      Boolean(x.isolation) &&
      !['ended', 'completed', 'closed'].includes(x.isolation.status)
    )
  if (quick === 'resistant') return active && Boolean(latestResistance(x))
  return true
}
