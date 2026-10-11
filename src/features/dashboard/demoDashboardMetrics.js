// The Demo hospital's dashboard counts, read from the same sample records the
// other Demo screens show and counted as dashboardCloudService.js counts a real
// hospital, so the tiles and the priority work agree with each other and with
// the screens they open.
import { collectAnalysisDemoSnapshot } from '../analysis/analysisDemoSnapshot'
import { clinicalCases, demoSurveillanceList } from '../surveillance/clinicalDemoData'
import { laboratorySamples } from '../laboratory/laboratoryDemoData'
import { loadControlAssignmentsLocal } from '../controls/controlStore'
import { loadQualityLocal } from '../quality/qualityStore'
import { loadCommittees } from '../committees/committeeData'
import { loadOccupationalVisits } from '../employees/employeeRecordsService'
import { employeeRows } from '../employees/employeeDemoData'
import { demoPatientDayPeriods } from '../management/managementData'
import { pendingActionsOf } from './dashboardTasks'

const CLOSED = ['completed', 'closed', 'cancelled']
const isOpen = status => !CLOSED.includes(status)
const departmentOf = row =>
  (typeof row?.department === 'object' ? row.department?.name : row?.department) ||
  row?.department_id ||
  ''

// `department` (a Demo department name) narrows the department-level counts to it.
export function collectDemoDashboardMetrics({ department = null, now = new Date() } = {}) {
  const today = now.toISOString().slice(0, 10)
  const inDepartment = row => !department || departmentOf(row) === department
  const snapshot = collectAnalysisDemoSnapshot()
  const s = snapshot.summary
  const m = snapshot.microbiology
  const cases = Object.values(clinicalCases).filter(inDepartment)
  const isolations = cases.map(item => item.isolation).filter(item => item && !Array.isArray(item))
  const overdueControls = loadControlAssignmentsLocal().filter(
    row =>
      inDepartment(row) && isOpen(row.status) && row.next_due_at && new Date(row.next_due_at) < now,
  ).length
  const pendingSamples = laboratorySamples.filter(
    row =>
      inDepartment(row) &&
      row.subjectType !== 'environment' &&
      !['completed', 'validated', 'cancelled', 'rejected'].includes(row.status),
  ).length
  const capas = loadQualityLocal('capas')
  const incidents = loadQualityLocal('incidents')
  const meetings = loadCommittees().flatMap(committee => committee.meetings || [])
  const decisions = loadCommittees().flatMap(committee => committee.decisions || [])
  const visits = loadOccupationalVisits()
  const mdro = (m.resistance || [])
    .filter(([key]) => ['MDR', 'XDR', 'PDR'].includes(key))
    .reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
  const metrics = {
    activeUsers: 3,
    activeDepartments: m.departmentCount,
    patientDayPeriods: demoPatientDayPeriods.length,
    inpatients: cases.length,
    activeSurveillance: demoSurveillanceList().filter(
      item => item.status === 'active' && inDepartment(item),
    ).length,
    isolationReviewsDue: isolations.filter(
      item => item.status === 'active' && item.nextReview && item.nextReview <= today,
    ).length,
    overdueControls,
    pendingSamples,
    newSamplesToday: s.dashboard?.newSamplesToday ?? 0,
    positiveLab: m.totalPositive,
    criticalUncommunicated: m.totalCritical,
    recentMdro: mdro,
    activeEmployees: s.employees,
    newEmployees30d: s.dashboard?.newEmployees30d ?? 0,
    employeesWithoutDepartment: employeeRows.filter(
      row => row.employmentStatus === 'active' && !row.department,
    ).length,
    ohVisitsToday: s.dashboard?.ohVisitsToday ?? 0,
    ohFollowupsDue: visits.filter(
      visit => visit.followUpDate && visit.followUpDate <= today && isOpen(visit.status),
    ).length,
    vaccinationsDue: s.dashboard?.vaccinationsDue ?? 0,
    openIncidents: incidents.filter(row => isOpen(row.status)).length,
    severeOpenIncidents: s.dashboard?.severeOpenIncidents ?? 0,
    overdueCapa: capas.filter(row => isOpen(row.status) && row.dueDate && row.dueDate < today)
      .length,
    upcomingMeetings: meetings.filter(row => row.date >= today && row.status !== 'cancelled')
      .length,
    pendingMinutes: meetings.filter(
      row => row.date && row.date <= today && !row.finalizedAt && row.status !== 'cancelled',
    ).length,
    openDecisions: decisions.filter(row => isOpen(row.status)).length,
    pendingApprovals: s.antimicrobial?.pending,
    antimicrobialTherapies: s.antimicrobial?.total,
    administrations: s.antimicrobial?.administrations,
  }
  metrics.pendingActions = pendingActionsOf(metrics)
  return { metrics, snapshot }
}
