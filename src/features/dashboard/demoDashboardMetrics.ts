// The Demo hospital's dashboard counts, read from the same sample records the
// other Demo screens show and counted as dashboardCloudService.js counts a real
// hospital, so the tiles and the priority work agree with each other and with
// the screens they open.
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { clinicalCases, demoSurveillanceList } from '../surveillance/clinicalDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { loadControlAssignmentsLocal, loadControlDefinitionsLocal, loadControlExecutionsLocal } from '../controls/controlStore'
import { periodBounds, zonedInstant } from '../controls/controlDueRules'
import { countAdherence } from '../controls/controlAdherence'
import type { ControlFrequency } from '../controls/controlTypes'
import { loadQualityLocal } from '../quality/qualityStore'
import { loadCommittees } from '../committees/committeeData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'
import { employeeRows } from '../employees/employeeDemoData'
import { demoPatientDayPeriods } from '../management/managementData'
import { pendingActionsOf } from './dashboardTasks'
import { loadSnapshot } from '../../core/data/repository'
import { isCommunicated } from '../surveillance/recordAttention'
import { collectDemoDomainMetrics } from '../analysis/analysisDomains'
import { interviewsDemoState } from '../interviews/interviewsDemoData'
import { OPEN_STATUSES as OPEN_CANDIDATE_STATUSES } from '../interviews/interviewsModel'
import { hospitalDate } from '../../core/dates/hospitalDate'
import type { CommunicatedSample } from '../surveillance/surveillanceListTypes'
import { handHygieneRows } from '../prevention/preventionDemoData'
import { sampleDepartmentFigures } from '../division/divisionService'
import { needsSurveillanceReview } from '../laboratory/sampleReviewModel'
import { isContaminationNote } from '../surveillance/skinFloraOrganisms'
import { DEFAULT_HAND_HYGIENE_TARGET, bucketedPositives, departmentHomeWindow, handHygieneMonthCount, isMdrClass, monthlyHandHygieneSeries, normalizeDepartmentHome, organismSummary, type DepartmentHomeOverview, type DepartmentHomeWindow } from './departmentHomeModel'

// What the counts read of the Demo records of the other modules.
type DepartmentRow = { department?: string | { name?: string | null } | null, department_id?: string | null }
type Isolation = { status?: string, nextReview?: string | null }
type StatusRow = { status: string }
type SelfAssessment = StatusRow & { departmentName?: string | null }
type Visit = StatusRow & { followUpDate?: string | null }
type Capa = StatusRow & { dueDate?: string | null }

const CLOSED = ['completed', 'closed', 'cancelled']
const isOpen = (status: string) => !CLOSED.includes(status)
const departmentOf = (row: DepartmentRow) =>
  (typeof row?.department === 'object' ? row.department?.name : row?.department) ||
  row?.department_id ||
  ''

