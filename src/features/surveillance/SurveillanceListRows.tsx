// Rows of the Surveillance list (SurveillanceCanonicalPage.tsx): patients grouped with their episodes, employees, and the quick filters.
import { InactiveEmployeeBadge, inactiveEmployeeCodes } from '../../design-system/InactiveEmployeeBadge'
import { useEmployeesData } from '../employees/useEmployeesData'
import { DueDate } from '../../design-system/DueDate'
import { useMemo } from 'react'
import { RegistryTable } from '../../design-system/RegistryTable'
import { StatusBadge } from '../../design-system/StatusBadge'
import { translate } from '../../core/i18n/LanguageContext'
import { environmentalNeedsAction } from './EnvironmentalSurveillanceFlow'
import { employeeScreeningLabel, statusTone } from './surveillanceOptions'
import { ProtocolBadge } from './protocols/ProtocolViews'
import { EpiReminder } from './epiQuestionnaire/EpiQuestionnaireViews'
import { epiPending } from './epiQuestionnaire/useEpiIndex'
import { hospitalToday } from '../../core/dates/hospitalDate'
import { latestOrganism, latestResistance, reviewState } from './surveillanceListModel'

export const HIDDEN_CASE_STATUSES = new Set(['cancelled', 'voided', 'void'])
export function groupByPatient(list) {
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
export function PatientRows({ sort, onSort, loading = false, rows, showDepartment = true, openRuns = [], epiIndex = null, empty, registry, t, language, fmt, onOpen }) {
  const openRunOf = x =>
    (x.episodes || [x])
      .map(ep => openRuns.find(run => String(run.caseId) === String(ep.recordId || ep.id)))
      .find(Boolean)
  return (
    <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable
        bare
        loading={loading}
        sort={sort}
        onSort={onSort}
        columns={[
          { key: 'patient', label: t('patient'), sortable: true },
          ...(showDepartment ? [{ key: 'department', label: t('department'), sortable: true }] : []),
          { key: 'started', label: t('clinicalRecords.startedAt'), sortable: true },
          { key: 'micro', label: t('microbiology'), sortable: true },
          { key: 'status', label: t('status'), sortable: true },
          { key: 'review', label: t('reassessment'), sortable: true },
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
export function EmployeeRows({ sort, onSort, loading = false, rows, empty, registry, language, fmt, t, onOpen }) {
  const rowId = x => String(x.recordId || x.id)
  const { data: staffRows } = useEmployeesData()
  const inactiveCodes = useMemo(() => inactiveEmployeeCodes(staffRows || []), [staffRows])
  return (
    <div className="scroll-table" ref={registry.scrollRef}>
      <RegistryTable
        bare
        loading={loading}
        sort={sort}
        onSort={onSort}
        columns={[
          { key: 'name', label: translate('copy.surveillanceCopy.employee', language === 'en' ? 'en' : 'el'), sortable: true },
          { key: 'department', label: translate('copy.surveillanceCopy.department', language === 'en' ? 'en' : 'el'), sortable: true },
          { key: 'date', label: translate('copy.surveillanceCopy.started', language === 'en' ? 'en' : 'el'), sortable: true },
          { key: 'screening', label: translate('copy.surveillanceCopy.screening', language === 'en' ? 'en' : 'el'), sortable: true },
          { key: 'result', label: translate('copy.surveillanceCopy.result', language === 'en' ? 'en' : 'el'), sortable: true },
          { key: 'status', label: t('status'), sortable: true },
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
          return { ...rp, className: `${rp.className} clickable-row${inactiveCodes.has(String(x.employeeId || '')) ? ' inactive-employee-row' : ''}` }
        }}
        renderRow={x => (
          <>
            <td>
              <strong>{language === 'en' ? x.employeeNameEn : x.employeeName}</strong>
              <InactiveEmployeeBadge inactive={inactiveCodes.has(String(x.employeeId || ''))} />
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
export const POSITIVE_EMPLOYEE_RESULTS = ['positive', 'positive_recheck']
export const CLOSED_EMPLOYEE_STATUSES = ['cancelled', 'voided', 'void']
export function employeeFollowupState(row) {
  if (CLOSED_EMPLOYEE_STATUSES.includes(row.status)) return 'cancelled'
  const today = hospitalToday()
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
export function EmployeeStatusBadge({ row, t }) {
  const state = employeeFollowupState(row)
  return <StatusBadge tone={statusTone(state)}>{state === 'needsFollowup' ? t('surveillanceList.needsFollowup') : t(state)}</StatusBadge>
}
// One count of the row of cards above the list; with a quick key it filters the list, pressing it again shows everything.
export const SAMPLE_PENDING_STATUSES = ['requested', 'collected', 'received', 'processing']
export function matchesEmployeeQuick(row, quick) {
  const today = hospitalToday()
  if (quick === 'active') return row.status === 'active'
  if (quick === 'positive') return row.resultStatus === 'positive'
  if (quick === 'intervention') return ['required', 'in_progress'].includes(row.interventionStatus)
  if (quick === 'recheck') return Boolean(row.recheckDue) && row.recheckDue <= today && row.status === 'active'
  return true
}
export function matchesEnvironmentQuick(row, quick) {
  if (quick === 'active') return SAMPLE_PENDING_STATUSES.includes(row.status)
  if (quick === 'pending') return SAMPLE_PENDING_STATUSES.includes(row.status) && !row.result
  if (quick === 'outside') return environmentalNeedsAction(row)
  if (quick === 'critical') return Boolean(row.critical)
  return true
}
export function matchesQuick(x, quick) {
  const active = x.status === 'active'
  if (quick === 'active') return active
  if (quick === 'due') return active && reviewState(x) === 'overdue'
  if (quick === 'isolation') return active && Boolean(x.isolation) && !['ended', 'completed', 'closed'].includes(x.isolation.status)
  if (quick === 'resistant') return active && Boolean(latestResistance(x))
  return true
}
