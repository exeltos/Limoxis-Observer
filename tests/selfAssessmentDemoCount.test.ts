import { afterEach, describe, expect, it } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { collectDemoDashboardMetrics } from '../src/features/dashboard/demoDashboardMetrics'
import { loadSelfAssessments } from '../src/features/quality/selfAssessment/selfAssessmentService'
import { demoSelfStatuses } from '../src/features/quality/selfAssessment/selfAssessmentDemo'

afterEach(() => { configureDataEnvironment({ mode: 'production' }) })

describe('the Demo self-assessments, whichever screen opens first', () => {
  it('the dashboard counts the open ones before the list has opened, and the list still seeds its examples', async () => {
    configureDataEnvironment({ mode: 'demo', organizationId: 'demo-self-count', demoAccountId: 'demo-self-count-user' })
    const open = demoSelfStatuses().filter(item => item.status === 'released')
    expect(open.length).toBe(2)
    expect(collectDemoDashboardMetrics().metrics.selfAssessmentsOpen).toBe(2)
    expect(collectDemoDashboardMetrics({ department: open[0].departmentName }).metrics.selfAssessmentsOpen).toBe(1)
    const items = await loadSelfAssessments('demo-self-count')
    expect(items.length).toBe(demoSelfStatuses().length)
    expect(items.filter(item => item.status === 'released').map(item => item.departmentName).sort()).toEqual(open.map(item => item.departmentName).sort())
    expect(collectDemoDashboardMetrics().metrics.selfAssessmentsOpen).toBe(2)
  }, 20000)
})