// `department` (a Demo department name) narrows the department-level counts to it.
export function collectDemoDashboardMetrics({ department = null, now = new Date() }: { department?: string | null, now?: Date } = {}) {
  const today = hospitalDate(now)
  const inDepartment = (row: DepartmentRow) => !department || departmentOf(row) === department
  const snapshot = collectAnalysisDemoSnapshot()
  const s = snapshot.summary
  const m = snapshot.microbiology
  const cases = Object.values(clinicalCases).filter(inDepartment)
  const isolations: Isolation[] = cases.map(item => item.isolation).filter((item): item is Isolation => Boolean(item && !Array.isArray(item)))
  const overdueControls = loadControlAssignmentsLocal().filter(
    row =>
      inDepartment(row) && isOpen(row.status) && row.next_due_at && new Date(row.next_due_at) < now,
  ).length
  const endOfToday = periodBounds({ kind: 'daily' }, now).end
  const controlsDueToday = loadControlAssignmentsLocal().filter(
    row => inDepartment(row) && row.status === 'scheduled' && row.next_due_at && new Date(row.next_due_at) < endOfToday,
  ).length
  const pendingSamples = laboratorySamples.filter(
    row =>
      inDepartment(row) &&
      row.subjectType !== 'environment' &&
      !['completed', 'validated', 'cancelled', 'rejected'].includes(row.status as string),
  ).length
  const capas = loadQualityLocal('capas')
  const incidents = loadQualityLocal('incidents')
  const meetings = loadCommittees().flatMap(committee => committee.meetings || [])
  const decisions = loadCommittees().flatMap(committee => committee.decisions || [])
  const visits = loadOccupationalVisits()
  const mdro = (m.resistance || [])
    .filter(([key]) => ['MDR', 'XDR', 'PDR'].includes(key))
    .reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
  const metrics: Record<string, number | undefined> = {
    activeUsers: 3,
    activeDepartments: m.departmentCount,
    // null, not []: the self-assessments seed themselves when their list first opens (a cached [] would stop it).
    selfAssessmentsOpen: (loadSnapshot('quality_local_self_assessments', null) || []).filter(
      (item: SelfAssessment) => item.status === 'released' && (!department || item.departmentName === department),
    ).length,
    patientDayPeriods: demoPatientDayPeriods.length,
    inpatients: cases.length,
    activeSurveillance: demoSurveillanceList().filter(
      item => item.status === 'active' && inDepartment(item),
    ).length,
    isolationReviewsDue: isolations.filter(
      item => item.status === 'active' && item.nextReview && item.nextReview <= today,
    ).length,
    // Patients in isolation now (the user's home: a number only, never who).
    activeIsolation: isolations.filter(item => item.status === 'active').length,
    overdueControls,
    controlsDueToday,
    pendingSamples,
    newSamplesToday: s.dashboard?.newSamplesToday ?? 0,
    positiveLab: m.totalPositive,
    criticalUncommunicated: laboratorySamples.filter(
      row => inDepartment(row) && row.critical && row.result === 'positive' && !isCommunicated(row as CommunicatedSample),
    ).length,
    recentMdro: mdro,
    activeEmployees: s.employees,
    newEmployees30d: s.dashboard?.newEmployees30d ?? 0,
    employeesWithoutDepartment: employeeRows.filter(
      row => row.employmentStatus === 'active' && !row.department,
    ).length,
    ohVisitsToday: s.dashboard?.ohVisitsToday ?? 0,
    ohFollowupsDue: visits.filter(
      (visit: Visit) => visit.followUpDate && visit.followUpDate <= today && isOpen(visit.status),
    ).length,
    vaccinationsDue: s.dashboard?.vaccinationsDue ?? 0,
    openIncidents: incidents.filter((row: StatusRow) => isOpen(row.status)).length,
    severeOpenIncidents: s.dashboard?.severeOpenIncidents ?? 0,
    overdueCapa: capas.filter((row: Capa) => isOpen(row.status) && row.dueDate && row.dueDate < today)
      .length,
    upcomingMeetings: meetings.filter(row => (row.date ?? '') >= today && row.status !== 'cancelled')
      .length,
    pendingMinutes: meetings.filter(
      row => row.date && row.date <= today && !row.finalizedAt && row.status !== 'cancelled',
    ).length,
    openDecisions: decisions.filter(row => isOpen(row.status)).length,
    pendingApprovals: s.antimicrobial?.pending,
    antimicrobialTherapies: s.antimicrobial?.total,
    administrations: s.antimicrobial?.administrations,
  }
  // The administrator's home: suppliers, kitchen (last 30 days) and interviews.
  const monthAgo = hospitalDate(new Date(now.getTime() - 30 * 86400000))
  const food = collectDemoDomainMetrics({ from: monthAgo, to: today }, false, 0).qualityFood || {}
  const candidates = interviewsDemoState().candidates || []
  const nowIso = now.toISOString()
  Object.assign(metrics, {
    expiredCertificates: food.certificatesExpired ?? 0,
    expiringCertificates: food.certificatesExpiring ?? 0,
    supplierRenewalsToApprove: 0,
    supplierRenewalsToReview: 0,
    kitchenOutOfLimits30d: (food.receiptsOut ?? 0) + (food.thermalOut ?? 0),
    kitchenUnverifiedDays: Math.max(0, (food.productionDays ?? 0) - (food.productionDaysVerified ?? 0)),
    openCandidates: candidates.filter(row => OPEN_CANDIDATE_STATUSES.includes(row.status)).length,
    newCandidates: candidates.filter(row => row.status === 'new').length,
    upcomingInterviews: candidates.flatMap(row => row.interviews || []).filter(row => row.status === 'scheduled' && (row.scheduledAt ?? '') >= nowIso).length,
  })
  metrics.pendingActions = pendingActionsOf(metrics)
  return { metrics, snapshot }
}

