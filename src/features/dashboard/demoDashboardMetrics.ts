// The Demo hospital's dashboard counts, read from the same sample records the
// other Demo screens show and counted as dashboardCloudService.js counts a real
// hospital, so the tiles and the priority work agree with each other and with
// the screens they open.
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { clinicalCases, demoSurveillanceList } from '../surveillance/clinicalDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { loadControlAssignmentsLocal } from '../controls/controlStore'
import { periodBounds } from '../controls/controlDueRules'
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
import { DEFAULT_HAND_HYGIENE_TARGET, isMdrClass, monthlyHandHygieneSeries, normalizeDepartmentHome, organismSummary, weeklyPositiveSeries, weekStarts, type DepartmentHomeOverview } from './departmentHomeModel'

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
    selfAssessmentsOpen: (loadSnapshot('quality_local_self_assessments', []) || []).filter(
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
// controls), counted as department_home_overview counts a hospital (a contamination note is no positive); the roster
// requests, training, influenza vaccination and falls are the department's row of the
// Division Director's sample figures.
export function collectDemoDepartmentHome({ department, now = new Date() }: { department: string | null, now?: Date }): DepartmentHomeOverview {
  const today = hospitalDate(now)
  const inDepartment = (row: DepartmentRow) => !department || departmentOf(row) === department
  const { metrics } = collectDemoDashboardMetrics({ department, now })
  const cases = Object.values(clinicalCases).filter(inDepartment)
  const isolations: Isolation[] = cases.map(item => item.isolation).filter((item): item is Isolation => Boolean(item && !Array.isArray(item)))
  const firstDay = [weekStarts(today)[0], hospitalDate(new Date(now.getTime() - 29 * 86400000))].sort()[0]
  const positives = laboratorySamples
    .filter(row => inDepartment(row) && (!row.subjectType || row.subjectType === 'patient') && row.result === 'positive' && !isContaminationNote(row.organism as string) && !['rejected', 'cancelled'].includes(row.status as string) && row.collectedAt)
    .map(row => ({ row, day: hospitalDate(row.collectedAt as string) }))
    .filter(({ day }) => day >= firstDay && day <= today)
    .sort((a, b) => String(b.row.collectedAt).localeCompare(String(a.row.collectedAt)))
  const month = positives.filter(({ day }) => day > hospitalDate(new Date(now.getTime() - 30 * 86400000)))
  const sessions = handHygieneRows
    .filter(row => !department || row.departmentEl === department)
    .map(row => ({ day: row.date, observations: Number(row.observations) || 0, compliant: Number(row.compliant) || 0 }))
  const recent = sessions.filter(row => row.day > hospitalDate(new Date(now.getTime() - 30 * 86400000)) && row.day <= today)
  const observations = recent.reduce((sum, row) => sum + row.observations, 0)
  const compliant = recent.reduce((sum, row) => sum + row.compliant, 0)
  const figures = sampleDepartmentFigures(department)
  return normalizeDepartmentHome({
    inpatients: metrics.inpatients,
    beds: null,
    admissionsToday: cases.filter(item => item.admissionDate === today).length,
    positives30: month.length,
    positivesMdr30: month.filter(({ row }) => isMdrClass(row.resistance)).length,
    positivesAwaiting30: month.filter(({ row }) => needsSurveillanceReview(row)).length,
    activeSurveillance: metrics.activeSurveillance,
    activeIsolation: isolations.filter(item => item.status === 'active').length,
    reassessmentsDueToday: metrics.isolationReviewsDue,
    handHygienePct: observations ? Math.round(compliant / observations * 1000) / 10 : null,
    handHygieneObservations: observations,
    handHygieneTarget: DEFAULT_HAND_HYGIENE_TARGET,
    overdueControls: metrics.overdueControls,
    controlsDueToday: metrics.controlsDueToday,
    pendingRosterRequests: figures?.pendingRequests ?? 0,
    trainingExpiring30: figures?.trainingExpiring30 ?? 0,
    trainingPct: figures?.trainingPct ?? null,
    fluPct: figures?.fluPct ?? null,
    falls30: figures?.falls30 ?? 0,
    pressureUlcers30: figures?.pressureUlcers30 ?? 0,
    weeklyPositives: weeklyPositiveSeries(positives.map(({ row, day }) => ({ day, mdr: isMdrClass(row.resistance) })), today),
    monthlyHandHygiene: monthlyHandHygieneSeries(sessions, today),
    ...organismSummary(month.map(({ row }) => ({ patient: (row.patientId ?? row.patient ?? null) as string | null, organism: (row.organism ?? null) as string | null, mdr: isMdrClass(row.resistance) }))),
  }, today)
}