// «Το τμήμα μου» of the Department Manager in the Demo: the same sample records as the
// other Demo screens (clinical cases, laboratory samples, hand hygiene sessions,
// controls), counted for the period and its comparison as department_home_period_overview counts a hospital (a contamination
// note is no positive); the roster requests, training, influenza vaccination and falls are the department's row of
// the Division Director's sample figures.
export function collectDemoDepartmentHome({ department, now = new Date(), window = departmentHomeWindow('month', hospitalDate(now)) }: { department: string | null, now?: Date, window?: DepartmentHomeWindow }): DepartmentHomeOverview {
  const today = hospitalDate(now)
  const inDepartment = (row: DepartmentRow) => !department || departmentOf(row) === department
  const { metrics } = collectDemoDashboardMetrics({ department, now })
  const { period, compare, bucket } = window
  const within = (day: string | null | undefined, range: { from: string, to: string }) => Boolean(day) && (day as string) >= range.from && (day as string) <= range.to && (day as string) <= today
  const cases = Object.values(clinicalCases).filter(inDepartment).filter(item => item.lifecycleStatus !== 'voided')
  const positives = laboratorySamples
    .filter(row => inDepartment(row) && (!row.subjectType || row.subjectType === 'patient') && row.result === 'positive' && !isContaminationNote(row.organism as string) && !['rejected', 'cancelled'].includes(row.status as string) && row.collectedAt)
    .map(row => ({ row, day: hospitalDate(row.collectedAt as string), mdr: isMdrClass(row.resistance) }))
  const inPeriod = positives.filter(({ day }) => within(day, period))
  const inCompare = positives.filter(({ day }) => within(day, compare))
  const sessions = handHygieneRows
    .filter(row => !department || row.departmentEl === department)
    .map(row => ({ day: row.date, observations: Number(row.observations) || 0, compliant: Number(row.compliant) || 0 }))
  const handHygiene = (range: { from: string, to: string }) => {
    const rows = sessions.filter(row => within(row.day, range))
    const observations = rows.reduce((sum, row) => sum + row.observations, 0)
    const compliant = rows.reduce((sum, row) => sum + row.compliant, 0)
    return { handHygienePct: observations ? Math.round(compliant / observations * 1000) / 10 : null, handHygieneObservations: observations }
  }
  // «Έλεγχοι εκτός χρόνου»: entries done outside their window (controlAdherence, as control_adherence_counts), and
  // assignments fallen overdue in the period and not done yet.
  const definitions = new Map(loadControlDefinitionsLocal().map(row => [row.id, row]))
  const executions = loadControlExecutionsLocal()
  const assignments = loadControlAssignmentsLocal().filter(inDepartment)
  const lateControls = (range: { from: string, to: string }) => {
    const start = zonedInstant(...(range.from.split('-').map(Number) as [number, number, number]))
    const [year, month, day] = range.to.split('-').map(Number)
    const end = new Date(Math.min(zonedInstant(year, month, day + 1).getTime() - 1, now.getTime()))
    let late = 0
    for (const assignment of assignments) {
      const frequency = (assignment.frequency_config || definitions.get(assignment.control_id)?.frequency_config || {}) as ControlFrequency
      const history = executions.filter(row => row.assignment_id === assignment.id).map(row => ({ at: row.performed_at, status: row.status, cancelledAt: row.cancelled_at, isExtra: row.is_extra }))
      const { performed, onTime } = countAdherence(history, frequency, start, end)
      late += performed - onTime
      if (isOpen(assignment.status) && assignment.next_due_at && new Date(assignment.next_due_at) >= start && new Date(assignment.next_due_at) <= end) late += 1
    }
    return late
  }
  const started = (range: { from: string, to: string }) => ({
    newSurveillance: cases.filter(item => within(String(item.startedAt || '').slice(0, 10), range)).length,
    newIsolation: cases.filter(item => item.isolation && !Array.isArray(item.isolation) && within(String((item.isolation as { startedAt?: string }).startedAt || '').slice(0, 10), range)).length,
  })
  const organisms = organismSummary(inPeriod.map(({ row, mdr }) => ({ patient: (row.patientId ?? row.patient ?? null) as string | null, organism: (row.organism ?? null) as string | null, mdr })), inCompare.map(({ row }) => ({ organism: (row.organism ?? null) as string | null })))
  const figures = sampleDepartmentFigures(department)
  const monthCount = handHygieneMonthCount(period)
  return normalizeDepartmentHome({
    positives: inPeriod.length,
    positivesMdr: inPeriod.filter(({ mdr }) => mdr).length,
    positivesAwaiting: inPeriod.filter(({ row }) => needsSurveillanceReview(row)).length,
    patients: organisms.patients,
    organismsCount: organisms.organismsCount,
    organisms: organisms.organisms,
    organismsOtherCount: organisms.organismsOtherCount,
    ...started(period),
    ...handHygiene(period),
    lateControls: lateControls(period),
    compare: {
      positives: inCompare.length,
      positivesMdr: inCompare.filter(({ mdr }) => mdr).length,
      positivesAwaiting: inCompare.filter(({ row }) => needsSurveillanceReview(row)).length,
      patients: new Set(inCompare.map(({ row }) => row.patientId ?? row.patient).filter(Boolean)).size,
      organismsCount: organisms.compareOrganismsCount,
      ...started(compare),
      ...handHygiene(compare),
      lateControls: lateControls(compare),
    },
    positivesSeries: bucketedPositives(inPeriod, period.from, period.to, bucket),
    positivesCompareSeries: bucketedPositives(inCompare, compare.from, compare.to, bucket),
    monthlyHandHygiene: monthlyHandHygieneSeries(sessions.filter(row => row.day <= today), period.to, monthCount),
    monthlyHandHygieneCompare: monthlyHandHygieneSeries(sessions.filter(row => row.day <= today), compare.to, monthCount),
    inpatients: metrics.inpatients,
    beds: null,
    admissionsToday: cases.filter(item => item.admissionDate === today).length,
    reassessmentsDueToday: metrics.isolationReviewsDue,
    handHygieneTarget: DEFAULT_HAND_HYGIENE_TARGET,
    overdueControls: metrics.overdueControls,
    controlsDueToday: metrics.controlsDueToday,
    pendingRosterRequests: figures?.pendingRequests ?? 0,
    trainingExpiring30: figures?.trainingExpiring30 ?? 0,
    trainingPct: figures?.trainingPct ?? null,
    fluPct: figures?.fluPct ?? null,
    falls30: figures?.falls30 ?? 0,
    pressureUlcers30: figures?.pressureUlcers30 ?? 0,
  }, window)
}
